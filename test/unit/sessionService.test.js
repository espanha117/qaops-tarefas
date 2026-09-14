import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db.js';
import { createAuthService } from '../../src/services/authService.js';
import { createSessionService } from '../../src/services/sessionService.js';

let db;
let authService;
let sessionService;
let alice;

beforeEach(() => {
  db = createDb(':memory:');
  authService = createAuthService(db);
  sessionService = createSessionService(db);
  alice = authService.createUser({ username: 'alice', password: 'senha123' });
});

describe('createSession / getSessionUser', () => {
  it('cria uma sessao e resolve o usuario correspondente', () => {
    const session = sessionService.createSession(alice.id);
    const user = sessionService.getSessionUser(session.id);
    expect(user).toMatchObject({ id: alice.id, username: 'alice', role: 'comum' });
  });

  it('retorna null para sessao inexistente', () => {
    expect(sessionService.getSessionUser('token-invalido')).toBeNull();
  });

  it('retorna null quando nenhum id de sessao e informado', () => {
    expect(sessionService.getSessionUser(undefined)).toBeNull();
  });

  it('retorna null e remove a sessao quando ela ja expirou', () => {
    const session = sessionService.createSession(alice.id);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      session.id
    );

    expect(sessionService.getSessionUser(session.id)).toBeNull();
    expect(db.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id)).toBeUndefined();
  });
});

describe('deleteSession', () => {
  it('invalida a sessao (logout)', () => {
    const session = sessionService.createSession(alice.id);
    sessionService.deleteSession(session.id);
    expect(sessionService.getSessionUser(session.id)).toBeNull();
  });
});
