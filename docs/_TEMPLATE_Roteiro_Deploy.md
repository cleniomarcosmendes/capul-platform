# Template — Roteiro de Deploy (Capul Platform)

> Este é um TEMPLATE versionado, não um roteiro real. Cada deploy gera um arquivo
> `PlatformCapul_YYYYMMDD_Roteiro_Deploy.md` em `C:\Arquivos-de-projeto\` partindo
> deste template + estado atual do código (não copiar do roteiro anterior).

## Como usar

1. Copiar este arquivo para `C:\Arquivos-de-projeto\PlatformCapul_<DATA>_Roteiro_Deploy.md`
2. Substituir `{{...}}` por valores reais do deploy
3. **Revisar cada seção** contra `git diff <commit_servidor>..HEAD --stat` — não pular nenhum arquivo
4. **Aplicar checklist final** antes de marcar como pronto pro Douglas (ver Seção 10)
5. Master `PlatformCapul_Roteiro_Completo.md` (DR/zero) NÃO é alterado por este fluxo

## Convenção

- Doc único por deploy (não há mais Consolidado/Incremental separados — decisão 27/04/2026)
- Master `PlatformCapul_Roteiro_Completo.md` continua separado (DR/zero, atualizado eventualmente)
- Histórico de deploys preservado em `C:\Arquivos-de-projeto\` por data
- Destinatário fixo: Douglas — Infra (172.16.0.203, Ubuntu 24.04)

---

# Roteiro de Deploy — {{DATA}}

> **Destinatário:** Douglas (Infra — 172.16.0.203)
> **Ponto base:** commit `{{COMMIT_BASE}}` ({{DESCRICAO_BASE}})
> **Commit alvo:** `{{COMMIT_ALVO}}` (HEAD do `main`)
> **Delta:** {{N}} commits — {{X}} arquivos alterados, +{{INS}} / -{{DEL}}
> **Tempo estimado:** {{T}} minutos
> **Downtime:** {{DOWNTIME}}
> **Risco:** {{BAIXO|MÉDIO|ALTO}} — {{justificativa em 1 linha}}

---

## 1. Resumo executivo

| Tema | Tipo | Impacto |
|---|---|---|
| {{Mudança 1}} | feat \| fix \| chore | {{1 linha}} |
| {{Mudança 2}} | ... | ... |

**Pré-requisitos novos:** {{lista ou "nenhum"}}.
**Variáveis de ambiente novas:** {{lista ou "nenhuma"}}.
**Migrations novas:** {{quantidade}} ({{lista resumida}}).
**Endpoints novos/alterados:** {{quantidade ou "nenhum"}}.
**Telas frontend novas:** {{lista ou "nenhuma"}}.

---

## 2. Escopo técnico — arquivos por área

### 2.1 Migrations Prisma novas

| Arquivo | Ação |
|---|---|
| `{{caminho_migration}}` | `{{ALTER \| CREATE TABLE \| ADD COLUMN}}` |

### 2.2 Scripts SQL não-Prisma

(Listar TODO `.sql` que não é migration Prisma. Se nenhum, escrever "nenhum".)

### 2.3 Bootstrap scripts

(Se o deploy introduz módulo/schema novo, listar `<modulo>-schema-init.sql` + `seed-<modulo>-modulo.sql`. Se não, escrever "não aplicável".)

### 2.4 Dependências novas (npm/pip)

| Backend | Pacote | Versão | Motivo |
|---|---|---|---|
| `auth-gateway` | `nestjs-pino` | `^4.4.0` | logs JSON estruturados |
| ... | ... | ... | ... |

### 2.5 Configurações de container (docker-compose.yml, Dockerfiles)

(Mudanças de container — limites, healthchecks, USER non-root, log rotation, etc.)

### 2.6 Configuração nginx

(Headers, CSP, OCSP, redirects — só se mudou.)

### 2.7 Endpoints novos/alterados

| Método | Path | Auth | Módulo |
|---|---|---|---|
| `POST` | `/api/v1/...` | `OPERADOR_ENTRADA` | `fiscal` |

### 2.8 Telas frontend novas/alteradas

| Tela | Rota | Role mínima |
|---|---|---|
| `{{Nome}}` | `/configurador/...` | `ADMIN` |

### 2.9 Mudanças em roles/permissões

(Se algum endpoint subiu/desceu de role, listar. Se não, escrever "nenhuma mudança de role".)

---

## 3. Pré-requisitos OBRIGATÓRIOS

### 3.1 {{Pré-requisito 1}}

(Comandos para configurar — uma vez por servidor. Se não há novo pré-requisito, remover esta seção e marcar "nenhum pré-requisito novo" na Seção 1.)

### 3.2 Variáveis de ambiente novas (verificar `.env`)

```bash
# Adicionar ao .env se aplicável:
LOG_LEVEL=info
SMTP_HOST=...
```

---

## 4. PASSO 0 — Backup completo

```bash
cd /opt/capul-platform
sudo ./scripts/backup.sh full
```

**Esperado:**
- 4 arquivos em `/opt/capul-platform/backups/` com data de hoje
- ~3 minutos para concluir
- Saída final: `[BACKUP COMPLETO] Sucesso`

**Possíveis falhas:**
- `chave de criptografia não encontrada em /etc/capul-backup-key` → executar Pré-requisito 3.1 antes de prosseguir
- `pg_dump: server version mismatch` → confirmar PostgreSQL 16 no container (não amix com 15)
- `disk full` → liberar espaço; backup full ocupa ~500MB-2GB dependendo da idade

---

## 5. PASSO 0.5 — Diagnóstico do estado atual

Antes de aplicar qualquer mudança, validar o estado do banco. Cole estes SQLs no `psql`
e compare com o esperado.

```bash
docker compose exec postgres psql -U capul_user -d capul_platform
```

```sql
-- Schemas existentes
SELECT schema_name FROM information_schema.schemata
 WHERE schema_name IN ('core', 'fiscal', 'gestao_ti', 'inventario')
 ORDER BY schema_name;
-- Esperado: 4 linhas exatamente
```

**Esperado (4 linhas):**
```
core
fiscal
gestao_ti
inventario
```

**Possíveis falhas:**
- Menos de 4 linhas → schema ausente, **PARE** e investigue antes de prosseguir
- 5+ linhas → schemas extras (não-CAPUL) — anote e siga, mas avise o time depois

```sql
-- Migrations Prisma aplicadas (últimas 5)
SELECT migration_name FROM core."_prisma_migrations"
 ORDER BY finished_at DESC NULLS LAST LIMIT 5;
```

**Esperado (depende do deploy anterior):**
```
{{migration_anterior_n}}
{{migration_anterior_n_1}}
...
```

(Adicionar SQLs específicos pra cada migration nova deste deploy — confirmar que NÃO foram aplicadas ainda.)

---

## 6. Procedimento

### PASSO 1 — Pull do código

```bash
cd /opt/capul-platform
git fetch origin
git log --oneline HEAD..origin/main
git pull --ff-only origin main
git rev-parse HEAD
```

**Esperado:** o `git log --oneline HEAD..origin/main` lista os {{N}} commits novos. O `git rev-parse HEAD` retorna `{{COMMIT_ALVO}}`.

**Possíveis falhas:**
- `not possible to fast-forward` → working tree do servidor sujo. **PARE**, rode `git status` e investigue antes de qualquer reset.
- 0 commits listados → você já aplicou. Pule pra validação.

### PASSO 2 — Aplicar migrations Prisma

(Para CADA migration nova, comando + esperado + possíveis falhas. Não consolidar — explícito é mais seguro.)

#### 2.1 `{{nome_migration_1}}`

```bash
docker compose exec auth-gateway npx prisma migrate deploy --schema=./prisma/schema.prisma
```

**Esperado:**
```
Applying migration `{{nome_migration_1}}`
The following migration(s) have been applied:
  └─ {{nome_migration_1}}/
    └─ migration.sql
All migrations have been successfully applied.
```

**Validar:**
```sql
-- {{descrição da validação}}
SELECT ... FROM ...;
```

**Possíveis falhas:**
- `relation "X" already exists` → migration já aplicada antes (manualmente ou por engano). Verificar `_prisma_migrations` e `prisma migrate resolve`.
- `permission denied for schema X` → user `capul_user` sem grant. **PARE** e ajuste GRANTs antes de tentar de novo.

### PASSO 3 — Rebuild dos containers afetados

(Listar a sequência. Não rebuildar TODOS sem necessidade — só o que mudou. Estratégia rolling pra minimizar downtime.)

```bash
docker compose up -d --build {{lista_containers_em_ordem}}
docker compose ps | grep -E "{{containers_afetados}}"
```

**Esperado:** todos `(healthy)` em até 60s após restart.

**Possíveis falhas:**
- Container fica `(unhealthy)` permanente → ver logs: `docker compose logs --tail=100 <container>`
- Container `Exit 137` → OOM, ajustar `mem_limit` no compose ou investigar leak de memória
- `pino-pretty: command not found` → npm install não instalou as deps; rebuild com `--no-cache`

### PASSO 4 — {{outros passos específicos do deploy}}

(Ex: configurar systemd timer, registrar cron, popular tabela de seed, etc.)

---

## 7. Validações pós-deploy

### 7.1 Validações SQL

```sql
-- Confirmar que migration nova foi aplicada
SELECT EXISTS(SELECT 1 FROM information_schema.{{tables|columns}}
 WHERE {{condição}});
-- Esperado: true
```

### 7.2 Validações HTTP (curl)

```bash
# Login admin
curl -sk -X POST https://localhost/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","senha":"<SENHA>"}' | jq .accessToken

# Health endpoints
curl -sk https://localhost/api/v1/health | jq .
curl -sk https://localhost/api/v1/gestao-ti/health | jq .
curl -sk https://localhost/api/v1/fiscal/health | jq .
```

### 7.3 Validações de UI (browser, opcional mas recomendado)

(Lista de telas pra abrir e ações de smoke. Se possível com chave/CNPJ de teste real.)

---

## 8. Rollback

(Documentar passo-a-passo do rollback. Toda migration deve ter rollback definido — se for additive simples, basta voltar imagem; se for destrutiva, comando SQL pra reverter.)

### 8.1 Rollback do código

```bash
cd /opt/capul-platform
git reset --hard {{COMMIT_BASE}}
docker compose up -d --build {{containers_afetados}}
```

### 8.2 Rollback das migrations

| Migration | Estratégia | Reversível? |
|---|---|---|
| `{{nome_migration_1}}` | {{ALTER \| ADD COLUMN \| CREATE TABLE}} | {{Sim — ADD COLUMN é additive, basta voltar imagem; coluna fica órfã sem uso \| Não — drop manual}} |

### 8.3 Restaurar backup (último recurso)

```bash
sudo ./scripts/backup.sh restore /opt/capul-platform/backups/backup_full_<data>.tar.gz
```

---

## 9. Riscos identificados e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| {{R1}} | {{Baixa\|Média\|Alta}} | {{Baixo\|Médio\|Alto}} | {{como mitigar}} |

---

## 10. Checklist final — antes de marcar como pronto pro Douglas

Pós-incidente 19/04/2026 (memory `feedback_deploy_cenarios_iniciais.md`).
Marcar **todos** antes de enviar:

- [ ] Rodei `git diff <commit_servidor>..HEAD --stat` e **cada arquivo** está mencionado no documento (não apenas "modificado")
- [ ] Listei TODOS os `.sql` (Prisma **e** scripts manuais) em passos próprios
- [ ] Inclui PASSO 0.5 de diagnóstico se houver schema/módulo novo
- [ ] Toda saída esperada tem pelo menos 1 caso anômalo documentado com correção
- [ ] Se é primeiro deploy de um módulo, inclui o `<modulo>-schema-init.sql` além das incrementais
- [ ] Usuário admin continua acessando todos os módulos após aplicar (checar se seed-modulo novo é necessário)
- [ ] Rollback está documentado pra **cada** migration nova
- [ ] Pré-requisitos novos (chaves cripto, env vars, etc.) listados na Seção 3 com comandos prontos
- [ ] Saídas anômalas comuns documentadas em cada passo (não só caso feliz)
- [ ] Containers afetados estão na sequência de rebuild (Seção 6 PASSO 3)

---

## 11. Anotações de auditoria

| Item | Responsável | Quando |
|---|---|---|
| Roteiro gerado | Plataforma (Claude Code) | {{DATA_GERACAO}} |
| Revisão pelo Clenio | Clenio | {{DATA_REVISAO}} |
| Aplicado em produção | Douglas | (preencher após aplicação) |
| Validação pós-deploy | Douglas + Clenio | (preencher após aplicação) |
