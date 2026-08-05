/**
 * xp_system.js
 * 
 * XP System — backend module (Express router + SQLite helpers).
 * Mount in your main server file:
 *   const xpRouter = require('./xp_system');
 *   app.use('/api/xp', xpRouter);
 *
 * The module creates its own `xp_ledger` and `xp_sessions` tables on first run.
 *
 * XP Rules:
 *   study_time   → 2 XP per minute  (floored, minimum 1 min to count)
 *   task_done    → configurable     (default 20 XP)
 *   topic_done   → 50 XP (fixed)
 *   notes_done   → configurable     (default 30 XP)
 */

'use strict';

const express = require('express');
const router = express.Router();

// ── DB bootstrap ──────────────────────────────────────────────────────────────
// We reuse whatever db handle the parent app exposes, or fall back to a local
// SQLite instance via `better-sqlite3` / `sqlite3`.
// To integrate: pass your existing `db` via  `xpRouter.setDb(db)` after require.

let db = null; // will be set by parent or auto-initialised

const XP_RATES = {
    study_time: 2,   // per minute
    task_done: 20,  // default, overridable per call
    topic_done: 50,  // fixed
    notes_done: 30,  // default, overridable per call
};

// Anti-abuse: cap time-based XP to 120 min per session call
const MAX_STUDY_MINUTES_PER_CALL = 120;

// ── Middleware: require db ─────────────────────────────────────────────────────
function requireDb(req, res, next) {
    if (!db) {
        return res.status(503).json({ error: 'Database not initialised. Call xpRouter.setDb(db) first.' });
    }
    next();
}

// ── Schema helpers ─────────────────────────────────────────────────────────────
function ensureTables() {
    db.run(`
    CREATE TABLE IF NOT EXISTS xp_ledger (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL DEFAULT 'default',
      amount      INTEGER NOT NULL,
      reason      TEXT    NOT NULL,
      metadata    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS xp_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL DEFAULT 'default',
      session_token TEXT    NOT NULL UNIQUE,
      task_id       TEXT,
      started_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      ended_at      TEXT,
      minutes       INTEGER,
      xp_awarded    INTEGER DEFAULT 0,
      committed     INTEGER DEFAULT 0
    )
  `);
}

// ── XP helpers ─────────────────────────────────────────────────────────────────
function getTotalXp(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM xp_ledger WHERE user_id = ?`,
            [userId],
            (err, row) => (err ? reject(err) : resolve(row.total))
        );
    });
}

function getLedger(userId, limit = 50) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, amount, reason, metadata, created_at
         FROM xp_ledger
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
            [userId, limit],
            (err, rows) => (err ? reject(err) : resolve(rows))
        );
    });
}

function awardXp(userId, amount, reason, metadata = null) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO xp_ledger (user_id, amount, reason, metadata) VALUES (?, ?, ?, ?)`,
            [userId, amount, reason, metadata ? JSON.stringify(metadata) : null],
            function (err) {
                if (err) return reject(err);
                resolve({ ledger_id: this.lastID, amount, reason });
            }
        );
    });
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/xp
 * Returns current XP total + level info for a user.
 * Query param: user_id (default: 'default')
 */
router.get('/', requireDb, async (req, res) => {
    try {
        const userId = (req.query.user_id || 'default').toString().trim();
        const total = await getTotalXp(userId);
        res.json({ user_id: userId, xp: total, ...computeLevel(total) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/xp/ledger
 * Returns last N XP transactions.
 */
router.get('/ledger', requireDb, async (req, res) => {
    try {
        const userId = (req.query.user_id || 'default').toString().trim();
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const rows = await getLedger(userId, limit);
        const total = await getTotalXp(userId);
        res.json({ user_id: userId, xp: total, transactions: rows, ...computeLevel(total) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/xp/award
 * Generic XP award endpoint.
 * Body: { user_id?, amount, reason, metadata? }
 * amount must be a positive integer ≤ 9999.
 */
router.post('/award', requireDb, async (req, res) => {
    try {
        const userId = (req.body.user_id || 'default').toString().trim();
        const amount = parseInt(req.body.amount);
        const reason = (req.body.reason || 'manual').toString().trim().substring(0, 120);
        const meta = req.body.metadata || null;

        if (!Number.isInteger(amount) || amount < 1 || amount > 9999) {
            return res.status(400).json({ error: 'amount must be an integer 1–9999' });
        }

        const entry = await awardXp(userId, amount, reason, meta);
        const newTotal = await getTotalXp(userId);
        res.json({ ok: true, ...entry, xp: newTotal, ...computeLevel(newTotal) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/xp/study-time
 * Awards XP for study time.
 * Body: { user_id?, minutes, task_id? }
 * 1 minute = 2 XP.  Capped at MAX_STUDY_MINUTES_PER_CALL.
 *
 * Anti-abuse: each session_token can only be committed once.
 */
router.post('/study-time', requireDb, async (req, res) => {
    try {
        const userId = (req.body.user_id || 'default').toString().trim();
        const rawMins = parseFloat(req.body.minutes) || 0;
        const taskId = req.body.task_id || null;
        const token = req.body.session_token || null;

        const minutes = Math.min(Math.floor(rawMins), MAX_STUDY_MINUTES_PER_CALL);

        if (minutes < 1) {
            return res.status(400).json({ error: 'Minimum 1 full minute required to earn XP.' });
        }

        // Dedup by session_token if provided
        if (token) {
            const existing = await new Promise((resolve, reject) =>
                db.get('SELECT committed FROM xp_sessions WHERE session_token = ?', [token],
                    (err, row) => (err ? reject(err) : resolve(row)))
            );
            if (existing && existing.committed) {
                return res.status(409).json({ error: 'Session already committed.' });
            }
        }

        const xpEarned = minutes * XP_RATES.study_time;
        const meta = { minutes, task_id: taskId, session_token: token };

        // Persist session record
        if (token) {
            db.run(`INSERT OR IGNORE INTO xp_sessions
                (user_id, session_token, task_id, minutes, xp_awarded, committed)
              VALUES (?, ?, ?, ?, ?, 1)`,
                [userId, token, taskId, minutes, xpEarned]);
            db.run(`UPDATE xp_sessions SET committed = 1, ended_at = datetime('now'),
                minutes = ?, xp_awarded = ?
              WHERE session_token = ?`,
                [minutes, xpEarned, token]);
        }

        const entry = await awardXp(userId, xpEarned, 'study_time', meta);
        const newTotal = await getTotalXp(userId);

        res.json({
            ok: true,
            xp_earned: xpEarned,
            minutes,
            xp: newTotal,
            ...computeLevel(newTotal),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/xp/task-done
 * Awards XP when a task is completed.
 * Body: { user_id?, task_id, xp_override? }
 *
 * Anti-abuse: each task_id can only award task_done XP once.
 */
router.post('/task-done', requireDb, async (req, res) => {
    try {
        const userId = (req.body.user_id || 'default').toString().trim();
        const taskId = req.body.task_id ? String(req.body.task_id) : null;
        const xpAmt = Math.min(parseInt(req.body.xp_override) || XP_RATES.task_done, 200);

        if (!taskId) return res.status(400).json({ error: 'task_id required' });

        // Check if already awarded for this task
        const alreadyAwarded = await new Promise((resolve, reject) =>
            db.get(
                `SELECT id FROM xp_ledger
          WHERE user_id = ? AND reason = 'task_done'
            AND json_extract(metadata, '$.task_id') = ?`,
                [userId, taskId],
                (err, row) => (err ? reject(err) : resolve(!!row))
            )
        );

        if (alreadyAwarded) {
            const total = await getTotalXp(userId);
            return res.json({ ok: true, xp_earned: 0, already_awarded: true, xp: total, ...computeLevel(total) });
        }

        const entry = await awardXp(userId, xpAmt, 'task_done', { task_id: taskId });
        const newTotal = await getTotalXp(userId);

        res.json({ ok: true, xp_earned: xpAmt, xp: newTotal, ...computeLevel(newTotal) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/xp/topic-done
 * Awards 50 XP for completing a topic (subject).
 * Body: { user_id?, topic_id, topic_name? }
 *
 * Anti-abuse: each topic_id can only award topic_done XP once per day.
 */
router.post('/topic-done', requireDb, async (req, res) => {
    try {
        const userId = (req.body.user_id || 'default').toString().trim();
        const topicId = req.body.topic_id ? String(req.body.topic_id) : null;
        const topicName = req.body.topic_name ? String(req.body.topic_name) : 'Unknown topic';

        if (!topicId) return res.status(400).json({ error: 'topic_id required' });

        // One award per topic per calendar day
        const alreadyToday = await new Promise((resolve, reject) =>
            db.get(
                `SELECT id FROM xp_ledger
          WHERE user_id = ? AND reason = 'topic_done'
            AND json_extract(metadata, '$.topic_id') = ?
            AND date(created_at) = date('now')`,
                [userId, topicId],
                (err, row) => (err ? reject(err) : resolve(!!row))
            )
        );

        if (alreadyToday) {
            const total = await getTotalXp(userId);
            return res.json({ ok: true, xp_earned: 0, already_awarded: true, xp: total, ...computeLevel(total) });
        }

        const entry = await awardXp(userId, XP_RATES.topic_done, 'topic_done', { topic_id: topicId, topic_name: topicName });
        const newTotal = await getTotalXp(userId);

        res.json({ ok: true, xp_earned: XP_RATES.topic_done, xp: newTotal, ...computeLevel(newTotal) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/xp/notes-done
 * Awards XP for completing notes.
 * Body: { user_id?, note_id, xp_override? }
 */
router.post('/notes-done', requireDb, async (req, res) => {
    try {
        const userId = (req.body.user_id || 'default').toString().trim();
        const noteId = req.body.note_id ? String(req.body.note_id) : null;
        const xpAmt = Math.min(parseInt(req.body.xp_override) || XP_RATES.notes_done, 200);

        if (!noteId) return res.status(400).json({ error: 'note_id required' });

        const alreadyAwarded = await new Promise((resolve, reject) =>
            db.get(
                `SELECT id FROM xp_ledger
          WHERE user_id = ? AND reason = 'notes_done'
            AND json_extract(metadata, '$.note_id') = ?`,
                [userId, noteId],
                (err, row) => (err ? reject(err) : resolve(!!row))
            )
        );

        if (alreadyAwarded) {
            const total = await getTotalXp(userId);
            return res.json({ ok: true, xp_earned: 0, already_awarded: true, xp: total, ...computeLevel(total) });
        }

        const entry = await awardXp(userId, xpAmt, 'notes_done', { note_id: noteId });
        const newTotal = await getTotalXp(userId);

        res.json({ ok: true, xp_earned: xpAmt, xp: newTotal, ...computeLevel(newTotal) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Level computation ──────────────────────────────────────────────────────────
/**
 * Computes level from total XP.
 * Threshold formula: each level requires level * 100 XP (cumulative).
 * Level 1: 0–99, Level 2: 100–299, Level 3: 300–599, …
 */
function computeLevel(xp) {
    let level = 1;
    let threshold = 0;
    while (xp >= threshold + level * 100) {
        threshold += level * 100;
        level++;
    }
    const xpIntoLevel = xp - threshold;
    const xpForNext = level * 100;
    const progress = Math.min(Math.floor((xpIntoLevel / xpForNext) * 100), 100);
    return { level, xp_into_level: xpIntoLevel, xp_for_next_level: xpForNext, progress_pct: progress };
}

// ── Public interface ───────────────────────────────────────────────────────────
router.setDb = function (database) {
    db = database;
    ensureTables();
};

router.computeLevel = computeLevel;
router.awardXp = awardXp;
router.getTotalXp = getTotalXp;
router.XP_RATES = XP_RATES;

module.exports = router;