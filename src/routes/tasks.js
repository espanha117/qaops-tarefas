import { Router } from 'express';
import { ValidationError, NotFoundError } from '../services/taskService.js';

export function createTasksRouter(taskService) {
  const router = Router();

  router.get('/', (req, res, next) => {
    try {
      const { status } = req.query;
      res.json(taskService.list({ status }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      res.json(taskService.getById(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', (req, res, next) => {
    try {
      const created = taskService.create(req.body ?? {});
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', (req, res, next) => {
    try {
      const updated = taskService.update(Number(req.params.id), req.body ?? {});
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', (req, res, next) => {
    try {
      taskService.remove(Number(req.params.id));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  });

  return router;
}
