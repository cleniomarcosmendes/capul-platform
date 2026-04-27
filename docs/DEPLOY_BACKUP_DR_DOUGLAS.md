# Deploy Backup & DR — Roteiro pra Douglas

**Data:** 26/04/2026
**Para:** Douglas (Análise / DevOps)
**De:** Equipe Plataforma Capul
**Aprovação RTO/RPO:** ✅ aprovado por Diretor TI em 26/04/2026 — RTO 4h / RPO 24h

---

## O que é isso

Configurar o sistema de **backup automático + alertas + cópia off-site** da Capul Platform no servidor de produção. A aplicação já tem todo o código — falta só configurar o servidor.

Toda a operação foi pensada pra ser **visível pelo time** via Configurador → "Backup & DR" (`https://platform.capul.com.br/configurador/backup-dr`).

**Tempo estimado:** ~2h de configuração inicial + ~30min pra primeiro DR test.

---

## 0. Pré-requisitos no servidor

```bash
# Confirmar que pacotes estão instalados
which openssl docker mail aws || sudo apt-get install -y openssl mailutils awscli

# Confirmar permissões da aplicação
ls -la /opt/capul-platform/scripts/backup.sh
# Esperado: -rwxr-xr-x ... clenio clenio

# Confirmar diretório de logs
sudo mkdir -p /var/log/capul-platform
sudo chmod 0755 /var/log/capul-platform
```

---

## 1. Criar chave de criptografia ⚠️ CRÍTICO

Os backups de **certificado A1 fiscal**, **`.env`**, **banco** e **Redis** são cifrados com OpenSSL AES-256-CBC. **Sem essa chave, os backups ficam inúteis.**

```bash
# Gera chave aleatória de 64 caracteres hex (32 bytes)
sudo openssl rand -hex 32 | sudo tee /etc/capul-backup-key >/dev/null
sudo chmod 0400 /etc/capul-backup-key
sudo chown root:root /etc/capul-backup-key

# Confirmar
sudo cat /etc/capul-backup-key
# Esperado: 64 caracteres hex (ex: a3f8b2... )
```

### 🔴 OBRIGATÓRIO — backup desta chave fora do servidor

A chave **NÃO** deve ficar só no servidor (se o servidor pegar fogo, perde tudo + a chave).

Salvar uma cópia em pelo menos UM destes lugares:
- **1Password** corporativo da CAPUL (vault TI)
- **Vaultwarden** self-hosted
- **Cofre físico** dentro de envelope lacrado (impressão da chave)

Documentar onde foi salva em `docs/INCIDENTES/CHAVE_BACKUP_LOCATION.md` (acesso restrito Diretor TI + você).

---

## 2. Configurar SMTP para alertas de e-mail

Edite `/opt/capul-platform/.env`:

```bash
# E-mail que recebe alertas de FALHA de backup
BACKUP_ALERT_EMAIL=ti@capul.com.br

# SMTP da CAPUL (já deve estar configurado pra outros módulos)
SMTP_HOST=smtp.capul.com.br
SMTP_PORT=587
SMTP_USER=fiscal@capul.com.br
SMTP_PASSWORD=<senha>
SMTP_FROM=fiscal@capul.com.br
```

**Testar:**
```bash
echo "Teste alerta backup" | mail -s "Teste backup" ti@capul.com.br
# Verificar caixa de entrada do ti@capul.com.br
```

Se o `mail` não tiver SMTP configurado, instalar `msmtp`:
```bash
sudo apt-get install -y msmtp msmtp-mta
sudo nano /etc/msmtprc
# Configurar conforme docs do msmtp
```

---

## 3. Configurar webhook Slack/Teams (opcional, recomendado)

E-mail é mais fácil de ignorar. Webhook aparece direto no canal do time.

**Slack — criar Incoming Webhook:**
1. https://api.slack.com/apps → New App → From scratch
2. Incoming Webhooks → Activate → Add New Webhook to Workspace
3. Escolher canal `#ti-alertas` (criar se não existe)
4. Copiar URL (formato: `https://hooks.slack.com/services/T.../B.../...`)

**Teams — Incoming Webhook:**
1. No canal desejado → "..." → Connectors → Incoming Webhook → Configure
2. Dar nome "Capul Backup" → Create
3. Copiar URL

Adicionar ao `/opt/capul-platform/.env`:
```bash
BACKUP_ALERT_WEBHOOK=https://hooks.slack.com/services/T.../B.../...
```

**Testar:** depois que o frontend voltar do build, abrir `https://platform.capul.com.br/configurador/backup-dr` → card "Testes & Operações" → **"Testar webhook"**. Mensagem aparece no canal.

---

## 4. Configurar destino off-site (S3 ou Backblaze B2)

### Opção A — AWS S3

```bash
# Instalar AWS CLI (se ainda não tiver)
sudo apt-get install -y awscli

# Configurar credentials (use IAM user dedicado, NÃO root!)
sudo aws configure
# AWS Access Key ID:     <key do IAM user dedicado>
# AWS Secret Access Key: <secret>
# Default region:        sa-east-1
# Default output:        json
```

**Bucket policy mínima** (criar bucket `capul-platform-backups-prod`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::SUA_CONTA:user/capul-backup" },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::capul-platform-backups-prod",
        "arn:aws:s3:::capul-platform-backups-prod/*"
      ]
    }
  ]
}
```

**Lifecycle do bucket** (rotação de retenção):
- Standard 30d → Standard-IA
- 90d → Glacier
- 7 anos → expirar

**Versioning:** ON (proteção contra delete acidental)

Adicionar ao `/opt/capul-platform/.env`:
```bash
AWS_S3_BACKUP_BUCKET=capul-platform-backups-prod
AWS_DEFAULT_REGION=sa-east-1
```

**Testar:**
```bash
aws s3 ls s3://capul-platform-backups-prod/
# Vazio inicialmente, mas comando deve retornar 0 (sem erro)
```

### Opção B — Backblaze B2 (mais barato, ~10x menos custo)

Análogo ao S3, mas com endpoint do B2:
```bash
aws configure --profile b2
# Access Key:    <do B2>
# Secret:        <do B2>
# Region:        us-west-002

# E ao chamar:
aws --profile b2 --endpoint-url=https://s3.us-west-002.backblazeb2.com s3 ls s3://capul-backups
```

E adicionar ao `.env`:
```bash
AWS_S3_BACKUP_BUCKET=capul-backups
AWS_DEFAULT_REGION=us-west-002
AWS_PROFILE=b2
```

E modificar `scripts/backup.sh` linha do `aws s3 sync` adicionando `--endpoint-url=https://s3.us-west-002.backblazeb2.com`.

---

## 5. Instalar systemd timer (agendamento diário 02:00)

```bash
cd /opt/capul-platform

# Copiar templates
sudo cp scripts/systemd/capul-backup.service /etc/systemd/system/
sudo cp scripts/systemd/capul-backup.timer   /etc/systemd/system/

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar e iniciar timer
sudo systemctl enable --now capul-backup.timer

# Confirmar
sudo systemctl status capul-backup.timer
sudo systemctl list-timers capul-backup.timer
```

Esperado:
```
NEXT                        LEFT          LAST UNIT
Mon 2026-04-27 02:00:00 -03 X h ago/left  ... capul-backup.timer
```

---

## 6. Primeiro backup (manual, pra validar)

**NÃO esperar 02:00.** Disparar agora:

```bash
sudo systemctl start capul-backup.service

# Acompanhar
sudo journalctl -u capul-backup.service -f
# Aguardar mensagem final "BACKUP CONCLUÍDO COM SUCESSO"

# Verificar arquivos
ls -lh /opt/capul-platform/backups/
```

**Esperado em `/opt/capul-platform/backups/`:**
- `backup_full_YYYYMMDD_HHMMSS.tar.gz` — app + banco + uploads
- `backup_db_YYYYMMDD_HHMMSS.dump.enc` — banco cifrado
- `backup_certs_YYYYMMDD_HHMMSS.tar.gz.enc` — cert A1 cifrado
- `backup_env_YYYYMMDD_HHMMSS.txt.enc` — .env cifrado
- `backup_redis_YYYYMMDD_HHMMSS.rdb.enc` — Redis cifrado
- `backup_uploads_YYYYMMDD_HHMMSS.tar.gz`

**Verificar visibilidade no Configurador:**

Abrir https://platform.capul.com.br/configurador/backup-dr (logado como ADMIN). Deve mostrar:
- Card "Último backup com sucesso" preenchido
- Tabela "Histórico" com 1 linha (hoje, full, SUCESSO, com 🔒 indicando cifrado)

Se aparecer **🔓 (cadeado aberto)** → chave de criptografia não foi criada (passo 1) ou está com permissão errada.

---

## 7. Configurar valores no Configurador

Acessar https://platform.capul.com.br/configurador/backup-dr → **card "Objetivos & Política DR"** → botão **Editar**.

Preencher (valores aprovados):

| Campo | Valor |
|---|---|
| RTO (horas) | **4** |
| RPO (horas) | **24** |
| Próxima revisão | 26/10/2026 (6 meses) |
| Aprovado por | Nome do Diretor TI |
| Aprovado em | 26/04/2026 |
| Retenção diários (dias) | **30** |
| Retenção semanais (semanas) | **8** |
| Retenção mensais (meses) | **12** |
| Destino off-site | `s3://capul-platform-backups-prod` (ou o que você usar) |
| E-mail alerta | `ti@capul.com.br` |
| Webhook alerta | URL do Slack/Teams |
| Agendamento (cron) | `0 2 * * *` (referência — real é o systemd) |

Clicar **Salvar**.

---

## 8. Testar integrações pelo Configurador

Card **"Testes & Operações"** — clicar nos botões:

| Teste | Esperado |
|---|---|
| **Testar webhook** | Mensagem chega no canal Slack/Teams |
| **Testar e-mail** | (ainda não implementado — exibe comando manual) |
| **Testar destino S3** | (ainda não implementado — exibe `aws s3 ls` pra rodar) |
| **Executar backup agora** | Gera comando `sudo /opt/capul-platform/scripts/backup.sh full` — copiar e rodar via SSH |
| **Validar restore (DR test)** | Gera comando `sudo /opt/capul-platform/scripts/dr-test.sh` — copiar e rodar via SSH |

---

## 9. Primeiro DR test ⚠️ OBRIGATÓRIO

Backup que não foi testado **não conta como backup**. Executar agora:

```bash
sudo /opt/capul-platform/scripts/dr-test.sh
```

O script:
1. Pega o backup mais recente (`backup_db_*.dump.enc`)
2. Decifra
3. Cria banco temporário `capul_dr_test`
4. Restaura
5. Compara contagens com produção
6. Limpa tudo

**Esperado:** todas as tabelas com `PROD == TESTE` (ou diferença pequena explicável por horário do dump).

**Se algo divergir muito:** investigar antes de assumir que backup funciona. Não passa pra próximo passo.

**Documentar resultado:** criar arquivo `/opt/capul-platform/docs/DR_TESTS.md` com data, sucesso/falha, observações (template em `docs/DR_PROCEDIMENTO_COMPLETO.md`).

---

## 10. Sync off-site funcionando?

Após o primeiro backup com `AWS_S3_BACKUP_BUCKET` configurado, validar:

```bash
aws s3 ls s3://capul-platform-backups-prod/
# Deve listar: backup_full_*, backup_db_*.enc, backup_certs_*.enc, etc.
```

Se vazio: revisar IAM user permissions + checar logs do backup (`journalctl -u capul-backup.service`).

---

## 11. Calendário de revisões

| Tarefa | Frequência | Responsável |
|---|---|---|
| Validar que timer está ativo (`systemctl list-timers capul-backup.timer`) | Mensal | Você (Douglas) |
| DR test (`scripts/dr-test.sh`) | **Trimestral** | Você + documentar em `docs/DR_TESTS.md` |
| Revisar RTO/RPO no Configurador | Semestral | Diretor TI |
| Auditar acesso à chave `/etc/capul-backup-key` | Semestral | Diretor TI |
| Confirmar bucket S3 com versioning + lifecycle | Anual | Você |

---

## 12. Como saber se algo deu errado

**Se backup falhar**, você recebe automaticamente:
- E-mail em `ti@capul.com.br` (passo 2)
- Webhook no canal Slack/Teams (passo 3)
- Aparece em `https://platform.capul.com.br/configurador/backup-dr` → card "Última falha"

**Pra investigar:**
```bash
sudo journalctl -u capul-backup.service -n 200 --no-pager
sudo tail -100 /var/log/capul-platform/backup.err.log
```

---

## 13. Checklist de entrega (marca quando fizer)

- [ ] Pacotes instalados (passo 0)
- [ ] Chave criada em `/etc/capul-backup-key` (0400 root) (passo 1)
- [ ] **Cópia da chave guardada em cofre fora do servidor** (passo 1) ⚠️
- [ ] SMTP configurado e teste de e-mail OK (passo 2)
- [ ] Webhook Slack/Teams configurado e teste OK (passo 3)
- [ ] AWS CLI configurado e bucket S3 criado com policy/lifecycle (passo 4)
- [ ] systemd timer instalado e listado em `list-timers` (passo 5)
- [ ] Primeiro backup manual rodou com sucesso (passo 6)
- [ ] Configurações preenchidas no Configurador (passo 7)
- [ ] Testes do Configurador OK (passo 8)
- [ ] DR test executado e documentado (passo 9)
- [ ] Sync S3 confirmado (passo 10)

---

## Dúvidas

- **Documento técnico:** `docs/AUDITORIA_BACKUP_DR_26042026.md`
- **Restore completo (catástrofe):** `docs/DR_PROCEDIMENTO_COMPLETO.md`
- **Objetivos formais:** `docs/DR_OBJETIVOS.md`
- **Code:** `scripts/backup.sh`, `scripts/dr-test.sh`, `scripts/systemd/`

Qualquer coisa, fala comigo (Clenio) ou abre chamado pra TI.
