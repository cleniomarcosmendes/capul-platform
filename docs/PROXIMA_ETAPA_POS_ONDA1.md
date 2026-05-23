# Próxima Etapa — Pós Onda 1 (Workspace Multi-Departamento)

**Data:** 23/05/2026 (planejamento) — para retomada em sessão futura
**Branch atual:** `feat/workspace-foundation` (30 commits, **sem push**)
**Pré-requisito:** Onda 1 100% concluída (vide `docs/PLANO_ONDA1_SUBFASE_1_*.md`)

---

## 1. Estado atual

### O que está pronto em DEV
- ✅ Schema multi-departamento (11 tabelas)
- ✅ Permissões multi-perfil (UNIQUE composta)
- ✅ `core.departamento_funcionalidades` + seed T.I.
- ✅ JWT payload rico (`departamentos[]` + `funcionalidades[]`) com retrocompat
- ✅ Guards backend + decorator `@RequiresFuncionalidade` (piloto 1 endpoint)
- ✅ Helper `resolveDepartamento` em cascata
- ✅ Endpoints REST de funcionalidades (GET/PATCH)
- ✅ Responses HTTP do login enriquecidas
- ✅ Grid de funcionalidades no Configurador (drawer)

### O que NÃO foi validado
- ❌ **Frontend smoke completo** (com nginx + todos os frontends subidos)
- ❌ Login real via browser (Hub → Configurador → Gestão TI)
- ❌ Drawer de funcionalidades visualmente (build OK mas não foi clicado em DEV)
- ❌ Criar entidades reais via UI (chamado, projeto)
- ❌ Verificar regressões em telas existentes do Gestão TI

### O que NÃO foi feito (TODO claro)
- ❌ Matriz visual multi-perfil no UsuarioFormPage (Bloco C2 da 1.6.2)
- ❌ Aplicar `@RequiresFuncionalidade` em massa (~55 endpoints)
- ❌ Filtros departamentais em listings (SELECT WHERE departamento_id = X)
- ❌ Rename `GESTAO_TI` → `WORKSPACE` (Lote 1.7)
- ❌ Cadastro de Fiscal/Controladoria como deptos novos

---

## 2. Próximas etapas — em ordem recomendada

### Etapa A (obrigatória) — Validação prática da Onda 1 em DEV (~1-2h)

**Por que primeiro:** 15h de refatoração estrutural sem teste visual = risco real de regressão silenciosa. Build OK ≠ funciona.

**Passos:**
1. Subir stack completo: `docker compose up -d` (todos os containers)
2. Aguardar healthchecks
3. Abrir `https://localhost/` no browser → fazer login (admin/admin123)
4. Navegar pelos 4 módulos:
   - **Hub**: cards de módulos aparecem normalmente
   - **Configurador**: navegar pra Departamentos → clicar "Funcionalidades" em um depto → ver drawer com 12 checkboxes (T.I. todos marcados, outros desmarcados)
   - **Gestão TI**: lista de chamados, projetos, contratos → confirmar que tudo aparece (departamento_id deve ser T.I. em todos)
   - **Inventário**: smoke básico
5. Criar 1 chamado via UI → verificar em DB: `SELECT departamento_id FROM gestao_ti.chamados ORDER BY created_at DESC LIMIT 1` deve ser T.I.
6. Criar 1 projeto via UI → mesmo check
7. Editar 1 chamado existente → garantir que ainda salva (não regrediu)

**Critério de "OK":**
- [ ] Login funciona
- [ ] 4 módulos abrem sem erro 500
- [ ] Drawer de funcionalidades aparece e responde
- [ ] Criar chamado/projeto funciona e vai pra T.I.
- [ ] Telas existentes do Gestão TI não regrediram

**Se falhar:** identificar regressão, corrigir, recomeçar smoke.

---

### Etapa B (decisão) — Estratégia de push da branch (~10min)

Branch `feat/workspace-foundation` tem 30 commits sem push. Decisão:

| Opção | Quando faz sentido |
|---|---|
| **(1) Push direto** | Você confia que a história de 30 commits está limpa o suficiente. Cada commit é atômico, com mensagens descritivas. Branch fica reservada no remote pra eventualmente virar PR |
| **(2) Squash em N commits maiores** | Quer simplificar a história — ex: "Onda 1 sub-fase 1.1" como 1 commit em vez de 8. Perde granularidade mas ganha PR mais limpo |
| **(3) Esperar mais validação** | Push só depois da Etapa A completar OK |

**Recomendação:** Opção 3 → Etapa A primeiro → se OK, push direto (1). História de 30 commits documenta bem a saga; squash perderia contexto valioso.

---

### Etapa C (escolha) — Próximo trabalho

Após validação OK, 2 caminhos paralelos possíveis:

#### Caminho C1 — Lote 1.7 (Rename GESTAO_TI → WORKSPACE)

**O que entrega:** módulo renomeado de `GESTAO_TI` pra `WORKSPACE` em todo lugar (DB + código + UI). Última peça de "limpeza arquitetural" antes da Onda 2.

**Insumo já pronto:** `docs/WORKSPACE_AUDITORIA_LITERAIS.md` (Pré-Onda 0 — sabemos exatamente onde estão os 517 literais legados, 99% concentrados em Gestão TI).

**Esforço estimado:** ~6h (auditoria já feita)
- Migration: criar módulo WORKSPACE paralelo (D37 — Opção B) + migrar `permissoes_modulo.modulo_id` + renomear roles (`GESTOR_TI` → `GESTOR`, `SUPORTE_TI` → `SUPORTE`)
- Rename literais em ~70 arquivos do Gestão TI (sed + revisão manual onde for ambíguo)
- Frontend Hub: atualizar referências
- Smoke: LOGIN → módulo "Workspace" funciona como "Gestão de TI" funcionava

**Decisões já fechadas (doc-mestre v1.2 D37):**
- Opção B (módulo paralelo) — rollback fácil
- Roles renomeadas: GESTOR_TI → GESTOR, SUPORTE_TI → SUPORTE
- TECNICO, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA removidas

#### Caminho C2 — Onda 2 (Pilotos Fiscal + Controladoria)

**O que entrega:** workspace funcional pra Fiscal e Controladoria. **Primeira validação real de multi-depto.**

**Esforço estimado:** ~30-40h (depende do escopo dos pilotos)

**Passos:**
1. Cadastrar deptos: Fiscal + Controladoria (via Configurador UI)
2. Ativar funcionalidades:
   - Fiscal: CHAMADO + EQUIPE + INDICADOR_OPERACIONAL
   - Controladoria: PROJETO + EQUIPE + INDICADOR_OPERACIONAL
3. Cadastrar 1-2 usuários piloto em cada depto
4. UI matriz multi-perfil (Bloco C2 da 1.6.2) — **agora faz sentido validar**
5. Aplicar `@RequiresFuncionalidade` em massa nos ~55 endpoints
6. Filtros departamentais em listings (SELECT WHERE depto = current)
7. Sidebar dinâmico no frontend (Gestão TI mostra só funcionalidades ativas)
8. Soak ≥ 1 semana com cada piloto antes de declarar "estável"

#### Recomendação Caminho

**Sequência sugerida:** C1 antes de C2.

Razões:
- C1 é menor e "fecha" arquitetura — depois Onda 2 não precisa lidar com renames
- C1 NÃO toca em fluxo de operação real — risco baixo
- C2 sem C1 funciona, mas usuários do Fiscal/Controladoria verão "Gestão de T.I." no menu (estranho)
- Auditoria de literais já feita = C1 fica preciso

---

## 3. Decisão de timing (pendência aberta)

A Onda 1 foi inteira em 1 sábado (23/05). Deploy 20/05 estava em HOM no momento. Status atual:
- ⚠️ Deploy 20/05 em PROD: **incerto** (Douglas tinha agendado pra sábado 23/05). Conferir antes de qualquer push.
- ⚠️ Onda 1 não foi pra HOM nem PROD. **Só commit em branch local.**

**Pré-requisito antes de promover Onda 1 (sub-fase 1.10 do doc-mestre):**
- Deploy 20/05 estável em PROD ≥ 1 semana
- Soak HOM Onda 1 ≥ 48h
- Roteiro de deploy específico (semelhante aos que o Douglas usa) — pacote contém: 4 migrations (gestao-ti) + 3 migrations (auth-gateway) + 2 helpers novos + 33 arquivos refatorados em runtime
- Plano de rollback: pg_dump pré-deploy + tag git pra reverter código

---

## 4. Checklist pra próxima sessão

Quando voltar:

- [ ] Conferir status do deploy 20/05 em PROD (Douglas)
- [ ] Conferir se branch `feat/workspace-foundation` ainda está local (sem push) — `git status` + `git branch -vv`
- [ ] Decidir: **Etapa A** (validação visual) ou pular pra C1/C2?
- [ ] Reler `docs/PROXIMA_ETAPA_POS_ONDA1.md` (este documento)
- [ ] Consultar memórias atualizadas em `~/.claude/.../memory/`:
  - `project_workspace_multi_depto.md` (estado da Onda 1)
  - `feedback_prisma_unique_e_index_nao_constraint.md` (padrão pra DROP UNIQUE em migrations manuais)
  - `feedback_preferir_solucao_robusta.md` (princípios)

---

## 5. Backlog técnico (registrado pra evitar perder)

Não fazem parte de C1/C2 obrigatório, mas valem revisão:

- [ ] **Frontend smoke completo** — algo entre Onda 1 e C1
- [ ] `revogarPermissao` aceitar `departamentoId` na UI (hoje só backend tem)
- [ ] Sidebar dinâmico no Gestão TI baseado em funcionalidades ativas (Sub-fase 1.6.3?)
- [ ] Inventário Python — atualizar tipagem `modulos[X].departamentos[]` quando começar a usar
- [ ] Documentar fluxo de "criar novo depto" via Configurador → ativar funcionalidades → cadastrar usuários piloto
- [ ] Decidir se `getDefaultDepartamentoId` (helper antigo) deve ser deletado completamente após Onda 2 (hoje ainda é usado em import.service)

---

## 6. Resumo do estado da plataforma agora

```
PROD          → versão pré-Workspace (estável; deploy 20/05 incerto)
HOM           → versão pré-Workspace (testes do deploy 20/05)
DEV (local)   → ✅ Onda 1 100% (branch feat/workspace-foundation, 30 commits)
GIT (origin)  → branch NÃO existe ainda (sem push)
```

---

_Plano pra retomada criado por Claude em 23/05/2026 (sábado tarde-noite). Próxima sessão: ler este documento + memórias antes de decidir._
