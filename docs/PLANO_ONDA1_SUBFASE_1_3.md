# Plano — Onda 1 — Sub-fase 1.3

**Sub-fase:** 1.3 — `core.departamento_funcionalidades` + enum `FuncionalidadeWorkspace`
**Branch:** `feat/workspace-foundation` (continuação)
**Esforço estimado:** ~3-4h (escopo: tabela nova + seed, sem call sites a atualizar)
**Status:** ✅ **CONCLUÍDA em 23/05/2026** — ver §15 (Resultado).

> Documento de referência: `Workspace_Multi_Departamento_Design.md` v1.2 §4.2.12 + D32.
> Pré-requisitos: Sub-fases 1.1 (`50624df`) e 1.2 (`dfb362b`) concluídas.

---

## 1. Escopo

### Entra
- Enum `FuncionalidadeWorkspace` (12 valores) no schema `core` do auth-gateway
- Tabela nova `core.departamento_funcionalidades` com campos de auditoria (quem ativou/desativou)
- UNIQUE composta `(departamento_id, funcionalidade)` — impede duplicata
- INDEX `departamento_id`
- Reversa `funcionalidades` em `Departamento`
- Seed inicial: T.I. recebe TODAS as 12 funcionalidades ativas

### NÃO entra
- ❌ Fiscal/Controladoria/outros deptos no seed (não existem em DEV — quando forem criados, configurar via UI na Sub-fase 1.6)
- ❌ UI Configurador pra ativar/desativar funcionalidades (Sub-fase 1.6)
- ❌ Lógica de filtragem por funcionalidade no backend (Sub-fase 1.5 — guards)
- ❌ Sidebar dinâmico no frontend (Sub-fase 1.6/Onda 2)
- ❌ JWT payload com `funcionalidades[]` (Sub-fase 1.4)

---

## 2. Enum FuncionalidadeWorkspace (12 valores — D32/§4.2.12)

```
CHAMADO
PROJETO
OS
EQUIPE
CONTRATO
NOTA_FISCAL
SOFTWARE
LICENCA
ATIVO
PARADA
INDICADOR_OPERACIONAL
INDICADOR_ESTRATEGICO
```

Categorias:
- **Operacionais (10):** CHAMADO, PROJETO, OS, EQUIPE, CONTRATO, NOTA_FISCAL, SOFTWARE, LICENCA, ATIVO, PARADA
- **Indicadores (2):** INDICADOR_OPERACIONAL, INDICADOR_ESTRATEGICO (D33/D43)

---

## 3. Schema (auth-gateway/prisma/schema.prisma)

### 3.1 Enum
```prisma
enum FuncionalidadeWorkspace {
  CHAMADO
  PROJETO
  OS
  EQUIPE
  CONTRATO
  NOTA_FISCAL
  SOFTWARE
  LICENCA
  ATIVO
  PARADA
  INDICADOR_OPERACIONAL
  INDICADOR_ESTRATEGICO

  @@schema("core")
}
```

### 3.2 Model DepartamentoFuncionalidade
```prisma
model DepartamentoFuncionalidade {
  id              String                  @id @default(uuid())
  departamentoId  String                  @map("departamento_id")
  departamento    Departamento            @relation(fields: [departamentoId], references: [id], onDelete: Cascade)
  funcionalidade  FuncionalidadeWorkspace
  ativo           Boolean                 @default(true)
  ativadoEm       DateTime                @default(now()) @map("ativado_em")
  ativadoPor      String                  @map("ativado_por")
  desativadoEm    DateTime?               @map("desativado_em")
  desativadoPor   String?                 @map("desativado_por")

  @@unique([departamentoId, funcionalidade])
  @@index([departamentoId])
  @@map("departamento_funcionalidades")
  @@schema("core")
}
```

### 3.3 Reversa em Departamento
```prisma
model Departamento {
  // ... existente
  funcionalidades DepartamentoFuncionalidade[]  // NOVO
}
```

---

## 4. Migration SQL (estrutura)

Nome: `<timestamp>_add_departamento_funcionalidades`

```sql
-- Pré-flight
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.departamentos WHERE nome ILIKE 'Tecnologia%') THEN
    RAISE EXCEPTION 'Migration abortada: depto T.I. nao encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.usuarios WHERE username = 'admin') THEN
    RAISE EXCEPTION 'Migration abortada: usuario admin nao encontrado (necessario para ativado_por)';
  END IF;
END $$;

-- Enum
CREATE TYPE core."FuncionalidadeWorkspace" AS ENUM (
  'CHAMADO', 'PROJETO', 'OS', 'EQUIPE', 'CONTRATO', 'NOTA_FISCAL',
  'SOFTWARE', 'LICENCA', 'ATIVO', 'PARADA',
  'INDICADOR_OPERACIONAL', 'INDICADOR_ESTRATEGICO'
);

-- Tabela
CREATE TABLE core.departamento_funcionalidades (
  id              TEXT PRIMARY KEY,
  departamento_id TEXT NOT NULL,
  funcionalidade  core."FuncionalidadeWorkspace" NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ativado_em      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ativado_por     TEXT NOT NULL,
  desativado_em   TIMESTAMP(3),
  desativado_por  TEXT,
  CONSTRAINT departamento_funcionalidades_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX departamento_funcionalidades_departamento_id_funcionalidade_key
  ON core.departamento_funcionalidades (departamento_id, funcionalidade);

CREATE INDEX departamento_funcionalidades_departamento_id_idx
  ON core.departamento_funcionalidades (departamento_id);

-- Seed inicial: T.I. recebe TODAS as 12 funcionalidades ativas (status quo)
INSERT INTO core.departamento_funcionalidades
  (id, departamento_id, funcionalidade, ativo, ativado_por)
SELECT gen_random_uuid()::text,
       d.id,
       f::core."FuncionalidadeWorkspace",
       true,
       (SELECT id FROM core.usuarios WHERE username = 'admin' LIMIT 1)
  FROM core.departamentos d,
       unnest(ARRAY[
         'CHAMADO','PROJETO','OS','EQUIPE','CONTRATO','NOTA_FISCAL',
         'SOFTWARE','LICENCA','ATIVO','PARADA',
         'INDICADOR_OPERACIONAL','INDICADOR_ESTRATEGICO'
       ]) AS f
 WHERE d.nome ILIKE 'Tecnologia%';

-- (Fiscal e Controladoria não existem em DEV. Quando forem cadastrados,
-- ADMIN ativa via UI Configurador na Sub-fase 1.6.)
```

---

## 5. Smoke tests

| # | Check | Esperado |
|---|---|---|
| 1 | `prisma migrate status` (auth-gateway) | aplicada |
| 2 | `prisma validate` (auth-gateway) | OK |
| 3 | Tabela existe | `\d core.departamento_funcionalidades` retorna estrutura |
| 4 | Enum existe | `\dT core."FuncionalidadeWorkspace"` retorna 12 valores |
| 5 | T.I. tem 12 funcionalidades ativas | `SELECT COUNT(*) FROM core.departamento_funcionalidades WHERE departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%') AND ativo = true` retorna **12** |
| 6 | Demais deptos têm 0 | `SELECT COUNT(*) FROM core.departamento_funcionalidades WHERE departamento_id != (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%')` retorna **0** |
| 7 | UNIQUE composta funciona | Tentar inserir duplicata deve falhar com 23505 |
| 8 | auth-gateway up & healthy | ✅ |
| 9 | LOGIN continua funcional | `POST /auth/login` retorna 200 + JWT |

---

## 6. Procedimento operacional

1. Editar schema (§3). `prisma validate`. **Commit schema → PAUSA #1**.
2. Escrever migration manual em `auth-gateway/prisma/migrations/<ts>_add_departamento_funcionalidades/migration.sql`
3. Rebuild: `docker compose build auth-migrate`
4. Restart: `docker compose up -d --build auth-migrate auth-gateway`
5. Logs do auth-migrate confirmam aplicação
6. Smoke tests (§5)
7. **PAUSA #2** com Clenio
8. Commit final + plano §15 + atualizar memória

---

## 7. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `gen_random_uuid()` indisponível | Baixa | Médio | Está disponível em PG 13+ (Docker postgres:16 usa). Já é usado em outras migrations. |
| Usuário admin não existe | Baixa | Alto | Pré-flight aborta migração. Seed do auth-gateway garante admin. |
| Cast `text → enum` falha | Baixa | Alto | Padrão validado pelo Postgres. `'CHAMADO'::core."FuncionalidadeWorkspace"` é cast explícito. |
| Login quebra | Baixa | CRÍTICO | Migration não toca em permissoes_modulo nem usuarios; LOGIN não é afetado. Smoke #9 confirma. |

---

## 8. Rollback plan

```sql
DROP TABLE core.departamento_funcionalidades;
DROP TYPE core."FuncionalidadeWorkspace";
DELETE FROM core._prisma_migrations WHERE migration_name LIKE '%add_departamento_funcionalidades';
```

Reverter schema via `git checkout HEAD~ auth-gateway/prisma/schema.prisma`.

---

## 9. Critério de "feito"

- [ ] Schema atualizado + `prisma validate` OK
- [ ] Migration criada e aplicada em DEV
- [ ] T.I. tem 12 funcionalidades ativas
- [ ] LOGIN continua funcional
- [ ] 3 commits criados (schema + migration + fechamento)
- [ ] Plano atualizado com §15 Resultado
- [ ] Memória atualizada

---

## 10. Próximas sub-fases

- **Sub-fase 1.4** — JWT payload novo: `modulos: [{ codigo, departamentos: [{ id, role, funcionalidades }] }]`. Backend auth-gateway monta o array de funcionalidades juntando `permissoes_modulo` × `departamento_funcionalidades`.
- **Sub-fase 1.5** — RBAC guards backend filtram por depto + check de funcionalidade ativa.
- **Sub-fase 1.6** — UI Configurador: grid "depto × funcionalidade" pra ADMIN ativar/desativar; sidebar dinâmico no frontend.

---

_Plano criado por Claude em 23/05/2026 manhã. Continuação da sub-fase 1.2 (commit `dfb362b`). Branch `feat/workspace-foundation`._

---

## 15. Resultado (execução em 23/05/2026)

**Status:** ✅ **CONCLUÍDA**

### 15.1 Commits aplicados

| # | Hash | Conteúdo |
|---|---|---|
| 1 | `7633c9f` | Plano sub-fase 1.3 (este doc) |
| 2 | **`14b18c9`** | **Schema** — enum `FuncionalidadeWorkspace` + model `DepartamentoFuncionalidade` + reversa em Departamento |
| 3 | **`104009f`** | **Migration + seed** — tabela criada, T.I. com 12 funcionalidades ativas |
| 4 | (este commit) | **Fechamento** — plano §15 |

### 15.2 Smoke tests — todos passaram

| # | Check | Resultado |
|---|---|---|
| 1 | Enum `core.FuncionalidadeWorkspace` existe | ✅ 12 valores |
| 2 | Tabela `core.departamento_funcionalidades` existe | ✅ estrutura correta (8 cols + 3 indexes + FK CASCADE) |
| 3 | T.I. tem 12 funcionalidades ativas | ✅ **12** |
| 4 | Demais deptos com 0 | ✅ **0** |
| 5 | Listagem confirma todas as 12 funcionalidades | ✅ |
| 6 | **🔴 CRÍTICO — POST /auth/login** | ✅ **HTTP 200** |
| 7 | `prisma migrate status` | ✅ aplicada |
| 8 | `prisma validate` | ✅ OK |
| 9 | auth-gateway healthy | ✅ |

### 15.3 Sem achados surpresa

Sub-fase 1.3 foi a mais limpa até agora:
- Migration aplicou na primeira tentativa (padrão `DROP INDEX` aprendido na 1.2 já estava na cabeça)
- Tabela nova, sem call sites de runtime
- Login intacto (migration não toca em permissoes_modulo nem usuarios)
- Pré-flight de ambos (depto T.I. + usuário admin) protege re-execução em outros ambientes

### 15.4 Esforço real vs estimado

- **Estimado:** ~3-4h
- **Real:** ~1h efetiva (escopo enxuto + lições da 1.2)
- **Diferença:** bem abaixo. Subfases ganham velocidade conforme aprendizado se acumula.

### 15.5 Pendências técnicas registradas

- [ ] **Sub-fase 1.6** — UI Configurador: grid `depto × funcionalidade` pra ADMIN ativar/desativar. Atualmente apenas T.I. tem funcionalidades; demais deptos ficam silenciosamente sem nada até alguém ativar.
- [ ] **Cadastro dos deptos Fiscal e Controladoria** — pré-requisito pra ativar funcionalidades neles (D34: piloto Onda 2). Hoje em DEV não existem. Pode ser cadastro manual via UI atual do Configurador, ou seed novo.

### 15.6 Próximo passo — Sub-fase 1.4

JWT payload novo no auth-gateway:
- Atual: `modulos: [{ codigo, role }]`
- Alvo: `modulos: [{ codigo, departamentos: [{ id, nome, role, funcionalidades: [...] }] }]`
- Backend monta `departamentos[]` juntando `permissoes_modulo` × `departamento_funcionalidades`
- Token velho deixa de funcionar (decisão D41/Q6 — invalidar sessões)
- Esforço estimado: ~6h (doc-mestre §7.1 lote 1.4). Mas é mais delicado — afeta todos os módulos que validam JWT.

**Decisão pendente após esta sub-fase:** continuar com 1.4 ou pausar?
