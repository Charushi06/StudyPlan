import { store } from './store.js';
import { initGlobalErrorBoundary } from './utils/errorBoundary.js';

initGlobalErrorBoundary();

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  return diffDays + 'd ago';
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
      if (!t.due_at) return false;
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
    if (!t.due_at) return null;
    const d = new Date(t.due_at);
    d.setHours(0, 0, 0, 0);
    return d.toDateString();
  }).filter(d => d);
  
  const uniqueDates = [...new Set(allDates)].sort();
  let bestStreak = 0;
  let currentStreak = 1;
  
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i-1]);
    const curr = new Date(uniqueDates[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      currentStreak++;
    } else {
      bestStreak = Math.max(bestStreak, currentStreak);
      currentStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, currentStreak);
  
  return { current: streak, best: bestStreak };
}

function updateDashboard() {
  const tasks = store.tasks;
  const subjects = store.subjects;
  
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
  
  const totalTasksElem = document.getElementById('total-tasks');
  const completedTasksElem = document.getElementById('completed-tasks');
  const pendingTasksElem = document.getElementById('pending-tasks');
  const dueTasksElem = document.getElementById('due-tasks');
  
  if (totalTasksElem) totalTasksElem.textContent = totalThisWeek;
  if (completedTasksElem) completedTasksElem.textContent = completedThisWeek;
  if (pendingTasksElem) pendingTasksElem.textContent = totalThisWeek - completedThisWeek;
  if (dueTasksElem) dueTasksElem.textContent = dueSoonTasks;
  
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
        el.addEventListener('click', () => {
          window.location.href = '/index.html';
        });
      });
    }
  }
  
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
        let dateClass = '';
        let dateText = formatDate(task.due_at);
        if (daysDiff === 0) dateText = 'Today';
        else if (daysDiff === 1) dateText = 'Tomorrow';
        else if (daysDiff <= 3) dateClass = 'deadline-date';
        return `
          <div class="deadline-item" data-id="${task.id}">
            <span class="deadline-name">${escapeHtml(task.title)}</span>
            <span class="${dateClass}">${dateText}</span>
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
        const statusClass = task.status === 'Done' ? 'recent-text' : 'recent-text';
        const date = new Date(task.due_at || task.created_at || Date.now());
        const timeAgo = getTimeAgo(date);
        const sub = subjects.find(s => s.id === task.subject_id) || subjects[0];
        return `
          <div class="recent-item" data-id="${task.id}">
            <div class="recent-icon">${statusIcon}</div>
            <div class="recent-text">${escapeHtml(task.title)}</div>
            <div class="recent-time">${timeAgo}</div>
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
  
  const streak = calculateStreak(tasks);
  const streakElem = document.getElementById('streak-days');
  const streakBarElem = document.getElementById('streak-bar');
  const streakBestElem = document.getElementById('streak-best');
  
  if (streakElem) streakElem.textContent = streak.current;
  if (streakBarElem) {
    const percent = streak.best > 0 ? (streak.current / streak.best) * 100 : 0;
    streakBarElem.style.width = percent + '%';
  }
  if (streakBestElem) streakBestElem.textContent = 'Best: ' + streak.best + ' days';
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

function setDate() {
  const dateElem = document.getElementById('date-text');
  if (dateElem) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElem.textContent = now.toLocaleDateString('en-US', options);
  }
}

setDate();