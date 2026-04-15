export const store = {
  subjects: [],
  tasks: [],
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

  async toggleTaskStatus(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      const newStatus = task.status === 'Done' ? 'Not Started' : 'Done';
      task.status = newStatus;
      this.notify();

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
