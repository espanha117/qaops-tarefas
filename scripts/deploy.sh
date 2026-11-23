#!/usr/bin/env bash
# Executado NA VM pelo job de deploy do CI (via ssh, lido da entrada padrao),
# depois que os 6 quality gates aprovaram. Tambem usado no rollback, com o
# commit anterior.
#
# Uso: deploy.sh <commit> [pasta-da-aplicacao]
set -euo pipefail

COMMIT="$1"
APP_DIR="${2:-qaops-tarefas}"

cd "$APP_DIR"
echo "Versao em execucao: $(git rev-parse --short HEAD)"

git fetch --quiet origin
# reset --hard nao apaga arquivos ignorados pelo Git, entao o banco
# (data/tasks.db) e preservado entre deploys.
git reset --hard "$COMMIT"
npm ci --omit=dev

# sudo -n falha em vez de pedir senha; a VM precisa liberar so este comando
# para o usuario de deploy (ver README, secao "Deploy na VM").
sudo -n systemctl restart qaops-tarefas
echo "Versao implantada: $(git rev-parse --short HEAD)"
