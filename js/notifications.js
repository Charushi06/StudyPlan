/* ============================================================
   Toast Notification System
   ============================================================ */

const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};

const DURATIONS = {
  success: 3500,
  error:   5000,
  warning: 4500,
  info:    3500,
};

let _container = null;

function getContainer() {
  if (!_container) {
    _container = document.getElementById('toast-container');
    if (!_container) {
      _container = document.createElement('div');
      _container.id = 'toast-container';
      document.body.appendChild(_container);
    }
  }
  return _container;
}

export function toast(type, title, message = '', duration) {
  const container = getContainer();
  const ms = duration ?? DURATIONS[type] ?? 3500;

  const el = document.createElement('div');
  el.className = `toast toast-${type} animate-slide-up`;
  el.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${ICONS[type] ?? 'ℹ️'}</span>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  el.querySelector('.toast-close').addEventListener('click', () => dismiss(el));
  container.appendChild(el);

  const timer = setTimeout(() => dismiss(el), ms);
  el._timer = timer;
  return el;
}

export function dismiss(el) {
  if (!el || !el.parentNode) return;
  clearTimeout(el._timer);
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Fallback
  setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
}

// Convenience aliases
export const notify = {
  success: (title, msg, ms) => toast('success', title, msg, ms),
  error:   (title, msg, ms) => toast('error',   title, msg, ms),
  warning: (title, msg, ms) => toast('warning', title, msg, ms),
  info:    (title, msg, ms) => toast('info',    title, msg, ms),
};
