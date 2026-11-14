/**
 * CampusPulse - Server Authentication & Session Management
 */

const crypto = require('node:crypto');
const { getDb } = require('./db.js');

function login(email, password, requestedRole = 'student') {
  const db = getDb();
  const cleanEmail = (email || '').trim().toLowerCase();

  let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

  // If user does not exist yet, automatically register them
  if (!user) {
    const role = requestedRole === 'admin' || cleanEmail.includes('admin') || cleanEmail.includes('anita') 
      ? 'admin' 
      : 'student';
    
    const name = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Campus Member';
    const department = role === 'admin' ? 'Facility Operations Desk' : 'Student Body';
    const room = role === 'admin' ? 'Central Admin Wing' : 'Campus Hostel';
    const avatar = role === 'admin' ? 'AD' : 'ST';
    const nowIso = new Date().toISOString();

    const insertResult = db.prepare(`
      INSERT INTO users (email, name, role, department, room, avatar, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cleanEmail, name, role, department, room, avatar, password || 'defaultPass', nowIso);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(insertResult.lastInsertRowid);
  }

  // Generate a cryptographically secure session token
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + 7 * 24 * 3600 * 1000).toISOString(); // 7 days validity

  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, user.id, new Date(now).toISOString(), expiresAt);

  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    room: user.room,
    avatar: user.avatar
  };

  return { token, user: safeUser };
}

function verifySession(token) {
  if (!token) return null;
  const db = getDb();

  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.email, u.name, u.role, u.department, u.room, u.avatar
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    department: session.department,
    room: session.room,
    avatar: session.avatar
  };
}

function logout(token) {
  if (!token) return;
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

module.exports = {
  login,
  verifySession,
  logout
};
