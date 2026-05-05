# Roteiro de Migracao para Producao — Capul Platform

**Versao**: 1.2
**Data**: 05/05/2026
**Objetivo**: Procedimento padrao para deploy e atualizacoes em producao

**Mudancas v1.2 (05/05/2026)**: Init jobs `*-migrate` para aplicar migrations
Prisma automaticamente no `docker compose up -d` (auth-migrate, gestao-ti-migrate,
fiscal-migrate). Pos-incidente deploy 04/05 onde 5 migrations ficaram pendentes
silenciosamente porque o `CMD` do backend ia direto para `node dist/main.js`
sem rodar `prisma migrate deploy`. A partir desta versao, NAO e mais necessario
rodar `prisma migrate deploy` manualmente — Compose dispara o init job antes
de subir o backend correspondente (`depends_on: service_completed_successfully`).

**Mudancas v1.1 (19/04/2026)**: inclusao do Modulo Fiscal (Onda 1 do Plano v2.0) —
migration SQL manual, seed de endpoints Protheus em `core.integracoes_api`, tabela
`fiscal.limite_diario`, upload do certificado A1, flags de producao. Ver Secao 9.

---

## Arquitetura de Migrations

| Modulo | Estrategia | Aplicacao | Controle |
|--------|-----------|-----------|----------|
| **Auth Gateway** | Prisma Migrations | **Init job `auth-migrate`** (automatico no `up -d`) | Tabela `core._prisma_migrations` |
| **Gestao TI** | Prisma Migrations | **Init job `gestao-ti-migrate`** (automatico no `up -d`) | Tabela `gestao_ti._prisma_migrations` |
| **Fiscal** | Prisma Migrations | **Init job `fiscal-migrate`** (automatico no `up -d`) | Tabela `fiscal._prisma_migrations` |
| **Inventario** | SQL Manual | `inventario/database/migrate.sh` (manual ou via `scripts/migrate.sh`) | Tabela `inventario.schema_migrations` |

**Como funciona o init job (a partir de 05/05/2026):**

Cada backend Node tem um servico irmao no `docker-compose.yml` que roda exclusivamente
`npx prisma migrate deploy` e termina (exit 0/1). O backend tem `depends_on:
service_completed_successfully` apontando para o init job — Compose so inicia o
backend depois que o init terminou com exit 0. Em caso de falha do migrate
(`exit 1`), o backend nao sobe e o `docker compose ps` mostra o init em estado
`exited (1)` — falha visivel, sem janela de "codigo novo + schema velho".

**Ordem obrigatoria** (gerenciada automaticamente pelo Compose via `depends_on`):
postgres healthy → init jobs em paralelo → backends → frontends.

**Inventario** continua com SQL manual (sem init job equivalente — ainda nao
foi padronizado). Aplicar via `bash scripts/migrate.sh` apos o `up -d`.

---

## 1. PRIMEIRO DEPLOY (Banco Vazio)

### Pre-requisitos
- Docker e Docker Compose instalados
- Arquivo `.env` configurado com credenciais de PRODUCAO
- Certificados SSL em `nginx/certs/`

### Passo a Passo

```bash
# 1. Clonar/copiar o repositorio
cd /opt/capul-platform

# 2. Configurar .env de producao
cp .env.example .env
# Editar com credenciais reais:
# - DB_USER, DB_PASSWORD (diferentes de desenvolvimento!)
# - JWT_SECRET, JWT_REFRESH_SECRET (gerar com: openssl rand -hex 64)
# - CORS_ORIGINS (IPs da intranet)

# 3. Subir containers (init jobs *-migrate aplicam Prisma automaticamente)
docker compose up -d

# 4. Aguardar PostgreSQL ficar healthy
docker compose exec postgres pg_isready -U $DB_USER

# 4.1. Confirmar que init jobs sairam com sucesso (auditoria)
docker compose ps --all | grep -E "auth-migrate|gestao-ti-migrate|fiscal-migrate"
# Esperado: cada um em "Exited (0)" — exit code 0 = sucesso, NAO e erro
# Se aparecer "Exited (1)": ver `docker compose logs <servico>-migrate` para diagnostico

# 5. Inventario SQL + seeds (NAO ha init job do Inventario — ainda manual)
bash scripts/migrate.sh

# 6. Verificar
# Esperado: core: 14 tabelas, gestao_ti: 60 tabelas, inventario: 36 tabelas

# 7. Testar login
curl -sk -X POST https://localhost/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","senha":"admin123"}'

# 8. IMPORTANTE: Trocar senha do admin imediatamente!
```

---

## 2. ATUALIZACAO (Deploy Subsequente)

### Procedimento Padrao

```bash
# 1. Parar servicos (manter banco rodando)
docker compose stop auth-gateway gestao-ti-backend gestao-ti-frontend \
  inventario-backend inventario-frontend hub configurador nginx

# 2. Atualizar codigo
git pull origin main
# OU copiar novos arquivos

# 3. Rebuild dos containers alterados
docker compose build

# 4. Subir servicos
#    Init jobs *-migrate rodam ANTES dos backends (Prisma migrate deploy automatico).
#    Se algum init falhar, o backend correspondente NAO sobe.
docker compose up -d

# 4.1. Auditoria: confirmar exit 0 dos init jobs e logs limpos
docker compose ps --all | grep -E "auth-migrate|gestao-ti-migrate|fiscal-migrate"
docker compose logs auth-migrate gestao-ti-migrate fiscal-migrate 2>&1 | tail -20
# Esperado: cada init com "Exited (0)" + log "No pending migrations" OU "Applying migration X..."

# 5. Inventario (init job nao existe — manter manual)
bash scripts/migrate.sh --skip-seed

# 6. Recriar nginx (para pegar novos IPs dos containers)
docker compose stop nginx && docker compose rm -f nginx && docker compose up -d nginx

# 7. Verificar
docker compose ps
curl -sk https://localhost/api/v1/auth/login \
  -X POST -H 'Content-Type: application/json' \
  -d '{"login":"admin","senha":"SuaSenhaReal"}'
```

---

## 3. ADICIONANDO NOVO CAMPO NO BANCO

### Cenario A: Campo OPCIONAL (nullable)

```bash
# 1. Alterar schema.prisma
#    Exemplo: observacoes String?   (com ?)

# 2. Gerar migration (APENAS em desenvolvimento)
docker compose exec gestao-ti-backend npx prisma migrate dev --name add_campo_observacoes

# 3. Commitar a migration gerada
git add gestao-ti/backend/prisma/migrations/
git commit -m "feat(gestao-ti): add campo observacoes"

# 4. Em producao: aplicar
docker compose exec gestao-ti-backend npx prisma migrate deploy
# OU
bash scripts/migrate.sh --skip-seed
```

### Cenario B: Campo OBRIGATORIO (NOT NULL) em tabela COM dados

**ATENCAO**: Este e o cenario problematico. Seguir os 3 passos:

```bash
# === PASSO 1: Adicionar como nullable ===
# No schema.prisma:
#   novoCampo String?    (COM ?)

# Gerar migration:
docker compose exec gestao-ti-backend npx prisma migrate dev --name add_campo_nullable

# === PASSO 2: Preencher dados existentes ===
# Gerar migration vazia:
docker compose exec gestao-ti-backend npx prisma migrate dev --create-only --name backfill_campo

# Editar o arquivo migration.sql gerado e adicionar:
#   UPDATE "gestao_ti"."tabela" SET "novo_campo" = 'valor_padrao' WHERE "novo_campo" IS NULL;

# Aplicar:
docker compose exec gestao-ti-backend npx prisma migrate dev

# === PASSO 3: Tornar obrigatorio ===
# No schema.prisma:
#   novoCampo String     (SEM ?)

# Gerar migration:
docker compose exec gestao-ti-backend npx prisma migrate dev --name campo_not_null

# Commitar as 3 migrations e aplicar em producao:
docker compose exec gestao-ti-backend npx prisma migrate deploy
```

### Cenario C: Campo no Inventario (SQL manual)

```bash
# 1. Criar arquivo SQL em inventario/database/migrations/
#    Nome: XXX_descricao.sql (onde XXX e o proximo numero sequencial)

# 2. Escrever SQL idempotente:
#    ALTER TABLE inventario.tabela ADD COLUMN IF NOT EXISTS campo TEXT;
#    UPDATE inventario.tabela SET campo = 'valor' WHERE campo IS NULL;
#    ALTER TABLE inventario.tabela ALTER COLUMN campo SET NOT NULL;

# 3. Em producao: executar
bash scripts/migrate.sh --skip-seed
# O script detecta automaticamente o novo arquivo e aplica
```

---

## 4. BACKUP E RESTAURACAO

> Atualizado em 26/04/2026 conforme `docs/AUDITORIA_BACKUP_DR_26042026.md`.
> Backup agora cobre: **banco + .env + cert A1 + Redis + uploads + app**.

### Backup (executar ANTES de qualquer atualizacao)

**Modo recomendado** — script unificado:
```bash
cd /opt/capul-platform
sudo ./scripts/backup.sh full
```

Saidas em `/opt/capul-platform/backups/`:
- `backup_full_YYYYMMDD_HHMMSS.tar.gz`         — app + banco + uploads
- `backup_certs_YYYYMMDD_HHMMSS.tar.gz.enc`    — certificado A1 fiscal (cifrado)
- `backup_env_YYYYMMDD_HHMMSS.txt.enc`         — .env (cifrado)
- `backup_redis_YYYYMMDD_HHMMSS.rdb.enc`       — Redis snapshot (cifrado)

**Pré-requisito** — chave de criptografia configurada (uma única vez):
```bash
sudo openssl rand -hex 32 | sudo tee /etc/capul-backup-key >/dev/null
sudo chmod 0400 /etc/capul-backup-key
# IMPORTANTE: salvar copia desta chave em cofre fora do servidor!
```

**Modo legado** (apenas banco — fallback se script falhar):
```bash
docker compose exec postgres pg_dump -U $DB_USER capul_platform \
  --format=custom --compress=9 \
  -f /var/lib/postgresql/data/backup_$(date +%Y%m%d_%H%M%S).dump
docker cp capul-db:/var/lib/postgresql/data/backup_*.dump ./backups/
```

### Restauracao completa (em caso de falha catastrofica)

> Ordem importa: **cert + .env primeiro**, depois banco, depois Redis, depois subir app.

```bash
# 1. Parar todos os servicos
cd /opt/capul-platform
docker compose stop

# 2. Restaurar .env (precisa antes do banco para conexao)
openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
  -in /opt/capul-platform/backups/backup_env_YYYYMMDD_HHMMSS.txt.enc \
  -out /opt/capul-platform/.env
chmod 0600 /opt/capul-platform/.env

# 3. Restaurar certificado A1 fiscal
openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
  -in /opt/capul-platform/backups/backup_certs_YYYYMMDD_HHMMSS.tar.gz.enc \
  | tar -xzf - -C /opt/capul-platform/fiscal/backend/

# 4. Subir somente o postgres
docker compose up -d postgres
sleep 10

# 5. Restaurar banco
docker cp /opt/capul-platform/backups/backup_db_YYYYMMDD_HHMMSS.dump capul-db:/tmp/restore.dump
docker compose exec postgres pg_restore -U $DB_USER -d capul_platform \
  --clean --if-exists /tmp/restore.dump

# 6. Restaurar Redis (opcional — em caso de jobs BullMQ em andamento)
docker compose up -d redis
sleep 5
openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/capul-backup-key \
  -in /opt/capul-platform/backups/backup_redis_YYYYMMDD_HHMMSS.rdb.enc \
  -out /tmp/dump.rdb
docker compose stop redis
docker cp /tmp/dump.rdb capul-redis:/data/dump.rdb
rm /tmp/dump.rdb

# 7. Subir aplicacao
docker compose up -d

# 8. Smoke test
curl -sk https://localhost/api/v1/fiscal/health
docker compose ps
```

### Agendamento automatico (systemd timer)

Templates em `scripts/systemd/`. Veja `scripts/systemd/README.md` para instalacao.

---

## 5. TABELA DE REFERENCIA — COMANDOS

| Acao | Comando |
|------|---------|
| **Primeiro deploy** | `docker compose up -d` (init jobs Prisma) + `bash scripts/migrate.sh` (Inventario SQL + seeds) |
| **Atualizacao Prisma** | `docker compose up -d --build` (init jobs aplicam migrations automaticamente) |
| **Atualizacao Inventario** | `bash scripts/migrate.sh --skip-seed` (init job ainda nao existe) |
| **Baseline inventario** | `bash scripts/migrate.sh --baseline-inventario` |
| **Auditoria init jobs** | `docker compose ps --all \| grep migrate` → todos `Exited (0)` |
| **Status Auth GW** | `docker compose exec auth-gateway npx prisma migrate status` |
| **Status Gestao TI** | `docker compose exec gestao-ti-backend npx prisma migrate status` |
| **Status Fiscal** | `docker compose exec fiscal-backend npx prisma migrate status` |
| **Status Inventario** | `docker compose exec postgres psql -U $DB_USER -d capul_platform -c "SELECT * FROM inventario.schema_migrations ORDER BY id"` |
| **Forcar reaplicacao manual (excecao)** | `docker compose run --rm <servico>-migrate` (auth-migrate, gestao-ti-migrate, fiscal-migrate) |
| **Seed endpoints Fiscal** | `docker compose exec -T postgres sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB" < fiscal/backend/prisma/seed-integracoes-fiscal.sql` |
| **Health Fiscal** | `curl -sk https://localhost/api/v1/fiscal/health \| jq .` |
| **Limite diario** | `curl -sk -H "Authorization: Bearer $TOKEN" https://localhost/api/v1/fiscal/operacao/limites \| jq .` |
| **Backup** | `docker compose exec postgres pg_dump -U $DB_USER capul_platform -Fc -f /tmp/backup.dump` |
| **Logs de erro** | `docker compose logs --tail 20 auth-gateway gestao-ti-backend fiscal-backend` |
| **Rebuild tudo** | `docker compose build && docker compose up -d` |

---

## 6. CHECKLIST PRE-DEPLOY PRODUCAO

### Seguranca
- [ ] `.env` com credenciais de PRODUCAO (diferentes de dev)
- [ ] JWT_SECRET gerado com `openssl rand -hex 64`
- [ ] JWT_REFRESH_SECRET diferente do JWT_SECRET
- [ ] DB_PASSWORD forte (min 16 chars)
- [ ] CORS_ORIGINS restrito aos IPs da intranet
- [ ] Certificados SSL validos (nao autoassinados em producao)
- [ ] DEBUG=false no inventario
- [ ] Senha do admin trocada apos primeiro login

### Infraestrutura
- [ ] Docker e Docker Compose instalados
- [ ] Porta 443 liberada no firewall
- [ ] Volume de dados PostgreSQL em disco persistente
- [ ] Backup automatizado configurado (cron)
- [ ] Monitoramento de containers (healthcheck)

### Dados
- [ ] Seeds executados (empresa, filial, modulos, roles, admin)
- [ ] Usuarios cadastrados no Configurador
- [ ] Permissoes atribuidas por modulo
- [ ] Filiais cadastradas e vinculadas aos usuarios

### Modulo Fiscal (se habilitado)
- [ ] Ver **Secao 9.7** — Checklist dedicado do Fiscal
- [ ] Integracao PROTHEUS cadastrada em `core.integracoes_api` com credencial real
- [ ] Certificado A1 valido (>30 dias) uploaded no Configurador e ativado
- [ ] SMTP configurado para alertas (limite diario + digest de cruzamento)
- [ ] `FISCAL_PROTHEUS_MOCK=false` no `.env`

---

## 7. TROUBLESHOOTING

### "Migration failed — NOT NULL constraint"
**Causa**: Tentou adicionar campo obrigatorio em tabela com dados.
**Solucao**: Seguir o padrao de 3 passos (Cenario B acima).

### "502 Bad Gateway" apos deploy
**Causa**: Nginx com DNS cache antigo dos containers.
**Solucao**: `docker compose stop nginx && docker compose rm -f nginx && docker compose up -d nginx`

### "Connection refused" nos logs do nginx
**Causa**: Containers reiniciaram e mudaram de IP.
**Solucao**: Mesma do 502 acima.

### "Unique constraint failed" no seed
**Causa**: Seed executado mais de uma vez com dados parciais.
**Solucao**: Seeds sao idempotentes (find or create). Se falhar, verificar se a constraint unique mudou.

### "CORS blocked" no navegador
**Causa**: IP do navegador nao esta no CORS_ORIGINS.
**Solucao**: Adicionar ao `.env`: `CORS_ORIGINS=https://localhost,https://SEU_IP`

### Inventario migration falhou
**Causa**: SQL com erro ou meta-comando `\c`.
**Solucao**: O script filtra `\c` automaticamente. Verificar SQL manualmente com:
```bash
docker compose exec postgres psql -U $DB_USER -d capul_platform -f /migrations-inv/migrations/ARQUIVO.sql
```

---

## 8. FLUXO DE DESENVOLVIMENTO → PRODUCAO

```
DESENVOLVIMENTO                           PRODUCAO

1. Alterar schema.prisma
2. prisma migrate dev --name xxx
   (gera migration SQL versionada)
3. Testar localmente
4. git commit + push
                                          5. git pull
                                          6. docker compose build
                                          7. docker compose up -d
                                             (init jobs *-migrate aplicam Prisma automaticamente
                                              ANTES dos backends subirem)
                                          8. Auditoria: docker compose ps --all | grep migrate
                                             (cada init em "Exited (0)" = sucesso)
                                          9. bash scripts/migrate.sh --skip-seed
                                             (apenas para Inventario SQL — ainda manual)
                                          10. Verificar
```

**Regra de ouro**: NUNCA usar `prisma migrate dev` ou `prisma db push` em producao.
Sempre usar `prisma migrate deploy` (aplica migrations existentes, nunca gera novas).

**Excecao**: Modulo Fiscal — migrations SQL aplicadas manualmente via `psql`.
Ver Secao 9.

---

## 9. MODULO FISCAL — ONDA 1 (Plano v2.0)

Referencia: `docs/PLANO_MODULO_FISCAL_v2.0.md` e `memory/project_fiscal_onda1_completa_18abr`.

### 9.1. Pre-requisitos do Fiscal

- Integracao `PROTHEUS` ja cadastrada em `core.integracoes_api` (o Fiscal depende dela para resolver URLs dinamicamente)
- Auth Gateway + Gestao TI ja migrados (o Fiscal usa role `GESTOR_FISCAL`/`ANALISTA_CADASTRO`/`OPERADOR_ENTRADA`/`ADMIN_TI` em `core.usuarios_modulos`)
- Certificado A1 da CAPUL disponivel para upload (.pfx + senha)
- Cadeia ICP-Brasil sera buscada automaticamente no boot (flag `FISCAL_SEFAZ_CA_AUTO_REFRESH=true`)

### 9.2. Primeiro deploy do Fiscal (banco vazio, schema `fiscal` ainda nao existe)

```bash
# 1. Aplicar schema Prisma (cria o schema `fiscal` + todas as tabelas base)
docker compose cp fiscal/backend/prisma/schema.prisma fiscal-backend:/app/prisma/schema.prisma
docker compose exec fiscal-backend sh -c "cd /app && npx prisma db push --accept-data-loss=false"

# (Opcional, se `db push` tambem tentar mexer em core — use diff manual):
# docker compose exec -T fiscal-backend sh -c "npx prisma migrate diff \
#   --from-empty \
#   --to-schema-datamodel prisma/schema.prisma \
#   --script" > /tmp/fiscal_init.sql
# # REVISAR /tmp/fiscal_init.sql para NAO incluir tabelas core
# docker compose exec -T postgres sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB" < /tmp/fiscal_init.sql

# 2. Aplicar migrations versionadas (na ordem cronologica):
for f in fiscal/backend/prisma/migrations/*/migration.sql; do
  echo "Aplicando $f..."
  docker compose exec -T postgres sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -v ON_ERROR_STOP=1" < "$f"
done

# 3. Seed dos endpoints Protheus em core.integracoes_api_endpoints
docker compose exec -T postgres sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB" \
  < fiscal/backend/prisma/seed-integracoes-fiscal.sql
# Cria: cadastroFiscal, eventosNfe, grvXML × PROD/HOMOLOGACAO (6 endpoints)

# 4. Verificar que a tabela singleton `fiscal.limite_diario` foi seedada
docker compose exec -T postgres sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c \
  \"SELECT id, limite_diario, alerta_amarelo, alerta_vermelho FROM fiscal.limite_diario;\""
# Esperado: id=1, limite=2000, amarelo=1600, vermelho=1800

# 5. Configurar integracao PROTHEUS (se ainda nao existir em core.integracoes_api)
# Via UI: https://PRODUCAO/configurador/integracoes
# OU via SQL (ajustar authConfig com credencial BASIC real em base64):
#
# INSERT INTO core.integracoes_api (id, codigo, nome, ambiente, tipo_auth, auth_config, ativo, created_at, updated_at)
# VALUES (gen_random_uuid()::text, 'PROTHEUS', 'Protheus ERP', 'PRODUCAO',
#         'BASIC', 'BASE64_CREDENCIAL_AQUI', true, NOW(), NOW())
# ON CONFLICT (codigo) DO NOTHING;

# 6. Upload do certificado A1 pelo Configurador
# Acessar: https://PRODUCAO/configurador/certificado-fiscal
# - Clicar "Novo certificado"
# - Selecionar arquivo .pfx
# - Informar senha
# - Clicar "Ativar"

# 7. Primeiro refresh da cadeia ICP-Brasil (automatico no boot se flag ativada)
# Se FISCAL_SEFAZ_CA_AUTO_REFRESH=true, refresh ocorre automaticamente
# Para forcar manualmente: https://PRODUCAO/fiscal/operacao/tls → botao "Atualizar cadeia agora"

# 8. Smoke test
curl -sk https://PRODUCAO/api/v1/fiscal/health
# Esperado: { status: "ok" | "degraded", checks: { database, redis, sefazTls: { ok: true } } }
```

### 9.3. Atualizacao do Fiscal (deploy subsequente)

```bash
# 1. Parar apenas fiscal-backend (nao precisa mexer nos outros)
docker compose stop fiscal-backend fiscal-frontend

# 2. Atualizar codigo
git pull origin main

# 3. Rebuild
docker compose build fiscal-backend fiscal-frontend fiscal-migrate

# 4. Subir — init job fiscal-migrate aplica migrations Prisma novas automaticamente
#    antes do fiscal-backend iniciar. NAO e mais necessario aplicar manual via psql.
docker compose up -d fiscal-backend fiscal-frontend

# 5. Auditoria do init job
docker compose ps --all | grep fiscal-migrate
# Esperado: "Exited (0)"
docker compose logs fiscal-migrate | tail -20
# Esperado: "Applying migration X..." OU "No pending migrations to apply."

# 6. Verificar
curl -sk https://PRODUCAO/api/v1/fiscal/health
docker compose logs --tail 30 fiscal-backend | grep -iE "started|error"
```

> **Nota historica (v1.1):** ate 04/05/2026, migrations do Fiscal eram aplicadas
> manualmente via `psql` por preocupacao de o Prisma reescrever schemas alheios.
> A partir de 05/05/2026, com `multiSchema` configurado e schemas isolados
> (`fiscal._prisma_migrations` rastreia so as do schema fiscal), o init job
> `fiscal-migrate` aplica de forma segura. O fluxo manual via `psql` continua
> disponivel como fallback (rodar `prisma migrate deploy` localmente, exportar
> SQL, aplicar via psql) caso necessario em incidente especifico.

### 9.4. Flags de producao obrigatorias (`.env`)

```bash
# Obrigatorias para o Modulo Fiscal em PRODUCAO
FISCAL_SEFAZ_AMBIENTE=PRODUCAO                  # ou HOMOLOGACAO para homol
FISCAL_SEFAZ_CA_AUTO_REFRESH=true               # auto-refresh diario da cadeia ICP-Brasil
FISCAL_SEFAZ_TLS_STRICT=true                    # aborta boot se cadeia ICP-Brasil ausente
FISCAL_PROTHEUS_MOCK=false                      # ATIVA chamadas reais ao Protheus (apos publicacao)
FISCAL_CNPJ_CONSULENTE=25834847000100           # CNPJ completo da Capul (14 digitos, sem mascara)
FISCAL_FALLBACK_EMAIL=ti@capul.com.br           # destinatario se nenhum GESTOR_FISCAL estiver ativo

# SMTP (para alertas do limite diario 80%/90%/100% + digest de cruzamento)
FISCAL_SMTP_HOST=smtp.office365.com
FISCAL_SMTP_PORT=587
FISCAL_SMTP_USER=alertas-fiscal@capul.com.br
FISCAL_SMTP_PASS=...                            # usar App Password / SMTP AUTH dedicado
FISCAL_SMTP_FROM=Plataforma Fiscal <alertas-fiscal@capul.com.br>

# CORS (ajustar ao dominio real)
CORS_ORIGINS=https://fiscal.capul.com.br
```

### 9.5. Tabelas criadas no schema `fiscal`

| Tabela | Proposito |
|---|---|
| `documento_consulta` | Log de consultas NF-e/CT-e por chave+filial |
| `documento_xml_index` | Indice leve de XMLs (hash SHA256) |
| `documento_evento` | Timeline de eventos SEFAZ (autorizacao, CC-e, cancelamento, etc.) |
| `cadastro_contribuinte` | Foto SEFAZ de cada CNPJ+UF consultado (CCC) |
| `cadastro_historico` | Trilha de mudancas de situacao cadastral |
| `cadastro_divergencia` | Discrepancias Protheus ↔ SEFAZ (aberta/resolvida/ignorada) |
| `cadastro_sincronizacao` | Execucoes do cruzamento (MOVIMENTO_MEIO_DIA, MANHA_SEGUINTE, MANUAL, PONTUAL) |
| `protheus_snapshot` | Foto SA1010/SA2010 no momento da sincronizacao |
| `alerta_enviado` | Log de digests enviados por e-mail |
| `certificado` | Ciclo de vida do certificado A1 (upload, ativo, vencer) |
| `ambiente_config` | Config global (ambiente PROD/HOM, pauseSync, crons 12:00/06:00) |
| `uf_circuit_state` | Circuit breaker por UF (FECHADO/MEIO_ABERTO/ABERTO) |
| `limite_diario` | Singleton id=1 — contador diario global, alertas, corte automatico |
| `audit_log` | Auditoria de acoes (usuario, acao, recurso, IP, UA) |

### 9.6. Smoke test completo de producao

```bash
# 1. Health geral
curl -sk https://PRODUCAO/api/v1/fiscal/health | jq .

# 2. Login admin
TOKEN=$(curl -sk -X POST https://PRODUCAO/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","senha":"SENHA_REAL"}' | jq -r .accessToken)

# 3. Ambiente ativo
curl -sk -H "Authorization: Bearer $TOKEN" https://PRODUCAO/api/v1/fiscal/ambiente | jq .
# Esperado: ambienteAtivo=PRODUCAO, cronMovimentoMeioDia, cronMovimentoManhaSeguinte

# 4. Certificado A1 ativo
curl -sk -H "Authorization: Bearer $TOKEN" https://PRODUCAO/api/v1/fiscal/certificado | jq '.[0] | {cnpj, validoAte, diasParaVencer, ativo}'
# Esperado: diasParaVencer > 30, ativo=true

# 5. Consulta cadastral real (testa todo o stack: CCC + Receita + Protheus)
curl -sk -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  https://PRODUCAO/api/v1/fiscal/cadastro/consulta \
  -d '{"cnpj":"CNPJ_CLIENTE_REAL","uf":"MG"}' | jq '{cnpj, situacao, jaCadastradoNoProtheus}'

# 6. Limite diario (contador deve ter incrementado depois do passo 5)
curl -sk -H "Authorization: Bearer $TOKEN" https://PRODUCAO/api/v1/fiscal/operacao/limites | jq .

# 7. Scheduler registrado
curl -sk -H "Authorization: Bearer $TOKEN" https://PRODUCAO/api/v1/fiscal/cruzamento/scheduler/status | jq .
# Esperado: meioDia com cron "0 12 * * *" e proxima=hoje 12:00 BRT

# 8. Circuit breaker (deve estar vazio no inicio)
curl -sk -H "Authorization: Bearer $TOKEN" https://PRODUCAO/api/v1/fiscal/cruzamento/circuit-breaker | jq .
```

### 9.7. Checklist de go-live do Fiscal

- [ ] `core.integracoes_api` tem registro `PROTHEUS` com `authConfig` preenchido
- [ ] `core.integracoes_api_endpoints` tem 6 endpoints do fiscal (cadastroFiscal, eventosNfe, grvXML × PROD/HOM)
- [ ] Schema `fiscal` criado e migrations aplicadas
- [ ] `fiscal.limite_diario` com singleton id=1
- [ ] Certificado A1 **valido** (>30 dias para vencer) uploaded e ativado via Configurador
- [ ] Cadeia ICP-Brasil carregada (149 certificados) — conferir em `/api/v1/fiscal/health` campo `sefazTls.ok=true`
- [ ] SMTP configurado e testado (envio de e-mail de teste)
- [ ] `FISCAL_PROTHEUS_MOCK=false` no `.env` de producao
- [ ] `FISCAL_SEFAZ_AMBIENTE=PRODUCAO`
- [ ] `FISCAL_CNPJ_CONSULENTE` correto
- [ ] Roles atribuidas: pelo menos 1 GESTOR_FISCAL + ADMIN_TI ativos em `core.usuarios_modulos`
- [ ] Smoke test completo (Secao 9.6) passou
- [ ] Scheduler registrado com crons 12:00/06:00 BRT (ver `/cruzamento/scheduler/status`)
- [ ] Consulta cadastral real retorna dados do SEFAZ + Receita + Protheus
- [ ] Tela `/operacao/limites` acessivel e widget de consumo funciona

### 9.8. Pendencias conhecidas do Fiscal em producao (Onda 2)

Quando a equipe Protheus publicar os endpoints `/eventosNfe` e `/grvXML` em producao:

1. Cadastrar endpoints atualizados em `core.integracoes_api_endpoints` (se URLs mudaram)
2. Aplicar migration da Onda 2 (quando existir)
3. Executar refactor do fluxo NF-e/CT-e para SZR → SPED156 → SEFAZ via Protheus
4. Atualizar `docs/FLUXO_CONSULTA_NFE.md` e `docs/FLUXO_CONSULTA_CTE.md`

Ver: `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` para a lista formal de pendencias com a equipe Protheus.

---

**Ultima Atualizacao**: 05/05/2026
**Versao**: 1.2

## Changelog

- **1.2 (05/05/2026)**: Init jobs `*-migrate` aplicam Prisma migrations no
  `docker compose up -d`. Fluxo manual via `psql` removido como caminho
  primario; mantido como fallback. Pos-incidente deploy 04/05 (5 migrations
  pendentes silenciosas no gestao-ti porque o `CMD` ia direto para
  `node dist/main.js`). Tabela "Arquitetura de Migrations" reorganizada
  com coluna "Aplicacao" deixando claro que cada modulo Prisma agora tem
  init job. Inventario continua manual ate ter init equivalente.
- **1.1 (19/04/2026)**: Inclusao do Modulo Fiscal — Onda 1 do Plano v2.0.
