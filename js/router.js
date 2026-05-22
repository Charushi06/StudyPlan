/* ============================================================
   Router — Lightweight Hash-Based View Switcher
   ============================================================ */

export const VIEWS = {
  DASHBOARD: 'dashboard',
  TASKS: 'tasks',
  CALENDAR: 'calendar',
  FOCUS: 'focus',
  PROFILE: 'profile',
  SETTINGS: 'settings',
  ARCHIVED: 'archived',
};

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  tasks: 'Tasks',
  calendar: 'Calendar',
  focus: 'Focus Mode',
  profile: 'Profile',
  settings: 'Settings',
  archived: 'Archived',
};

let _currentView = VIEWS.DASHBOARD;
let _onChangeCallbacks = [];

export function getCurrentView() {
  return _currentView;
}

export function onViewChange(cb) {
  _onChangeCallbacks.push(cb);
}

export function navigateTo(view) {
  if (!Object.values(VIEWS).includes(view)) return;
  _currentView = view;
  window.location.hash = view;
  _applyView(view);
  _onChangeCallbacks.forEach(cb => cb(view));
}

function _applyView(view) {
  // Update all view panels
  document.querySelectorAll('.view-panel').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  // Update nav items
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === view);
  });

  // Update topbar title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[view] || view;

  // Scroll content area to top
  const content = document.querySelector('.content-area');
  if (content) content.scrollTop = 0;
}

export function initRouter() {
  // Read initial hash
  const hash = window.location.hash.replace('#', '').replace('/', '') || VIEWS.DASHBOARD;
  const view = Object.values(VIEWS).includes(hash) ? hash : VIEWS.DASHBOARD;
  _currentView = view;
  _applyView(view);

  // Listen for hash changes (back/forward)
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#', '').replace('/', '') || VIEWS.DASHBOARD;
    const newView = Object.values(VIEWS).includes(newHash) ? newHash : VIEWS.DASHBOARD;
    if (newView !== _currentView) {
      _currentView = newView;
      _applyView(newView);
      _onChangeCallbacks.forEach(cb => cb(newView));
    }
  });
}
