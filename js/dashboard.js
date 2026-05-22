import { store } from './store.js';
import { initGlobalErrorBoundary } from './utils/errorBoundary.js';

initGlobalErrorBoundary();

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calculateStreak(tasks) {
  const completedTasks = tasks.filter(t => t.status === 'Done' && !t.archived);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let streak = 0;
  let currentDate = new Date(today);
  
  for (let i = 0; i < 365; i++) {
    const dateStr = currentDate.toDateString();
    const hasTaskOnDate = completedTasks.some(t => {
      const taskDate = new Date(t.due_at);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.toDateString() === dateStr;
    });
    
    if (hasTaskOnDate) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  const allDates = completedTasks.map(t => {
    const d = new Date(t.due_at);
    d.setHours(0, 0, 0, 0);
    return d.toDateString();
  });
  
  const uniqueDates = [...new Set(allDates)];
  const bestStreak = Math.max(...uniqueDates.map((_, i, arr) => {
    let streak = 1;
    let current = new Date(arr[i]);
    for (let j = i + 1; j < arr.length; j++) {
      const next = new Date(arr[j]);
      const diffDays = (next - current) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        streak++;
        current = next;
      } else {
        break;
      }
    }
    return streak;
  }), 0);
  
  return { current: streak, best: bestStreak };
}

function updateDashboard() {
  const tasks = store.tasks;
  const subjects = store.subjects;
  
  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(now.getDate() + 7);
  
  const pendingTasks = tasks.filter(t => !t.archived && t.status !== 'Done');
  const completedThisWeek = tasks.filter(t => {
    if (t.status !== 'Done') return false;
    const d = new Date(t.due_at);
    return d >= now && d <= weekFromNow;
  });
  const dueSoonTasks = pendingTasks.filter(t => {
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    const diffDays = (d - now) / (1000 * 60 * 60 * 24);
    return diffDays <= 3;
  });
  
  const totalTasksElem = document.getElementById('total-tasks');
  const completedTasksElem = document.getElementById('completed-tasks');
  const dueTasksElem = document.getElementById('due-tasks');
  
  if (totalTasksElem) totalTasksElem.textContent = pendingTasks.length;
  if (completedTasksElem) completedTasksElem.textContent = completedThisWeek.length;
  if (dueTasksElem) dueTasksElem.textContent = dueSoonTasks.length;
  
  const priorityTasks = [...pendingTasks]
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .slice(0, 4);
  
  const priorityList = document.getElementById('priority-list');
  if (priorityList) {
    if (priorityTasks.length === 0) {
      priorityList.innerHTML = '<div class="priority-placeholder">No pending tasks</div>';
    } else {
      priorityList.innerHTML = priorityTasks.map(task => {
        const sub = subjects.find(s => s.id === task.subject_id) || subjects[0];
        return `
          <div class="priority-item" data-id="${task.id}">
            <span class="priority-name">${escapeHtml(task.title)}</span>
            <span class="priority-badge" style="background:${sub?.color || '#666'}20; color:${sub?.color || '#666'}">${sub?.short_code || 'Task'}</span>
          </div>
        `;
      }).join('');
      
      document.querySelectorAll('.priority-item').forEach(el => {
        el.addEventListener('click', () => {
          window.location.href = '/index.html';
        });
      });
    }
  }
  
  const upcomingTasks = [...pendingTasks]
    .filter(t => t.due_at)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .slice(0, 5);
  
  const deadlineList = document.getElementById('deadline-list');
  if (deadlineList) {
    if (upcomingTasks.length === 0) {
      deadlineList.innerHTML = '<div class="placeholder-text">No upcoming deadlines</div>';
    } else {
      deadlineList.innerHTML = upcomingTasks.map(task => {
        const date = new Date(task.due_at);
        const daysDiff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
        let dateClass = '';
        if (daysDiff <= 2) dateClass = 'deadline-date';
        return `
          <div class="deadline-item" data-id="${task.id}">
            <span class="deadline-name">${escapeHtml(task.title)}</span>
            <span class="${dateClass}">${formatDate(task.due_at)}</span>
          </div>
        `;
      }).join('');
      
      document.querySelectorAll('.deadline-item').forEach(el => {
        el.addEventListener('click', () => {
          window.location.href = '/index.html';
        });
      });
    }
  }
  
  const streak = calculateStreak(tasks);
  const streakElem = document.getElementById('streak-days');
  const streakBarElem = document.getElementById('streak-bar');
  const streakBestElem = document.querySelector('.streak-best');
  
  if (streakElem) streakElem.textContent = streak.current;
  if (streakBarElem) {
    const percent = streak.best > 0 ? (streak.current / streak.best) * 100 : 0;
    streakBarElem.style.width = percent + '%';
  }
  if (streakBestElem) streakBestElem.textContent = `Best: ${streak.best} days`;
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

const startBtn = document.getElementById('start-planning-btn');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    window.location.href = '/index.html';
  });
}

store.subscribe(() => {
  updateDashboard();
});

store.fetchInitialData().then(() => {
  updateDashboard();
});

const greetingElem = document.querySelector('.greeting-text');
if (greetingElem) {
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  greetingElem.textContent = greeting;
}