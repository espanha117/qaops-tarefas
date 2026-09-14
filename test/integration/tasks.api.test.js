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
  createAuthService(db).createUser({ username: 'bob', password: 'senha123', role: 'comum' });
  app = createApp(db);
});

async function loginAs(username, password = 'senha123') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return agent;
}

describe('autenticacao exigida em /api/tasks', () => {
  it('retorna 401 sem sessao', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/tasks', () => {
  it('cria tarefa valida e retorna 201, vinculada ao usuario logado', async () => {
    const agent = await loginAs('alice');
    const res = await agent.post('/api/tasks').send({ title: 'Organizar estoque' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Organizar estoque', status: 'todo', owner_username: 'alice' });
  });

  it('retorna 400 para titulo vazio', async () => {
    const agent = await loginAs('alice');
    const res = await agent.post('/api/tasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

describe('GET /api/tasks', () => {
  it('usuario comum ve apenas suas proprias tarefas', async () => {
    const alice = await loginAs('alice');
    const bob = await loginAs('bob');
    await alice.post('/api/tasks').send({ title: 'Tarefa da Alice' });
    await bob.post('/api/tasks').send({ title: 'Tarefa do Bob' });

    const res = await alice.get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Tarefa da Alice');
  });

  it('admin ve tarefas de todos os usuarios', async () => {
    const alice = await loginAs('alice');
    const bob = await loginAs('bob');
    const admin = await loginAs('root');
    await alice.post('/api/tasks').send({ title: 'Tarefa da Alice' });
    await bob.post('/api/tasks').send({ title: 'Tarefa do Bob' });

    const res = await admin.get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /api/tasks/:id', () => {
  it('retorna 404 para id inexistente', async () => {
    const agent = await loginAs('alice');
    const res = await agent.get('/api/tasks/9999');
    expect(res.status).toBe(404);
  });

  it('retorna a tarefa criada para o proprio dono', async () => {
    const agent = await loginAs('alice');
    const created = await agent.post('/api/tasks').send({ title: 'Conferir entrega' });
    const res = await agent.get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Conferir entrega');
  });

  it('retorna 403 quando outro usuario comum tenta acessar', async () => {
    const alice = await loginAs('alice');
    const bob = await loginAs('bob');
    const created = await alice.post('/api/tasks').send({ title: 'Conferir entrega' });

    const res = await bob.get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(403);
  });

  it('admin acessa tarefa de qualquer usuario', async () => {
    const alice = await loginAs('alice');
    const admin = await loginAs('root');
    const created = await alice.post('/api/tasks').send({ title: 'Conferir entrega' });

    const res = await admin.get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('move para done e depois reabre, refletindo completed_at', async () => {
    const agent = await loginAs('alice');
    const created = await agent.post('/api/tasks').send({ title: 'Emitir nota' });
    const id = created.body.id;

    const done = await agent.patch(`/api/tasks/${id}`).send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.completed_at).not.toBeNull();

    const reopened = await agent.patch(`/api/tasks/${id}`).send({ status: 'todo' });
    expect(reopened.body.completed_at).toBeNull();
  });

  it('retorna 403 quando outro usuario comum tenta atualizar', async () => {
    const alice = await loginAs('alice');
    const bob = await loginAs('bob');
    const created = await alice.post('/api/tasks').send({ title: 'Emitir nota' });

    const res = await bob.patch(`/api/tasks/${created.body.id}`).send({ status: 'done' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('remove a tarefa e passa a retornar 404', async () => {
    const agent = await loginAs('alice');
    const created = await agent.post('/api/tasks').send({ title: 'Descartar rascunho' });
    const id = created.body.id;

    const del = await agent.delete(`/api/tasks/${id}`);
    expect(del.status).toBe(204);

    const get = await agent.get(`/api/tasks/${id}`);
    expect(get.status).toBe(404);
  });

  it('retorna 403 quando outro usuario comum tenta remover', async () => {
    const alice = await loginAs('alice');
    const bob = await loginAs('bob');
    const created = await alice.post('/api/tasks').send({ title: 'Descartar rascunho' });

    const res = await bob.delete(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(403);
  });
});
