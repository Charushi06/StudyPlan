import { closeModal, openModal } from './utils/dom.js';

let isLogin = true;

function setAuthMode(login) {
  isLogin = login;
  document.getElementById('auth-title').textContent = login ? 'Welcome back' : 'Create account';
  document.getElementById('auth-subtitle').textContent = login
    ? 'Sign in to your StudyPlan account'
    : 'Start planning your studies';
  document.getElementById('auth-submit-btn').textContent = login ? 'Sign In' : 'Sign Up';
  document.getElementById('auth-toggle-text').textContent = login
    ? "Don't have an account?"
    : 'Already have an account?';
  document.getElementById('auth-toggle-btn').textContent = login ? 'Sign Up' : 'Sign In';
  document.getElementById('auth-error').classList.remove('is-visible');
}

export function initAuth() {
  const modal = document.getElementById('auth-modal');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const submitBtn = document.getElementById('auth-submit-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (localStorage.getItem('studyplan_user')) {
    closeModal(modal);
  }

  toggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(!isLogin);
  });

  submitBtn?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const errorEl = document.getElementById('auth-error');

    if (!email || !password) {
      errorEl.textContent = 'Please fill in all fields';
      errorEl.classList.add('is-visible');
      return;
    }

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'Something went wrong';
        errorEl.classList.add('is-visible');
        return;
      }

      localStorage.setItem('studyplan_user', JSON.stringify({ email: data.email }));
      closeModal(modal);
    } catch {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.classList.add('is-visible');
    }
  });

  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('studyplan_user');
    openModal(modal);
    window.location.reload();
  });
}
