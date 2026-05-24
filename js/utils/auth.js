const AUTH_STORAGE_KEY = 'studyplan_auth';

function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveAuth(data) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

function generateLocalCredentials() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return {
    email: `local-${id}@local.studyplan`,
    password: `local-${id}-${Math.random().toString(36).slice(2)}`
  };
}

let authToken = null;
let authPromise = null;

export async function ensureAuthSession(forceRefresh = false) {
  if (authToken && !forceRefresh) return authToken;
  if (authPromise && !forceRefresh) return authPromise;

  authPromise = (async () => {
    const stored = loadAuth();
    let { email, password, token } = stored;

    if (token && !forceRefresh) {
      authToken = token;
      return token;
    }

    if (!email || !password) {
      const creds = generateLocalCredentials();
      email = creds.email;
      password = creds.password;
    }

    const payload = JSON.stringify({ email, password });

    let res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    if (!res.ok) {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      if (!signupRes.ok) {
        const err = await signupRes.json().catch(() => ({}));
        throw new Error(err.error || 'Signup failed');
      }

      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    authToken = data.token;
    saveAuth({ email, password, token: data.token });
    return authToken;
  })();

  try {
    return await authPromise;
  } finally {
    authPromise = null;
  }
}

export async function authFetch(url, options = {}) {
  const token = await ensureAuthSession();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    authToken = null;
    const stored = loadAuth();
    saveAuth({ email: stored.email, password: stored.password, token: null });

    const nextToken = await ensureAuthSession(true);
    const retryHeaders = { ...(options.headers || {}), Authorization: `Bearer ${nextToken}` };
    res = await fetch(url, { ...options, headers: retryHeaders });
  }

  return res;
}
