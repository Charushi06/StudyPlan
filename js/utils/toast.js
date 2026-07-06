/**
 * Custom modern toast notifications for StudyPlan
 */

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
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠';
    else icon = 'ℹ️';

    // Handle messages that already have emojis at the start to avoid double icons
    let cleanMessage = message;
    if (/^[✅❌⚠]/.test(message)) {
      icon = message.charAt(0);
      cleanMessage = message.substring(1).trim();
    }

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${cleanMessage}</div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    this.container.appendChild(toast);

    // Setup close button
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.closeToast(toast);
    });

    // Auto dismiss
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
      
      const modal = document.createElement('div');
      modal.className = 'custom-confirm-modal modal-card';
      
      modal.innerHTML = `
        <h3 style="margin:0 0 12px; font-size:18px; font-weight:600;">Confirm Action</h3>
        <p style="font-size:14px; margin-bottom: 24px; color: var(--color-text-secondary); line-height: 1.5;">${message}</p>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn confirm-cancel" style="padding:6px 16px;">Cancel</button>
          <button class="btn btn-primary task-btn-danger confirm-ok" style="padding:6px 16px;">Confirm</button>
        </div>
      `;
      
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      // Animation in
      backdrop.style.animation = 'fadeIn 0.2s ease-out forwards';
      modal.style.animation = 'slideUp 0.2s ease-out forwards';

      const close = (result) => {
        backdrop.style.animation = 'fadeOut 0.2s ease-out forwards';
        modal.style.animation = 'slideDown 0.2s ease-out forwards';
        setTimeout(() => {
          if (backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
          resolve(result);
        }, 200); // match animation duration
      };

      backdrop.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
      backdrop.querySelector('.confirm-ok').addEventListener('click', () => close(true));
      
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(false);
      });
    });
  }
}

export const Toast = new ToastManager();
