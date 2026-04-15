require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, run, all } = require('./database');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

initDb().then(() => {
  console.log("Database initialized");
  
  app.get('/api/subjects', (req, res) => {
    all('SELECT * FROM subjects', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  app.get('/api/tasks', (req, res) => {
    all('SELECT * FROM tasks ORDER BY due_at ASC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  app.post('/api/tasks', (req, res) => {
    const tasks = Array.isArray(req.body) ? req.body : [req.body];
    
    tasks.forEach(t => {
      const id = 'task_' + Date.now() + Math.random().toString(36).substr(2, 5);
      run(`INSERT INTO tasks (id, subject_id, title, due_at, status, priority, confidence_score, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, t.subject_id, t.title, t.due_at, t.status || 'Not Started', t.priority || 'medium', t.confidence_score || 100, t.notes || '']);
    });
    
    res.json({ success: true, count: tasks.length });
  });

  app.put('/api/tasks/:id', (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    run('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/extract', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    
    const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
    
    if (ai) {
      try {
        const prompt = `
  You are an AI study planner. Extract deadlines and tasks from the following unstructured text.
  Current Date: 2026-04-11T12:00:00Z
  Return ONLY structured JSON adhering exactly to the following array structure:
  [{
    "subject_name": "Inferred subject name or keyword",
    "title": "Task description",
    "due_at": "ISO 8601 Date String (if ambiguous, infer best date relative to Current Date)",
    "priority": "high|medium|low",
    "confidence_score": number between 0 and 100,
    "notes": "Submission method or extra notes"
  }]
  Text: "${text}"`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        
        let rawText = (typeof response.text === 'function' ? response.text() : response.text).trim();
        if(rawText.startsWith('\`\`\`json')){
          rawText = rawText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        } else if (rawText.startsWith('\`\`\`')) {
          rawText = rawText.replace(/\`\`\`/g, '').trim();
        }
        const data = JSON.parse(rawText);
        res.json(data);
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'AI Extraction failed', details: e.message });
      }
    } else {
      setTimeout(() => {
        const lower = text.toLowerCase();
        const results = [];
        if (lower.includes('os assignment')) {
          results.push({
            subject_name: 'Computer Science',
            title: 'OS Assignment 3 — Scheduling Algorithms',
            due_at: '2026-04-12T23:00:00',
            priority: 'high',
            confidence_score: 88,
            notes: 'Submit via portal, include Gantt chart'
          });
        }
        if (lower.includes('maths')) {
          results.push({
            subject_name: 'Mathematics',
            title: 'Integration problem set',
            due_at: '2026-04-16T17:00:00',
            priority: 'medium',
            confidence_score: 62,
            notes: 'Date inferred — please confirm'
          });
        }
        if (results.length === 0) {
          let inferredSubject = 'General';
          if (lower.includes('lab') || lower.includes('computer')) inferredSubject = 'Computer Science';
          else if (lower.includes('physics')) inferredSubject = 'Physics';
          else if (lower.includes('english') || lower.includes('essay')) inferredSubject = 'English Lit';

          let daysToAdd = 1;
          if (lower.includes('friday')) daysToAdd = 5 - new Date().getDay() + (new Date().getDay() >= 5 ? 7 : 0);
          else if (lower.includes('wednesday')) daysToAdd = 3 - new Date().getDay() + (new Date().getDay() >= 3 ? 7 : 0);

          results.push({
            subject_name: inferredSubject,
            title: text.length > 50 ? text.substring(0, 47) + '...' : text,
            due_at: new Date(Date.now() + daysToAdd * 86400000).toISOString(),
            priority: 'medium',
            confidence_score: 40,
            notes: 'Heuristic extraction — please verify'
          });
        }
        res.json(results);
      }, 1200);
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
  });
});