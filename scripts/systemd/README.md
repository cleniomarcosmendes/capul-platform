# Systemd — Backup automatizado da Capul Platform

Templates do **timer** e **service** que rodam `scripts/backup.sh full` diariamente
em produção. Usados em conjunto com a auditoria de Backup/DR de 26/04/2026
(`docs/AUDITORIA_BACKUP_DR_26042026.md`).

## Pré-requisitos no host de produção

1. Plataforma instalada em `/opt/capul-platform/` (alinhar com `BACKUP_DIR` do script).
2. Diretório de logs: `sudo mkdir -p /var/log/capul-platform && sudo chmod 0755 /var/log/capul-platform`
3. **Chave de criptografia** (sem ela o backup roda sem cifrar — só usar em DEV):
   ```bash
   sudo openssl rand -hex 32 | sudo tee /etc/capul-backup-key >/dev/null
   sudo chmod 0400 /etc/capul-backup-key
   sudo chown root:root /etc/capul-backup-key
   ```
   ⚠️ **Backup desta chave**: salvar uma cópia em **cofre físico** ou **vault corporativo**
   (1Password, Vaultwarden). Sem ela, os backups cifrados ficam **inúteis**.
4. (Opcional) E-mail de alerta — adicionar em `.env`:
   ```
   BACKUP_ALERT_EMAIL=ti@capul.com.br
   ```
   E garantir que `mail` (do pacote `mailutils` ou `bsd-mailx`) esteja no PATH e
   conectado ao SMTP correto.

## Instalação do timer

```bash
sudo cp /opt/capul-platform/scripts/systemd/capul-backup.service /etc/systemd/system/
sudo cp /opt/capul-platform/scripts/systemd/capul-backup.timer   /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now capul-backup.timer

# Verificar
sudo systemctl status  capul-backup.timer
sudo systemctl list-timers capul-backup.timer
```

## Testar imediatamente (não esperar 02:00)

```bash
sudo systemctl start capul-backup.service
sudo journalctl -u capul-backup.service -n 100 --no-pager
ls -lh /opt/capul-platform/backups/
```

Esperado em `/opt/capul-platform/backups/`:
- `backup_full_YYYYMMDD_HHMMSS.tar.gz` (app + banco + uploads)
- `backup_certs_YYYYMMDD_HHMMSS.tar.gz.enc` (certificado A1 cifrado)
- `backup_env_YYYYMMDD_HHMMSS.txt.enc` (.env cifrado)
- `backup_redis_YYYYMMDD_HHMMSS.rdb.enc` (Redis dump cifrado)

## Rollback (desabilitar)

```bash
sudo systemctl disable --now capul-backup.timer
sudo rm /etc/systemd/system/capul-backup.{service,timer}
sudo systemctl daemon-reload
```

## Próximas evoluções (Sprint 2)

Esta é a configuração base (Sprint 1 da auditoria de Backup/DR). Falta:

- **Off-site** — sync automático pra S3/Azure/Backblaze (Achado #2)
- **Alerta por webhook Slack/Teams** — além de email (Achado #7)
- **Teste de restore trimestral** documentado (Achado #3)
- **Tela "Backup & DR" no Configurador** — visibilidade ao operador (Sprint 4)
