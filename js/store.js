export const store = {
  subjects: [],
  tasks: [],
  summaries: {
    daily: null,
    weekly: null
  },
  currentPaste: null,
  listeners: [],
  
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
      await this.refreshSummaries();
      this.notify();
    } catch (e) {
      console.error('Failed to load initial data', e);
    }
  },

  async addTasks(newTasks) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTasks)
      });
      if (res.ok) {
        // reload tasks
        const tasksRes = await fetch('/api/tasks');
        this.tasks = await tasksRes.json();
        await this.refreshSummaries();
        this.notify();
      }
    } catch (e) {
      console.error('Failed to add tasks', e);
    }
  },

  async toggleTaskStatus(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      const newStatus = task.status === 'Done' ? 'Not Started' : 'Done';
      // optimistic update
      task.status = newStatus;
      this.notify();
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        await this.refreshSummaries();
        this.notify();
      } catch (e) {
        // revert on fail
        task.status = newStatus === 'Done' ? 'Not Started' : 'Done';
        this.notify();
      }
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

  async refreshSummaries() {
    try {
      const { fetchSummary } = await import('./utils/api.js');
      const [daily, weekly] = await Promise.all([
        fetchSummary('daily'),
        fetchSummary('weekly')
      ]);

      this.summaries.daily = daily;
      this.summaries.weekly = weekly;
    } catch (e) {
      console.error('Failed to refresh summaries', e);
    }
  }
};
