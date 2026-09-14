import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Usa o modulo nativo node:sqlite (built-in a partir do Node.js 22.5) de proposito:
// zero dependencias externas para persistencia, nada para compilar/instalar,
// o que elimina uma classe inteira de falha de "instalacao reproduzivel".
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('todo','doing','done')) DEFAULT 'todo',
  priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
  assignee TEXT,
  due_date TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
`;

export function createDb(filePath = ':memory:') {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec(SCHEMA);
  return db;
}

export function defaultDbPath() {
  return path.join(__dirname, '..', 'data', 'tasks.db');
}
