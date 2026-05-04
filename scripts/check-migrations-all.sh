#!/bin/bash
# scripts/check-migrations-all.sh
#
# Audit: roda check-prisma-migrations.mjs nos 3 backends Prisma e agrega
# resultado. Ideal para rodar antes de cada deploy ou em CI.
#
# Uso:
#   ./scripts/check-migrations-all.sh
#
# Exit:
#   0 se todos OK, 1 se algum falhou.

set -uo pipefail

cd "$(dirname "$0")/.."

declare -a BACKENDS=("auth-gateway" "fiscal/backend" "gestao-ti/backend")
declare -a FAILED=()

for backend in "${BACKENDS[@]}"; do
  echo
  if ! node scripts/check-prisma-migrations.mjs --root "$backend"; then
    FAILED+=("$backend")
  fi
done

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✓ Todos os ${#BACKENDS[@]} backends estão consistentes (schema vs migrations)."
  exit 0
else
  echo "✗ ${#FAILED[@]} backend(s) com inconsistência:"
  for b in "${FAILED[@]}"; do
    echo "  - $b"
  done
  echo
  echo "Antes de fazer deploy, gere migrations idempotentes para as tabelas faltantes."
  echo "Ver: docs/_TEMPLATE_Roteiro_Deploy.md (PASSO 0.5 / Checklist Seção 10)"
  exit 1
fi
