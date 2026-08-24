#!/usr/bin/env bash
# ============================================================================
# Build de imagem COM IDENTIDADE — grava commit e data dentro da imagem.
#
# POR QUE existe: o /health de cada backend devolve `versao.commit`, que a tela
# "Sobre" do app mostra ao lado da versão do próprio app. É assim que se responde
# em campo, sem acesso ao servidor: "o APK novo está falando com o backend novo?".
#
# `docker compose build` puro continua funcionando — só que a imagem sai marcada
# como "desconhecido", que é o certo: build sem identidade tem de se declarar
# sem identidade, nunca herdar a de outro.
#
# USO (na raiz do repo, com o checkout NO COMMIT QUE VAI SUBIR):
#   ./scripts/build-com-versao.sh logistica-backend auth-gateway
#   ./scripts/build-com-versao.sh                     # todos os que aceitam os args
#
# Depois: docker compose up -d <serviços>
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERRO: fora de um repositório git — não há commit para gravar na imagem." >&2
  exit 1
fi

APP_COMMIT="$(git rev-parse --short HEAD)"
# Árvore suja = a imagem NÃO é o commit. Dizer isso é o ponto do script.
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  APP_COMMIT="${APP_COMMIT}-sujo"
  echo "AVISO: há alterações não commitadas — a imagem sai marcada '${APP_COMMIT}'." >&2
fi
APP_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export APP_COMMIT APP_BUILD_TIME
echo "Build  commit=${APP_COMMIT}  em=${APP_BUILD_TIME}"
echo "Alvos: ${*:-<todos>}"
docker compose build "$@"

echo
echo "Pronto. Conferir depois do 'up -d':"
echo "  curl -sk https://localhost/api/v1/logistica/health | grep -o '\"versao\":{[^}]*}'"
echo "  curl -sk https://localhost/api/v1/auth/health      | grep -o '\"versao\":{[^}]*}'"
