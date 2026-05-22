import { buildAcademicForecast, getForecastLevelMeta } from './forecastEngine.js';

let sectionEl = null;
let cardsEl = null;
let lastRenderKey = '';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trendLabel(score) {
  if (score >= 18) return { text: 'Rising', className: 'forecast-trend--up' };
  if (score >= 10) return { text: 'Elevated', className: 'forecast-trend--mid' };
  return { text: 'Stable', className: 'forecast-trend--stable' };
}

function renderEmptyState() {
  return `
    <article class="forecast-card forecast-card--empty" role="listitem" aria-label="No academic pressure detected">
      <div class="forecast-card-icon" aria-hidden="true">🌤️</div>
      <div class="forecast-card-body">
        <h3 class="forecast-card-title">🌤️ No academic pressure detected</h3>
        <p class="forecast-card-message">Add tasks with due dates to see your workload forecast.</p>
      </div>
    </article>
  `;
}

function renderCard(forecast, index) {
  const meta = getForecastLevelMeta(forecast.level);
  const trend = trendLabel(forecast.score);
  const suggestions = (forecast.suggestions || [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('');

  return `
    <article
      class="forecast-card forecast-card--${escapeHtml(forecast.level)}"
      role="listitem"
      style="animation-delay: ${index * 0.06}s"
      aria-label="${escapeHtml(forecast.title)} — ${escapeHtml(forecast.date)}"
    >
      <div class="forecast-card-icon" aria-hidden="true">${meta.emoji}</div>
      <div class="forecast-card-body">
        <div class="forecast-card-top">
          <h3 class="forecast-card-title">${escapeHtml(forecast.title)}</h3>
          <span class="forecast-trend ${trend.className}" aria-label="Workload trend: ${trend.text}">${trend.text}</span>
        </div>
        <p class="forecast-card-message">${escapeHtml(forecast.message)}</p>
        <div class="forecast-card-meta">
          <span class="forecast-card-date">
            <time datetime="${escapeHtml(forecast.dateIso || '')}">${escapeHtml(forecast.date)}</time>
          </span>
          <span class="forecast-card-score" aria-label="Workload score ${forecast.score}">Score ${forecast.score}</span>
        </div>
        ${suggestions ? `<ul class="forecast-card-suggestions">${suggestions}</ul>` : ''}
      </div>
    </article>
  `;
}

/** Bind DOM refs once. */
export function initForecastUI() {
  sectionEl = document.getElementById('academic-forecast-section');
  cardsEl = document.getElementById('forecast-cards');
}

/**
 * @param {Array} tasks
 * @param {{ visible?: boolean }} options
 */
export function renderAcademicForecast(tasks, options = {}) {
  if (!sectionEl || !cardsEl) return;

  const visible = options.visible !== false;
  sectionEl.classList.toggle('hidden', !visible);
  if (!visible) return;

  const forecasts = buildAcademicForecast(tasks);
  const renderKey = JSON.stringify(
    forecasts.map((f) => [f.date, f.score, f.level, f.message])
  );

  if (renderKey === lastRenderKey) return;
  lastRenderKey = renderKey;

  try {
    if (forecasts.length === 0) {
      cardsEl.innerHTML = renderEmptyState();
      return;
    }
    cardsEl.innerHTML = forecasts.map((f, i) => renderCard(f, i)).join('');
  } catch (err) {
    console.error('Forecast render failed', err);
    cardsEl.innerHTML = renderEmptyState();
  }
}
