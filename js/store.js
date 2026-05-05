export const store = {
  subjects: [],
  tasks: [],
  currentPaste: null,
  listeners: [],
  pollingInterval: null,
  lastUpdateTimestamp: null,

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

  // ================= UPDATED FUNCTION =================
  async addTasks(newTasks) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTasks)
      });

      const data = await res.json(); // always parse response

      if (!res.ok) {
        //  Backend error
        alert(`❌ ${data.message || "Failed to add tasks"}`);
        console.error('Add task error:', data);
        return;
      }

      // ================= USER MESSAGES =================

      if (data.duplicates?.length > 0) {
        alert(`⚠ ${data.duplicates.length} duplicate task(s) skipped`);
      }

      if (data.errors?.length > 0) {
        alert(`❌ ${data.errors.length} task(s) failed to add`);
      }

      if (
        data.inserted > 0 &&
        (data.duplicates?.length || 0) === 0 &&
        (data.errors?.length || 0) === 0
      ) {
        alert("✅ Tasks added successfully");
      }

      // ================= REFRESH =================
      const tasksRes = await fetch('/api/tasks');
      this.tasks = await tasksRes.json();
      this.notify();

    } catch (e) {
      console.error('Failed to add tasks', e);
      alert("❌ Network error. Please try again.");
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
      alert("❌ Failed to save task changes. Please try again.");
      // Revert
      this.tasks[taskIndex] = originalTask;
      this.notify();
    }
  },

  async toggleTaskStatus(taskId) {
    const task = this.tasks.find(t => String(t.id) === String(taskId));
    if (task) {
      const newStatus = task.status === 'Done' ? 'Not Started' : 'Done';
      const wasCompleted = task.status === 'Done';
      task.status = newStatus;
      this.notify();

      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });

        // Create study pattern when task is marked as Done
        if (newStatus === 'Done' && !wasCompleted) {
          await this.createStudyPattern(task);
        }
      } catch (e) {
        task.status = newStatus === 'Done' ? 'Not Started' : 'Done';
        this.notify();
      }
    }
  },

  async createStudyPattern(task) {
    try {
      const subject = this.subjects.find(s => s.id === task.subject_id);
      const patternData = {
        user_id: 'default_user',
        task_id: task.id,
        task_type: 'assignment', // Default task type
        subject_id: task.subject_id,
        completion_time: this.estimateCompletionTime(task, subject),
        difficulty_rating: this.estimateDifficulty(task, subject),
        effectiveness_rating: 4, // Default effectiveness rating
        study_session_start: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
        study_session_end: new Date().toISOString(),
        breaks_taken: 0
      };

      await fetch('/api/recommendations/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patternData)
      });

      console.log('Study pattern created for task:', task.title);
    } catch (e) {
      console.error('Failed to create study pattern:', e);
    }
  },

  estimateCompletionTime(task, subject) {
    // Simple heuristic based on task title length and subject
    const baseTime = 25; // 25 minutes base
    const titleComplexity = Math.min(task.title.length / 10, 30); // Add time based on title length
    const subjectMultiplier = {
      'Computer Science': 1.2,
      'Mathematics': 1.5,
      'English Lit': 1.0,
      'Physics': 1.3
    }[subject?.name] || 1.0;

    return Math.round(baseTime + titleComplexity) * subjectMultiplier;
  },

  estimateDifficulty(task, subject) {
    // Simple heuristic based on priority and subject
    const priorityScores = { 'low': 1, 'medium': 2, 'high': 3 };
    const baseDifficulty = priorityScores[task.priority] || 2;
    
    const subjectDifficulty = {
      'Computer Science': 3,
      'Mathematics': 4,
      'English Lit': 2,
      'Physics': 4
    }[subject?.name] || 2;

    return Math.min(5, Math.round((baseDifficulty + subjectDifficulty) / 2));
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
    const confirmed = confirm('Are you sure you want to permanently delete this task?');
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
  },

  // ================= REAL-TIME FUNCTIONALITY =================
  startRealtimeUpdates(intervalMs = 5000) {
    // Clear existing interval if any
    this.stopRealtimeUpdates();
    
    // Initial fetch
    this.fetchRealtimeData();
    
    // Set up polling
    this.pollingInterval = setInterval(() => {
      this.fetchRealtimeData();
    }, intervalMs);
    
    console.log('Real-time updates started with interval:', intervalMs);
  },

  stopRealtimeUpdates() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('Real-time updates stopped');
    }
  },

  async fetchRealtimeData() {
    try {
      const [subsRes, tasksRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/tasks')
      ]);
      
      const newSubjects = await subsRes.json();
      const newTasks = await tasksRes.json();
      
      // Check if data has changed
      const subjectsChanged = JSON.stringify(newSubjects) !== JSON.stringify(this.subjects);
      const tasksChanged = JSON.stringify(newTasks) !== JSON.stringify(this.tasks);
      
      if (subjectsChanged || tasksChanged) {
        this.subjects = newSubjects;
        this.tasks = newTasks;
        this.lastUpdateTimestamp = new Date().toISOString();
        this.notify();
        
        // Trigger real-time notifications
        if (tasksChanged) {
          this.handleTaskChanges(newTasks);
        }
      }
    } catch (e) {
      console.error('Failed to fetch realtime data:', e);
    }
  },

  handleTaskChanges(newTasks) {
    // Detect task completions, new tasks, etc.
    const oldTasks = this.tasks;
    
    // Find newly completed tasks
    const newlyCompleted = newTasks.filter(task => 
      task.status === 'Done' && 
      !oldTasks.find(oldTask => oldTask.id === task.id && oldTask.status === 'Done')
    );
    
    // Find new tasks
    const newTasksAdded = newTasks.filter(task => 
      !oldTasks.find(oldTask => oldTask.id === task.id)
    );
    
    // Show notifications
    if (newlyCompleted.length > 0) {
      this.showNotification(`🎉 ${newlyCompleted.length} task(s) completed!`, 'success');
    }
    
    if (newTasksAdded.length > 0) {
      this.showNotification(`📝 ${newTasksAdded.length} new task(s) added!`, 'info');
    }
  },

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `realtime-notification realtime-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    // Add notification styles if not already present
    if (!document.querySelector('#realtime-styles')) {
      const style = document.createElement('style');
      style.id = 'realtime-styles';
      style.textContent = `
        .realtime-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: var(--color-background-primary);
          border: 1px solid var(--color-border-secondary);
          border-radius: var(--border-radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 1000;
          animation: slideInRight 0.3s ease-out;
          max-width: 300px;
        }
        
        .realtime-notification.realtime-success {
          border-left: 4px solid var(--color-text-success);
        }
        
        .realtime-notification.realtime-info {
          border-left: 4px solid var(--color-text-info);
        }
        
        .realtime-notification.realtime-warning {
          border-left: 4px solid var(--color-text-warning);
        }
        
        .notification-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
        }
        
        .notification-message {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
        }
        
        .notification-close {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          margin-left: 12px;
          line-height: 1;
        }
        
        .notification-close:hover {
          color: var(--color-text-primary);
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Add to page and auto-remove after 5 seconds
    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  },

  // ================= CROSS-TAB SYNCHRONIZATION =================
  initCrossTabSync() {
    // Listen for storage events from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'studyplan_update') {
        // Another tab updated data, refresh this tab
        console.log('Cross-tab update detected, refreshing data...');
        this.fetchRealtimeData();
      }
    });

    // Notify other tabs when we update data
    this.subscribe(() => {
      this.notifyOtherTabs();
    });
  },

  notifyOtherTabs() {
    // Send update notification to other tabs
    localStorage.setItem('studyplan_update', JSON.stringify({
      timestamp: Date.now(),
      source: 'tab_' + Math.random().toString(36).substr(2, 9)
    }));
    
    // Clear immediately to avoid storage buildup
    setTimeout(() => {
      localStorage.removeItem('studyplan_update');
    }, 100);
  }
};
