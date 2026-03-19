# Roteiro de Migracao para Producao — Capul Platform

**Versao**: 1.0
**Data**: 19/03/2026
**Objetivo**: Procedimento padrao para deploy e atualizacoes em producao

---

## Arquitetura de Migrations

| Modulo | Estrategia | Ferramenta | Controle |
|--------|-----------|------------|----------|
| **Auth Gateway** | Prisma Migrations | `prisma migrate deploy` | Tabela `core._prisma_migrations` |
| **Gestao TI** | Prisma Migrations | `prisma migrate deploy` | Tabela `gestao_ti._prisma_migrations` |
| **Inventario** | SQL Manual | `inventario/database/migrate.sh` | Tabela `inventario.schema_migrations` |

**Ordem obrigatoria**: Auth Gateway → Gestao TI → Inventario (por dependencia de FK cross-schema)

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

# 3. Subir containers
docker compose up -d

# 4. Aguardar PostgreSQL ficar healthy
docker compose exec postgres pg_isready -U $DB_USER

# 5. Executar migrations + seeds
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
docker compose up -d

# 5. Executar migrations pendentes (sem seed)
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

### Backup (executar ANTES de qualquer atualizacao)

```bash
# Backup completo do banco
docker compose exec postgres pg_dump -U $DB_USER capul_platform \
  --format=custom --compress=9 \
  -f /var/lib/postgresql/data/backup_$(date +%Y%m%d_%H%M%S).dump

# Copiar para fora do container
docker cp capul-db:/var/lib/postgresql/data/backup_*.dump ./backups/
```

### Restauracao (em caso de falha)

```bash
# Parar todos os servicos
docker compose stop

# Restaurar backup
docker compose exec postgres pg_restore -U $DB_USER -d capul_platform \
  --clean --if-exists \
  /var/lib/postgresql/data/backup_YYYYMMDD_HHMMSS.dump

# Subir servicos
docker compose up -d
```

---

## 5. TABELA DE REFERENCIA — COMANDOS

| Acao | Comando |
|------|---------|
| **Primeiro deploy** | `bash scripts/migrate.sh` |
| **Atualizacao** | `bash scripts/migrate.sh --skip-seed` |
| **Baseline inventario** | `bash scripts/migrate.sh --baseline-inventario` |
| **Status Auth GW** | `docker compose exec auth-gateway npx prisma migrate status` |
| **Status Gestao TI** | `docker compose exec gestao-ti-backend npx prisma migrate status` |
| **Status Inventario** | `docker compose exec postgres psql -U $DB_USER -d capul_platform -c "SELECT * FROM inventario.schema_migrations ORDER BY id"` |
| **Backup** | `docker compose exec postgres pg_dump -U $DB_USER capul_platform -Fc -f /tmp/backup.dump` |
| **Logs de erro** | `docker compose logs --tail 20 auth-gateway gestao-ti-backend` |
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
                                          8. bash scripts/migrate.sh --skip-seed
                                             (aplica apenas migrations pendentes)
                                          9. Verificar
```

**Regra de ouro**: NUNCA usar `prisma migrate dev` ou `prisma db push` em producao.
Sempre usar `prisma migrate deploy` (aplica migrations existentes, nunca gera novas).

---

**Ultima Atualizacao**: 19/03/2026
**Versao**: 1.0
