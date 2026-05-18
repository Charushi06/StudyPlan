require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const csvDownloadRouter = require('./backend/routers/csvDownload.router.js');
const { nlpExtractTasksFromText } = require('./backend/utils/nlp.js');
const authRouter = require('./backend/routers/auth.router.js');

const app = express();
app.use(cors());
app.use(express.json());

const page404Path = path.join(__dirname, '404.html');
const page500Path = path.join(__dirname, 'error.html');

// Static
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

initDb();

// Environment Validation
if (!process.env.GEMINI_API_KEY) {
  console.warn('\x1b[33m%s\x1b[0m', '⚠️  WARNING: GEMINI_API_KEY is not defined in .env');
  console.warn('\x1b[33m%s\x1b[0m', '   AI extraction features will fall back to local heuristic NLP.');
  console.warn('\x1b[33m%s\x1b[0m', '   Get a key at: https://aistudio.google.com/app/apikey\n');
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;


// ================= SUBJECTS =================
app.get('/api/subjects', (req, res) => {
  db.all('SELECT * FROM subjects', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

const ALLOWED_SUBJECT_COLORS = new Set([
  'var(--color-text-info)',
  'var(--color-text-success)',
  'var(--color-text-purple)',
  'var(--color-text-warning)',
  'var(--color-text-danger)',
  'var(--color-text-secondary)',
]);

app.post('/api/subjects', (req, res) => {
  const name = String(req.body?.name || '').trim();
  let color = String(req.body?.color || '').trim() || 'var(--color-text-info)';
  if (!name) {
    return res.status(400).json({ error: 'Subject name is required' });
  }
  if (!ALLOWED_SUBJECT_COLORS.has(color)) {
    color = 'var(--color-text-info)';
  }
  db.get(
    'SELECT * FROM subjects WHERE LOWER(name) = LOWER(?)',
    [name],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (row) {
        return res.status(400).json({
          error: 'Subject already exists',
        });
      }

      const shortCode = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SUB';
      const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      db.run(
        'INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)',
        [id, name, shortCode, color],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id, name, short_code: shortCode, color });
        }
      );
    }
  )
});

// ================= DELETE SUBJECT =================
app.delete('/api/subjects/:id', (req, res) => {

  const { id } = req.params;

  db.run(
    'DELETE FROM tasks WHERE subject_id = ?',
    [id],
    function(taskErr) {

      if (taskErr) {
        return res.status(500).json({
          error: taskErr.message
        });
      }

      db.run(
        'DELETE FROM subjects WHERE id = ?',
        [id],
        function(subjectErr) {

          if (subjectErr) {
            return res.status(500).json({
              error: subjectErr.message
            });
          }

          res.json({
            success: true,
            deleted: this.changes
          });
        }
      );
    }
  );
});

// ================= TASKS =================
app.get('/api/tasks', (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY due_at ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(r => {
      try {
        r.labels = JSON.parse(r.labels || '[]');
      } catch(e) {
        r.labels = [];
      }
    });
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
      (id, subject_id, title, due_at, status, priority, confidence_score, notes, estimated_duration, is_estimated_duration_min, labels) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);


    let pending = tasks.length;

    tasks.forEach(t => {
      let validationError = null;
  if (!t.title && !t.subject_id && !t.due_at) {
    validationError = "Missing title, subject, and deadline";
  } else if (!t.title) {
    validationError = "Task name is required";
  } else if (!t.subject_id) {
    validationError = "Subject is required";
  } else if (!t.due_at) {
    validationError = "Deadline is required";
  }

  if (validationError) {
    errors.push({ task: t, error: validationError });
    pending--;
    if (pending === 0) {
      if (inserted === 0) {
        return res.status(400).json({ 
          success: false, inserted, duplicates, errors, 
          message: errors.length === tasks.length ? errors[0].error : "Some tasks are invalid"
        });
      }
      stmt.finalize(() => res.status(400).json({ 
        success: false, inserted, duplicates, errors, 
        message: "Some tasks are invalid"
      }));
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
              Number.isFinite(Number(t.estimated_duration)) ? Number(t.estimated_duration) : null,
              t.is_estimated_duration_min === 0 ? 0 : 1,
              typeof t.labels === 'string' ? t.labels : JSON.stringify(t.labels || []),
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

  const { status, archived, title, subject_id, due_at, notes, priority, estimated_duration, is_estimated_duration_min,labels } = req.body;


  let query = 'UPDATE tasks SET ';
  const params = [];
  const updates = [];

  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (archived !== undefined) { updates.push('archived = ?'); params.push(archived); }
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (subject_id !== undefined) { updates.push('subject_id = ?'); params.push(subject_id); }
  if (due_at !== undefined) { updates.push('due_at = ?'); params.push(due_at); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  if (estimated_duration !== undefined) { updates.push('estimated_duration = ?'); params.push(Number.isFinite(Number(estimated_duration)) ? Number(estimated_duration) : null); }
  if (is_estimated_duration_min !== undefined) { updates.push('is_estimated_duration_min = ?'); params.push(is_estimated_duration_min === 0 ? 0 : 1); }
  if (labels !== undefined) { updates.push('labels = ?'); params.push(typeof labels === 'string' ? labels : JSON.stringify(labels)); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  query += updates.join(', ') + ' WHERE id = ?';
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
IMPORTANT: Do not strip hashtags from the task description! If the original text contains hashtag labels (e.g. #urgent, #Group), you MUST include them at the end of the 'title' field (e.g. 'Read chapter 1 #urgent').

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
  console.log(tasks)
  return res.json(tasks);
});

// ================= AUTH =================
app.use('/api/auth', authRouter);

// Intentional test route for verifying server error page behavior.
app.get('/debug/force-error', (req, res, next) => {
  next(new Error('Intentional test error'));
});

app.use('/api', csvDownloadRouter);

app.use('/api', (req, res) => {
  return res.status(404).json({ error: 'API route not found' });
});

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  return res.status(404).sendFile(page404Path);
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);

  if (res.headersSent) {
    return next(err);
  }

  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(500).sendFile(page500Path);
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
