#!/usr/bin/env bash
# diag-rfb.sh — diagnóstico read-only do import RFB (HOM/PROD).
# Uso:  cd /opt/capul-platform   (ou onde o docker-compose.yml está)
#       sudo ./scripts/diag-rfb.sh           # diagnóstico padrão
#       sudo ./scripts/diag-rfb.sh --net     # inclui teste de rede com RFB (opcional)
#
# NÃO modifica nada. Saída pode ser copiada e enviada inteira.

set -u
INCLUDE_NET=0
[[ "${1:-}" == "--net" ]] && INCLUDE_NET=1

# ── carrega .env (DB_USER) ────────────────────────────────────────────────
if [[ -f .env ]]; then
  set -a; . ./.env; set +a
fi
DB_USER="${DB_USER:-capul}"
DB="capul_platform"

DC="docker compose"
PSQL="$DC exec -T postgres psql -U $DB_USER -d $DB -X -A -q"

hr() { printf '\n============================================================\n'; printf '%s\n' "$1"; printf '============================================================\n'; }
sub() { printf '\n--- %s ---\n' "$1"; }

# ── 0. Ambiente ───────────────────────────────────────────────────────────
hr "0. AMBIENTE"
echo "host        : $(hostname)"
echo "data        : $(date -Iseconds)"
echo "pwd         : $(pwd)"
echo "compose ver : $($DC version --short 2>/dev/null || echo '??')"

sub "disco (host)"
df -h /var/lib/docker / 2>/dev/null | head -5

sub "memória"
free -h | head -3

sub "containers up (todos)"
$DC ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null | grep -E "^capul-" || echo "(nenhum container capul-* up)"

# ── 1. Fix no código rodando ──────────────────────────────────────────────
hr "1. FIX ANTI-HANG NO CONTAINER (commit 8ff076e)"
echo "Em produção só fica o JS compilado em /app/dist. Em dev pode ter /app/src também."
echo "Esperado: STREAM_IDLE_TIMEOUT_MS presente; bodyTimeout: 0 ausente."

# Tenta src/ primeiro (dev), cai pro dist/ (prod)
for path in /app/src/rfb/rfb-webdav.service.ts /app/dist/rfb/rfb-webdav.service.js; do
  if $DC exec -T fiscal-backend test -f "$path" 2>/dev/null; then
    echo "checando: $path"
    FIX_OK=$($DC exec -T fiscal-backend grep -c 'STREAM_IDLE_TIMEOUT_MS' "$path" 2>/dev/null | tr -d '\r')
    BUG_OLD=$($DC exec -T fiscal-backend grep -c 'bodyTimeout: 0' "$path" 2>/dev/null | tr -d '\r')
    echo "  STREAM_IDLE_TIMEOUT_MS : ${FIX_OK:-?}"
    echo "  bodyTimeout: 0          : ${BUG_OLD:-?}"
  fi
done

sub "commit instalado (build label, se existir)"
$DC exec -T fiscal-backend sh -c 'cat /app/BUILD_INFO 2>/dev/null || cat /app/package.json 2>/dev/null | head -5'

# ── 2. Config do módulo RFB no banco ──────────────────────────────────────
hr "2. CONFIG RFB (fiscal.ambiente_config)"
$PSQL -c "SELECT key_, value_ FROM fiscal.ambiente_config WHERE key_ LIKE 'rfb_%' OR key_ LIKE '%rfb%' ORDER BY key_;" 2>&1 \
  || $PSQL -c "SELECT * FROM fiscal.ambiente_config WHERE chave ILIKE '%rfb%';" 2>&1

# ── 3. Controle de importação (estado real) ───────────────────────────────
hr "3. CONTROLE DE IMPORTAÇÃO"

sub "últimos 20 arquivos"
$PSQL -F $'\t' -c "
SELECT versao, arquivo, status,
       to_char(criado_em,'MM-DD HH24:MI:SS')   AS criado,
       to_char(atualizado_em,'MM-DD HH24:MI:SS') AS atualiz,
       date_trunc('second', now() - atualizado_em) AS idle,
       coalesce(bytes_baixados,0)              AS bytes_dl,
       coalesce(linhas_importadas,0)           AS linhas
FROM rfb.controle_importacao
ORDER BY criado_em DESC LIMIT 20;"

sub "resumo por status"
$PSQL -c "SELECT status, count(*) FROM rfb.controle_importacao GROUP BY status ORDER BY status;"

sub "zumbis (IMPORTANDO idle > 10 min)"
$PSQL -c "
SELECT versao, arquivo, status, atualizado_em,
       now() - atualizado_em AS idle
FROM rfb.controle_importacao
WHERE status = 'IMPORTANDO' AND atualizado_em < now() - interval '10 minutes';"

# ── 4. Heartbeat real do COPY ─────────────────────────────────────────────
hr "4. PG_STAT_PROGRESS_COPY (verdade do Postgres)"
echo "Se vazio: nenhum COPY rodando AGORA (download pendurado OU import parou)."
echo "Se ativo: tuples_processed deve subir entre 2 leituras."
$PSQL -F $'\t' -c "
SELECT pid, relid::regclass AS tabela,
       command, type,
       pg_size_pretty(bytes_processed) AS lido,
       pg_size_pretty(bytes_total)     AS total,
       tuples_processed
FROM pg_stat_progress_copy;"

sub "segunda leitura (após 8s) — para ver se mexe"
sleep 8
$PSQL -F $'\t' -c "
SELECT pid, pg_size_pretty(bytes_processed) AS lido, tuples_processed
FROM pg_stat_progress_copy;"

# ── 5. Atividade do Postgres (queries longas, locks) ──────────────────────
hr "5. QUERIES LONGAS / LOCKS"

sub "queries ativas há mais de 30s (não-idle)"
$PSQL -F $'\t' -c "
SELECT pid, usename, state,
       now() - query_start AS run,
       wait_event_type, wait_event,
       substr(regexp_replace(query, '\\s+', ' ', 'g'), 1, 120) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND query_start < now() - interval '30 seconds'
ORDER BY query_start;"

sub "locks bloqueando outros pids"
$PSQL -F $'\t' -c "
SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid,
       blocked.query AS blocked_query, blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks lb ON lb.pid = blocked.pid AND NOT lb.granted
JOIN pg_locks lg ON lg.locktype = lb.locktype
                AND lg.database IS NOT DISTINCT FROM lb.database
                AND lg.relation IS NOT DISTINCT FROM lb.relation
                AND lg.granted AND lg.pid <> lb.pid
JOIN pg_stat_activity blocking ON blocking.pid = lg.pid
LIMIT 10;"

# ── 6. Tamanho do schema rfb ──────────────────────────────────────────────
hr "6. TAMANHO DO SCHEMA RFB"
$PSQL -F $'\t' -c "
SELECT n.nspname || '.' || c.relname AS tabela,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total,
       to_char(reltuples, 'FM999G999G999') AS linhas_estim
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'rfb' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;"

sub "total do schema rfb"
$PSQL -c "
SELECT pg_size_pretty(SUM(pg_total_relation_size(c.oid))) AS total_rfb
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'rfb' AND c.relkind = 'r';"

# ── 7. Logs do fiscal-backend filtrados ───────────────────────────────────
hr "7. LOG fiscal-backend (últimas 300 linhas filtradas)"
$DC logs --tail=600 --since=2h fiscal-backend 2>&1 \
  | grep -iE 'rfb|webdav|copy|empresa|stream|retry|timeout|ECONN|undici|importacao|erro|error' \
  | tail -80 \
  || echo "(sem matches no log)"

# ── 8. Teste de rede opcional ─────────────────────────────────────────────
if [[ $INCLUDE_NET -eq 1 ]]; then
  hr "8. TESTE DE REDE COM FONTE RFB"
  echo "(HEAD em https://arquivos.receitafederal.gov.br/ — só para ver se responde rápido)"
  $DC exec -T fiscal-backend sh -c '
    if command -v curl >/dev/null; then
      time curl -sSI -o /dev/null -w "HTTP %{http_code} | dns %{time_namelookup}s | connect %{time_connect}s | total %{time_total}s\n" https://arquivos.receitafederal.gov.br/ 2>&1 | tail -10
    else
      echo "(curl ausente no container — use wget no host)"
    fi'
fi

hr "FIM"
echo "Copie a saída inteira deste ponto até o topo e me envie."
