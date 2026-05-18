const { db } = require('../../database.js');

const ALLOWED_SUBJECT_COLORS = new Set([
  'var(--color-text-info)',
  'var(--color-text-success)',
  'var(--color-text-purple)',
  'var(--color-text-warning)',
  'var(--color-text-danger)',
  'var(--color-text-secondary)',
]);

const getSubjects = (req, res) => {
  db.all('SELECT * FROM subjects', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

const createSubject = (req, res) => {
  const name = String(req.body?.name || '').trim();
  let color = String(req.body?.color || '').trim() || 'var(--color-text-info)';
  if (!name) {
    return res.status(400).json({ error: 'Subject name is required' });
  }
  if (!ALLOWED_SUBJECT_COLORS.has(color)) {
    color = 'var(--color-text-info)';
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
};

module.exports = {
  getSubjects,
  createSubject
};