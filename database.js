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
      estimated_duration INTEGER,
      is_estimated_duration_min BOOLEAN,
      labels TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )`);

db.all("PRAGMA table_info(tasks)", (err, rows) => {
  if (err) return;

  const columnNames = rows.map((row) => row.name);

  // Estimated duration columns
  if (!columnNames.includes("estimated_duration")) {
    db.run("ALTER TABLE tasks ADD COLUMN estimated_duration INTEGER");
  }

  if (!columnNames.includes("is_estimated_duration_min")) {
    db.run(
      "ALTER TABLE tasks ADD COLUMN is_estimated_duration_min BOOLEAN"
    );
  }

  // Labels column
  if (!columnNames.includes("labels")) {
    db.run("ALTER TABLE tasks ADD COLUMN labels TEXT DEFAULT '[]'");
  }
});

    db.run(`CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
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
