import { randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function createSessionService(db) {
  function createSession(userId) {
    const id = randomBytes(32).toString('hex');
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();

    db.prepare(
      `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
    ).run(id, userId, createdAt, expiresAt);

    return { id, expiresAt };
  }

  function getSessionUser(sessionId) {
    if (!sessionId) return null;

    const row = db
      .prepare(
        `SELECT users.id AS id, users.username AS username, users.role AS role, sessions.expires_at AS expires_at
         FROM sessions JOIN users ON users.id = sessions.user_id
         WHERE sessions.id = ?`
      )
      .get(sessionId);

    if (!row) return null;

    if (new Date(row.expires_at).getTime() < Date.now()) {
      deleteSession(sessionId);
      return null;
    }

    return { id: row.id, username: row.username, role: row.role };
  }

  function deleteSession(sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  return { createSession, getSessionUser, deleteSession };
}
