require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const csvDownloadRouter = require('./backend/routers/csvDownload.router.js');

const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');

// ================= APP INIT =================
const app = express();
app.use(cors());
app.use(express.json());

// ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// ================= STATIC =================
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

initDb();

// ================= AI =================
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

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

  if (!name) return res.status(400).json({ error: 'Subject name is required' });

  if (!ALLOWED_SUBJECT_COLORS.has(color)) {
    color = 'var(--color-text-info)';
  }

  const shortCode = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SUB';
  const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  db.run(
    'INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)',
    [id, name, shortCode, color],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, name, short_code: shortCode, color });
    }
  );
});

// ================= TASKS =================
app.get('/api/tasks', (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY due_at ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// CREATE TASKS (FIXED: Uses a sequential async processing framework to prevent race conditions)
app.post('/api/tasks', async (req, res) => {
  try {
    const tasks = Array.isArray(req.body) ? req.body : [req.body];

    if (!tasks.length) {
      return res.status(400).json({ success: false, message: "No tasks provided" });
    }

    let inserted = 0;
    let duplicates = [];
    let errors = [];

    const stmt = db.prepare(`
      INSERT INTO tasks 
      (id, subject_id, title, due_at, status, priority, confidence_score, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // We process sequentially to prevent asynchronous overlaps and premature array compilation
    for (const t of tasks) {
      if (!t.title || !t.due_at || !t.subject_id) {
        errors.push({ task: t, error: "Missing title, subject or due date" });
        continue;
      }

      await new Promise((resolve) => {
        db.get(
          `SELECT * FROM tasks WHERE LOWER(title)=LOWER(?) AND subject_id=? AND DATE(due_at)=DATE(?)`,
          [t.title, t.subject_id, t.due_at],
          (err, existing) => {
            if (err) {
              errors.push({ task: t, error: err.message });
              resolve();
            } else if (existing) {
              duplicates.push(t.title);
              resolve();
            } else {
              const id = 'task_' + Date.now() + Math.random().toString(36).slice(2, 8);
              stmt.run(
                id,
                t.subject_id,
                t.title,
                t.due_at,
                t.status || 'Not Started',
                t.priority || 'medium',
                t.confidence_score || 100,
                t.notes || '',
                (insertErr) => {
                  if (insertErr) {
                    errors.push({ task: t, error: insertErr.message });
                  } else {
                    inserted++;
                  }
                  resolve();
                }
              );
            }
          }
        );
      });
    }

    stmt.finalize(() => {
      res.json({ success: true, inserted, duplicates, errors });
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// UPDATE TASK
app.put('/api/tasks/:id', (req, res) => {
  const fields = [];
  const values = [];

  for (const key of ['status','archived','title','subject_id','due_at','notes','priority']) {
    if (req.body[key] !== undefined) {
      let value = req.body[key];
      if (key === 'archived') {
        value = value ? 1 : 0;
      }
      fields.push(`${key}=?`);
      values.push(value);
    }
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  db.run(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id=?`,
    values,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
});

// DELETE TASK
app.delete('/api/tasks/:id', (req, res) => {
  db.run('DELETE FROM tasks WHERE id=?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ================= FILE UPLOAD =================
app.post('/api/tasks/:taskId/upload', upload.single('file'), async (req, res) => {
  const filePath = req.file ? req.file.path : null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let extractedText = '';

    if (req.file.mimetype === 'application/pdf') {
      try {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        extractedText = data.text || '';
      } catch (e) {
        extractedText = '[PDF extract failed]';
      }
    }

    if (
      req.file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value || '';
      } catch (e) {
        extractedText = '[DOCX extract failed]';
      }
    }

    const attId = 'att_' + Date.now();

    db.run(
      `INSERT INTO attachments 
      (id, task_id, name, type, path, size, extracted_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attId,
        req.params.taskId,
        req.file.originalname,
        req.file.mimetype,
        filePath,
        req.file.size,
        extractedText,
        new Date().toISOString()
      ],
      (err) => {
        if (err) {
          if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return res.status(500).json({ error: err.message });
        }

        res.json({
          success: true,
          attachmentId: attId,
          preview: extractedText ? extractedText.slice(0, 500) : ""
        });
      }
    );

  } catch (err) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: err.message });
  }
});

// ================= AI EXTRACT =================
app.post('/api/extract', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });

  if (ai) {
    try {
      const prompt = `Extract tasks as JSON only.\nText: "${text}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let raw = response.text().replace(/```json|```/g, '').trim();

      try {
        return res.json(JSON.parse(raw));
      } catch {
        return res.json([]);
      }

    } catch {
      return res.json([]);
    }
  }

  res.json([]);
});

// ================= AUTH (TEMP) =================
const users = {};

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (users[email]) return res.status(400).json({ error: 'exists' });
  users[email] = { email, password };
  res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!users[email] || users[email].password !== password) {
    return res.status(401).json({ error: 'invalid' });
  }
  res.json({ success: true });
});

// ================= ROUTES =================
app.use('/api', csvDownloadRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});