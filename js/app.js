import { store } from './store.js';
import { extractTasksFromText } from './utils/api.js';
import { initGlobalErrorBoundary } from './utils/errorBoundary.js';
import { analyzeWorkload } from './utils/scheduler.js';

initGlobalErrorBoundary();

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

    if (d.toDateString() === now.toDateString()) {
      todayCount++;
    }

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

let currentMonthDate = new Date();
let selectedDate = null;
let currentView = 'calendar';

const tasksSection = document.getElementById('tasks-section');
const focusSection = document.getElementById('focus-section');
const extractPreview = document.getElementById('extract-preview');
const pasteInput = document.getElementById('paste-input');
const extractBtn = document.getElementById('extract-btn');
const clearBtn = document.getElementById('clear-btn');
const addItemsBtn = document.getElementById('add-btn');
const downloadBtn = document.getElementById('download-btn');
const newTaskBtn = document.getElementById('add-task-btn');

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
    return `<div class="nav-item subject-sidebar-item" data-subject-id="${escapeHtml(s.id)}">
      <span class="nav-dot" style="background:${safeColor}"></span>${escapeHtml(s.name)}<span class="badge">${n}</span>
    </div>`;
  }).join('');
}

const newTaskModal = document.getElementById('new-task-modal');
const newTaskSubject = document.getElementById('new-task-subject');
const newTaskTitle = document.getElementById('new-task-title');
const newTaskDate = document.getElementById('new-task-date');
const newTaskNotes = document.getElementById('new-task-notes');
const newTaskCancel = document.getElementById('new-task-cancel');
const newTaskSave = document.getElementById('new-task-save');

const TASK_TITLE_LIMIT = 100;

function updateTaskTitleCounter() {
  const counter = document.getElementById('task-title-counter');
  if (!counter || !newTaskTitle) return;
  counter.textContent = `${newTaskTitle.value.length}/${TASK_TITLE_LIMIT} characters`;
}

if (newTaskTitle) {
  newTaskTitle.maxLength = TASK_TITLE_LIMIT;
  newTaskTitle.addEventListener('input', updateTaskTitleCounter);
}

const timerText = document.getElementById('timer-text');
const timerPathRemaining = document.getElementById('timer-path-remaining');
const timerStartBtn = document.getElementById('timer-start-btn');
const timerPauseBtn = document.getElementById('timer-pause-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');

const focusTaskList = document.getElementById('focus-task-list');
const activeFocusTask = document.getElementById('active-focus-task');
let activeFocusTaskId = null;

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

function startTimer() {
  if (timerInterval) return;
  TIME_LIMIT = getTimerDuration();
  if (timePassed === 0) timeLeft = TIME_LIMIT;
  timerDurationInput.disabled = true;
  timerStartBtn.classList.add('hidden');
  timerPauseBtn.classList.remove('hidden');
  
  timerInterval = setInterval(() => {
    timePassed += 1;
    timeLeft = TIME_LIMIT - timePassed;
    timerText.innerHTML = formatTimeLeft(timeLeft);
    setCircleDasharray();

    if (timeLeft === 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      alert('Focus session complete!');
      resetTimer();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerPauseBtn.classList.add('hidden');
  timerStartBtn.classList.remove('hidden');
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timePassed = 0;
  TIME_LIMIT = getTimerDuration();
  timeLeft = TIME_LIMIT;
  timerDurationInput.disabled = false;
  timerText.innerHTML = formatTimeLeft(timeLeft);
  timerPathRemaining.setAttribute("stroke-dasharray", "283 283");
  timerPauseBtn.classList.add('hidden');
  timerStartBtn.classList.remove('hidden');
}

if (timerDurationInput) {
  timerDurationInput.addEventListener('change', () => {
    if (!timerInterval && timePassed === 0) {
      TIME_LIMIT = getTimerDuration();
      timeLeft = TIME_LIMIT;
      timerText.innerHTML = formatTimeLeft(timeLeft);
      timerPathRemaining.setAttribute("stroke-dasharray", "283 283");
    }
  });
}

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

if(timerStartBtn) timerStartBtn.addEventListener('click', startTimer);
if(timerPauseBtn) timerPauseBtn.addEventListener('click', pauseTimer);
if(timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);

if (newTaskBtn) {
  newTaskBtn.addEventListener('click', () => {
    newTaskTitle.value = '';
    newTaskNotes.value = '';
    updateTaskTitleCounter();
    newTaskModal.style.display = 'flex';
  });
}