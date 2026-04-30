export function extractDate(text, now = new Date()) {
  const lower = text.toLowerCase();

  const relativeDay = matchRelativeDay(lower, now);
  if (relativeDay) return withTime(relativeDay, extractTime(lower));

  const inN = matchInNDaysWeeks(lower, now);
  if (inN) return withTime(inN, extractTime(lower));

  const weekday = matchNamedWeekday(lower, now);
  if (weekday) return withTime(weekday, extractTime(lower));

  const absolute = matchAbsoluteDate(lower, now);
  if (absolute) return withTime(absolute, extractTime(lower));

  const eop = matchEndOfPeriod(lower, now);
  if (eop) return withTime(eop, extractTime(lower));

  return null;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOf(date) {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0); 
  return d;
}

function toISO(date) {
  return date.toISOString();
}

function withTime(dateStr, timeParts) {
  const d = new Date(dateStr);
  if (timeParts) {
    d.setHours(timeParts.hours, timeParts.minutes, 0, 0);
  }
  return toISO(d);
}

export function extractTime(text) {
  const lower = text.toLowerCase();

  if (/\bmidnight\b/.test(lower)) return { hours: 23, minutes: 59 };
  if (/\bnoon\b/.test(lower)) return { hours: 12, minutes: 0 };

  // HH:MM am/pm
  let m = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (m) {
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const meridiem = m[3];
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return { hours: h, minutes: min };
  }

  m = lower.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let h = parseInt(m[1]);
    const meridiem = m[2];
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return { hours: h, minutes: 0 };
  }

  return null;
}

function matchRelativeDay(lower, now) {
  if (/\btoday\b/.test(lower)) return toISO(startOf(now));
  if (/\btomorrow\b/.test(lower)) return toISO(startOf(addDays(now, 1)));
  if (/\bday after tomorrow\b/.test(lower)) return toISO(startOf(addDays(now, 2)));
  if (/\byesterday\b/.test(lower)) return toISO(startOf(addDays(now, -1))); // edge case
  return null;
}

function matchInNDaysWeeks(lower, now) {
  let m = lower.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(day|days|week|weeks|month|months)\b/);
  if (!m) return null;

  const rawN = m[1];
  const unit = m[2];
  const wordMap = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const n = isNaN(rawN) ? (wordMap[rawN] || 1) : parseInt(rawN);

  let d = new Date(now);
  if (unit.startsWith('day')) d = addDays(d, n);
  else if (unit.startsWith('week')) d = addDays(d, n * 7);
  else if (unit.startsWith('month')) d.setMonth(d.getMonth() + n);

  return toISO(startOf(d));
}
const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function matchNamedWeekday(lower, now) {
  const pattern = new RegExp(
    `\\b(next|this|on|coming)?\\s*(${WEEKDAYS.join('|')})\\b`
  );
  const m = lower.match(pattern);
  if (!m) return null;

  const qualifier = m[1] || '';
  const targetDay = WEEKDAYS.indexOf(m[2]);
  const currentDay = now.getDay();

  let diff = targetDay - currentDay;

  if (qualifier === 'next') {
    // Always go to NEXT week's instance
    if (diff <= 0) diff += 7;
    diff += (diff === 0 ? 7 : 0); // if same day, also push a week
  } else if (qualifier === 'this') {
    // This week — if already passed, stay same
    if (diff < 0) diff += 7;
  } else {
    // No qualifier: if day already passed today, go to next week
    if (diff <= 0) diff += 7;
  }

  return toISO(startOf(addDays(now, diff)));
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
  // "april 25", "25 april", "25th april", "april 25th"
  const monthNames = Object.keys(MONTHS).join('|');
  const ordinal = `(\\d{1,2})(?:st|nd|rd|th)?`;

  let m;

  m = lower.match(new RegExp(`\\b(${monthNames})\\s+${ordinal}\\b`));
  if (m) {
    const month = MONTHS[m[1]];
    const day = parseInt(m[2]);
    return toISO(startOf(resolveYear(now, month, day)));
  }

  m = lower.match(new RegExp(`\\b${ordinal}\\s+(${monthNames})\\b`));
  if (m) {
    const day = parseInt(m[1]);
    const month = MONTHS[m[2]];
    return toISO(startOf(resolveYear(now, month, day)));
  }

  m = lower.match(/\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : null;
    return toISO(startOf(resolveYear(now, month, day, year)));
  }

  return null;
}

function resolveYear(now, month, day, explicitYear = null) {
  if (explicitYear) return new Date(explicitYear, month, day);
  const candidate = new Date(now.getFullYear(), month, day);
  if (candidate < now) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
}

function matchEndOfPeriod(lower, now) {
  if (/\bend of (the\s+)?week\b/.test(lower) || /\bby (the\s+)?weekend\b/.test(lower)) {
    // Next Sunday
    const d = new Date(now);
    d.setDate(d.getDate() + (7 - d.getDay()));
    return toISO(startOf(d));
  }
  if (/\bend of (the\s+)?month\b/.test(lower)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
    return toISO(startOf(d));
  }
  if (/\bend of (the\s+)?year\b/.test(lower)) {
    const d = new Date(now.getFullYear(), 11, 31);
    return toISO(startOf(d));
  }
  if (/\bnext month\b/.test(lower)) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return toISO(startOf(d));
  }
  return null;
}