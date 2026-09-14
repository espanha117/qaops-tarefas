import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
});

describe('POST /api/tasks', () => {
  it('cria tarefa valida e retorna 201', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Organizar estoque' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Organizar estoque', status: 'todo' });
  });

  it('retorna 400 para titulo vazio', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

describe('GET /api/tasks/:id', () => {
  it('retorna 404 para id inexistente', async () => {
    const res = await request(app).get('/api/tasks/9999');
    expect(res.status).toBe(404);
  });

  it('retorna a tarefa criada', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Conferir entrega' });
    const res = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Conferir entrega');
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('move para done e depois reabre, refletindo completed_at', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Emitir nota' });
    const id = created.body.id;

    const done = await request(app).patch(`/api/tasks/${id}`).send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.completed_at).not.toBeNull();

    const reopened = await request(app).patch(`/api/tasks/${id}`).send({ status: 'todo' });
    expect(reopened.body.completed_at).toBeNull();
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('remove a tarefa e passa a retornar 404', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Descartar rascunho' });
    const id = created.body.id;

    const del = await request(app).delete(`/api/tasks/${id}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/tasks/${id}`);
    expect(get.status).toBe(404);
  });
});
