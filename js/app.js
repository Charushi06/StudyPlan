import { store } from './store.js';
import { extractTasksFromText } from './utils/api.js';
import { initGlobalErrorBoundary } from './utils/errorBoundary.js';
import { analyzeWorkload } from './utils/scheduler.js';
import { Toast } from './utils/toast.js';

initGlobalErrorBoundary();

function getLabelColor(labelStr) {
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#f97316'];
  let hash = 0;
  for (let i = 0; i < labelStr.length; i++) {
    hash = labelStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function extractLabels(title) {
  const labelRegex = /#([\w-]+)/g;
  let match;
  const labels = [];
  while ((match = labelRegex.exec(title)) !== null) {
    labels.push(match[1]);
  }
  const cleanTitle = title.replace(labelRegex, '').trim();
  return { cleanTitle, labels };
}

let activeLabelFilter = '';

function generateSummary(tasks, subjects) {
  const now = new Date();
  const weekEnd = new Date();
  weekEnd.setDate(now.getDate() + 7);

  let todayCount = 0;
  let weekCount = 0;
  let subjectCount = {};

  tasks.forEach(t => {
    if (t.archived || t.status === 'Done' || !t.due_at) return;

    const d = new Date(t.due_at);

    // today
    if (d.toDateString() === now.toDateString()) {
      todayCount++;
    }

    // this week
    if (d >= now && d <= weekEnd) {
      weekCount++;
    }

    const sub = subjects.find(s => s.id === t.subject_id);
    const name = sub ? sub.name : 'General';
    subjectCount[name] = (subjectCount[name] || 0) + 1;
  });

  const topSubject = Object.keys(subjectCount).length
    ? Object.keys(subjectCount).reduce((a, b) =>
      subjectCount[a] > subjectCount[b] ? a : b
    )
    : 'no specific subject';

  return `
    <strong>📅 Daily</strong><br>
    Today you have <b>${todayCount}</b> task(s).<br>
    Focus on <b>${topSubject}</b>.<br><br>

    <strong>📊 Weekly</strong><br>
    This week you have <b>${weekCount}</b> task(s).<br>
    Most work is in <b>${topSubject}</b>.
  `;
}

function formatDuration(mins) {
  if (!mins) return '0 mins';
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs > 0) {
    return `${hrs}h ${m > 0 ? m + 'm' : ''}`;
  }
  return `${mins} mins`;
}

let currentMonthDate = new Date();
let selectedDate = null;
let currentView = 'calendar'; // 'calendar', 'all-tasks', 'archived'

const tasksSection = document.getElementById('tasks-section');
const focusSection = document.getElementById('focus-section');
const extractPreview = document.getElementById('extract-preview');
const pasteInput = document.getElementById('paste-input');
const extractBtn = document.getElementById('extract-btn');
const clearBtn = document.getElementById('clear-btn');
const addItemsBtn = document.getElementById('add-btn');
const downloadBtn = document.getElementById('download-btn');
const calendarDownloadBtn = document.getElementById('calendar-download-btn');
const newTaskBtn = document.getElementById('add-task-btn');
const labelFilterSelect = document.getElementById('label-filter');

if (labelFilterSelect) {
  labelFilterSelect.addEventListener('change', (e) => {
    activeLabelFilter = e.target.value;
    renderTasks();
  });
}

const SUBJECT_COLORS = [
  'var(--color-text-info)',
  'var(--color-text-success)',
  'var(--color-text-purple)',
  'var(--color-text-warning)',
  'var(--color-text-danger)',
  'var(--color-text-secondary)',
];

let selectedNewSubjectColor = SUBJECT_COLORS[0];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const newSubjectModal = document.getElementById('new-subject-modal');
const newSubjectName = document.getElementById('new-subject-name');
const newSubjectColorsEl = document.getElementById('new-subject-colors');
const newSubjectCancel = document.getElementById('new-subject-cancel');
const newSubjectSave = document.getElementById('new-subject-save');
const addSubjectBtn = document.getElementById('add-subject-btn');

function syncNewSubjectColorSwatches() {
  if (!newSubjectColorsEl) return;
  newSubjectColorsEl.querySelectorAll('.subject-color-swatch').forEach(btn => {
    const on = btn.dataset.color === selectedNewSubjectColor;
    btn.classList.toggle('subject-color-swatch--selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function openNewSubjectModal() {
  if (!newSubjectModal || !newSubjectName) return;
  newSubjectName.value = '';
  selectedNewSubjectColor = SUBJECT_COLORS[0];
  syncNewSubjectColorSwatches();
  newSubjectModal.style.display = 'flex';
  newSubjectName.focus();
}

function renderSidebarSubjects() {
  const listEl = document.getElementById('subjects-sidebar-list');
  if (!listEl) return;

  const subjects = store.subjects;
  const tasks = store.tasks;

  const countBySubject = {};
  subjects.forEach(s => {
    countBySubject[s.id] = 0;
  });
  tasks.forEach(t => {
    if (t.archived || !t.subject_id || countBySubject[t.subject_id] === undefined) return;
    countBySubject[t.subject_id]++;
  });

  listEl.innerHTML = subjects.map(s => {
    const n = countBySubject[s.id] ?? 0;
    const safeColor = s.color ? escapeHtml(s.color) : 'var(--color-text-info)';
return `
  <div class="nav-item subject-sidebar-item" data-subject-id="${escapeHtml(s.id)}">

    <div class="subject-sidebar-content">
      <span class="nav-dot" style="background:${safeColor}"></span>

      <span class="subject-name">
        ${escapeHtml(s.name)}
      </span>
    </div>

    <div class="subject-sidebar-actions">
      <span class="badge">${n}</span>

      <button
        class="delete-subject-btn"
        data-subject-id="${escapeHtml(s.id)}"
        title="Delete subject"
      >
        ✕
      </button>
    </div>

  </div>
`;
  }).join('');

  document.querySelectorAll('.delete-subject-btn')
  .forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const subjectId = btn.dataset.subjectId;

      store.deleteSubject(subjectId);
    });
  });
}

const newTaskModal = document.getElementById('new-task-modal');
const newTaskSubject = document.getElementById('new-task-subject');
const newTaskTitle = document.getElementById('new-task-title');
const newTaskDate = document.getElementById('new-task-date');
const newTaskNotes = document.getElementById('new-task-notes');
const newTaskCancel = document.getElementById('new-task-cancel');
const newTaskSave = document.getElementById('new-task-save');
const newTaskEstimatedDuration = document.getElementById('new-task-estimated-duration');
const newTaskDurationSwitch = document.getElementById('new-task-duration-switch');
const newTaskDurationMin = document.getElementById('new-task-duration-min');
const newTaskDurationHr = document.getElementById('new-task-duration-hr');
let selectedTaskDurationUnit = 'minutes';

// Timer elements
const timerText = document.getElementById('timer-text');
const timerPathRemaining = document.getElementById('timer-path-remaining');
const timerStartBtn = document.getElementById('timer-start-btn');
const timerPauseBtn = document.getElementById('timer-pause-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');

// Task elements
const focusTaskList = document.getElementById('focus-task-list');
const activeFocusTask = document.getElementById('active-focus-task');
let activeFocusTaskId = null;

// Timer Logic
const FULL_DASH_ARRAY = 283;
let TIME_LIMIT = 25 * 60;
let timePassed = 0;
let timeLeft = TIME_LIMIT;
let timerInterval = null;

const timerDurationInput = document.getElementById('timer-duration-input');

function getTimerDuration() {
  const val = parseInt(timerDurationInput.value);
  return (val > 0 && val <= 120) ? val * 60 : 25 * 60;
}

function formatTimeLeft(time) {
  const minutes = Math.floor(time / 60);
  let seconds = time % 60;
  if (seconds < 10) {
    seconds = `0${seconds}`;
  }
  return `${minutes}:${seconds}`;
}

function calculateTimeFraction() {
  const rawTimeFraction = timeLeft / TIME_LIMIT;
  return rawTimeFraction - (1 / TIME_LIMIT) * (1 - rawTimeFraction);
}

function setCircleDasharray() {
  const circleDasharray = `${(
    calculateTimeFraction() * FULL_DASH_ARRAY
  ).toFixed(0)} 283`;
  timerPathRemaining.setAttribute("stroke-dasharray", circleDasharray);
}

let startTime;

function saveTimerState() {
  localStorage.setItem('focusTimerState', JSON.stringify({
    TIME_LIMIT,
    timePassed,
    isRunning: !!timerInterval,
    startTime: timerInterval ? startTime : null,
    durationInput: timerDurationInput.value
  }));
}

function loadTimerState() {
  const saved = localStorage.getItem('focusTimerState');
  if (!saved) return;

  try {
    const state = JSON.parse(saved);

    TIME_LIMIT = state.TIME_LIMIT || (25 * 60);

    if (state.isRunning && state.startTime) {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      timePassed = elapsed;
    } else {
      timePassed = state.timePassed || 0;
    }

    timeLeft = TIME_LIMIT - timePassed;

    if (timeLeft < 0) timeLeft = 0;

    if (state.durationInput) {
      timerDurationInput.value = state.durationInput;
    }

    timerText.innerHTML = formatTimeLeft(timeLeft);
    setCircleDasharray();
    updateTimerColor();

    if (state.isRunning && timeLeft > 0) {
      startTime = Date.now() - (timePassed * 1000);

      timerInterval = setInterval(() => {
        timePassed = Math.floor((Date.now() - startTime) / 1000);
        timeLeft = TIME_LIMIT - timePassed;

        timerText.innerHTML = formatTimeLeft(timeLeft);
        setCircleDasharray();
        updateTimerColor();

        saveTimerState();

        if (timeLeft <= 0) {
  clearInterval(timerInterval);
  timerInterval = null;
  localStorage.removeItem('focusTimerState');

  playCompletionSound();
  showBrowserNotification();
  Toast.show('Focus session complete!', 'success');

  resetTimer();
}
      }, 250);

      timerPauseBtn.classList.remove('hidden');
      timerStartBtn.classList.add('hidden');
      timerDurationInput.disabled = true;
    }
  } catch (err) {
    console.error('Failed to load timer state', err);
  }
}
function getTimerColor(timeLeft, totalTime) {
  const fraction = timeLeft / totalTime;
  if (fraction <= 0.1) return '#ef4444';
  if (fraction <= 0.3) return '#f59e0b';
  return '#166534';
}

function updateTimerColor() {
  const color = getTimerColor(timeLeft, TIME_LIMIT);
  timerPathRemaining.style.stroke = color;
}

function playCompletionSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Audio not supported');
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus Session Complete!', {
      body: 'Great job! You completed your focus session.',
      icon: '/logo.png'
    });
  }
}

function startTimer() {
  if (timerInterval) return;

  TIME_LIMIT = getTimerDuration();
  timerDurationInput.disabled = true;

  timerStartBtn.classList.add('hidden');
  timerPauseBtn.classList.remove('hidden');
  requestNotificationPermission();

  startTime = Date.now() - (timePassed * 1000);
  saveTimerState();
   timerInterval = setInterval(() => {
    timePassed = Math.floor((Date.now() - startTime) / 1000);
    timeLeft = TIME_LIMIT - timePassed;

    timerText.innerHTML = formatTimeLeft(timeLeft);
    setCircleDasharray();
    updateTimerColor();
    saveTimerState();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      localStorage.removeItem('focusTimerState');
      playCompletionSound();
      showBrowserNotification();
      Toast.show('Focus session complete!', 'success');
      resetTimer();
    }
  }, 1000);

  timerPauseBtn.classList.remove('hidden');
  timerStartBtn.classList.add('hidden');
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;

  saveTimerState();

  timerPauseBtn.classList.add('hidden');
  timerStartBtn.classList.remove('hidden');
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;

  localStorage.removeItem('focusTimerState');

  timePassed = 0;
  TIME_LIMIT = getTimerDuration();
  timeLeft = TIME_LIMIT;

  timerDurationInput.disabled = false;

  timerText.innerHTML = formatTimeLeft(timeLeft);
  timerPathRemaining.setAttribute("stroke-dasharray", "283 283");
  updateTimerColor();
  timerPauseBtn.classList.add('hidden');
  timerStartBtn.classList.remove('hidden');
}

timerDurationInput.addEventListener('change', () => {
  if (!timerInterval && timePassed === 0) {
    TIME_LIMIT = getTimerDuration();
    timeLeft = TIME_LIMIT;
    timerText.innerHTML = formatTimeLeft(timeLeft);
    timerPathRemaining.setAttribute("stroke-dasharray", "283 283");
  }
});

// Panel toggle for focus mode
const panelToggleBtn = document.getElementById('panel-toggle-btn');
const panelToggleIcon = document.getElementById('panel-toggle-icon');
const panel = document.querySelector('.panel');
const appEl = document.querySelector('.app');
let panelCollapsed = false;

if (panelToggleBtn) {
  panelToggleBtn.addEventListener('click', () => {
    panelCollapsed = !panelCollapsed;
    panel.classList.toggle('panel-collapsed', panelCollapsed);
    appEl.style.transition = 'grid-template-columns 0.3s cubic-bezier(0.4,0,0.2,1)';
    appEl.style.setProperty('--panel-width', panelCollapsed ? '48px' : '340px');
    panelToggleIcon.style.transform = panelCollapsed ? 'rotate(180deg)' : '';
  });
}

if (timerStartBtn) timerStartBtn.addEventListener('click', startTimer);
if (timerPauseBtn) timerPauseBtn.addEventListener('click', pauseTimer);
if (timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);

function renderFocusTasks() {
  if (!focusTaskList || !activeFocusTask) return;
  const tasks = store.tasks;
  const subjects = store.subjects;

  const activeTasks = tasks.filter(t => !t.archived && t.status !== 'Done');
  const now = new Date();

  const dueSoon = [];
  activeTasks.forEach(t => {
    if (!t.due_at) return;
    const d = new Date(t.due_at);
    const diffDays = (d - now) / (1000 * 60 * 60 * 24);
    if (diffDays <= 3) dueSoon.push(t);
  });

  dueSoon.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

  if (dueSoon.length === 0) {
    focusTaskList.innerHTML = '<div class="tasks-empty-state">No tasks due soon to focus on.</div>';
  } else {
    focusTaskList.innerHTML = dueSoon.map(t => {
      const sub = subjects.find(s => s.id === t.subject_id) || subjects[0] || { short_code: 'Gen' };
      let pillClass = '';
      if (sub.short_code === 'CS') pillClass = 'pill-blue';
      else if (sub.short_code === 'Maths') pillClass = 'pill-green';
      else if (sub.short_code === 'English') pillClass = 'pill-purple';
      else pillClass = 'pill-amber';

      return `
        <div class="focus-task-item" data-id="${t.id}">
          <div class="task-name">${t.title}</div>
          <div class="task-meta">
            <span class="task-pill ${pillClass}">${sub.short_code}</span>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.focus-task-item').forEach(el => {
      el.addEventListener('click', () => {
        activeFocusTaskId = el.dataset.id;
        renderFocusTasks();
      });
    });
  }

  if (activeFocusTaskId) {
    const activeT = store.tasks.find(t => t.id === activeFocusTaskId);
    if (activeT) {
      const sub = subjects.find(s => s.id === activeT.subject_id) || subjects[0] || { name: 'General' };
      activeFocusTask.innerHTML = `
        <div class="task-info" style="width: 100%">
          <div class="task-name" style="font-size: 16px;">${activeT.title}</div>
          <div class="task-meta">
            <span class="task-pill pill-amber">Due ${formatDate(activeT.due_at)}</span>
            <span class="task-pill">${sub.name}</span>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="btn btn-primary complete-focus-task-btn" data-id="${activeT.id}">Mark Done</button>
            <button class="btn clear-focus-task-btn">Clear</button>
          </div>
        </div>
      `;

      const completeBtn = activeFocusTask.querySelector('.complete-focus-task-btn');
      if (completeBtn) {
        completeBtn.addEventListener('click', () => {
          store.toggleTaskStatus(activeT.id);
          activeFocusTaskId = null;
          renderFocusTasks();
        });
      }

      const clearBtn = activeFocusTask.querySelector('.clear-focus-task-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          activeFocusTaskId = null;
          renderFocusTasks();
        });
      }
    } else {
      activeFocusTaskId = null;
      activeFocusTask.innerHTML = '<div class="no-task-selected">No task selected. Choose one below.</div>';
    }
  } else {
    activeFocusTask.innerHTML = '<div class="no-task-selected">No task selected. Choose one below.</div>';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'No Date';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function downloadData() {
  try {
    const response = await fetch('/api/download');

    if (!response.ok) {
      throw new Error('Failed to download data');
    } 

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);

  } catch (error) {
        console.error(error);
        Toast.show('Failed to download data', 'error');
  }
}

async function downloadCalendar() {
    try {
        const response = await fetch('/api/download/calendar');

        if (!response.ok) {
            throw new Error('Failed to export calendar');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'studyplan_calendar.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);

    } catch (error) {
        console.error(error);
        alert('Failed to export calendar');
    }
}

function renderTasks() {
  const tasks = store.tasks;
  const subjects = store.subjects;

  if (subjects.length === 0) return; // Wait for subjects to load

  // Filter based on archived status
  const activeTasks = tasks.filter(t => !t.archived);
  const archivedTasks = tasks.filter(t => t.archived);

  // Update badges
  const allTasksBadge = document.querySelector('#all-tasks-btn .badge');
  if (allTasksBadge) {
    allTasksBadge.textContent = activeTasks.length;
  }
  const archivedBadge = document.querySelector('#archived-tasks-btn .badge');
  if (archivedBadge) {
    archivedBadge.textContent = archivedTasks.length;
  }


  
  const displayTasksRaw = currentView === 'archived' ? archivedTasks : activeTasks;
  const displayTasks = activeLabelFilter
    ? displayTasksRaw.filter(t => t.labels && t.labels.includes(activeLabelFilter))
    : displayTasksRaw;
  
  // Extract unique labels to populate the filter dropdown
  if (labelFilterSelect) {
    const uniqueLabels = new Set();
    store.tasks.forEach(t => {
      if (t.labels && Array.isArray(t.labels)) {
        t.labels.forEach(l => uniqueLabels.add(l));
      }
    });
    
    // Store current selection to restore it
    const currentSel = labelFilterSelect.value;
    let optionsHtml = '<option value="">All Labels</option>';
    Array.from(uniqueLabels).sort().forEach(lbl => {
      optionsHtml += `<option value="${lbl}" ${lbl === currentSel ? 'selected' : ''}>${lbl}</option>`;
    });
    labelFilterSelect.innerHTML = optionsHtml;
  }

  const sorted = [...displayTasks].sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
  
  const now = new Date(); 
  
  const dueSoon = [];
  const thisWeek = [];
  const completed = [];
  const pending = [];

  if (currentView === 'calendar' && selectedDate) {
    sorted.forEach(t => {
      const d = new Date(t.due_at);
      if (d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()) {
        if (t.status === 'Done') completed.push(t);
        else {
          dueSoon.push(t);
          pending.push(t);
        }
      }
    });
  } else {
    sorted.forEach(t => {
      if (t.status === 'Done') {
        completed.push(t);
        return;
      }
      pending.push(t);
      const d = new Date(t.due_at);
      const diffDays = (d - now) / (1000 * 60 * 60 * 24);
      if (diffDays <= 3) dueSoon.push(t);
      else thisWeek.push(t);
    });
  }

  const renderGroup = (title, items, titleColor, showConflict = false) => {
    if (items.length === 0) return '';
    let html = `<div class="tasks-group">
      <div class="tasks-group-header">
        <span style="color:${titleColor}">${title}</span>
      </div>`;

    if (showConflict) {
      const workloadSuggestions = analyzeWorkload(items);
      workloadSuggestions.forEach(workload => {
        html += ` <div class="conflict-card smart-workload-card ${workload.level}">
        <div class="smart-workload-title"> ⚠ Heavy workload detected on ${workload.date} </div>
        <div class="smart-workload-score"> Workload Score: ${workload.score} </div>
        <ul class="smart-suggestion-list"> ${workload.suggestions.map(s => `<li class="${s.includes('Suggested reschedule') ? 'smart-highlight' : ''}"> ${s} </li>`).join('')} </ul>
        </div>`;
      });
    }


    items.forEach(t => {
      const sub = subjects.find(s => s.id === t.subject_id) || subjects[0];
      const isDone = t.status === 'Done';

      const isHighPriority = t.priority === 'high';
      const isOverdue = !isDone && t.due_at && new Date(t.due_at) < now;
      const isUrgent = isHighPriority && title === '⚠ Due soon';
      
      let pillClass = '';
      if (sub.short_code === 'CS') pillClass = 'pill-blue';
      else if (sub.short_code === 'Maths') pillClass = 'pill-green';
      else if (sub.short_code === 'English') pillClass = 'pill-purple';
      else pillClass = 'pill-amber';

      if (t._isEditing) {
        let subjectOptions = subjects.map(s =>
          `<option value="${s.id}" ${s.id === t.subject_id ? 'selected' : ''}>${s.name}</option>`
        ).join('');

        const localDate = t.due_at ? new Date(t.due_at).toISOString().substring(0, 16) : '';
        const isHighPriority = t.priority === 'high';
        const editDurationUnit = t.is_estimated_duration_min === 0 ? 'hours' : 'minutes';
        const editDurationValue = t.estimated_duration
          ? (editDurationUnit === 'hours' ? Math.round(Number(t.estimated_duration) / 60) : Number(t.estimated_duration))
          : '';
        
        html += `
          <div class="task-item editing" style="display:block; padding:12px; cursor:default;" data-id="${t.id}">
            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Subject</label>
            <select class="board-edit-subject edit-field" style="width:100%; margin-bottom: 12px; font-size:12px; padding:4px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">
              ${subjectOptions}
            </select>

            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Task Name</label>
            <input class="board-edit-title edit-field" type="text" value="${t.title}${t.labels && t.labels.length > 0 ? ' #' + t.labels.join(' #') : ''}" style="width:100%; margin-bottom: 12px; font-size:13px; font-weight:600; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Deadline</label>
            <input class="board-edit-date edit-field" type="datetime-local" value="${localDate}" style="width:100%; margin-bottom: 12px; font-size:12px; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Estimated Completion Time</label>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
              <input class="board-edit-estimated-duration edit-field" type="number" min="1" step="1" value="${editDurationValue}" style="flex:1; min-width:0; font-size:12px; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);" placeholder="Duration">
              <div class="duration-switch board-edit-duration-switch" data-unit="${editDurationUnit}">
                <span class="duration-switch-thumb"></span>
                <button type="button" class="duration-switch-option board-edit-duration-unit ${editDurationUnit === 'minutes' ? 'active' : ''}" data-unit="minutes">Min</button>
                <button type="button" class="duration-switch-option board-edit-duration-unit ${editDurationUnit === 'hours' ? 'active' : ''}" data-unit="hours">Hr</button>
              </div>
            </div>

            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Notes</label>
            <input class="board-edit-notes edit-field" type="text" value="${t.notes || ''}" placeholder="Notes..." style="width:100%; margin-bottom: 12px; font-size:12px; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Priority</label>
            <select class="board-edit-priority edit-field" style="width:100%; margin-bottom: 12px; font-size:12px; padding:4px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">
              <option value="medium" ${!isHighPriority ? 'selected' : ''}>Medium</option>
              <option value="high" ${isHighPriority ? 'selected' : ''}>High</option>
            </select>

            <div style="display:flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
              <button class="btn cancel-board-edit-btn" data-id="${t.id}" style="padding: 6px 12px; font-size: 11px; background: var(--color-background-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-secondary);">Cancel</button>
              <button class="btn btn-primary save-board-edit-btn" data-id="${t.id}" style="padding: 6px 12px; font-size: 11px;">Save</button>
            </div>
          </div>
        `;
      } else {
        const actionButtons = !t.archived 
          ? `<button class="task-btn edit-task-btn" data-id="${t.id}" title="Edit">Edit</button>
             <button class="task-btn archive-task-btn" data-id="${t.id}" title="Archive">Archive</button>
             <button class="task-btn delete-task-btn" data-id="${t.id}" title="Delete">Delete</button>`
          : `<button class="task-btn edit-task-btn" data-id="${t.id}" title="Edit">Edit</button>
             <button class="task-btn task-btn-info restore-task-btn" data-id="${t.id}" title="Restore">Restore</button>
             <button class="task-btn task-btn-danger delete-task-btn" data-id="${t.id}" title="Delete">Delete</button>`;

        let labelsHtml = '';
        if (t.labels && Array.isArray(t.labels)) {
          labelsHtml = t.labels.map(l => `<span class="task-pill" style="background:${getLabelColor(l)}; color:white;">${l}</span>`).join(' ');
        }

        html += `
          <div class="task-item ${isUrgent ? 'urgent' : ''} ${isHighPriority ? 'high-priority' : ''} ${isOverdue ? 'overdue' : ''} ${isDone ? 'done' : ''}" data-id="${t.id}">
            <div class="task-check ${isDone ? 'done' : ''}"></div>
            <div class="task-info">
              <div class="task-name">${t.title}</div>
              <div class="task-meta">
                <span class="task-pill ${isDone ? 'pill-green' : (isOverdue || isHighPriority ? 'pill-red' : 'pill-amber')}">${isDone ? 'Done' : 'Due ' + formatDate(t.due_at)}</span>
                <span class="task-pill ${pillClass}">${sub.short_code}</span>
                ${labelsHtml}
              </div>
            </div>
            <div class="task-actions">
              ${actionButtons}
            </div>
          </div>
        `;
      }
    });
    html += `</div>`;
    return html;
  };

  if (currentView === 'calendar' && selectedDate) {
    const selStr = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const actionBar = `<div class="tasks-actions-bar">
           <button id="mark-all-pending-btn" class="task-action-btn" ${pending.length === 0 ? 'disabled' : ''}>Mark all pending completed (${pending.length})</button>
           <button id="mark-day-complete-btn" class="task-action-btn task-action-btn-secondary" ${pending.length === 0 ? 'disabled' : ''}>Mark selected day completed</button>
         </div>`;

    const emptyState = dueSoon.length === 0 && completed.length === 0
      ? `<div class="tasks-empty-state">
           <div class="empty-state-icon">📅</div>
           <div class="empty-state-title">No tasks for today</div>
           <div class="empty-state-text">Your schedule is looking clear! Use this time to rest or start planning ahead.</div>
           <button class="empty-state-cta" id="empty-state-add-btn">
             <svg width="14" height="14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
             Add your first task
           </button>
         </div>`
      : '';

    const totalMinutes = [...dueSoon, ...completed].reduce((acc, t) => acc + (Number(t.estimated_duration) || 0), 0);
    console.log('[Daily Study Time] Calendar view with selected date:', selectedDate);
    console.log('[Daily Study Time] Pending tasks:', dueSoon.length, 'Completed tasks:', completed.length);
    console.log('[Daily Study Time] Task durations:', [...dueSoon, ...completed].map(t => ({ title: t.title, estimated_duration: t.estimated_duration })));
    console.log('[Daily Study Time] Total minutes calculated:', totalMinutes);
    const studyTimeEl = document.getElementById('daily-study-time');
    const studyTimeValueEl = document.getElementById('daily-study-time-value');
    if (studyTimeEl && studyTimeValueEl) {
      studyTimeEl.style.display = 'flex';
      studyTimeValueEl.textContent = formatDuration(totalMinutes);
      console.log('[Daily Study Time] Banner shown with value:', formatDuration(totalMinutes));
    } else {
      console.log('[Daily Study Time] Banner elements not found');
    }

    tasksSection.innerHTML = actionBar +
      renderGroup(`Tasks for ${selStr}`, dueSoon, 'var(--color-text-primary)') +
      renderGroup('Completed', completed, 'var(--color-text-tertiary)') +
      emptyState;
  } else {
    console.log('[Daily Study Time] Hiding banner - currentView:', currentView, 'selectedDate:', selectedDate);
    const studyTimeEl = document.getElementById('daily-study-time');
    if (studyTimeEl) {
      studyTimeEl.style.display = 'none';
    }

    const actionBar = currentView === 'archived' ? '' : `<div class="tasks-actions-bar">
           <button id="mark-all-pending-btn" class="task-action-btn" ${pending.length === 0 ? 'disabled' : ''}>Mark all pending completed (${pending.length})</button>
         </div>`;

    const titlePrefix = currentView === 'archived' ? 'Archived: ' : '';
    const emptyStateTitle = currentView === 'archived' ? 'No archived tasks' : 'Start your journey';
    const emptyStateText = currentView === 'archived' 
      ? 'Your archive is empty. Completed tasks you archive will appear here.' 
      : 'No tasks yet! Start planning your study schedule and stay on top of your goals.';
    const emptyStateIcon = currentView === 'archived' ? '📦' : '✨';

    const emptyState = dueSoon.length === 0 && thisWeek.length === 0 && completed.length === 0
      ? `<div class="tasks-empty-state">
           <div class="empty-state-icon">${emptyStateIcon}</div>
           <div class="empty-state-title">${emptyStateTitle}</div>
           <div class="empty-state-text">${emptyStateText}</div>
           ${currentView !== 'archived' ? `
           <button class="empty-state-cta" id="empty-state-add-btn">
             <svg width="14" height="14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
             Add your first task
           </button>` : ''}
         </div>`
      : '';

    tasksSection.innerHTML = actionBar +
                             renderGroup(titlePrefix + '⚠ Due soon', dueSoon, 'var(--color-text-danger)', true)
                             + renderGroup(titlePrefix + 'This week', thisWeek, 'var(--color-text-secondary)', true) +
                             renderGroup(titlePrefix + 'Completed', completed, 'var(--color-text-tertiary)') +
                             emptyState;
  }

  // Bind CTA button in empty state
  const emptyStateAddBtn = document.getElementById('empty-state-add-btn');
  if (emptyStateAddBtn) {
    emptyStateAddBtn.addEventListener('click', () => {
      document.getElementById('add-task-btn')?.click();
    });
  }
                           
  document.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.task-actions') || e.target.closest('.task-check')) return;

      const taskId = el.dataset.id;
      const task = store.tasks.find(t => String(t.id) === String(taskId));
      if (task && task._isEditing) return;

      store.toggleTaskStatus(taskId);
    });
  });

  document.querySelectorAll('.edit-task-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      store.setTaskEditing(el.dataset.id, true);
    });
  });

  document.querySelectorAll('.cancel-board-edit-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      store.setTaskEditing(el.dataset.id, false);
    });
  });

  document.querySelectorAll('.board-edit-duration-unit').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const switchEl = el.closest('.board-edit-duration-switch');
      const unit = el.dataset.unit;
      switchEl.dataset.unit = unit;
      switchEl.querySelectorAll('.board-edit-duration-unit').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.unit === unit);
      });
    });
  });

  document.querySelectorAll('.save-board-edit-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.dataset.id;
      const itemEl = el.closest('.task-item');

      
      const rawTitle = itemEl.querySelector('.board-edit-title').value;
      const subject_id = itemEl.querySelector('.board-edit-subject').value;
      let dateVal = itemEl.querySelector('.board-edit-date').value;
      const notes = itemEl.querySelector('.board-edit-notes').value;
      const priority = itemEl.querySelector('.board-edit-priority').value;
      const durationValue = Number(itemEl.querySelector('.board-edit-estimated-duration').value);
      const durationUnit = itemEl.querySelector('.board-edit-duration-switch')?.dataset.unit || 'minutes';
      const estimated_duration = durationValue > 0
        ? Math.round(durationUnit === 'hours' ? durationValue * 60 : durationValue)
        : null;
      
      const { cleanTitle, labels } = extractLabels(rawTitle);
      
      store.updateTask(taskId, {
        title: cleanTitle || rawTitle,
        subject_id,
        due_at: dateVal ? new Date(dateVal).toISOString() : '',
        notes,
        priority,
        estimated_duration,
        is_estimated_duration_min: durationUnit === 'minutes' ? 1 : 0,
        labels
      });
    });
  });

  document.querySelectorAll('.task-check').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.closest('.task-item').dataset.id;
      store.toggleTaskStatus(taskId);
    });
  });

  document.querySelectorAll('.archive-task-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      store.archiveTask(el.dataset.id);
    });
  });

  document.querySelectorAll('.restore-task-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      store.restoreTask(el.dataset.id);
    });
  });

  document.querySelectorAll('.delete-task-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      store.deleteTask(el.dataset.id);
    });
  });

  const markAllPendingBtn = document.getElementById('mark-all-pending-btn');
  if (markAllPendingBtn) {
    markAllPendingBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.markAllPendingCompleted();
    });
  }

  const markDayCompleteBtn = document.getElementById('mark-day-complete-btn');
  if (markDayCompleteBtn) {
    markDayCompleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.markPendingTasksForDateCompleted(selectedDate);
    });
  }
}


const summaryBox = document.getElementById('summary-box');
if (summaryBox) {
  summaryBox.innerHTML = generateSummary(store.tasks, store.subjects);
}

function renderCalendar() {
  const calTitle = document.getElementById('cal-month-title');
  const calGrid = document.getElementById('cal-grid');
  if (!calGrid) return;

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  calTitle.textContent = `${monthNames[month]} ${year}`;

  const topbarTitle = document.querySelector('.topbar-title');
  if (topbarTitle) topbarTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const today = new Date();

  let html = `<div class="cal-day-label">Su</div><div class="cal-day-label">Mo</div><div class="cal-day-label">Tu</div><div class="cal-day-label">We</div><div class="cal-day-label">Th</div><div class="cal-day-label">Fr</div><div class="cal-day-label">Sa</div>`;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day muted">${prevMonthDays - firstDay + i + 1}</div>`;
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const isSelected = selectedDate && i === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

    // Find tasks for this day
    const dayTasks = store.tasks.filter(t => {
      if (t.archived) return false;
      if (t.status === 'Done') return false;
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      return d.getDate() === i && d.getMonth() === month && d.getFullYear() === year;
    });

    let indicatorHtml = '';
    if (dayTasks.length > 0) {
      indicatorHtml = `<div class="cal-day-indicators">`;
      dayTasks.forEach((t, idx) => {
        if (idx > 2) return;
        const sub = store.subjects.find(s => s.id === t.subject_id) || store.subjects[0];
        indicatorHtml += `<div class="cal-day-indicator" style="background:${sub ? sub.color : 'var(--color-text-danger)'}"></div>`;
      });
      indicatorHtml += `</div>`;
    }

    const extraStyle = isSelected ? `border: 1.5px solid var(--color-text-primary);` : '';

    html += `<div class="cal-day interactive-day ${isToday ? 'today' : ''}" data-day="${i}" style="${extraStyle}">
      ${i}
      ${indicatorHtml}
    </div>`;
  }

  const totalCells = firstDay + daysInMonth;
  const nextDays = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= nextDays; i++) {
    html += `<div class="cal-day muted">${i}</div>`;
  }

  calGrid.innerHTML = html;

  // Bind day clicks
  document.querySelectorAll('.interactive-day').forEach(el => {
    el.addEventListener('click', (e) => {
      const d = parseInt(e.currentTarget.getAttribute('data-day'));
      const clickedDate = new Date(year, month, d);

      if (selectedDate && clickedDate.getTime() === selectedDate.getTime()) {
        selectedDate = null;
      } else {
        selectedDate = clickedDate;
      }
      renderCalendar();
      renderTasks();
    });
  });
}

function renderExtraction() {
  const pasteItems = store.currentPaste;
  if (!pasteItems || pasteItems.length === 0) {
    extractPreview.innerHTML = '';
    addItemsBtn.disabled = true;
    addItemsBtn.textContent = 'Add items to planner';
    return;
  }

  addItemsBtn.disabled = false;
  addItemsBtn.textContent = `Add ${pasteItems.length} items to planner`;

  let html = `<div class="extract-title">Extracted — ${pasteItems.length} items</div>`;
  pasteItems.forEach((item, index) => {
    // try to match subject name
    const sub = store.subjects.find(s => s.name.toLowerCase().includes((item.subject_name || '').toLowerCase())) || store.subjects[3];
    // Attach subject id to item so Add will work
    item.subject_id = sub.id;

    if (item._isEditing) {
      let subjectOptions = store.subjects.map(s =>
        `<option value="${s.id}" ${s.id === sub.id ? 'selected' : ''}>${s.name}</option>`
      ).join('');

      const localDate = item.due_at ? new Date(item.due_at).toISOString().substring(0, 16) : '';

      html += `
        <div class="extract-card">
          <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Subject</label>
          <select class="edit-subject-input edit-field" data-index="${index}" style="width:100%; margin-bottom: 12px; font-size:12px; padding:4px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">
            ${subjectOptions}
          </select>

          <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Task Name</label>
          <input class="edit-title-input edit-field" type="text" value="${item.title}" data-index="${index}" style="width:100%; margin-bottom: 12px; font-size:13px; font-weight:600; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

          <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Deadline</label>
          <input class="edit-date-input edit-field" type="datetime-local" value="${localDate}" data-index="${index}" style="width:100%; margin-bottom: 12px; font-size:12px; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

          <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Notes</label>
          <input class="edit-notes-input edit-field" type="text" value="${item.notes || ''}" data-index="${index}" placeholder="Notes..." style="width:100%; margin-bottom: 12px; font-size:12px; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

          <div style="display:flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button class="btn btn-primary save-edit-btn" data-index="${index}" style="padding: 6px 12px; font-size: 11px;">Save Changes</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="extract-card" style="animation-delay: ${index * 0.1}s">
          <div class="extract-subject" style="color:${sub.color}">${sub.name}</div>
          <div class="extract-task-name">${item.title}</div>
          <div class="extract-row"><span class="extract-icon">${item.icon || '📅'}</span> ${formatDate(item.due_at)}</div>
          <div class="extract-row"><span class="extract-icon">📎</span> ${item.notes || 'No notes attached'}</div>
          <div class="conf-bar"><div class="conf-fill" style="width:0%;background:${item.confidence_score > 75 ? 'var(--color-text-success)' : 'var(--color-text-warning)'}" data-width="${item.confidence_score}"></div></div>
          <div class="conf-label">${item.confidence_score}% confidence <span class="conf-edit" data-index="${index}" tabindex="0">Edit</span></div>
        </div>
      `;
    }
  });

  extractPreview.innerHTML = html;

  setTimeout(() => {
    document.querySelectorAll('.conf-fill').forEach(el => {
      el.style.width = el.getAttribute('data-width') + '%';
    });
  }, 100);

  document.querySelectorAll('.conf-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-index');
      store.updateExtractedItem(idx, { _isEditing: true });
    });
  });

  document.querySelectorAll('.save-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-index');
      const card = e.target.closest('.extract-card');
      const subjectId = card.querySelector('.edit-subject-input').value;
      const title = card.querySelector('.edit-title-input').value;
      let dateVal = card.querySelector('.edit-date-input').value;
      const notes = card.querySelector('.edit-notes-input').value;

      const newSubject = store.subjects.find(s => s.id === subjectId);

      store.updateExtractedItem(idx, {
        subject_id: subjectId,
        subject_name: newSubject ? newSubject.name : 'General',
        title: title,
        due_at: dateVal ? new Date(dateVal).toISOString() : '',
        notes: notes,
        _isEditing: false
      });
    });
  });
}

function calculateStreak(tasks) {
  const completedTasks = tasks.filter(t => t.status === 'Done' && t.due_at && !t.archived);

  const dates = new Set();
  completedTasks.forEach(t => {
    const d = new Date(t.due_at);
    if (!isNaN(d.getTime())) {
      dates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  });

  if (dates.size === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  let streak = 0;
  let checkDate = new Date();
  let checkStr = todayStr;

  if (dates.has(todayStr)) {
    streak = 1;
  } else if (dates.has(yesterdayStr)) {
    streak = 1;
    checkDate = yesterday;
    checkStr = yesterdayStr;
  } else {
    return 0;
  }

  while (true) {
    checkDate.setDate(checkDate.getDate() - 1);
    checkStr = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (dates.has(checkStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function renderStreak() {
  const streakCount = calculateStreak(store.tasks);

  const streakCountEl = document.getElementById('streak-count');
  if (streakCountEl) {
    streakCountEl.textContent = streakCount;
  }

  const badge3 = document.getElementById('badge-3-wrapper');
  const badge7 = document.getElementById('badge-7-wrapper');
  const badge30 = document.getElementById('badge-30-wrapper');

  if (badge3) badge3.classList.toggle('hidden', streakCount < 3);
  if (badge7) badge7.classList.toggle('hidden', streakCount < 7);
  if (badge30) badge30.classList.toggle('hidden', streakCount < 30);

  const tooltip = document.getElementById('streak-tooltip');
  if (tooltip) {
    if (streakCount >= 30) {
      tooltip.textContent = '30 day badge unlocked';
    } else if (streakCount >= 7) {
      tooltip.textContent = '7 day badge unlocked';
    } else if (streakCount >= 3) {
      tooltip.textContent = '3 day badge unlocked';
    } else {
      tooltip.textContent = 'Complete tasks to build streak & earn cool badges';
    }
  }
}

store.subscribe(renderTasks);
store.subscribe(renderExtraction);
store.subscribe(renderCalendar);
store.subscribe(renderFocusTasks);
store.subscribe(renderSidebarSubjects);
store.subscribe(renderStreak);

document.addEventListener('DOMContentLoaded', () => {
  if (newSubjectColorsEl) {
    SUBJECT_COLORS.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'subject-color-swatch';
      btn.dataset.color = c;
      btn.style.background = c;
      btn.addEventListener('click', () => {
        selectedNewSubjectColor = c;
        syncNewSubjectColorSwatches();
      });
      newSubjectColorsEl.appendChild(btn);
    });
    syncNewSubjectColorSwatches();
  }

  if (addSubjectBtn) {
    addSubjectBtn.addEventListener('click', () => openNewSubjectModal());
    addSubjectBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openNewSubjectModal();
      }
    });
  }

  if (newSubjectCancel) {
    newSubjectCancel.addEventListener('click', () => {
      if (newSubjectModal) newSubjectModal.style.display = 'none';
    });
  }

  if (newSubjectModal) {
    newSubjectModal.addEventListener('click', (e) => {
      if (e.target === newSubjectModal) newSubjectModal.style.display = 'none';
    });
  }

  if (newSubjectSave) {
    newSubjectSave.addEventListener('click', async () => {
      const ok = await store.addSubject({ name: newSubjectName.value, color: selectedNewSubjectColor });
      if (ok && newSubjectModal) newSubjectModal.style.display = 'none';
    });
  }

  if (newSubjectName) {
    newSubjectName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        newSubjectSave?.click();
      }
    });
  }

  store.fetchInitialData();
  loadTimerState();
  
  const calendarBtn = document.getElementById('calendar-btn');
  const allTasksBtn = document.getElementById('all-tasks-btn');
  const archivedTasksBtn = document.getElementById('archived-tasks-btn');
  const focusModeBtn = document.getElementById('focus-mode-btn');

  function updateSidebarActive(id) {
    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  calendarBtn.addEventListener('click', () => {
    currentView = 'calendar';
    document.querySelector('.cal-section').classList.remove('hidden');
    document.getElementById('tasks-section').classList.remove('hidden');
    document.getElementById('focus-section').classList.add('hidden');
    updateSidebarActive('calendar-btn');
    renderTasks();
  });

  allTasksBtn.addEventListener('click', () => {
    currentView = 'all-tasks';
    document.querySelector('.cal-section').classList.add('hidden');
    document.getElementById('tasks-section').classList.remove('hidden');
    document.getElementById('focus-section').classList.add('hidden');
    updateSidebarActive('all-tasks-btn');
    renderTasks();
  });

  archivedTasksBtn.addEventListener('click', () => {
    currentView = 'archived';
    document.querySelector('.cal-section').classList.add('hidden');
    document.getElementById('tasks-section').classList.remove('hidden');
    document.getElementById('focus-section').classList.add('hidden');
    updateSidebarActive('archived-tasks-btn');
    renderTasks();
  });

  if (focusModeBtn) {
    focusModeBtn.addEventListener('click', () => {
      currentView = 'focus';
      document.querySelector('.cal-section').classList.add('hidden');
      document.getElementById('tasks-section').classList.add('hidden');
      document.getElementById('focus-section').classList.remove('hidden');
      updateSidebarActive('focus-mode-btn');
      renderFocusTasks();
    });
  }

  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    renderCalendar();
  });


//NEw Task addition event listeners
newTaskBtn.addEventListener('click', () => {
  
  if (!store.subjects || store.subjects.length === 0) {
    Toast.show('Subjects are still loading. Please try again in a moment.', 'warning');
    return;
  }

    newTaskSubject.innerHTML = store.subjects
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join('');


    if (selectedDate) {
      const d = new Date(selectedDate);
      d.setHours(18, 0, 0, 0);
      newTaskDate.value = d.toISOString().substring(0, 16);
    } else {
      newTaskDate.value = '';
    }
  newTaskTitle.value = '';
  newTaskNotes.value = '';
  if (newTaskEstimatedDuration) newTaskEstimatedDuration.value = '';
  setNewTaskDurationUnit('minutes');
    newTaskModal.style.display = 'flex';
  });

  newTaskCancel.addEventListener('click', () => {
    newTaskModal.style.display = 'none';
  });

newTaskModal.addEventListener('click', (e) => {
    if (e.target === newTaskModal) {
      newTaskModal.style.display = 'none';
    }
  });
  
function setNewTaskDurationUnit(unit) {
  selectedTaskDurationUnit = unit;
  newTaskDurationSwitch?.setAttribute('data-unit', unit);
  newTaskDurationMin?.classList.toggle('active', unit === 'minutes');
  newTaskDurationHr?.classList.toggle('active', unit === 'hours');
}

newTaskDurationMin?.addEventListener('click', () => setNewTaskDurationUnit('minutes'));
newTaskDurationHr?.addEventListener('click', () => setNewTaskDurationUnit('hours'));

newTaskSave.addEventListener('click', async () => {
  const rawTitle = newTaskTitle.value.trim();
  const subject_id = newTaskSubject.value;
  const notes = newTaskNotes.value.trim();
  const dateVal = newTaskDate.value;
  const durationValue = newTaskEstimatedDuration ? Number(newTaskEstimatedDuration.value) : 0;
  const estimated_duration = durationValue > 0
    ? Math.round(selectedTaskDurationUnit === 'hours' ? durationValue * 60 : durationValue)
    : null;

  if (!rawTitle) {
    alert('Please enter a task name');
    return;
  }

  if (!dateVal) {
  alert('Please enter a deadline');
  return;
}

if (!subject_id) {
  alert('Please select a subject');
  return;
}
  const { cleanTitle, labels } = extractLabels(rawTitle);
  const due_at = dateVal ? new Date(dateVal).toISOString() : '';

  const newTask = {
    title: cleanTitle || rawTitle,
    subject_id,
    due_at,
    notes,
    priority: 'medium',
    status: 'Not Started',
    archived: 0,
    estimated_duration,
    is_estimated_duration_min: selectedTaskDurationUnit === 'minutes' ? 1 : 0,
    labels
  };

    await store.addTasks([newTask]);
    newTaskModal.style.display = 'none';
  });


addItemsBtn.addEventListener('click', () => {
  if (store.currentPaste) {
    const pasteWithLabels = store.currentPaste.map(t => {
      const { cleanTitle, labels } = extractLabels(t.title);
      return { ...t, title: cleanTitle || t.title, labels };
    });
    store.addTasks(pasteWithLabels);
    store.clearExtracted();
    pasteInput.value = '';
  }
});
});

// Ensures the button is hidden on initial page load if the textarea is empty
if (pasteInput.value.trim() === "") {
    clearBtn.style.display = 'none';
}

extractBtn.addEventListener('click', async () => {
  const text = pasteInput.value;
  if (!text.trim()) return;

  extractBtn.innerHTML = '<span class="loader-spinner"></span>';
  extractBtn.disabled = true;
  
  const items = await extractTasksFromText(text);

  extractBtn.innerHTML = 'Extract with AI →';
  extractBtn.disabled = false;

  store.setExtracted(items);
});

// Wipes the text, clears the store, hides the button, and refocuses the cursor
clearBtn.addEventListener('click', () => {
    pasteInput.value = '';
    store.clearExtracted();
    clearBtn.style.display = 'none'; // Hides the clear button instantly
    pasteInput.focus();              // Puts the typing cursor back in the box
});

// Listens to typing/pasting to show or hide the button dynamically
pasteInput.addEventListener('input', () => {
    if (pasteInput.value.trim().length > 0) {
        clearBtn.style.display = 'block'; 
    } else {
        clearBtn.style.display = 'none';
    }
});

downloadBtn.addEventListener('click', () => {
  downloadData();
});

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');

// Handle File Selection via File Explorer
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileContent(file);
  });
}

// Handle Drag & Drop Events
if (dropZone) {
  // Prevent browser from opening the file
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Add highlight effect
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('paste-zone--dragover');
    });
  });

  // Remove highlight effect
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('paste-zone--dragover');
    });
  });

  // Handle dropped file
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;

    if (dt && dt.files.length > 0) {
      const file = dt.files[0];
      handleFileContent(file);
    }
  });
}

// File Reader Function
function handleFileContent(file) {
  const allowedExtensions = ['txt', 'md', 'json'];
  const fileExtension = file.name.split('.').pop().toLowerCase();

  // Validate extension
  if (!allowedExtensions.includes(fileExtension)) {
    alert('Invalid file format. Please upload a .txt, .md, or .json file.');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const pasteInput = document.getElementById('paste-input');

    if (pasteInput) {
      pasteInput.value = e.target.result;

      alert(
        `Loaded "${file.name}" successfully! Click "Extract with AI" to find your tasks.`
      );
    }
  };

  reader.onerror = () => {
    alert('Error reading file content. Please try again.');
  };

  reader.readAsText(file);
}


const quotes = [
  "Small Progress is still Progress",
  "Focus on being productive instead of busy",
  "The secret of getting ahead is getting started",
  "Strive for progress, not perfection",
  "Don't wait for opportunity. Create it.",
  "Success is the sum of small efforts repeated daily",
  "Time is not refundable, use it with intention.",
  "Sometimes, getting it done is better than perfect.",
  "Believe you can and you're halfway there.",
  "Arise, awake, and stop not till the goal is reached."
];

const quoteEl = document.getElementById('motivational-quotes');

if (quoteEl) {
  const today = new Date();
  const seed = today.toDateString();

  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash % quotes.length);

  quoteEl.textContent = quotes[index];
}


if (calendarDownloadBtn) {
  calendarDownloadBtn.addEventListener('click', () => {
    downloadCalendar();
  });
}