/**
 * auth.js
 * Shared authentication utilities for StudyPlan.
 * Handles auth state checks, logout, and session helpers.
 * Used by signin.html, signup.html, and index.html.
 */

(function () {
  'use strict';

  const AUTH_KEY = 'studyplan_user';

  /**
   * Returns the current user object from storage, or null.
   */
  function getUser() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clears the auth session and redirects to sign in.
   */
  function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = '/signin.html';
  }

  /**
   * Auth guard — call on the dashboard page.
   * Redirects unauthenticated users to /signin.html.
   */
  function requireAuth() {
    if (!getUser()) {
      window.location.href = '/signin.html';
    }
  }

  // Attach logout handler if the logout button exists on this page
  document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logout();
      });
    }
  });

  // Expose to global scope for use in inline scripts
  window.StudyPlanAuth = {
    getUser,
    logout,
    requireAuth
  };
})();
