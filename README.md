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

O relatório de cobertura é publicado como artifact da execução no GitHub Actions.

## Implantação na VM (Docker Compose)

O sistema roda numa VM Linux atrás de um firewall pfSense. O acesso é liberado só pela VPN ou para endereços IP autorizados nas regras do firewall. O [`docker-compose.yml`](docker-compose.yml) sobe quatro contêineres:

| Serviço | O que faz | Porta |
|---|---|---|
| `app` | O QAOps Tarefas, construído pelo [`Dockerfile`](Dockerfile) | 3000 (pública) e 9464 (métricas, só na rede interna) |
| `prometheus` | Coleta as métricas a cada 15 s e avalia as regras de alerta | 9090, só em `127.0.0.1` da VM |
| `node-exporter` | Métricas da VM (CPU, memória, disco) | só na rede interna |
| `grafana` | Painel de monitoramento e lista de alertas | 3001 |

O banco SQLite fica no volume `app-data`, fora do contêiner, e por isso sobrevive a novos deploys. A política `restart: unless-stopped` religa os contêineres se eles caírem ou se a VM reiniciar.

**Primeira instalação** (na VM, com Docker e o plugin Compose instalados):

```bash
git clone https://github.com/espanha117/qaops-tarefas.git
cd qaops-tarefas
cat > .env <<'FIM'
ADMIN_USERNAME=admin
ADMIN_PASSWORD=escolha-uma-senha
GRAFANA_PASSWORD=escolha-outra-senha
FIM
chmod 600 .env
docker compose up -d --build
docker compose ps        # os 4 contêineres em running; o app fica (healthy)
```

O `.env` existe só na VM e está no `.gitignore`: nenhuma senha vai para o repositório. Não defina `NODE_ENV=production` enquanto o acesso for por HTTP, porque nesse modo o cookie de sessão passa a exigir HTTPS e o login deixa de funcionar.

**Deploy de uma nova versão** (manual, depois que o PR passa pelos 6 gates e entra na `master`):

```bash
git checkout master && git pull
docker compose up -d --build
curl -s localhost:3000/health    # verificação pós-deploy
```

O deploy é manual porque a VM não fica aberta à internet, e os runners do GitHub Actions, que rodam na nuvem, não a alcançam. Automatizar exigiria um *self-hosted runner* na própria VM (ver relatório, seção 8).

**Acesso:** o sistema fica em `http://IP-DA-VM:3000` e o Grafana em `http://IP-DA-VM:3001` (usuário `admin`, senha `GRAFANA_PASSWORD`), pela VPN ou a partir de um IP autorizado no pfSense. O Prometheus não tem senha e só escuta dentro da VM; para abrir a interface dele, use um túnel SSH: `ssh -L 9090:localhost:9090 usuario@IP-DA-VM` e acesse `http://localhost:9090`.

## Monitoramento

- **Disponibilidade:** `GET /health` é público e responde `200` com `{ "status": "ok", "uptime": <segundos>, "db": "ok" }`, ou `503` se o banco não responder. É usado pelo smoke test do pipeline (Gate 6) e pelo healthcheck do contêiner.
- **Métricas:** [`src/metrics.js`](src/metrics.js) usa o `prom-client` para expor `/metrics` numa porta separada (`METRICS_PORT`, padrão 9464), que não é publicada fora da VM. A principal métrica é `http_request_duration_seconds`, um histograma por método, rota (o padrão, como `/api/tasks/:id`, nunca o id real) e código de status. Também são expostas as métricas padrão do processo Node.js.
- **Painel:** o Grafana já sobe com o datasource do Prometheus e o painel **QAOps Tarefas — Monitoramento** ([`monitoring/grafana/`](monitoring/grafana)): sistema no ar, alertas disparados, requisições por minuto e por status, latência p95, respostas 400 e 403 (os riscos da seção 3 do relatório), erros 5xx e CPU, memória e disco da VM.
- **Alertas** ([`monitoring/alertas.yml`](monitoring/alertas.yml)), avaliados pelo Prometheus e exibidos no Grafana (Alerting > Alert rules):

| Regra | Dispara quando |
|---|---|
| `SistemaForaDoAr` | O app não responde por mais de 1 minuto |
| `TaxaDeErros5xxAlta` | Mais de 5% das requisições terminam em 5xx por 2 minutos |
| `MuitosAcessosNegados` | Mais de 20 respostas 403 em 5 minutos |
| `DiscoQuaseCheio` | Menos de 10% de disco livre na VM por 5 minutos |

Os alertas aparecem no Prometheus e no Grafana, mas não enviam notificação (e-mail ou mensagem). Para testar um alerta: `docker compose stop app`, aguardar cerca de 2 minutos e conferir `SistemaForaDoAr` em *firing*; depois, `docker compose start app`.

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
  metrics.js                # métricas para o Prometheus (prom-client), servidas na porta 9464
  routes/
    tasks.js                # endpoints REST de tarefas (autenticado, filtrado por dono)
    auth.js                 # login/logout/me
    users.js                # gestão de usuários (somente admin)
    health.js               # GET /health (público)
  services/
    taskService.js          # regras de negócio de tarefas (validação, transição de status, dono)
    authService.js           # criação de usuário, hash/verificação de senha
    sessionService.js        # criação/validação/expiração de sessão
  public/                    # frontend estático (login + Kanban)
scripts/
  seed-admin.js              # cria o primeiro usuário admin fora do bootstrap automático
test/
  unit/                      # testes de services isolados (DB em memória)
  integration/                # testes de API via Supertest (auth, users, tasks, health, metrics)
monitoring/
  prometheus.yml             # alvos coletados pelo Prometheus
  alertas.yml                # as 4 regras de alerta
  grafana/                   # datasource e painel provisionados
Dockerfile                   # imagem da aplicação
docker-compose.yml           # app + Prometheus + node-exporter + Grafana na VM
```

## Como contribuir

1. Crie uma branch a partir da `master`: `git checkout -b minha-alteracao`
2. Faça as alterações e rode localmente `npm run lint` e `npm test`
3. Faça o commit com uma mensagem descritiva e envie a branch
4. Abra um Pull Request; o pipeline de CI precisa passar antes do merge

## Equipe

| Integrante | Contribuição |
|---|---|
| Adriana V. Seelig | Implantação na VM com Docker Compose, endpoint de métricas e seus testes, monitoramento com Prometheus e Grafana (painel e alertas), evidências da VM, README e checklist |
| Gabriel A. Espanhol | Sistema base (Kanban, login e controle de acesso, interface), pipeline e quality gates, experimentos, correção das dependências vulneráveis, monitoramento do pipeline (`/health`, smoke test, execução agendada e Dependabot) e redação do relatório |

Detalhes de contribuição individual no relatório técnico (`RELATORIO.md`, seção 9).
