#!/bin/sh
# =============================================================================
# GUARDA DO JOB DE MIGRATION — o job nao pode sair verde mentindo.
#
# Incidente de 05/09/2026: `capul-auth-migrate` imprimiu "No pending migrations
# to apply." e saiu 0 com a migration esperada AUSENTE do banco. A mensagem
# estava tecnicamente correta — a IMAGEM do job era velha e nao continha a
# migration nova. Em producao isso e deploy verde com modulo quebrado.
#
# ⭐ A referencia e a ARVORE DO REPO (bind mount ro), nao o diretorio da imagem.
# Comparar a imagem com o banco NAO pega o incidente acima: imagem velha tem
# poucas migrations, todas aplicadas, e a conferencia fecha. Quem sabe o que
# DEVERIA estar aplicado e o codigo que o deployer acabou de puxar.
#
# Variaveis:
#   PRISMA_SCHEMA    caminho do schema DENTRO da imagem (default prisma/schema.prisma)
#   MIGRATIONS_FONTE diretorio de migrations da arvore do repo (default /prisma-fonte/migrations)
#   PRISMA_URL_VAR   nome da env com a connection string  (default DATABASE_URL)
# =============================================================================
set -eu

SCHEMA="${PRISMA_SCHEMA:-prisma/schema.prisma}"
FONTE="${MIGRATIONS_FONTE:-/prisma-fonte/migrations}"
VAR_URL="${PRISMA_URL_VAR:-DATABASE_URL}"
IMAGEM="$(dirname "$SCHEMA")/migrations"

if [ ! -d "$FONTE" ]; then
  echo "GUARDA: o diretorio de referencia '$FONTE' nao existe no container." >&2
  echo "GUARDA: o job espera um bind mount read-only do prisma/ do repositorio." >&2
  echo "GUARDA: sem referencia nao ha o que conferir — abortando em vez de fingir sucesso." >&2
  exit 1
fi

npx prisma migrate deploy --schema="$SCHEMA"

node /guarda/verificar.mjs "$FONTE" "$IMAGEM" "$VAR_URL"
