#!/usr/bin/env bash
# ============================================================================
# Certificado autoassinado para DESENVOLVIMENTO (nginx/certs/).
#
# POR QUE existe: `nginx/certs/*.crt|*.key` são ignorados pelo git de propósito
# ("dev only — DO NOT commit production certs"), então um clone novo vem sem
# certificado e o nginx não sobe. Este script gera o par local.
#
# ⚠️ NÃO use em HOMOLOGAÇÃO nem PRODUÇÃO: lá o certificado é o real do domínio,
# fica no servidor e não pertence ao repositório.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DESTINO="nginx/certs"

if [ -f "$DESTINO/server.crt" ] && [ -f "$DESTINO/server.key" ]; then
  echo "Já existe $DESTINO/server.crt + server.key — nada a fazer."
  echo "(Para refazer, apague os dois e rode de novo.)"
  exit 0
fi

mkdir -p "$DESTINO"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DESTINO/server.key" -out "$DESTINO/server.crt" \
  -subj "/CN=capul-platform" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null

echo "Gerado $DESTINO/server.crt + server.key (autoassinado, 365 dias, CN=capul-platform)."
echo "O Chrome vai reclamar do certificado — é esperado em DEV."
