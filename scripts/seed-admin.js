import { createDb, defaultDbPath } from '../src/db.js';
import { createAuthService } from '../src/services/authService.js';
import { ValidationError } from '../src/errors.js';

// Cria (ou confirma que ja existe) o primeiro usuario admin, sem nenhuma
// credencial fixa no codigo-fonte: username/password vem de env vars ou de
// flags de linha de comando, nunca de um valor default commitado no repo.
//
// Uso:
//   ADMIN_USERNAME=admin ADMIN_PASSWORD=troque-esta-senha npm run seed:admin
//   npm run seed:admin -- --username admin --password troque-esta-senha

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--username') args.username = argv[i + 1];
    if (argv[i] === '--password') args.password = argv[i + 1];
    if (argv[i] === '--role') args.role = argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username ?? process.env.ADMIN_USERNAME;
  const password = args.password ?? process.env.ADMIN_PASSWORD;
  const role = args.role ?? 'admin';

  if (!username || !password) {
    console.error(
      'Informe usuario e senha via ADMIN_USERNAME/ADMIN_PASSWORD (env) ou --username/--password (flags).'
    );
    process.exitCode = 1;
    return;
  }

  const db = createDb(defaultDbPath());
  const authService = createAuthService(db);

  try {
    const user = authService.createUser({ username, password, role });
    console.log(`Usuario "${user.username}" (${user.role}) criado com sucesso.`);
  } catch (err) {
    if (err instanceof ValidationError) {
      console.error(`Nao foi possivel criar o usuario: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main();
