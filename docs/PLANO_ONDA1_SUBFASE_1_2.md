# Plano — Onda 1 — Sub-fase 1.2

**Sub-fase:** 1.2 — Refactor `core.permissoes_modulo` (escopo departamental)
**Branch:** `feat/workspace-foundation` (continuação)
**Esforço estimado:** ~3-5h (escopo menor que 1.1 — 1 tabela, 2 call sites)
**Status:** ✅ **CONCLUÍDA em 23/05/2026** — ver §15 (Resultado) para detalhes.

> Documento de referência: `Workspace_Multi_Departamento_Design.md` v1.2 §4.2.1 + §6.2 Etapa 3 + D36 (Q5 fechada).
> Pré-requisito: Sub-fase 1.1 concluída (commit `50624df`).

---

## 1. Escopo

### Entra
- Adicionar `departamento_id TEXT NOT NULL` em `core.permissoes_modulo`
- Backfill T.I. nas 46 permissões existentes
- DROP UNIQUE antigo `(usuario_id, modulo_id)`
- ADD UNIQUE novo `(usuario_id, modulo_id, departamento_id)` — habilita multi-perfil
- FK + INDEX
- Atualizar schema Prisma do **auth-gateway** com a relação
- Adicionar reversa `permissoesModulo` em `core.Departamento` (auth-gateway)
- Helper `getDefaultDepartamentoId` no auth-gateway (espelhando o do Gestão TI)
- Atualizar 2 call sites: `src/usuario/usuario.service.ts:265` (upsert) e `prisma/seed.ts:250` (create)

### NÃO entra
- ❌ Flag `is_super_admin` (D36 — Q5 fechada: ADMIN é global via role)
- ❌ Mudança em JWT payload (Sub-fase 1.4)
- ❌ Mudança em guards de RBAC (Sub-fase 1.5)
- ❌ UI Configurador multi-perfil (Sub-fase 1.6)
- ❌ Atualização do schema do Gestão TI (já consome `core` read-only)

---

## 2. Tabela afetada (1)

| # | Tabela | Mudança |
|---|---|---|
| 1 | `core.permissoes_modulo` | ADD `departamento_id` NOT NULL + nova UNIQUE composta + FK + INDEX |

**Dados atuais em DEV (46 permissões):**
- 15 em Configurador
- 24 em Inventário
- 4 em Gestão TI
- 3 em Fiscal

Backfill: todas vão pra depto T.I. (preserva semantica atual — uma permissão por (user, módulo) sem nuance departamental).

---

## 3. SQL da migration (estrutura)

Nome: `<timestamp>_add_departamento_id_permissoes_modulo`

```sql
-- ============================================================
-- Pré-flight (D36/P3 — mesmo padrão da sub-fase 1.1)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.departamentos WHERE nome ILIKE 'Tecnologia%') THEN
    RAISE EXCEPTION 'Migration abortada: depto "Tecnologia da Informacao" nao encontrado.';
  END IF;
END $$;

-- ============================================================
-- 1. ADD COLUMN nullable
-- ============================================================
ALTER TABLE core.permissoes_modulo ADD COLUMN departamento_id TEXT;

-- ============================================================
-- 2. Backfill — todas as permissões existentes recebem T.I.
-- ============================================================
UPDATE core.permissoes_modulo
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

-- ============================================================
-- 3. NOT NULL + FK + INDEX
-- ============================================================
ALTER TABLE core.permissoes_modulo
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT permissoes_modulo_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX permissoes_modulo_departamento_id_idx ON core.permissoes_modulo(departamento_id);

-- ============================================================
-- 4. UNIQUE swap — habilita multi-perfil (user × modulo × depto)
-- ============================================================
ALTER TABLE core.permissoes_modulo
  DROP CONSTRAINT permissoes_modulo_usuario_id_modulo_id_key,
  ADD CONSTRAINT permissoes_modulo_usuario_id_modulo_id_departamento_id_key
    UNIQUE (usuario_id, modulo_id, departamento_id);
```

**Atenção pré-execução:** confirmar nome real da constraint UNIQUE antiga (Prisma usa convenção `<table>_<col1>_<col2>_key`). Conferir via `\d core.permissoes_modulo` antes de escrever.

---

## 4. Mudanças no `auth-gateway/prisma/schema.prisma`

### 4.1 Model PermissaoModulo (linha 240)
```prisma
model PermissaoModulo {
  id        String      @id @default(uuid())
  status    StatusGeral @default(ATIVO)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  usuarioId    String        @map("usuario_id")
  usuario      Usuario       @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  moduloId     String        @map("modulo_id")
  modulo       ModuloSistema @relation(fields: [moduloId], references: [id])
  roleModuloId String        @map("role_modulo_id")
  roleModulo   RoleModulo    @relation(fields: [roleModuloId], references: [id])

  // NOVO — Workspace Multi-Departamento (Onda 1 Sub-fase 1.2 — D36/P8)
  departamentoId String       @map("departamento_id")
  departamento   Departamento @relation(fields: [departamentoId], references: [id])

  // NOTA: NÃO criar coluna is_super_admin (D36/Q5 fechada). ADMIN é global
  // por design — guard backend detecta role === 'ADMIN' e pula filtros depto.

  @@unique([usuarioId, moduloId, departamentoId])  // MUDANÇA: era (usuarioId, moduloId)
  @@index([departamentoId])
  @@index([usuarioId])
  @@map("permissoes_modulo")
  @@schema("core")
}
```

### 4.2 Model Departamento — adicionar reversa
```prisma
model Departamento {
  // ... existente

  permissoesModulo PermissaoModulo[]  // NOVO
}
```

---

## 5. Helper `getDefaultDepartamentoId` no auth-gateway

Criar `auth-gateway/src/common/helpers/default-departamento.helper.ts` espelhando o do Gestão TI. Mesmo TODO Sub-fase 1.5.

---

## 6. Call sites a atualizar (2)

### 6.1 `auth-gateway/src/usuario/usuario.service.ts:265`
**Atual:** `upsert` com `where: { usuarioId_moduloId: { usuarioId, moduloId } }`

**Alvo:** `upsert` com `where: { usuarioId_moduloId_departamentoId: { usuarioId, moduloId, departamentoId } }`. Em `create` e `update`, incluir `departamentoId`. Pega via helper.

**Atenção:** o DTO `AtribuirPermissaoDto` pode precisar de campo `departamentoId` opcional (default T.I.). Decidir caso a caso na hora.

### 6.2 `auth-gateway/prisma/seed.ts:250`
**Atual:** `create({ data: { usuarioId, moduloId, roleModuloId } })`

**Alvo:** incluir `departamentoId` via helper.

---

## 7. Procedimento operacional

1. Editar schema (§4) e helper (§5). `prisma validate`. **Commit (PAUSA #1)**.
2. Escrever migration manual em `auth-gateway/prisma/migrations/<ts>_add_departamento_id_permissoes_modulo/migration.sql`
3. Atualizar 2 call sites (§6).
4. Rebuild: `docker compose build auth-migrate auth-gateway`
5. Restart: `docker compose up -d --build auth-migrate auth-gateway`
6. Verificar logs do auth-migrate confirmam aplicação
7. **Smoke obrigatório:** `POST /auth/login` com usuário existente — TEM que retornar 200 com JWT válido. Esse é o teste crítico (auth-gateway é coração da plataforma).
8. Demais smoke: migrate status, NULL=0, constraint UNIQUE nova existe
9. **PAUSA #2** com Clenio
10. Commit final + atualizar plano §15 + atualizar memória

---

## 8. Smoke tests

| # | Check | Esperado |
|---|---|---|
| 1 | `prisma migrate status` (auth-gateway) | "Database schema is up to date!" |
| 2 | `prisma validate` (auth-gateway) | OK |
| 3 | `COUNT(*) WHERE departamento_id IS NULL` em permissoes_modulo | **0** |
| 4 | `COUNT(DISTINCT departamento_id)` em permissoes_modulo | **1** (T.I.) |
| 5 | Constraint UNIQUE antiga não existe mais | `\d permissoes_modulo` confirma |
| 6 | Constraint UNIQUE nova existe | idem |
| 7 | **`POST /auth/login` retorna 200 + JWT** | ⚠️ **CRÍTICO** — qualquer falha aqui = rollback imediato |
| 8 | auth-gateway up & healthy | ✅ |
| 9 | Gestão TI ainda consegue validar JWT do auth-gateway | smoke endpoint GET retorna 200 (com JWT) ou 401 (sem) |

---

## 9. Rollback plan

Se smoke #7 (login) falhar:

```bash
# Reverter container pra imagem anterior
docker compose down auth-gateway auth-migrate
docker tag <imagem_anterior> capul-platform-auth-gateway:latest
docker compose up -d auth-gateway

# Reverter DB:
docker compose exec postgres psql -U capul_user -d capul_platform <<EOF
ALTER TABLE core.permissoes_modulo DROP CONSTRAINT permissoes_modulo_usuario_id_modulo_id_departamento_id_key;
ALTER TABLE core.permissoes_modulo ADD CONSTRAINT permissoes_modulo_usuario_id_modulo_id_key UNIQUE (usuario_id, modulo_id);
DROP INDEX core.permissoes_modulo_departamento_id_idx;
ALTER TABLE core.permissoes_modulo DROP CONSTRAINT permissoes_modulo_departamento_id_fkey;
ALTER TABLE core.permissoes_modulo DROP COLUMN departamento_id;
DELETE FROM core._prisma_migrations WHERE migration_name LIKE '%add_departamento_id_permissoes_modulo';
EOF

# Reverter schema.prisma via git
git checkout HEAD~ auth-gateway/prisma/schema.prisma
```

(Em PROD futuro: pg_dump pré-deploy obrigatório.)

---

## 10. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Login quebra após migration | Baixa | **CRÍTICO** | Smoke #7 obrigatório antes de commit |
| Constraint UNIQUE antiga com nome diferente do esperado | Média | Médio | Conferir `\d permissoes_modulo` antes de escrever migration |
| Gestão TI deixa de validar JWT | Baixa | Alto | JWT secret não muda; payload ainda compatível (Sub-fase 1.4 muda payload) |
| Upsert no usuario.service.ts diverge no merge final | Baixa | Baixo | Refactor explícito + teste |

---

## 11. Critério de "feito"

- [ ] Schema atualizado + `prisma validate` OK
- [ ] Migration criada e aplicada em DEV
- [ ] Smoke #7 (login) passou
- [ ] Demais smoke (8 de 9) passaram
- [ ] 2 call sites atualizados (usuario.service.ts + seed.ts)
- [ ] Helper criado no auth-gateway
- [ ] 3-4 commits criados (sem push)
- [ ] Plano atualizado com §15 Resultado
- [ ] Memória atualizada

---

## 12. Próximas sub-fases

- **Sub-fase 1.3** — `core.departamento_funcionalidades` + enum FuncionalidadeWorkspace
- **Sub-fase 1.4** — JWT payload novo (auth-gateway)
- **Sub-fase 1.5** — RBAC guards backend (substitui helper temporário)

---

_Plano criado por Claude em 23/05/2026 manhã. Continuação da sub-fase 1.1 (commit `50624df`). Branch `feat/workspace-foundation`._

---

## 15. Resultado (execução em 23/05/2026)

**Status:** ✅ **CONCLUÍDA**

### 15.1 Commits aplicados

| # | Hash | Conteúdo |
|---|---|---|
| 1 | `6058037` | Plano sub-fase 1.2 (este doc — versão inicial) |
| 2 | **`169c999`** | **Schema auth-gateway** — PermissaoModulo + reversa em Departamento |
| 3 | **`626c97f`** | **Migration + helper + 4 fixes** (3 em usuario.service.ts + 1 em seed.ts) |
| 4 | (este commit) | **Fechamento** — plano atualizado com §15 |

### 15.2 Smoke tests — todos passaram

| # | Check | Resultado |
|---|---|---|
| 1 | `prisma migrate status` (auth-gateway) | ✅ aplicada |
| 2 | `prisma validate` (auth-gateway) | ✅ OK |
| 3 | `COUNT(*) WHERE departamento_id IS NULL` em permissoes_modulo | ✅ **0** (46 permissões backfilled) |
| 4 | `COUNT(DISTINCT departamento_id)` | ✅ **1** (todas T.I.) |
| 5 | Constraint UNIQUE antiga não existe mais | ✅ confirmado via `pg_indexes` |
| 6 | UNIQUE nova existe | ✅ `permissoes_modulo_usuario_id_modulo_id_departamento_id_key` |
| 7 | **🔴 CRÍTICO — `POST /auth/login`** | ✅ **HTTP 200 + JWT válido** com payload completo (sub, username, email, departamentoId, modulos[]) |
| 8 | auth-gateway up & healthy | ✅ |
| 9 | Gestão TI continua validando JWT do auth-gateway | ✅ (JWT_SECRET não mudou; payload retrocompatível) |

### 15.3 Achados durante a execução (não previstos no plano)

| # | Achado | Mitigação aplicada | Documentado em |
|---|---|---|---|
| 1 | UNIQUE em (usuario_id, modulo_id) era **UNIQUE INDEX**, não CONSTRAINT formal | Primeira execução falhou com P3018 ("constraint not found"). Corrigido pra `DROP INDEX` + `CREATE UNIQUE INDEX`. Migration marcada `rolled-back` + re-aplicada. | commit `626c97f` |
| 2 | `revogarPermissao` em usuario.service.ts:295 usava o composite key antigo | Trocado `findUnique({ usuarioId_moduloId })` por `findFirst({ usuarioId, moduloId })`. TODO Sub-fase 1.6 registrado pra evoluir quando multi-perfil real chegar. | usuario.service.ts |
| 3 | Adicional call site em `createUsuario` (linha 169) — criação inline de permissões | DTO da criação de usuário ganha `departamentoId` via helper (fallback dto.departamentoId do próprio user). | usuario.service.ts |
| 4 | Endpoint de login espera `login` (não `username`) | Smoke test ajustado | sessão de execução |

### 15.4 Esforço real vs estimado

- **Estimado:** ~3-5h
- **Real:** ~2h efetivas (incluindo investigação do DROP INDEX vs DROP CONSTRAINT)
- **Diferença:** abaixo do estimado porque escopo era menor e o padrão da 1.1 acelerou a execução

### 15.5 Pendências técnicas registradas

- [ ] **Sub-fase 1.5/1.6** — trocar `getDefaultDepartamentoId` por `dto.departamentoId` (Configurador multi-perfil) ou `currentUser.departamentoId` (JWT contexto). Aplica-se aos 4 call sites + helper.
- [ ] **Sub-fase 1.6** — `revogarPermissao` deve aceitar `departamentoId` como parâmetro pra revogar permissão específica em depto específico (multi-perfil real).
- [ ] **Padrão pra sub-fases futuras** — todo DROP de UNIQUE Prisma-gerado precisa ser `DROP INDEX` (não `DROP CONSTRAINT`). Vide commit `626c97f` ou memória dedicada.

### 15.6 Próximo passo — Sub-fase 1.3

Criar `core.departamento_funcionalidades` + enum `FuncionalidadeWorkspace`:
- Tabela nova no auth-gateway (12 valores no enum: CHAMADO, PROJETO, OS, EQUIPE, CONTRATO, NOTA_FISCAL, SOFTWARE, LICENCA, ATIVO, PARADA, INDICADOR_OPERACIONAL, INDICADOR_ESTRATEGICO)
- Seed inicial: T.I. com todas as 12 ativas; Fiscal com CHAMADO + EQUIPE + INDICADOR_OPERACIONAL; Controladoria idem com PROJETO; demais sem nada
- Esforço estimado: ~6h (doc-mestre §7.1 lote 1.3)
- Pode ser executado imediatamente após esta sub-fase
