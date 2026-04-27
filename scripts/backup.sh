#!/bin/bash

# =============================================================================
# SCRIPT DE BACKUP — CAPUL PLATFORM
# =============================================================================
# Uso: ./backup.sh [tipo]
#   Tipos: full | app | db | uploads
#   Sem argumento: executa backup completo (full)
#
# Exemplos:
#   ./backup.sh           → backup completo
#   ./backup.sh full      → backup completo (app + banco + uploads)
#   ./backup.sh app       → somente aplicação
#   ./backup.sh db        → somente banco de dados
#   ./backup.sh uploads   → somente arquivos de upload (anexos)
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
APP_CONTAINER="capul-gestao-ti-api"
REDIS_CONTAINER="capul-redis"
FISCAL_CONTAINER="capul-fiscal-api"
DB_NAME="capul_platform"
UPLOADS_VOLUME="uploads_data"
UPLOADS_PATH="/app/uploads"
FISCAL_CERTS_PATH="${APP_DIR}/fiscal/backend/certs"

BACKUP_RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Criptografia opcional — se BACKUP_ENCRYPTION_KEY_FILE estiver definido E o
# arquivo existir, dump do banco + .env + cert A1 + Redis sao cifrados com
# openssl AES-256-CBC. Em DEV (sem chave), backup roda sem criptografia.
# Em PROD obrigatorio criar /etc/capul-backup-key (root:root 0600) com
# `openssl rand -hex 32 > /etc/capul-backup-key`.
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-/etc/capul-backup-key}"

# Email de alerta (se SMTP/mail disponivel no host) — usado quando backup falha
BACKUP_ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-}"

# Webhook Slack/Teams/Discord (URL completa de Incoming Webhook).
# Mais visivel que email em equipes ja conectadas a essas plataformas.
BACKUP_ALERT_WEBHOOK="${BACKUP_ALERT_WEBHOOK:-}"

# Off-site (S3 ou compativel — Backblaze B2, MinIO, etc.).
# Configurar AWS CLI no host antes (`aws configure` ou via IAM Role).
# Ex: AWS_S3_BACKUP_BUCKET=capul-platform-backups-prod
#     AWS_DEFAULT_REGION=sa-east-1
BACKUP_S3_BUCKET="${AWS_S3_BACKUP_BUCKET:-}"

# Tracking — registra execucao via API interna do auth-gateway pra aparecer
# no Configurador (auditoria 26/04/2026 Sprint 4 — visibilidade).
BACKUP_TRACK_API="${BACKUP_TRACK_API:-true}"
AUTH_CONTAINER="capul-auth"

# Variaveis preenchidas durante a execucao para o tracking
BACKUP_START_EPOCH=""
BACKUP_END_EPOCH=""
BACKUP_TOTAL_BYTES=0

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
    # Política GFS (Grandfather-Father-Son) — auditoria 26/04/2026 #14:
    # - Diários: ${BACKUP_RETENTION_DAYS} dias (default 30)
    # - Semanais: 8 semanas (56 dias) — copia rotacional
    # - Mensais: 12 meses (365 dias) — copia rotacional
    log_info "Limpeza GFS: diarios > ${BACKUP_RETENTION_DAYS}d, semanais > 56d, mensais > 365d..."

    # Diários (root do BACKUP_DIR)
    find "$BACKUP_DIR" -maxdepth 1 -name "backup_*.tar.gz" -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true
    find "$BACKUP_DIR" -maxdepth 1 -name "backup_*.dump"   -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true
    find "$BACKUP_DIR" -maxdepth 1 -name "backup_*.enc"    -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true
    find "$BACKUP_DIR" -maxdepth 1 -name "backup_*.txt"    -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true
    find "$BACKUP_DIR" -maxdepth 1 -name "backup_*.rdb"    -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true

    # Semanais e mensais (em subdirs dedicados)
    [ -d "${BACKUP_DIR}/weekly" ]  && find "${BACKUP_DIR}/weekly"  -type f -mtime +56  -delete 2>/dev/null || true
    [ -d "${BACKUP_DIR}/monthly" ] && find "${BACKUP_DIR}/monthly" -type f -mtime +365 -delete 2>/dev/null || true

    log_success "Limpeza concluída"
}

# Promove o backup full mais recente para 'weekly/' (todo domingo) ou 'monthly/'
# (todo dia 1). Auditoria 26/04/2026 #14.
promote_gfs() {
    local dow; dow=$(date +%u)   # 1-7 (1=Mon..7=Sun)
    local dom; dom=$(date +%d)   # 01-31
    local latest_full
    latest_full=$(ls -t "${BACKUP_DIR}"/backup_full_*.tar.gz 2>/dev/null | head -1)
    [ -z "$latest_full" ] && return 0

    # Domingos → cópia para weekly/
    if [ "$dow" = "7" ]; then
        mkdir -p "${BACKUP_DIR}/weekly"
        cp "$latest_full" "${BACKUP_DIR}/weekly/" 2>/dev/null || true
        log_info "Backup promovido para weekly/"
    fi
    # Dia 1 do mes → cópia para monthly/
    if [ "$dom" = "01" ]; then
        mkdir -p "${BACKUP_DIR}/monthly"
        cp "$latest_full" "${BACKUP_DIR}/monthly/" 2>/dev/null || true
        log_info "Backup promovido para monthly/"
    fi
}

# Determina se vamos cifrar os artefatos sensíveis (cert A1 + .env + db + redis).
# Em PROD: sim (chave em /etc/capul-backup-key).
# Em DEV: opcional — sem chave, gera arquivos `.tar.gz` sem `.enc`.
encryption_enabled() {
    [ -f "$BACKUP_ENCRYPTION_KEY_FILE" ] && [ -r "$BACKUP_ENCRYPTION_KEY_FILE" ]
}

# Cifra um arquivo via openssl AES-256-CBC com PBKDF2 (chave em arquivo).
encrypt_to() {
    local input="$1"
    local output="$2"
    openssl enc -aes-256-cbc -salt -pbkdf2 -pass "file:${BACKUP_ENCRYPTION_KEY_FILE}" \
        -in "$input" -out "$output"
    chmod 0600 "$output"
}

# Alertas (email + webhook) quando backup falha. Auditoria 26/04/2026 #7.
send_failure_alert() {
    local exit_code="${1:-?}"
    local stage="${2:-?}"
    local hostname; hostname=$(hostname)
    local msg="Backup CAPUL Platform falhou em ${hostname} | stage=${stage} | exit=${exit_code} | tipo=${TIPO_SELECIONADO:-?} | $(date '+%Y-%m-%d %H:%M:%S')"

    # Email
    if [ -n "$BACKUP_ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo -e "${msg}\n\nVerifique 'journalctl -u capul-backup.service' ou ${LOG_DIR}/backup.log" \
            | mail -s "[CRITICO] Backup Capul falhou em ${hostname}" "${BACKUP_ALERT_EMAIL}" || true
    fi

    # Webhook Slack/Teams/Discord
    if [ -n "$BACKUP_ALERT_WEBHOOK" ] && command -v curl >/dev/null 2>&1; then
        # Formato compativel com Slack/Teams (text simples no payload)
        curl -sS -X POST -H 'Content-Type: application/json' \
            --max-time 10 \
            -d "{\"text\":\"🚨 ${msg}\"}" \
            "$BACKUP_ALERT_WEBHOOK" >/dev/null 2>&1 || true
    fi
}

# Sucesso — opcional para webhook (nao spamar email)
send_success_notification() {
    [ -z "$BACKUP_ALERT_WEBHOOK" ] && return 0
    command -v curl >/dev/null 2>&1 || return 0
    local hostname; hostname=$(hostname)
    local size; size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    curl -sS -X POST -H 'Content-Type: application/json' \
        --max-time 10 \
        -d "{\"text\":\"✅ Backup CAPUL ok em ${hostname} | tipo=${TIPO_SELECIONADO:-?} | total dir=${size} | $(date '+%Y-%m-%d %H:%M:%S')\"}" \
        "$BACKUP_ALERT_WEBHOOK" >/dev/null 2>&1 || true
}

# Registra execucao na API interna do auth-gateway (visivel no Configurador).
# Auditoria 26/04/2026 Sprint 4. Falha do tracking nao quebra o backup.
track_execucao() {
    [ "$BACKUP_TRACK_API" != "true" ] && return 0
    local status="$1"      # SUCESSO | FALHA
    local mensagem="${2:-}"

    if ! docker ps --format "{{.Names}}" | grep -q "^${AUTH_CONTAINER}$"; then
        return 0  # auth-gateway nao esta rodando, skip
    fi

    local hostname; hostname=$(hostname)
    local cifrado="false"
    if encryption_enabled; then cifrado="true"; fi

    local destino="local"
    [ -n "$BACKUP_S3_BUCKET" ] && destino="local+s3"

    # Calcular tamanho total do BACKUP_DIR (em bytes)
    local total_bytes=0
    if [ -d "$BACKUP_DIR" ]; then
        total_bytes=$(du -sb "$BACKUP_DIR" 2>/dev/null | cut -f1)
    fi

    local duracao_ms=0
    if [ -n "$BACKUP_START_EPOCH" ]; then
        BACKUP_END_EPOCH=$(date +%s)
        duracao_ms=$(( (BACKUP_END_EPOCH - BACKUP_START_EPOCH) * 1000 ))
    fi

    # Escapar mensagem para JSON
    local msg_json; msg_json=$(printf '%s' "$mensagem" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"\"")

    local payload="{\"tipo\":\"${TIPO_SELECIONADO:-?}\",\"status\":\"${status}\",\"finalizadoEm\":\"$(date -Iseconds)\",\"duracaoMs\":${duracao_ms},\"tamanhoBytes\":${total_bytes:-0},\"hostname\":\"${hostname}\",\"destino\":\"${destino}\",\"cifrado\":${cifrado},\"mensagem\":${msg_json}}"

    docker exec "$AUTH_CONTAINER" wget -qO- --post-data="$payload" \
        --header="Content-Type: application/json" \
        --timeout=5 \
        "http://localhost:3000/api/v1/internal/backup/execucao" >/dev/null 2>&1 || true
}

# Sync para S3/Backblaze (off-site). Auditoria 26/04/2026 #2.
sync_offsite() {
    [ -z "$BACKUP_S3_BUCKET" ] && return 0
    if ! command -v aws >/dev/null 2>&1; then
        log_warning "aws CLI nao instalada — pulando sync off-site (configurar AWS CLI no host)"
        return 0
    fi
    log_info "Sincronizando off-site para s3://${BACKUP_S3_BUCKET}/..."
    aws s3 sync "$BACKUP_DIR" "s3://${BACKUP_S3_BUCKET}/" \
        --storage-class STANDARD_IA \
        --exclude "*" \
        --include "backup_*.tar.gz" --include "backup_*.dump" \
        --include "backup_*.enc" --include "backup_*.rdb" \
        --include "weekly/*" --include "monthly/*" \
        --delete --quiet || {
            log_error "Falha no sync off-site"
            return 1
        }
    log_success "Sync off-site concluido"
}

# =============================================================================
# FUNÇÕES DE BACKUP
# =============================================================================

backup_db() {
    # Auditoria 26/04/2026 #8: dump cifrado quando há chave (PROD).
    local plain="${BACKUP_DIR}/backup_db_${TIMESTAMP}.dump"

    log_info "Iniciando backup do banco de dados..."
    log_info "Container: $DB_CONTAINER | Banco: $DB_NAME"

    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        -f /tmp/capul_db_dump.dump

    docker cp "${DB_CONTAINER}:/tmp/capul_db_dump.dump" "$plain"
    docker exec "$DB_CONTAINER" rm -f /tmp/capul_db_dump.dump

    if encryption_enabled; then
        local enc="${plain}.enc"
        encrypt_to "$plain" "$enc"
        rm -f "$plain"
        local size; size=$(du -sh "$enc" | cut -f1)
        log_success "Banco cifrado: $enc ($size)"
        echo "$enc"
    else
        chmod 0600 "$plain"
        local size; size=$(du -sh "$plain" | cut -f1)
        log_warning "Sem chave de criptografia — banco NAO cifrado (apenas DEV)"
        log_success "Banco salvo: $plain ($size)"
        echo "$plain"
    fi
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

backup_certs() {
    # Certificado A1 do modulo Fiscal — auditoria 26/04/2026 #5.
    # SEMPRE cifrado quando ha chave (chave .pfx + senha em FISCAL_MASTER_KEY = catastrofico se vazar).
    local plain="${BACKUP_DIR}/backup_certs_${TIMESTAMP}.tar.gz"
    log_info "Backup do certificado A1 fiscal..."
    if [ ! -d "$FISCAL_CERTS_PATH" ]; then
        log_warning "Diretorio de certs nao encontrado: $FISCAL_CERTS_PATH (pulando)"
        return 0
    fi
    tar -czf "$plain" -C "${FISCAL_CERTS_PATH%/*}" "$(basename "$FISCAL_CERTS_PATH")"
    if encryption_enabled; then
        local enc="${plain}.enc"
        encrypt_to "$plain" "$enc"
        rm -f "$plain"
        local size; size=$(du -sh "$enc" | cut -f1)
        log_success "Certs cifrados: $enc ($size)"
        echo "$enc"
    else
        log_warning "Sem chave de criptografia (${BACKUP_ENCRYPTION_KEY_FILE}) — certs NAO cifrados (apenas DEV)"
        chmod 0600 "$plain"
        local size; size=$(du -sh "$plain" | cut -f1)
        log_success "Certs salvos: $plain ($size)"
        echo "$plain"
    fi
}

backup_env() {
    # .env contem JWT_SECRET, FISCAL_MASTER_KEY, DB_PASSWORD — auditoria 26/04/2026 #6.
    local plain="${BACKUP_DIR}/backup_env_${TIMESTAMP}.txt"
    log_info "Backup do .env..."
    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env nao encontrado: $ENV_FILE (pulando)"
        return 0
    fi
    cp "$ENV_FILE" "$plain"
    if encryption_enabled; then
        local enc="${plain}.enc"
        encrypt_to "$plain" "$enc"
        rm -f "$plain"
        log_success "Env cifrado: $enc"
        echo "$enc"
    else
        log_warning "Sem chave de criptografia — .env NAO cifrado (apenas DEV)"
        chmod 0600 "$plain"
        log_success "Env salvo: $plain"
        echo "$plain"
    fi
}

backup_redis() {
    # Redis: BullMQ (jobs Fiscal), sessoes, cache. Auditoria 26/04/2026 #9.
    log_info "Backup Redis (BGSAVE snapshot)..."
    if ! docker ps --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
        log_warning "Container ${REDIS_CONTAINER} nao esta rodando (pulando Redis)"
        return 0
    fi
    # Pega senha do .env se nao definida via export
    local redis_pwd="${REDIS_PASSWORD:-}"
    if [ -z "$redis_pwd" ]; then
        redis_pwd=$(grep -E "^REDIS_PASSWORD=" "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
    fi
    docker exec "$REDIS_CONTAINER" redis-cli -a "$redis_pwd" --no-auth-warning BGSAVE >/dev/null
    sleep 5  # esperar BGSAVE concluir
    local plain="${BACKUP_DIR}/backup_redis_${TIMESTAMP}.rdb"
    docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "$plain"
    if encryption_enabled; then
        local enc="${plain}.enc"
        encrypt_to "$plain" "$enc"
        rm -f "$plain"
        local size; size=$(du -sh "$enc" | cut -f1)
        log_success "Redis cifrado: $enc ($size)"
        echo "$enc"
    else
        chmod 0600 "$plain"
        local size; size=$(du -sh "$plain" | cut -f1)
        log_success "Redis salvo: $plain ($size)"
        echo "$plain"
    fi
}

backup_uploads() {
    local backup_file="${BACKUP_DIR}/backup_uploads_${TIMESTAMP}.tar.gz"

    log_info "Iniciando backup dos arquivos de upload (anexos)..."

    # Verificar se o container esta rodando
    if ! docker ps --format "{{.Names}}" | grep -q "^${APP_CONTAINER}$"; then
        log_warning "Container $APP_CONTAINER não está em execução. Tentando via volume direto..."
        # Fallback: copiar via container temporário usando o volume
        docker run --rm \
            -v "${UPLOADS_VOLUME}:/data:ro" \
            -v "${BACKUP_DIR}:/backup" \
            alpine tar -czf "/backup/backup_uploads_${TIMESTAMP}.tar.gz" -C /data .
    else
        # Copiar via container em execução
        docker exec "$APP_CONTAINER" tar -czf /tmp/uploads_backup.tar.gz -C "$UPLOADS_PATH" .
        docker cp "${APP_CONTAINER}:/tmp/uploads_backup.tar.gz" "$backup_file"
        docker exec "$APP_CONTAINER" rm -f /tmp/uploads_backup.tar.gz
    fi

    if [ -f "$backup_file" ]; then
        local size
        size=$(du -sh "$backup_file" | cut -f1)
        log_success "Backup de uploads salvo: $backup_file ($size)"
    else
        log_warning "Nenhum arquivo de upload encontrado ou backup vazio"
    fi
    echo "$backup_file"
}

backup_full() {
    local backup_file="${BACKUP_DIR}/backup_full_${TIMESTAMP}.tar.gz"
    local db_dump_tmp="/tmp/capul_db_dump_${TIMESTAMP}.dump"
    local uploads_tmp="/tmp/capul_uploads_${TIMESTAMP}.tar.gz"

    log_info "Iniciando backup completo (banco + .env + cert A1 + Redis + uploads + app)..."

    # Itens cifrados separadamente — saem em backup_*.enc no BACKUP_DIR
    # (nao entram no tar.gz principal pra permitir restore granular)
    backup_certs    || { send_failure_alert "$?" "certs"; exit 1; }
    backup_env      || { send_failure_alert "$?" "env";   exit 1; }
    backup_redis    || { send_failure_alert "$?" "redis"; exit 1; }

    # Dump do banco
    log_info "  → Exportando banco de dados..."
    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        -f /tmp/capul_db_dump.dump

    docker cp "${DB_CONTAINER}:/tmp/capul_db_dump.dump" "$db_dump_tmp"
    docker exec "$DB_CONTAINER" rm -f /tmp/capul_db_dump.dump

    # Backup dos uploads (anexos)
    log_info "  → Exportando arquivos de upload (anexos)..."
    if docker ps --format "{{.Names}}" | grep -q "^${APP_CONTAINER}$"; then
        docker exec "$APP_CONTAINER" tar -czf /tmp/uploads_backup.tar.gz -C "$UPLOADS_PATH" . 2>/dev/null || true
        docker cp "${APP_CONTAINER}:/tmp/uploads_backup.tar.gz" "$uploads_tmp" 2>/dev/null || true
        docker exec "$APP_CONTAINER" rm -f /tmp/uploads_backup.tar.gz 2>/dev/null || true
    else
        docker run --rm -v "${UPLOADS_VOLUME}:/data:ro" -v /tmp:/backup \
            alpine tar -czf "/backup/capul_uploads_${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null || true
    fi

    # Tarball com aplicação + dump + uploads
    log_info "  → Comprimindo aplicação, banco e uploads..."
    local tar_args=(
        --exclude="capul-platform/.git"
        --exclude="capul-platform/node_modules"
        --exclude="capul-platform/*/node_modules"
        --exclude="capul-platform/backups"
        -C /opt capul-platform
        -C /tmp "capul_db_dump_${TIMESTAMP}.dump"
    )

    # Incluir uploads se existir
    if [ -f "$uploads_tmp" ]; then
        tar_args+=(-C /tmp "capul_uploads_${TIMESTAMP}.tar.gz")
    fi

    tar -czf "$backup_file" "${tar_args[@]}"

    # Limpar temporários
    rm -f "$db_dump_tmp" "$uploads_tmp"

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
    echo -e "  ${CYAN}1)${NC} full    — aplicação + banco + uploads ${BOLD}(recomendado)${NC}" >/dev/tty
    echo -e "  ${CYAN}2)${NC} app     — somente aplicação (código)" >/dev/tty
    echo -e "  ${CYAN}3)${NC} db      — somente banco de dados" >/dev/tty
    echo -e "  ${CYAN}4)${NC} uploads — somente arquivos de upload (anexos)" >/dev/tty
    echo -e "  ${CYAN}0)${NC} sair" >/dev/tty
    echo "" >/dev/tty

    while true; do
        read -r -p "  Opção [1/2/3/4/0]: " opcao </dev/tty
        case "$opcao" in
            1|full)    TIPO_SELECIONADO="full";    return ;;
            2|app)     TIPO_SELECIONADO="app";     return ;;
            3|db)      TIPO_SELECIONADO="db";      return ;;
            4|uploads) TIPO_SELECIONADO="uploads"; return ;;
            0|sair)    echo -e "\n  Operação cancelada.\n" >/dev/tty; exit 0 ;;
            *)
                echo -e "  ${YELLOW}Opção inválida. Digite 1, 2, 3, 4 ou 0 para sair.${NC}" >/dev/tty
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

    BACKUP_START_EPOCH=$(date +%s)
    TIPO_SELECIONADO="$tipo"

    # Trap para registrar falha
    trap 'track_execucao "FALHA" "Backup interrompido (sinal/erro). Verifique logs."' ERR

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
        uploads)
            backup_uploads
            ;;
        certs)
            backup_certs
            ;;
        env)
            backup_env
            ;;
        redis)
            backup_redis
            ;;
        *)
            log_error "Tipo invalido: '$tipo'. Use: full | app | db | uploads | certs | env | redis"
            echo ""
            echo "Uso: $0 [full|app|db|uploads|certs|env|redis]"
            exit 1
            ;;
    esac

    # Promover backup pra weekly/monthly se for domingo ou dia 1
    if [ "$tipo" = "full" ]; then
        promote_gfs
    fi

    # Sync off-site (S3/Backblaze) se configurado
    sync_offsite || true

    # Limpar backups antigos (politica GFS)
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

    # Notificar sucesso (opcional via webhook, nao via email pra nao spamar)
    send_success_notification || true

    # Registrar execucao (visibilidade no Configurador)
    track_execucao "SUCESSO" "Backup concluido com sucesso"
}

main "$@"
