import { store } from './store.js';
import { extractTasksFromText } from './utils/api.js';
import { initGlobalErrorBoundary } from './utils/errorBoundary.js';
import { analyzeWorkload } from './utils/scheduler.js';
import {
  escapeHtml,
  formatDate,
  getPillClass,
  openModal,
  closeModal,
  setupModalDismiss,
  showToast,
} from './utils/dom.js';
import {
  groupTitle,
  boardEditForm,
  taskListItem,
  extractEditCard,
  extractPreviewCard,
  activeFocusTaskPanel,
} from './ui/templates.js';
import { initAuth } from './auth.js';
import { initSettings } from './settings.js';

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

let currentMonthDate = new Date();
let selectedDate = new Date();
selectedDate.setHours(0, 0, 0, 0);
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
  openModal(newSubjectModal);
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
    panelToggleBtn.setAttribute('aria-expanded', String(!panelCollapsed));
    appEl.style.transition = 'grid-template-columns 0.3s var(--ease-standard, cubic-bezier(0.4,0,0.2,1))';
    appEl.style.setProperty('--panel-width', panelCollapsed ? '48px' : '340px');
    panelToggleIcon.style.transform = panelCollapsed ? 'rotate(180deg)' : '';
  });
}

if(timerStartBtn) timerStartBtn.addEventListener('click', startTimer);
if(timerPauseBtn) timerPauseBtn.addEventListener('click', pauseTimer);
if(timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);

function renderFocusTasks() {
  if(!focusTaskList || !activeFocusTask) return;
  const tasks = store.tasks;
  const subjects = store.subjects;
  
  const activeTasks = tasks.filter(t => !t.archived && t.status !== 'Done');
  const now = new Date();
  
  const dueSoon = [];
  activeTasks.forEach(t => {
    if(!t.due_at) return;
    const d = new Date(t.due_at);
    const diffDays = (d - now) / (1000 * 60 * 60 * 24);
    if (diffDays <= 3) dueSoon.push(t);
  });
  
  dueSoon.sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
  
  if (dueSoon.length === 0) {
    focusTaskList.innerHTML = '<div class="tasks-empty-state">No tasks due soon to focus on.</div>';
  } else {
    focusTaskList.innerHTML = dueSoon.map((t) => {
      const sub = subjects.find((s) => s.id === t.subject_id) || subjects[0] || { short_code: 'Gen' };
      const pillClass = getPillClass(sub);
      return `
        <div class="focus-task-item" data-id="${escapeHtml(t.id)}">
          <div class="task-name">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span class="task-pill ${pillClass}">${escapeHtml(sub.short_code)}</span>
          </div>
        </div>`;
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
      activeFocusTask.innerHTML = activeFocusTaskPanel(activeT, sub);
      
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
        showToast('Failed to download data', { error: true });
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
  const allTasksBadge = document.getElementById('all-tasks-badge');
  if (allTasksBadge) allTasksBadge.textContent = activeTasks.length;
  const archivedBadge = document.getElementById('archived-tasks-badge');
  if (archivedBadge) archivedBadge.textContent = archivedTasks.length;
  
  const displayTasks = currentView === 'archived' ? archivedTasks : activeTasks;
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
  
  const toneFromTitle = (title) => {
    if (title.includes('Due soon') || title.includes('⚠')) return 'danger';
    if (title.includes('Completed') || title.includes('Archived')) return 'muted';
    return 'default';
  };

  const renderGroup = (title, items, showConflict = false) => {
    if (items.length === 0) return '';
    let html = `<div class="tasks-group stagger-children">
      <div class="tasks-group-header">
        ${groupTitle(title, toneFromTitle(title))}
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
      const isUrgent = t.priority === 'high' && title.includes('Due soon');
      const isDone = t.status === 'Done';

      if (t._isEditing) {
        html += boardEditForm(t, subjects);
      } else {
        html += taskListItem(t, sub, { isUrgent, showArchiveActions: !t.archived });
      }
    });
    html += `</div>`;
    return html;
  };
  
  if (currentView === 'calendar' && selectedDate) {
    const selStr = selectedDate.toLocaleDateString('en-US', {month:'short', day:'numeric'});
    const actionBar = `<div class="tasks-actions-bar">
           <button id="mark-all-pending-btn" class="task-action-btn" ${pending.length === 0 ? 'disabled' : ''}>Mark all pending completed (${pending.length})</button>
           <button id="mark-day-complete-btn" class="task-action-btn task-action-btn-secondary" ${pending.length === 0 ? 'disabled' : ''}>Mark selected day completed</button>
         </div>`;

    const emptyState = dueSoon.length === 0 && completed.length === 0
      ? `<div class="tasks-empty-state">No tasks for this day yet.</div>`
      : '';

    tasksSection.innerHTML = actionBar +
                             renderGroup(`Tasks for ${selStr}`, dueSoon) +
                             renderGroup('Completed', completed) +
                             emptyState;
  } else {
    const actionBar = currentView === 'archived' ? '' : `<div class="tasks-actions-bar">
           <button id="mark-all-pending-btn" class="task-action-btn" ${pending.length === 0 ? 'disabled' : ''}>Mark all pending completed (${pending.length})</button>
         </div>`;

    const titlePrefix = currentView === 'archived' ? 'Archived: ' : '';
    const emptyStateText = currentView === 'archived' ? 'No archived tasks.' : 'No tasks yet. Add tasks from Smart Paste to get started.';

    const emptyState = dueSoon.length === 0 && thisWeek.length === 0 && completed.length === 0
      ? `<div class="tasks-empty-state">${emptyStateText}</div>`
      : '';

    tasksSection.innerHTML = actionBar +
                             renderGroup(titlePrefix + '⚠ Due soon', dueSoon, true) +
                             renderGroup(titlePrefix + 'This week', thisWeek, true) +
                             renderGroup(titlePrefix + 'Completed', completed) +
                             emptyState;
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

  document.querySelectorAll('.save-board-edit-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.dataset.id;
      const itemEl = el.closest('.task-item');
      
      const title = itemEl.querySelector('.board-edit-title').value;
      const subject_id = itemEl.querySelector('.board-edit-subject').value;
      let dateVal = itemEl.querySelector('.board-edit-date').value;
      const notes = itemEl.querySelector('.board-edit-notes').value;
      const priority = itemEl.querySelector('.board-edit-priority').value;
      
      store.updateTask(taskId, {
        title,
        subject_id,
        due_at: dateVal ? new Date(dateVal).toISOString() : '',
        notes,
        priority
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

function renderSummary() {
  if (summaryBox) {
    summaryBox.innerHTML = generateSummary(store.tasks, store.subjects);
  }
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
  if(topbarTitle) topbarTitle.textContent = `${monthNames[month]} ${year}`;

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

    html += `<div class="cal-day interactive-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-day="${i}">
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

  let html = `<div class="extract-title">Extracted — ${pasteItems.length} items</div><div class="stagger-children">`;
  pasteItems.forEach((item, index) => {
    const sub = store.subjects.find((s) =>
      s.name.toLowerCase().includes((item.subject_name || '').toLowerCase())
    ) || store.subjects[0];
    item.subject_id = sub?.id ?? item.subject_id;

    if (item._isEditing) {
      html += extractEditCard(item, index, store.subjects);
    } else if (sub) {
      html += extractPreviewCard(item, index, sub);
    }
  });

  html += '</div>';
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

function navigateToView(view) {
  const calendarBtn = document.getElementById('calendar-btn');
  const allTasksBtn = document.getElementById('all-tasks-btn');
  const archivedTasksBtn = document.getElementById('archived-tasks-btn');
  const focusModeBtn = document.getElementById('focus-mode-btn');
  const calSection = document.querySelector('.cal-section');
  const tasksEl = document.getElementById('tasks-section');
  const focusEl = document.getElementById('focus-section');

  const map = {
    calendar: calendarBtn,
    'all-tasks': allTasksBtn,
    archived: archivedTasksBtn,
    focus: focusModeBtn,
  };

  document.querySelectorAll('.sidebar .nav-item').forEach((el) => el.classList.remove('active'));
  map[view]?.classList.add('active');

  if (view === 'focus') {
    calSection?.classList.add('hidden');
    tasksEl?.classList.add('hidden');
    focusEl?.classList.remove('hidden');
    renderFocusTasks();
  } else {
    focusEl?.classList.add('hidden');
    tasksEl?.classList.remove('hidden');
    if (view === 'calendar') {
      calSection?.classList.remove('hidden');
    } else {
      calSection?.classList.add('hidden');
    }
    renderTasks();
  }
  currentView = view;
}

store.subscribe(renderTasks);
store.subscribe(renderExtraction);
store.subscribe(renderCalendar);
store.subscribe(renderFocusTasks);
store.subscribe(renderSidebarSubjects);
store.subscribe(renderSummary);

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initSettings();
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
    newSubjectCancel.addEventListener('click', () => closeModal(newSubjectModal));
  }
  setupModalDismiss(newSubjectModal, () => closeModal(newSubjectModal));

  if (newSubjectSave) {
    newSubjectSave.addEventListener('click', async () => {
      const ok = await store.addSubject({ name: newSubjectName.value, color: selectedNewSubjectColor });
      if (ok) {
        closeModal(newSubjectModal);
        showToast('Subject added');
      }
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
  
  document.getElementById('calendar-btn')?.addEventListener('click', () => navigateToView('calendar'));
  document.getElementById('all-tasks-btn')?.addEventListener('click', () => navigateToView('all-tasks'));
  document.getElementById('archived-tasks-btn')?.addEventListener('click', () => navigateToView('archived'));
  document.getElementById('focus-mode-btn')?.addEventListener('click', () => navigateToView('focus'));

  document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToView('calendar');
  });
  document.getElementById('nav-tasks')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToView('all-tasks');
  });
  document.getElementById('nav-calendar')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToView('calendar');
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    renderCalendar();
  });


//NEw Task addition event listeners
newTaskBtn.addEventListener('click', () => {
  if (!store.subjects || store.subjects.length === 0) {
    showToast('Subjects are still loading. Try again shortly.', { error: true });
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

  openModal(newTaskModal);
});

newTaskCancel.addEventListener('click', () => closeModal(newTaskModal));
setupModalDismiss(newTaskModal, () => closeModal(newTaskModal));

newTaskSave.addEventListener('click', async () => {
  const title = newTaskTitle.value.trim();
  const subject_id = newTaskSubject.value;
  const notes = newTaskNotes.value.trim();
  const dateVal = newTaskDate.value;

  if (!title) {
    showToast('Please enter a task name', { error: true });
    return;
  }

  const due_at = dateVal ? new Date(dateVal).toISOString() : '';

  const newTask = {
    title,
    subject_id,
    due_at,
    notes,
    priority: 'medium',
    status: 'Not Started',
    archived: 0
  };

  await store.addTasks([newTask]);
  closeModal(newTaskModal);
  showToast('Task added');
});
});

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

clearBtn.addEventListener('click', () => {
  pasteInput.value = '';
  store.clearExtracted();
});

addItemsBtn.addEventListener('click', async () => {
  if (store.currentPaste?.length) {
    await store.addTasks(store.currentPaste);
    store.clearExtracted();
    pasteInput.value = '';
    showToast('Tasks added to planner');
  }
});

downloadBtn.addEventListener('click', () => {
  downloadData();
});
