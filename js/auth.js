/* ============================================================
   Auth Guard + Utilities (used by signin.html / signup.html)
   ============================================================ */

const USER_KEY = 'studyplan_user';

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setUser(data) {
  localStorage.setItem(USER_KEY, JSON.stringify(data));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getUser();
}

/* Redirect if not logged in — call on dashboard pages */
export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/signin.html';
    return false;
  }
  return true;
}

/* Redirect if already logged in — call on auth pages */
export function redirectIfAuth() {
  if (isAuthenticated()) {
    window.location.href = '/';
    return true;
  }
  return false;
}

/* Used by auth forms */
export async function doSignIn(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign in failed');
  setUser({ email: data.email, id: data.id });
  return data;
}

export async function doSignUp(email, password) {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign up failed');
  setUser({ email: data.email, id: data.id });
  return data;
}

export function doLogout() {
  clearUser();
  window.location.href = '/signin.html';
}

/* Apply saved theme before paint (no flash) */
export function applyTheme() {
  const saved = localStorage.getItem('studyplan_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
