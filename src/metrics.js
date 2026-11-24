import express from 'express';
import client from 'prom-client';

// Metricas expostas em /metrics para o Prometheus coletar.
// Cada app tem o seu proprio registro (em vez do global do prom-client) para
// que os testes possam criar varias instancias sem "metrica ja registrada".
export function createMetrics() {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const requisicoes = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duracao das requisicoes HTTP, por metodo, rota e codigo de status',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [register],
  });

  // Usa o padrao da rota (/api/tasks/:id), nunca a URL real (/api/tasks/42):
  // senao cada id viraria uma serie nova no Prometheus.
  function middleware(req, res, next) {
    const fim = requisicoes.startTimer();
    res.on('finish', () => {
      const rota = req.route
        ? `${req.baseUrl}${req.route.path}`
        : req.baseUrl || 'outra'; // ex.: 401 do middleware de login, antes da rota
      fim({ method: req.method, route: rota, status: String(res.statusCode) });
    });
    next();
  }

  async function handler(req, res) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }

  // Servidor so para o Prometheus, numa porta propria (padrao 9464). No
  // docker-compose essa porta nao e publicada: so o Prometheus, na rede
  // interna, consegue ler /metrics.
  function createMetricsApp() {
    const metricsApp = express();
    metricsApp.get('/metrics', handler);
    return metricsApp;
  }

  return { middleware, handler, register, createMetricsApp };
}
