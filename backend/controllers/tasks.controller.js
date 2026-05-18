const { db } = require('../../database.js');

const getTasks = (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY due_at ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

const addTasks = (req, res) => {
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
};

const updateTask = (req, res) => {
  const { status, archived, title, subject_id, due_at, notes, priority } = req.body;

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

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  query += updates.join(', ') + ' WHERE id = ?';
  params.push(req.params.id);

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

const deleteTask = (req, res) => {
  db.run(
    'DELETE FROM tasks WHERE id = ?',
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
};

module.exports = {
  getTasks,
  addTasks,
  updateTask,
  deleteTask
};
