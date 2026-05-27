const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'studyplan.db'));

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  // Create tables
  await dbRun(`CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_code TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS tasks (
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
  try {
    const rows = await dbAll("PRAGMA table_info(tasks)");
    const hasLabels = rows.some(r => r.name === 'labels');
    if (!hasLabels) {
      await dbRun("ALTER TABLE tasks ADD COLUMN labels TEXT DEFAULT '[]'");
    }
  } catch (e) {
    console.error('Migration error:', e.message);
  }

  // Create users table
  await dbRun(`CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Pre-populate some subjects if empty
  try {
    const row = await dbGet('SELECT COUNT(*) as count FROM subjects');
    if (row && row.count === 0) {
      console.log("Seeding subjects...");
      await dbRun("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_1', 'Computer Science', 'CS', 'var(--color-text-info)']);
      await dbRun("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_2', 'Mathematics', 'Maths', 'var(--color-text-success)']);
      await dbRun("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_3', 'English Lit', 'English', 'var(--color-text-purple)']);
      await dbRun("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_4', 'Physics', 'Physics', 'var(--color-text-warning)']);
    }
  } catch (e) {
    console.error('Seed error:', e.message);
  }
}

module.exports = { db, initDb, dbRun, dbGet, dbAll };
