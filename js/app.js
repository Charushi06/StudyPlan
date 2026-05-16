import { store } from './store.js';
import { extractTasksFromText } from './utils/api.js';

let currentMonthDate = new Date();
let selectedDate = null;

const tasksSection = document.getElementById('tasks-section');
const extractPreview = document.getElementById('extract-preview');
const pasteInput = document.getElementById('paste-input');

const extractBtn = document.getElementById('extract-btn');
const clearBtn = document.getElementById('clear-btn');
const addItemsBtn = document.getElementById('add-btn');

const downloadBtn = document.getElementById('download-btn') || null;

/* =====================================================
   UTIL
===================================================== */

function formatDate(dateStr) {
  if (!dateStr) return 'No Date';

  const d = new Date(dateStr);

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/* =====================================================
   BUTTON MICRO INTERACTIONS
===================================================== */

function applyButtonAnimations() {
  document.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.animated) return;

    btn.dataset.animated = "true";

    btn.style.transition = 'transform 0.15s ease';

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.95)';
    });

    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'scale(1.05)';
    });
  });
}

/* =====================================================
   DOWNLOAD CSV
===================================================== */

async function downloadData() {
  try {
    const response = await fetch('/api/download');

    if (!response.ok) {
      throw new Error('Failed to download data');
    }

    const blob = await response.blob();

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;
    a.download = 'study_data.csv';

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

  } catch (error) {
    console.error(error);
    alert('Failed to download data');
  }
}

/* =====================================================
   CALENDAR
===================================================== */

function renderCalendar() {
  const calTitle = document.getElementById('cal-month-title');
  const calGrid = document.getElementById('cal-grid');

  if (!calGrid) return;

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  calTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDayRaw = new Date(year, month, 1).getDay();

  const firstDay = firstDayRaw === 0
    ? 6
    : firstDayRaw - 1;

  const daysInMonth =
    new Date(year, month + 1, 0).getDate();

  const prevMonthDays =
    new Date(year, month, 0).getDate();

  const today = new Date();

  let html = `
    <div class="cal-day-label">Mo</div>
    <div class="cal-day-label">Tu</div>
    <div class="cal-day-label">We</div>
    <div class="cal-day-label">Th</div>
    <div class="cal-day-label">Fr</div>
    <div class="cal-day-label">Sa</div>
    <div class="cal-day-label">Su</div>
  `;

  /* PREVIOUS MONTH */

  for (let i = 0; i < firstDay; i++) {
    html += `
      <div class="cal-day muted">
        ${prevMonthDays - firstDay + i + 1}
      </div>
    `;
  }

  /* CURRENT MONTH */

  for (let i = 1; i <= daysInMonth; i++) {

    const isToday =
      i === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    const isSelected =
      selectedDate &&
      i === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear();

    const dayTasks = store.tasks.filter(task => {
      if (!task.due_at || task.status === 'Done') {
        return false;
      }

      const d = new Date(task.due_at);

      return (
        d.getDate() === i &&
        d.getMonth() === month &&
        d.getFullYear() === year
      );
    });

    let indicators = '';

    if (dayTasks.length) {
      indicators = `<div class="cal-day-indicators">`;

      dayTasks.slice(0, 3).forEach(task => {
        const sub = store.subjects.find(
          s => s.id === task.subject_id
        );

        indicators += `
          <div
            class="cal-day-indicator"
            style="background:${sub?.color || 'red'}">
          </div>
        `;
      });

      indicators += `</div>`;
    }

    html += `
      <div
        class="cal-day interactive-day
        ${isToday ? 'today' : ''}
        ${isSelected ? 'selected' : ''}"
        data-day="${i}">

        <span class="day-number">${i}</span>

        ${indicators}
      </div>
    `;
  }

  /* NEXT MONTH */

  const totalCells = firstDay + daysInMonth;

  const nextDays =
    (7 - (totalCells % 7)) % 7;

  for (let i = 1; i <= nextDays; i++) {
    html += `
      <div class="cal-day muted">
        ${i}
      </div>
    `;
  }

  calGrid.innerHTML = html;

  /* CLICK HANDLERS */

  document.querySelectorAll('.interactive-day')
    .forEach(el => {

      el.addEventListener('click', (e) => {

        const day = parseInt(
          e.currentTarget.dataset.day
        );

        const clickedDate =
          new Date(year, month, day);

        if (
          selectedDate &&
          clickedDate.getTime() ===
          selectedDate.getTime()
        ) {
          selectedDate = null;
        } else {
          selectedDate = clickedDate;
        }

        renderCalendar();
        renderTasks();
      });
    });
}

/* =====================================================
   TASKS
===================================================== */

function renderTasks() {

  if (!tasksSection) return;

  let filteredTasks = [...store.tasks];

  if (selectedDate) {
    filteredTasks = filteredTasks.filter(task => {

      if (!task.due_at) return false;

      const d = new Date(task.due_at);

      return (
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear()
      );
    });
  }

  if (!filteredTasks.length) {
    tasksSection.innerHTML = `
      <div class="empty-state">
        No tasks found
      </div>
    `;
    return;
  }

  tasksSection.innerHTML = filteredTasks.map(task => {

    const subject = store.subjects.find(
      s => s.id === task.subject_id
    );

    return `
      <div class="task-item">

        <div class="task-name">
          ${task.title}
        </div>

        <div class="task-meta">

          <span class="task-pill pill-blue">
            ${subject?.name || 'General'}
          </span>

          <span class="task-pill pill-amber">
            ${task.priority || 'Medium'}
          </span>

          <span class="task-pill pill-green">
            ${task.status || 'Pending'}
          </span>

          <span>
            ${formatDate(task.due_at)}
          </span>

        </div>

      </div>
    `;
  }).join('');
}

/* =====================================================
   EXTRACTION PREVIEW
===================================================== */

function renderExtraction() {

  if (!extractPreview) return;

  if (
    !store.currentPaste ||
    !store.currentPaste.length
  ) {
    extractPreview.innerHTML = '';
    addItemsBtn.disabled = true;
    return;
  }

  addItemsBtn.disabled = false;

  extractPreview.innerHTML =
    store.currentPaste.map(item => {

      return `
        <div class="extract-card">

          <div class="extract-task-name">
            ${item.title}
          </div>

          <div class="task-meta">

            <span class="task-pill pill-purple">
              ${item.subject || 'General'}
            </span>

            <span class="task-pill pill-red">
              ${item.priority || 'Medium'}
            </span>

            <span>
              ${formatDate(item.due_at)}
            </span>

          </div>

        </div>
      `;
    }).join('');
}

/* =====================================================
   STORE SUBSCRIPTIONS
===================================================== */

store.subscribe(renderTasks);
store.subscribe(renderExtraction);
store.subscribe(renderCalendar);

/* =====================================================
   INIT
===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  applyButtonAnimations();

  store.fetchInitialData();

  renderCalendar();
  renderTasks();

  document.getElementById('cal-prev')
    ?.addEventListener('click', () => {

      currentMonthDate.setMonth(
        currentMonthDate.getMonth() - 1
      );

      renderCalendar();
    });

  document.getElementById('cal-next')
    ?.addEventListener('click', () => {

      currentMonthDate.setMonth(
        currentMonthDate.getMonth() + 1
      );

      renderCalendar();
    });
});

/* =====================================================
   AI EXTRACTION
===================================================== */

extractBtn?.addEventListener('click', async () => {

  const text = pasteInput.value;

  if (!text.trim()) return;

  extractBtn.innerHTML =
    '<span class="loader-spinner"></span>';

  extractBtn.disabled = true;

  try {

    const items =
      await extractTasksFromText(text);

    store.setExtracted(items);

  } catch (error) {

    console.error(error);

    alert('Failed to extract tasks');

  } finally {

    extractBtn.innerHTML =
      'Extract with AI →';

    extractBtn.disabled = false;
  }
});

clearBtn?.addEventListener('click', () => {

  pasteInput.value = '';

  store.clearExtracted();
});

addItemsBtn?.addEventListener('click', () => {

  if (store.currentPaste) {

    store.addTasks(store.currentPaste);

    store.clearExtracted();

    pasteInput.value = '';
  }
});

/* =====================================================
   DOWNLOAD BUTTON
===================================================== */

if (downloadBtn) {

  downloadBtn.addEventListener('click', () => {

    downloadData();
  });
}