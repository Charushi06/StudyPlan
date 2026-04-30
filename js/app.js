import { store } from './store.js';
import { extractTasksFromText } from './utils/api.js';

let currentMonthDate = new Date();
let selectedDate = null;
let currentView = 'calendar'; // 'calendar', 'all-tasks', 'archived'

const tasksSection = document.getElementById('tasks-section');
const extractPreview = document.getElementById('extract-preview');
const pasteInput = document.getElementById('paste-input');
const extractBtn = document.getElementById('extract-btn');
const clearBtn = document.getElementById('clear-btn');
const addItemsBtn = document.getElementById('add-btn');
const downloadBtn = document.getElementById('download-btn');

/* ---------------- UTIL ---------------- */

function formatDate(dateStr) {
  if (!dateStr) return 'No Date';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/* ---------------- BUTTON ANIMATIONS ---------------- */

function applyButtonAnimations() {
  document.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.animated) return;
    btn.dataset.animated = "true";

    btn.style.transition = 'transform 0.15s ease';

    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.05)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
    btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.95)');
    btn.addEventListener('mouseup', () => btn.style.transform = 'scale(1.05)');
  });
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

/* ---------------- CALENDAR ---------------- */
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
      
      const archiveBtn = !t.archived 
        ? `<button class="task-btn archive-task-btn" data-id="${t.id}" title="Archive">Archive</button>`
        : `<button class="task-btn task-btn-info restore-task-btn" data-id="${t.id}" title="Restore">Restore</button>
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
      store.toggleTaskStatus(el.dataset.id);
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

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  calTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = (firstDayRaw === 0) ? 6 : firstDayRaw - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const today = new Date();

  let html = `
    <div class="cal-day-label">Mo</div>
    <div class="cal-day-label">Tu</div>
    <div class="cal-day-label">We</div>
    <div class="cal-day-label">Th</div>
    <div class="cal-day-label">Fr</div>
    <div class="cal-day-label">Sa</div>
    <div class="cal-day-label">Su</div>
  `;

  /* PREVIOUS MONTH */
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day muted">${prevMonthDays - firstDay + i + 1}</div>`;
  }

  /* CURRENT MONTH */
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday =
      i === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    const isSelected =
      selectedDate &&
      i === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear();

    const dayTasks = store.tasks.filter(t => {
      if (!t.due_at || t.status === 'Done') return false;
      if (t.archived) return false;
      if (t.status === 'Done') return false;
      if (!t.due_at) return false;

      const d = new Date(t.due_at);
      return d.getDate() === i &&
             d.getMonth() === month &&
             d.getFullYear() === year;
    });

    let indicators = '';
    if (dayTasks.length) {
      indicators = `<div class="cal-day-indicators">`;
      dayTasks.slice(0, 3).forEach(t => {
        const sub = store.subjects.find(s => s.id === t.subject_id);
        indicators += `<div class="cal-day-indicator"
          style="background:${sub?.color || 'red'}"></div>`;
      });
      indicators += `</div>`;
    }

    html += `
      <div class="cal-day interactive-day
        ${isToday ? 'today' : ''}
        ${isSelected ? 'selected' : ''}"
        data-day="${i}">
        <span class="day-number">${i}</span>
        ${indicators}
      </div>
    `;
  }

  /* NEXT MONTH */
  const totalCells = firstDay + daysInMonth;
  const nextDays = (7 - (totalCells % 7)) % 7;

  for (let i = 1; i <= nextDays; i++) {
    html += `<div class="cal-day muted">${i}</div>`;
  }

  calGrid.innerHTML = html;

  /* CLICK HANDLER */
  document.querySelectorAll('.interactive-day').forEach(el => {
    el.addEventListener('click', (e) => {
      const day = parseInt(e.currentTarget.dataset.day);
      const clickedDate = new Date(year, month, day);

      if (selectedDate &&
          clickedDate.getTime() === selectedDate.getTime()) {
        selectedDate = null;
      } else {
        selectedDate = clickedDate;
      }

      renderCalendar();
      renderTasks();
    });
  });
}

/* ---------------- TASKS (UNCHANGED) ---------------- */
/* Keep your existing renderTasks() here */

/* ---------------- EXTRACTION (UNCHANGED) ---------------- */
/* Keep your existing renderExtraction() here */

/* ---------------- STORE SUBS ---------------- */

store.subscribe(renderTasks);
store.subscribe(renderExtraction);
store.subscribe(renderCalendar);

/* ---------------- INIT ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  applyButtonAnimations();
  store.fetchInitialData();
  
  const calendarBtn = document.getElementById('calendar-btn');
  const allTasksBtn = document.getElementById('all-tasks-btn');
  const archivedTasksBtn = document.getElementById('archived-tasks-btn');

  function updateSidebarActive(id) {
    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  calendarBtn.addEventListener('click', () => {
    currentView = 'calendar';
    document.querySelector('.cal-section').classList.remove('hidden');
    updateSidebarActive('calendar-btn');
    renderTasks();
  });

  allTasksBtn.addEventListener('click', () => {
    currentView = 'all-tasks';
    document.querySelector('.cal-section').classList.add('hidden');
    updateSidebarActive('all-tasks-btn');
    renderTasks();
  });

  archivedTasksBtn.addEventListener('click', () => {
    currentView = 'archived';
    document.querySelector('.cal-section').classList.add('hidden');
    updateSidebarActive('archived-tasks-btn');
    renderTasks();
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    renderCalendar();
  });
});

/* ---------------- AI EXTRACT ---------------- */

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
});
