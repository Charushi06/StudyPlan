const socket = io();

const roomsBtn = document.getElementById('rooms-btn');
const roomsSection = document.getElementById('rooms-section');
const calSection = document.querySelector('.cal-section');
const tasksSection = document.getElementById('tasks-section');
const focusSection = document.getElementById('focus-section');
const panel = document.querySelector('.panel');

const lobby = document.getElementById('room-lobby');
const activeRoom = document.getElementById('room-active');

const createBtn = document.getElementById('create-room-btn');
const joinBtn = document.getElementById('join-room-btn');
const joinInput = document.getElementById('join-room-input');
const leaveBtn = document.getElementById('leave-room-btn');
const copyBtn = document.getElementById('copy-invite-btn');

const inviteLinkDisplay = document.getElementById('room-invite-link');
const goalInput = document.getElementById('room-goal-input');
const timerText = document.getElementById('room-timer-text');
const timerPath = document.getElementById('room-timer-path-remaining');
const startBtn = document.getElementById('room-start-btn');
const pauseBtn = document.getElementById('room-pause-btn');
const resetBtn = document.getElementById('room-reset-btn');
const hostControls = document.getElementById('room-host-controls');
const guestMsg = document.getElementById('room-guest-msg');

const participantsList = document.getElementById('room-participants-list');
const participantCount = document.getElementById('room-participant-count');

let currentRoomId = null;
let isHost = false;
let myId = null;

// Tab Navigation
roomsBtn.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  roomsBtn.classList.add('active');
  
  if (calSection) calSection.classList.add('hidden');
  if (tasksSection) tasksSection.classList.add('hidden');
  if (focusSection) focusSection.classList.add('hidden');
  if (panel) panel.classList.add('hidden');
  
  roomsSection.classList.remove('hidden');
});

// Create Room
createBtn.addEventListener('click', () => {
  const roomId = Math.random().toString(36).substring(2, 9);
  joinRoom(roomId);
});

// Join Room
joinBtn.addEventListener('click', () => {
  const val = joinInput.value.trim();
  if (val) joinRoom(val);
});

leaveBtn.addEventListener('click', () => {
  window.location.search = '';
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(inviteLinkDisplay.innerText);
  copyBtn.innerText = 'Copied!';
  setTimeout(() => copyBtn.innerText = 'Copy', 2000);
});

function joinRoom(roomId) {
  const userStr = localStorage.getItem('studyplan_user');
  let username = 'Anonymous';
  if (userStr) {
    const user = JSON.parse(userStr);
    username = user.email.split('@')[0];
  }
  
  window.history.pushState({}, '', '?room=' + roomId);
  socket.emit('join_room', { roomId, username });
}

// Initial load check
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  roomsBtn.click();
  joinRoom(roomParam);
}

// Socket Events
socket.on('room_state', (state) => {
  currentRoomId = state.roomId;
  myId = state.myId;
  isHost = (state.host === myId);
  
  lobby.classList.add('hidden');
  activeRoom.classList.remove('hidden');
  
  const inviteUrl = window.location.origin + '?room=' + currentRoomId;
  inviteLinkDisplay.innerText = inviteUrl;
  
  goalInput.value = state.goal;
  if (!isHost) {
    goalInput.setAttribute('disabled', 'true');
    hostControls.classList.add('hidden');
    guestMsg.classList.remove('hidden');
  } else {
    goalInput.removeAttribute('disabled');
    hostControls.classList.remove('hidden');
    guestMsg.classList.add('hidden');
  }
  
  updateParticipants(state.participants, state.host);
  updateTimerUI(state.timer.remaining, state.timer.duration);
});

socket.on('participant_update', (participants) => {
  const host = participants.length > 0 ? participants[0].id : null; 
  // the server usually sends host_changed, but we can rely on state if needed
  updateParticipants(participants, host);
});

socket.on('host_changed', (newHostId) => {
  isHost = (newHostId === myId);
  if (isHost) {
    goalInput.removeAttribute('disabled');
    hostControls.classList.remove('hidden');
    guestMsg.classList.add('hidden');
  }
});

socket.on('goal_updated', (goal) => {
  if (!isHost) {
    goalInput.value = goal;
  }
});

socket.on('timer_started', ({ remaining }) => {
  startBtn.classList.add('hidden');
  pauseBtn.classList.remove('hidden');
});

socket.on('timer_paused', ({ remaining }) => {
  startBtn.classList.remove('hidden');
  pauseBtn.classList.add('hidden');
});

socket.on('timer_reset', ({ duration, remaining }) => {
  startBtn.classList.remove('hidden');
  pauseBtn.classList.add('hidden');
  updateTimerUI(remaining, duration);
});

socket.on('timer_tick', ({ remaining }) => {
  // Assume duration is 25 mins by default for the path calculation
  const duration = 25 * 60; 
  updateTimerUI(remaining, duration);
});

socket.on('timer_ended', () => {
  startBtn.classList.remove('hidden');
  pauseBtn.classList.add('hidden');
  updateTimerUI(0, 25*60);
});

// User Actions
goalInput.addEventListener('input', (e) => {
  if (isHost && currentRoomId) {
    socket.emit('update_goal', { roomId: currentRoomId, goal: e.target.value });
  }
});

startBtn.addEventListener('click', () => {
  if (isHost && currentRoomId) socket.emit('start_timer', { roomId: currentRoomId });
});
pauseBtn.addEventListener('click', () => {
  if (isHost && currentRoomId) socket.emit('pause_timer', { roomId: currentRoomId });
});
resetBtn.addEventListener('click', () => {
  if (isHost && currentRoomId) socket.emit('reset_timer', { roomId: currentRoomId });
});

// UI Helpers
function updateParticipants(participants, hostId) {
  participantCount.innerText = participants.length;
  participantsList.innerHTML = '';
  participants.forEach(p => {
    const li = document.createElement('li');
    li.style.padding = '8px';
    li.style.borderBottom = '1px solid var(--color-border-secondary)';
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    
    let text = p.username;
    if (p.id === myId) text += ' (You)';
    
    const nameSpan = document.createElement('span');
    nameSpan.innerText = text;
    
    li.appendChild(nameSpan);
    
    // In our simple model, first participant or designated host
    // Actually the server tracks host explicitly, we'll just show if they are the original creator
    participantsList.appendChild(li);
  });
}

function updateTimerUI(remainingSecs, totalSecs) {
  const m = Math.floor(remainingSecs / 60).toString().padStart(2, '0');
  const s = (remainingSecs % 60).toString().padStart(2, '0');
  timerText.innerText = m + ':' + s;
  
  if (totalSecs) {
    const fraction = remainingSecs / totalSecs;
    const dasharray = fraction * 283;
    timerPath.setAttribute('stroke-dasharray', dasharray + ' 283');
  }
}
