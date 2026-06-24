/**
 * Custom modern toast notifications for StudyPlan
 */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class ToastManager {
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;

    let icon = '';
    if (type === 'success') icon = '\u2705';
    else if (type === 'error') icon = '\u274c';
    else if (type === 'warning') icon = '\u26a0';
    else icon = '\u2139\uFE0F';

    let cleanMessage = message;
    if (/^[\u2705\u274c\u26a0]/.test(message)) {
      icon = message.charAt(0);
      cleanMessage = message.substring(1).trim();
    }

    toast.innerHTML = `
      <div class="toast-icon">${escapeHtml(icon)}</div>
      <div class="toast-message">${escapeHtml(cleanMessage)}</div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    this.container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.closeToast(toast);
    });

    if (duration > 0) {
      setTimeout(() => {
        this.closeToast(toast);
      }, duration);
    }
  }

  closeToast(toast) {
    if (toast.classList.contains('toast-hiding')) return;
    toast.classList.add('toast-hiding');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    });
  }

  confirm(message) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'custom-confirm-backdrop';
      backdrop.setAttribute('role', 'presentation');

      const modal = document.createElement('div');
      modal.className = 'custom-confirm-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'custom-confirm-title');
      modal.setAttribute('aria-describedby', 'custom-confirm-message');

      modal.innerHTML = `
        <div class="custom-confirm-icon" aria-hidden="true">!</div>
        <div class="custom-confirm-content">
          <h3 id="custom-confirm-title">Confirm deletion</h3>
          <p id="custom-confirm-message">${escapeHtml(message)}</p>
        </div>
        <div class="custom-confirm-actions">
          <button class="btn confirm-cancel" type="button">Cancel</button>
          <button class="btn btn-primary confirm-ok" type="button">Delete</button>
        </div>
      `;

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      document.body.classList.add('confirm-open');

      const cancelBtn = backdrop.querySelector('.confirm-cancel');
      const okBtn = backdrop.querySelector('.confirm-ok');

      let isClosing = false;

      const close = (result) => {
        if (isClosing) return;
        isClosing = true;
        backdrop.classList.add('custom-confirm-closing');
        document.removeEventListener('keydown', onKeyDown);
        setTimeout(() => {
          if (backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
          document.body.classList.remove('confirm-open');
          resolve(result);
        }, 180);
      };

      function onKeyDown(e) {
        if (e.key === 'Escape') close(false);
      }

      cancelBtn.addEventListener('click', () => close(false));
      okBtn.addEventListener('click', () => close(true));

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(false);
      });

      document.addEventListener('keydown', onKeyDown);
      okBtn.focus();
    });
  }
}

export const Toast = new ToastManager();

