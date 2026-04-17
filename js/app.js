import { store } from './store.js';
import { extractTasksFromText } from './utils/api.js';

let currentMonthDate = new Date();
let selectedDate = null;

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
  
  const sorted = [...tasks].sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
  
  const now = new Date(); 
  
  const dueSoon = [];
  const thisWeek = [];
  const completed = [];
  const pending = [];
  
  if (selectedDate) {
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
        </div>
      `;
    });
    html += `</div>`;
    return html;
  };
  
  if (selectedDate) {
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
    const actionBar = `<div class="tasks-actions-bar">
           <button id="mark-all-pending-btn" class="task-action-btn" ${pending.length === 0 ? 'disabled' : ''}>Mark all pending completed (${pending.length})</button>
         </div>`;

    const emptyState = dueSoon.length === 0 && thisWeek.length === 0 && completed.length === 0
      ? `<div class="tasks-empty-state">No tasks yet. Add tasks from Smart Paste to get started.</div>`
      : '';

    tasksSection.innerHTML = actionBar +
                             renderGroup('⚠ Due soon', dueSoon, 'var(--color-text-danger)') +
                             renderGroup('This week', thisWeek, 'var(--color-text-secondary)', true) +
                             renderGroup('Completed', completed, 'var(--color-text-tertiary)') +
                             emptyState;
  }
                           
  document.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('click', () => {
      store.toggleTaskStatus(el.dataset.id);
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

document.addEventListener('DOMContentLoaded', () => {
  store.fetchInitialData();
  
  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    renderCalendar();
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
