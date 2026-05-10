import { store } from './store.js';
import { extractTasksFromText } from './utils/api.js';
import { initGlobalErrorBoundary } from './utils/errorBoundary.js';

initGlobalErrorBoundary();

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
const newTaskBtn = document.getElementById('add-task-btn');



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
    appEl.style.transition = 'grid-template-columns 0.3s cubic-bezier(0.4,0,0.2,1)';
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
    focusTaskList.innerHTML = dueSoon.map(t => {
      const sub = subjects.find(s => s.id === t.subject_id) || subjects[0] || { short_code: 'Gen' };
      let pillClass = '';
      if(sub.code === 'CS') pillClass = 'pill-blue';
      else if(sub.code === 'Maths') pillClass = 'pill-green';
      else if(sub.code === 'English') pillClass = 'pill-purple';
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
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
        alert('Failed to download data');
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
  
  const renderGroup = (title, items, titleColor, showConflict = false) => {
    if (items.length === 0) return '';
    let html = `<div class="tasks-group">
      <div class="tasks-group-header">
        <span style="color:${titleColor}">${title}</span>
      </div>`;
    
    if (showConflict && items.length >= 3) {
      html += `<div class="conflict-card" style="margin-bottom: 12px;">
         <span class="conflict-icon">⚡</span>
         <div>Multiple deadlines detected. Consider starting early to spread the load.</div>
       </div>`;
    }
      
    items.forEach(t => {
      const sub = subjects.find(s => s.id === t.subject_id) || subjects[0];
      const isUrgent = t.priority === 'high' && title === '⚠ Due soon';
      const isDone = t.status === 'Done';
      
      let pillClass = '';
      if(sub.code === 'CS') pillClass = 'pill-blue';
      else if(sub.code === 'Maths') pillClass = 'pill-green';
      else if(sub.code === 'English') pillClass = 'pill-purple';
      else pillClass = 'pill-amber';
      
      if (t._isEditing) {
        let subjectOptions = subjects.map(s => 
          `<option value="${s.id}" ${s.id === t.subject_id ? 'selected' : ''}>${s.name}</option>`
        ).join('');
        
        const localDate = t.due_at ? new Date(t.due_at).toISOString().substring(0, 16) : '';
        const isHighPriority = t.priority === 'high';
        
        html += `
          <div class="task-item" style="display:block; padding:12px; cursor:default;" data-id="${t.id}">
            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Subject</label>
            <select class="board-edit-subject edit-field" style="width:100%; margin-bottom: 12px; font-size:12px; padding:4px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">
              ${subjectOptions}
            </select>

            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Task Name</label>
            <input class="board-edit-title edit-field" type="text" value="${t.title}" style="width:100%; margin-bottom: 12px; font-size:13px; font-weight:600; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Deadline</label>
            <input class="board-edit-date edit-field" type="datetime-local" value="${localDate}" style="width:100%; margin-bottom: 12px; font-size:12px; padding:6px; border: 1px solid var(--color-border-secondary); border-radius: 4px; background: var(--color-background-primary); color: var(--color-text-primary);">

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
        const archiveBtn = !t.archived 
          ? `<button class="task-btn edit-task-btn" data-id="${t.id}" title="Edit">✏️ Edit</button>
             <button class="task-btn archive-task-btn" data-id="${t.id}" title="Archive">Archive</button>`
          : `<button class="task-btn edit-task-btn" data-id="${t.id}" title="Edit">✏️ Edit</button>
             <button class="task-btn task-btn-info restore-task-btn" data-id="${t.id}" title="Restore">Restore</button>
             <button class="task-btn task-btn-danger delete-task-btn" data-id="${t.id}" title="Permanent Delete">Delete</button>`;

        html += `
          <div class="task-item ${isUrgent ? 'urgent' : ''} ${isDone ? 'done' : ''}" data-id="${t.id}">
            <div class="task-check ${isDone ? 'done' : ''}"></div>
            <div class="task-info">
              <div class="task-name">${t.title}</div>
              <div class="task-meta">
                <span class="task-pill ${isDone ? 'pill-green' : (isUrgent ? 'pill-red' : 'pill-amber')}">${isDone ? 'Done' : 'Due ' + formatDate(t.due_at)}</span>
                <span class="task-pill ${pillClass}">${sub.short_code}</span>
              </div>
            </div>
            <div class="task-actions">
              ${archiveBtn}
            </div>
          </div>
        `;
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
                             renderGroup(`Tasks for ${selStr}`, dueSoon, 'var(--color-text-primary)') +
                             renderGroup('Completed', completed, 'var(--color-text-tertiary)') +
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
                             renderGroup(titlePrefix + '⚠ Due soon', dueSoon, 'var(--color-text-danger)') +
                             renderGroup(titlePrefix + 'This week', thisWeek, 'var(--color-text-secondary)', true) +
                             renderGroup(titlePrefix + 'Completed', completed, 'var(--color-text-tertiary)') +
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

store.subscribe(renderTasks);
store.subscribe(renderExtraction);
store.subscribe(renderCalendar);
store.subscribe(renderFocusTasks);

document.addEventListener('DOMContentLoaded', () => {
  store.fetchInitialData();
  
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

  if(focusModeBtn) {
    focusModeBtn.addEventListener('click', () => {
      currentView = 'focus';
      document.querySelector('.cal-section').classList.add('hidden');
      document.getElementById('tasks-section').classList.add('hidden');
      document.getElementById('focus-section').classList.remove('hidden');
      updateSidebarActive('focus-mode-btn');
      renderFocusTasks();
    });
  }

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
    alert('Subjects are still loading. Please try again in a moment.');
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

newTaskSave.addEventListener('click', async () => {
  const title = newTaskTitle.value.trim();
  const subject_id = newTaskSubject.value;
  const notes = newTaskNotes.value.trim();
  const dateVal = newTaskDate.value;

  if (!title) {
    alert('Please enter a task name');
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
  newTaskModal.style.display = 'none';
});

addItemsBtn.addEventListener('click', () => {
  if (store.currentPaste) {
    store.addTasks(store.currentPaste);
    store.clearExtracted();
    pasteInput.value = '';
  }
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

addItemsBtn.addEventListener('click', () => {
  if (store.currentPaste) {
    store.addTasks(store.currentPaste);
    store.clearExtracted();
    pasteInput.value = '';
  }
});

downloadBtn.addEventListener('click', () => {
  downloadData();
});
