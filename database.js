const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'studyplan.db'));

function initDb() {

  // IMPORTANT: enable foreign keys in SQLite
  db.run("PRAGMA foreign_keys = ON");

  db.serialize(() => {

    // ================= SUBJECTS =================
    db.run(`CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_code TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ================= TASKS =================
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      subject_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      due_at DATETIME,
      status TEXT DEFAULT 'Not Started',
      priority TEXT DEFAULT 'medium',
      confidence_score REAL,
      notes TEXT,
      archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )`);

    // ================= ATTACHMENTS =================
    db.run(`CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      name TEXT,
      type TEXT,
      path TEXT,
      size INTEGER,
      extracted_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )`);

    // ================= SEED SUBJECTS =================
    db.get('SELECT COUNT(*) as count FROM subjects', (err, row) => {
      if (row?.count === 0) {
        console.log("Seeding subjects...");

        const stmt = db.prepare(
          "INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)"
        );

        stmt.run('sub_1', 'Computer Science', 'CS', 'var(--color-text-info)');
        stmt.run('sub_2', 'Mathematics', 'MATH', 'var(--color-text-success)');
        stmt.run('sub_3', 'English Lit', 'ENG', 'var(--color-text-purple)');
        stmt.run('sub_4', 'Physics', 'PHY', 'var(--color-text-warning)');

        stmt.finalize();
      }
    });

  });
}

module.exports = { db, initDb };