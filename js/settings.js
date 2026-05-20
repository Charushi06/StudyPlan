import { closeModal, openModal, setupModalDismiss } from './utils/dom.js';

function loadPreferences() {
  const isDarkMode = localStorage.getItem('studyplan_dark_mode') === 'true';
  const isCompactView = localStorage.getItem('studyplan_compact_view') === 'true';
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const compactViewToggle = document.getElementById('compact-view-toggle');

  if (darkModeToggle) darkModeToggle.checked = isDarkMode;
  if (compactViewToggle) compactViewToggle.checked = isCompactView;

  document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  document.body.classList.toggle('compact-view', isCompactView);
}

export function initSettings() {
  const modal = document.getElementById('settings-modal');
  const navSettings = document.getElementById('nav-settings');
  const settingsClose = document.getElementById('settings-close');
  const settingsSave = document.getElementById('settings-save');
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const compactViewToggle = document.getElementById('compact-view-toggle');

  loadPreferences();

  navSettings?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(modal);
  });

  settingsClose?.addEventListener('click', () => closeModal(modal));
  setupModalDismiss(modal, () => closeModal(modal));

  settingsSave?.addEventListener('click', () => {
    localStorage.setItem('studyplan_dark_mode', darkModeToggle?.checked ?? false);
    localStorage.setItem('studyplan_compact_view', compactViewToggle?.checked ?? false);
    loadPreferences();
    closeModal(modal);
  });

  darkModeToggle?.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
  });

  compactViewToggle?.addEventListener('change', (e) => {
    document.body.classList.toggle('compact-view', e.target.checked);
  });
}
