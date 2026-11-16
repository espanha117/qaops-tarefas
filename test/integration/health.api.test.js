import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db.js';

let db;
let app;

beforeEach(() => {
  db = createDb(':memory:');
  app = createApp(db);
});

describe('GET /health', () => {
  it('responde 200 sem exigir sessao quando o banco esta disponivel', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(typeof res.body.uptime).toBe('number');
  });

  it('responde 503 quando o banco nao responde', async () => {
    db.close();
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'erro', db: 'indisponivel' });
  });
});
