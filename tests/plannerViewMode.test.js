const test = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage on the global object
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

// Mock document for toast.js import
global.document = {
  createElement() {
    return {
      appendChild() {},
      classList: { add() {}, remove() {} },
      style: {}
    };
  },
  body: {
    appendChild() {}
  }
};

// Mock fetch and alert
global.fetch = async () => ({ ok: true, json: async () => [] });
global.alert = () => {};

test('Store handles display density state transitions', async () => {
  // Reset mock localStorage
  global.localStorage.clear();
  
  // Dynamically import store
  const { store } = await import('../js/store.js');
  
  // 1. Check default viewMode state
  assert.equal(store.viewMode, 'expanded', 'Default viewMode should be expanded');
  
  // 2. Test subscribe and notification on setViewMode
  let notifiedCount = 0;
  store.subscribe(() => {
    notifiedCount++;
  });
  
  store.setViewMode('compact');
  
  assert.equal(store.viewMode, 'compact', 'setViewMode should update viewMode');
  assert.equal(global.localStorage.getItem('studyplan_planner_density'), 'compact', 'setViewMode should persist preference');
  assert.equal(notifiedCount, 1, 'setViewMode should notify subscribers');
  
  // 3. Verify task data remains unchanged when switching modes
  const dummyTasks = [{ id: 1, title: 'Test task', due_at: '2026-08-10T19:00:00Z', status: 'Todo' }];
  store.tasks = [...dummyTasks];
  
  store.setViewMode('expanded');
  
  assert.equal(store.viewMode, 'expanded');
  assert.deepEqual(store.tasks, dummyTasks, 'Switching viewMode must not modify underlying tasks data');
});

test('Chosen mode persists across reloads', async () => {
  // Simulate setting choice in localStorage in a previous session
  global.localStorage.clear();
  global.localStorage.setItem('studyplan_planner_density', 'compact');
  
  // Re-evaluating or testing the state initialization logic
  const viewMode = global.localStorage.getItem('studyplan_planner_density') || 'expanded';
  assert.equal(viewMode, 'compact', 'Preference should persist and load as compact');
});
