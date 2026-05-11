#!/bin/bash

# =============================================================================
# SCRIPT DE BACKUP — CAPUL PLATFORM
# =============================================================================
# Uso: ./backup.sh [tipo] [argumento]
#   Tipos de backup: full | app | db | uploads | certs | env | redis
#   Restore PRD→HOM:  restore-from-prod <caminho/backup_full_*.tar.gz>
#   Sem argumento: menu interativo
#
# Exemplos:
#   ./backup.sh           → menu interativo
#   ./backup.sh full      → backup completo (app + banco + uploads)
#   ./backup.sh app       → somente aplicação
#   ./backup.sh db        → somente banco de dados
#   ./backup.sh uploads   → somente arquivos de upload (anexos)
#
#   ./backup.sh restore-from-prod backups/backup_full_20260511_PRD.tar.gz
#     → restaura banco + uploads de um backup PRD num servidor HOM.
#       PRESERVA: código, .env, certs A1, redis.
#       Sanitiza: endpoints PROD→HOM, ambiente_ativo=HOM, freio de mão ON.
#       DESTRUTIVO no banco (DROP + CREATE) — confirmação obrigatória.
#       Use APENAS em ambiente de homologação, NUNCA em produção.
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

    # Sempre via container temporário alpine como root, montando o volume
    # diretamente. Antes (11/05/2026): rodava "docker exec ... tar" como
    # appuser, que falhava silenciosamente em arquivos com owner diferente
    # — backup saía com 81% dos anexos faltando sem reportar erro.
    docker run --rm \
        -v "${UPLOADS_VOLUME}:/data:ro" \
        -v "${BACKUP_DIR}:/backup" \
        alpine tar -czf "/backup/backup_uploads_${TIMESTAMP}.tar.gz" -C /data . \
        || { log_error "Falha ao gerar tar dos uploads (volume ${UPLOADS_VOLUME})"; return 1; }

    if [ ! -f "$backup_file" ]; then
        log_error "Backup de uploads não foi gerado: $backup_file"
        return 1
    fi

    local size files
    size=$(du -sh "$backup_file" | cut -f1)
    files=$(docker run --rm -v "${BACKUP_DIR}:/b:ro" alpine \
        tar -tzf "/b/$(basename "$backup_file")" 2>/dev/null | grep -v '/$' | wc -l)
    log_success "Backup de uploads salvo: $backup_file ($size, $files arquivos)"
    if [ "$files" = "0" ]; then
        log_warning "  → ATENÇÃO: tar gerado com 0 arquivos. Volume vazio ou erro de leitura."
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
    # Sempre via alpine como root montando volume direto. Antes rodava
    # "docker exec ... tar" como appuser, que falhava silenciosamente em
    # arquivos com owner diferente — incidente 11/05/2026: 81% dos anexos
    # ficaram fora do backup sem gerar warning.
    if ! docker run --rm \
            -v "${UPLOADS_VOLUME}:/data:ro" \
            -v /tmp:/backup \
            alpine tar -czf "/backup/capul_uploads_${TIMESTAMP}.tar.gz" -C /data .; then
        log_error "Falha ao gerar tar dos uploads. Backup full abortado."
        send_failure_alert 1 "uploads"
        exit 1
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

    # Uploads precisa estar presente — falha em vez de prosseguir silencioso.
    if [ ! -f "$uploads_tmp" ]; then
        log_error "Tar dos uploads não foi gerado: $uploads_tmp — abortando."
        send_failure_alert 1 "uploads"
        exit 1
    fi
    # Sanidade: conta arquivos dentro do tar dos uploads.
    local uploads_count
    uploads_count=$(tar -tzf "$uploads_tmp" 2>/dev/null | grep -v '/$' | wc -l)
    log_info "  → uploads tar contém $uploads_count arquivos ($(du -sh "$uploads_tmp" | cut -f1))"
    if [ "$uploads_count" = "0" ]; then
        log_warning "  → Tar de uploads tem 0 arquivos. Verifique volume ${UPLOADS_VOLUME}."
    fi
    tar_args+=(-C /tmp "capul_uploads_${TIMESTAMP}.tar.gz")

    tar -czf "$backup_file" "${tar_args[@]}"

    # Limpar temporários
    rm -f "$db_dump_tmp" "$uploads_tmp"

    local size
    size=$(du -sh "$backup_file" | cut -f1)
    log_success "Backup completo salvo: $backup_file ($size, incluindo $uploads_count anexos)"
    echo "$backup_file"
}

# =============================================================================
# RESTORE PRD → HOM
# =============================================================================
# Restaura um backup_full_*.tar.gz de PROD num servidor de HOMOLOGAÇÃO,
# preservando .env, código e configs locais do HOM. Sanitiza endpoints e
# flags fiscais pra HOMOLOGAÇÃO após o restore.
#
# Uso: ./backup.sh restore-from-prod <caminho/do/backup_full_*.tar.gz>
#
# O QUE RESTAURA: dump do PostgreSQL + volume de uploads (anexos).
# O QUE PRESERVA: /opt/capul-platform/* (código + .env), certs A1, redis.
#
# IMPORTANTE: este comando É DESTRUTIVO — substitui banco e uploads do
# servidor onde roda. Use APENAS em ambiente de HOMOLOGAÇÃO.

restore_from_prod() {
    local source_tar="$1"
    local restore_tmp="/tmp/restore-prd-$(date +%s)"

    # --- Validações ----------------------------------------------------------
    if [ -z "$source_tar" ]; then
        log_error "Caminho do backup obrigatorio."
        echo "Uso: $0 restore-from-prod <caminho/do/backup_full_*.tar.gz>"
        exit 1
    fi
    if [ ! -f "$source_tar" ]; then
        log_error "Arquivo nao encontrado: $source_tar"
        exit 1
    fi
    if ! tar -tzf "$source_tar" >/dev/null 2>&1; then
        log_error "Arquivo nao parece ser um tar.gz valido: $source_tar"
        exit 1
    fi
    if ! tar -tzf "$source_tar" | grep -q "^capul_db_dump_.*\.dump$"; then
        log_error "Tar nao contem capul_db_dump_*.dump na raiz. Backup invalido para restore-from-prod."
        exit 1
    fi

    # --- Confirmação dupla ---------------------------------------------------
    echo "" >/dev/tty
    echo -e "${RED}${BOLD}============================================================${NC}" >/dev/tty
    echo -e "${RED}${BOLD}  RESTORE PRD → HOM (DESTRUTIVO)${NC}" >/dev/tty
    echo -e "${RED}${BOLD}============================================================${NC}" >/dev/tty
    echo "" >/dev/tty
    echo -e "  Backup origem: ${BOLD}$source_tar${NC}" >/dev/tty
    echo -e "  Destino: ${BOLD}este servidor ($(hostname))${NC}" >/dev/tty
    echo "" >/dev/tty
    echo -e "  ${YELLOW}Vai SUBSTITUIR:${NC}" >/dev/tty
    echo -e "    • banco capul_platform inteiro (DROP + CREATE + restore do dump)" >/dev/tty
    echo -e "    • volume uploads_data (anexos)" >/dev/tty
    echo "" >/dev/tty
    echo -e "  ${GREEN}NÃO toca:${NC}" >/dev/tty
    echo -e "    • /opt/capul-platform/ (código + .env)" >/dev/tty
    echo -e "    • certificados A1 (fiscal/backend/certs)" >/dev/tty
    echo -e "    • redis (cache/sessões)" >/dev/tty
    echo "" >/dev/tty
    echo -e "  ${RED}NUNCA execute em produção.${NC} Use apenas em HOM." >/dev/tty
    echo "" >/dev/tty

    read -r -p "  Confirme digitando exatamente RESTAURAR PRD: " confirma </dev/tty
    if [ "$confirma" != "RESTAURAR PRD" ]; then
        echo -e "  ${YELLOW}Confirmação não bate. Operação cancelada.${NC}" >/dev/tty
        exit 0
    fi

    # --- 1. Backup defensivo do estado atual --------------------------------
    log_info "Etapa 1/7 — backup defensivo do estado HOM atual..."
    local pre_backup="${BACKUP_DIR}/_HOM_pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz"
    mkdir -p "$BACKUP_DIR"
    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        -f /tmp/hom_pre_restore.dump 2>/dev/null || {
            log_warn "  → pg_dump pre-restore falhou (banco pode estar inacessivel) — seguindo."
        }
    docker cp "${DB_CONTAINER}:/tmp/hom_pre_restore.dump" "/tmp/hom_pre_restore.dump" 2>/dev/null || true
    docker exec "$DB_CONTAINER" rm -f /tmp/hom_pre_restore.dump 2>/dev/null || true
    [ -f /tmp/hom_pre_restore.dump ] && {
        tar -czf "$pre_backup" -C /tmp hom_pre_restore.dump
        rm -f /tmp/hom_pre_restore.dump
        log_success "  → backup pre-restore: $pre_backup"
    }

    # --- 2. Parar serviços (exceto postgres) --------------------------------
    log_info "Etapa 2/7 — parando serviços (mantendo postgres)..."
    cd "$APP_DIR"
    docker compose stop \
        auth-gateway hub configurador gestao-ti-backend gestao-ti-frontend \
        inventario-backend inventario-frontend fiscal-backend fiscal-frontend \
        nginx 2>/dev/null || true

    # --- 3. Extrair APENAS dump + uploads -----------------------------------
    log_info "Etapa 3/7 — extraindo dump e uploads do backup PRD..."
    mkdir -p "$restore_tmp"
    tar -xzf "$source_tar" \
        -C "$restore_tmp" \
        --wildcards 'capul_db_dump_*.dump' 'capul_uploads_*.tar.gz' 2>/dev/null || true

    local dump_file
    dump_file=$(ls "$restore_tmp"/capul_db_dump_*.dump 2>/dev/null | head -1)
    if [ -z "$dump_file" ]; then
        log_error "Dump nao extraido. Backup pode estar corrompido."
        rm -rf "$restore_tmp"
        exit 1
    fi
    local uploads_file
    uploads_file=$(ls "$restore_tmp"/capul_uploads_*.tar.gz 2>/dev/null | head -1)
    log_success "  → dump: $(basename "$dump_file") ($(du -sh "$dump_file" | cut -f1))"
    [ -n "$uploads_file" ] && log_success "  → uploads: $(basename "$uploads_file") ($(du -sh "$uploads_file" | cut -f1))"

    # --- 4. Garantir postgres rodando ---------------------------------------
    log_info "Etapa 4/7 — garantindo postgres healthy..."
    docker compose up -d postgres
    local tries=20
    while [ $tries -gt 0 ]; do
        if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
            break
        fi
        sleep 1
        tries=$((tries - 1))
    done
    [ $tries -eq 0 ] && { log_error "Postgres nao subiu em 20s"; exit 1; }
    log_success "  → postgres pronto."

    # --- 5. DROP + CREATE + restore -----------------------------------------
    log_info "Etapa 5/7 — restaurando banco (DROP + CREATE + pg_restore)..."
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS $DB_NAME;" >/dev/null
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" >/dev/null

    docker cp "$dump_file" "${DB_CONTAINER}:/tmp/restore.dump"
    docker exec "$DB_CONTAINER" pg_restore \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner --no-privileges \
        /tmp/restore.dump 2>&1 | tail -10 || {
            log_error "pg_restore falhou. Verifique log acima."
            exit 1
        }
    docker exec "$DB_CONTAINER" rm -f /tmp/restore.dump
    log_success "  → banco restaurado."

    # --- 6. Restaurar uploads -----------------------------------------------
    if [ -n "$uploads_file" ]; then
        log_info "Etapa 6/7 — restaurando volume uploads_data..."

        # Pega a imagem do container gestao-ti pra usar appuser:appgroup no
        # chown — Dockerfile cria appuser via `adduser -S` (Alpine system
        # user, UID ~100), NÃO é 1000. Sem isso, o app não consegue ler
        # os arquivos após restore. Fallback: hard-code chown 100:101.
        local gestao_img
        gestao_img=$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || true)

        if [ -n "$gestao_img" ]; then
            docker run --rm \
                -v "${UPLOADS_VOLUME}:/app/uploads" \
                -v "$restore_tmp:/backup:ro" \
                --user 0:0 --entrypoint sh \
                "$gestao_img" \
                -c "rm -rf /app/uploads/* /app/uploads/..?* /app/uploads/.[!.]* 2>/dev/null; tar -xzf /backup/$(basename "$uploads_file") -C /app/uploads && chown -R appuser:appgroup /app/uploads"
            log_success "  → uploads restaurados (chown via imagem $gestao_img)."
        else
            log_warn "  → imagem do $APP_CONTAINER nao encontrada — fallback chown numerico 100:101 (UID do appuser no Alpine)."
            docker run --rm \
                -v "${UPLOADS_VOLUME}:/data" \
                -v "$restore_tmp:/backup:ro" \
                alpine sh -c "rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar -xzf /backup/$(basename "$uploads_file") -C /data && chown -R 100:101 /data"
            log_success "  → uploads restaurados (fallback)."
        fi
    else
        log_warn "Etapa 6/7 — backup nao tinha uploads, pulando."
    fi

    # --- 7. Sanitizar configs PRD → HOM -------------------------------------
    log_info "Etapa 7/7 — sanitizando configs PRD → HOM no banco..."
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" >/dev/null <<'SQL'
-- 7.1 Endpoints: desliga PROD, liga HOM correspondente
UPDATE core.integracoes_api_endpoints
   SET ativo = false, updated_at = NOW()
 WHERE ambiente = 'PRODUCAO' AND ativo = true;

UPDATE core.integracoes_api_endpoints e
   SET ativo = true, updated_at = NOW()
 WHERE e.ambiente = 'HOMOLOGACAO'
   AND e.ativo = false
   AND EXISTS (
       SELECT 1 FROM core.integracoes_api_endpoints p
        WHERE p.integracao_id = e.integracao_id
          AND p.modulo = e.modulo
          AND p.operacao = e.operacao
          AND p.ambiente = 'PRODUCAO'
   );

-- 7.2 Fiscal: ambiente em HOM + freio de mão (pausa total)
UPDATE fiscal.ambiente_config
   SET ambiente_ativo = 'HOMOLOGACAO',
       cte_distribuicao_ambiente = 'HOMOLOGACAO',
       cte_distribuicao_ativo = false,
       cte_protheus_grava_ativo = false,
       pause_sync = true,
       ultima_alteracao_em = NOW(),
       ultima_alteracao_por = 'backup.sh:restore-from-prod'
 WHERE id = 1;
SQL
    log_success "  → configs sanitizadas (endpoints HOM, ambiente HOMOLOGACAO, freio de mão ON)."

    # --- Limpeza + status final ---------------------------------------------
    rm -rf "$restore_tmp"

    echo ""
    log_info "Estado pós-restore:"
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
        "SELECT modulo, operacao, ambiente, ativo FROM core.integracoes_api_endpoints WHERE modulo='FISCAL' ORDER BY operacao, ambiente;"
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
        "SELECT ambiente_ativo, pause_sync, cte_distribuicao_ativo, cte_protheus_grava_ativo FROM fiscal.ambiente_config WHERE id=1;"

    echo ""
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD}  RESTORE PRD → HOM CONCLUÍDO${NC}"
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo ""
    echo "  Próximos passos:"
    echo "    1. docker compose up -d  (subir todos os serviços)"
    echo "    2. Confirmar URL/credenciais do Protheus HOM no Configurador"
    echo "    3. Smoke test: login + consulta básica"
    echo ""
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

    # restore-from-prod tem fluxo próprio — não passa pelo case do backup.
    if [ "$tipo" = "restore-from-prod" ]; then
        check_requirements
        load_env
        restore_from_prod "$2"
        exit 0
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
            log_error "Tipo invalido: '$tipo'. Use: full | app | db | uploads | certs | env | redis | restore-from-prod"
            echo ""
            echo "Uso:"
            echo "  $0 [full|app|db|uploads|certs|env|redis]            — executa backup"
            echo "  $0 restore-from-prod <caminho/backup_full_*.tar.gz>  — restaura backup PRD em HOM"
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
