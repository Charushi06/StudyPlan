import { Toast } from './utils/toast.js';
import { triggerConfetti } from './utils/confetti.js';

export const store = {
  subjects: [],
  tasks: [],
  currentPaste: null,
  listeners: [],

  getAuthHeaders() {
    const user = JSON.parse(localStorage.getItem('studyplan_user') || '{}');
    return {
      'Content-Type': 'application/json',
      'Authorization': user.token ? `Bearer ${user.token}` : ''
    };
  },

  async authenticatedFetch(url, options = {}) {
    const headers = this.getAuthHeaders();
    options.headers = {
      ...headers,
      ...(options.headers || {})
    };
    
    try {
      const res = await fetch(url, options);
      if (res.status === 401) {
        localStorage.removeItem('studyplan_user');
        window.location.reload();
        throw new Error('Unauthorized');
      }
      return res;
    } catch (e) {
      if (e.message !== 'Unauthorized') {
        console.error('Fetch error:', e);
      }
      throw e;
    }
  },

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
  
  async fetchInitialData() {
    // Only load if logged in
    if (!localStorage.getItem('studyplan_user')) return;
    try {
      const [subsRes, tasksRes] = await Promise.all([
        this.authenticatedFetch('/api/subjects'),
        this.authenticatedFetch('/api/tasks')
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
      const res = await this.authenticatedFetch('/api/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, color: color || 'var(--color-text-info)' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Toast.show(data.error || 'Failed to add subject', 'error');
        return false;
      }
      const subsRes = await this.authenticatedFetch('/api/subjects');
      this.subjects = await subsRes.json();
      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to add subject', e);
      Toast.show('Network error. Please try again.', 'error');
      return false;
    }
  },

  async addTasks(newTasks) {
    try {
      const res = await this.authenticatedFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(newTasks)
      });

      const data = await res.json();

      if (!res.ok) {
        Toast.show(`❌ ${data.message || "Failed to add tasks"}`, 'error');
        console.error('Add task error:', data);
        return;
      }

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

      const tasksRes = await this.authenticatedFetch('/api/tasks');
      this.tasks = await tasksRes.json();
      this.notify();

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
    
    const originalTask = { ...this.tasks[taskIndex] };
    
    this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updatedFields, _isEditing: false };
    this.notify();

    try {
      const res = await this.authenticatedFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updatedFields)
      });
      
      if (!res.ok) {
        throw new Error('Update failed');
      }
    } catch (e) {
      console.error('Failed to update task', e);
      Toast.show("❌ Failed to save task changes. Please try again.", 'error');
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
        await this.authenticatedFetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
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
        await this.authenticatedFetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
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
        await this.authenticatedFetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
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
        await this.authenticatedFetch(`/api/tasks/${taskId}`, {
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
          this.authenticatedFetch(`/api/tasks/${t.id}`, {
            method: 'PUT',
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
          this.authenticatedFetch(`/api/tasks/${t.id}`, {
            method: 'PUT',
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
    this.currentPaste = items.map(item => ({ ...item, _isEditing: false }));
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
  }
};
