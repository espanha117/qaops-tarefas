import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db.js';
import { createAuthService } from '../../src/services/authService.js';

let db;
let app;

beforeEach(() => {
  db = createDb(':memory:');
  createAuthService(db).createUser({ username: 'alice', password: 'senha123', role: 'comum' });
  app = createApp(db);
});

describe('POST /api/auth/register', () => {
  it('cria conta publica como usuario comum e ja autentica', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send({ username: 'bob', password: 'senha123' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'bob', role: 'comum' });
    expect(res.headers['set-cookie'][0]).toMatch(/^sid=/);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('bob');
  });

  it('ignora role enviado no corpo - cadastro publico nunca cria admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'senha123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('comum');
  });

  it('retorna 400 para senha curta', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'bob', password: '123' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 para username ja existente', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'alice', password: 'senha123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('autentica com credenciais validas e define cookie de sessao', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'senha123' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'alice', role: 'comum' });
    expect(res.headers['set-cookie'][0]).toMatch(/^sid=/);
  });

  it('retorna 401 para senha incorreta', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'errada' });
    expect(res.status).toBe(401);
  });

  it('retorna 401 para usuario inexistente', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'fantasma', password: 'senha123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('retorna 401 sem sessao', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('retorna o usuario autenticado com sessao valida', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'senha123' });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });
});

describe('POST /api/auth/logout', () => {
  it('invalida a sessao apos logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'senha123' });

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('retorna 204 mesmo sem sessao ativa', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});
