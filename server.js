require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const csvDownloadRouter = require('./backend/routers/csvDownload.router.js');
const { nlpExtractTasksFromText } = require('./backend/utils/nlp.js');
const authRouter = require('./backend/routers/auth.router.js');
const subjectsRouter = require('./backend/routers/subjects.router.js');
const tasksRouter = require('./backend/routers/tasks.router.js');

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
