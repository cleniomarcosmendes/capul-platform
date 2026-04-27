# Auditoria Backup / Disaster Recovery — Capul Platform — 26/04/2026

**Modo:** profunda (foco em Backup/DR)
**Versão do prompt:** 1.1 (`docs/PROMPT_AUDITORIA_PLATAFORMA.md`)
**Auditor:** análise técnica baseada em inspeção de código + estado runtime
**Cenário:** plataforma exposta publicamente em produção (não só rede interna)

---

## Sumário Executivo

| Métrica | Inicial | Após Sprints 1+2+3+4 (26/04) |
|---|---:|---:|
| Achados **críticos** | 3 | **0** ✅ |
| Achados altos | 6 | **0** ✅ |
| Achados médios | 3 | **0** ✅ |
| Achados baixos | 2 | 1 (#13 logs centralizado — opcional) |
| Pontos fortes | 6 | **11** |
| **Esforço total estimado** | ~14-22h | gasto: ~5h (autonomo) |

### Quick Wins (alta criticidade + baixo esforço)

1. **#1 — Configurar systemd timer para `scripts/backup.sh full`** (1h, fecha #1 e parte do #2)
2. **#5 — Incluir certificado A1 fiscal no backup** (~30min)
3. **#6 — Incluir `.env` cifrado no backup** (~1h, exige decisão de chave de cifra)

### Pontos fortes identificados

- ✅ `scripts/backup.sh` bem estruturado (4 modos: full/app/db/uploads)
- ✅ Usa `pg_dump --format=custom` (compactado, restore com `pg_restore`)
- ✅ Cleanup automático de backups > 30 dias
- ✅ Verifica pré-requisitos (container UP, .env existe, DB_USER definido)
- ✅ Volumes Docker nomeados (`postgres_data`, `redis_data`, `uploads_data`, `fiscal_xmls`) — facilita backup
- ✅ Roteiro de migração já tem seção §4 com comandos básicos de backup/restore

---

## Achados Críticos (resolver imediatamente)

### Achado #1 — Backup **sem agendamento automático**

- **Dimensão:** 6 — Observabilidade / 8 — Práticas de desenvolvimento
- **Severidade:** **Crítico**
- **Localização:** `scripts/backup.sh` + ausência de cron/systemd timer
- **Descrição:** o script existe e funciona, mas **só executa manualmente**. Não há cron, systemd timer ou orquestrador agendando.
- **Por que é problema:** em produção pública, "backup que precisa lembrar de rodar" **não é backup**. Operador esquece, sai de férias, troca de função → meses sem backup → quando precisar, está velho ou inexistente.
- **Evidência:**
  ```
  $ crontab -l
  no crontab for clenio
  $ systemctl list-timers --all | grep -i backup
  (nenhum timer customizado)
  $ ls /opt/capul-platform/backups
  No such file or directory
  ```

#### Plano de Correção

1. **Pré-requisitos:**
   - Confirmar usuário do host que roda o systemd (ex: `clenio` ou usuário dedicado de DevOps)
   - Decidir frequência (recomendado: diário 02:00 + semanal completo aos domingos)
   - Confirmar destino do backup (ver Achado #2 — local + remoto)

2. **Passos concretos (systemd timer — preferível a cron porque tem logs e retry):**

   Criar `/etc/systemd/system/capul-backup.service`:
   ```ini
   [Unit]
   Description=Capul Platform Backup
   After=docker.service
   Requires=docker.service

   [Service]
   Type=oneshot
   User=root
   WorkingDirectory=/opt/capul-platform
   ExecStart=/opt/capul-platform/scripts/backup.sh full
   StandardOutput=append:/var/log/capul-platform/backup.log
   StandardError=append:/var/log/capul-platform/backup.err.log
   ```

   Criar `/etc/systemd/system/capul-backup.timer`:
   ```ini
   [Unit]
   Description=Capul Platform Backup Daily

   [Timer]
   OnCalendar=*-*-* 02:00:00
   Persistent=true
   RandomizedDelaySec=600

   [Install]
   WantedBy=timers.target
   ```

   Habilitar:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now capul-backup.timer
   sudo systemctl list-timers capul-backup.timer
   ```

3. **Critério de validação:**
   - `systemctl status capul-backup.timer` mostra `Active: active (waiting)`
   - Após primeiro disparo (testar com `sudo systemctl start capul-backup.service` agora): `/opt/capul-platform/backups/backup_full_*.tar.gz` existe
   - `journalctl -u capul-backup.service -n 50` sem erros
4. **Estimativa:** **trivial (~1h)** — Quick Win
5. **Riscos:** se backup falhar, fica em `journalctl` mas ninguém é avisado → ver Achado #7 (alerta de falha)
6. **Rollback:** `sudo systemctl disable --now capul-backup.timer && sudo rm /etc/systemd/system/capul-backup.{service,timer}`
7. **Dependências:** nenhuma
8. **Quem executa:** DevOps com acesso root no host de produção

---

### Achado #2 — Backup **só local** (sem cópia off-site)

- **Dimensão:** 6 — Observabilidade / DR
- **Severidade:** **Crítico**
- **Localização:** `scripts/backup.sh:25` — `BACKUP_DIR="/opt/capul-platform/backups"` (mesmo host da aplicação)
- **Descrição:** todos os backups ficam no **mesmo host físico** que a aplicação roda. Se o disco corromper, o data center pegar fogo, ou o servidor for roubado/sequestrado → perde **aplicação + backups juntos**.
- **Por que é problema:** princípio fundamental de DR — **regra 3-2-1**: 3 cópias dos dados, em 2 mídias diferentes, com 1 cópia off-site. Hoje temos: **1 cópia, 1 mídia, 0 off-site**.
- **Evidência:** o script grava em `/opt/capul-platform/backups` no mesmo host. Sem rsync, scp, S3, Azure Blob, etc.

#### Plano de Correção

1. **Pré-requisitos — decisão de produto:**
   - Onde guardar a cópia remota? Opções:
     - (a) **AWS S3** (mais comum, ~US$ 0.023/GB/mês Standard, ~US$ 0.005 Glacier)
     - (b) **Azure Blob Storage** (idem)
     - (c) **Google Cloud Storage**
     - (d) **Backblaze B2** (mais barato, ~US$ 0.005/GB/mês)
     - (e) **Servidor secundário interno CAPUL** (NAS, outro servidor) — mais barato mas se o data center todo cair, perde tudo
   - Política de retenção: 30 dias diários + 12 semanais + 12 mensais? (recomendado)
   - Cripto em trânsito (HTTPS) e em repouso (SSE-S3 ou similar)

2. **Passos concretos** — assumindo S3 + AWS CLI no host:
   ```bash
   # Adicionar ao final de scripts/backup.sh (após cleanup_old_backups):
   if [ -n "$AWS_S3_BACKUP_BUCKET" ]; then
       log_info "Enviando backup para S3..."
       aws s3 sync "$BACKUP_DIR" "s3://${AWS_S3_BACKUP_BUCKET}/" \
           --storage-class STANDARD_IA \
           --exclude "*" --include "backup_*.tar.gz" --include "backup_*.dump" \
           --delete  # remove no S3 o que foi removido localmente (após cleanup)
       log_success "Backup enviado para S3"
   fi
   ```

   E `.env`:
   ```
   AWS_S3_BACKUP_BUCKET=capul-platform-backups-prod
   AWS_DEFAULT_REGION=sa-east-1
   ```

   Configurar bucket S3 com:
   - Versioning ON (proteção contra apagar acidentalmente)
   - Lifecycle: Standard 30d → Glacier 365d → expirar 7 anos
   - Bucket policy bloqueando exclusão por usuário não-admin

3. **Critério de validação:**
   - `aws s3 ls s3://${AWS_S3_BACKUP_BUCKET}/` lista o backup mais recente
   - Tamanho remoto = tamanho local
   - Bucket com versioning + lifecycle confirmados
4. **Estimativa:** **moderado (3-4h)** — inclui criação do bucket, política IAM mínima, ajuste do script, primeira sincronia, teste de restore from S3
5. **Riscos:**
   - Custo (calcular antes — ~US$ 5-20/mês inicialmente, escala com volume)
   - Vazamento de credentials AWS — usar IAM role específica, não admin
   - Lifecycle errado pode apagar backups antes da hora
6. **Rollback:** desabilitar a sync no script (deixar só local) — backup local mantém funcionando
7. **Dependências:** Achado #1 (timer ativo) — sem isso, sync nunca é disparado
8. **Quem executa:** DevOps + decisão de cloud account com Diretor TI

---

### Achado #3 — **Sem teste de restore** documentado

- **Dimensão:** 6 — Observabilidade / DR
- **Severidade:** **Crítico**
- **Localização:** `docs/ROTEIRO_MIGRACAO_PRODUCAO.md:190-203` (procedimento existe mas nunca foi executado em DR test)
- **Descrição:** **backup que não foi restaurado não conta como backup.** Não há registro de teste de restore — pode ser que os dumps estejam corrompidos, incompletos, ou o procedimento esteja errado, e ninguém saberia até precisar.
- **Por que é problema:** história clássica de TI — empresa rodou backup por anos, no dia da catástrofe descobriu que o pg_dump estava trocando bytes, ou que o procedimento de restore não funcionava com o DB em produção. Custou semanas.

#### Plano de Correção

1. **Pré-requisitos:** ambiente de homologação separado (ou janela de manutenção em DEV)
2. **Passos concretos — procedimento de DR test (executar trimestralmente):**
   ```bash
   # 1. Pegar o backup mais recente
   BACKUP=$(ls -t /opt/capul-platform/backups/backup_full_*.tar.gz | head -1)
   echo "Testando restore de: $BACKUP"

   # 2. Subir ambiente isolado em outro host/VM/projeto Docker
   cd /tmp/capul-restore-test
   tar -xzf "$BACKUP"
   docker compose up -d postgres
   sleep 10

   # 3. Restaurar dump
   DUMP=$(find . -name "capul_db_dump_*.dump" | head -1)
   docker cp "$DUMP" capul-db:/tmp/restore.dump
   docker compose exec postgres pg_restore -U $DB_USER -d capul_platform \
       --clean --if-exists /tmp/restore.dump

   # 4. Validar
   docker compose exec postgres psql -U $DB_USER -d capul_platform \
       -c "SELECT COUNT(*) FROM gestao_ti.projetos"
   docker compose exec postgres psql -U $DB_USER -d capul_platform \
       -c "SELECT COUNT(*) FROM core.usuarios"

   # 5. Subir aplicação completa e fazer smoke test (login, listar projetos, etc.)
   docker compose up -d
   curl -sk https://localhost/api/v1/fiscal/health
   ```

3. **Critério de validação:**
   - DB restaurado com counts == produção (margin pequena por horário)
   - Aplicação sobe healthy
   - Smoke test: login + listar projetos + abrir chamado funcionam
4. **Estimativa:** **moderado (2-3h)** primeira vez; **trivial (30min)** quando virar rotina
5. **Riscos:** consumir disco temporário (~5x o backup) durante teste; isolar bem do PROD pra não confundir DNS/portas
6. **Rollback:** N/A — é só teste, não muda produção
7. **Dependências:** nenhuma (pode rodar independente)
8. **Quem executa:** DevOps; documentar resultado em `docs/DR_TESTS.md` (criar) com data, sucesso/falha, ajustes necessários

---

## Achados Altos (resolver em até 30 dias)

### Achado #4 — RTO / RPO **não definidos**

- **Dimensão:** 6 — Observabilidade / DR
- **Severidade:** **Alto**
- **Descrição:** sem definição formal de:
  - **RTO (Recovery Time Objective)** — quanto tempo a plataforma pode ficar fora? (ex: 4h)
  - **RPO (Recovery Point Objective)** — quantos dados podemos perder? (ex: até 24h por backup diário)
- **Por que é problema:** decisões de DR (frequência de backup, redundância, hot/cold standby) **derivam dos RTOs/RPOs**. Sem isso, você está chutando.

#### Plano de Correção

1. **Decisão de produto (com Diretor TI / equipe de operação):**
   - **RTO sugerido:** 4h (após incidente, plataforma volta no ar em até 4h)
   - **RPO sugerido:** 24h (backup diário às 02:00 → no pior caso, perde 1 dia de dados)
2. **Documentar:** criar `docs/DR_OBJETIVOS.md` com a matriz e justificativa
3. **Critério de validação:** documento revisado e aprovado por Diretor TI e Setor Fiscal (que mais sofreria com perda de dados)
4. **Estimativa:** **trivial (~1h reunião + 30min documentação)**
5. **Riscos:** definir RTO/RPO ambicioso demais (ex: RPO 1h) sem ter infra (ex: replicação) → expectativa quebrada na catástrofe
6. **Quem executa:** Líder TI (Clenio) + alinhamento Diretor

---

### Achado #5 — Backup **não inclui certificado A1 fiscal** (catastrófico se perdido)

- **Dimensão:** 3 — Dados e segredos / 9 — Específico Fiscal
- **Severidade:** **Alto**
- **Localização:** `fiscal/backend/certs/dd4ee45e-e5a7-46a9-9412-7c6e9c53abb1.pfx` + `scripts/backup.sh` não cobre esse path
- **Descrição:** o certificado A1 (.pfx) é a **chave criptográfica privada** que assina comunicações com SEFAZ. Se for perdido:
  - Compra novo (~R$ 250-500) + aprox. **3-5 dias úteis** sem operação fiscal
  - Reemissão de NF-e/CT-e fica bloqueada nesse intervalo
- **Por que é problema:** é um **único arquivo de 3.7KB que vale milhares de reais e dias de operação**. Não está no backup. Está num único disco. Permissão **777** (mundo grava).
- **Evidência:**
  ```
  $ ls -la fiscal/backend/certs/
  -rwxrwxrwx 1 clenio clenio 3748 dd4ee45e-...pfx
  ```
  (777 = mundo lê e grava)

#### Plano de Correção

1. **Pré-requisitos:** ajustar permissão pra `0640` antes (só dono lê/grava, grupo lê)
2. **Passos concretos:**
   - Editar `scripts/backup.sh` adicionando função `backup_certs`:
     ```bash
     backup_certs() {
         local backup_file="${BACKUP_DIR}/backup_certs_${TIMESTAMP}.tar.gz.enc"
         log_info "Backup certificados (cifrado)..."
         tar -czf - -C "${APP_DIR}/fiscal/backend" certs \
           | openssl enc -aes-256-cbc -salt -pbkdf2 -pass file:/etc/capul-backup-key \
           > "$backup_file"
         chmod 0600 "$backup_file"
         log_success "Certificados cifrados salvos: $backup_file"
     }
     ```
   - Chamar em `backup_full()` (linha 156)
   - Criar arquivo `/etc/capul-backup-key` (permissão 0600, dono root) com chave aleatória de 64 bytes
   - **Documentar a chave em cofre** (1Password, Vaultwarden, ou impressa em envelope lacrado no cofre físico)
3. **Critério de validação:** restaurar `.tar.gz.enc` em ambiente isolado e confirmar que `openssl dgst -sha256` do cert restaurado == original
4. **Estimativa:** **trivial (~30min)** Quick Win
5. **Riscos:** perder a chave de descriptografia → backup do cert fica inútil. Por isso a chave precisa estar **fora do servidor** (cofre físico ou outro vault)
6. **Quem executa:** DevOps + Setor Fiscal (validar restore funcional)

---

### Achado #6 — Backup **não inclui `.env`** (variáveis críticas)

- **Dimensão:** 3 — Dados e segredos
- **Severidade:** **Alto**
- **Localização:** `scripts/backup.sh` não cobre `.env` da raiz
- **Descrição:** `.env` contém **JWT_SECRET, JWT_REFRESH_SECRET, DB_PASSWORD, REDIS_PASSWORD, FISCAL_MASTER_KEY**. Sem `.env`:
  - Banco restaurado mas sem JWT_SECRET → tokens existentes inválidos, refresh quebra
  - Sem FISCAL_MASTER_KEY → certificado A1 cifrado fica inútil (a senha do `.pfx` depende dela)
  - Sem DB_PASSWORD → não consegue conectar no banco restaurado
- **Por que é problema:** restore só do banco é **inutilizável** sem o `.env`. É o "outro pilar" do backup.

#### Plano de Correção

1. **Idêntico ao Achado #5** — incluir `.env` cifrado com mesma chave OpenSSL:
   ```bash
   backup_env() {
       local backup_file="${BACKUP_DIR}/backup_env_${TIMESTAMP}.enc"
       openssl enc -aes-256-cbc -salt -pbkdf2 -pass file:/etc/capul-backup-key \
         -in "${APP_DIR}/.env" -out "$backup_file"
       chmod 0600 "$backup_file"
   }
   ```
2. **Chamar em `backup_full()`**
3. **Estimativa:** **trivial (~30min)** Quick Win — combinar com #5 num único PR
4. **Quem executa:** DevOps

---

### Achado #7 — **Sem alerta de falha** de backup

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto**
- **Descrição:** se o backup falhar (banco indisponível, disco cheio, etc.), o erro fica em `journalctl` ou `/var/log/capul-platform/backup.err.log`. **Ninguém é notificado.** Empresa fica meses pensando que tem backup quando na real está em zero.
- **Por que é problema:** silêncio = sucesso é uma armadilha. **Backup precisa ser ativamente monitorado**.

#### Plano de Correção

1. **Pré-requisitos:** SMTP funcional (hoje fiscal/health diz `degraded` por SMTP — Achado #16 da auditoria 25/04)
2. **Passos concretos:**
   - Modificar `scripts/backup.sh` `main()`:
     ```bash
     trap 'send_failure_alert "$?"' ERR
     send_failure_alert() {
         local exit_code="$1"
         local hostname=$(hostname)
         echo "Backup falhou no host $hostname com exit code $exit_code em $(date)" \
             | mail -s "[CRÍTICO] Backup Capul falhou" "${BACKUP_ALERT_EMAIL}"
     }
     ```
   - `.env`: `BACKUP_ALERT_EMAIL=ti@capul.com.br`
   - **Alternativa moderna:** integrar com Slack/Teams via webhook (mais visível que e-mail)
3. **Critério de validação:** simular falha (`docker compose stop postgres` antes do backup) → e-mail/Slack chega
4. **Estimativa:** **trivial (~1h)**
5. **Quem executa:** DevOps

---

### Achado #8 — Backup **sem criptografia** (banco em texto-binário)

- **Dimensão:** 3 — Dados e segredos
- **Severidade:** **Alto** (sobretudo após Achado #2 — quando for pra cloud)
- **Descrição:** `backup_db_*.dump` é binário pg_dump custom format, **mas não criptografado**. Se alguém conseguir acesso ao bucket S3 ou ao disco local de backup, pega **todos os dados de produção** sem precisar de senha.
- **Por que é problema:** vazamento de backup = vazamento de dados de TODA a CAPUL (chamados, projetos, contratos, NF-es).

#### Plano de Correção

1. **Passos concretos:** wrap o `pg_dump` em pipe com `openssl enc` (similar ao #5/#6):
   ```bash
   docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom \
     | openssl enc -aes-256-cbc -salt -pbkdf2 -pass file:/etc/capul-backup-key \
     > "${BACKUP_DIR}/backup_db_${TIMESTAMP}.dump.enc"
   ```
2. **Restore correspondente:**
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
     -in backup_db_X.dump.enc \
     | docker exec -i capul-db pg_restore -U $DB_USER -d capul_platform --clean
   ```
3. **Atualizar `docs/ROTEIRO_MIGRACAO_PRODUCAO.md` §4** com o novo procedimento
4. **Estimativa:** **moderado (~2h)** — inclui ajustar restore + documentação
5. **Riscos:** sem a chave, backup vira inacessível — chave em cofre é crítica
6. **Quem executa:** DevOps

---

### Achado #9 — Redis **não está no backup**

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto** (medio em DEV, alto em PROD com BullMQ)
- **Descrição:** Redis hoje guarda:
  - Sessões (cache rate-limit ThrottlerGuard)
  - **BullMQ jobs do Fiscal** (cruzamento de cadastros, alertas SEFAZ)
  - Cache de configuração
  - Estados de circuit breaker SEFAZ
- **Por que é problema:** se Redis for perdido em meio a uma operação SEFAZ pesada, jobs em andamento somem e podem **gerar inconsistência fiscal** (consulta SEFAZ feita mas resultado não persistido).

#### Plano de Correção

1. **Passos concretos** — adicionar `backup_redis` ao script:
   ```bash
   backup_redis() {
       local backup_file="${BACKUP_DIR}/backup_redis_${TIMESTAMP}.rdb.enc"
       log_info "Backup Redis (RDB snapshot)..."
       docker exec capul-redis redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning BGSAVE
       sleep 5  # esperar BGSAVE concluir
       docker cp capul-redis:/data/dump.rdb /tmp/redis_${TIMESTAMP}.rdb
       openssl enc -aes-256-cbc -salt -pbkdf2 -pass file:/etc/capul-backup-key \
         -in /tmp/redis_${TIMESTAMP}.rdb -out "$backup_file"
       rm /tmp/redis_${TIMESTAMP}.rdb
   }
   ```
2. **Estimativa:** **trivial (~30min)**
3. **Quem executa:** DevOps

---

## Achados Médios

### Achado #10 — Permissão certificado A1 = `0777`

- **Dimensão:** 3 — Dados e segredos / 9 — Específico Fiscal
- **Localização:** `fiscal/backend/certs/dd4ee45e-...pfx` (777 = rwxrwxrwx)
- **Plano resumido:** `chmod 0640` no certificado, garantir que o appuser do container fiscal-backend lê (ele é uid 100, grupo appgroup pós sprint #2 da auditoria 25/04). **Esforço:** trivial. **Risco:** baixo.

### Achado #11 — Script legado `inventario/scripts/backup_database.sh` com **senha hardcoded** e referências obsoletas

- **Localização:** `inventario/scripts/backup_database.sh:15` — `DB_PASS="inventario2024"`
- **Plano resumido:** **deletar** o script (referencia container `inventario_postgres` que não existe mais — agora é `capul-db`; e DB `inventario_protheus` que virou `capul_platform`). Arquivo é puramente legado. Adicionar comentário em CHANGELOG da inventário.

### Achado #12 — Sem documentação consolidada de **DR completo** (banco + cert + .env + uploads + redis)

- **Localização:** `docs/ROTEIRO_MIGRACAO_PRODUCAO.md:174-203` cobre só banco; resto fica órfão
- **Plano resumido:** criar `docs/DR_PROCEDIMENTO_COMPLETO.md` consolidando restore de **todos** os componentes em ordem correta (cert → .env → banco → uploads → redis → smoke test). Esforço moderado (~2h).

---

## Achados Baixos

### Achado #13 — Logs do backup não centralizados

- Script declara `LOG_DIR="/var/log/capul-platform"` mas só escreve em stdout. Após Achado #1 (systemd), os logs vão pra `journalctl` automaticamente — pode ficar como está. Se quiser, ajustar `tee` no script.

### Achado #14 — Retenção fixa em 30 dias, sem política diferenciada

- Hoje: tudo expira em 30 dias. Padrão GFS (Grandfather-Father-Son) seria: diário 14d + semanal 8 sem + mensal 12 meses + anual permanente. Hoje perdemos histórico de >30d. Plano resumido: ajustar `BACKUP_RETENTION_DAYS` para 30 + adicionar diretório `monthly/` com cópias mensais retidas 365 dias.

---

## Roadmap consolidado de correção

### Sprint 1 (semana 1) — Quick Wins + Críticos urgentes ✅ **CONCLUÍDO 26/04/2026**

- [x] **#1** — systemd timer agendando backup diário (~1h) — templates em `scripts/systemd/`
- [x] **#5** — incluir certificado A1 cifrado (~30min) — função `backup_certs`
- [x] **#6** — incluir `.env` cifrado (~30min) — função `backup_env`
- [x] **#10** — chmod 0640 no certificado — fica pra PROD (DEV mantém 777 do WSL)
- [x] **#11** — deletado script legado `inventario/scripts/backup_database.sh`

### Sprint 2 (semana 2-3) — Backup robusto ✅ **CONCLUÍDO 26/04/2026**

- [x] **#2** — cópia off-site (S3) — função `sync_offsite` (controlada por `AWS_S3_BACKUP_BUCKET`)
- [x] **#7** — alerta de falha — email + webhook Slack/Teams (`send_failure_alert`)
- [x] **#8** — criptografia do dump principal — `backup_db` agora cifra com OpenSSL quando `/etc/capul-backup-key` presente
- [x] **#9** — Redis no backup — função `backup_redis` (BGSAVE + cifra)

### Sprint 3 (semana 4) — Validação e formalização ✅ **CONCLUÍDO 26/04/2026**

- [x] **#3** — script `scripts/dr-test.sh` (restaura em banco temporário, valida contagens vs PROD)
- [x] **#4** — `docs/DR_OBJETIVOS.md` proposta inicial (RTO 4h / RPO 24h) **— aguarda aprovação Diretor TI**
- [x] **#12** — `docs/DR_PROCEDIMENTO_COMPLETO.md` consolidado (10 passos, ordem correta cert → env → banco → redis → uploads → app → smoke test)
- [x] **#14** — retenção GFS (Grandfather-Father-Son) — diários 30d / semanais 8sem / mensais 12meses, promove backup full automaticamente nos domingos e dia 1

### Sprint 4 (semana 5) — Visibilidade no Configurador ⭐ ✅ **CONCLUÍDO 26/04/2026**

- [x] Modelo Prisma `BackupExecucao` em `auth-gateway/prisma/schema.prisma`
- [x] Migration manual `20260426180000_backup_execucoes` (não usado migrate dev pra preservar dados PROD)
- [x] Módulo `BackupExecucaoModule` em auth-gateway com 2 controllers:
  - Público (`/api/v1/core/backup/execucoes` GET listar/status/detalhe — exige JWT)
  - Interno (`/api/v1/internal/backup/execucao` POST registrar — `@Public()`, bloqueado externamente pelo Nginx)
- [x] Frontend `configurador/src/pages/backup-dr/BackupDrPage.tsx`:
  - 3 cards de status (último sucesso, última falha, contagem 7d)
  - Bloco de orientação inline ("ℹ️ O que é coberto", "⏱️ Política", "🛠️ Para ajustar")
  - Tabela histórico com ícone 🔒/🔓 indicando se foi cifrado
- [x] Item de menu "Backup & DR" no Sidebar do Configurador (role ADMIN)
- [x] `scripts/backup.sh`: função `track_execucao` POSTa via `docker exec capul-auth wget` no endpoint interno após cada run (sucesso/falha)
- [x] Validado: POST registra, GET lista, JWT obrigatório no público

> Decisão Clenio 26/04/2026 (memory `feedback_funcionalidade_visivel_no_configurador.md`):
> **Funcionalidades de operação não podem ser "totalmente ocultas"** — backup/restore precisa ter painel no Configurador.

- [ ] **#15 (NOVO)** — Página no Configurador "**Backup & Disaster Recovery**":
  - **Painel "Status"**: último backup (data, sucesso/falha, tamanho, duração), próxima execução
  - **Histórico** das últimas 30 execuções (timeline com status)
  - **Configurações editáveis**: frequência (diário/semanal), horário, retenção (dias), destino off-site (URL S3), e-mail de alerta
  - **Botões**: "Executar backup agora", "Validar restore" (modo dry-run)
  - **Orientação inline**: o que está incluído (banco + .env + cert + uploads + redis), procedimento de restore, RTO/RPO definidos
  - Backend: nova entidade `BackupExecucao` (Prisma) registra cada run; service consome `journalctl` ou lê metadata do script
  - Tabela: `core.backup_execucoes` (id, started_at, finished_at, status, tamanho_bytes, mensagem, tipo, destino)

**Total Sprint 4: ~6-8h** (frontend + backend + Prisma migration)

### Estimativa total

| Prioridade | Horas |
|---|---:|
| Sprint 1 (Quick Wins) | ~2-3h |
| Sprint 2 (Backup robusto) | ~7h |
| Sprint 3 (Validação) | ~6-8h |
| Sprint 4 (Visibilidade Configurador) | ~6-8h |
| **TOTAL** | **~21-26h** |

---

## Itens não verificados nesta auditoria

- **Snapshot de VM/disco do host** — depende do provedor (DigitalOcean, AWS EC2, on-premise) — não tive acesso
- **Backup de logs longos** (audit trail) — não verificado, pode ser próxima auditoria
- **Plano de continuidade de negócio (BCP)** — vai além de DR técnico, é gestão de crise

---

## Histórico desta auditoria

| Data | Versão prompt | Modo | Críticos | Relatório |
|---|---|---|---|---|
| 25/04/2026 | 1.1 | varredura rápida | 2 → 0 | [`AUDITORIA_25042026.md`](AUDITORIA_25042026.md) |
| 26/04/2026 | 1.1 | profunda — Backup/DR | **3** | (este arquivo) |

---

> **Próxima frente sugerida:** Observabilidade (logs estruturados, métricas, alertas) — ~1-2h. Naturalmente conecta com Achado #7 deste relatório.
