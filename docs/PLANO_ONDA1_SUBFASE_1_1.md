# Plano — Onda 1 — Sub-fase 1.1

**Sub-fase:** 1.1 — Migration `add_departamento_id_workspace_entities`
**Branch:** `feat/workspace-foundation` (criada de `main`@65fd7d4 em 22/05/2026)
**Esforço estimado:** ~8h (estimado no doc-mestre v1.2 §7.1)
**Status:** Plano fechado em 22/05/2026 23:00 — P1-P5 todas decididas (ver §14). Aguarda execução no sábado (23/05).

> Documento de referência: `C:\Arquivos-de-projeto\clenio\Multi departamento\Workspace_Multi_Departamento_Design.md` v1.2 (§4.2.2-4.2.13, §6.2 Etapa 4, §11.1).

---

## 1. Por que essa sub-fase é a primeira

A Onda 1 entrega o **alicerce** do Workspace Multi-Departamental. A sub-fase 1.1 é
escolhida como ponto de partida porque:

1. **Risco contido.** Adiciona coluna `departamento_id` em ~10 tabelas — todas
   recebem `default = T.I.` na migração, preservando o comportamento atual.
2. **Não toca em código de runtime.** Schema + migration + relação Prisma.
   Nenhum guard, controller, JWT ou frontend é modificado.
3. **Reversível.** Rollback é uma migration down (drop column) — testado em DEV.
4. **Insumo das demais.** Sub-fases 1.2 (PermissaoModulo), 1.4 (JWT) e 1.5
   (Guards) dependem do schema já estar com a coluna.
5. **Sem sobreposição com deploy 20/05.** Pacote do Douglas mexe em RFB/LGPD/
   atividades — não toca nas tabelas alvo da sub-fase 1.1.

---

## 2. Escopo

### 2.1 Entra

- Migration Prisma única que adiciona `departamento_id` em todas as entidades
  operacionais multi-depto (D31).
- Default = depto T.I. em todos os registros existentes.
- FK + index em cada tabela.
- Atualização do `schema.prisma` adicionando o campo + relação `departamento`.
- Smoke test local: `prisma migrate dev` em DEV + `prisma studio` confere dados
  preservados.

### 2.2 NÃO entra (deixar pras sub-fases seguintes)

- ❌ Mudanças em `core.permissoes_modulo` (Sub-fase 1.2)
- ❌ Criação de `core.departamento_funcionalidades` e enum `FuncionalidadeWorkspace` (Sub-fase 1.3)
- ❌ Mudanças no JWT payload (Sub-fase 1.4)
- ❌ Mudanças em RBAC guards/interceptors (Sub-fase 1.5)
- ❌ Mudanças em controllers/services (filtragem por depto fica pra sub-fase 1.5)
- ❌ Mudanças no frontend (somente backend nesta sub-fase)
- ❌ Rename `EquipeTI` → `Equipe` via `@@map` (D42 — fica no Lote 1.7)
- ❌ Rename de roles `GESTOR_TI` → `GESTOR` (D37 + auditoria literais — Lote 1.7)
- ❌ Renomeação do módulo `GESTAO_TI` → `WORKSPACE` (Lote 1.7)

**Princípio:** sub-fase pequena, verificável, commitável. Próxima sub-fase só
começa após esta passar smoke test em DEV.

---

## 3. Tabelas afetadas (10)

Todas em `gestao_ti.*`. Lista alinhada com doc-mestre §4.2.2-4.2.13 + §11.1.

| # | Tabela | Coluna a adicionar | NOT NULL após backfill |
|---|---|---|---|
| 1 | `equipes_ti` | `departamento_id UUID` | Sim |
| 2 | `projetos` | `departamento_id UUID` | Sim |
| 3 | `ordens_servico` | `departamento_id UUID` | Sim |
| 4 | `contratos` | `departamento_id UUID` | Sim |
| 5 | `notas_fiscais` | `departamento_id UUID` | Sim |
| 6 | `softwares` | `departamento_id UUID` | Sim (D31 — era nullable no v1.0) |
| 7 | `software_licencas` | `departamento_id UUID` + `equipe_responsavel_id UUID NULLABLE` (D8) | Sim |
| 8 | `ativos` | `departamento_id UUID` | Sim (D31 — sai do T.I.-only) |
| 9 | `registros_parada` | `departamento_id UUID` | Sim (D31) |
| 10 | `motivos_parada` | `departamento_id UUID` | Sim (D31) |

**Nota sobre `chamados`:** já tem `departamento_id` (nullable). Sub-fase 1.1
**NÃO altera** a coluna existente — apenas confirma que continua nullable por
enquanto. Sub-fase 1.5 cuida da semântica (preencher via `equipeAtual.departamento`
no service).

**Nota sobre `notas_fiscais.filial_id`:** mantém NOT NULL (D38 / Q2 fechada).
A migration **adiciona** `departamento_id`; não altera filial_id.

---

## 4. Migration SQL (estrutura, sem código final)

Nome: `20260523xxxxxx_add_departamento_id_workspace_entities` (P1 fechada)

**Pré-flight check embutido no topo da migration** (P3 fechada — Opção C):

```sql
-- Pré-flight: garantir que depto T.I. existe antes de qualquer ALTER.
-- Se faltar, aborta com mensagem clara (não cria depto silenciosamente).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.departamentos WHERE codigo = 'TI') THEN
    RAISE EXCEPTION 'Migration abortada: depto codigo=TI nao encontrado em core.departamentos. Rodar seed do auth-gateway antes.';
  END IF;
END $$;
```

**Padrão repetido pra cada uma das 10 tabelas:**

```sql
-- Passo A — Adicionar coluna nullable
ALTER TABLE gestao_ti.<tabela>
  ADD COLUMN departamento_id UUID;

-- Passo B — Backfill com depto T.I.
UPDATE gestao_ti.<tabela>
   SET departamento_id = (SELECT id FROM core.departamentos WHERE codigo = 'TI');

-- Passo C — Tornar NOT NULL + FK + index
ALTER TABLE gestao_ti.<tabela>
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT <tabela>_departamento_fkey
  FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id);

CREATE INDEX <tabela>_departamento_id_idx
  ON gestao_ti.<tabela>(departamento_id);
```

**Adicional para `software_licencas` (D8 — P2 fechada, entra junto na sub-fase 1.1):**

```sql
ALTER TABLE gestao_ti.software_licencas
  ADD COLUMN equipe_responsavel_id UUID;

ALTER TABLE gestao_ti.software_licencas
  ADD CONSTRAINT software_licencas_equipe_responsavel_fkey
  FOREIGN KEY (equipe_responsavel_id) REFERENCES gestao_ti.equipes_ti(id);

CREATE INDEX software_licencas_equipe_responsavel_id_idx
  ON gestao_ti.software_licencas(equipe_responsavel_id);
```

(Sem backfill — coluna fica NULL para registros existentes. Onda 2/3 preenche
via UX quando relevante.)

**Pré-condição da migration garantida pelo bloco DO $$ no topo (P3 fechada).**
Se em qualquer ambiente (DEV/HOM/PROD futuro) o depto T.I. não existir, a
migration aborta antes de qualquer ALTER — sem deixar tabelas em estado parcial.

---

## 5. Mudanças no `schema.prisma`

Para cada modelo das 10 tabelas, adicionar:

```prisma
model <Modelo> {
  // ... campos existentes inalterados

  // NOVO — Workspace Multi-Departamento (Onda 1 Sub-fase 1.1)
  departamentoId String       @map("departamento_id")
  departamento   Departamento @relation(fields: [departamentoId], references: [id])

  @@index([departamentoId])
}
```

Para `SoftwareLicenca` adicionar também:

```prisma
  equipeResponsavelId String?    @map("equipe_responsavel_id")
  equipeResponsavel   EquipeTI?  @relation("EquipeResponsavelLicenca", fields: [equipeResponsavelId], references: [id])
```

(Relation nomeada porque `SoftwareLicenca` já pode ter relação com `EquipeTI`
em outro contexto — confirmar durante implementação.)

**Modelo `Departamento` ganha relações reversas:**

```prisma
model Departamento {
  // ... campos existentes

  // NOVO — Workspace
  equipes              EquipeTI[]
  projetos             Projeto[]
  ordensServico        OrdemServico[]
  contratos            Contrato[]
  notasFiscais         NotaFiscal[]
  softwares            Software[]
  softwareLicencas     SoftwareLicenca[]
  ativos               Ativo[]
  registrosParada      RegistroParada[]
  motivosParada        MotivoParada[]
}
```

---

## 6. Procedimento operacional

### Em DEV (no `gestao-ti-backend` container)

1. Editar `gestao-ti/backend/prisma/schema.prisma` com as adições (§5).
   - Pré-flight é embutido na própria migration via bloco `DO $$` (P3 fechada),
     então não precisa de validação ad-hoc separada aqui.
   - Commit 2: **schema.prisma atualizado** com 10 modelos + 10 reversas em Departamento.
2. **PAUSA DE REVISÃO #1 com Clenio (P5 — ritmo híbrido):** schema pronto;
   aguardar OK antes de gerar a migration. Clenio confere se relações estão
   coerentes, nomes batem, nada quebrou no `prisma validate`.
3. Gerar a migration:
   ```bash
   docker compose exec gestao-ti-backend npx prisma migrate dev --create-only \
     --name add_departamento_id_workspace_entities
   ```
4. **Editar manualmente o SQL gerado** para garantir 3 coisas:
   - Adicionar o bloco `DO $$ ... RAISE EXCEPTION ... $$;` no topo (pré-flight P3).
   - Garantir backfill (`UPDATE`) entre `ADD COLUMN` (nullable) e `ALTER NOT NULL`. Prisma `migrate dev` gera ALTERs mas pode esquecer o `UPDATE` no meio.
   - Confirmar ordem A→B→C (§4) em cada uma das 10 tabelas.
5. Aplicar:
   ```bash
   docker compose exec gestao-ti-backend npx prisma migrate dev
   ```
6. Rodar smoke tests (§7) e capturar evidências (saída SQL + status dos endpoints).
7. **PAUSA DE REVISÃO #2 com Clenio (P5):** migration aplicada em DEV, smoke
   tests passados; aguardar OK antes do commit 4 (atualização do plano com
   resultado e marcação como concluída).
8. Atualizar §15 do plano com seção "Resultado" (commit 4).

### Em HOM/PROD

**NÃO APLICAR** nesta sub-fase. Sub-fase 1.10 (soak HOM) e Onda 1 fechamento
cuidam disso.

---

## 7. Smoke tests pós-migration (em DEV)

Checklist obrigatório antes do commit:

- [ ] `npx prisma migrate status` confirma migration aplicada.
- [ ] `npx prisma validate` passa sem erros.
- [ ] `psql` confere que cada uma das 10 tabelas tem `departamento_id` NOT NULL.
- [ ] `SELECT COUNT(*) FROM gestao_ti.<tabela> WHERE departamento_id IS NULL`
      retorna **0** em todas as tabelas.
- [ ] `SELECT COUNT(DISTINCT departamento_id) FROM gestao_ti.equipes_ti` retorna
      **1** (todas no depto T.I.).
- [ ] Backend Gestão TI sobe sem erro (`docker compose logs gestao-ti-backend`).
- [ ] Endpoint smoke: `GET /api/v1/gestao-ti/chamados` retorna 200 e dados existentes.
- [ ] Endpoint smoke: `GET /api/v1/gestao-ti/projetos` retorna 200 e dados existentes.
- [ ] Frontend Gestão TI: lista de chamados e projetos abre normalmente em DEV.

Se qualquer item falhar, **rollback imediato** (§9) e investigar antes de
continuar.

---

## 8. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Tabela com volume grande (notas_fiscais, chamados históricos) lenta no UPDATE | Baixa | Médio | DEV tem volume baixo. Em HOM/PROD: rodar `EXPLAIN ANALYZE` antes; cogitar batch UPDATE. (Não é problema da sub-fase 1.1 — só de Onda 1.10 quando subir HOM) |
| Depto T.I. não existir em DEV | Baixa | Alto (migration aborta) | Pré-flight check no §6. Se falhar, rodar seed primeiro. |
| Prisma gerar `migrate dev` que esquece o backfill UPDATE | Alta | Alto (NOT NULL falha) | Revisar SQL gerado MANUALMENTE antes de aplicar (§6 passo 4). Editar pra garantir Passos A→B→C na ordem certa. |
| Relação reversa em `Departamento` quebrar lazy-loading existente | Baixa | Médio | `npx prisma generate` + `tsc --noEmit` no backend. Se quebrar, ajuste localizado. |
| Conflito com deploy 20/05 no `main` (quando mergear) | Baixa | Baixo | Branch isolada; conflito é resolvido no merge final da Onda 1. |
| Esquecer de adicionar relação reversa em `Departamento` | Média | Baixo (apenas dev experience pior) | Checklist no §5 incluiu todas as 10 reversas. |

---

## 9. Rollback plan

Se smoke test falhar:

```bash
# Em DEV
docker compose exec gestao-ti-backend npx prisma migrate resolve --rolled-back <migration_name>

# Editar schema.prisma revertendo as mudanças

# Aplicar migration "down" manual (ou recriar DEV a partir de backup local)
```

Se for em sub-fase posterior e descobrir problema na sub-fase 1.1:

```sql
-- Migration de rollback (reversa, em ordem inversa):
DROP INDEX gestao_ti.<tabela>_departamento_id_idx;
ALTER TABLE gestao_ti.<tabela>
  DROP CONSTRAINT <tabela>_departamento_fkey,
  DROP COLUMN departamento_id;
-- Repetir para as 10 tabelas
```

Em PROD (futuro): rollback exige `pg_dump` pré-deploy reservado (vide §12.3 do
doc-mestre v1.2). Sub-fase 1.1 não vai pra PROD nesta etapa — irrelevante por
ora.

---

## 10. Commits planejados (4 commits)

Princípio de [[feedback-entrega-incremental-subfases]] — cada commit é
verificável e revertível.

1. **`feat(workspace): plano sub-fase 1.1 da Onda 1`** *(este commit, agora)*
   - `docs/PLANO_ONDA1_SUBFASE_1_1.md` (apenas plano, sem código)

2. **`feat(workspace): schema.prisma — adicionar departamentoId em 10 entidades`**
   - `gestao-ti/backend/prisma/schema.prisma` (campos + relações + index)
   - `prisma validate` passa
   - Sem migration ainda (próximo commit)

3. **`feat(workspace): migration add_departamento_id_workspace_entities`**
   - `gestao-ti/backend/prisma/migrations/<timestamp>_add_departamento_id_workspace_entities/migration.sql`
   - SQL revisado manualmente (passos A→B→C na ordem certa)
   - Aplicada em DEV, smoke tests do §7 passaram todos

4. **`docs(workspace): atualizar plano com resultado da sub-fase 1.1`**
   - `docs/PLANO_ONDA1_SUBFASE_1_1.md` — adicionar seção "Resultado" com:
     - Tempo real vs estimado
     - Smoke tests executados (checkbox marcado)
     - Issues encontradas
     - Pronto pra sub-fase 1.2

---

## 11. Critério de "feito"

A sub-fase 1.1 é considerada concluída quando **todos** os itens abaixo estiverem ok:

- [ ] Schema Prisma atualizado e `prisma validate` passa
- [ ] Migration criada e aplicada em DEV sem erro
- [ ] Todos os smoke tests do §7 passam
- [ ] 4 commits acima criados (sem push)
- [ ] Plano atualizado com seção "Resultado" (commit 4)
- [ ] Backend Gestão TI funcionando normal em DEV
- [ ] Frontend Gestão TI funcionando normal em DEV (lista de chamados/projetos abre)

**Não-critério:**
- ❌ Não precisa estar em HOM (sub-fase posterior)
- ❌ Não precisa de teste automatizado novo (sub-fase 1.9)
- ❌ Não precisa de mudança em controller/service (sub-fase 1.5)

---

## 12. Próximas sub-fases (orientação, não compromisso)

Após sub-fase 1.1 concluída e Clenio aprovar:

- **Sub-fase 1.2** — Refactor `core.permissoes_modulo` (adicionar `departamento_id`, sem `is_super_admin` — D36). Migration + schema.
- **Sub-fase 1.3** — Criar `core.departamento_funcionalidades` + enum `FuncionalidadeWorkspace`. Migration + seed inicial (T.I. com tudo ativo, Fiscal/Controladoria com subset).
- **Sub-fase 1.4** — Atualizar `auth-gateway` para emitir JWT no novo formato (`modulos: [{ codigo, departamentos: [{ id, role, funcionalidades }] }]`).
- **Sub-fase 1.5** — RBAC guards backend: interceptors filtram por `current_depto` + check de funcionalidade ativa.

Sub-fases 1.6 (UI Configurador), 1.9 (smoke automatizados) e 1.10 (soak HOM)
**aguardam deploy 20/05 estar estável em PROD ≥1 semana** antes de iniciar.

---

## 13. Pontos abertos — TODOS FECHADOS em 22/05/2026 23:00

Ver §14 para o registro das decisões.

---

## 14. Decisões fechadas (22/05/2026)

| # | Pergunta | Decisão | Onde está aplicada |
|---|---|---|---|
| P1 | Nome da migration | `add_departamento_id_workspace_entities` (inglês, padrão do projeto) | §4 (nome), §10 (commit 3) |
| P2 | `equipeResponsavelId` em `SoftwareLicenca` | Adicionar **junto** na sub-fase 1.1 (D8 implementado de uma vez) | §3 (tabela), §4 (SQL adicional), §5 (schema) |
| P3 | Pré-flight check do depto T.I. | **Embutido na migration SQL** via bloco `DO $$ ... RAISE EXCEPTION ... $$;` no topo (Opção C) | §4 (pré-flight block), §6 (passo 1 simplificado) |
| P4 | Relações reversas em `Departamento` | **Adicionar todas as 10** (consistência, custo baixo) | §5 (lista completa) |
| P5 | Ritmo de execução no sábado | **Híbrido**: 2 pausas de revisão (após schema; após smoke test) | §6 (passos 6 e 8), §10 (entre commits) |

**Princípio das 5 decisões:** consistência com convenções do projeto + robustez
embutida no schema/migration (em vez de processo manual) + entrega completa de
D8 já na primeira sub-fase + 2 pontos de revisão pra Clenio intervir cedo se
algo não fizer sentido.

---

_Plano criado por Claude em 22/05/2026 22:50, fechado em 23:00 após
saneamento das 5 questões com Clenio. Branch `feat/workspace-foundation`.
Pronto para execução no sábado 23/05/2026._
