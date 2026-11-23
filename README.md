# QAOps Tarefas

Trabalho prático da disciplina de Qualidade de Software do curso de Sistemas de Informação, UFSM (campus Frederico Westphalen), ministrada pelo Prof. Dr. Joel da Silva.

Gerenciador de tarefas standalone (Kanban simples), construído como sistema-base para o trabalho prático de DevOps/QAOps. É um produto independente: código, dependências e banco de dados próprios — não compartilha nada com nenhum outro sistema.

Tem login obrigatório e dois tipos de usuário: **admin** (vê e gerencia as tarefas de todos) e **comum** (vê e gerencia só as próprias).

## Stack

- Node.js (>= 22.5) + Express
- Banco de dados: SQLite via módulo nativo `node:sqlite` (sem dependências externas para persistência, sem passo de compilação) — tabelas de tarefas, usuários e sessões
- Autenticação: sessão via cookie `HttpOnly`, senha com hash `scrypt` (`node:crypto`) — sem framework de auth externo
- Testes: Vitest (unitários + integração via Supertest) e cobertura (`@vitest/coverage-v8`)
- Lint: ESLint (flat config)
- Frontend: HTML/CSS/JS puro, servido como estático pelo próprio Express

## Pré-requisitos

- Node.js 22.5 ou superior (necessário para o módulo nativo `node:sqlite`)
- npm (instalado junto com o Node.js)
- Git, para clonar o repositório

Para conferir a versão instalada: `node -v`

## Instalação e execução

```bash
npm install
```

O banco SQLite é criado automaticamente em `data/tasks.db` no primeiro start, não é necessário nenhum serviço externo. É necessário, porém, um usuário administrador para poder entrar no sistema; nenhuma credencial fica no repositório, então crie a sua localmente antes do primeiro start:

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

Definido em [`.github/workflows/ci.yml`](.github/workflows/ci.yml), disparado em todo `push` e `pull_request`. Seis gates sequenciais, cada um bloqueando o pipeline se falhar — detalhes de critério/justificativa/evidência/consequência no relatório técnico ([`RELATORIO.md`](RELATORIO.md), seção 6):

1. Instalação de dependências (`npm ci`)
2. Análise estática (`npm run lint`)
3. Testes automatizados (`npm test`)
4. Cobertura mínima (`npm run coverage`)
5. Auditoria de dependências (`npm audit --audit-level=high`)
6. Smoke test: sobe a aplicação e confere `GET /health`

O pipeline também roda toda segunda-feira (execução agendada), mesmo sem commits, e o Dependabot abre PRs semanais de atualização de dependências.

Depois dos gates, um segundo job (`deploy`) implanta a versão aprovada numa VM. Ele só roda em push na `master` e fica desligado até a VM ser configurada (ver [Deploy na VM](#deploy-na-vm)).

O relatório de cobertura é publicado como artifact da execução no GitHub Actions.

## Monitoramento

`GET /health` é público e responde `200` com `{ "status": "ok", "uptime": <segundos>, "db": "ok" }`, ou `503` se o banco não responder. É o endereço usado pelo smoke test do pipeline e por qualquer ferramenta de monitoramento de disponibilidade.

## Deploy na VM

O job `deploy` do [`ci.yml`](.github/workflows/ci.yml) roda depois que os 6 gates aprovam, só em push na `master` (nunca em PR nem na execução agendada):

1. entra na VM por SSH e anota a versão que está rodando;
2. executa [`scripts/deploy.sh`](scripts/deploy.sh) na VM: `git reset --hard` para o commit aprovado, `npm ci --omit=dev` e `systemctl restart qaops-tarefas`. O banco (`data/tasks.db`) é ignorado pelo Git e não é apagado;
3. chama `/health` na VM por até 60 s;
4. se a verificação falhar, faz **rollback** para a versão anterior com o mesmo script.

Cada deploy fica registrado no ambiente `producao` (aba **Deployments** do repositório).

### Preparar a VM (uma vez)

1. Instalar Node.js 22.5 ou superior, `git` e `curl`.
2. Criar um usuário para o deploy (ex.: `deploy`) e, com ele, clonar o repositório e instalar: `git clone https://github.com/espanha117/qaops-tarefas.git && cd qaops-tarefas && npm ci --omit=dev`.
3. Criar `/etc/qaops-tarefas.env` (fora do repositório, legível só pelo root e pelo serviço) com `PORT=3000`, `ADMIN_USERNAME=...` e `ADMIN_PASSWORD=...`.
4. Instalar o serviço a partir do modelo [`deploy/qaops-tarefas.service`](deploy/qaops-tarefas.service) (ajustar usuário, pasta e caminho do `node`) e ativar: `sudo systemctl enable --now qaops-tarefas`.
5. Permitir que o usuário de deploy reinicie **só** esse serviço sem senha, com `sudo visudo -f /etc/sudoers.d/qaops-tarefas`:
   `deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart qaops-tarefas` (confira o caminho com `which systemctl`).
6. Gerar um par de chaves SSH só para o deploy (`ssh-keygen -t ed25519 -f qaops-deploy -N ""`) e colocar a chave pública em `~deploy/.ssh/authorized_keys`.
7. Conferir: `curl http://localhost:3000/health` deve responder `{"status":"ok",...}`.

### Configurar o GitHub (Settings → Secrets and variables → Actions)

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `VM_HOST` | IP ou nome da VM |
| Secret | `VM_USER` | usuário de deploy (ex.: `deploy`) |
| Secret | `VM_SSH_KEY` | conteúdo da chave **privada** gerada no passo 6 |
| Secret | `VM_SSH_KNOWN_HOSTS` | saída de `ssh-keyscan -p <porta> <host>` rodado de uma máquina confiável |
| Variable | `DEPLOY_ENABLED` | `true` (liga o job) |
| Variable (opcional) | `VM_SSH_PORT` | porta do SSH, se não for 22 |
| Variable (opcional) | `VM_APP_DIR` | pasta da aplicação, se não for `~/qaops-tarefas` |
| Variable (opcional) | `VM_APP_PORT` | porta da aplicação, se não for 3000 |
| Variable (opcional) | `APP_URL` | endereço público, aparece como link no deploy |

IP, usuário, chaves e senhas ficam só nos secrets do GitHub e na VM, nunca no repositório. A VM precisa aceitar SSH vindo da internet (os runners do GitHub Actions não estão na rede local). Se isso não for possível, a alternativa é instalar um *self-hosted runner* na própria VM.

### Monitoramento

O `/health` é público e não exige login, então qualquer ferramenta de monitoramento de disponibilidade pode consultá-lo. Os logs da aplicação vão para o journal do systemd (`journalctl -u qaops-tarefas`).

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
    health.js               # GET /health (público, usado pelo monitoramento)
  services/
    taskService.js          # regras de negócio de tarefas (validação, transição de status, dono)
    authService.js           # criação de usuário, hash/verificação de senha
    sessionService.js        # criação/validação/expiração de sessão
  public/                    # frontend estático (login + Kanban)
scripts/
  seed-admin.js              # cria o primeiro usuário admin fora do bootstrap automático
  db-query.js                # consulta/altera o banco pela linha de comando
  deploy.sh                  # executado na VM pelo job de deploy (e no rollback)
deploy/
  qaops-tarefas.service      # modelo de serviço systemd para a VM
test/
  unit/                      # testes de services isolados (DB em memória)
  integration/                # testes de API via Supertest (auth, users, tasks, health)
```

## Como contribuir

1. Crie uma branch a partir da `master`: `git checkout -b minha-alteracao`
2. Faça as alterações e rode localmente `npm run lint` e `npm test`
3. Faça o commit com uma mensagem descritiva e envie a branch
4. Abra um Pull Request; o pipeline de CI precisa passar antes do merge

## Equipe

| Integrante | Contribuição |
|---|---|
| _Integrante 1 Adriana V. Seelig_ | _a preencher_ |
| _Integrante 2 Gabriel A. Espanhol_ | _a preencher_ |

Detalhes de contribuição individual no relatório técnico (`RELATORIO.md`, seção 9).
