# Checklist do trabalho — DevOps e QAOps

Acompanhamento dos requisitos do enunciado do Projeto Prático DevOps e QAOps.

Atualizado em 24/11/2026 · Legenda: `[x]` concluído · `[ ]` pendente

## 1. Requisitos mínimos do sistema

- [x] Código-fonte versionado em Git
- [x] Procedimento de instalação e execução (no README, seção "Instalação e execução")
- [x] Arquivo declarativo de dependências (`package.json` e `package-lock.json`)
- [x] Testes executados por comando (`npm test`)
- [x] Nenhuma credencial, dado pessoal ou segredo no repositório (admin criado por variável de ambiente; banco no `.gitignore`)

## 2. Repositório

- [x] Código, testes, pipeline e dependências organizados
- [x] README com instalação, testes, regras de negócio, API e estrutura do projeto
- [x] Commits identificáveis dos dois integrantes

## 3. Pipeline ([`ci.yml`](.github/workflows/ci.yml), GitHub Actions)

- [x] Acionado por `push` (qualquer branch) e `pull_request` para a `master`
- [x] Instalação de dependências (`npm ci`)
- [x] Testes automatizados (`npm test`, Vitest)
- [x] Cobertura (`npm run coverage`)
- [x] Auditoria de dependências (`npm audit --audit-level=high`)
- [x] Publicação de resultados
- [x] Smoke test (Gate 6): sobe a aplicação e confere `/health`

## 4. Testes

- [x] Casos positivos e negativos
- [x] Testes unitários dos services ([`test/unit/`](test/unit))
- [x] Testes de integração da API com Supertest ([`test/integration/`](test/integration))
- [x] 80 testes ligados aos riscos levantados ([relatório, seção 3](RELATORIO.md#3-riscos))

## 5. Quality gates (mínimo exigido: 3)

- [x] Build/instalação: `npm ci` conclui sem erro
- [x] Análise estática: 0 erros do ESLint
- [x] Testes: 100% dos testes aprovados
- [x] Cobertura: ≥ 75% de linhas, statements e funções e ≥ 60% de branches em `src/services/`
- [x] Dependências: 0 vulnerabilidades `high` ou `critical`
- [x] Ficha completa de cada gate: critério, justificativa, momento, evidência, consequência e limitação ([relatório, seção 6](RELATORIO.md#6-quality-gates))

## 6. Experimento

- [x] Cenário aprovado: [execução 40379359112](https://github.com/espanha117/qaops-tarefas/actions/runs/40379359112)
- [x] Cenário reprovado (validação de título removida de propósito; Gate 3 bloqueia): [execução 40381350067](https://github.com/espanha117/qaops-tarefas/actions/runs/40381350067)
- [x] Correção (pipeline volta a aprovar): [execução 40381495351](https://github.com/espanha117/qaops-tarefas/actions/runs/40381495351)
- [x] Reprovação não planejada pelo Gate 5 em 19/10: [execução 39265702696](https://github.com/espanha117/qaops-tarefas/actions/runs/39265702696)
- [ ] Publicar relatório de testes também quando o pipeline falha (limitação apontada na seção 7 do relatório)

## 7. Relatório técnico ([`RELATORIO.md`](RELATORIO.md))

- [ ] 1. Identificação (falta a data da entrega)
- [x] 2. Contexto
- [x] 3. Riscos
- [x] 4. Pipeline
- [x] 5. Testes
- [x] 6. Quality gates
- [x] 7. Experimentos
- [x] 8. Análise crítica
- [ ] 9. Contribuições de cada integrante
- [x] Referências
- [ ] Revisão final e conferência do tamanho (6 a 10 páginas)

## 8. Apresentação e entrega

- [ ] Pré-avaliação (29/10/2026)
- [ ] Preparar apresentação final (10 a 12 min)
- [ ] Registro final da dupla preenchido

## 9. Monitoramento (evolução, etapa MONITOR do ciclo DevOps)

- [x] Endpoint de health check `/health` ([#21](https://github.com/espanha117/qaops-tarefas/issues/21))
- [ ] Log estruturado de requisições em JSON ([#22](https://github.com/espanha117/qaops-tarefas/issues/22))
- [x] Métricas no formato Prometheus em `/metrics` ([#23](https://github.com/espanha117/qaops-tarefas/issues/23))
- [x] Smoke test no pipeline: subir a aplicação e checar `/health` ([#24](https://github.com/espanha117/qaops-tarefas/issues/24))
- [x] Execução agendada do pipeline e Dependabot ([#25](https://github.com/espanha117/qaops-tarefas/issues/25))
- [ ] Resumo da execução no GitHub Actions ([#26](https://github.com/espanha117/qaops-tarefas/issues/26))
- [x] Documentar monitoramento no relatório e no README ([#27](https://github.com/espanha117/qaops-tarefas/issues/27))

## 10. Implantação e monitoramento na VM (etapas DEPLOY, OPERATE e MONITOR)

- [x] VM atrás do pfSense, com acesso restrito (VPN ou IPs autorizados) ([#34](https://github.com/espanha117/qaops-tarefas/issues/34))
- [x] Docker Compose com app, Prometheus, node-exporter e Grafana ([PR #42](https://github.com/espanha117/qaops-tarefas/pull/42))
- [x] Banco SQLite em volume persistente e senhas só no `.env` da VM
- [x] Painel do Grafana e 4 regras de alerta
- [x] Evidências: painel normal, alertas `MuitosAcessosNegados` e `SistemaForaDoAr` em *firing* e recuperação ([relatório, seção 7](RELATORIO.md#7-experimentos))
- [x] Primeiro deploy a partir da `master` (24/11/2026)
- [ ] Deploy automático (self-hosted runner) — fora do escopo, registrado como trabalho futuro
- [ ] Notificação dos alertas (e-mail ou mensagem) — fora do escopo, registrado como limitação
