import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db.js';
import { createAuthService } from '../../src/services/authService.js';
import { ValidationError, AuthError } from '../../src/errors.js';

let db;
let authService;

beforeEach(() => {
  db = createDb(':memory:');
  authService = createAuthService(db);
});

describe('createUser', () => {
  it('cria usuario comum por padrao, sem expor hash/salt', () => {
    const user = authService.createUser({ username: 'alice', password: 'senha123' });
    expect(user.role).toBe('comum');
    expect(user.password_hash).toBeUndefined();
    expect(user.password_salt).toBeUndefined();
  });

  it('cria usuario admin quando role informado', () => {
    const user = authService.createUser({ username: 'root', password: 'senha123', role: 'admin' });
    expect(user.role).toBe('admin');
  });

  it('rejeita username vazio', () => {
    expect(() => authService.createUser({ username: '  ', password: 'senha123' })).toThrow(ValidationError);
  });

  it('rejeita senha com menos de 6 caracteres', () => {
    expect(() => authService.createUser({ username: 'alice', password: '123' })).toThrow(ValidationError);
  });

  it('rejeita role invalido', () => {
    expect(() => authService.createUser({ username: 'alice', password: 'senha123', role: 'root' })).toThrow(
      ValidationError
    );
  });

  it('rejeita username duplicado', () => {
    authService.createUser({ username: 'alice', password: 'senha123' });
    expect(() => authService.createUser({ username: 'alice', password: 'outrasenha' })).toThrow(ValidationError);
  });
});

describe('verifyCredentials', () => {
  it('retorna o usuario quando a senha esta correta', () => {
    authService.createUser({ username: 'alice', password: 'senha123' });
    const user = authService.verifyCredentials('alice', 'senha123');
    expect(user.username).toBe('alice');
  });

  it('lanca AuthError para senha incorreta', () => {
    authService.createUser({ username: 'alice', password: 'senha123' });
    expect(() => authService.verifyCredentials('alice', 'senha-errada')).toThrow(AuthError);
  });

  it('lanca AuthError para usuario inexistente', () => {
    expect(() => authService.verifyCredentials('fantasma', 'qualquer')).toThrow(AuthError);
  });
});

describe('listUsers', () => {
  it('lista usuarios sem expor hash/salt', () => {
    authService.createUser({ username: 'alice', password: 'senha123' });
    authService.createUser({ username: 'root', password: 'senha123', role: 'admin' });

    const users = authService.listUsers();
    expect(users).toHaveLength(2);
    expect(users.every((u) => u.password_hash === undefined)).toBe(true);
  });
});

describe('countUsers', () => {
  it('conta usuarios cadastrados', () => {
    expect(authService.countUsers()).toBe(0);
    authService.createUser({ username: 'alice', password: 'senha123' });
    expect(authService.countUsers()).toBe(1);
  });
});
