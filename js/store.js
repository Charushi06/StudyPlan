import { Toast } from './utils/toast.js';
import { triggerConfetti } from './utils/confetti.js';

export const store = {
  subjects: [],
  tasks: [],
  currentPaste: null,
  listeners: [],
  selectedTasks: [],

  isSameCalendarDate(dateA, dateB) {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  },
  
  subscribe(listener) {
    this.listeners.push(listener);
  },
  
  notify() {
    this.listeners.forEach(l => l());
  },
  async smartRescheduleOverdueTasks() {
  const now = new Date();

  const overdueTasks = this.tasks.filter(task => {
    return (
      task.status !== "Done" &&
      !task.archived &&
      task.due_at &&
      new Date(task.due_at) < now
    );
  });

  if (overdueTasks.length === 0) {
    alert("No overdue tasks found.");
    return;
  }

  const updatedTasks = [];

  for (let i = 0; i < overdueTasks.length; i++) {
    const task = overdueTasks[i];

    let newDate = new Date();
    newDate.setDate(newDate.getDate() + i + 1);

    // avoid overloaded days
    while (
      this.tasks.filter(t => {
        if (!t.due_at) return false;

        const taskDate = new Date(t.due_at);

        return (
          taskDate.toDateString() ===
          newDate.toDateString()
        );
      }).length >= 3
    ) {
      newDate.setDate(newDate.getDate() + 1);
    }

    task.due_at = newDate.toISOString();

    updatedTasks.push(
      fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          due_at: task.due_at
        })
      })
    );
  }

  try {
    await Promise.all(updatedTasks);
    alert(
      `${overdueTasks.length} overdue task(s) rescheduled successfully`
    );

    const tasksRes = await fetch('/api/tasks');
    this.tasks = await tasksRes.json();
    this.notify();

  } catch (error) {
    console.error(error);
    alert("Failed to reschedule tasks");
  }
},
  async fetchInitialData() {
    try {
      const [subsRes, tasksRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/tasks')
      ]);
      this.subjects = await subsRes.json();
      this.tasks = await tasksRes.json();
      this.notify();
    } catch (e) {
      console.error('Failed to load initial data', e);
    }
  },

  async addSubject({ name, color }) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      Toast.show('Please enter a subject name', 'warning');
      return false;
    }
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color: color || 'var(--color-text-info)' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Toast.show(data.error || 'Failed to add subject', 'error');
        return false;
      }
      const subsRes = await fetch('/api/subjects');
      this.subjects = await subsRes.json();
      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to add subject', e);
      Toast.show('Network error. Please try again.', 'error');
      return false;
    }
  },

  async updateSubject(id, { name, color }) {
    const idx = this.subjects.findIndex(s => s.id === id);
    if (idx === -1) return false;

    const original = { ...this.subjects[idx] };

    // Optimistic update
    if (name) {
      this.subjects[idx].name = name;
      this.subjects[idx].short_code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SUB';
    }
    if (color) this.subjects[idx].color = color;
    this.notify();

    try {
      const res = await fetch(`/api/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Toast.show(data.error || 'Failed to update subject', 'error');
        this.subjects[idx] = original;
        this.notify();
        return false;
      }
      Toast.show('Subject updated', 'success');
      return true;
    } catch (e) {
      console.error('Failed to update subject', e);
      Toast.show('Network error. Please try again.', 'error');
      this.subjects[idx] = original;
      this.notify();
      return false;
    }
  },

  async deleteSubject(id) {
    const confirmed = await Toast.confirm('Delete this subject? Tasks assigned to it will become unassigned.');
    if (!confirmed) return;

    const idx = this.subjects.findIndex(s => s.id === id);
    if (idx === -1) return;

    const removed = this.subjects.splice(idx, 1)[0];
    // Unassign tasks in local state
    this.tasks.forEach(t => { if (t.subject_id === id) t.subject_id = null; });
    this.notify();

    try {
      const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Toast.show(data.error || 'Failed to delete subject', 'error');
        this.subjects.splice(idx, 0, removed);
        this.tasks.forEach(t => { if (t.subject_id === null && removed) t.subject_id = removed.id; });
        this.notify();
      } else {
        Toast.show('Subject deleted', 'success');
      }
    } catch (e) {
      console.error('Failed to delete subject', e);
      Toast.show('Network error. Please try again.', 'error');
      this.subjects.splice(idx, 0, removed);
      this.notify();
    }
  },


  // ================= UPDATED FUNCTION =================
  async addTasks(newTasks) {
    try {
      const tasksToAdd = (Array.isArray(newTasks) ? newTasks : [newTasks])
        .filter(Boolean)
        .map(({ _isEditing, icon, subject_name, ...task }) => task);

      if (tasksToAdd.length === 0) {
        alert("No valid tasks to add");
        return false;
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasksToAdd)
      });

      const data = await res.json(); // always parse response

      if (!res.ok) {
        //  Backend error
        Toast.show(`❌ ${data.message || "Failed to add tasks"}`, 'error');
        console.error('Add task error:', data);
        return false;
      }

      // ================= USER MESSAGES =================

      if (data.duplicates?.length > 0) {
        Toast.show(`⚠ ${data.duplicates.length} duplicate task(s) skipped`, 'warning');
      }

      if (data.errors?.length > 0) {
        Toast.show(`❌ ${data.errors.length} task(s) failed to add`, 'error');
      }

      if (
        data.inserted > 0 &&
        (data.duplicates?.length || 0) === 0 &&
        (data.errors?.length || 0) === 0
      ) {
        Toast.show("✅ Tasks added successfully", 'success');
      }

      // ================= REFRESH =================
      const tasksRes = await fetch('/api/tasks');
      this.tasks = await tasksRes.json();
      this.notify();
      return data.inserted > 0;

    } catch (e) {
      console.error('Failed to add tasks', e);
      Toast.show("❌ Network error. Please try again.", 'error');
    }
  },

  setTaskEditing(taskId, isEditing) {
    const task = this.tasks.find(t => String(t.id) === String(taskId));
    if (task) {
      task._isEditing = isEditing;
      this.notify();
    }
  },

  async updateTask(taskId, updatedFields) {
    const taskIndex = this.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex === -1) return;
    
    // Store original in case of failure
    const originalTask = { ...this.tasks[taskIndex] };
    
    // Optimistic update
    this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updatedFields, _isEditing: false };
    this.notify();

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      
      if (!res.ok) {
        throw new Error('Update failed');
      }
    } catch (e) {
      console.error('Failed to update task', e);
      Toast.show("❌ Failed to save task changes. Please try again.", 'error');
      // Revert
      this.tasks[taskIndex] = originalTask;
      this.notify();
    }
  },

  async toggleTaskStatus(taskId) {
    const task = this.tasks.find(t => String(t.id) === String(taskId));
    if (task) {
      const newStatus = task.status === 'Done' ? 'Not Started' : 'Done';
      task.status = newStatus;
      this.notify();

      if (newStatus === 'Done') {
        triggerConfetti();
      }

      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (e) {
        task.status = newStatus === 'Done' ? 'Not Started' : 'Done';
        this.notify();
      }
    }
  },

  async archiveTask(taskId) {
    const task = this.tasks.find(t => String(t.id) === String(taskId));
    if (task) {
      task.archived = 1;
      this.notify();
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: 1 })
        });
      } catch (e) {
        task.archived = 0;
        this.notify();
        console.error('Failed to archive task', e);
      }
    }
  },

  async restoreTask(taskId) {
    const task = this.tasks.find(t => String(t.id) === String(taskId));
    if (task) {
      task.archived = 0;
      this.notify();
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: 0 })
        });
      } catch (e) {
        task.archived = 1;
        this.notify();
        console.error('Failed to restore task', e);
      }
    }
  },

  async deleteTask(taskId) {
    const confirmed = await Toast.confirm('Are you sure you want to permanently delete this task?');
    if (!confirmed) return;

    const taskIndex = this.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex !== -1) {
      const removedTask = this.tasks.splice(taskIndex, 1)[0];
      this.notify();
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE'
        });
      } catch (e) {
        this.tasks.splice(taskIndex, 0, removedTask);
        this.notify();
        console.error('Failed to delete task', e);
      }
    }
  },

  async markAllPendingCompleted() {
    const pendingTasks = this.tasks.filter(t => t.status !== 'Done');
    if (pendingTasks.length === 0) return;

    const previousStatuses = pendingTasks.map(t => ({ id: t.id, status: t.status }));

    pendingTasks.forEach(t => {
      t.status = 'Done';
    });
    this.notify();
    triggerConfetti();

    try {
      await Promise.all(
        pendingTasks.map(t =>
          fetch(`/api/tasks/${t.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Done' })
          })
        )
      );
    } catch (e) {
      previousStatuses.forEach(prev => {
        const task = this.tasks.find(t => String(t.id) === String(prev.id));
        if (task) task.status = prev.status;
      });
      this.notify();
      console.error('Failed to mark all pending tasks completed', e);
    }
  },

  async markPendingTasksForDateCompleted(targetDate) {
    if (!targetDate) return;

    const pendingTasksForDate = this.tasks.filter(t => {
      if (t.status === 'Done' || !t.due_at) return false;
      return this.isSameCalendarDate(new Date(t.due_at), targetDate);
    });

    if (pendingTasksForDate.length === 0) return;

    const previousStatuses = pendingTasksForDate.map(t => ({ id: t.id, status: t.status }));

    pendingTasksForDate.forEach(t => {
      t.status = 'Done';
    });
    this.notify();
    triggerConfetti();

    try {
      await Promise.all(
        pendingTasksForDate.map(t =>
          fetch(`/api/tasks/${t.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Done' })
          })
        )
      );
    } catch (e) {
      previousStatuses.forEach(prev => {
        const task = this.tasks.find(t => String(t.id) === String(prev.id));
        if (task) task.status = prev.status;
      });
      this.notify();
      console.error('Failed to mark pending tasks for date completed', e);
    }
  },

  setExtracted(items) {
    this.currentPaste = Array.isArray(items)
      ? items.map(item => ({ ...item, _isEditing: false }))
      : [];
    this.notify();
  },

  updateExtractedItem(index, updatedFields) {
    if (this.currentPaste && this.currentPaste[index]) {
      this.currentPaste[index] = { ...this.currentPaste[index], ...updatedFields };
      this.notify();
    }
  },

  clearExtracted() {
    this.currentPaste = null;
    this.notify();
  },
  toggleTaskSelection(taskId) {
  taskId = String(taskId);

  const exists =
    this.selectedTasks.includes(taskId);

  if (exists) {
    this.selectedTasks =
      this.selectedTasks.filter(
        id => id !== taskId
      );
  } else {
    this.selectedTasks.push(taskId);
  }

  this.notify();
},

clearSelectedTasks() {
  this.selectedTasks = [];
  this.notify();
},

selectAllTasks() {
  this.selectedTasks = this.tasks
    .filter(t =>
      !t.archived &&
      t.status !== 'Done'
    )
    .map(t => String(t.id));

  this.notify();
},

async bulkCompleteTasks() {
  const selected = this.tasks.filter(t =>
    this.selectedTasks.includes(String(t.id))
  );

  for (const task of selected) {
    task.status = 'Done';

    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'Done'
      })
    });
  }

  this.clearSelectedTasks();
  this.notify();
},

async bulkArchiveTasks() {
  const selected = this.tasks.filter(t =>
    this.selectedTasks.includes(t.id)
  );

  for (const task of selected) {
    task.archived = 1;

    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: 1
      })
    });
  }

  this.clearSelectedTasks();
  this.notify();
},

async bulkDeleteTasks() {
  const confirmed = confirm(
    `Delete ${this.selectedTasks.length} selected tasks?`
  );

  if (!confirmed) return;

  await Promise.all(
    this.selectedTasks.map(id =>
      fetch(`/api/tasks/${id}`, {
        method: 'DELETE'
      })
    )
  );

  this.tasks = this.tasks.filter(
    t => !this.selectedTasks.includes(String(t.id))
  );

  this.clearSelectedTasks();
  this.notify();
},
};