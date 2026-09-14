# QAOps Tarefas

Gerenciador de tarefas standalone (Kanban simples), construído como sistema-base para o trabalho prático de DevOps/QAOps. É um produto independente: código, dependências e banco de dados próprios — não compartilha nada com nenhum outro sistema.

## Stack

- Node.js (>= 22.5) + Express
- Banco de dados: SQLite via módulo nativo `node:sqlite` (sem dependências externas para persistência, sem passo de compilação)
- Testes: Vitest (unitários + integração via Supertest) e cobertura (`@vitest/coverage-v8`)
- Lint: ESLint (flat config)
- Frontend: HTML/CSS/JS puro, servido como estático pelo próprio Express

## Instalação e execução

```bash
npm install
npm start
```

A aplicação sobe em `http://localhost:3000` (porta configurável via `PORT`, ver `.env.example`). O banco SQLite é criado automaticamente em `data/tasks.db` no primeiro start — não é necessário nenhum serviço externo nem credencial.

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

### API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tasks` | Lista tarefas (aceita `?status=`) |
| GET | `/api/tasks/:id` | Detalha uma tarefa (404 se não existir) |
| POST | `/api/tasks` | Cria uma tarefa (400 se inválida) |
| PATCH | `/api/tasks/:id` | Atualiza campos de uma tarefa |
| DELETE | `/api/tasks/:id` | Remove uma tarefa |

## Pipeline de qualidade (CI)

Definido em [`.github/workflows/ci.yml`](.github/workflows/ci.yml), disparado em todo `push` e `pull_request`. Cinco gates sequenciais, cada um bloqueando o pipeline se falhar — detalhes de critério/justificativa/evidência/consequência no relatório técnico ([`RELATORIO.md`](RELATORIO.md), seção 6):

1. Instalação de dependências (`npm ci`)
2. Análise estática (`npm run lint`)
3. Testes automatizados (`npm test`)
4. Cobertura mínima (`npm run coverage`)
5. Auditoria de dependências (`npm audit --audit-level=high`)

O relatório de cobertura é publicado como artifact da execução no GitHub Actions.

## Segurança

Nenhuma credencial, dado pessoal ou segredo é necessário para instalar, rodar ou testar este projeto — o banco é um arquivo SQLite local, gerado automaticamente e ignorado pelo Git (`.gitignore`).

## Estrutura do projeto

```
src/
  server.js              # bootstrap do servidor HTTP
  app.js                 # factory do Express app (usado também pelos testes)
  db.js                  # criação/schema do banco SQLite
  routes/tasks.js         # endpoints REST
  services/taskService.js # regras de negócio (validação, transição de status)
  public/                 # frontend estático (Kanban)
test/
  unit/                   # testes de taskService.js isolados (DB em memória)
  integration/            # testes de API via Supertest
```

## Equipe

| Integrante | Contribuição |
|---|---|
| _Integrante 1 (nome completo)_ | _a preencher_ |
| _Integrante 2 (nome completo)_ | _a preencher_ |

Detalhes de contribuição individual no relatório técnico (`RELATORIO.md`, seção 9).
