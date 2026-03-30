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
AUTH_OUT=$(docker compose exec -T auth-gateway npx prisma migrate deploy 2>&1) || { echo "$AUTH_OUT" | grep -v "^$" | sed 's/^/  /'; echo "  ERRO: Migration auth-gateway falhou!"; exit 1; }
echo "$AUTH_OUT" | grep -v "^$" | sed 's/^/  /' || true
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

# --- Fase 3: Gestao TI (Prisma migrate resolve — workaround bug multiSchema) ---
echo "[3/5] Gestao TI — migrations..."
# Workaround: bug Prisma 6 + multiSchema (issues #16565, #23327).
# prisma migrate deploy falha com "migration persistence is not initialized" ao inicializar
# _prisma_migrations com multiSchema. Solucao confirmada: executar o SQL diretamente via psql
# e usar prisma migrate resolve --applied (usa ResolveMigrationHistory, sem o bug).
# Idempotente: verifica quais migrations ja foram aplicadas antes de executar.

APPLIED=$(docker compose exec -T postgres psql -U capul_user -d capul_platform -tAc \
  "SELECT migration_name FROM public._prisma_migrations;" 2>/dev/null || echo "")

MIGRATION_DIRS=$(docker compose exec -T gestao-ti-backend sh -c \
  'ls prisma/migrations/ | grep -v migration_lock | sort')

for MIGRATION in $MIGRATION_DIRS; do
  if echo "$APPLIED" | grep -qx "$MIGRATION"; then
    echo "  $MIGRATION: ja aplicada, pulando."
  else
    echo "  Aplicando: $MIGRATION"
    docker compose exec -T gestao-ti-backend cat "prisma/migrations/$MIGRATION/migration.sql" \
      | docker compose exec -T postgres psql -U capul_user -d capul_platform -q 2>&1 | sed 's/^/    /'
    RESOLVE_OUT=$(docker compose exec -T gestao-ti-backend npx prisma migrate resolve --applied "$MIGRATION" 2>&1) \
      || { echo "$RESOLVE_OUT" | sed 's/^/  /'; echo "  ERRO: resolve $MIGRATION falhou!"; exit 1; }
    echo "$RESOLVE_OUT" | grep -E "(marked|Error)" | sed 's/^/  /' || true
  fi
done
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
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB"
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

  # Aguardar o SQLAlchemy criar a tabela inventory_lists (health pode responder antes das tabelas existirem)
  echo "  Aguardando tabelas base (inventory_lists)..."
  RETRIES=0
  until docker compose exec -T postgres psql -U capul_user -d capul_platform -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='inventario' AND table_name='inventory_lists';" \
    2>/dev/null | grep -q 1 || [ $RETRIES -ge 30 ]; do
    RETRIES=$((RETRIES + 1))
    sleep 2
  done
  echo "  Tabelas base prontas."
  docker compose exec -T postgres bash -c '
    export PGPASSWORD=$POSTGRES_PASSWORD
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB"
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
