import { store } from './store.js';
import { initGlobalErrorBoundary } from './utils/errorBoundary.js';

initGlobalErrorBoundary();

// DOM Elements
const authModal = document.getElementById('auth-modal');
const mainWrapper = document.getElementById('main-wrapper');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authToggleText = document.getElementById('auth-toggle-text');
const authError = document.getElementById('auth-error');
const userEmailSpan = document.getElementById('user-email');
const userNameSpan = document.getElementById('user-name');

let isLogin = true;

// Check if user is already logged in
let currentUser = null;
try {
  const userData = localStorage.getItem('studyplan_user');
  currentUser = userData ? JSON.parse(userData) : null;
} catch {
  currentUser = null;
}

// If already logged in, hide auth modal and show dashboard
if (currentUser && currentUser.email) {
  authModal.style.display = 'none';
  mainWrapper.style.display = 'block';
  setUserInfo(currentUser);
}

// Auth toggle
authToggleBtn.addEventListener('click', (e) => {
  e.preventDefault();
  isLogin = !isLogin;
  authTitle.textContent = isLogin ? 'Welcome back To StudyPlan' : 'Create account';
  authSubtitle.textContent = isLogin ? 'Sign in to your StudyPlan account' : 'Start planning your studies';
  authSubmitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';
  authToggleText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  authToggleBtn.textContent = isLogin ? 'Sign Up' : 'Sign In';
  authError.style.display = 'none';
});

// Auth submit
authSubmitBtn.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    authError.textContent = 'Please fill in all fields';
    authError.style.display = 'block';
    return;
  }

  const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';

  try {
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = 'Loading...';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || 'Something went wrong';
      authError.style.display = 'block';
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';
      return;
    }

    localStorage.setItem('studyplan_user', JSON.stringify({ email: data.email || email }));
    currentUser = { email: data.email || email };
    authModal.style.display = 'none';
    mainWrapper.style.display = 'block';
    setUserInfo(currentUser);
    updateDashboard();

    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';

  } catch (err) {
    authError.textContent = 'Network error. Please try again.';
    authError.style.display = 'block';
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';
  }
});

// Enter key support for auth
authEmail.addEventListener('keydown', (e) => { if (e.key === 'Enter') authSubmitBtn.click(); });
authPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') authSubmitBtn.click(); });

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('studyplan_user');
    currentUser = null;
    mainWrapper.style.display = 'none';
    authModal.style.display = 'flex';
    authEmail.value = '';
    authPassword.value = '';
    authError.style.display = 'none';
  });
}

// Start Planning button
const startBtn = document.getElementById('start-planning-btn');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    window.location.href = '/index.html';
  });
}

// Helper functions
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function setDate() {
  const dateElem = document.getElementById('date-text');
  if (dateElem) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElem.textContent = now.toLocaleDateString('en-US', options);
  }
}

function setUserInfo(user) {
  const greetingElem = document.getElementById('greeting-text');
  const userNameElem = document.getElementById('user-name');
  const userEmailElem = document.getElementById('user-email');
  
  if (user && user.email) {
    const name = user.email.split('@')[0];
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    
    if (greetingElem) greetingElem.textContent = getGreeting();
    if (userNameElem) userNameElem.textContent = displayName;
    if (userEmailElem) userEmailElem.textContent = user.email;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getTimeAgo(date) {
  if (!date) return 'just now';
  try {
    const now = new Date();
    const diffMs = now - date;
    if (isNaN(diffMs)) return 'just now';
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    return diffDays + 'd ago';
  } catch {
    return 'just now';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateDashboard() {
  const tasks = store.tasks || [];
  const subjects = store.subjects || [];
  
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  
  const thisWeekTasks = tasks.filter(t => {
    if (t.archived) return false;
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    return d >= weekStart && d < weekEnd;
  });
  
  const totalThisWeek = thisWeekTasks.length;
  const completedThisWeek = thisWeekTasks.filter(t => t.status === 'Done').length;
  const pendingTasks = tasks.filter(t => !t.archived && t.status !== 'Done').length;
  
  const dueSoonTasks = tasks.filter(t => {
    if (t.archived || t.status === 'Done') return false;
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    const diffDays = (d - now) / (1000 * 60 * 60 * 24);
    return diffDays <= 3 && diffDays >= 0;
  }).length;
  
  document.getElementById('total-tasks').textContent = totalThisWeek;
  document.getElementById('completed-tasks').textContent = completedThisWeek;
  document.getElementById('pending-tasks').textContent = totalThisWeek - completedThisWeek;
  document.getElementById('due-tasks').textContent = dueSoonTasks;
  
  // Today's Priority
  const todayTasks = tasks.filter(t => {
    if (t.archived || t.status === 'Done') return false;
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    return d.toDateString() === now.toDateString();
  }).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  
  const priorityList = document.getElementById('priority-list');
  if (priorityList) {
    if (todayTasks.length === 0) {
      priorityList.innerHTML = '<div class="empty-state">No tasks for today</div>';
    } else {
      priorityList.innerHTML = todayTasks.slice(0, 5).map(task => {
        const sub = subjects.find(s => s.id === task.subject_id) || subjects[0];
        const timeStr = new Date(task.due_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="priority-item" data-id="${task.id}">
            <span class="priority-name">${escapeHtml(task.title)}</span>
            <span class="priority-badge" style="background:${sub?.color || '#666'}20; color:${sub?.color || '#666'}">${timeStr}</span>
          </div>
        `;
      }).join('');
      
      document.querySelectorAll('.priority-item').forEach(el => {
        el.addEventListener('click', () => window.location.href = '/index.html');
      });
    }
  }
  
  // Upcoming Deadlines
  const upcomingTasks = tasks.filter(t => {
    if (t.archived || t.status === 'Done') return false;
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    return d > now;
  }).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).slice(0, 5);
  
  const deadlineList = document.getElementById('deadline-list');
  if (deadlineList) {
    if (upcomingTasks.length === 0) {
      deadlineList.innerHTML = '<div class="empty-state">No upcoming deadlines</div>';
    } else {
      deadlineList.innerHTML = upcomingTasks.map(task => {
        const daysDiff = Math.ceil((new Date(task.due_at) - now) / (1000 * 60 * 60 * 24));
        let dateText = formatDate(task.due_at);
        if (daysDiff === 0) dateText = 'Today';
        else if (daysDiff === 1) dateText = 'Tomorrow';
        return `
          <div class="deadline-item" data-id="${task.id}">
            <span class="deadline-name">${escapeHtml(task.title)}</span>
            <span class="deadline-date">${dateText}</span>
          </div>
        `;
      }).join('');
      
      document.querySelectorAll('.deadline-item').forEach(el => {
        el.addEventListener('click', () => window.location.href = '/index.html');
      });
    }
  }
  
  // Recent Activity
  const allTasks = [...tasks].filter(t => !t.archived).sort((a, b) => {
    const dateA = new Date(a.due_at || a.created_at || 0);
    const dateB = new Date(b.due_at || b.created_at || 0);
    return dateB - dateA;
  }).slice(0, 5);
  

const recentList = document.getElementById('recent-list');
if (recentList) {
  if (allTasks.length === 0) {
    recentList.innerHTML = '<div class="empty-state">No recent activity</div>';
  } else {
    recentList.innerHTML = allTasks.map(task => {
      const statusIcon = task.status === 'Done' ? '✓' : '○';
      const statusClass = task.status === 'Done' ? 'completed' : '';
      const date = task.due_at ? new Date(task.due_at) : (task.created_at ? new Date(task.created_at) : new Date());
      const timeAgo = getTimeAgo(date);
      return `
        <div class="recent-item" data-id="${task.id}">
          <span class="recent-icon">${statusIcon}</span>
          <span class="recent-text ${statusClass}">${escapeHtml(task.title)}</span>
          <span class="recent-time">${timeAgo}</span>
        </div>
      `;
    }).join('');
    
    document.querySelectorAll('.recent-item').forEach(el => {
      el.addEventListener('click', () => {
        window.location.href = '/index.html';
      });
    });
  }
}
}

// Initialize
if (currentUser && currentUser.email) {
  setUserInfo(currentUser);
  setDate();
  
  store.subscribe(() => {
    updateDashboard();
  });
  
  store.fetchInitialData().then(() => {
    updateDashboard();
  });
}

setInterval(() => {
  setDate();
  const greetingElem = document.getElementById('greeting-text');
  if (greetingElem && currentUser) greetingElem.textContent = getGreeting();
}, 60000);