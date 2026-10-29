# Relatório Técnico — QAOps Tarefas

## 1. Identificação

- **Integrantes**: Adriana V. Seelig e Gabriel A. Espanhol
- **Sistema**: QAOps Tarefas — gerenciador de tarefas (Kanban) standalone
- **Repositório**: <https://github.com/espanha117/qaops-tarefas>
- **Plataforma de CI**: GitHub Actions
- **Data**: _a preencher na entrega_

## 2. Contexto

O QAOps Tarefas é um gerenciador de tarefas simples, no formato Kanban de três colunas (`todo`, `doing`, `done`), com login obrigatório e dois papéis de usuário (`admin` e `comum`), construído como sistema-base para este trabalho prático. Foi desenvolvido deliberadamente pequeno — a disciplina não avalia complexidade do sistema, e sim a qualidade integrada ao fluxo de entrega em volta dele.

**Stack técnica**: Node.js + Express no backend, SQLite via módulo nativo `node:sqlite` para persistência (sem dependência externa nem passo de compilação — decisão tomada justamente para manter o requisito de "instalação reproduzível" o mais simples e confiável possível para qualquer avaliador). Autenticação é sessão via cookie `HttpOnly`, com senha em hash `scrypt` (`node:crypto`) — também sem dependência externa, pela mesma razão. Frontend estático em HTML/CSS/JS puro servido pelo próprio Express.

**Arquitetura resumida**: camadas HTTP finas (`src/routes/tasks.js`, `auth.js`, `users.js`), delegando toda regra de negócio para uma camada de serviço isolada e pura (`src/services/taskService.js`, `authService.js`, `sessionService.js`), que recebe a conexão SQLite por injeção de dependência. Essa separação é o que permite testar as regras de negócio sem precisar subir um servidor HTTP (testes unitários) e, separadamente, testar a API real de ponta a ponta (testes de integração). Um middleware (`src/middleware/auth.js`) resolve a sessão a partir do cookie e injeta `req.user`; `taskService` usa esse usuário para filtrar e autorizar cada operação por dono da tarefa.

**Funcionalidade estudada**: CRUD de tarefas com validação de campos e transição de status, com controle de acesso por usuário (dono da tarefa vê/edita, admin vê/edita tudo), detalhado na seção 3.

## 3. Riscos

| Risco | Por que importa | Verificação associada |
|---|---|---|
| Aceitar tarefa sem título (ou só espaços) | Corrompe a listagem e o board, gera itens sem identificação | Teste unitário + gate de testes |
| Aceitar `status`/`priority` fora do enum permitido | Quebra o agrupamento por coluna no Kanban | Teste unitário + gate de testes |
| `due_date` inválida persistida | Quebra ordenação/exibição de prazos no frontend | Teste unitário + gate de testes |
| Regressão na transição de status (`completed_at` não atualizado) | Métricas de conclusão ficam erradas | Teste unitário dedicado + gate de testes |
| Usuário comum acessando/alterando tarefa de outro usuário | Vazamento de dados entre usuários; quebra o isolamento que é a própria razão de ter login | Teste unitário e de integração dedicados (verificam `403`) + gate de testes |
| Senha armazenada ou comparada de forma insegura (texto puro, hash sem salt, comparação não constante) | Comprometimento de credenciais em caso de vazamento do banco | Uso de `scrypt` com salt por usuário e `timingSafeEqual`, coberto por teste unitário |
| Sessão sem expiração ou cookie acessível via JavaScript | Sessão roubada (XSS) ou válida indefinidamente | Cookie `HttpOnly`, TTL de 7 dias, teste unitário de expiração |
| Lógica de negócio sem cobertura de teste | Bugs silenciosos em mudanças futuras | Gate de cobertura mínima |
| Dependência com vulnerabilidade conhecida | Superfície de ataque desnecessária | Gate de auditoria de dependências |
| Código com padrão inseguro/óbvio não identificado | Bug ou vulnerabilidade que passa despercebida | Gate de análise estática |

## 4. Pipeline

Arquivo: `.github/workflows/ci.yml`. Gatilhos: `push` (qualquer branch) e `pull_request` para a branch principal (`master`) — cobre tanto o fluxo de desenvolvimento em branch quanto a validação antes de merge.

Fluxo de decisão (cada etapa roda em sequência; se uma falhar, as seguintes não executam e o job é marcado como falho):

| Ordem | Etapa | Ferramenta | Resultado |
|---|---|---|---|
| 1 | Checkout + setup Node | `actions/checkout`, `actions/setup-node` | Ambiente pronto |
| 2 | Dependências | `npm ci` | Instalação reprodutível a partir do lockfile |
| 3 | Análise estática | `npm run lint` (ESLint) | Código sem padrões proibidos |
| 4 | Testes | `npm test` (Vitest) | Comportamentos verificados |
| 5 | Cobertura | `npm run coverage` | Lógica crítica coberta acima do limiar |
| 6 | Auditoria de dependências | `npm audit --audit-level=high` | Sem vulnerabilidade alta/crítica conhecida |
| 7 | Publicação de evidências | `actions/upload-artifact` | Relatório de cobertura anexado à execução |

O histórico de execuções na aba **Actions** do repositório é a evidência primária de cada rodada do pipeline.

## 5. Testes

**Estratégia**: dois níveis, cobrindo os comportamentos de risco listados na seção 3.

- **Unitários** (`test/unit/`): testam cada camada de serviço isoladamente, com um banco SQLite em memória injetado — sem HTTP, execução rápida.
  - `taskService.test.js`: casos positivos (criação e atualização válidas) e negativos (título vazio, status/priority inválidos, data inválida), a regra de transição de `completed_at`, e controle de acesso por dono (`comum` só vê/edita as próprias, `admin` vê/edita tudo, `ForbiddenError` para acesso indevido).
  - `authService.test.js`: criação de usuário (validação de username/senha/role, unicidade), verificação de credenciais (`AuthError` para senha ou usuário inválidos), listagem sem expor hash/salt.
  - `sessionService.test.js`: criação, resolução e expiração de sessão, e invalidação no logout.
- **Integração/API** (`test/integration/`, via Supertest): sobem o Express real (sem `listen`, direto contra o `app`) e validam os endpoints REST de ponta a ponta.
  - `tasks.api.test.js`: status HTTP corretos (`201`, `400`, `401`, `403`, `404`, `204`), e que a listagem/edição respeita o isolamento por usuário (`comum` vs `admin`).
  - `auth.api.test.js`: login com cookie de sessão, `401` para credenciais inválidas ou sessão ausente, logout invalidando a sessão.
  - `users.api.test.js`: criação/listagem de usuários restrita a `admin` (`403` para `comum`), `400` para username duplicado.

Justificativa dos níveis escolhidos: unitário garante que a lógica de negócio está correta isoladamente; integração garante que a camada HTTP (roteamento, serialização, tratamento de erro) está corretamente conectada a essa lógica — um teste unitário passando não garante que a rota exponha o comportamento certo, e vice-versa.

## 6. Quality gates

Cinco gates, todos bloqueantes (o pipeline não avança/aprova se qualquer um falhar):

| Gate | Critério mensurável | Justificativa (risco) | Momento | Evidência | Consequência | Limitação/exceção |
|---|---|---|---|---|---|---|
| Build/Install | `npm ci` retorna código 0 | Dependência quebrada ou lockfile divergente impede rodar o sistema | Início do job, a cada push/PR | Log do step no Actions | Bloqueia o pipeline | Não valida comportamento em runtime, só a instalação |
| Análise estática | 0 erros do ESLint (regras recomendadas + `no-unused-vars`, `eqeqeq`) | Padrões inseguros/bugs óbvios não capturados por teste | Após instalação | Log do ESLint no Actions | Bloqueia o pipeline | Não substitui revisão humana; só cobre regras configuradas |
| Testes | 100% dos testes unitários e de integração aprovados | Regressão em criação, validação ou transição de status de tarefas | Após lint | Saída do Vitest no log do Actions | Bloqueia o pipeline | Só cobre comportamentos com teste escrito |
| Cobertura | ≥75% linhas/statements/funções e ≥60% branches em `src/services/` (limiar definido em `vitest.config.js`) | Lógica de negócio crítica sem verificação automatizada | Após os testes | Relatório de cobertura v8 (artifact + log) | Bloqueia o pipeline | Cobertura alta é proxy, não garante ausência de bugs |
| Dependências | 0 vulnerabilidades `high`/`critical` no `npm audit` | Uso de pacote com vulnerabilidade conhecida | Após cobertura | Log do `npm audit` no Actions | Bloqueia e exige revisão manual da dependência | Só cobre advisories conhecidas do registry npm |

**Por que esses limiares e não outros**: 75% de cobertura em linhas/statements foi escolhido por ser um patamar alto o bastante para forçar cobertura da maior parte dos ramos de validação (o módulo mais arriscado do sistema), sem exigir 100% — que tende a gerar testes artificiais só para "bater número". O limiar de branch em 60% é mais permissivo porque a função `update` tem combinações de campos opcionais que geram muitos ramos; exigir 75% ali levaria a testes redundantes sem ganho real de confiança. `audit-level=high` foi escolhido para não bloquear o pipeline por vulnerabilidades de baixo impacto (ruído), mantendo o bloqueio reservado para risco real.

## 7. Experimentos

Todas as execuções foram feitas em 26/10/2026 e estão preservadas na aba **Actions** do repositório.

| Cenário | Procedimento | Resultado |
|---|---|---|
| **Aprovado** | Push na branch `master` com o código íntegro (commit `7f570a5`) | Todos os 5 gates verdes, em 20 s. Execução: <https://github.com/espanha117/qaops-tarefas/actions/runs/40379359112> |
| **Reprovado** | Branch `experimento/falha-controlada`, commit `112c45d`: remoção deliberada das 3 linhas que validam título vazio em `src/services/taskService.js` (`validateCreatePayload`) | Gates 1 e 2 (build e lint) verdes; **Gate 3 (Testes) falha** com 2 de 73 testes reprovados — o unitário `create > rejeita titulo vazio` e o de integração `POST /api/tasks > retorna 400 para titulo vazio`. Gates 4 e 5 não chegam a executar. Execução: <https://github.com/espanha117/qaops-tarefas/actions/runs/40381350067> |
| **Correção** | Commit `1f41b5b` (revert do anterior) restaura a validação removida, na mesma branch | Todos os 5 gates voltam a ficar verdes, em 23 s. Execução: <https://github.com/espanha117/qaops-tarefas/actions/runs/40381495351> |

Comparação: a única diferença entre a execução aprovada e a reprovada é a ausência de uma verificação de 3 linhas. Isso basta para mostrar que o pipeline impede que uma alteração que quebra um comportamento coberto por teste avance no fluxo de entrega, o que responde à questão central do enunciado. A alteração quebrada passou pelo build e pelo lint, porque o código continuava sintaticamente válido. Quem detectou o erro foram os testes, e por dois níveis diferentes (unitário e integração), o que confirma o valor de ter as duas camadas.

**Reprovação não planejada (evidência adicional).** Em 19/10/2026, dois pushes na `master` foram bloqueados pelo **Gate 5 (auditoria de dependências)** sem que o código do sistema tivesse mudado nesse aspecto. Depois da última execução verde (14/09), foram publicadas vulnerabilidades de severidade *high* no `body-parser` (dependência do Express) e no `brace-expansion`. Execução bloqueada: <https://github.com/espanha117/qaops-tarefas/actions/runs/39265702696>. A correção foi atualizar as dependências dentro das faixas de versão já permitidas no `package.json` (`npm update`, commit `ab15a66`), e o pipeline voltou a aprovar na execução 40379359112 citada acima. O caso mostra que o gate de dependências protege contra riscos que surgem *fora* do código do projeto.

**Limitação observada.** Na execução reprovada, o passo "Publicar evidências" rodou (`if: always()`), mas não encontrou a pasta `coverage/`, porque o Gate 4 não chegou a executar. Por isso não houve artefato. A evidência da falha fica só no log do Gate 3. Uma melhoria possível é gerar também um relatório de testes (por exemplo JUnit XML) e publicá-lo mesmo em caso de falha.

## 8. Análise crítica

- **Quais riscos foram efetivamente cobertos e quais permaneceram?** Os riscos de validação de entrada e transição de status (seção 3) estão cobertos por teste automatizado e gate de cobertura. Não cobrimos riscos de concorrência (duas requisições simultâneas escrevendo na mesma tarefa) nem de carga/performance — fora do escopo mínimo da disciplina, mas seriam o próximo passo natural.
- **O pipeline fornece feedback rápido e compreensível?** Sim — a execução completa roda em menos de um minuto no GitHub Actions, e cada gate é um step isolado no log, então o ponto exato de falha é imediato de identificar (demonstrado no experimento reprovado).
- **Quais verificações continuam manuais?** Revisão de código (PR review), validação visual do Kanban no navegador, e a decisão de se uma vulnerabilidade `moderate` do `npm audit` (que não bloqueia) merece correção antes do próximo release.
- **Qual é o custo de manter os testes e gates?** Baixo neste estágio (73 testes, execução em poucos segundos), mas cresce com o sistema — cada novo campo/regra de negócio exige atualizar os testes de serviço correspondentes e potencialmente ajustar o limiar de cobertura.
- **O que diferencia automação isolada de uma prática DevOps/QAOps?** Automação isolada seria só "ter um script de teste"; aqui a qualidade está integrada ao fluxo de entrega — todo push é verificado, o pipeline bloqueia automaticamente alterações que quebram um comportamento coberto, e há evidência auditável (histórico do Actions) de cada decisão de aprovar ou reprovar, não apenas um teste rodado manualmente antes de um release.
- **O que seria necessário para incluir implantação e observabilidade com segurança?** Um gate adicional de deploy (ex.: publicar em um serviço como Render/Railway) condicionado aos 5 gates atuais, gerenciamento de segredos via mecanismo nativo da plataforma de CI (nunca no repositório), e instrumentação de logs/métricas (ex.: tempo de resposta da API, taxa de erro) com alertas — hoje o sistema não tem observabilidade em runtime, só evidências de tempo de build.

## 9. Contribuições

| Integrante | Contribuição |
|---|---|
| _Integrante 1_ | _a preencher (ex.: backend, testes unitários, pipeline)_ |
| _Integrante 2_ | _a preencher (ex.: frontend, testes de integração, relatório)_ |

Recomendação prática para manter commits identificáveis dos dois integrantes: cada um trabalha em branches de feature próprias e faz merge via PR, ou usa `git commit --author` / `Co-authored-by:` quando programarem juntos na mesma máquina.

## Referências

- DORA — <https://dora.dev/>
- GitHub Actions — <https://docs.github.com/actions>
- OWASP — <https://owasp.org/>
- ISTQB CTFL — <https://istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/>
- Vitest — <https://vitest.dev/>
- ESLint — <https://eslint.org/>
- Node.js `node:sqlite` — <https://nodejs.org/api/sqlite.html>
