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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )`);

    // Study Patterns Table
    db.run(`CREATE TABLE IF NOT EXISTS study_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      task_id TEXT,
      task_type TEXT,
      subject_id TEXT,
      completion_time INTEGER, -- in minutes
      difficulty_rating INTEGER, -- 1-5 scale
      effectiveness_rating INTEGER, -- 1-5 scale
      study_session_start DATETIME,
      study_session_end DATETIME,
      breaks_taken INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )`);

    // User Preferences Table
    db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      study_style TEXT, -- 'visual', 'auditory', 'kinesthetic', 'reading'
      preferred_session_length INTEGER DEFAULT 25, -- in minutes
      preferred_break_length INTEGER DEFAULT 5, -- in minutes
      peak_productivity_start TIME, -- e.g., '09:00'
      peak_productivity_end TIME, -- e.g., '12:00'
      difficulty_preference TEXT, -- 'easy_first', 'hard_first', 'mixed'
      feedback_data TEXT, -- JSON string for complex preferences
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // AI Recommendations Table
    db.run(`CREATE TABLE IF NOT EXISTS ai_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      recommendation_type TEXT, -- 'schedule', 'technique', 'priority', 'resource'
      recommendation_text TEXT,
      context_data TEXT, -- JSON string with relevant context
      applied INTEGER DEFAULT 0,
      helpfulness_rating INTEGER, -- 1-5 scale, NULL if not rated
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      rated_at DATETIME
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

    // Initialize default user preferences if empty
    db.get('SELECT COUNT(*) as count FROM user_preferences', (err, row) => {
      if (row && row.count === 0) {
        console.log("Initializing user preferences...");
        const stmt = db.prepare("INSERT INTO user_preferences (user_id, study_style, preferred_session_length, preferred_break_length, peak_productivity_start, peak_productivity_end, difficulty_preference) VALUES (?, ?, ?, ?, ?, ?, ?)");
        stmt.run('default_user', 'mixed', 25, 5, '09:00', '12:00', 'mixed');
        stmt.finalize();
      }
    });
  });
}

module.exports = { db, initDb };
