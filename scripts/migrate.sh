#!/bin/bash
set -euo pipefail

# =============================================
# Capul Platform — Migration Runner
# Idempotente: seguro re-executar
# Uso: bash scripts/migrate.sh [--skip-seed] [--baseline-inventario]
# =============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

SKIP_SEED=false
BASELINE_INV=false

for arg in "$@"; do
  case $arg in
    --skip-seed) SKIP_SEED=true ;;
    --baseline-inventario) BASELINE_INV=true ;;
  esac
done

echo "============================================="
echo " Capul Platform — Migration Runner"
echo "============================================="
echo ""

# --- Fase 0: Aguardar PostgreSQL ---
echo "[0/5] Aguardando PostgreSQL..."
until docker compose exec -T postgres pg_isready -U capul_user -q 2>/dev/null; do
  echo "  Aguardando..."
  sleep 2
done
echo "  PostgreSQL pronto."
echo ""

# --- Fase 1: Schemas ---
echo "[1/5] Verificando schemas..."
docker compose exec -T postgres psql -U capul_user -d capul_platform -q << 'SQL'
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS gestao_ti;
CREATE SCHEMA IF NOT EXISTS inventario;
SQL
echo "  Schemas verificados."
echo ""

# --- Fase 2: Auth Gateway (Prisma migrate deploy) ---
echo "[2/5] Auth Gateway — migrations..."
docker compose exec -T auth-gateway npx prisma migrate deploy 2>&1 | grep -v "^$" | sed 's/^/  /'
if [ "$SKIP_SEED" = false ]; then
  echo "  Executando seed..."
  if docker compose exec -T auth-gateway npx prisma db seed 2>&1 | sed 's/^/  /'; then
    echo "  Seed auth-gateway concluido."
  else
    echo "  ERRO: Seed auth-gateway falhou! Verifique a saida acima."
    exit 1
  fi
fi
echo ""

# --- Fase 3: Gestao TI (Prisma migrate deploy) ---
echo "[3/5] Gestao TI — migrations..."
docker compose exec -T gestao-ti-backend npx prisma migrate deploy 2>&1 | grep -v "^$" | sed 's/^/  /'
if [ "$SKIP_SEED" = false ]; then
  echo "  Executando seed..."
  if docker compose exec -T gestao-ti-backend npx prisma db seed 2>&1 | sed 's/^/  /'; then
    echo "  Seed gestao-ti concluido."
  else
    echo "  ERRO: Seed gestao-ti falhou! Verifique a saida acima."
    exit 1
  fi
fi
echo ""

# --- Fase 4: Inventario (SQL migrations) ---
echo "[4/5] Inventario — migrations..."
if [ "$BASELINE_INV" = true ]; then
  echo "  Marcando migrations existentes como aplicadas (baseline)..."
  docker compose exec -T postgres bash -c '
    export PGPASSWORD=$POSTGRES_PASSWORD
    DB_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB"
    cd /migrations-inv 2>/dev/null || { echo "  Volume /migrations-inv nao montado. Pulando."; exit 0; }
    bash baseline-existing.sh
  ' 2>&1 | sed 's/^/  /'
else
  # Aguardar inventario-backend ficar healthy (cria tabelas base via SQLAlchemy)
  echo "  Aguardando inventario-backend..."
  RETRIES=0
  until docker compose exec -T inventario-backend curl -sf http://localhost:8000/health > /dev/null 2>&1 || [ $RETRIES -ge 30 ]; do
    RETRIES=$((RETRIES + 1))
    sleep 2
  done
  docker compose exec -T postgres bash -c '
    export PGPASSWORD=$POSTGRES_PASSWORD
    DB_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB"
    cd /migrations-inv 2>/dev/null || { echo "  Volume /migrations-inv nao montado. Pulando."; exit 0; }
    bash migrate.sh
  ' 2>&1 | sed 's/^/  /'
fi
echo ""

# --- Fase 5: Verificacao ---
echo "[5/5] Verificacao..."
docker compose exec -T postgres psql -U capul_user -d capul_platform -tAc "
  SELECT 'core: ' || COUNT(*) || ' tabelas' FROM information_schema.tables WHERE table_schema = 'core'
  UNION ALL
  SELECT 'gestao_ti: ' || COUNT(*) || ' tabelas' FROM information_schema.tables WHERE table_schema = 'gestao_ti'
  UNION ALL
  SELECT 'inventario: ' || COUNT(*) || ' tabelas' FROM information_schema.tables WHERE table_schema = 'inventario';
" 2>/dev/null | sed 's/^/  /'
echo ""
echo "============================================="
echo " Migrations concluidas com sucesso!"
echo "============================================="
