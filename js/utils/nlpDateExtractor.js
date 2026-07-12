export function extractDate(text, now = new Date()) {
  const lower = String(text || '').toLowerCase();
  const time = extractTime(lower);

  const relativeDay = matchRelativeDay(lower, now);
  if (relativeDay) return withTime(relativeDay, time);

  const inN = matchInNDaysWeeks(lower, now);
  if (inN) return withTime(inN, time);

  const weekday = matchNamedWeekday(lower, now);
  if (weekday) return withTime(weekday, time);

  const absolute = matchAbsoluteDate(lower, now);
  if (absolute) return withTime(absolute, time);

  const eop = matchEndOfPeriod(lower, now);
  if (eop) return withTime(eop, time);

  return null;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

function withTime(date, timeParts) {
  const d = new Date(date);
  if (timeParts) {
    d.setHours(timeParts.hours, timeParts.minutes, 0, 0);
  }
  return d.toISOString();
}

export function extractTime(text) {
  const lower = String(text || '').toLowerCase();

  if (/\bmidnight\b/.test(lower)) return { hours: 0, minutes: 0 };
  if (/\bnoon\b/.test(lower)) return { hours: 12, minutes: 0 };

  let m = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const meridiem = m[3];
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return { hours: h, minutes: min };
  }

  m = lower.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let h = parseInt(m[1], 10);
    const meridiem = m[2];
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return { hours: h, minutes: 0 };
  }

  return null;
}

function matchRelativeDay(lower, now) {
  if (/\btoday\b/.test(lower) || /\btonight\b/.test(lower)) return endOfDay(now);
  if (/\bday after tomorrow\b/.test(lower)) return endOfDay(addDays(now, 2));
  if (/\btomorrow\b/.test(lower)) return endOfDay(addDays(now, 1));
  if (/\byesterday\b/.test(lower)) return endOfDay(addDays(now, -1));
  return null;
}

function matchInNDaysWeeks(lower, now) {
  const m = lower.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(day|days|week|weeks|month|months)\b/);
  if (!m) return null;

  const wordMap = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const n = Number.isNaN(Number(m[1])) ? (wordMap[m[1]] || 1) : parseInt(m[1], 10);
  const unit = m[2];

  let d = new Date(now);
  if (unit.startsWith('day')) d = addDays(d, n);
  else if (unit.startsWith('week')) d = addDays(d, n * 7);
  else d.setMonth(d.getMonth() + n);

  return endOfDay(d);
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function matchNamedWeekday(lower, now) {
  const pattern = new RegExp(`\\b(next|this|on|coming)?\\s*(${WEEKDAYS.join('|')})\\b`);
  const m = lower.match(pattern);
  if (!m) return null;

  const qualifier = m[1] || '';
  const targetDay = WEEKDAYS.indexOf(m[2]);
  const currentDay = now.getDay();
  let diff = targetDay - currentDay;

  if (qualifier === 'next') diff = diff <= 0 ? diff + 7 : diff + 7;
  else if (diff <= 0 && qualifier !== 'this') diff += 7;
  else if (diff < 0) diff += 7;

  return endOfDay(addDays(now, diff));
}

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function matchAbsoluteDate(lower, now) {
  const monthNames = Object.keys(MONTHS).join('|');
  const ordinal = `(\\d{1,2})(?:st|nd|rd|th)?`;
  let m = lower.match(new RegExp(`\\b(${monthNames})\\s+${ordinal}\\b`));
  if (m) return endOfDay(resolveYear(now, MONTHS[m[1]], parseInt(m[2], 10)));

  m = lower.match(new RegExp(`\\b${ordinal}\\s+(${monthNames})\\b`));
  if (m) return endOfDay(resolveYear(now, MONTHS[m[2]], parseInt(m[1], 10)));

  m = lower.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (!m) return null;

  const first = parseInt(m[1], 10);
  const second = parseInt(m[2], 10);
  const day = first > 12 ? first : second > 12 ? second : first;
  const month = first > 12 ? second - 1 : second > 12 ? first - 1 : second - 1;
  const year = m[3]
    ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10))
    : null;

  return endOfDay(resolveYear(now, month, day, year));
}

function resolveYear(now, month, day, explicitYear = null) {
  if (explicitYear) return new Date(explicitYear, month, day);
  const candidate = new Date(now.getFullYear(), month, day);
  if (candidate < now) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
}

function matchEndOfPeriod(lower, now) {
  if (/\bend of (the\s+)?week\b/.test(lower) || /\bby (the\s+)?weekend\b/.test(lower)) {
    return endOfDay(addDays(now, 7 - now.getDay()));
  }
  if (/\bend of (the\s+)?month\b/.test(lower)) {
    return endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }
  if (/\bend of (the\s+)?year\b/.test(lower)) {
    return endOfDay(new Date(now.getFullYear(), 11, 31));
  }
  if (/\bnext month\b/.test(lower)) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return endOfDay(d);
  }
  return null;
}
