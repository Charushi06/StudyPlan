const STUDYPLAN_USERNAME_KEY = 'studyplan_username';
const STUDYPLAN_ACTIVE_ROOM_KEY = 'studyplan_active_room';
let username = localStorage.getItem(STUDYPLAN_USERNAME_KEY) || '';
let activeRoomId = localStorage.getItem(STUDYPLAN_ACTIVE_ROOM_KEY) || '';
let roomPollInterval = null;
let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroRunning = false;
let roomMessageTimeout = null;

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
      resetPomodoro();
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
  document.getElementById('active-room-name').textContent = String(roomName);
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
  stopRoomPolling();
  roomPollInterval = setInterval(() => {
    if (activeRoomId) {
      renderRoom(activeRoomId);
    }
  }, 5000);
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
    startRoomPolling();
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

  document.getElementById('pomodoro-start-btn')?.addEventListener('click', () => {
    startPomodoro();
  });

  document.getElementById('pomodoro-pause-btn')?.addEventListener('click', () => {
    pausePomodoro();
  });

  document.getElementById('pomodoro-reset-btn')?.addEventListener('click', () => {
    resetPomodoro();
  });

  document.getElementById('leave-room-btn')?.addEventListener('click', async () => {
    if (!activeRoomId) return;
    try {
      await fetchJson(`/api/rooms/${encodeURIComponent(activeRoomId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_name: username }),
      });
      localStorage.removeItem(STUDYPLAN_ACTIVE_ROOM_KEY);
      activeRoomId = '';
      stopRoomPolling();
      resetPomodoro();
      showRoomMessage('You have left the room.', 'info');
      showRoomSetup();
    } catch (err) {
      console.error(err);
      showRoomMessage('Could not leave the room. Please try again.', 'error');
    }
  });
}

function initStudyRooms() {
  username = localStorage.getItem(STUDYPLAN_USERNAME_KEY) || '';
  syncNameInputs();
  updatePomodoroDisplay();
  attachListeners();
  if (activeRoomId) {
    showStudyRoomsSection();
    renderRoom(activeRoomId);
  }
}

window.addEventListener('DOMContentLoaded', initStudyRooms);
