// Auth guard — redirect to sign in if no session exists
if (!localStorage.getItem('studyplan_user')) {
  window.location.href = '/signin.html';
}

// ─── rest of app.js below (unchanged) ───────────────────────────────────────

import { initCalendar } from './calendar.js';
import { initTasks } from './tasks.js';
import { initSmartPaste } from './smartpaste.js';
import { initFocusMode } from './focus.js';
import { initSubjects } from './subjects.js';
import { initDownload } from './download.js';

function init() {
  initCalendar();
  initTasks();
  initSmartPaste();
  initFocusMode();
  initSubjects();
  initDownload();
}

document.addEventListener('DOMContentLoaded', init);
