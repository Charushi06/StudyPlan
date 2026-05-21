const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'studyplan.db'));

function initDb() {
  db.serialize(() => {
    // Subjects Table
    db.run(`CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_code TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      display_name TEXT,
      avatar_color TEXT DEFAULT '#4f46e5',
      avatar_image TEXT,
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
      assignee_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (assignee_email) REFERENCES users(email)
    )`);

    // Alter tasks table if assignee_email doesn't exist for upgrade paths
    db.all(`PRAGMA table_info(tasks)`, (err, columns) => {
      if (!err && columns) {
        const hasAssignee = columns.some(col => col.name === 'assignee_email');
        if (!hasAssignee) {
          db.run(`ALTER TABLE tasks ADD COLUMN assignee_email TEXT`);
        }
      }
    });

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
