#!/bin/bash

# =============================================================================
# DR TEST — CAPUL PLATFORM
# =============================================================================
# Testa restauração do backup mais recente em ambiente isolado.
# Não toca em produção. Usa um banco temporário no mesmo postgres ou em outra
# instância (variável DR_TEST_DB).
#
# Uso:
#   sudo ./scripts/dr-test.sh [arquivo-de-backup]
#   Sem argumento: usa o backup_full mais recente em /opt/capul-platform/backups
#
# Auditoria 26/04/2026 #3 — backup que nao foi restaurado nao conta como backup.
# =============================================================================

set -e

APP_DIR="/opt/capul-platform"
BACKUP_DIR="${APP_DIR}/backups"
ENV_FILE="${APP_DIR}/.env"
TEST_DB="${DR_TEST_DB:-capul_dr_test}"
DB_CONTAINER="capul-db"
AUTH_CONTAINER="capul-auth"
ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-/etc/capul-backup-key}"

# Tracking inicio
DR_START_EPOCH=$(date +%s)
DR_DISCREPANCIAS=()

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log_info()    { echo -e "${CYAN}[$(date '+%H:%M:%S')] [INFO]${NC}  $1"; }
log_ok()      { echo -e "${GREEN}[$(date '+%H:%M:%S')] [OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] [AVISO]${NC} $1"; DR_DISCREPANCIAS+=("$1"); }
log_error()   { echo -e "${RED}[$(date '+%H:%M:%S')] [ERRO]${NC}  $1" >&2; DR_DISCREPANCIAS+=("ERRO: $1"); }

# Registra execucao do DR test no historico via API interna do auth-gateway
# (visivel no Configurador junto com os backups). Auditoria 26/04/2026.
track_dr_test() {
    local status="$1"   # SUCESSO | FALHA
    local msg="$2"
    if ! docker ps --format "{{.Names}}" | grep -q "^${AUTH_CONTAINER}$"; then
        return 0
    fi
    local hostname; hostname=$(hostname)
    local end_epoch; end_epoch=$(date +%s)
    local duracao_ms=$(( (end_epoch - DR_START_EPOCH) * 1000 ))
    # Concatena discrepancias (escape simples)
    local discrep
    discrep=$(printf '%s | ' "${DR_DISCREPANCIAS[@]:-nenhuma}" | sed 's/ | $//')
    local msg_full="${msg} -- discrepancias: ${discrep}"
    local msg_json; msg_json=$(printf '%s' "$msg_full" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"\"")

    local payload="{\"tipo\":\"dr-test\",\"status\":\"${status}\",\"finalizadoEm\":\"$(date -Iseconds)\",\"duracaoMs\":${duracao_ms},\"hostname\":\"${hostname}\",\"destino\":\"local\",\"cifrado\":false,\"mensagem\":${msg_json}}"

    docker exec "$AUTH_CONTAINER" wget -qO- --post-data="$payload" \
        --header='Content-Type: application/json' \
        --timeout=5 \
        "http://localhost:3000/api/v1/internal/backup/execucao" >/dev/null 2>&1 || true
}

# Trap pra registrar falha em caso de erro nao tratado
trap 'track_dr_test "FALHA" "DR test interrompido (sinal/erro)"' ERR

main() {
    echo ""
    echo -e "${BOLD}============================================================${NC}"
    echo -e "${BOLD}  DR TEST — CAPUL PLATFORM${NC}"
    echo -e "${BOLD}  Banco temporario: ${TEST_DB}${NC}"
    echo -e "${BOLD}============================================================${NC}"
    echo ""

    [ -f "$ENV_FILE" ] || { log_error ".env nao encontrado em $ENV_FILE"; exit 1; }
    # shellcheck disable=SC1090
    source "$ENV_FILE"

    # 1. Localizar backup
    local backup_file="$1"
    if [ -z "$backup_file" ]; then
        # Pega dump mais recente (pode ser .dump ou .dump.enc)
        backup_file=$(ls -t "${BACKUP_DIR}"/backup_db_*.dump* 2>/dev/null | head -1)
    fi
    [ -z "$backup_file" ] && { log_error "Nenhum backup_db_*.dump encontrado"; exit 1; }
    [ -f "$backup_file" ] || { log_error "Arquivo nao existe: $backup_file"; exit 1; }
    log_info "Backup escolhido: $backup_file"

    # 2. Decifrar se necessario
    local dump_plain="/tmp/dr-test-${RANDOM}.dump"
    if [[ "$backup_file" == *.enc ]]; then
        [ -r "$ENCRYPTION_KEY_FILE" ] || { log_error "Chave nao acessivel: $ENCRYPTION_KEY_FILE"; exit 1; }
        log_info "Decifrando..."
        openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:${ENCRYPTION_KEY_FILE}" \
            -in "$backup_file" -out "$dump_plain"
    else
        cp "$backup_file" "$dump_plain"
    fi
    log_ok "Dump decifrado em $dump_plain ($(du -sh "$dump_plain" | cut -f1))"

    # 3. Criar DB temporario
    log_info "Criando banco temporario ${TEST_DB}..."
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE ${TEST_DB};" >/dev/null
    log_ok "Banco ${TEST_DB} criado"

    # 4. Copiar dump pro container e restaurar
    log_info "Restaurando dump..."
    docker cp "$dump_plain" "${DB_CONTAINER}:/tmp/dr-test.dump"
    if docker exec "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$TEST_DB" \
            --no-owner --no-privileges /tmp/dr-test.dump 2>&1 | tee /tmp/dr-restore.log | tail -5; then
        log_ok "pg_restore concluiu (warnings sao normais — checar contagens abaixo)"
    fi

    # 5. Validar contagens vs producao
    echo ""
    log_info "=== Validacao: contagens ==="
    local tabelas=("core.usuarios" "gestao_ti.projetos" "gestao_ti.chamados" "gestao_ti.atividades_projeto" "fiscal.documento_consulta")
    for t in "${tabelas[@]}"; do
        local count_prod count_test
        count_prod=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d capul_platform -tAc "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo "?")
        count_test=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB"     -tAc "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo "?")
        if [ "$count_prod" = "$count_test" ]; then
            log_ok "  $t: ${count_prod} (PROD == TESTE)"
        else
            log_warn "  $t: PROD=${count_prod} != TESTE=${count_test}"
        fi
    done

    # 6. Validar integridade de FKs basicas (apenas spot check)
    echo ""
    log_info "=== Validacao: FK integrity (spot) ==="
    local fk_orfaos
    fk_orfaos=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc "
        SELECT COUNT(*) FROM gestao_ti.projetos p
        WHERE p.projeto_pai_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM gestao_ti.projetos pp WHERE pp.id = p.projeto_pai_id);
    " 2>/dev/null || echo "?")
    if [ "$fk_orfaos" = "0" ]; then
        log_ok "  Nenhum subprojeto orfao"
    else
        log_warn "  ${fk_orfaos} subprojetos orfaos (FK quebrada)"
    fi

    # 7. Cleanup
    echo ""
    log_info "Limpando..."
    docker exec "$DB_CONTAINER" rm -f /tmp/dr-test.dump
    rm -f "$dump_plain" /tmp/dr-restore.log
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null
    log_ok "Cleanup concluido"

    echo ""
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD}  DR TEST CONCLUIDO${NC}"
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo ""

    # Registra no historico (visivel no Configurador)
    if [ ${#DR_DISCREPANCIAS[@]} -eq 0 ]; then
        track_dr_test "SUCESSO" "DR test passou — todas tabelas com PROD == TESTE"
    else
        track_dr_test "FALHA" "DR test com ${#DR_DISCREPANCIAS[@]} discrepancia(s)"
    fi
}

main "$@"
