/* ============================================================
   UI Utilities — Modals, Theme Toggle, Mobile Sidebar
   ============================================================ */

import { applyTheme } from './auth.js';

/* --- Theme --- */
let _currentTheme = 'light';

export function initTheme() {
  _currentTheme = applyTheme();
  syncThemeIcons();
}

export function toggleTheme() {
  _currentTheme = _currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', _currentTheme);
  localStorage.setItem('studyplan_theme', _currentTheme);
  syncThemeIcons();
}

function syncThemeIcons() {
  const sunIcon  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  const moonIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.innerHTML = _currentTheme === 'dark' ? sunIcon : moonIcon;
    btn.setAttribute('aria-label', _currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  });
  // Sync settings checkbox if exists
  const cb = document.getElementById('settings-dark-mode');
  if (cb) cb.checked = (_currentTheme === 'dark');
}

/* --- Mobile Sidebar --- */
export function initMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const menuBtn = document.querySelector('.topbar-menu-btn');
  if (!sidebar || !overlay || !menuBtn) return;

  menuBtn.addEventListener('click', () => openSidebar());
  overlay.addEventListener('click', () => closeSidebar());

  // Close sidebar on nav item click (mobile)
  sidebar.querySelectorAll('[data-nav]').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

export function openSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar?.classList.add('open');
  overlay?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

export function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('show');
  document.body.style.overflow = '';
}

/* --- Modal Helpers --- */
export function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  // Focus first input
  const first = m.querySelector('input, textarea, button');
  