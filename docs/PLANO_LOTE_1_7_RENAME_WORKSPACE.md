# Plano — Lote 1.7 — Rename GESTAO_TI → WORKSPACE

**Branch:** `feat/workspace-foundation` (continuação)
**Esforço estimado:** ~6h
**Status:** ✅ **CONCLUÍDO 23/05/2026 noite** (5 sub-blocos; C1.2 adiado). Real: ~2h.

> Pré-requisitos: Onda 1 100% concluída (commits `2007d9a` → `03de8a1`). Onda 1 validada em DEV via browser.
> Insumo: `docs/WORKSPACE_AUDITORIA_LITERAIS.md` (517 literais mapeados em Pré-Onda 0).

---

## 1. Decisões já fechadas (doc-mestre v1.2)

- **D37 (Q1):** Opção B — módulo `WORKSPACE` novo paralelo (não rename in-place)
- **D42 (Q7):** Rename `EquipeTI` → `Equipe` via `@@map("equipes_ti")` (sem ALTER físico)
- **Roles:** `GESTOR_TI` → `GESTOR`, `SUPORTE_TI` → `SUPORTE`. TECNICO/DESENVOLVEDOR/MANUTENCAO/INFRAESTRUTURA removidas (DEV confirma zero registros)

## 2. Decisões P1-P3 fechadas em 23/05 (sessão)

- **JWT-A (breaking change):** JWT emite `WORKSPACE` direto, consumidores atualizam junto
- **Frontend:** renomear textos visíveis agora ("Gestão de T.I." → "Workspace")
- **Granularidade:** 6 sub-blocos commitados com smoke entre cada

## 3. Estado atual em DEV

```
4 módulos ativos: CONFIGURADOR, FISCAL, GESTAO_TI, INVENTARIO
GESTAO_TI: 24 permissões em 6 roles ativas:
  - SUPORTE_TI (10 users)
  - USUARIO_CHAVE (5)
  - USUARIO_FINAL (5)
  - ADMIN (2)
  - GESTOR_TI (1)
  - TERCEIRIZADO (1)
Roles do GESTAO_TI sem users: TECNICO, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA (a remover)
```

## 4. Sub-blocos

### C1.1 — Migration auth-gateway (~1h)
- Criar `WORKSPACE` em `core.modulos_sistema`
- Criar 6 roles novas no WORKSPACE (ADMIN, GESTOR, SUPORTE, USUARIO_FINAL, USUARIO_CHAVE, TERCEIRIZADO)
- Migrar `permissoes_modulo`: pra cada linha do GESTAO_TI, atualizar `modulo_id`+`role_modulo_id` pra equivalente WORKSPACE
- Marcar GESTAO_TI INATIVO (`status='INATIVO'`) — preserva pra rollback
- Limpar roles antigas do GESTAO_TI (TECNICO/DESENV/MANUT/INFRA + as 6 ativas após migração)

### C1.2 — Rename Prisma EquipeTI → Equipe (~30min)
- `gestao-ti/backend/prisma/schema.prisma`: `model EquipeTI` → `model Equipe` com `@@map("equipes_ti")`
- Zero migration SQL (rename só Prisma)
- Vai gerar erros TS em call sites: `prisma.equipeTI` → `prisma.equipe`

### C1.3 — Rename literais código (~2-3h)
- `gestao-ti/backend`: ~376 ocorrências
- `gestao-ti/frontend`: ~131 ocorrências
- `auth-gateway`: 2 ocorrências (seed.ts inicial + usuario.service onde já mexemos)
- **Padrão:**
  - `'GESTOR_TI'` (string) → `'GESTOR'`
  - `'SUPORTE_TI'` (string) → `'SUPORTE'`
  - `EquipeTI` (type) → `Equipe`
  - `equipeTI` (variável) → `equipe`
  - `equipesTI` (plural) → `equipes`
- **CUIDADO INFRAESTRUTURA:** polissêmico (vide achado §3 do `WORKSPACE_AUDITORIA_LITERAIS.md`) — só remover quando é role; preservar quando é enum value (TipoSoftware, TipoProjeto, CategoriaCusto)

### C1.4 — JWT + guards (~1h)
- `auth-gateway/src/auth/helpers/build-modulos-payload.ts`: emite `codigo: 'WORKSPACE'`
- `auth-gateway/src/auth/helpers/build-modulos-response.ts`: idem
- `gestao-ti/backend/src/common/guards/gestao-ti.guard.ts`: procura `'WORKSPACE'` (renomear classe pra `WorkspaceGuard`?)
- Fiscal/Inventário: não precisam mudar (procuram 'FISCAL' / 'INVENTARIO')
- `seed.ts`: cria WORKSPACE no boot do auth-gateway pra novos ambientes (pós-C1)

### C1.5 — Frontend textos visíveis (~1h)
- `hub/src`: card "Gestão de T.I." → "Workspace"
- `gestao-ti/frontend/src`: header, sidebar, breadcrumb
- Logos/ícones: mantidos (mesmo módulo, só nome diferente)

### C1.6 — Smoke + commit final (~30min)
- LOGIN OK + JWT com `modulos[X].codigo = 'WORKSPACE'`
- Navegar Hub → Workspace → criar chamado → confirmar funciona
- Configurador → Departamentos → drawer funcionalidades continua OK
- DB: `SELECT * FROM core.modulos_sistema` mostra WORKSPACE ATIVO + GESTAO_TI INATIVO

## 5. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Algum endpoint quebra por usar 'GESTAO_TI' hardcoded fora do guard | Média | Médio | Auditoria já mapeou; revisão atenta |
| LOGIN quebra | Baixa | CRÍTICO | Smoke após cada sub-bloco |
| DROP/migrações de roles legacy quebram FK em permissoes_modulo | Baixa | Médio | DEV confirma zero registros; pré-flight no SQL |
| INFRAESTRUTURA renomeado errado | Média | Médio | Não tocar onde é enum value |

## 6. Rollback

Por sub-bloco:
- C1.1: `UPDATE permissoes_modulo SET modulo_id=GESTAO_TI ...` + reativar GESTAO_TI + remover WORKSPACE
- C1.2: revert commit (sem mudança DB)
- C1.3: revert commit
- C1.4: revert commit (consumidores voltam a esperar GESTAO_TI; JWT volta a emitir GESTAO_TI)
- C1.5: revert commit

## 7. Critério de "feito"

- [ ] WORKSPACE existe no DB ATIVO; GESTAO_TI INATIVO
- [ ] 24 permissões migradas (zero perda)
- [ ] Roles legacy do GESTAO_TI removidas
- [ ] Prisma model Equipe (era EquipeTI)
- [ ] Build OK em todos backends + frontends
- [ ] LOGIN OK + JWT emite WORKSPACE
- [ ] Smoke: criar chamado/projeto continua funcionando
- [ ] Auditoria literais re-rodada confirma zero ocorrências (ou só em enums de domínio)
- [ ] 6+ commits criados
- [ ] §15 + memória atualizados

---

_Plano criado por Claude em 23/05/2026 noite. Continuação do Onda 1 (commits `2007d9a` → `03de8a1`). Branch `feat/workspace-foundation`._
