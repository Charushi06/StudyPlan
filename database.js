const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'studyplan.db'));

function initDb() {
  db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      reset_token TEXT,
      reset_token_expiry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Subjects Table
    db.run(`CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_code TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tasks Table
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
      labels TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )`);

    // Add labels column to existing tasks table if it doesn't exist
    db.all("PRAGMA table_info(tasks)", (err, rows) => {
      if (err) return;
      const hasLabels = rows.some(r => r.name === 'labels');
      if (!hasLabels) {
        db.run("ALTER TABLE tasks ADD COLUMN labels TEXT DEFAULT '[]'");
      }
    });

    // Notes Table
    db.run(`CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Pre-populate some subjects if empty
    db.get('SELECT COUNT(*) as count FROM subjects', (err, row) => {
      if (row && row.count === 0) {
        console.log("Seeding subjects...");
        const stmt = db.prepare("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)");
        stmt.run('sub_1', 'Computer Science', 'CS', 'var(--color-text-info)');
        stmt.run('sub_2', 'Mathematics', 'Maths', 'var(--color-text-success)');
        stmt.run('sub_3', 'English Lit', 'English', 'var(--color-text-purple)');
        stmt.run('sub_4', 'Physics', 'Physics', 'var(--color-text-warning)');
        stmt.finalize();
      }
    });
  });
}

module.exports = { db, initDb };
