const crypto = require('crypto');

const { db } = require('../database');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
  };
}

async function findUserById(id) {
  const row = await get('SELECT * FROM users WHERE id = ?', [id]);
  return row;
}

async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const row = await get('SELECT * FROM users WHERE lower(email) = ?', [normalized]);
  return row;
}

async function findUserByGoogleId(googleId) {
  if (!googleId) return null;
  const row = await get('SELECT * FROM users WHERE google_id = ?', [googleId]);
  return row;
}

async function createUser({ email, passwordHash, googleId, name, avatarUrl }) {
  const id = crypto.randomUUID();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  await run(
    `INSERT INTO users (id, email, password_hash, google_id, name, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, normalizedEmail, passwordHash || null, googleId || null, name || null, avatarUrl || null]
  );
  return findUserById(id);
}

async function linkGoogleToUser(userId, googleId, { name, avatarUrl }) {
  await run(
    `UPDATE users SET google_id = ?, name = COALESCE(name, ?), avatar_url = COALESCE(?, avatar_url) WHERE id = ?`,
    [googleId, name || null, avatarUrl || null, userId]
  );
  return findUserById(userId);
}

module.exports = {
  toPublicUser,
  findUserById,
  findUserByEmail,
  findUserByGoogleId,
  createUser,
  linkGoogleToUser,
};
