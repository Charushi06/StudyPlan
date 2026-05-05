let didCrash = false;

function renderCrashScreen(error) {
  if (didCrash) return;
  didCrash = true;

  const errorMessage = error && error.message
    ? error.message
    : 'Unexpected runtime error';

  const quote = 'We\'ll be back, keep studying, keep learning.';

  document.body.innerHTML = `
    <section class="crash-screen" role="alert" aria-live="assertive">
      <div class="crash-card">
        <p class="crash-illustration">(=^.^=)</p>
        <h1 class="crash-title">Something went wrong</h1>
        <p class="crash-copy">The planner hit a snag, but your progress is still worth it.</p>
        <p class="crash-quote">${quote}</p>
        <button class="crash-refresh" type="button" id="crash-refresh-btn">Refresh Page</button>
        <details class="crash-details">
          <summary>Technical details</summary>
          <pre>${errorMessage}</pre>
        </details>
      </div>
    </section>
  `;

  const refreshBtn = document.getElementById('crash-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

export function initGlobalErrorBoundary() {
  window.addEventListener('error', (event) => {
    event.preventDefault();
    renderCrashScreen(event.error || new Error(event.message || 'Unhandled script error'));
  });

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();

    const reason = event.reason instanceof Error
      ? event.reason
      : new Error('Unhandled promise rejection');

    renderCrashScreen(reason);
  });

  // Handy helper for manual verification in browser devtools.
  window.__studyPlanCrashTest = () => {
    throw new Error('Manual crash test triggered');
  };
}
