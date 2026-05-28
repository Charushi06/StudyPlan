import { store } from './store.js';
import { Toast } from './utils/toast.js';

export function initPlanner() {
  const plannerNavBtn = document.getElementById('planner-nav-btn');
  const tasksView = document.getElementById('tasks-view');
  const plannerView = document.getElementById('planner-view');
  
  // Modals
  const newExamModal = document.getElementById('new-exam-modal');
  const newGoalModal = document.getElementById('new-goal-modal');
  
  // Buttons
  const addExamBtn = document.getElementById('add-exam-btn');
  const addGoalBtn = document.getElementById('add-goal-btn');
  const generateScheduleBtn = document.getElementById('generate-schedule-btn');
  
  // Toggling View
  if (plannerNavBtn) {
    plannerNavBtn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
      plannerNavBtn.classList.add('active');
      if (tasksView) tasksView.style.display = 'none';
      if (plannerView) plannerView.style.display = 'flex';
      renderPlanner();
    });
  }

  // Hide planner view on other nav clicks
  const otherNavs = ['calendar-btn', 'all-tasks-btn', 'archived-tasks-btn', 'focus-mode-btn'];
  otherNavs.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        if (tasksView) tasksView.style.display = 'block';
        if (plannerView) plannerView.style.display = 'none';
      });
    }
  });

  // Init Modals
  addExamBtn?.addEventListener('click', () => {
    populateSubjectSelect('new-exam-subject');
    newExamModal.style.display = 'flex';
  });
  
  addGoalBtn?.addEventListener('click', () => {
    populateSubjectSelect('new-goal-subject');
    newGoalModal.style.display = 'flex';
  });

  document.getElementById('new-exam-cancel')?.addEventListener('click', () => newExamModal.style.display = 'none');
  document.getElementById('new-goal-cancel')?.addEventListener('click', () => newGoalModal.style.display = 'none');

  document.getElementById('new-exam-save')?.addEventListener('click', async () => {
    const title = document.getElementById('new-exam-title').value;
    const subject_id = document.getElementById('new-exam-subject').value;
    const date = document.getElementById('new-exam-date').value;
    if (await store.addExam({ title, subject_id, date })) {
      newExamModal.style.display = 'none';
    }
  });

  document.getElementById('new-goal-save')?.addEventListener('click', async () => {
    const description = document.getElementById('new-goal-desc').value;
    const subject_id = document.getElementById('new-goal-subject').value;
    const target_date = document.getElementById('new-goal-date').value;
    if (await store.addGoal({ description, subject_id, target_date })) {
      newGoalModal.style.display = 'none';
    }
  });

  generateScheduleBtn?.addEventListener('click', async () => {
    const originalText = generateScheduleBtn.innerHTML;
    generateScheduleBtn.innerHTML = '⏳ Generating...';
    generateScheduleBtn.disabled = true;
    await store.generateSchedule();
    generateScheduleBtn.innerHTML = originalText;
    generateScheduleBtn.disabled = false;
  });

  // Pomodoro Timer
  let pomodoroInterval;
  let timeLeft = 25 * 60;
  let isRunning = false;
  
  const timeDisplay = document.getElementById('pomodoro-time');
  const startBtn = document.getElementById('pomodoro-start');
  const pauseBtn = document.getElementById('pomodoro-pause');
  const resetBtn = document.getElementById('pomodoro-reset');

  function updateDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    if (timeDisplay) timeDisplay.textContent = `${m}:${s}`;
  }

  startBtn?.addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    pomodoroInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateDisplay();
      } else {
        clearInterval(pomodoroInterval);
        isRunning = false;
        Toast.show('Pomodoro completed! Take a break.', 'success');
      }
    }, 1000);
  });

  pauseBtn?.addEventListener('click', () => {
    clearInterval(pomodoroInterval);
    isRunning = false;
  });

  resetBtn?.addEventListener('click', () => {
    clearInterval(pomodoroInterval);
    isRunning = false;
    timeLeft = 25 * 60;
    updateDisplay();
  });

  store.subscribe(renderPlanner);
}

function populateSubjectSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';
  store.subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = sub.name;
    select.appendChild(opt);
  });
}

function renderPlanner() {
  const plannerView = document.getElementById('planner-view');
  if (plannerView?.style.display === 'none') return;

  // Render Exams
  const examList = document.getElementById('exam-list');
  if (examList) {
    examList.innerHTML = store.exams.length ? store.exams.map(ex => {
      const sub = store.subjects.find(s => s.id === ex.subject_id);
      return `<div class="exam-item">
        <div class="exam-title">${escapeHtml(ex.title)}</div>
        <div class="exam-meta">${escapeHtml(sub?.name || 'General')} • ${new Date(ex.date).toLocaleDateString()}</div>
      </div>`;
    }).join('') : '<div style="color:var(--color-text-tertiary); font-size:12px;">No upcoming exams.</div>';
  }

  // Render Goals
  const goalList = document.getElementById('goal-list');
  if (goalList) {
    goalList.innerHTML = store.goals.length ? store.goals.map(g => {
      const sub = store.subjects.find(s => s.id === g.subject_id);
      return `<div class="goal-item">
        <div class="goal-title">${escapeHtml(g.description)}</div>
        <div class="goal-meta">${escapeHtml(sub?.name || 'General')} • ${new Date(g.target_date).toLocaleDateString()}</div>
      </div>`;
    }).join('') : '<div style="color:var(--color-text-tertiary); font-size:12px;">No active goals.</div>';
  }

  // Render Schedule
  const timeline = document.getElementById('schedule-timeline');
  if (timeline) {
    if (!store.studySessions || store.studySessions.length === 0) {
      timeline.innerHTML = '<div style="text-align: center; color: var(--color-text-tertiary); padding: 40px;">Click "Generate Smart Schedule" to let AI plan your studies.</div>';
    } else {
      timeline.innerHTML = store.studySessions.map(s => {
        const sub = store.subjects.find(sub => sub.id === s.subject_id);
        const subColor = sub ? sub.color : 'var(--color-text-info)';
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        const timeStr = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        
        return `<div class="session-block ${s.status === 'completed' ? 'completed' : ''}" style="border-left-color: ${subColor};">
          <div class="session-info">
            <div class="session-title">${escapeHtml(s.title)}</div>
            <div class="session-meta">
              <span>${escapeHtml(sub?.name || 'General')}</span>
              <span>•</span>
              <span>${timeStr}</span>
              <span class="session-type-badge session-type-${s.type}">${s.type}</span>
            </div>
          </div>
          <button class="btn ${s.status === 'completed' ? '' : 'btn-primary'}" onclick="window.toggleSession('${s.id}')">
            ${s.status === 'completed' ? 'Undo' : 'Complete'}
          </button>
        </div>`;
      }).join('');
    }
  }

  // Calc Streak
  const streak = store.studySessions.filter(s => s.status === 'completed').length;
  const streakEl = document.getElementById('streak-count');
  if (streakEl) streakEl.textContent = streak;
}

window.toggleSession = (id) => {
  store.toggleSessionStatus(id);
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
