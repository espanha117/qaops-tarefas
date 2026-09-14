import { Router } from 'express';
import { ValidationError } from '../errors.js';

export function createUsersRouter({ authService, requireAuth, requireAdmin }) {
  const router = Router();

  router.use(requireAuth, requireAdmin);

  router.get('/', (req, res) => {
    res.json(authService.listUsers());
  });

  router.post('/', (req, res, next) => {
    try {
      const created = authService.createUser(req.body ?? {});
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  });

  return router;
}
