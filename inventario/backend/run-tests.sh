#!/usr/bin/env bash
# Runner pytest do inventario-backend.
# Como `tests/` está no .dockerignore (não vai pro registry de produção),
# copia tests/ pro container antes de rodar.
#
# Uso:
#   ./run-tests.sh                              # roda toda a suite
#   ./run-tests.sh tests/test_avanco_ciclos.py  # roda arquivo específico
#   ./run-tests.sh -k handoff                   # filtro pytest
set -euo pipefail

CONTAINER=capul-inventario-api
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copia tests/ pro container (sobrescreve se existir)
docker compose -f "$SCRIPT_DIR/../../docker-compose.yml" exec -T inventario-backend rm -rf /app/tests 2>/dev/null || true
docker cp "$SCRIPT_DIR/tests" "$CONTAINER:/app/tests"

# Roda pytest com args passados
docker compose -f "$SCRIPT_DIR/../../docker-compose.yml" exec -T inventario-backend \
    bash -c "cd /app && pytest ${*:-tests/} -v --tb=short"
