#!/bin/bash
set -eu

# =============================================
# Inventario — SQL Migration Runner
# Idempotente: seguro re-executar
# =============================================

DB_URL="${DATABASE_URL:-postgresql://capul_user:capul_secure_password_2025@postgres:5432/capul_platform}"
MIGRATIONS_DIR="$(dirname "$0")/migrations"

echo "[inventario] Verificando tabela de controle..."
psql "$DB_URL" -q << 'SQL'
CREATE TABLE IF NOT EXISTS inventario.schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64)
);
SQL

APPLIED=0
SKIPPED=0

for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  fname=$(basename "$file")
  checksum=$(md5sum "$file" | cut -d' ' -f1)

  already=$(psql "$DB_URL" -tAc \
    "SELECT COUNT(*) FROM inventario.schema_migrations WHERE filename='$fname'" 2>/dev/null || echo "0")

  if [ "$already" = "0" ]; then
    echo "[inventario] Aplicando: $fname"
    # Pre-processar SQL para idempotencia:
    # - ADD COLUMN sem IF NOT EXISTS -> ADD COLUMN IF NOT EXISTS
    # - CREATE INDEX sem IF NOT EXISTS -> CREATE INDEX IF NOT EXISTS
    # - Filtrar meta-comandos psql (\c, \d, etc.) que causam erro
    # - Definir search_path para inventario
    (echo "SET search_path TO inventario, public;" && \
     sed '/^\\c /d' "$file" \
       | sed -E 's/ADD COLUMN (IF NOT EXISTS )?/ADD COLUMN IF NOT EXISTS /g' \
       | sed -E 's/CREATE INDEX (IF NOT EXISTS )?/CREATE INDEX IF NOT EXISTS /g') \
      | psql "$DB_URL" -v ON_ERROR_STOP=1 -q 2>&1 || {
      echo "[inventario] ERRO ao aplicar $fname"
      exit 1
    }
    psql "$DB_URL" -q -c \
      "INSERT INTO inventario.schema_migrations (filename, checksum) VALUES ('$fname', '$checksum')"
    APPLIED=$((APPLIED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo "[inventario] Concluido: $APPLIED aplicadas, $SKIPPED ignoradas (ja aplicadas)"
