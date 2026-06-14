const STUDYPLAN_USERNAME_KEY = 'studyplan_username';
const STUDYPLAN_ACTIVE_ROOM_KEY = 'studyplan_active_room';
let username = localStorage.getItem(STUDYPLAN_USERNAME_KEY) || '';
let activeRoomId = localStorage.getItem(STUDYPLAN_ACTIVE_ROOM_KEY) || '';
let roomPollInterval = null;
let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroRunning = false;
let roomMessageTimeout = null;
let socket = null;

function ensureUsername() {
  username = username && username.trim() ? username.trim() : '';
  if (!username) {
    const entered = prompt('Enter your display name for Study Rooms');
    username = entered ? entered.trim() : '';
  }
  if (!username) {
    username = 'Guest';
  }
  localStorage.setItem(STUDYPLAN_USERNAME_KEY, username);
}

function syncNameInputs() {
  ['create-room-name', 'join-room-name'].forEach((id) => {
    const input = document.getElementById(id);
    if (input && !input.value.trim()) {
      input.value = username;
    }
  });
}

function getCurrentName() {
  const createInput = document.getElementById('create-room-name');
  const joinInput = document.getElementById('join-room-name');
  const explicitName = createInput?.value?.trim() || joinInput?.value?.trim();

  if (explicitName) {
    username = explicitName;
    localStorage.setItem(STUDYPLAN_USERNAME_KEY, username);
    syncNameInputs();
    return username;
  }

  if (username && username.trim()) {
    return username;
  }

  const entered = prompt('Enter your display name for Study Rooms');
  username = entered ? entered.trim() : '';
  if (!username) {
    username = 'Guest';
  }
  localStorage.setItem(STUDYPLAN_USERNAME_KEY, username);
  syncNameInputs();
  return username;
}

function setActiveSection() {
  document.querySelectorAll('.sidebar .nav-item').forEach((el) => el.classList.remove('active'));
  const navItem = document.getElementById('nav-study-rooms');
  if (navItem) navItem.classList.add('active');

  document.querySelector('.cal-section')?.classList.add('hidden');
  document.getElementById('tasks-section')?.classList.add('hidden');
  document.getElementById('focus-section')?.classList.add('hidden');
  document.getElementById('study-rooms-view')?.classList.remove('hidden');
}

function showRoomSetup() {
  document.getElementById('create-room-card')?.classList.remove('hidden');
  document.getElementById('join-room-card')?.classList.remove('hidden');
  document.getElementById('my-rooms-container')?.classList.add('hidden');
}

function showActiveRoom() {
  document.getElementById('create-room-card')?.classList.add('hidden');
  document.getElementById('join-room-card')?.classList.add('hidden');
  document.getElementById('my-rooms-container')?.classList.remove('hidden');
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function clearRoomMessage() {
  const messageEl = document.getElementById('room-message');
  if (!messageEl) return;
  messageEl.textContent = '';
  messageEl.className = 'room-message hidden';
  if (roomMessageTimeout) {
    clearTimeout(roomMessageTimeout);
    roomMessageTimeout = null;
  }
}

function showRoomMessage(message, type = 'info') {
  const messageEl = document.getElementById('room-message');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.className = `room-message room-message--${type}`;
  if (roomMessageTimeout) {
    clearTimeout(roomMessageTimeout);
  }
  roomMessageTimeout = setTimeout(() => {
    clearRoomMessage();
  }, 5000);
}

function updatePomodoroDisplay() {
  const display = document.getElementById('pomodoro-display');
  if (display) display.textContent = formatTime(pomodoroSeconds);
}

function resetPomodoro() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroRunning = false;
  pomodoroSeconds = 25 * 60;
  updatePomodoroDisplay();
  document.getElementById('pomodoro-start-btn')?.classList.remove('hidden');
  document.getElementById('pomodoro-pause-btn')?.classList.add('hidden');
}

function startPomodoro() {
  if (pomodoroRunning) return;
  pomodoroRunning = true;
  document.getElementById('pomodoro-start-btn')?.classList.add('hidden');
  document.getElementById('pomodoro-pause-btn')?.classList.remove('hidden');
  pomodoroInterval = setInterval(() => {
    if (pomodoroSeconds <= 0) {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      pomodoroRunning = false;
      updatePomodoroDisplay();
      showRoomMessage('Session complete!', 'success');
      document.getElementById('pomodoro-start-btn')?.classList.remove('hidden');
      document.getElementById('pomodoro-pause-btn')?.classList.add('hidden');
      return;
    }
    pomodoroSeconds -= 1;
    updatePomodoroDisplay();
  }, 1000);
}

function pausePomodoro() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroRunning = false;
  document.getElementById('pomodoro-start-btn')?.classList.remove('hidden');
  document.getElementById('pomodoro-pause-btn')?.classList.add('hidden');
}

function renderMemberList(members) {
  const listEl = document.getElementById('room-member-list');
  if (!listEl) return;
  if (!Array.isArray(members) || members.length === 0) {
    listEl.innerHTML = '<p class="room-empty">No members have joined yet.</p>';
    return;
  }
  listEl.innerHTML = members.map((member) => {
    const joined = member.joined_at ? new Date(member.joined_at).toLocaleString() : 'Unknown';
    const activeClass = member.is_active === 1 ? 'online' : '';
    return `
      <div class="member-item">
        <span class="member-dot ${activeClass}"></span>
        <div>
          <div class="member-name">${member.member_name}</div>
          <div class="member-meta">Joined ${joined}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateRoomData(room) {
  const roomName = room?.name ?? room?.room_name ?? room?.title ?? 'Untitled room';
  const roomCode = room?.code ?? room?.room_code ?? 'XXXXXX';
  const activeRoomName = document.getElementById('active-room-name');
  if (activeRoomName) {
    const streakBadge = activeRoomName.querySelector('#streak-badge');
    activeRoomName.textContent = String(roomName);
    if (streakBadge) {
      activeRoomName.appendChild(streakBadge);
    }
  }
  document.getElementById('active-room-code').textContent = String(roomCode);
  renderMemberList(room.members || []);
}

function stopRoomPolling() {
  if (roomPollInterval) {
    clearInterval(roomPollInterval);
    roomPollInterval = null;
  }
}

function startRoomPolling() {
  // polling disabled when using sockets; kept for fallback
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function renderRoom(roomId) {
  if (!roomId) {
    showRoomSetup();
    return;
  }
  try {
    const room = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}`);
    activeRoomId = roomId;
    localStorage.setItem(STUDYPLAN_ACTIVE_ROOM_KEY, roomId);
    setActiveSection();
    updateRoomData(room);
    showActiveRoom();
    fetchLeaderboard();
    fetchStreak();

    // ensure socket connected and join room for real-time updates
    if (socket && socket.connected) {
      socket.emit('join_room', { roomId: activeRoomId, memberName: username });
    }
  } catch (err) {
    console.error(err);
    localStorage.removeItem(STUDYPLAN_ACTIVE_ROOM_KEY);
    activeRoomId = '';
    stopRoomPolling();
    showRoomSetup();
  }
}

function showStudyRoomsSection() {
  setActiveSection();
  document.getElementById('mood-check-view')?.classList.add('hidden');
  if (activeRoomId) {
    renderRoom(activeRoomId);
  } else {
    showRoomSetup();
  }
}

function attachListeners() {
  document.getElementById('nav-study-rooms')?.addEventListener('click', () => {
    showStudyRoomsSection();
  });

  document.getElementById('create-room-btn')?.addEventListener('click', async () => {
    const roomName = document.getElementById('create-room-title')?.value.trim();
    const memberName = document.getElementById('create-room-name')?.value.trim() || getCurrentName();
    if (!roomName) {
      showRoomMessage('Please enter a room name.', 'error');
      return;
    }
    username = memberName;
    localStorage.setItem(STUDYPLAN_USERNAME_KEY, username);
    syncNameInputs();

    try {
      const room = await fetchJson('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, created_by: username }),
      });
      activeRoomId = room.id;
      localStorage.setItem(STUDYPLAN_ACTIVE_ROOM_KEY, activeRoomId);
      await renderRoom(activeRoomId);
      showRoomMessage('Room created successfully!', 'success');
      startRoomPolling();
    } catch (err) {
      console.error(err);
      showRoomMessage('Unable to create room. Please try again.', 'error');
    }
  });

  document.getElementById('join-room-btn')?.addEventListener('click', async () => {
    const roomCode = document.getElementById('join-room-code')?.value.trim().toUpperCase();
    const memberName = document.getElementById('join-room-name')?.value.trim() || getCurrentName();
    if (!roomCode) {
      showRoomMessage('Please enter a room code.', 'error');
      return;
    }
    username = memberName;
    localStorage.setItem(STUDYPLAN_USERNAME_KEY, username);
    syncNameInputs();

    try {
      const room = await fetchJson('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, member_name: username }),
      });
      activeRoomId = room.id;
      localStorage.setItem(STUDYPLAN_ACTIVE_ROOM_KEY, activeRoomId);
      await renderRoom(activeRoomId);
      showRoomMessage('Joined room successfully!', 'success');
      startRoomPolling();
    } catch (err) {
      console.error(err);
      showRoomMessage('Unable to join room. Please check the code and try again.', 'error');
    }
  });

  document.getElementById('copy-room-code-btn')?.addEventListener('click', async () => {
    const code = document.getElementById('active-room-code')?.textContent || '';
    if (navigator.clipboard && code) {
      await navigator.clipboard.writeText(code);
      showRoomMessage('Room code copied to clipboard.', 'success');
    }
  });

  const pomodoroStartBtn = document.getElementById('pomodoro-start-btn');
  if (pomodoroStartBtn) {
    pomodoroStartBtn.addEventListener('click', () => {
      console.log('socket connected:', socket?.connected);
      console.log('pomodoro start clicked', { activeRoomId, pomodoroSeconds });
      if (!activeRoomId) {
        showRoomMessage('Join a room before starting the timer.', 'error');
        return;
      }

      if (socket?.connected) {
        socket.emit('timer_start', { roomId: activeRoomId, duration: pomodoroSeconds });
        setTimeout(() => {
          if (!pomodoroRunning) {
            startPomodoro();
          }
        }, 500);
      } else {
        startPomodoro();
      }
    });
  } else {
    console.warn('pomodoro start button not found in DOM');
  }

  document.getElementById('pomodoro-pause-btn')?.addEventListener('click', () => {
    if (socket?.connected && activeRoomId) {
      socket.emit('timer_pause', { roomId: activeRoomId });
    } else {
      pausePomodoro();
    }
  });

  document.getElementById('pomodoro-reset-btn')?.addEventListener('click', () => {
    if (socket && activeRoomId) {
      socket.emit('timer_reset', { roomId: activeRoomId, duration: 25 * 60 });
    } else {
      resetPomodoro();
    }
  });

  document.getElementById('leave-room-btn')?.addEventListener('click', async () => {
    if (!activeRoomId) return;
    try {
      // notify via socket first
      if (socket && socket.connected) {
        socket.emit('leave_room', { roomId: activeRoomId, memberName: username });
      }

      await fetchJson(`/api/rooms/${encodeURIComponent(activeRoomId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_name: username }),
      });
      localStorage.removeItem(STUDYPLAN_ACTIVE_ROOM_KEY);
      activeRoomId = '';
      if (socket && socket.connected) socket.disconnect();
      stopRoomPolling();
      resetPomodoro();
      showRoomMessage('You have left the room.', 'info');
      showRoomSetup();
    } catch (err) {
      console.error(err);
      showRoomMessage('Could not leave the room. Please try again.', 'error');
    }
  });

  // Mood buttons
  document.getElementById('mood-tired')?.addEventListener('click', () => fetchMoodSuggestion('tired'));
  document.getElementById('mood-energetic')?.addEventListener('click', () => fetchMoodSuggestion('energetic'));
  document.getElementById('mood-stressed')?.addEventListener('click', () => fetchMoodSuggestion('stressed'));
}

// Mood buttons and leaderboard
async function fetchMoodSuggestion(mood) {
  const roomId = localStorage.getItem(STUDYPLAN_ACTIVE_ROOM_KEY) || activeRoomId;
  try {
    const body = { mood };
    if (roomId) body.room_id = roomId;
    const res = await fetchJson('/api/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const el = document.getElementById('mood-suggestion');
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = `
      <div><strong>Study:</strong> ${res.study_duration_minutes} min</div>
      <div><strong>Break:</strong> ${res.break_duration_minutes} min</div>
      <div><strong>Difficulty:</strong> ${res.task_difficulty}</div>
      <div style="margin-top:8px;">${res.message}</div>
    `;
    pomodoroSeconds = Number(res.study_duration_minutes) * 60;
    updatePomodoroDisplay();
    if (roomId && socket?.connected) {
      socket.emit('timer_reset', { roomId, duration: pomodoroSeconds });
    } else {
      pausePomodoro();
    }
  } catch (err) {
    console.error(err);
    showRoomMessage('Failed to get mood suggestion', 'error');
  }
}

async function fetchLeaderboard() {
  try {
    const data = await fetchJson('/api/leaderboard');
    renderLeaderboard(data || []);
  } catch (e) {
    console.error(e);
  }
}

function renderLeaderboard(items) {
  const el = document.getElementById('leaderboard-list');
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<div>No data yet.</div>';
    return;
  }
  el.innerHTML = items.map((it, idx) => `
    <div class="leaderboard-item"><div>${idx+1}. ${it.member_name} <span style="color:var(--color-text-tertiary); font-size:13px;">(${it.sessions_completed} sessions)</span></div><div>${it.total_minutes} min</div></div>
  `).join('');
}

async function fetchStreak() {
  try {
    if (!username) return;
    const data = await fetchJson(`/api/streak?member_name=${encodeURIComponent(username)}`);
    const el = document.getElementById('streak-badge');
    if (el) el.textContent = data && data.current_streak ? `🔥 ${data.current_streak} day streak` : '';
  } catch (e) {
    console.error(e);
  }
}

function initStudyRooms() {
  username = localStorage.getItem(STUDYPLAN_USERNAME_KEY) || '';
  syncNameInputs();
  updatePomodoroDisplay();
  attachListeners();

  // initialize socket.io client
  try {
    socket = io();
    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('member_joined', ({ memberName, members }) => {
      renderMemberList(members || []);
      showRoomMessage(`${memberName} joined`, 'info');
    });

    socket.on('member_left', ({ memberName, members }) => {
      renderMemberList(members || []);
      showRoomMessage(`${memberName} left`, 'info');
    });

    socket.on('timer_update', (timerState) => {
      // timerState: {status,duration,remaining,started_at}
      if (!timerState) return;
      // update local timer to reflect state
      pomodoroSeconds = timerState.remaining || timerState.duration || 25 * 60;
      updatePomodoroDisplay();
      if (timerState.status === 'running') {
        // adjust running state
        pausePomodoro();
        startPomodoro();
      } else if (timerState.status === 'paused') {
        pausePomodoro();
      } else {
        resetPomodoro();
      }
    });

    socket.on('session_completed', ({ roomId, duration_minutes }) => {
      showRoomMessage(`Session completed: ${duration_minutes} min`, 'success');
      fetchLeaderboard();
    });
  } catch (e) {
    console.warn('Socket.IO client failed to initialize', e);
  }
  if (activeRoomId) {
    showStudyRoomsSection();
    renderRoom(activeRoomId);
    fetchLeaderboard();
    fetchStreak();
  }
}

window.addEventListener('DOMContentLoaded', initStudyRooms);
