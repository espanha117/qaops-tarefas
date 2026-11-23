# Relatório Técnico — QAOps Tarefas

> Trechos marcados com **[PENDENTE: …]** dependem da implantação na VM (PR da Adriana) ou de dados da entrega. Procurar por `PENDENTE` e remover todos antes de entregar.

## 1. Identificação

- **Integrantes**: Adriana V. Seelig e Gabriel A. Espanhol
- **Sistema**: QAOps Tarefas — gerenciador de tarefas (Kanban) standalone
- **Repositório**: <https://github.com/espanha117/qaops-tarefas>
- **Plataforma de CI**: GitHub Actions
- **Implantação e monitoramento**: VM com Docker Compose, Prometheus e Grafana
- **Data**: **[PENDENTE: data da entrega]**

## 2. Contexto

O QAOps Tarefas é um gerenciador de tarefas simples, no formato Kanban de três colunas (`todo`, `doing`, `done`), com login obrigatório e dois papéis de usuário (`admin` e `comum`), construído como sistema-base para este trabalho prático. Foi desenvolvido deliberadamente pequeno — a disciplina não avalia complexidade do sistema, e sim a qualidade integrada ao fluxo de entrega em volta dele.

**Stack técnica**: Node.js + Express no backend, SQLite via módulo nativo `node:sqlite` para persistência (sem dependência externa nem passo de compilação — decisão tomada justamente para manter o requisito de "instalação reproduzível" o mais simples e confiável possível para qualquer avaliador). Autenticação é sessão via cookie `HttpOnly`, com senha em hash `scrypt` (`node:crypto`) — também sem dependência externa, pela mesma razão. Frontend estático em HTML/CSS/JS puro servido pelo próprio Express.

**Arquitetura resumida**: camadas HTTP finas (`src/routes/tasks.js`, `auth.js`, `users.js`, `health.js`), delegando toda regra de negócio para uma camada de serviço isolada e pura (`src/services/taskService.js`, `authService.js`, `sessionService.js`), que recebe a conexão SQLite por injeção de dependência. Essa separação é o que permite testar as regras de negócio sem precisar subir um servidor HTTP (testes unitários) e, separadamente, testar a API real de ponta a ponta (testes de integração). Um middleware (`src/middleware/auth.js`) resolve a sessão a partir do cookie e injeta `req.user`; `taskService` usa esse usuário para filtrar e autorizar cada operação por dono da tarefa. A rota pública `/health` informa se o processo está no ar e se o banco responde, e é usada pelo smoke test do pipeline e pelo monitoramento. **[PENDENTE: citar o endpoint de métricas (`/metrics`) e o arquivo onde ele foi implementado, após o merge do PR da Adriana.]**

**Funcionalidade estudada**: CRUD de tarefas com validação de campos e transição de status, com controle de acesso por usuário (dono da tarefa vê/edita, admin vê/edita tudo), detalhado na seção 3.

## 3. Riscos

| Risco | Por que importa | Verificação associada |
|---|---|---|
| Aceitar tarefa sem título (ou só espaços), ou com mais de 200 caracteres | Corrompe a listagem e o board, gera itens sem identificação | Testes unitários (incluindo os limites de 200 e 201 caracteres) + gate de testes |
| Aceitar `status`/`priority` fora do enum permitido | Quebra o agrupamento por coluna no Kanban | Teste unitário + gate de testes |
| `due_date` inválida persistida | Quebra ordenação/exibição de prazos no frontend | Teste unitário + gate de testes |
| Regressão na transição de status (`completed_at` não atualizado) | Métricas de conclusão ficam erradas | Teste unitário dedicado + gate de testes |
| Usuário comum acessando/alterando tarefa de outro usuário | Vazamento de dados entre usuários; quebra o isolamento que é a própria razão de ter login | Teste unitário e de integração dedicados (verificam `403`) + gate de testes |
| Senha armazenada ou comparada de forma insegura (texto puro, hash sem salt, comparação não constante) | Comprometimento de credenciais em caso de vazamento do banco | Uso de `scrypt` com salt por usuário e `timingSafeEqual`, coberto por teste unitário |
| Sessão sem expiração ou cookie acessível via JavaScript | Sessão roubada (XSS) ou válida indefinidamente | Cookie `HttpOnly`, TTL de 7 dias, teste unitário de expiração |
| Lógica de negócio sem cobertura de teste | Bugs silenciosos em mudanças futuras | Gate de cobertura mínima |
| Dependência com vulnerabilidade conhecida | Superfície de ataque desnecessária | Gate de auditoria de dependências |
| Vulnerabilidade publicada depois do último commit | O código não muda, mas passa a usar um componente vulnerável | Execução agendada semanal do pipeline + Dependabot |
| Atualização de dependência que quebra compatibilidade | Uma versão nova pode mudar o comportamento do framework | PRs do Dependabot passam pelos gates; atualizações *major* exigem revisão humana |
| Código com padrão inseguro/óbvio não identificado | Bug ou vulnerabilidade que passa despercebida | Gate de análise estática |
| Aplicação que passa nos testes mas não sobe | Erro de inicialização ou banco inacessível só apareceria em uso | Gate 6 (smoke test em `/health`) |
| Sistema fora do ar ou lento em produção | Usuários sem acesso, sem ninguém perceber | Regras de alerta no Prometheus, exibidas no Grafana (sem notificação automática; ver seção 4.1) |

## 4. Pipeline

Arquivo: `.github/workflows/ci.yml`. Gatilhos: `push` (qualquer branch) e `pull_request` para a branch principal (`master`) — cobre tanto o fluxo de desenvolvimento em branch quanto a validação antes de merge. Além disso, uma execução agendada (`schedule`, toda segunda-feira às 9h UTC) roda o pipeline mesmo sem commits, e o acionamento manual (`workflow_dispatch`) permite repetir uma execução sob demanda. O Dependabot (`.github/dependabot.yml`) verifica as dependências npm semanalmente e abre PRs de atualização, que passam pelos mesmos gates antes de qualquer merge.

Fluxo de decisão (cada etapa roda em sequência; se uma falhar, as seguintes não executam e o job é marcado como falho):

| Ordem | Etapa | Ferramenta | Resultado |
|---|---|---|---|
| 1 | Checkout + setup Node | `actions/checkout`, `actions/setup-node` | Ambiente pronto |
| 2 | Dependências | `npm ci` | Instalação reprodutível a partir do lockfile |
| 3 | Análise estática | `npm run lint` (ESLint) | Código sem padrões proibidos |
| 4 | Testes | `npm test` (Vitest) | Comportamentos verificados |
| 5 | Cobertura | `npm run coverage` | Lógica crítica coberta acima do limiar |
| 6 | Auditoria de dependências | `npm audit --audit-level=high` | Sem vulnerabilidade alta/crítica conhecida |
| 7 | Smoke test | `npm start` + `curl` em `/health` | Aplicação sobe e responde, com banco acessível |
| 8 | Publicação de evidências | `actions/upload-artifact` | Relatório de cobertura anexado à execução |

O histórico de execuções na aba **Actions** do repositório é a evidência primária de cada rodada do pipeline.

### 4.1 Implantação e monitoramento

Para cobrir as etapas DEPLOY, OPERATE e MONITOR do ciclo DevOps, o sistema é implantado numa VM mantida pela Adriana:

| Componente | Papel |
|---|---|
| VM atrás de firewall pfSense, acessível por VPN | Ambiente de execução isolado; não fica exposto diretamente à internet |
| Docker Compose | Sobe a aplicação, o Prometheus e o Grafana juntos, de forma declarativa e reproduzível |
| Contêiner da aplicação (`Dockerfile`) | Executa o QAOps Tarefas; a política de reinício do Compose o religa automaticamente se ele cair |
| Volume Docker | Guarda o arquivo SQLite fora do contêiner, então os dados sobrevivem a novos deploys |
| `.env` só na VM | Senha do admin e demais segredos ficam fora do repositório |
| Prometheus | Coleta periodicamente as métricas expostas pela aplicação em `/metrics` e avalia 4 regras de alerta |
| Grafana | Painéis de disponibilidade e desempenho, com os alertas do Prometheus em destaque |

As regras de alerta ficam no Prometheus: quando uma condição é atingida, o alerta passa ao estado *firing* e aparece na interface do Prometheus e no painel do Grafana. **Não há notificação automática** (e-mail ou mensagem); alguém precisa estar olhando o painel para perceber. **[PENDENTE: listar as métricas expostas em `/metrics`, os painéis do Grafana e as 4 regras de alerta.]**

**Como uma versão aprovada chega à VM.** Como a VM só é acessível pela VPN, os runners do GitHub Actions (que rodam na nuvem) não conseguem se conectar a ela. Por isso o deploy é manual: depois que uma versão passa pelos 6 gates e entra na `master`, a Adriana atualiza a VM com `git pull && docker compose up -d --build`. Chegamos a montar um job de deploy automático por SSH com systemd (PR #37), mas ele foi fechado sem merge porque não alcança a VM atrás da VPN e não usa Docker. A alternativa para automatizar seria um *self-hosted runner* instalado na própria VM, que busca os jobs no GitHub por conexão de saída; ficou como trabalho futuro (seção 8).

## 5. Testes

**Estratégia**: dois níveis, cobrindo os comportamentos de risco listados na seção 3. No total são 77 testes **[PENDENTE: atualizar para 80 após o merge dos 3 testes do endpoint de métricas]**.

- **Unitários** (`test/unit/`): testam cada camada de serviço isoladamente, com um banco SQLite em memória injetado — sem HTTP, execução rápida.
  - `taskService.test.js`: casos positivos (criação e atualização válidas) e negativos (título vazio, título acima de 200 caracteres, status/priority inválidos, data inválida), o caso de borda de um título com exatamente 200 caracteres, a regra de transição de `completed_at`, e controle de acesso por dono (`comum` só vê/edita as próprias, `admin` vê/edita tudo, `ForbiddenError` para acesso indevido).
  - `authService.test.js`: criação de usuário (validação de username/senha/role, unicidade), verificação de credenciais (`AuthError` para senha ou usuário inválidos), listagem sem expor hash/salt.
  - `sessionService.test.js`: criação, resolução e expiração de sessão, e invalidação no logout.
- **Integração/API** (`test/integration/`, via Supertest): sobem o Express real (sem `listen`, direto contra o `app`) e validam os endpoints REST de ponta a ponta.
  - `tasks.api.test.js`: status HTTP corretos (`201`, `400`, `401`, `403`, `404`, `204`), e que a listagem/edição respeita o isolamento por usuário (`comum` vs `admin`).
  - `auth.api.test.js`: login com cookie de sessão, `401` para credenciais inválidas ou sessão ausente, logout invalidando a sessão.
  - `users.api.test.js`: criação/listagem de usuários restrita a `admin` (`403` para `comum`), `400` para username duplicado.
  - `health.api.test.js`: `/health` responde `200` sem sessão e `503` quando o banco está indisponível.
  - **[PENDENTE: descrever os 3 testes do endpoint de métricas.]**

Justificativa dos níveis escolhidos: unitário garante que a lógica de negócio está correta isoladamente; integração garante que a camada HTTP (roteamento, serialização, tratamento de erro) está corretamente conectada a essa lógica — um teste unitário passando não garante que a rota exponha o comportamento certo, e vice-versa.

Os testes do limite de 200 caracteres foram validados alterando o limite de propósito para 199 e para 201: em cada caso um teste falhou, o que confirma que eles detectam a mudança.

## 6. Quality gates

Seis gates, todos bloqueantes (o pipeline não avança/aprova se qualquer um falhar):

| Gate | Critério mensurável | Justificativa (risco) | Momento | Evidência | Consequência | Limitação/exceção |
|---|---|---|---|---|---|---|
| Build/Install | `npm ci` retorna código 0 | Dependência quebrada ou lockfile divergente impede rodar o sistema | Início do job, a cada push/PR | Log do step no Actions | Bloqueia o pipeline | Não valida comportamento em runtime, só a instalação |
| Análise estática | 0 erros do ESLint (regras recomendadas + `no-unused-vars`, `eqeqeq`) | Padrões inseguros/bugs óbvios não capturados por teste | Após instalação | Log do ESLint no Actions | Bloqueia o pipeline | Não substitui revisão humana; só cobre regras configuradas |
| Testes | 100% dos testes unitários e de integração aprovados | Regressão em criação, validação ou transição de status de tarefas | Após lint | Saída do Vitest no log do Actions | Bloqueia o pipeline | Só cobre comportamentos com teste escrito |
| Cobertura | ≥75% linhas/statements/funções e ≥60% branches em `src/services/` (limiar definido em `vitest.config.js`) | Lógica de negócio crítica sem verificação automatizada | Após os testes | Relatório de cobertura v8 (artifact + log) | Bloqueia o pipeline | Cobertura alta é proxy, não garante ausência de bugs |
| Dependências | 0 vulnerabilidades `high`/`critical` no `npm audit` | Uso de pacote com vulnerabilidade conhecida | Após cobertura e na execução agendada semanal | Log do `npm audit` no Actions | Bloqueia e exige revisão manual da dependência | Só cobre advisories conhecidas do registry npm |
| Smoke test | `GET /health` responde `200` em até 20 s após `npm start` | Código que passa nos testes mas não sobe (erro de inicialização, banco inacessível) | Após a auditoria | Resposta JSON do `/health` no log do Actions | Bloqueia o pipeline | Verifica só que a aplicação sobe; não testa funcionalidades nem desempenho |

**Por que esses limiares e não outros**: 75% de cobertura em linhas/statements foi escolhido por ser um patamar alto o bastante para forçar cobertura da maior parte dos ramos de validação (o módulo mais arriscado do sistema), sem exigir 100% — que tende a gerar testes artificiais só para "bater número". O limiar de branch em 60% é mais permissivo porque a função `update` tem combinações de campos opcionais que geram muitos ramos; exigir 75% ali levaria a testes redundantes sem ganho real de confiança. `audit-level=high` foi escolhido para não bloquear o pipeline por vulnerabilidades de baixo impacto (ruído), mantendo o bloqueio reservado para risco real.

**Depois dos gates.** Os gates decidem se uma versão pode avançar; o monitoramento na VM (seção 4.1) verifica se ela continua funcionando depois de implantada. Como o deploy é manual, a verificação pós-deploy também é: depois do `docker compose up`, conferir que `/health` responde 200 e que o painel do Grafana volta a mostrar a aplicação no ar.

## 7. Experimentos

As execuções dos três cenários obrigatórios foram feitas em 26/10/2026, quando o pipeline tinha 5 gates e 73 testes, e estão preservadas na aba **Actions** do repositório.

| Cenário | Procedimento | Resultado |
|---|---|---|
| **Aprovado** | Push na branch `master` com o código íntegro (commit `7f570a5`) | Todos os 5 gates verdes, em 20 s. Execução: <https://github.com/espanha117/qaops-tarefas/actions/runs/40379359112> |
| **Reprovado** | Branch `experimento/falha-controlada`, commit `112c45d`: remoção deliberada das 3 linhas que validam título vazio em `src/services/taskService.js` (`validateCreatePayload`) | Gates 1 e 2 (build e lint) verdes; **Gate 3 (Testes) falha** com 2 de 73 testes reprovados — o unitário `create > rejeita titulo vazio` e o de integração `POST /api/tasks > retorna 400 para titulo vazio`. Gates 4 e 5 não chegam a executar. Execução: <https://github.com/espanha117/qaops-tarefas/actions/runs/40381350067> |
| **Correção** | Commit `1f41b5b` (revert do anterior) restaura a validação removida, na mesma branch | Todos os 5 gates voltam a ficar verdes, em 23 s. Execução: <https://github.com/espanha117/qaops-tarefas/actions/runs/40381495351> |

Comparação: a única diferença entre a execução aprovada e a reprovada é a ausência de uma verificação de 3 linhas. Isso basta para mostrar que o pipeline impede que uma alteração que quebra um comportamento coberto por teste avance no fluxo de entrega, o que responde à questão central do enunciado. A alteração quebrada passou pelo build e pelo lint, porque o código continuava sintaticamente válido. Quem detectou o erro foram os testes, e por dois níveis diferentes (unitário e integração), o que confirma o valor de ter as duas camadas.

**Reprovação não planejada (evidência adicional).** Em 19/10/2026, dois pushes na `master` foram bloqueados pelo **Gate 5 (auditoria de dependências)** sem que o código do sistema tivesse mudado nesse aspecto. Depois da última execução verde (14/09), foram publicadas três vulnerabilidades em dependências indiretas: `proxy-addr` (*critical*, usado pelo Express), `brace-expansion` (*high*, usado pelo ESLint) e `source-map-js` (*high*, usado pelo Vitest e pela ferramenta de cobertura). Execução bloqueada: <https://github.com/espanha117/qaops-tarefas/actions/runs/39265702696>. A correção foi atualizar as dependências dentro das faixas de versão já permitidas no `package.json` (`npm update`, commit `ab15a66`), e o pipeline voltou a aprovar na execução 40379359112 citada acima. O caso mostra que o gate de dependências protege contra riscos que surgem *fora* do código do projeto. Ele também motivou a execução agendada semanal: sem ela, o problema só foi descoberto porque alguém fez push.

**Smoke test (Gate 6).** Adicionado em 16/11/2026 (PR #28). O log do gate registra a resposta da aplicação em execução no runner: `{"status":"ok","uptime":1,"db":"ok"}` seguida de "Smoke test aprovado: /health respondeu 200". Execução: <https://github.com/espanha117/qaops-tarefas/actions/runs/43865239327>.

**Ciclo do Dependabot.** Logo após ser ativado, em 16/11/2026, o Dependabot abriu 5 PRs de atualização, e os 6 gates aprovaram todos. Quatro atualizações foram aceitas (globals, supertest, vitest e @vitest/coverage-v8). A do Express 4 → 5 (PR #31) foi **recusada mesmo com o pipeline verde**: é uma versão *major*, com mudanças incompatíveis, e os testes não cobrem o frontend. A decisão ficou registrada no PR. Durante os merges, um PR ficou em conflito no `package-lock.json` e foi refeito pelo próprio Dependabot (`@dependabot rebase`).

**Limitação observada.** Na execução reprovada, o passo "Publicar evidências" rodou (`if: always()`), mas não encontrou a pasta `coverage/`, porque o Gate 4 não chegou a executar. Por isso não houve artefato. A evidência da falha fica só no log do Gate 3. Uma melhoria possível é gerar também um relatório de testes (por exemplo JUnit XML) e publicá-lo mesmo em caso de falha.

**[PENDENTE: evidências da VM — painel do Grafana e, se possível, um alerta disparado ao derrubar o contêiner da aplicação e o restart automático religando-o.]**

## 8. Análise crítica

- **Quais riscos foram efetivamente cobertos e quais permaneceram?** Os riscos de validação de entrada, transição de status e controle de acesso (seção 3) estão cobertos por teste automatizado e gate de cobertura; o Gate 6 cobre a aplicação que não sobe; a execução agendada e o Dependabot cobrem vulnerabilidades publicadas depois do último commit. Não cobrimos riscos de concorrência (duas requisições simultâneas escrevendo na mesma tarefa) nem testes de carga — fora do escopo mínimo da disciplina. As métricas no Grafana passam a mostrar desempenho real, mas não substituem um teste de carga.
- **O pipeline fornece feedback rápido e compreensível?** Sim — a execução completa roda entre 25 e 40 segundos no GitHub Actions, e cada gate é um step isolado no log, então o ponto exato de falha é imediato de identificar (demonstrado no experimento reprovado).
- **Quais verificações continuam manuais?** Revisão de código (PR review), validação visual do Kanban no navegador, a decisão de se uma vulnerabilidade `moderate` do `npm audit` (que não bloqueia) merece correção, e a aceitação de atualizações *major* propostas pelo Dependabot — o caso do Express 5 mostra que pipeline verde não basta quando os testes não cobrem tudo o que a atualização pode afetar.
- **Qual é o custo de manter os testes e gates?** Baixo neste estágio (77 testes **[PENDENTE: 80]**, execução em poucos segundos), mas cresce com o sistema: cada novo campo/regra de negócio exige atualizar os testes de serviço correspondentes e potencialmente ajustar o limiar de cobertura. O Dependabot acrescenta um custo novo: PRs semanais para revisar e conflitos no `package-lock.json` quando vários entram em sequência. A VM acrescenta a manutenção do Docker, do Prometheus e do Grafana.
- **O que diferencia automação isolada de uma prática DevOps/QAOps?** Automação isolada seria só "ter um script de teste"; aqui a qualidade está integrada ao fluxo de entrega — todo push é verificado, o pipeline bloqueia automaticamente alterações que quebram um comportamento coberto, o próprio pipeline roda periodicamente para detectar riscos externos, e há evidência auditável (histórico do Actions) de cada decisão de aprovar ou reprovar. Com a VM, o ciclo se fecha: o que o monitoramento mostra em produção volta como feedback para o planejamento.
- **O que seria necessário para incluir implantação e observabilidade com segurança?** Os elementos que adotamos: implantar só versões aprovadas pelos gates; manter segredos fora do repositório (`.env` só na VM); isolar o ambiente (VM atrás de pfSense, acesso por VPN); dados persistentes fora do contêiner (volume); e observabilidade com health check, métricas e regras de alerta (Prometheus) e painéis (Grafana). Ficou faltando a notificação dos alertas: hoje eles só aparecem na tela, e o passo seguinte seria um contato de e-mail ou Telegram (via Alertmanager ou Grafana). Também ficaram faltando o deploy automático (com verificação e rollback), backup do volume do SQLite, logs centralizados e HTTPS. Um cuidado específico para o deploy automático: um *self-hosted runner* em repositório público pode executar código de PRs de terceiros, então ele deve atender apenas jobs de push na `master`, com aprovação manual para workflows vindos de forks.

## 9. Contribuições

**[PENDENTE: revisar e confirmar. Rascunho feito a partir do histórico de commits e issues.]**

| Integrante | Contribuição |
|---|---|
| Adriana V. Seelig | README (pré-requisitos, passo a passo de instalação e contribuição), checklist de acompanhamento do trabalho, identificação da dupla no relatório; implantação na VM com Docker Compose, endpoint de métricas e seus testes, Prometheus e Grafana para monitoramento (seção 4.1) |
| Gabriel A. Espanhol | Sistema base (Kanban, login e controle de acesso, interface), pipeline e quality gates, experimentos (seção 7), correção das dependências vulneráveis, monitoramento do pipeline (`/health`, smoke test, execução agendada e Dependabot), testes de limite do título e redação do relatório |

A autoria de cada alteração fica identificável no histórico de commits e nos pull requests do repositório.

## Referências

- DORA — <https://dora.dev/>
- GitHub Actions — <https://docs.github.com/actions>
- GitHub Dependabot — <https://docs.github.com/code-security/dependabot>
- OWASP — <https://owasp.org/>
- ISTQB CTFL — <https://istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/>
- Vitest — <https://vitest.dev/>
- ESLint — <https://eslint.org/>
- Node.js `node:sqlite` — <https://nodejs.org/api/sqlite.html>
- Docker Compose — <https://docs.docker.com/compose/>
- Prometheus — <https://prometheus.io/docs/>
- Grafana — <https://grafana.com/docs/>
