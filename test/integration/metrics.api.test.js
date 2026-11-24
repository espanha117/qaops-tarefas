import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db.js';
import { createMetrics } from '../../src/metrics.js';

let app;
let metricsApp;

beforeEach(() => {
  const metrics = createMetrics();
  app = createApp(createDb(':memory:'), { metrics });
  metricsApp = metrics.createMetricsApp();
});

describe('Metricas para o Prometheus', () => {
  it('expoe /metrics no servidor de metricas, no formato do Prometheus', async () => {
    const res = await request(metricsApp).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('process_cpu_seconds_total');
  });

  it('nao expoe /metrics na porta publica da aplicacao', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(404);
  });

  it('conta as requisicoes pelo padrao da rota e pelo status', async () => {
    await request(app).get('/health');
    await request(app).get('/api/tasks'); // sem sessao -> 401
    const res = await request(metricsApp).get('/metrics');
    expect(res.text).toMatch(/http_request_duration_seconds_count\{method="GET",route="\/health\/",status="200"\} 1/);
    expect(res.text).toMatch(/route="\/api\/tasks",status="401"/);
  });
});
