function renderTasks() {
  const tasks = store.tasks;
  const subjects = store.subjects;
  
  if (subjects.length === 0) return;
  
  const activeTasks = tasks.filter(t => !t.archived);
  const archivedTasks = tasks.filter(t => t.archived);
  
  const allTasksBadge = document.querySelector('#all-tasks-btn .badge');
  if (allTasksBadge) allTasksBadge.textContent = activeTasks.length;
  const archivedBadge = document.querySelector('#archived-tasks-btn .badge');
  if (archivedBadge) archivedBadge.textContent = archivedTasks.length;
  
  const displayTasksRaw = currentView === 'archived' ? archivedTasks : activeTasks;
  const displayTasks = activeLabelFilter
    ? displayTasksRaw.filter(t => t.labels && t.labels.includes(activeLabelFilter))
    : displayTasksRaw;

  if (labelFilterSelect) {
    const uniqueLabels = new Set();
    store.tasks.forEach(t => {
      if (t.labels && Array.isArray(t.labels)) {
        t.labels.forEach(l => uniqueLabels.add(l));
      }
    });
    const currentSel = labelFilterSelect.value;
    let optionsHtml = '<option value="">All Labels</option>';
    Array.from(uniqueLabels).sort().forEach(lbl => {
      optionsHtml += `<option value="${lbl}" ${lbl === currentSel ? 'selected' : ''}>${lbl}</option>`;
    });
    labelFilterSelect.innerHTML = optionsHtml;
  }

  const sorted = [...displayTasks].sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
  const now = new Date();

  const overdue = [];
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
      if (diffDays < 0) {
        overdue.push(t);
      } else if (diffDays <= 3) {
        dueSoon.push(t);
      } else {
        thisWeek.push(t);
      }
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
      if(sub.short_code === 'CS') pillClass = 'pill-blue';
      else if(sub.short_code === 'Maths') pillClass = 'pill-green';
      else if(sub.short_code === 'English') pillClass = 'pill-purple';
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
            <select class="board-edit-subject edit-field" style="width:100%; margin-bottom:12px; font-size:12px; padding:4px; border:1px solid var(--color-border-secondary); border-radius:4px;">${subjectOptions}</select>
            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Task Name</label>
            <input class="board-edit-title edit-field" type="text" value="${t.title}" style="width:100%; margin-bottom:12px; font-size:13px; font-weight:600; padding:6px;">
            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Deadline</label>
            <input class="board-edit-date edit-field" type="datetime-local" value="${localDate}" style="width:100%; margin-bottom:12px; font-size:12px; padding:6px;">
            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Notes</label>
            <input class="board-edit-notes edit-field" type="text" value="${t.notes || ''}" placeholder="Notes..." style="width:100%; margin-bottom:12px; font-size:12px; padding:6px;">
            <label style="display:block; font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Priority</label>
            <select class="board-edit-priority edit-field" style="width:100%; margin-bottom:12px; font-size:12px; padding:4px;">
              <option value="medium" ${!isHighPriority ? 'selected' : ''}>Medium</option>
              <option value="high" ${isHighPriority ? 'selected' : ''}>High</option>
            </select>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
              <button class="btn cancel-board-edit-btn" data-id="${t.id}" style="padding:6px 12px;">Cancel</button>
              <button class="btn btn-primary save-board-edit-btn" data-id="${t.id}" style="padding:6px 12px;">Save</button>
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
            <div class="task-actions">${archiveBtn}</div>
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
    const emptyState = dueSoon.length === 0 && completed.length === 0 ? `<div class="tasks-empty-state">No tasks for this day yet.</div>` : '';
    tasksSection.innerHTML = actionBar + renderGroup(`Tasks for ${selStr}`, dueSoon, 'var(--color-text-primary)') + renderGroup('Completed', completed, 'var(--color-text-tertiary)') + emptyState;
  } else {
    const actionBar = currentView === 'archived' ? '' : `<div class="tasks-actions-bar"><button id="mark-all-pending-btn" class="task-action-btn" ${pending.length === 0 ? 'disabled' : ''}>Mark all pending completed (${pending.length})</button></div>`;
    const titlePrefix = currentView === 'archived' ? 'Archived: ' : '';
    const emptyState = dueSoon.length === 0 && thisWeek.length === 0 && completed.length === 0 ? `<div class="tasks-empty-state">No tasks yet.</div>` : '';
    tasksSection.innerHTML = actionBar + renderGroup(titlePrefix + '⚠ Overdue', overdue, 'var(--color-text-danger)') + renderGroup(titlePrefix + '⚠ Due soon', dueSoon, 'var(--color-text-warning)') + renderGroup(titlePrefix + 'This week', thisWeek, 'var(--color-text-secondary)', true) + renderGroup(titlePrefix + 'Completed', completed, 'var(--color-text-tertiary)') + emptyState;
  }

  // Event listeners
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
      const title = itemEl.querySelector('.board-edit-title').value;
      const subject_id = itemEl.querySelector('.board-edit-subject').value;
      let dateVal = itemEl.querySelector('.board-edit-date').value;
      const notes = itemEl.querySelector('.board-edit-notes').value;
      const priority = itemEl.querySelector('.board-edit-priority').value;
      store.updateTask(taskId, { title, subject_id, due_at: dateVal ? new Date(dateVal).toISOString() : '', notes, priority });
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
