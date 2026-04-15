const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = path.join(__dirname, 'studyplan.db');

async function initDb() {
  const SQL = await initSqlJs();
  
  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(data);
  
  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_code TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )`);

  const result = db.exec('SELECT COUNT(*) as count FROM subjects');
  const count = result.length > 0 ? result[0].values[0][0] : 0;
  
  if (count === 0) {
    console.log("Seeding subjects...");
    db.run("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_1', 'Computer Science', 'CS', 'var(--color-text-info)']);
    db.run("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_2', 'Mathematics', 'Maths', 'var(--color-text-success)']);
    db.run("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_3', 'English Lit', 'English', 'var(--color-text-purple)']);
    db.run("INSERT INTO subjects (id, name, short_code, color) VALUES (?, ?, ?, ?)", ['sub_4', 'Physics', 'Physics', 'var(--color-text-warning)']);
    saveDb();
  }
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function all(sql, params = [], callback) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    callback(null, results);
  } catch (e) {
    callback(e, null);
  }
}

module.exports = { 
  get db() { return db; },
  run, 
  all, 
  initDb, 
  saveDb 
};