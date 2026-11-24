import { createApp } from './app.js';
import { createDb, defaultDbPath } from './db.js';
import { createMetrics } from './metrics.js';

const db = createDb(defaultDbPath());
const metrics = createMetrics();
const app = createApp(db, { metrics });

const PORT = process.env.PORT || 3000;
const METRICS_PORT = process.env.METRICS_PORT || 9464;

app.listen(PORT, () => {
  console.log(`qaops-tarefas rodando em http://localhost:${PORT}`);
});

metrics.createMetricsApp().listen(METRICS_PORT, () => {
  console.log(`Metricas para o Prometheus em http://localhost:${METRICS_PORT}/metrics`);
});
