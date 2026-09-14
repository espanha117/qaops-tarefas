import { createDb, defaultDbPath } from '../src/db.js';

// Roda uma query SQL direto contra data/tasks.db pelo terminal, sem precisar
// instalar o CLI do sqlite3. Uso:
//   npm run db:query -- "SELECT * FROM users"
//   npm run db:query -- "DELETE FROM sessions"

function main() {
  const sql = process.argv.slice(2).join(' ').trim();
  if (!sql) {
    console.error('Uso: npm run db:query -- "SELECT * FROM users"');
    process.exitCode = 1;
    return;
  }

  const db = createDb(defaultDbPath());
  const stmt = db.prepare(sql);

  if (/^\s*(select|pragma)/i.test(sql)) {
    const rows = stmt.all();
    console.table(rows.length ? rows : ['(0 linhas)']);
  } else {
    const result = stmt.run();
    console.log(`OK - ${result.changes} linha(s) afetada(s).`);
  }
}

main();
