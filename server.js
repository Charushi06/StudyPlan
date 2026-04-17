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

// Static
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

initDb();

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

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

// ================= ADD TASKS (FINAL FIX) =================
app.post('/api/tasks', (req, res) => {
  try {
    const tasks = Array.isArray(req.body) ? req.body : [req.body];

    if (!tasks || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No tasks provided"
      });
    }

    let inserted = 0;
    let duplicates = [];
    let errors = [];

    const stmt = db.prepare(`INSERT INTO tasks 
      (id, subject_id, title, due_at, status, priority, confidence_score, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    let pending = tasks.length;

    tasks.forEach(t => {

      // ================= VALIDATION =================
      if (!t.title || !t.due_at || !t.subject_id) {
        errors.push({ task: t, error: "Missing title, subject or due date" });
        pending--;

        if (pending === 0) {
          stmt.finalize(() => {
            return res.status(400).json({
              success: false,
              inserted,
              duplicates,
              errors,
              message: "All tasks invalid"
            });
          });
        }
        return;
      }

      // ================= DUPLICATE CHECK =================
      db.get(
        `SELECT * FROM tasks 
         WHERE LOWER(title) = LOWER(?) 
         AND subject_id = ?
         AND DATE(due_at) = DATE(?)`,
        [t.title, t.subject_id, t.due_at],
        (err, existing) => {

          if (err) {
            errors.push({ task: t, error: err.message });
          }
          else if (existing) {
            duplicates.push({
              title: t.title,
              due_at: t.due_at,
              subject_id: t.subject_id
            });
          }
          else {
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

          // ================= FINAL RESPONSE =================
          if (pending === 0) {
            stmt.finalize((finalErr) => {
              if (finalErr) {
                return res.status(500).json({
                  success: false,
                  message: "Database error",
                  error: finalErr.message
                });
              }

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
    return res.status(500).json({
      success: false,
      message: "Unexpected server error",
      error: e.message
    });
  }
});

// ================= UPDATE =================
app.put('/api/tasks/:id', (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  db.run(
    'UPDATE tasks SET status = ? WHERE id = ?',
    [status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
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

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (ai) {
    try {
      const prompt = `
You are an AI study planner. Extract deadlines and tasks.
Return ONLY JSON array.
Text: "${text}"
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let rawText = (typeof response.text === 'function'
        ? response.text()
        : response.text).trim();

      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/```json|```/g, '').trim();
      }

      const data = JSON.parse(rawText);
      res.json(data);

    } catch (e) {
      console.error(e);
      res.status(500).json({
        error: 'AI Extraction failed',
        details: e.message
      });
    }

  } else {
    setTimeout(() => {
      res.json([{
        subject_name: "General",
        title: text,
        due_at: new Date(Date.now() + 86400000).toISOString(),
        priority: "medium",
        confidence_score: 50,
        notes: "Mock extraction"
      }]);
    }, 1000);
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
