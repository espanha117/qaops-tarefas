# QAOps Tarefas

Gerenciador de tarefas standalone (Kanban simples), construído como sistema-base para o trabalho prático de DevOps/QAOps. É um produto independente: código, dependências e banco de dados próprios — não compartilha nada com nenhum outro sistema.

Tem login obrigatório e dois tipos de usuário: **admin** (vê e gerencia as tarefas de todos) e **comum** (vê e gerencia só as próprias).

## Stack

- Node.js (>= 22.5) + Express
- Banco de dados: SQLite via módulo nativo `node:sqlite` (sem dependências externas para persistência, sem passo de compilação) — tabelas de tarefas, usuários e sessões
- Autenticação: sessão via cookie `HttpOnly`, senha com hash `scrypt` (`node:crypto`) — sem framework de auth externo
- Testes: Vitest (unitários + integração via Supertest) e cobertura (`@vitest/coverage-v8`)
- Lint: ESLint (flat config)
- Frontend: HTML/CSS/JS puro, servido como estático pelo próprio Express

## Instalação e execução

```bash
npm install
```

O banco SQLite é criado automaticamente em `data/tasks.db` no primeiro start — não é necessário nenhum serviço externo. É necessário, porém, um usuário administrador para poder entrar no sistema; nenhuma credencial fica no repositório, então crie a sua localmente antes do primeiro start:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=escolha-uma-senha npm start
```

Nas próximas vezes (o admin já existe no banco), basta `npm start`. Se preferir criar o admin separadamente do start (ou criar um segundo admin), use:

```bash
npm run seed:admin -- --username admin --password escolha-uma-senha
```

A aplicação sobe em `http://localhost:3000` (porta configurável via `PORT`, ver `.env.example`). Qualquer pessoa pode criar a própria conta em `/register.html` (sempre como usuário **comum**); usuários **admin** só são criados por outro admin já logado, no botão **Usuários** da barra superior (ou pelo bootstrap inicial via env vars).

Para desenvolvimento com reload automático:

```bash
npm run dev
```

## Testes e qualidade (comandos usados também no pipeline de CI)

```bash
npm run lint       # análise estática (ESLint)
npm test           # testes unitários + integração (Vitest)
npm run coverage   # testes + relatório de cobertura, com limiar mínimo obrigatório
npm audit --audit-level=high   # auditoria de dependências
```

## Funcionalidade e regras de negócio (comportamento verificável)

CRUD de tarefas organizadas em um Kanban de 3 colunas (`todo` / `doing` / `done`):

- `title` é obrigatório, não pode ser vazio e tem no máximo 200 caracteres.
- `status` só aceita `todo`, `doing` ou `done`.
- `priority` só aceita `low`, `medium` ou `high`.
- `due_date`, se informado, precisa ser uma data válida.
- Mover uma tarefa para `done` registra `completed_at`; mover para fora de `done` limpa esse campo.
- Toda tarefa pertence ao usuário que a criou (`owner_id`). Usuário **comum** só lista/acessa/edita/remove as próprias tarefas (as demais retornam `403`); usuário **admin** tem acesso a todas.
- Todas as rotas de `/api/tasks` e `/api/users` exigem sessão autenticada (`401` sem cookie de sessão válido).

### API — autenticação (`/api/auth`)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | `{ username, password }` → cria usuário **comum** (público, sem exigir admin), já autentica (`201` + cookie de sessão) |
| POST | `/api/auth/login` | `{ username, password }` → `200` + cookie de sessão, ou `401` |
| POST | `/api/auth/logout` | Invalida a sessão atual (`204`) |
| GET | `/api/auth/me` | Usuário autenticado (`200`) ou `401` |

### API — usuários (`/api/users`, somente admin)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/users` | Lista usuários (`403` se não for admin) |
| POST | `/api/users` | Cria usuário `{ username, password, role }` (`role`: `admin` ou `comum`) |

### API — tarefas (`/api/tasks`, autenticado)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tasks` | Lista tarefas visíveis ao usuário logado (aceita `?status=`) |
| GET | `/api/tasks/:id` | Detalha uma tarefa (`404` se não existir, `403` se for de outro usuário comum) |
| POST | `/api/tasks` | Cria uma tarefa vinculada ao usuário logado (`400` se inválida) |
| PATCH | `/api/tasks/:id` | Atualiza campos de uma tarefa (`403` se for de outro usuário comum) |
| DELETE | `/api/tasks/:id` | Remove uma tarefa (`403` se for de outro usuário comum) |

## Pipeline de qualidade (CI)

Definido em [`.github/workflows/ci.yml`](.github/workflows/ci.yml), disparado em todo `push` e `pull_request`. Cinco gates sequenciais, cada um bloqueando o pipeline se falhar — detalhes de critério/justificativa/evidência/consequência no relatório técnico ([`RELATORIO.md`](RELATORIO.md), seção 6):

1. Instalação de dependências (`npm ci`)
2. Análise estática (`npm run lint`)
3. Testes automatizados (`npm test`)
4. Cobertura mínima (`npm run coverage`)
5. Auditoria de dependências (`npm audit --audit-level=high`)

O relatório de cobertura é publicado como artifact da execução no GitHub Actions.

## Inspecionar o banco (SQLite)

O arquivo é `data/tasks.db`. Duas formas de olhar/alterar o conteúdo direto, sem precisar instalar nada além do que o projeto já usa:

```bash
npm run db:query -- "SELECT id, username, role FROM users"
npm run db:query -- "DELETE FROM sessions"
```

Se preferir uma interface visual, o [DB Browser for SQLite](https://sqlitebrowser.org/) (gratuito) abre `data/tasks.db` diretamente — feche o servidor (`npm start`/`npm run dev`) antes de editar dados por lá para evitar concorrência de escrita.

## Segurança

Nenhuma credencial, dado pessoal ou segredo é necessário para **instalar** este projeto, e nenhum é commitado no repositório — o banco é um arquivo SQLite local, gerado automaticamente e ignorado pelo Git (`.gitignore`). Para **rodar** é preciso um usuário admin, criado localmente a partir de variáveis de ambiente (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, ver seção de instalação) — nunca de um valor fixo no código.

Senhas são armazenadas como hash `scrypt` com salt aleatório por usuário (`node:crypto`, sem dependência externa); sessões usam um token aleatório de 32 bytes em cookie `HttpOnly`/`SameSite=Lax`, expirando em 7 dias ou no logout.

## Estrutura do projeto

```
src/
  server.js                 # bootstrap do servidor HTTP
  app.js                    # factory do Express app (usado também pelos testes)
  db.js                     # criação/schema do banco SQLite (tasks, users, sessions)
  errors.js                 # classes de erro compartilhadas (Validation/NotFound/Forbidden/Auth)
  middleware/auth.js         # parsing de cookie, requireAuth, requireAdmin
  routes/
    tasks.js                # endpoints REST de tarefas (autenticado, filtrado por dono)
    auth.js                 # login/logout/me
    users.js                # gestão de usuários (somente admin)
  services/
    taskService.js          # regras de negócio de tarefas (validação, transição de status, dono)
    authService.js           # criação de usuário, hash/verificação de senha
    sessionService.js        # criação/validação/expiração de sessão
  public/                    # frontend estático (login + Kanban)
scripts/
  seed-admin.js              # cria o primeiro usuário admin fora do bootstrap automático
test/
  unit/                      # testes de services isolados (DB em memória)
  integration/                # testes de API via Supertest (auth, users, tasks)
```

## Equipe

| Integrante | Contribuição |
|---|---|
| _Integrante 1 (nome completo)_ | _a preencher_ |
| _Integrante 2 (nome completo)_ | _a preencher_ |

Detalhes de contribuição individual no relatório técnico (`RELATORIO.md`, seção 9).
