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

// Global variables for Study Insights
let currentRecommendations = [];
let userPreferences = {};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize cross-tab synchronization
  store.initCrossTabSync();
  
  store.fetchInitialData().then(() => {
    // Start real-time updates after initial data is loaded
    store.startRealtimeUpdates(3000); // Update every 3 seconds
  });
  
  // Subscribe to store changes to update all UI components
  store.subscribe(() => {
    renderSubjects();
    renderTasks(store.tasks.filter(t => !t.archived));
    renderCalendar();
    loadStudyInsights();
  });
  
  // Initial render of all components
  renderSubjects();
  
  const calendarBtn = document.getElementById('calendar-btn');
  const allTasksBtn = document.getElementById('all-tasks-btn');
  const archivedTasksBtn = document.getElementById('archived-tasks-btn');

  function updateSidebarActive(id) {
    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
    const element = document.getElementById(id);
    if (element) element.classList.add('active');
  }

  if (calendarBtn) {
    calendarBtn.addEventListener('click', () => {
      currentView = 'calendar';
      const calSection = document.querySelector('.cal-section');
      if (calSection) calSection.classList.remove('hidden');
      document.getElementById('tasks-section').classList.add('hidden');
      if (studyInsightsSection) studyInsightsSection.classList.add('hidden');
      updateSidebarActive('calendar-btn');
      
      // Reset topbar title
      const topbarTitle = document.querySelector('.topbar-title');
      if (topbarTitle) topbarTitle.textContent = 'April 2026';
    });
  }

  if (allTasksBtn) {
    allTasksBtn.addEventListener('click', () => {
      currentView = 'all-tasks';
      const calSection = document.querySelector('.cal-section');
      if (calSection) calSection.classList.add('hidden');
      document.getElementById('tasks-section').classList.remove('hidden');
      if (studyInsightsSection) studyInsightsSection.classList.add('hidden');
      updateSidebarActive('all-tasks-btn');
      renderTasks(); // Show all tasks
      updateSidebarActive('all-tasks-btn');
      
      // Reset topbar title
      const topbarTitle = document.querySelector('.topbar-title');
      if (topbarTitle) topbarTitle.textContent = 'All Tasks';
    });
  }

  if (archivedTasksBtn) {
    archivedTasksBtn.addEventListener('click', () => {
      currentView = 'archived';
      const calSection = document.querySelector('.cal-section');
      if (calSection) calSection.classList.add('hidden');
      document.getElementById('tasks-section').classList.remove('hidden');
      document.getElementById('study-insights-section').classList.add('hidden');
      updateSidebarActive('archived-tasks-btn');
      renderTasks();
    });
  }

  const calPrevBtn = document.getElementById('cal-prev');
  const calNextBtn = document.getElementById('cal-next');
  
  if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
      currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
      renderCalendar();
    });
  }

  // Study Insights functionality
  const studyInsightsBtn = document.getElementById('study-insights-btn');
  const studyInsightsSection = document.getElementById('study-insights-section');
  const recommendationType = document.getElementById('recommendation-type');
  const refreshInsightsBtn = document.getElementById('refresh-insights');
  const editPreferencesBtn = document.getElementById('edit-preferences');
  const preferencesDisplay = document.getElementById('preferences-display');
  const preferencesEdit = document.getElementById('preferences-edit');
  const preferencesForm = document.getElementById('preferences-form');
  const cancelPreferencesBtn = document.getElementById('cancel-preferences');

  
  if (studyInsightsBtn) {
    studyInsightsBtn.addEventListener('click', () => {
      console.log('Study Insights button clicked');
      currentView = 'study-insights';
      const calSection = document.querySelector('.cal-section');
      if (calSection) calSection.classList.add('hidden');
      document.getElementById('tasks-section').classList.add('hidden');
      if (studyInsightsSection) {
        studyInsightsSection.classList.remove('hidden');
        studyInsightsSection.style.display = 'block';
        console.log('Study Insights section shown');
        // Add small delay to ensure DOM is ready
        setTimeout(() => {
          loadStudyInsights();
        }, 100);
      } else {
        console.error('Study Insights section not found');
      }
      updateSidebarActive('study-insights-btn');
    });
  }

  if (refreshInsightsBtn) {
    refreshInsightsBtn.addEventListener('click', () => {
      loadRecommendations();
    });
  }

  if (editPreferencesBtn) {
    editPreferencesBtn.addEventListener('click', () => {
      if (preferencesDisplay) preferencesDisplay.style.display = 'none';
      if (preferencesEdit) preferencesEdit.style.display = 'block';
      loadPreferencesForm();
    });
  }

  if (cancelPreferencesBtn) {
    cancelPreferencesBtn.addEventListener('click', () => {
      if (preferencesDisplay) preferencesDisplay.style.display = 'block';
      if (preferencesEdit) preferencesEdit.style.display = 'none';
    });
  }

  if (preferencesForm) {
    preferencesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await savePreferences();
    });
  }

  if (recommendationType) {
    recommendationType.addEventListener('change', () => {
      loadRecommendations();
    });
  }

  // Add Subject button
  const addSubjectBtn = document.getElementById('add-subject-btn');
  if (addSubjectBtn) {
    addSubjectBtn.addEventListener('click', () => {
      const subjectName = prompt('Enter subject name:');
      if (subjectName && subjectName.trim()) {
        addNewSubject(subjectName.trim());
      }
    });
  }

  // Pomodoro Timer functionality
  const pomodoroBtn = document.getElementById('pomodoro-btn');
  const pomodoroSection = document.getElementById('pomodoro-section');
  const pomodoroStartBtn = document.getElementById('pomodoro-start');
  const pomodoroPauseBtn = document.getElementById('pomodoro-pause');
  const pomodoroResetBtn = document.getElementById('pomodoro-reset');
  const pomodoroDisplay = document.getElementById('pomodoro-display');
  const workDurationInput = document.getElementById('work-duration');
  const breakDurationInput = document.getElementById('break-duration');

  let pomodoroInterval = null;
  let pomodoroTimeLeft = 25 * 60; // 25 minutes in seconds
  let pomodoroIsRunning = false;
  let pomodoroIsBreak = false;
  let pomodoroSessions = 0;
  let totalFocusTime = 0;

  if (pomodoroBtn) {
    pomodoroBtn.addEventListener('click', () => {
      currentView = 'pomodoro';
      const calSection = document.querySelector('.cal-section');
      if (calSection) calSection.classList.add('hidden');
      document.getElementById('tasks-section').classList.add('hidden');
      if (studyInsightsSection) studyInsightsSection.classList.add('hidden');
      if (pomodoroSection) {
        pomodoroSection.classList.remove('hidden');
        pomodoroSection.style.display = 'block';
      }
      if (document.getElementById('focus-mode-section')) {
        document.getElementById('focus-mode-section').classList.add('hidden');
      }
      updateSidebarActive('pomodoro-btn');
      
      // Update topbar title
      const topbarTitle = document.querySelector('.topbar-title');
      if (topbarTitle) topbarTitle.textContent = 'Pomodoro Timer';
    });
  }

  function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroTimeLeft / 60);
    const seconds = pomodoroTimeLeft % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    pomodoroDisplay.textContent = display;
    
    // Update badge
    const pomodoroBadge = document.getElementById('pomodoro-badge');
    if (pomodoroBadge) pomodoroBadge.textContent = display;
  }

  function startPomodoro() {
    if (!pomodoroIsRunning) {
      pomodoroIsRunning = true;
      pomodoroStartBtn.textContent = 'Running';
      pomodoroStartBtn.disabled = true;
      
      pomodoroInterval = setInterval(() => {
        pomodoroTimeLeft--;
        updatePomodoroDisplay();
        
        if (pomodoroTimeLeft <= 0) {
          // Session completed
          clearInterval(pomodoroInterval);
          pomodoroIsRunning = false;
          
          if (!pomodoroIsBreak) {
            // Work session completed
            pomodoroSessions++;
            totalFocusTime += parseInt(workDurationInput.value);
            updatePomodoroStats();
            
            // Show notification
            store.showNotification('🎉 Work session completed! Time for a break!', 'success');
            
            // Start break
            pomodoroIsBreak = true;
            pomodoroTimeLeft = parseInt(breakDurationInput.value) * 60;
            pomodoroStartBtn.textContent = 'Start Break';
            pomodoroStartBtn.disabled = false;
          } else {
            // Break completed
            store.showNotification('☕ Break completed! Ready for another session?', 'info');
            
            // Start next work session
            pomodoroIsBreak = false;
            pomodoroTimeLeft = parseInt(workDurationInput.value) * 60;
            pomodoroStartBtn.textContent = 'Start Work';
            pomodoroStartBtn.disabled = false;
          }
          
          updatePomodoroDisplay();
        }
      }, 1000);
    }
  }

  function pausePomodoro() {
    if (pomodoroIsRunning) {
      clearInterval(pomodoroInterval);
      pomodoroIsRunning = false;
      pomodoroStartBtn.textContent = pomodoroIsBreak ? 'Start Break' : 'Start Work';
      pomodoroStartBtn.disabled = false;
    }
  }

  function resetPomodoro() {
    clearInterval(pomodoroInterval);
    pomodoroIsRunning = false;
    pomodoroIsBreak = false;
    pomodoroTimeLeft = parseInt(workDurationInput.value) * 60;
    pomodoroStartBtn.textContent = 'Start';
    pomodoroStartBtn.disabled = false;
    updatePomodoroDisplay();
  }

  function updatePomodoroStats() {
    document.getElementById('pomodoro-sessions').textContent = pomodoroSessions;
    document.getElementById('pomodoro-focus-time').textContent = `${Math.floor(totalFocusTime / 60)}h`;
  }

  if (pomodoroStartBtn) pomodoroStartBtn.addEventListener('click', startPomodoro);
  if (pomodoroPauseBtn) pomodoroPauseBtn.addEventListener('click', pausePomodoro);
  if (pomodoroResetBtn) pomodoroResetBtn.addEventListener('click', resetPomodoro);

  // Update display when duration changes
  if (workDurationInput) {
    workDurationInput.addEventListener('change', () => {
      if (!pomodoroIsRunning) {
        pomodoroTimeLeft = parseInt(workDurationInput.value) * 60;
        updatePomodoroDisplay();
      }
    });
  }

  // Focus Mode functionality
  const focusModeBtn = document.getElementById('focus-mode-btn');
  const focusModeSection = document.getElementById('focus-mode-section');
  const focusStartBtn = document.getElementById('focus-start');
  const focusEndBtn = document.getElementById('focus-end');
  const focusTimer = document.getElementById('focus-timer');

  let focusInterval = null;
  let focusStartTime = null;
  let focusIsRunning = false;

  if (focusModeBtn) {
    focusModeBtn.addEventListener('click', () => {
      currentView = 'focus-mode';
      const calSection = document.querySelector('.cal-section');
      if (calSection) calSection.classList.add('hidden');
      document.getElementById('tasks-section').classList.add('hidden');
      if (studyInsightsSection) studyInsightsSection.classList.add('hidden');
      if (pomodoroSection) pomodoroSection.classList.add('hidden');
      if (focusModeSection) {
        focusModeSection.classList.remove('hidden');
        focusModeSection.style.display = 'block';
      }
      updateSidebarActive('focus-mode-btn');
      
      // Update topbar title
      const topbarTitle = document.querySelector('.topbar-title');
      if (topbarTitle) topbarTitle.textContent = 'Focus Mode';
    });
  }

  function startFocusSession() {
    if (!focusIsRunning) {
      focusIsRunning = true;
      focusStartTime = Date.now();
      focusStartBtn.disabled = true;
      
      // Apply focus mode settings
      const blockDistractions = document.getElementById('block-distractions').checked;
      if (blockDistractions) {
        // In a real implementation, this would block distracting websites
        console.log('Distractions blocked');
      }
      
      focusInterval = setInterval(() => {
        const elapsed = Date.now() - focusStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        focusTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }, 1000);
      
      store.showNotification('🎯 Focus session started! Stay focused!', 'success');
    }
  }

  function endFocusSession() {
    if (focusIsRunning) {
      clearInterval(focusInterval);
      focusIsRunning = false;
      focusStartBtn.disabled = false;
      
      const elapsed = Date.now() - focusStartTime;
      const minutes = Math.floor(elapsed / 60000);
      
      store.showNotification(`🎉 Focus session completed! ${minutes} minutes of focused work!`, 'success');
      
      // Reset timer
      focusTimer.textContent = '00:00:00';
    }
  }

  if (focusStartBtn) focusStartBtn.addEventListener('click', startFocusSession);
  if (focusEndBtn) focusEndBtn.addEventListener('click', endFocusSession);

  // New Task button
  const newTaskBtn = document.getElementById('new-task-btn');
  if (newTaskBtn) {
    newTaskBtn.addEventListener('click', () => {
      showNewTaskModal();
    });
  }

  async function loadRecommendations() {
    try {
      const type = recommendationType ? recommendationType.value : 'schedule';
      const response = await fetch(`/api/recommendations?type=${type}`);
      const data = await response.json();
      currentRecommendations = data.recommendations || [];
      renderRecommendations();
      updateInsightsBadge();
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  }

  function renderRecommendations() {
    console.log('Rendering recommendations:', currentRecommendations);
    const recommendationsList = document.getElementById('recommendations-list');
    const recommendationCount = document.getElementById('recommendation-count');
    
    if (!recommendationsList) {
      console.error('recommendations-list element not found');
      return;
    }
    
    if (currentRecommendations.length === 0) {
      const emptyHtml = '<p class="no-recommendations">No recommendations available. Try refreshing!</p>';
      recommendationsList.innerHTML = emptyHtml;
      console.log('Setting empty recommendations HTML:', emptyHtml);
      if (recommendationCount) recommendationCount.textContent = '0';
      return;
    }

    if (recommendationCount) recommendationCount.textContent = currentRecommendations.length;

    const recommendationsHtml = currentRecommendations.map((rec, index) => `
      <div class="recommendation-item">
        <div class="recommendation-content">
          <p class="recommendation-text">${rec.text}</p>
          <div class="recommendation-actions">
            <button class="btn btn-small btn-primary" onclick="applyRecommendation(${index})">Apply</button>
            <div class="rating-container">
              <span>Rate:</span>
              <div class="rating-stars" data-index="${index}">
                ${[1,2,3,4,5].map(star => `
                  <button class="star-btn" onclick="rateRecommendation(${index}, ${star})">★</button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    
    console.log('Setting recommendations HTML:', recommendationsHtml);
    recommendationsList.innerHTML = recommendationsHtml;
    console.log('Recommendations list element after setting HTML:', recommendationsList);
    console.log('Recommendations list innerHTML:', recommendationsList.innerHTML);
  }

  
  
  function updateInsightsBadge() {
    const insightsBtn = document.getElementById('study-insights-btn');
    if (insightsBtn && currentRecommendations.length > 0) {
      const badge = insightsBtn.querySelector('.badge');
      if (badge) {
        badge.textContent = currentRecommendations.length;
      } else {
        const newBadge = document.createElement('span');
        newBadge.className = 'badge';
        newBadge.textContent = currentRecommendations.length;
        insightsBtn.appendChild(newBadge);
      }
    }
  }

  function formatStudyStyle(style) {
    const styles = {
      'visual': 'Visual Learner',
      'auditory': 'Auditory Learner', 
      'kinesthetic': 'Kinesthetic Learner',
      'reading': 'Reading/Writing Learner',
      'mixed': 'Mixed Learning Style'
    };
    return styles[style] || 'Mixed Learning Style';
  }

  function formatDifficultyPreference(preference) {
    const preferences = {
      'easy_first': 'Easy Tasks First',
      'hard_first': 'Hard Tasks First', 
      'mixed': 'Mixed Difficulty'
    };
    return preferences[preference] || 'Mixed Difficulty';
  }

  async function loadPreferencesForm() {
    if (!preferencesForm) return;
    
    preferencesForm.innerHTML = `
      <div class="form-group">
        <label>Study Style</label>
        <select id="study-style">
          <option value="visual">Visual Learner</option>
          <option value="auditory">Auditory Learner</option>
          <option value="kinesthetic">Kinesthetic Learner</option>
          <option value="reading">Reading/Writing Learner</option>
          <option value="mixed">Mixed Learning Style</option>
        </select>
      </div>
      <div class="form-group">
        <label>Session Length (minutes)</label>
        <input type="number" id="session-length" min="10" max="120" value="${userPreferences.preferred_session_length || 25}">
      </div>
      <div class="form-group">
        <label>Break Length (minutes)</label>
        <input type="number" id="break-length" min="1" max="30" value="${userPreferences.preferred_break_length || 5}">
      </div>
      <div class="form-group">
        <label>Peak Productivity Start</label>
        <input type="time" id="peak-start" value="${userPreferences.peak_productivity_start || '09:00'}">
      </div>
      <div class="form-group">
        <label>Peak Productivity End</label>
        <input type="time" id="peak-end" value="${userPreferences.peak_productivity_end || '12:00'}">
      </div>
      <div class="form-group">
        <label>Difficulty Preference</label>
        <select id="difficulty-preference">
          <option value="easy_first">Easy Tasks First</option>
          <option value="hard_first">Hard Tasks First</option>
          <option value="mixed">Mixed Difficulty</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Save Preferences</button>
        <button type="button" id="cancel-preferences" class="btn btn-secondary">Cancel</button>
      </div>
    `;

    // Set current values
    if (userPreferences.study_style) {
      document.getElementById('study-style').value = userPreferences.study_style;
    }
    if (userPreferences.difficulty_preference) {
      document.getElementById('difficulty-preference').value = userPreferences.difficulty_preference;
    }

    // Add cancel button listener
    const cancelBtn = document.getElementById('cancel-preferences');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (preferencesDisplay) preferencesDisplay.style.display = 'block';
        if (preferencesEdit) preferencesEdit.style.display = 'none';
      });
    }
  }

  async function savePreferences() {
    try {
      const preferences = {
        study_style: document.getElementById('study-style').value,
        preferred_session_length: parseInt(document.getElementById('session-length').value),
        preferred_break_length: parseInt(document.getElementById('break-length').value),
        peak_productivity_start: document.getElementById('peak-start').value,
        peak_productivity_end: document.getElementById('peak-end').value,
        difficulty_preference: document.getElementById('difficulty-preference').value
      };

      const response = await fetch('/api/recommendations/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        userPreferences = preferences;
        if (preferencesDisplay) preferencesDisplay.style.display = 'block';
        if (preferencesEdit) preferencesEdit.style.display = 'none';
        renderPreferences();
        loadRecommendations(); // Refresh recommendations with new preferences
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  // Global functions for onclick handlers
  window.applyRecommendation = async function(index) {
    const rec = currentRecommendations[index];
    if (!rec) return;
    
    // Here you could implement logic to apply the recommendation
    alert(`Applied recommendation: ${rec.text}`);
    
    // You might want to record that this was applied
    await fetch('/api/recommendations/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation_text: rec.text })
    });
  };

  window.rateRecommendation = async function(index, rating) {
    const rec = currentRecommendations[index];
    if (!rec) return;
    
    try {
      await fetch(`/api/recommendations/${index}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      
      // Update UI to show rating
      const stars = document.querySelectorAll(`.rating-stars[data-index="${index}"] .star-btn`);
      stars.forEach((star, i) => {
        star.classList.toggle('active', i < rating);
      });
    } catch (error) {
      console.error('Failed to rate recommendation:', error);
    }
  };

  // Render subjects function
  function renderSubjects() {
    const subjectsList = document.getElementById('subjects-list');
    if (!subjectsList) return;
    
    const subjects = store.subjects || [];
    
    if (subjects.length === 0) {
      subjectsList.innerHTML = '<div class="nav-item" style="opacity: 0.6;">No subjects yet</div>';
      return;
    }
    
    subjectsList.innerHTML = subjects.map(subject => {
      const taskCount = store.tasks.filter(task => task.subject_id === subject.id && !task.archived).length;
      return `
        <div class="nav-item subject-item" data-subject-id="${subject.id}">
          <span class="nav-dot" style="background:${subject.color || 'var(--color-text-info)'}"></span>
          ${subject.name}
          <span class="badge">${taskCount}</span>
        </div>
      `;
    }).join('');
    
    // Add click listeners to subject items
    document.querySelectorAll('.subject-item').forEach(item => {
      item.addEventListener('click', () => {
        const subjectId = item.dataset.subjectId;
        filterTasksBySubject(subjectId);
        updateSidebarActive(item.id);
      });
    });
  }

  // Filter tasks by subject function
  function filterTasksBySubject(subjectId) {
    const subject = store.subjects.find(s => s.id === subjectId);
    if (!subject) return;
    
    currentView = 'subject-tasks';
    const calSection = document.querySelector('.cal-section');
    if (calSection) calSection.classList.add('hidden');
    document.getElementById('tasks-section').classList.remove('hidden'); // Show tasks section
    if (studyInsightsSection) studyInsightsSection.classList.add('hidden');
    
    // Show filtered tasks (including done tasks, but not archived)
    const filteredTasks = store.tasks.filter(task => task.subject_id === subjectId && !task.archived);
    
    // Show message if no tasks found
    if (filteredTasks.length === 0) {
      const tasksSection = document.getElementById('tasks-section');
      if (tasksSection) {
        tasksSection.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: var(--color-text-secondary);">
            <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
            <h3 style="margin: 0 0 8px 0; color: var(--color-text-primary);">No tasks for ${subject.name}</h3>
            <p style="margin: 0; font-size: 14px;">Create a new task for ${subject.name} to get started!</p>
            <button class="btn btn-primary" style="margin-top: 20px;" onclick="showNewTaskModal()">
              + Create Task
            </button>
          </div>
        `;
      }
    } else {
      renderTasks(filteredTasks);
    }
    
    // Update topbar title
    const topbarTitle = document.querySelector('.topbar-title');
    if (topbarTitle) topbarTitle.textContent = subject.name;
  }

  // Add new subject function
  async function addNewSubject(subjectName) {
    try {
      // Generate a unique ID and random color
      const id = 'subject_' + Date.now();
      const colors = ['#4f46e5', '#16a34a', '#9333ea', '#eab308', '#dc2626', '#0891b2'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id,
          name: subjectName,
          color: color
        })
      });
      
      if (response.ok) {
        // Refresh the data to show the new subject
        await store.fetchInitialData();
        renderSubjects();
        console.log('Subject added successfully:', subjectName);
      } else {
        console.error('Failed to add subject');
        alert('Failed to add subject. Please try again.');
      }
    } catch (error) {
      console.error('Error adding subject:', error);
      alert('Error adding subject. Please try again.');
    }
  }

  // Show new task modal function
  function showNewTaskModal() {
    // Get current subjects
    const subjects = store.subjects || [];
    
    if (subjects.length === 0) {
      alert('Please add a subject first before creating tasks.');
      return;
    }
    
    // Create modal HTML
    const modalHtml = `
      <div id="new-task-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
        <div style="background: white; border-radius: 16px; padding: 32px; width: 400px; max-width: 90vw;">
          <h3 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 600;">Create New Task</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Subject</label>
            <select id="task-subject" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              ${subjects.map(subject => `
                <option value="${subject.id}">${subject.name}</option>
              `).join('')}
            </select>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Task Title</label>
            <input type="text" id="task-title" placeholder="Enter task title" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Description</label>
            <textarea id="task-description" placeholder="Enter task description (optional)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; min-height: 80px; resize: vertical;"></textarea>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Due Date</label>
            <input type="datetime-local" id="task-due-date" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Priority</label>
            <select id="task-priority" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="cancel-task-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="save-task-btn" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">Create Task</button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add event listeners
    const modal = document.getElementById('new-task-modal');
    const cancelBtn = document.getElementById('cancel-task-btn');
    const saveBtn = document.getElementById('save-task-btn');
    
    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });
    
    saveBtn.addEventListener('click', async () => {
      await saveNewTask();
      modal.remove();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Save new task function
  async function saveNewTask() {
    try {
      const subjectId = document.getElementById('task-subject').value;
      const title = document.getElementById('task-title').value.trim();
      const description = document.getElementById('task-description').value.trim();
      const dueDate = document.getElementById('task-due-date').value;
      const priority = document.getElementById('task-priority').value;
      
      if (!title) {
        alert('Please enter a task title.');
        return;
      }
      
      const taskData = {
        id: 'task_' + Date.now(),
        subject_id: subjectId,
        title: title,
        description: description || null,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        priority: priority,
        status: 'Not Started'
      };
      
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        // Refresh the data to show the new task
        store.fetchInitialData();
        console.log('Task created successfully:', title);
      } else {
        console.error('Failed to create task');
        alert('Failed to create task. Please try again.');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error creating task. Please try again.');
    }
  }
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

// Global functions for onclick handlers
window.applyRecommendation = async function(index) {
  const recommendation = currentRecommendations[index];
  try {
    // Here you could implement specific actions based on recommendation type
    console.log('Applying recommendation:', recommendation);
    alert('Recommendation applied! Check your tasks and schedule for updates.');
  } catch (error) {
    console.error('Failed to apply recommendation:', error);
  }
};

window.rateRecommendation = async function(index, rating) {
  const recommendation = currentRecommendations[index];
  try {
    // Update UI immediately
    const stars = document.querySelectorAll(`.recommendation-item:nth-child(${index + 1}) .rating-star`);
    stars.forEach((star, i) => {
      star.classList.toggle('filled', i < rating);
    });
    
    // Send rating to server (you'd need the recommendation ID)
    console.log('Rating recommendation:', recommendation, 'with rating:', rating);
  } catch (error) {
    console.error('Failed to rate recommendation:', error);
  }
};

// User Preferences function (globally accessible)
async function loadUserPreferences() {
  try {
    const response = await fetch('/api/preferences');
    userPreferences = await response.json();
    renderPreferences();
  } catch (error) {
    console.error('Failed to load preferences:', error);
  }
}

function renderPreferences() {
  console.log('Rendering preferences:', userPreferences);
  if (!userPreferences) return;
  
  if (preferencesDisplay) {
    const preferencesHtml = `
      <div class="preference-item">
        <span class="preference-label">Study Style</span>
        <span class="preference-value">${formatStudyStyle(userPreferences.study_style)}</span>
      </div>
      <div class="preference-item">
        <span class="preference-label">Session Length</span>
        <span class="preference-value">${userPreferences.preferred_session_length || 25} minutes</span>
      </div>
      <div class="preference-item">
        <span class="preference-label">Break Length</span>
        <span class="preference-value">${userPreferences.preferred_break_length || 5} minutes</span>
      </div>
      <div class="preference-item">
        <span class="preference-label">Peak Hours</span>
        <span class="preference-value">${userPreferences.peak_productivity_start || '09:00'} - ${userPreferences.peak_productivity_end || '12:00'}</span>
      </div>
      <div class="preference-item">
        <span class="preference-label">Difficulty Preference</span>
        <span class="preference-value">${formatDifficultyPreference(userPreferences.difficulty_preference)}</span>
      </div>
    `;
    console.log('Setting preferences HTML:', preferencesHtml);
    preferencesDisplay.innerHTML = preferencesHtml;
    console.log('Preferences display element:', preferencesDisplay);
  } else {
    console.error('preferences-display element not found');
  }
}

async function loadStudyPatterns() {
  try {
    const response = await fetch('/api/recommendations/patterns');
    const patterns = await response.json();
    renderStudyPatterns(patterns);
  } catch (error) {
    console.error('Failed to load study patterns:', error);
  }
}

function renderStudyPatterns(patterns) {
  const patternsContainer = document.getElementById('study-patterns');
  if (!patternsContainer) {
    console.error('study-patterns element not found');
    return;
  }
  
  if (patterns.length === 0) {
    // Show sample statistics for demonstration
    const sampleStats = `
      <div class="pattern-item">
        <div class="pattern-value">0m</div>
        <div class="pattern-label">Avg Session</div>
      </div>
      <div class="pattern-item">
        <div class="pattern-value">0.0</div>
        <div class="pattern-label">Avg Difficulty</div>
      </div>
      <div class="pattern-item">
        <div class="pattern-value">0.0</div>
        <div class="pattern-label">Avg Effectiveness</div>
      </div>
      <div class="pattern-item">
        <div class="pattern-value">0</div>
        <div class="pattern-label">Total Sessions</div>
      </div>
    `;
    patternsContainer.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--color-text-secondary);">
        <p style="margin-bottom: 16px;">📊 No study patterns recorded yet.</p>
        <p style="font-size: 14px;">Complete some tasks to see your personalized study patterns and statistics!</p>
      </div>
      <div class="patterns-grid">${sampleStats}</div>
    `;
    return;
  }

  patternsContainer.innerHTML = patterns.map(pattern => `
    <div class="pattern-item">
      <div class="pattern-header">
        <span class="pattern-subject" style="color: ${pattern.subject_color || '#666'}">
          ${pattern.subject_name || 'General'}
        </span>
        <span class="pattern-time">${new Date(pattern.created_at).toLocaleDateString()}</span>
      </div>
      <div class="pattern-details">
        <div class="pattern-stat">
          <span class="stat-label">Duration:</span>
          <span class="stat-value">${pattern.completion_time || 'N/A'} min</span>
        </div>
        <div class="pattern-stat">
          <span class="stat-label">Difficulty:</span>
          <span class="stat-value">${pattern.difficulty_rating || 'N/A'}/5</span>
        </div>
        <div class="pattern-stat">
          <span class="stat-label">Effectiveness:</span>
          <span class="stat-value">${pattern.effectiveness_rating || 'N/A'}/5</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Study Insights functions
async function loadStudyInsights() {
  console.log('Loading Study Insights...');
  try {
    await Promise.all([
      loadAdvancedRecommendations(),
      loadUserPreferences(),
      loadStudyPatterns(),
      loadLearningAnalytics(),
      generatePersonalizedInsights()
    ]);
    console.log('Study Insights loaded successfully');
  } catch (error) {
    console.error('Failed to load Study Insights:', error);
  }
}

// Advanced AI Recommendations Engine
async function loadAdvancedRecommendations() {
  try {
    const response = await fetch('/api/recommendations/advanced');
    const recommendations = await response.json();
    renderAdvancedRecommendations(recommendations);
  } catch (error) {
    console.error('Failed to load advanced recommendations:', error);
  }
}

function renderAdvancedRecommendations(recommendations) {
  const container = document.getElementById('recommendations-list');
  if (!container) return;
  
  if (recommendations.length === 0) {
    container.innerHTML = '<p class="no-recommendations">No recommendations available. Start studying to get personalized insights!</p>';
    return;
  }

  container.innerHTML = recommendations.map(rec => `
    <div class="recommendation-item ${rec.priority === 'high' ? 'high-priority' : ''}">
      <div class="recommendation-header">
        <span class="recommendation-type">${getTypeIcon(rec.type)} ${rec.type}</span>
        <span class="recommendation-priority ${rec.priority}">${rec.priority}</span>
      </div>
      <div class="recommendation-content">
        <h4 class="recommendation-title">${rec.title}</h4>
        <p class="recommendation-text">${rec.description}</p>
        ${rec.actionable ? `
          <div class="recommendation-actions">
            <button class="btn btn-sm btn-primary" onclick="applyRecommendation('${rec.id}')">
              Apply Recommendation
            </button>
            <button class="btn btn-sm" onclick="snoozeRecommendation('${rec.id}')">
              Snooze
            </button>
          </div>
        ` : ''}
      </div>
      <div class="recommendation-footer">
        <span class="recommendation-confidence">Confidence: ${rec.confidence}%</span>
        <span class="recommendation-impact">Impact: ${rec.impact}</span>
      </div>
    </div>
  `).join('');
}

function getTypeIcon(type) {
  const icons = {
    'schedule': '📅',
    'technique': '🧠',
    'priority': '⚡',
    'resource': '📚',
    'health': '💪',
    'performance': '📈',
    'habit': '🔄'
  };
  return icons[type] || '💡';
}

// Learning Analytics
async function loadLearningAnalytics() {
  try {
    const response = await fetch('/api/analytics/learning');
    const analytics = await response.json();
    renderLearningAnalytics(analytics);
  } catch (error) {
    console.error('Failed to load learning analytics:', error);
  }
}

function renderLearningAnalytics(analytics) {
  const container = document.getElementById('learning-analytics');
  if (!container) return;

  container.innerHTML = `
    <div class="analytics-grid">
      <div class="analytics-card">
        <div class="analytics-value">${analytics.productivity_score || 0}</div>
        <div class="analytics-label">Productivity Score</div>
        <div class="analytics-trend ${analytics.productivity_trend > 0 ? 'positive' : 'negative'}">
          ${analytics.productivity_trend > 0 ? '📈' : '📉'} ${Math.abs(analytics.productivity_trend)}%
        </div>
      </div>
      <div class="analytics-card">
        <div class="analytics-value">${analytics.study_streak || 0}</div>
        <div class="analytics-label">Day Streak</div>
        <div class="analytics-trend">🔥 Keep it up!</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-value">${analytics.focus_hours || 0}h</div>
        <div class="analytics-label">Focus Time Today</div>
        <div class="analytics-trend">⏱️ ${analytics.focus_goal ? `${analytics.focus_hours}/${analytics.focus_goal}h` : ''}</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-value">${analytics.tasks_completed || 0}</div>
        <div class="analytics-label">Tasks Completed</div>
        <div class="analytics-trend">✨ Great progress!</div>
      </div>
    </div>
  `;
}

// Personalized Insights Generator
async function generatePersonalizedInsights() {
  try {
    const response = await fetch('/api/insights/personalized');
    const insights = await response.json();
    renderPersonalizedInsights(insights);
  } catch (error) {
    console.error('Failed to generate personalized insights:', error);
  }
}

function renderPersonalizedInsights(insights) {
  const container = document.getElementById('personalized-insights');
  if (!container) return;

  container.innerHTML = `
    <div class="insights-container">
      ${insights.map(insight => `
        <div class="insight-card ${insight.type}">
          <div class="insight-icon">${insight.icon}</div>
          <div class="insight-content">
            <h4 class="insight-title">${insight.title}</h4>
            <p class="insight-description">${insight.description}</p>
            ${insight.actionable ? `
              <button class="insight-action" onclick="takeAction('${insight.action}')">
                ${insight.action_text}
              </button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Action handlers for recommendations
function applyRecommendation(id) {
  console.log('Applying recommendation:', id);
  store.showNotification('✅ Recommendation applied successfully!', 'success');
}

function snoozeRecommendation(id) {
  console.log('Snoozing recommendation:', id);
  store.showNotification('⏰ Recommendation snoozed for later', 'info');
}

function takeAction(action) {
  console.log('Taking action:', action);
  store.showNotification('🎯 Action initiated!', 'success');
}

function updateSidebarActive(activeId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}
