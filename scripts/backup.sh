#!/bin/bash

# =============================================================================
# SCRIPT DE BACKUP — CAPUL PLATFORM
# =============================================================================
# Uso: ./backup.sh [tipo]
#   Tipos: full | app | db
#   Sem argumento: executa backup completo (full)
#
# Exemplos:
#   ./backup.sh           → backup completo
#   ./backup.sh full      → backup completo
#   ./backup.sh app       → somente aplicação
#   ./backup.sh db        → somente banco de dados
# =============================================================================

set -e

# =============================================================================
# CONFIGURAÇÕES
# =============================================================================

APP_DIR="/opt/capul-platform"
BACKUP_DIR="/opt/capul-platform/backups"
LOG_DIR="/var/log/capul-platform"
ENV_FILE="${APP_DIR}/.env"

DB_CONTAINER="capul-db"
DB_NAME="capul_platform"

BACKUP_RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# =============================================================================
# FUNÇÕES UTILITÁRIAS
# =============================================================================

log_info()    { echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [OK]${NC}    $1"; }
log_warning() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [AVISO]${NC} $1"; }
log_error()   { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERRO]${NC}  $1" >&2; }

check_requirements() {
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Arquivo .env não encontrado em $ENV_FILE"
        exit 1
    fi

    if ! docker ps --format "{{.Names}}" | grep -q "^${DB_CONTAINER}$"; then
        log_error "Container $DB_CONTAINER não está em execução"
        exit 1
    fi
}

load_env() {
    source "$ENV_FILE"
    if [ -z "$DB_USER" ]; then
        log_error "Variável DB_USER não definida no .env"
        exit 1
    fi
}

cleanup_old_backups() {
    log_info "Removendo backups com mais de ${BACKUP_RETENTION_DAYS} dias..."
    find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "backup_*.dump" -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true
    log_success "Limpeza concluída"
}

# =============================================================================
# FUNÇÕES DE BACKUP
# =============================================================================

backup_db() {
    local backup_file="${BACKUP_DIR}/backup_db_${TIMESTAMP}.dump"

    log_info "Iniciando backup do banco de dados..."
    log_info "Container: $DB_CONTAINER | Banco: $DB_NAME"

    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        -f /tmp/capul_db_dump.dump

    docker cp "${DB_CONTAINER}:/tmp/capul_db_dump.dump" "$backup_file"
    docker exec "$DB_CONTAINER" rm -f /tmp/capul_db_dump.dump

    local size
    size=$(du -sh "$backup_file" | cut -f1)
    log_success "Backup do banco salvo: $backup_file ($size)"
    echo "$backup_file"
}

backup_app() {
    local backup_file="${BACKUP_DIR}/backup_app_${TIMESTAMP}.tar.gz"

    log_info "Iniciando backup da aplicação..."

    tar -czf "$backup_file" \
        --exclude="capul-platform/.git" \
        --exclude="capul-platform/node_modules" \
        --exclude="capul-platform/*/node_modules" \
        --exclude="capul-platform/backups" \
        -C /opt capul-platform

    local size
    size=$(du -sh "$backup_file" | cut -f1)
    log_success "Backup da aplicação salvo: $backup_file ($size)"
    echo "$backup_file"
}

backup_full() {
    local backup_file="${BACKUP_DIR}/backup_full_${TIMESTAMP}.tar.gz"
    local db_dump_tmp="/tmp/capul_db_dump_${TIMESTAMP}.dump"

    log_info "Iniciando backup completo (aplicação + banco)..."

    # Dump do banco
    log_info "  → Exportando banco de dados..."
    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        -f /tmp/capul_db_dump.dump

    docker cp "${DB_CONTAINER}:/tmp/capul_db_dump.dump" "$db_dump_tmp"
    docker exec "$DB_CONTAINER" rm -f /tmp/capul_db_dump.dump

    # Tarball com aplicação + dump
    log_info "  → Comprimindo aplicação e banco..."
    tar -czf "$backup_file" \
        --exclude="capul-platform/.git" \
        --exclude="capul-platform/node_modules" \
        --exclude="capul-platform/*/node_modules" \
        --exclude="capul-platform/backups" \
        -C /opt capul-platform \
        -C /tmp "capul_db_dump_${TIMESTAMP}.dump"

    # Limpar dump temporário
    rm -f "$db_dump_tmp"

    local size
    size=$(du -sh "$backup_file" | cut -f1)
    log_success "Backup completo salvo: $backup_file ($size)"
    echo "$backup_file"
}

# =============================================================================
# MENU INTERATIVO
# =============================================================================

TIPO_SELECIONADO=""

select_tipo() {
    echo "" >/dev/tty
    echo -e "${BOLD}  Selecione o tipo de backup:${NC}" >/dev/tty
    echo "" >/dev/tty
    echo -e "  ${CYAN}1)${NC} full  — aplicação + banco de dados ${BOLD}(recomendado)${NC}" >/dev/tty
    echo -e "  ${CYAN}2)${NC} app   — somente aplicação (código)" >/dev/tty
    echo -e "  ${CYAN}3)${NC} db    — somente banco de dados" >/dev/tty
    echo -e "  ${CYAN}0)${NC} sair" >/dev/tty
    echo "" >/dev/tty

    while true; do
        read -r -p "  Opção [1/2/3/0]: " opcao </dev/tty
        case "$opcao" in
            1|full)  TIPO_SELECIONADO="full"; return ;;
            2|app)   TIPO_SELECIONADO="app";  return ;;
            3|db)    TIPO_SELECIONADO="db";   return ;;
            0|sair)  echo -e "\n  Operação cancelada.\n" >/dev/tty; exit 0 ;;
            *)
                echo -e "  ${YELLOW}Opção inválida. Digite 1, 2, 3 ou 0 para sair.${NC}" >/dev/tty
                ;;
        esac
    done
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    local tipo

    if [ -n "$1" ]; then
        tipo="$1"
    else
        echo ""
        echo -e "${BOLD}============================================================${NC}"
        echo -e "${BOLD}  BACKUP — CAPUL PLATFORM${NC}"
        echo -e "${BOLD}============================================================${NC}"
        select_tipo
        tipo="$TIPO_SELECIONADO"
    fi

    echo ""
    echo -e "${BOLD}============================================================${NC}"
    echo -e "${BOLD}  BACKUP — CAPUL PLATFORM${NC}"
    echo -e "${BOLD}  Data: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BOLD}  Tipo: ${tipo^^}${NC}"
    echo -e "${BOLD}============================================================${NC}"
    echo ""

    # Criar diretórios necessários
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"

    # Verificar requisitos e carregar variáveis
    check_requirements
    load_env

    case "$tipo" in
        full)
            backup_full
            ;;
        app)
            backup_app
            ;;
        db)
            backup_db
            ;;
        *)
            log_error "Tipo inválido: '$tipo'. Use: full | app | db"
            echo ""
            echo "Uso: $0 [full|app|db]"
            exit 1
            ;;
    esac

    # Limpar backups antigos
    echo ""
    cleanup_old_backups

    # Relatório de espaço
    echo ""
    log_info "Backups armazenados em: $BACKUP_DIR"
    log_info "Espaço utilizado: $(du -sh "$BACKUP_DIR" | cut -f1)"
    log_info "Total de arquivos: $(ls "$BACKUP_DIR" | wc -l)"

    echo ""
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD}  BACKUP CONCLUÍDO COM SUCESSO${NC}"
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo ""
}

main "$@"
