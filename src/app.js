import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTasksRouter } from './routes/tasks.js';
import { createAuthRouter } from './routes/auth.js';
import { createUsersRouter } from './routes/users.js';
import { createTaskService } from './services/taskService.js';
import { createAuthService } from './services/authService.js';
import { createSessionService } from './services/sessionService.js';
import { createAuthMiddleware } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cria o usuario admin inicial a partir de variaveis de ambiente, nunca de um
// valor fixo no codigo: sem ADMIN_USERNAME/ADMIN_PASSWORD definidos, nenhum
// usuario e criado (nada de credencial padrao "admin/admin123" no repositorio).
export function bootstrapAdmin(authService, env = process.env) {
  if (authService.countUsers() > 0) return;

  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn(
      'Nenhum usuario cadastrado e ADMIN_USERNAME/ADMIN_PASSWORD nao foram definidos: ' +
        'defina-os no .env e reinicie, ou rode "npm run seed:admin", para criar o primeiro administrador.'
    );
    return;
  }

  authService.createUser({ username, password, role: 'admin' });
  console.log(`Usuario admin "${username}" criado a partir de ADMIN_USERNAME/ADMIN_PASSWORD.`);
}

export function createApp(db) {
  const app = express();

  const taskService = createTaskService(db);
  const authService = createAuthService(db);
  const sessionService = createSessionService(db);
  const { requireAuth, requireAdmin } = createAuthMiddleware(sessionService);

  bootstrapAdmin(authService);

  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ authService, sessionService, requireAuth }));
  app.use('/api/users', createUsersRouter({ authService, requireAuth, requireAdmin }));
  app.use('/api/tasks', createTasksRouter(taskService, { requireAuth }));
  app.use(express.static(path.join(__dirname, 'public')));

  return app;
}
