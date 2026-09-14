import { Router } from 'express';
import { AuthError, ValidationError } from '../errors.js';
import { setSessionCookie, clearSessionCookie, getSessionIdFromRequest } from '../middleware/auth.js';

export function createAuthRouter({ authService, sessionService, requireAuth }) {
  const router = Router();

  router.post('/register', (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      // Cadastro publico sempre cria usuario 'comum' - qualquer 'role' enviado
      // no corpo da requisicao e ignorado de proposito, para que ninguem vire
      // admin so por ter acesso a esta rota sem autenticacao.
      const user = authService.createUser({ username, password, role: 'comum' });
      const session = sessionService.createSession(user.id);
      setSessionCookie(res, session.id);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  });

  router.post('/login', (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      const user = authService.verifyCredentials(username, password);
      const session = sessionService.createSession(user.id);
      setSessionCookie(res, session.id);
      res.json(user);
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(401).json({ error: err.message });
      }
      next(err);
    }
  });

  router.post('/logout', (req, res) => {
    const sessionId = getSessionIdFromRequest(req);
    if (sessionId) {
      sessionService.deleteSession(sessionId);
    }
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json(req.user);
  });

  return router;
}
