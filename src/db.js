import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Usa o modulo nativo node:sqlite (built-in a partir do Node.js 22.5) de proposito:
// zero dependencias externas para persistencia, nada para compilar/instalar,
// o que elimina uma classe inteira de falha de "instalacao reproduzivel".
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','comum')) DEFAULT 'comum',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('todo','doing','done')) DEFAULT 'todo',
  priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
  assignee TEXT,
  due_date TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
`;

// tasks.owner_id foi adicionado depois da versao inicial do schema; bancos
// ja existentes (locais, criados antes desta mudanca) precisam de migracao
// idempotente via ALTER TABLE, ja que CREATE TABLE IF NOT EXISTS nao altera
// tabelas que ja existem.
function migrate(db) {
  const columns = db.prepare('PRAGMA table_info(tasks)').all();
  const hasOwnerId = columns.some((col) => col.name === 'owner_id');
  if (!hasOwnerId) {
    db.exec('ALTER TABLE tasks ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
  }
}

export function createDb(filePath = ':memory:') {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function defaultDbPath() {
  return path.join(__dirname, '..', 'data', 'tasks.db');
}
