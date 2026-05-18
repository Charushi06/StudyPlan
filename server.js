require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');
const path = require('path');
const csvDownloadRouter = require('./backend/routers/csvDownload.router.js');
const authRouter = require('./backend/routers/auth.router.js');
const subjectsRouter = require('./backend/routers/subjects.router.js');
const tasksRouter = require('./backend/routers/tasks.router.js');
const extractRouter = require('./backend/routers/extract.router.js');

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
app.use('/api/subjects', subjectsRouter);

// ================= TASKS =================
app.use('/api/tasks', tasksRouter);

// ================= AI EXTRACTION =================
app.use('/api/extract', extractRouter);

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
