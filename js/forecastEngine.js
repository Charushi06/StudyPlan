/**
 * Academic Weather Forecast — local workload analysis (no AI).
 */

const HORIZON_DAYS = 14;

const LEVEL_META = {
  calm: {
    emoji: '🌤️',
    title: 'Clear skies',
    colorVar: '--color-text-success',
    bgVar: '--color-background-success',
    borderVar: '--color-border-success',
  },
  balanced: {
    emoji: '🌥️',
    title: 'Balanced conditions',
    colorVar: '--color-text-info',
    bgVar: '--color-background-info',
    borderVar: '--color-border-info',
  },
  busy: {
    emoji: '🌦️',
    title: 'Scattered workload',
    colorVar: '--color-text-warning',
    bgVar: '--color-background-warning',
    borderVar: 'rgba(133, 79, 11, 0.25)',
  },
  intense: {
    emoji: '⚠️',
    title: 'Storm warning',
    colorVar: '--color-text-warning',
    bgVar: '--color-background-warning',
    borderVar: 'rgba(133, 79, 11, 0.35)',
  },
  critical: {
    emoji: '🔥',
    title: 'Deadline heatwave',
    colorVar: '--color-text-danger',
    bgVar: '--color-background-danger',
    borderVar: '--color-border-danger',
  },
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(isoOrDate) {
  const d = new Date(isoOrDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(isoOrDate) {
  return new Date(isoOrDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isActiveTask(task) {
  return Boolean(task?.due_at) && !task.archived && task.status !== 'Done';
}

function scoreTask(task, todayStart) {
  let score = 0;
  const due = new Date(task.due_at);
  const dueStart = startOfDay(due);

  if (dueStart < todayStart) score += 5;

  const priority = String(task.priority || 'medium').toLowerCase();
  if (priority === 'high') score += 4;
  else if (priority === 'medium') score += 2;
  else score += 1;

  return score;
}

function levelFromScore(score) {
  if (score <= 3) return 'calm';
  if (score <= 7) return 'balanced';
  if (score <= 12) return 'busy';
  if (score <= 18) return 'intense';
  return 'critical';
}

function collisionBoost(taskCount) {
  if (taskCount >= 4) return 6;
  if (taskCount === 3) return 4;
  if (taskCount === 2) return 2;
  return 0;
}

function subjectClusterBoost(tasks) {
  const subjects = new Set(tasks.map((t) => t.subject_id).filter(Boolean));
  if (subjects.size >= 3) return 2;
  if (subjects.size === 2 && tasks.length >= 3) return 1;
  return 0;
}

function buildSuggestions(level, taskCount, highCount, overdueCount) {
  const tips = [];
  if (overdueCount > 0) {
    tips.push(`Clear ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} first to reduce pressure.`);
  }
  if (taskCount >= 3) {
    tips.push('Spread deadlines across the week when possible.');
  }
  if (highCount >= 2) {
    tips.push('Block focused study time for high-priority items.');
  }
  if (level === 'calm' || level === 'balanced') {
    tips.push('Good window to get ahead on readings or notes.');
  }
  if (level === 'intense' || level === 'critical') {
    tips.push('Start the heaviest task early; split work into smaller sessions.');
  }
  return tips.slice(0, 3);
}

function buildMessage(level, displayDate, taskCount, highCount) {
  if (level === 'critical') {
    return `Deadline heatwave on ${displayDate} — ${taskCount} task${taskCount !== 1 ? 's' : ''} colliding.`;
  }
  if (level === 'intense') {
    return `Heavy academic storm approaching ${displayDate}.`;
  }
  if (level === 'busy') {
    return `${taskCount} deadlines clustered on ${displayDate}.`;
  }
  if (level === 'balanced') {
    return `Manageable workload on ${displayDate}.`;
  }
  return `Light academic weather on ${displayDate}.`;
}

function buildWeekSummary(dayForecasts, todayStart) {
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekDays = dayForecasts.filter((d) => {
    const dt = new Date(d.dateIso);
    return dt >= todayStart && dt < weekEnd;
  });

  if (weekDays.length === 0) return null;

  const totalScore = weekDays.reduce((sum, d) => sum + d.score, 0);
  const peak = weekDays.reduce((a, b) => (b.score > a.score ? b : a), weekDays[0]);
  const level = levelFromScore(Math.round(totalScore / Math.max(weekDays.length, 1)));

  let title = '🌤️ Balanced week ahead';
  let message = 'Your upcoming week looks steady. Keep a consistent study rhythm.';

  if (level === 'critical' || level === 'intense') {
    title = '🔥 Deadline heatwave next week';
    message = `Peak pressure around ${peak.displayDate} — plan buffer time early in the week.`;
  } else if (level === 'busy') {
    title = '🌦️ Busy week ahead';
    message = `Several deadlines cluster mid-week; prioritize ${peak.displayDate}.`;
  }

  return {
    date: 'Next 7 days',
    dateIso: weekEnd.toISOString(),
    score: totalScore,
    level,
    title,
    message,
    suggestions: buildSuggestions(level, peak.taskCount, peak.highCount, peak.overdueCount),
    taskCount: weekDays.reduce((n, d) => n + d.taskCount, 0),
    isWeekly: true,
  };
}

/**
 * @param {Array} tasks
 * @returns {Array<{date, dateIso, score, level, title, message, suggestions, taskCount?, isWeekly?}>}
 */
export function buildAcademicForecast(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const active = list.filter(isActiveTask);

  if (active.length === 0) {
    return [];
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const horizonEnd = new Date(todayStart);
  horizonEnd.setDate(horizonEnd.getDate() + HORIZON_DAYS);

  const byDate = {};

  active.forEach((task) => {
    const due = new Date(task.due_at);
    const key = dateKey(due);
    if (!byDate[key]) {
      byDate[key] = {
        dateIso: startOfDay(due).toISOString(),
        tasks: [],
        score: 0,
        highCount: 0,
        overdueCount: 0,
      };
    }
    byDate[key].tasks.push(task);
    byDate[key].score += scoreTask(task, todayStart);
    if (String(task.priority || '').toLowerCase() === 'high') byDate[key].highCount += 1;
    if (startOfDay(due) < todayStart) byDate[key].overdueCount += 1;
  });

  const dayForecasts = Object.entries(byDate)
    .map(([key, bucket]) => {
      const taskCount = bucket.tasks.length;
      const boost = collisionBoost(taskCount) + subjectClusterBoost(bucket.tasks);
      const score = bucket.score + boost;
      const level = levelFromScore(score);
      const displayDate = formatDisplayDate(bucket.dateIso);

      const meta = LEVEL_META[level];
      let title = `${meta.emoji} ${meta.title}`;
      if (level === 'intense') title = `⚠️ Heavy academic storm approaching ${displayDate}`;
      if (level === 'critical') title = `🔥 Deadline heatwave — ${displayDate}`;

      return {
        date: displayDate,
        dateIso: bucket.dateIso,
        score,
        level,
        title,
        message: buildMessage(level, displayDate, taskCount, bucket.highCount),
        suggestions: buildSuggestions(level, taskCount, bucket.highCount, bucket.overdueCount),
        taskCount,
        highCount: bucket.highCount,
        overdueCount: bucket.overdueCount,
        key,
      };
    })
    .filter((f) => {
      const d = new Date(f.dateIso);
      return d <= horizonEnd || f.overdueCount > 0;
    })
    .sort((a, b) => b.score - a.score || new Date(a.dateIso) - new Date(b.dateIso));

  const weekCard = buildWeekSummary(dayForecasts, todayStart);
  const topDays = dayForecasts.slice(0, 5);
  const result = weekCard ? [weekCard, ...topDays] : topDays;

  const seen = new Set();
  return result.filter((card) => {
    const id = card.isWeekly ? 'week' : card.key;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 6);
}

export function getForecastLevelMeta(level) {
  return LEVEL_META[level] || LEVEL_META.balanced;
}
