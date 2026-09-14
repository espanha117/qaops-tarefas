import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ValidationError, AuthError } from '../errors.js';

const ROLES = ['admin', 'comum'];
const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const stored = Buffer.from(hash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

function toPublicUser(row) {
  if (!row) return null;
  return { id: row.id, username: row.username, role: row.role, created_at: row.created_at };
}

function validateNewUserPayload(payload) {
  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  if (!username) {
    throw new ValidationError('username e obrigatorio e nao pode ser vazio.');
  }
  if (username.length > 50) {
    throw new ValidationError('username deve ter no maximo 50 caracteres.');
  }

  const password = typeof payload.password === 'string' ? payload.password : '';
  if (password.length < 6) {
    throw new ValidationError('password deve ter no minimo 6 caracteres.');
  }

  const role = payload.role ?? 'comum';
  if (!ROLES.includes(role)) {
    throw new ValidationError(`role deve ser um de: ${ROLES.join(', ')}.`);
  }

  return { username, password, role };
}

export function createAuthService(db) {
  function findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  function findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  function listUsers() {
    return db
      .prepare('SELECT id, username, role, created_at FROM users ORDER BY id')
      .all();
  }

  function createUser(payload) {
    const data = validateNewUserPayload(payload);

    if (findByUsername(data.username)) {
      throw new ValidationError('username ja esta em uso.');
    }

    const { hash, salt } = hashPassword(data.password);
    const createdAt = new Date().toISOString();

    const result = db
      .prepare(
        `INSERT INTO users (username, password_hash, password_salt, role, created_at)
         VALUES (@username, @password_hash, @password_salt, @role, @created_at)`
      )
      .run({
        username: data.username,
        password_hash: hash,
        password_salt: salt,
        role: data.role,
        created_at: createdAt,
      });

    return toPublicUser(findById(result.lastInsertRowid));
  }

  function verifyCredentials(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new AuthError('Credenciais invalidas.');
    }
    const user = findByUsername(username.trim());
    if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
      throw new AuthError('Credenciais invalidas.');
    }
    return toPublicUser(user);
  }

  function countUsers() {
    return db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  }

  return { createUser, verifyCredentials, listUsers, findById, countUsers, toPublicUser };
}
