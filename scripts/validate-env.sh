#!/usr/bin/env bash
#
# scripts/validate-env.sh
#
# Valida que o arquivo .env da Plataforma Capul tem todas as variaveis
# obrigatorias preenchidas ANTES de subir os containers. Criado apos o
# incidente de 19/04/2026 em que o deploy subiu com REDIS_PASSWORD,
# FISCAL_MASTER_KEY e PROTHEUS_API_AUTH vazios, deixando:
#   - Redis sem autenticacao (qualquer processo no host acessa)
#   - Fiscal nao consegue descriptografar senha do certificado A1
#   - Fiscal nao consegue autenticar no Protheus (401 silencioso)
#
# Docker Compose NAO trata variavel vazia como erro — apenas warning.
# Este script trata como erro e sai com codigo 1, abortando o deploy.
#
# USO:
#   bash scripts/validate-env.sh          # valida .env na raiz do projeto
#   bash scripts/validate-env.sh path/.env  # valida arquivo customizado
#
# Para pular em dev (NAO USAR EM PROD):
#   VALIDATE_ENV_SKIP=1 bash scripts/validate-env.sh

set -euo pipefail

ENV_FILE="${1:-.env}"

if [ "${VALIDATE_ENV_SKIP:-0}" = "1" ]; then
  echo "[validate-env] VALIDATE_ENV_SKIP=1 — pulando validacao (uso dev)."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[validate-env] ERRO: arquivo '$ENV_FILE' nao encontrado." >&2
  exit 1
fi

# Permissoes do .env (avisar se for world-readable)
perm=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || echo "000")
if [ "$perm" = "777" ] || [ "$perm" = "666" ] || [ "$perm" = "644" ]; then
  echo "[validate-env] AVISO: permissoes de '$ENV_FILE' sao $perm (world-readable)."
  echo "  Em producao, execute: chmod 600 '$ENV_FILE'"
fi

# ----------------------------------------------------------------------------
# Variaveis obrigatorias (erro se ausente ou vazia)
# ----------------------------------------------------------------------------
REQUIRED=(
  # Banco (obrigatorio)
  "DB_USER"
  "DB_PASSWORD"

  # JWT (obrigatorio — quebra auth inteira)
  "JWT_SECRET"
  "JWT_REFRESH_SECRET"

  # Redis (obrigatorio — sem isto, Redis roda sem autenticacao)
  "REDIS_PASSWORD"

  # Protheus (consumido por gestao-ti e fiscal)
  "PROTHEUS_API_URL"
  "PROTHEUS_API_AUTH"

  # Fiscal — criptografia da senha do certificado A1
  "FISCAL_MASTER_KEY"

  # Fiscal — CNPJ consulente para SEFAZ
  "FISCAL_CNPJ_CONSULENTE"
)

# ----------------------------------------------------------------------------
# Recomendadas (so avisa, nao aborta)
# ----------------------------------------------------------------------------
RECOMMENDED=(
  "PGADMIN_EMAIL"
  "PGADMIN_PASSWORD"
  "CORS_ORIGINS"
  "FISCAL_SMTP_HOST"
  "FISCAL_SMTP_USER"
  "FISCAL_SMTP_PASS"
  "FISCAL_FALLBACK_EMAIL"
  "INITIAL_ADMIN_PASSWORD"
)

# Le o .env para um array associativo ignorando comentarios/linhas vazias
declare -A ENV_VARS
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Remove espacos
  key="$(echo "$key" | tr -d '[:space:]')"
  # Pula vazios e comentarios
  [ -z "$key" ] && continue
  [[ "$key" =~ ^# ]] && continue
  # Remove aspas externas do value, se houver
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  ENV_VARS["$key"]="$value"
done < "$ENV_FILE"

MISSING=()
EMPTY=()
for var in "${REQUIRED[@]}"; do
  if [ -z "${ENV_VARS[$var]+x}" ]; then
    MISSING+=("$var")
  elif [ -z "${ENV_VARS[$var]}" ]; then
    EMPTY+=("$var")
  fi
done

MISSING_RECOMMENDED=()
EMPTY_RECOMMENDED=()
for var in "${RECOMMENDED[@]}"; do
  if [ -z "${ENV_VARS[$var]+x}" ]; then
    MISSING_RECOMMENDED+=("$var")
  elif [ -z "${ENV_VARS[$var]}" ]; then
    EMPTY_RECOMMENDED+=("$var")
  fi
done

# ----------------------------------------------------------------------------
# Relatorio
# ----------------------------------------------------------------------------
echo "[validate-env] Validando '$ENV_FILE'..."
echo "[validate-env]   Variaveis obrigatorias: ${#REQUIRED[@]}"
echo "[validate-env]   Variaveis recomendadas: ${#RECOMMENDED[@]}"
echo

ERRO=0

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "[validate-env] ERRO: variaveis obrigatorias AUSENTES no '$ENV_FILE':" >&2
  for v in "${MISSING[@]}"; do
    echo "  - $v" >&2
  done
  echo >&2
  ERRO=1
fi

if [ ${#EMPTY[@]} -gt 0 ]; then
  echo "[validate-env] ERRO: variaveis obrigatorias VAZIAS no '$ENV_FILE':" >&2
  for v in "${EMPTY[@]}"; do
    echo "  - $v" >&2
  done
  echo >&2
  ERRO=1
fi

if [ ${#MISSING_RECOMMENDED[@]} -gt 0 ] || [ ${#EMPTY_RECOMMENDED[@]} -gt 0 ]; then
  echo "[validate-env] AVISO: variaveis recomendadas ausentes/vazias:"
  for v in "${MISSING_RECOMMENDED[@]}"; do
    echo "  - $v (ausente)"
  done
  for v in "${EMPTY_RECOMMENDED[@]}"; do
    echo "  - $v (vazia)"
  done
  echo "  Estas NAO abortam o deploy, mas podem causar funcionalidades degradadas."
  echo
fi

if [ $ERRO -eq 1 ]; then
  echo "[validate-env] FALHA. Preencha as variaveis acima em '$ENV_FILE' antes de rodar 'docker compose up'." >&2
  echo "[validate-env] Para pular esta validacao em DEV (NAO USAR EM PROD): VALIDATE_ENV_SKIP=1" >&2
  exit 1
fi

echo "[validate-env] OK — todas as variaveis obrigatorias preenchidas."
exit 0
