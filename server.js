require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const csvDownloadRouter = require('./backend/routers/csvDownload.router.js');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

initDb();

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// ============================================================
// INLINE NLP FALLBACK
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
  if (/\bmidnight\b/.test(lower)) return { hours: 23, minutes: 59 };
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
  if (/\bnext month\b/.test(lower)) {
    const d = new Date(now); d.setMonth(d.getMonth() + 1);
    return nlpStartOf(d).toISOString();
  }

  return null;
}

const NLP_SUBJECT_KEYWORDS = {
  'Computer Science': ['cs','computer science','programming','code','coding','algorithm','data structure','software','python','java','javascript','html','database','sql','network','operating system','os','web','scheduling','lab report','assignment'],
  'Mathematics': ['maths','math','mathematics','calculus','algebra','statistics','probability','theorem','equation','integral','derivative','matrix','vector','problem set','pset','worksheet','integration'],
  'English Lit': ['english','literature','essay','novel','poem','poetry','shakespeare','writing','prose','narrative','analysis','literary','book report','reading','thesis','draft','revision'],
  'Physics': ['physics','mechanics','thermodynamics','optics','velocity','acceleration','force','energy','momentum','lab','experiment','wave','circuit','resistance','voltage'],
};

function nlpDetectSubject(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [sub, kws] of Object.entries(NLP_SUBJECT_KEYWORDS)) {
    scores[sub] = 0;
    for (const kw of kws) {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'gi');
      const hits = lower.match(re);
      if (hits) scores[sub] += hits.length * (kw.length > 5 ? 2 : 1);
    }
  }
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
  const sigs = ['due','deadline','by','before','submit','tomorrow','next','today','week','month',
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
  return seg
    .replace(/^(please|kindly|remember to|don't forget to|make sure to)\s+/i, '')
    .replace(/\s+(by|before|due|on|at)\s+.*/i, '')
    .trim().substring(0, 80);
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

// ============================================================

// ============== CSV Download Router ==============
app.use('/api', csvDownloadRouter);

// ================= SUBJECTS =================
app.get('/api/subjects', (req, res) => {
  db.all('SELECT * FROM subjects', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================= TASKS =================
app.get('/api/tasks', (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY due_at ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================= ADD TASKS =================
app.post('/api/tasks', (req, res) => {
  try {
    const tasks = Array.isArray(req.body) ? req.body : [req.body];

    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ success: false, message: "No tasks provided" });
    }

    let inserted = 0;
    let duplicates = [];
    let errors = [];

    const stmt = db.prepare(`INSERT INTO tasks 
      (id, subject_id, title, due_at, status, priority, confidence_score, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    let pending = tasks.length;

    tasks.forEach(t => {
      if (!t.title || !t.due_at || !t.subject_id) {
        errors.push({ task: t, error: "Missing title, subject or due date" });
        pending--;
        if (pending === 0) {
          stmt.finalize(() => res.status(400).json({ success: false, inserted, duplicates, errors, message: "All tasks invalid" }));
        }
        return;
      }

      db.get(
        `SELECT * FROM tasks WHERE LOWER(title) = LOWER(?) AND subject_id = ? AND DATE(due_at) = DATE(?)`,
        [t.title, t.subject_id, t.due_at],
        (err, existing) => {
          if (err) {
            errors.push({ task: t, error: err.message });
          } else if (existing) {
            duplicates.push({
              title: t.title,
              due_at: t.due_at,
              subject_id: t.subject_id
            });
          } else {
            const id = 'task_' + Date.now() + Math.random().toString(36).substr(2, 5);
            stmt.run(
              id,
              t.subject_id,
              t.title,
              t.due_at,
              t.status || 'Not Started',
              t.priority || 'medium',
              t.confidence_score || 100,
              t.notes || '',
              function (insertErr) {
                if (insertErr) {
                  errors.push({ task: t, error: insertErr.message });
                } else {
                  inserted++;
                }
              }
            );
          }

          pending--;
          if (pending === 0) {
            stmt.finalize((finalErr) => {
              if (finalErr) return res.status(500).json({ success: false, message: "Database error", error: finalErr.message });
              return res.json({
                success: true,
                inserted,
                duplicates,
                errors,
                message:
                  errors.length > 0 && duplicates.length > 0
                    ? "Some tasks failed and some duplicates were skipped"
                    : errors.length > 0
                      ? "Some tasks failed to add"
                      : duplicates.length > 0
                        ? "Duplicate tasks were skipped"
                        : "All tasks added successfully"
              });
            });
          }
        }
      );
    });

  } catch (e) {
    return res.status(500).json({ success: false, message: "Unexpected server error", error: e.message });
  }
});

// ================= UPDATE =================
app.put('/api/tasks/:id', (req, res) => {
  const { status, archived } = req.body;

  let query = 'UPDATE tasks SET ';
  const params = [];

  if (status !== undefined) {
    query += 'status = ? ';
    params.push(status);
  }

  if (archived !== undefined) {
    if (params.length > 0) query += ', ';
    query += 'archived = ? ';
    params.push(archived);
  }

  if (params.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  query += 'WHERE id = ?';
  params.push(req.params.id);

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// ================= DELETE =================
app.delete('/api/tasks/:id', (req, res) => {
  db.run(
    'DELETE FROM tasks WHERE id = ?',
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
});

// ================= AI EXTRACTION =================
app.post('/api/extract', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  if (ai) {
    try {
      const prompt = `
You are an AI study planner assistant. Extract ALL tasks and deadlines from the text below.
Return ONLY a raw JSON array (no markdown, no backticks, no explanation).
Each object must have: title (string), subject_name (string), due_at (ISO 8601 datetime), notes (string), confidence_score (number 0-100), priority ("low"|"medium"|"high"), icon (emoji).

Text: "${text}"
`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let rawText = (typeof response.text === 'function' ? response.text() : response.text).trim();
      if (rawText.startsWith('```')) rawText = rawText.replace(/```json|```/g, '').trim();

      const data = JSON.parse(rawText);
      return res.json(data);

    } catch (e) {
      console.error('Gemini failed, falling back to NLP heuristic:', e.message);
    }
  }

  // NLP heuristic fallback (no API key, or Gemini failed)
  const tasks = nlpExtractTasksFromText(text);
  return res.json(tasks);
});
// ================= AUTH =================
const users = {}; // Simple in-memory user store

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (users[email]) {
    return res.status(400).json({ error: 'User already exists' });
  }
  users[email] = { email, password };
  res.json({ success: true, message: 'Account created successfully' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = users[email];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ success: true, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});
// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});