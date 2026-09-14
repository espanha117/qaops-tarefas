import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTasksRouter } from './routes/tasks.js';
import { createTaskService } from './services/taskService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db) {
  const app = express();
  const taskService = createTaskService(db);

  app.use(express.json());
  app.use('/api/tasks', createTasksRouter(taskService));
  app.use(express.static(path.join(__dirname, 'public')));

  return app;
}
