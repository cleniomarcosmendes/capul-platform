# Disaster Recovery — Procedimento Completo

**Versão:** 1.0
**Data:** 26/04/2026
**Origem:** Auditoria Backup/DR de 26/04/2026
**Quando usar:** restauração em caso de catástrofe (perda total do servidor, corrupção de dados, etc.)

> 📌 **Pré-requisito:** familiarize-se com `docs/DR_OBJETIVOS.md` (RTO/RPO esperados)
> antes de executar este procedimento. Em catástrofe, **siga este doc na ordem** —
> não pule etapas.

---

## Visão geral — ordem de restauração

```
1. Provisionar host novo (Docker + Compose instalados)
        ↓
2. Recuperar arquivos de backup (off-site S3, mídia local, etc.)
        ↓
3. Decifrar .env  ← PRIMEIRO (banco e cert dependem dele)
        ↓
4. Decifrar certificado A1 fiscal
        ↓
5. Subir somente PostgreSQL → restaurar dump
        ↓
6. Subir Redis → restaurar dump (opcional, mas recomendado)
        ↓
7. Restaurar uploads (anexos)
        ↓
8. Subir todos os serviços
        ↓
9. Smoke test: login + módulos principais funcionam
        ↓
10. Comunicar conclusão e documentar incidente
```

---

## Passo a passo

### 1. Pré-requisitos no host novo

```bash
# Pacotes
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git openssl

# Diretórios
sudo mkdir -p /opt/capul-platform
sudo mkdir -p /var/log/capul-platform

# Clonar código (caso não esteja em backup)
sudo git clone <repo-url> /opt/capul-platform
cd /opt/capul-platform
```

### 2. Recuperar backup off-site

**Opção A — AWS S3:**
```bash
aws s3 sync s3://capul-platform-backups-prod /opt/capul-platform/backups/ \
    --include "backup_*" --include "weekly/*" --include "monthly/*"
```

**Opção B — Mídia física:**
```bash
sudo cp -r /mnt/usb-backup/* /opt/capul-platform/backups/
```

Confirme que existem (substitua YYYYMMDD pelo timestamp do dia anterior à catástrofe):
- `backup_db_YYYYMMDD_HHMMSS.dump.enc`
- `backup_env_YYYYMMDD_HHMMSS.txt.enc`
- `backup_certs_YYYYMMDD_HHMMSS.tar.gz.enc`
- `backup_redis_YYYYMMDD_HHMMSS.rdb.enc`
- `backup_uploads_YYYYMMDD_HHMMSS.tar.gz`

### 3. Restaurar a chave de criptografia

⚠️ A chave foi guardada em **cofre fora do servidor** (1Password / Vaultwarden / cofre físico).
Sem ela, todos os backups `.enc` são inúteis.

```bash
# Recuperar do cofre, escrever no host (root, 0400)
echo "<chave-hex-de-64-chars>" | sudo tee /etc/capul-backup-key >/dev/null
sudo chmod 0400 /etc/capul-backup-key
```

### 4. Restaurar .env (PRIMEIRO — banco e cert dependem dele)

```bash
cd /opt/capul-platform
LATEST_ENV=$(ls -t backups/backup_env_*.txt.enc | head -1)
sudo openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
    -in "$LATEST_ENV" -out .env
sudo chmod 0600 .env
sudo chown $USER:$USER .env

# Confirmar variáveis críticas
grep -E "^(DB_PASSWORD|JWT_SECRET|FISCAL_MASTER_KEY|REDIS_PASSWORD)=" .env
```

### 5. Restaurar certificado A1 fiscal

```bash
LATEST_CERTS=$(ls -t backups/backup_certs_*.tar.gz.enc | head -1)
sudo openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
    -in "$LATEST_CERTS" \
    | sudo tar -xzf - -C fiscal/backend/

# Confirmar
ls -la fiscal/backend/certs/*.pfx
```

### 6. Subir somente PostgreSQL e restaurar banco

```bash
# Subir só o postgres
docker compose up -d postgres
sleep 15  # esperar inicializar

# Decifrar dump
LATEST_DB=$(ls -t backups/backup_db_*.dump.enc | head -1)
sudo openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
    -in "$LATEST_DB" -out /tmp/restore.dump

# Copiar pro container e restaurar
docker cp /tmp/restore.dump capul-db:/tmp/restore.dump
docker compose exec postgres pg_restore -U $DB_USER -d capul_platform \
    --clean --if-exists /tmp/restore.dump

# Validar
docker compose exec postgres psql -U $DB_USER -d capul_platform \
    -c "SELECT COUNT(*) FROM core.usuarios;"
docker compose exec postgres psql -U $DB_USER -d capul_platform \
    -c "SELECT COUNT(*) FROM gestao_ti.projetos;"

# Limpar tmp
rm /tmp/restore.dump
docker compose exec postgres rm /tmp/restore.dump
```

### 7. Subir Redis e restaurar dump (opcional, recomendado)

```bash
# Decifrar
LATEST_REDIS=$(ls -t backups/backup_redis_*.rdb.enc | head -1)
sudo openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
    -in "$LATEST_REDIS" -out /tmp/dump.rdb

# Subir Redis vazio
docker compose up -d redis
sleep 3

# Parar Redis pra trocar o dump.rdb
docker compose stop redis
docker cp /tmp/dump.rdb capul-redis:/data/dump.rdb
docker compose up -d redis

# Limpar tmp
rm /tmp/dump.rdb
```

### 8. Restaurar uploads (anexos)

```bash
LATEST_UPLOADS=$(ls -t backups/backup_uploads_*.tar.gz | head -1)
docker run --rm \
    -v capul-platform_uploads_data:/data \
    -v /opt/capul-platform/backups:/backup:ro \
    alpine sh -c "cd /data && tar -xzf /backup/$(basename $LATEST_UPLOADS)"

# Validar permissão (auditoria 25/04 — uid 100 appuser)
docker compose exec --user 0 gestao-ti-backend chown -R appuser:appgroup /app/uploads
```

### 9. Subir todos os serviços

```bash
docker compose up -d

# Aguardar healthchecks
sleep 30
docker compose ps
```

Esperado: 13/13 containers `(healthy)`.

### 10. Smoke test

```bash
# Auth funciona
curl -sk -X POST https://localhost/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"<email>","senha":"<senha>"}' | head -100

# Health Fiscal
curl -sk https://localhost/api/v1/fiscal/health

# Frontends carregam
for path in / /gestao-ti/ /fiscal/ /configurador/ /inventario/; do
  echo -n "  $path: "; curl -sk -o /dev/null -w "%{http_code}\n" https://localhost$path
done
```

Esperado: login retorna token, health 200, todas rotas frontend 200.

### 11. Comunicar e documentar

- [ ] Notificar usuários que a plataforma voltou (Slack/email/etc.)
- [ ] Registrar incidente em `docs/INCIDENTES/` (criar se não existir):
  - Data/hora do início e fim
  - Causa raiz
  - Tempo total fora do ar (RTO real vs alvo 4h)
  - Quanto dado foi perdido (RPO real vs alvo 24h)
  - Lições aprendidas
- [ ] Agendar **post-mortem** com a equipe

---

## Comportamentos esperados pós-restore

| O que esperar | Por quê |
|---|---|
| **Usuários precisam relogar** | JWT antigo é invalidado se Redis foi resetado |
| **Jobs BullMQ Fiscal podem reexecutar** | Se Redis tinha jobs em andamento no momento do crash |
| **`circuit_breaker_uf` pode estar inconsistente** | Estado SEFAZ pode ter mudado durante o downtime — verificar `/operacao/limites` |
| **Sessões pgAdmin perdidas** | Volume `pgadmin_data` não está no backup (decisão consciente — pgAdmin é só admin) |

---

## Procedimento de teste regular

Não esperar a catástrofe pra testar. Executar **trimestralmente**:

```bash
sudo /opt/capul-platform/scripts/dr-test.sh
```

Esse script restaura o backup mais recente em um banco temporário (`capul_dr_test`) e valida contagens vs produção, sem tocar no PROD.

Documentar resultado em `docs/DR_TESTS.md` (ver template abaixo).

---

## Template `docs/DR_TESTS.md`

```markdown
# DR Tests — Histórico

## YYYY-MM-DD — DR Test #N

- **Executor:** <nome>
- **Backup testado:** backup_db_YYYYMMDD_HHMMSS.dump.enc
- **Resultado:** ✅ SUCESSO | ❌ FALHA
- **Tempo de restore:** Xmin
- **Discrepâncias encontradas:**
  - Tabela X: PROD=N TESTE=M (diff explicada por <motivo>)
- **Lições / ajustes:**
  - <descrever>
- **Próximo teste:** YYYY-MM-DD
```

---

*Última atualização: 26/04/2026*
