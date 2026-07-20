// ============================================================
// INLINE NLP FALLBACK (moved verbatim from server.js so it can be
// reused by both the text extraction route and the image extraction
// route without duplicating ~200 lines of regex heuristics)
// ============================================================

function nlpAddDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function nlpStartOf(date) {
  const d = new Date(date); d.setHours(23, 59, 0, 0); return d;
}
function nlpWithTime(dateStr, t) {
  const d = new Date(dateStr);
  if (t) d.setHours(t.hours, t.minutes, 0, 0);
  return d.toISOString();
}

function nlpExtractTime(lower) {
  if (/\bmidnight\b/.test(lower)) return { hours: 0, minutes: 0 };
  if (/\bnoon\b/.test(lower)) return { hours: 12, minutes: 0 };
  let m = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (m) {
    let h = parseInt(m[1]); const min = parseInt(m[2]); const mer = m[3];
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return { hours: h, minutes: min };
  }
  m = lower.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let h = parseInt(m[1]); const mer = m[2];
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return { hours: h, minutes: 0 };
  }
  return null;
}

const NLP_WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const NLP_MONTHS = {
  jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,
  jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,september:8,
  oct:9,october:9,nov:10,november:10,dec:11,december:11
};

function nlpResolveYear(now, month, day, explicitYear = null) {
  if (explicitYear) return new Date(explicitYear, month, day);
  const c = new Date(now.getFullYear(), month, day);
  if (c < now) c.setFullYear(c.getFullYear() + 1);
  return c;
}

function nlpExtractDate(text, now = new Date()) {
  const lower = text.toLowerCase();
  const time = nlpExtractTime(lower);

  if (/\btoday\b/.test(lower)) return nlpWithTime(nlpStartOf(now).toISOString(), time);
  if (/\btonight\b/.test(lower)) return nlpWithTime(nlpStartOf(now).toISOString(), time);
  if (/\bday after tomorrow\b/.test(lower)) return nlpWithTime(nlpStartOf(nlpAddDays(now, 2)).toISOString(), time);
  if (/\btomorrow\b/.test(lower)) return nlpWithTime(nlpStartOf(nlpAddDays(now, 1)).toISOString(), time);

  let m = lower.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(day|days|week|weeks|month|months)\b/);
  if (m) {
    const wm = { a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7 };
    const n = isNaN(m[1]) ? (wm[m[1]] || 1) : parseInt(m[1]);
    let d = new Date(now);
    if (m[2].startsWith('day')) d = nlpAddDays(d, n);
    else if (m[2].startsWith('week')) d = nlpAddDays(d, n * 7);
    else d.setMonth(d.getMonth() + n);
    return nlpWithTime(nlpStartOf(d).toISOString(), time);
  }

  const wdPattern = new RegExp(`\\b(next|this|on|coming)?\\s*(${NLP_WEEKDAYS.join('|')})\\b`);
  m = lower.match(wdPattern);
  if (m) {
    const target = NLP_WEEKDAYS.indexOf(m[2]);
    const cur = now.getDay();
    let diff = target - cur;
    if (diff <= 0) diff += 7;
    return nlpWithTime(nlpStartOf(nlpAddDays(now, diff)).toISOString(), time);
  }

  const monthNames = Object.keys(NLP_MONTHS).join('|');
  const ord = `(\\d{1,2})(?:st|nd|rd|th)?`;
  m = lower.match(new RegExp(`\\b(${monthNames})\\s+${ord}\\b`));
  if (m) return nlpWithTime(nlpStartOf(nlpResolveYear(now, NLP_MONTHS[m[1]], parseInt(m[2]))).toISOString(), time);
  m = lower.match(new RegExp(`\\b${ord}\\s+(${monthNames})\\b`));
  if (m) return nlpWithTime(nlpStartOf(nlpResolveYear(now, NLP_MONTHS[m[2]], parseInt(m[1]))).toISOString(), time);

  m = lower.match(/\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/);
  if (m) {
    const day = parseInt(m[1]), month = parseInt(m[2]) - 1;
    const yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : null;
    return nlpWithTime(nlpStartOf(nlpResolveYear(now, month, day, yr)).toISOString(), time);
  }

  if (/\bend of (the\s+)?week\b/.test(lower) || /\bby (the\s+)?weekend\b/.test(lower)) {
    const d = new Date(now); d.setDate(d.getDate() + (7 - d.getDay()));
    return nlpStartOf(d).toISOString();
  }
  if (/\bend of (the\s+)?month\b/.test(lower)) {
    return nlpStartOf(new Date(now.getFullYear(), now.getMonth() + 1, 0)).toISOString();
  }
  if (/\bend of (the\s+)?year\b/.test(lower)) {
    return nlpStartOf(new Date(now.getFullYear(), 11, 31)).toISOString();
  }
  if (/\bnext month\b/.test(lower)) {
    const d = new Date(now); d.setMonth(d.getMonth() + 1);
    return nlpStartOf(d).toISOString();
  }

  return null;
}

const NLP_SUBJECT_KEYWORDS = {
  'Computer Science': ['cs','computer science','programming','code','coding','algorithm','data structure','software','python','java','javascript','html','database','sql','network','operating system','os','web','scheduling','lab report'],
  'Mathematics': ['maths','math','mathematics','calculus','algebra','statistics','probability','theorem','equation','integral','derivative','matrix','vector','problem set','pset','worksheet','integration'],
  'English Lit': ['english','literature','essay','novel','poem','poetry','shakespeare','writing','prose','narrative','analysis','literary','book report','reading','thesis','draft','revision'],
  'Physics': ['physics','mechanics','thermodynamics','optics','velocity','acceleration','force','energy','momentum','lab','experiment','wave','circuit','resistance','voltage'],
};

function nlpDetectSubject(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [sub, kws] of Object.entries(NLP_SUBJECT_KEYWORDS)) {
    scores[sub] = 0;
    const subjectWords = sub.toLowerCase().split(/\s+/).filter(Boolean);
    if (lower.includes(sub.toLowerCase())) scores[sub] += 12;
    if (subjectWords.length > 1 && subjectWords.every(word => lower.includes(word))) scores[sub] += 8;
    for (const kw of kws) {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'gi');
      const hits = lower.match(re);
      if (hits) scores[sub] += hits.length * (kw.length > 5 ? 2 : 1);
    }
  }
  if (/\benglish\s+lit\b|\blit\s+assignment\b/.test(lower)) scores['English Lit'] += 10;
  if (/\bmaths?\b|\bmathematics\b/.test(lower)) scores['Mathematics'] += 10;
  if (/\bphysics\b/.test(lower)) scores['Physics'] += 10;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}

const NLP_TASK_VERBS = ['submit','finish','complete','hand in','turn in','upload','send','write','prepare','present','review','read','study','draft','revise'];

function nlpSplitSegments(text) {
  return text.split(/[\n\r]+|(?<=\.)\s+(?=[A-Z])|\d+[.)]\s*/)
    .map(s => s.trim()).filter(s => s.length > 8);
}

function nlpTaskScore(seg) {
  const lower = seg.toLowerCase();
  let s = 0;
  for (const v of NLP_TASK_VERBS) if (lower.includes(v)) { s += 30; break; }
  const sigs = ['due','deadline','by','before','submit','tomorrow','tonight','next','today','week','month',
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
    /\d+\/\d+/, /\d{1,2}(st|nd|rd|th)/];
  for (const sig of sigs) if (sig instanceof RegExp ? sig.test(lower) : lower.includes(sig)) { s += 25; break; }
  if (seg.length > 15 && seg.length < 300) s += 15;
  if (nlpDetectSubject(seg)) s += 20;
  const fillers = ['hi ','hello','hey ','dear ','regards','thanks','sincerely'];
  for (const f of fillers) if (lower.startsWith(f)) { s -= 40; break; }
  return Math.max(0, Math.min(100, s));
}

function nlpCleanTitle(seg) {
  const labelMatch = seg.match(/#[\w-]+/g);
  let cleaned = seg
    .replace(/^(please|kindly|remember to|don't forget to|make sure to)\s+/i, '')
    .replace(/\s+(by|before|due|on|at)\s+.*/i, '')
    .trim().substring(0, 80);

  if (labelMatch) {
    // Re-append labels so frontend can still extract them
    labelMatch.forEach(l => {
      if (!cleaned.includes(l)) {
        cleaned += ' ' + l;
      }
    });
  }
  return cleaned;
}

function nlpFallbackDate() {
  const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

function nlpExtractTasksFromText(text) {
  const now = new Date();
  const segs = nlpSplitSegments(text);
  const results = [];
  const seen = new Set();

  for (const seg of segs) {
    if (nlpTaskScore(seg) < 30) continue;
    const due_at = nlpExtractDate(seg, now) || nlpFallbackDate();
    const subjectName = nlpDetectSubject(seg);
    const rawTitle = nlpCleanTitle(seg);
    if (!rawTitle || rawTitle.length < 4) continue;
    const key = rawTitle.toLowerCase().substring(0, 20);
    if (seen.has(key)) continue;
    seen.add(key);
    const confidence = Math.min(95, nlpTaskScore(seg) + (nlpExtractDate(seg, now) ? 10 : 0) + (subjectName ? 10 : 0));
    results.push({
      title: rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1),
      subject_name: subjectName || 'General',
      due_at,
      notes: 'Extracted by heuristic NLP parser.',
      icon: { 'Computer Science':'💻','Mathematics':'📐','English Lit':'📖','Physics':'⚗️' }[subjectName] || '📚',
      confidence_score: confidence,
      priority: confidence > 70 ? 'high' : 'medium',
    });
  }

  if (results.length === 0 && text.trim().length > 5) {
    results.push({
      title: text.trim().substring(0, 60),
      subject_name: 'General',
      due_at: nlpFallbackDate(),
      notes: 'Could not parse details — please edit manually.',
      icon: '❓',
      confidence_score: 30,
      priority: 'medium',
    });
  }

  return results.slice(0, 10);
}

module.exports = { nlpExtractTasksFromText };
