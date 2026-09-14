import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db.js';
import { createAuthService } from '../../src/services/authService.js';

let db;
let app;

beforeEach(() => {
  db = createDb(':memory:');
  createAuthService(db).createUser({ username: 'root', password: 'senha123', role: 'admin' });
  createAuthService(db).createUser({ username: 'alice', password: 'senha123', role: 'comum' });
  app = createApp(db);
});

async function loginAs(username, password) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password });
  return agent;
}

describe('GET /api/users', () => {
  it('retorna 401 sem sessao', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('retorna 403 para usuario comum', async () => {
    const agent = await loginAs('alice', 'senha123');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(403);
  });

  it('lista usuarios para admin', async () => {
    const agent = await loginAs('root', 'senha123');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((u) => u.password_hash === undefined)).toBe(true);
  });
});

describe('POST /api/users', () => {
  it('admin cria novo usuario comum', async () => {
    const agent = await loginAs('root', 'senha123');
    const res = await agent.post('/api/users').send({ username: 'bob', password: 'senha123', role: 'comum' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'bob', role: 'comum' });
  });

  it('usuario comum nao pode criar novos usuarios', async () => {
    const agent = await loginAs('alice', 'senha123');
    const res = await agent.post('/api/users').send({ username: 'bob', password: 'senha123' });
    expect(res.status).toBe(403);
  });

  it('retorna 400 para username duplicado', async () => {
    const agent = await loginAs('root', 'senha123');
    const res = await agent.post('/api/users').send({ username: 'alice', password: 'senha123' });
    expect(res.status).toBe(400);
  });
});
