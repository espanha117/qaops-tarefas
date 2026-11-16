import { Router } from 'express';

// Rota publica (sem requireAuth) consultada por ferramentas de monitoramento
// e pelo smoke test do pipeline: responde se o processo esta de pe e se o
// banco responde a uma consulta trivial.
export function createHealthRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const uptime = Math.round(process.uptime());
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', uptime, db: 'ok' });
    } catch {
      res.status(503).json({ status: 'erro', uptime, db: 'indisponivel' });
    }
  });

  return router;
}
