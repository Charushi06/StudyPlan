/** DOM helpers — escaping, modals, subject styling */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PILL_CLASSES = ['pill-blue', 'pill-green', 'pill-purple', 'pill-amber', 'pill-red'];

export function getPillClass(subject) {
  if (!subject) return 'pill-amber';
  const code = subject.short_code || subject.name || '';
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PILL_CLASSES[Math.abs(hash) % PILL_CLASSES.length];
}

export function openModal(el) {
  if (el) el.classList.add('is-open');
}

export function closeModal(el) {
  if (el) el.classList.remove('is-open');
}

export function setupModalDismiss(modal, onClose) {
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) (onClose || (() => closeModal(modal)))();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      (onClose || (() => closeModal(modal)))();
    }
  });
}

let toastTimer;

export function showToast(message, { error = false } = {}) {
  const el = document.getElementById('app-toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('toast--error', error);
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

export function formatDate(dateStr) {
  if (!dateStr) return 'No date';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
