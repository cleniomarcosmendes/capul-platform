#!/bin/bash
set -euo pipefail

# =============================================
# Inventario — Marcar migrations existentes como aplicadas
# Executar UMA VEZ em banco que ja tem as migrations aplicadas
# =============================================

DB_URL="${DATABASE_URL:-postgresql://capul_user:capul_secure_password_2025@postgres:5432/capul_platform}"
MIGRATIONS_DIR="$(dirname "$0")/migrations"

echo "[inventario] Criando tabela de controle..."
psql "$DB_URL" -q << 'SQL'
CREATE TABLE IF NOT EXISTS inventario.schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64)
);
SQL

COUNT=0
for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  fname=$(basename "$file")
  checksum=$(md5sum "$file" | cut -d' ' -f1)
  psql "$DB_URL" -q -c \
    "INSERT INTO inventario.schema_migrations (filename, checksum) VALUES ('$fname', '$checksum') ON CONFLICT (filename) DO NOTHING"
  COUNT=$((COUNT + 1))
done

echo "[inventario] $COUNT migrations marcadas como aplicadas (baseline)"
