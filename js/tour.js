const tourSteps = [
    {
        target: 'paste-input',
        title: 'Smart Paste',
        message: 'Paste any text here-emails, messages, PDFs, StudyPlan will read it for you.',
        position: 'left',
    },
    {
        target: 'extract-btn',
        title: 'Extract with AI',
        message: 'Click this button to automatically extract tasks from your pasted text.',
        position: 'left',   
    },
    {
        target: 'cal-grid',
        title: 'Your Calendar',
        message: 'Your tasks appear here. Blue dots are study sessions, red dots are deadlines.',
        position: 'bottom',
    },
    {
        target: 'subjects-sidebar-list',
        title: 'Subjects',
        message: 'Tasks are automatically sorted by subject here.',
        position: 'right',
    },
    {
        target: 'focus-mode-btn',
        title: 'Focus Mode',
        message: 'Use this to focus on one task at a time with a built-in timer.',
        position: 'right',
    },
];

function createTourOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'tour-overlay';
    document.body.appendChild(overlay);
    return overlay;
}

function createTourPopup() { 
  const popup = document.createElement('div');
  popup.id = 'tour-popup';
  popup.innerHTML = `
    <div id="tour-step-indicator"></div>
    <h3 id="tour-title"></h3>
    <p id="tour-message"></p>
    <div class="tour-buttons">
      <button id="tour-skip">Skip Tour</button>
      <button id="tour-next">Next →</button>
    </div>
  `;
  document.body.appendChild(popup);
  return popup;
}
function showStep(index, popup) {
  const step = tourSteps[index];
  const target = document.getElementById(step.target);

  if (!target) {
    nextStep(index + 1, popup);
    return;
  }

  const rect = target.getBoundingClientRect();

  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-message').textContent = step.message;
  document.getElementById('tour-step-indicator').textContent = `Step ${index + 1} of ${tourSteps.length}`;

  const popupEl = document.getElementById('tour-popup');

  if (step.position === 'left') {
    popupEl.style.top = (rect.top + window.scrollY) + 'px';
    popupEl.style.left = (rect.left - 320) + 'px';
  } else if (step.position === 'right') {
    popupEl.style.top = (rect.top + window.scrollY) + 'px';
    popupEl.style.left = (rect.right + 16) + 'px';
  } else {
    popupEl.style.top = (rect.bottom + window.scrollY + 10) + 'px';
    popupEl.style.left = (rect.left) + 'px';
  }

  target.classList.add('tour-highlight');
}
function nextStep(index, popup) {
  const prev = tourSteps[index - 1];
  if (prev) {
    const prevTarget = document.getElementById(prev.target);
    if (prevTarget) prevTarget.classList.remove('tour-highlight');
  }

  if (index >= tourSteps.length) {
    endTour();
    return;
  }

  showStep(index, popup);
}

function endTour() {
  const overlay = document.getElementById('tour-overlay');
  const popup = document.getElementById('tour-popup');
  if (overlay) overlay.remove();
  if (popup) popup.remove();

  tourSteps.forEach(step => {
    const el = document.getElementById(step.target);
    if (el) el.classList.remove('tour-highlight');
  });

  const user = JSON.parse(localStorage.getItem('studyplan_user'));
const tourKey = user ? `studyplan_tour_seen_${user.email}` : 'studyplan_tour_seen';
localStorage.setItem(tourKey, 'true');
}
export function initTour() {
    const user = JSON.parse(localStorage.getItem('studyplan_user'));
const tourKey = user ? `studyplan_tour_seen_${user.email}` : 'studyplan_tour_seen';
if (localStorage.getItem(tourKey)) return;

  let currentStep = 0;

  const overlay = createTourOverlay();
  const popup = createTourPopup();

  showStep(currentStep, popup);

  document.getElementById('tour-next').addEventListener('click', () => {
    currentStep++;
    nextStep(currentStep, popup);
  });

  document.getElementById('tour-skip').addEventListener('click', () => {
    endTour();
  });
}
