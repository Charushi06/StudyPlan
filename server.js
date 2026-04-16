require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initDb } = require('./database');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Explicitly bind exact paths for static folders
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

initDb();

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

function getDateRange(period) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  if (period === 'daily') {
    end.setDate(end.getDate() + 1);
  } else {
    end.setDate(end.getDate() + 7);
  }

  return { now, start, end };
}

function buildHeuristicSummary(tasks, period, subjects) {
  const activeTasks = tasks.filter(task => task.status !== 'Done');
  const deadlineCount = activeTasks.length;
  const highPriority = activeTasks.filter(task => task.priority === 'high');

  const subjectLoad = activeTasks.reduce((acc, task) => {
    const subjectName = task.subject_name || 'General';
    if (!acc[subjectName]) {
      acc[subjectName] = { count: 0, urgent: 0 };
    }

    acc[subjectName].count += 1;
    if (task.priority === 'high') {
      acc[subjectName].urgent += 1;
    }

    return acc;
  }, {});

  const focusAreas = Object.entries(subjectLoad)
    .sort((a, b) => {
      if (b[1].urgent !== a[1].urgent) return b[1].urgent - a[1].urgent;
      return b[1].count - a[1].count;
    })
    .slice(0, 3)
    .map(([subjectName, stats]) => {
      if (stats.urgent > 0) {
        return `${subjectName}: ${stats.urgent} high-priority ${stats.urgent === 1 ? 'task needs' : 'tasks need'} attention.`;
      }
      return `${subjectName}: ${stats.count} ${stats.count === 1 ? 'deadline is' : 'deadlines are'} coming up.`;
    });

  if (focusAreas.length === 0) {
    focusAreas.push('You are clear right now. Use this window to review notes or get ahead on the next topic.');
  }

  const subjectCount = new Set(activeTasks.map(task => task.subject_id).filter(Boolean)).size;
  const periodLabel = period === 'daily' ? 'today' : 'this week';
  let overview;

  if (deadlineCount === 0) {
    overview = `You have no active deadlines ${periodLabel}.`;
  } else if (deadlineCount === 1) {
    overview = `You have 1 active deadline ${periodLabel}.`;
  } else {
    overview = `This ${period === 'daily' ? 'day' : 'week'} you have ${deadlineCount} active deadlines across ${subjectCount || subjects.length || 1} subject${(subjectCount || subjects.length || 1) === 1 ? '' : 's'}.`;
  }

  if (highPriority.length > 0) {
    overview += ` ${highPriority.length} ${highPriority.length === 1 ? 'is marked' : 'are marked'} high priority.`;
  }

  return {
    period,
    overview,
    focusAreas,
    taskCount: deadlineCount,
    highPriorityCount: highPriority.length
  };
}

async function generateStudySummary(tasks, period, subjects) {
  const heuristic = buildHeuristicSummary(tasks, period, subjects);

  if (!ai) {
    return heuristic;
  }

  try {
    const prompt = `
You are an AI study coach creating a short planner summary.
Current Date: ${new Date().toISOString()}
Period: ${period}

Return ONLY valid JSON with this exact shape:
{
  "overview": "2 sentences max",
  "focusAreas": ["short actionable suggestion", "short actionable suggestion", "short actionable suggestion"]
}

Use the task data below. Keep the tone clear and encouraging. Mention the number of deadlines naturally.
Tasks:
${JSON.stringify(tasks, null, 2)}
Subjects:
${JSON.stringify(subjects, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    let rawText = (typeof response.text === 'function' ? response.text() : response.text).trim();
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(rawText);
    return {
      period,
      overview: parsed.overview || heuristic.overview,
      focusAreas: Array.isArray(parsed.focusAreas) && parsed.focusAreas.length ? parsed.focusAreas.slice(0, 3) : heuristic.focusAreas,
      taskCount: heuristic.taskCount,
      highPriorityCount: heuristic.highPriorityCount
    };
  } catch (error) {
    console.error('Summary generation failed, falling back to heuristic summary', error);
    return heuristic;
  }
}

// GET /api/subjects
app.get('/api/subjects', (req, res) => {
  db.all('SELECT * FROM subjects', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/tasks
app.get('/api/tasks', (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY due_at ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/summary?period=daily|weekly
app.get('/api/summary', (req, res) => {
  const period = req.query.period === 'daily' ? 'daily' : 'weekly';
  const { start, end } = getDateRange(period);

  const tasksQuery = `
    SELECT tasks.*, subjects.name AS subject_name, subjects.short_code AS subject_short_code
    FROM tasks
    LEFT JOIN subjects ON tasks.subject_id = subjects.id
    WHERE tasks.due_at IS NOT NULL
      AND datetime(tasks.due_at) >= datetime(?)
      AND datetime(tasks.due_at) < datetime(?)
    ORDER BY datetime(tasks.due_at) ASC
  `;

  db.all(tasksQuery, [start.toISOString(), end.toISOString()], (taskErr, tasks) => {
    if (taskErr) return res.status(500).json({ error: taskErr.message });

    db.all('SELECT * FROM subjects', async (subjectErr, subjects) => {
      if (subjectErr) return res.status(500).json({ error: subjectErr.message });

      try {
        const summary = await generateStudySummary(tasks, period, subjects);
        res.json(summary);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });
});

// POST /api/tasks
app.post('/api/tasks', (req, res) => {
  const tasks = Array.isArray(req.body) ? req.body : [req.body];
  
  const stmt = db.prepare(`INSERT INTO tasks 
    (id, subject_id, title, due_at, status, priority, confidence_score, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    
  tasks.forEach(t => {
    const id = 'task_' + Date.now() + Math.random().toString(36).substr(2, 5);
    stmt.run(id, t.subject_id, t.title, t.due_at, t.status || 'Not Started', t.priority || 'medium', t.confidence_score || 100, t.notes || '');
  });
  
  stmt.finalize((err) => {
    if(err) return res.status(500).json({ error: err.message });
    res.json({ success: true, count: tasks.length });
  });
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
    if(err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function(err) {
    if(err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});


// AI Extraction Route
app.post('/api/extract', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  
  if (ai) {
    try {
      const prompt = `
You are an AI study planner. Extract deadlines and tasks from the following unstructured text.
Current Date: ${new Date().toISOString()}
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
    // Mock response if no API key
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
        // Try to do a basic heuristic extraction to look better
        let inferredSubject = 'General';
        if (lower.includes('lab') || lower.includes('computer')) inferredSubject = 'Computer Science';
        else if (lower.includes('physics')) inferredSubject = 'Physics';
        else if (lower.includes('english') || lower.includes('essay')) inferredSubject = 'English Lit';

        // simple date heuristic
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
