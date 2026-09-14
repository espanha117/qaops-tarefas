import { createApp } from './app.js';
import { createDb, defaultDbPath } from './db.js';

const db = createDb(defaultDbPath());
const app = createApp(db);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`qaops-tarefas rodando em http://localhost:${PORT}`);
});
