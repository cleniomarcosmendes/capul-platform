# Plano — Onda 1 — Sub-fase 1.4

**Sub-fase:** 1.4 — JWT payload novo (caminho A — retrocompatível)
**Branch:** `feat/workspace-foundation` (continuação)
**Esforço estimado:** ~2-3h
**Status:** ✅ **CONCLUÍDA em 23/05/2026** — ver §15 (Resultado).

> Documento de referência: `Workspace_Multi_Departamento_Design.md` v1.2 §7.1 lote 1.4 + D36/D41.
> Pré-requisitos: Sub-fases 1.1 (`50624df`) + 1.2 (`dfb362b`) + 1.3 (`ede895a`) concluídas.

---

## 1. Escopo

### Entra (caminho A — retrocompatível)
- Helper `buildModulosPayload` centralizado no auth-gateway
- Atualizar 7+ call sites de montagem do payload em `auth.service.ts`
- Atualizar interface `JwtPayload` do auth-gateway com novos tipos
- Payload alvo retém `modulos[X].role` (denormalizada do 1º depto) **e** adiciona `departamentos[]`
- Smoke test em 4 backends (auth, Gestão TI, Fiscal, Inventário)

### NÃO entra
- ❌ Mudanças nos consumidores (Gestão TI, Fiscal, Inventário, Configurador) — adiado pra Sub-fase 1.5
- ❌ Remoção de `role` no nível do módulo — adiado pra após Sub-fase 1.5/1.6
- ❌ Invalidação massiva de tokens em PROD (D41 — só relevante na promoção pra HOM/PROD)
- ❌ Multi-perfil real (em DEV todos têm 1 depto só — T.I.)

### Por que retrocompatível

| Aspecto | Justificativa |
|---|---|
| Em DEV `modulos[X].role` é lido em 4 lugares | gestao-ti.guard, dashboard.controller (2x), fiscal.guard |
| Mudar formato quebraria todos eles ao mesmo tempo | Aumenta surface de risco em 1 sub-fase |
| Princípio Clenio "sub-fases verificadas" | Cada sub-fase entrega valor isolável |
| Sub-fase 1.5 (guards) tem natureza diferente | Guards já vão precisar refatorar pra ler `departamentos[]` em vez de `role` denormalizada |

---

## 2. Payload alvo

```typescript
{
  // ... campos existentes (sub, username, email, filialId, etc.) INALTERADOS

  modulos: [
    {
      codigo: 'WORKSPACE',
      role: 'ADMIN',  // ← MANTÉM (denormalizado — = role do 1º depto)
      departamentos: [  // ← NOVO
        {
          id: 'uuid-do-ti',
          nome: 'Tecnologia da Informacao',
          role: 'ADMIN',
          funcionalidades: [
            'CHAMADO', 'PROJETO', 'OS', 'EQUIPE', 'CONTRATO',
            'NOTA_FISCAL', 'SOFTWARE', 'LICENCA', 'ATIVO', 'PARADA',
            'INDICADOR_OPERACIONAL', 'INDICADOR_ESTRATEGICO'
          ]
        }
      ]
    }
  ]
}
```

Quando user tiver 2+ perfis no mesmo módulo (multi-perfil real, Sub-fase 1.6+):
- `modulos[X].role` = primeira role (suficiente pra retrocompat)
- `modulos[X].departamentos` = todos os perfis enumerados

---

## 3. Helper `buildModulosPayload`

`auth-gateway/src/auth/helpers/build-modulos-payload.ts`

```typescript
import { PrismaService } from '../../prisma/prisma.service';

export interface ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
}

export interface ModuloPayload {
  codigo: string;
  role: string;  // denormalizada — retrocompat (Sub-fase 1.4 — D41)
  departamentos: ModuloDepartamentoPayload[];
}

/**
 * Monta o array de módulos do JWT payload juntando:
 *  - core.permissoes_modulo (user × modulo × depto × role)
 *  - core.departamento_funcionalidades (depto × funcionalidade ativa)
 *
 * Retrocompat: mantém role no nível do módulo (= role do 1º depto). Será
 * removida na Sub-fase 1.6 após guards passarem a iterar departamentos[].
 */
export async function buildModulosPayload(
  prisma: PrismaService,
  usuarioId: string,
): Promise<ModuloPayload[]> {
  const permissoes = await prisma.permissaoModulo.findMany({
    where: { usuarioId, status: 'ATIVO' },
    include: {
      modulo: { select: { codigo: true } },
      roleModulo: { select: { codigo: true } },
      departamento: { select: { id: true, nome: true } },
    },
  });

  // Busca funcionalidades ativas dos deptos envolvidos (uma query só)
  const deptoIds = [...new Set(permissoes.map((p) => p.departamentoId))];
  const funcionalidades = deptoIds.length > 0
    ? await prisma.departamentoFuncionalidade.findMany({
        where: { departamentoId: { in: deptoIds }, ativo: true },
        select: { departamentoId: true, funcionalidade: true },
      })
    : [];

  const funcByDepto = new Map<string, string[]>();
  for (const f of funcionalidades) {
    const arr = funcByDepto.get(f.departamentoId) ?? [];
    arr.push(f.funcionalidade);
    funcByDepto.set(f.departamentoId, arr);
  }

  // Agrupa permissões por módulo
  const moduloMap = new Map<string, ModuloPayload>();
  for (const p of permissoes) {
    const deptoPayload: ModuloDepartamentoPayload = {
      id: p.departamento.id,
      nome: p.departamento.nome,
      role: p.roleModulo.codigo,
      funcionalidades: funcByDepto.get(p.departamentoId) ?? [],
    };

    const existing = moduloMap.get(p.modulo.codigo);
    if (existing) {
      existing.departamentos.push(deptoPayload);
    } else {
      moduloMap.set(p.modulo.codigo, {
        codigo: p.modulo.codigo,
        role: p.roleModulo.codigo,
        departamentos: [deptoPayload],
      });
    }
  }

  return Array.from(moduloMap.values());
}
```

---

## 4. Call sites a refatorar

`auth-gateway/src/auth/auth.service.ts` (~7 ocorrências):

Buscar e substituir o padrão:
```typescript
modulos: usuario.permissoes.map((p) => ({
  codigo: p.modulo.codigo,
  role: p.roleModulo.codigo,
}))
```

Por:
```typescript
modulos: await buildModulosPayload(this.prisma, usuario.id),
```

E adicionar `import { buildModulosPayload } from './helpers/build-modulos-payload';` no topo.

Verificar também:
- `auth.controller.ts:66` — `@Get('modulos')` endpoint (pode usar formato similar)
- Outros lugares que retornam `modulos[X].role` na response (não só no JWT)

---

## 5. Interface `JwtPayload`

`auth-gateway/src/auth/interfaces/jwt-payload.interface.ts`:

```typescript
export interface JwtPayload {
  sub: string;
  username: string;
  email: string | null;
  tipo: string;
  filialId: string | null;
  filialCodigo: string | null;
  departamentoId: string;
  departamentoNome: string;
  modulos: ModuloPayload[];
}

export interface ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
}

export interface ModuloPayload {
  codigo: string;
  role: string;  // denormalizada — retrocompat (Sub-fase 1.4 — D41)
  departamentos: ModuloDepartamentoPayload[];
}
```

NÃO atualizar `jwt-payload.interface.ts` em:
- `gestao-ti/backend/src/common/interfaces/`
- `fiscal/backend/src/common/interfaces/`

Esses ficam pra Sub-fase 1.5 quando guards usarem.

---

## 6. Smoke tests

| # | Check | Esperado |
|---|---|---|
| 1 | `prisma validate` (auth-gateway) | OK (não muda schema) |
| 2 | Build auth-gateway | OK |
| 3 | **POST /auth/login** | HTTP 200 + JWT |
| 4 | **Decodificar JWT do login** | payload tem `modulos[X].departamentos[Y].funcionalidades[...]` |
| 5 | `modulos[X].role` continua existindo (retrocompat) | ✅ presente |
| 6 | Gestão TI: endpoint autenticado responde | `GET /api/v1/gestao-ti/chamados` com JWT → 200 (ou 401 se sem JWT) |
| 7 | Fiscal: endpoint autenticado responde | similar |
| 8 | Inventário: endpoint autenticado responde | similar |
| 9 | `GET /auth/modulos` (se relevante) responde | OK |

---

## 7. Procedimento operacional

1. Criar helper `build-modulos-payload.ts`
2. Atualizar `jwt-payload.interface.ts` do auth-gateway
3. Refatorar 7 call sites no `auth.service.ts`
4. (Se aplicável) Atualizar `auth.controller.ts`
5. Build local OK
6. Rebuild: `docker compose build auth-gateway`
7. Restart: `docker compose up -d auth-gateway`
8. Smoke tests (§6)
9. **PAUSA #2** com Clenio
10. Commit final + plano §15 + atualizar memória

---

## 8. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Algum consumidor lê campo do payload que não notei | Baixa | Médio | Smoke nos 4 backends |
| Helper introduz N+1 query | Baixa | Baixo | Query única pra funcionalidades (`IN`) |
| JWT fica maior (size limit) | Baixa | Baixo | 1 user × 4 módulos × 1 depto × 12 funcs = ~50 strings; bem abaixo do limit |
| Login quebra | Baixa | CRÍTICO | Smoke #3 obrigatório |
| Build TS falha por tipos novos não bater | Média | Baixo | Resolver com type assertion ou interface ajustada |

---

## 9. Rollback plan

Como não há migration SQL, rollback é trivial:

```bash
# Reverter código
git revert <hash_do_commit_1.4>

# Rebuild + restart
docker compose up -d --build auth-gateway

# Tokens emitidos com payload novo continuam válidos (campos extras são ignorados
# pelos consumidores antigos). Sem necessidade de invalidar sessões em DEV.
```

---

## 10. Critério de "feito"

- [ ] Helper criado e funcional
- [ ] Interface JwtPayload atualizada
- [ ] 7+ call sites refatorados
- [ ] Build OK
- [ ] LOGIN retorna JWT com departamentos[] e funcionalidades[]
- [ ] 4 backends respondem normalmente com JWT novo
- [ ] 3-4 commits criados
- [ ] Plano §15 atualizado
- [ ] Memória atualizada

---

## 11. Próximas sub-fases

- **Sub-fase 1.5** — RBAC guards backend filtram por depto + funcionalidade ativa (consome `departamentos[]` + `funcionalidades[]`). Atualiza interfaces de gestao-ti e fiscal. Remove role denormalizada.
- **Sub-fase 1.6** — UI Configurador grid depto × funcionalidade + matriz multi-perfil user × depto × role.

---

_Plano criado por Claude em 23/05/2026 manhã. Continuação da sub-fase 1.3 (commit `ede895a`). Branch `feat/workspace-foundation`._

---

## 15. Resultado (execução em 23/05/2026)

**Status:** ✅ **CONCLUÍDA**

### 15.1 Commits aplicados

| # | Hash | Conteúdo |
|---|---|---|
| 1 | `4ab7b77` | Plano sub-fase 1.4 |
| 2 | **`c192f0f`** | **Helper + interface + 4 call sites** |
| 3 | (este commit) | **Fechamento** — plano §15 |

### 15.2 Smoke tests — todos passaram

| # | Check | Resultado |
|---|---|---|
| 1 | Build TS (auth-gateway) | ✅ OK |
| 2 | `POST /auth/login` | ✅ HTTP 200 + JWT |
| 3 | JWT decodificado tem `modulos[X].departamentos[Y].funcionalidades[]` em todos os 4 módulos | ✅ |
| 4 | `modulos[X].role` continua presente (retrocompat) | ✅ |
| 5 | Gestão TI (GET /chamados com JWT) | ✅ HTTP 200 |
| 6 | Fiscal (GET /health com JWT) | ✅ HTTP 200 |
| 7 | Inventário Python (GET /health com JWT) | ✅ HTTP 200 |
| 8 | 4 backends up & healthy | ✅ |
| 9 | Auth-gateway healthy | ✅ |

### 15.3 Sem achados surpresa

Caminho A (retrocompat) provou seu valor:
- 4 consumidores funcionaram sem nenhuma mudança
- Migration zero (apenas código TS)
- Build na primeira tentativa
- Smoke verde em todos os módulos

### 15.4 Esforço real vs estimado

- **Estimado:** ~2-3h
- **Real:** ~1h efetiva
- **Diferença:** Caminho A pequeno + padrões já consolidados (helper, plano)

### 15.5 Pendências técnicas registradas

- [ ] **Sub-fase 1.5** — guards backend (gestao-ti.guard, fiscal.guard, dashboard.controller, inventário security.py) iteram `departamentos[]` + `funcionalidades[]` em vez de `role` denormalizada. Aí o `role` no nível do módulo pode ser removido.
- [ ] **Sub-fase 1.6** — atualizar 3 responses HTTP do login (`auth.service.ts` linhas 130, 359, 427) que ainda usam `usuario.permissoes.map(...)` com extras (cor, ícone, url). UI Configurador vai precisar de `departamentos[]` também.
- [ ] **Atualizar interfaces dos 4 consumidores** (gestao-ti, fiscal, inventario, configurador) na Sub-fase 1.5 — adicionar `departamentos?: ModuloDepartamentoPayload[]` no tipo `ModuloPayload`.

### 15.6 Próximo passo — Sub-fase 1.5

RBAC guards backend:
- Refatorar `gestao-ti.guard.ts` pra aceitar parâmetro de funcionalidade (`@RequiresFuncionalidade('CHAMADO')`)
- Filtros departamentais em controllers (chamados, projetos, etc.) — passar `departamentoId` do JWT
- Substituir `getDefaultDepartamentoId` helper (16 call sites do Gestão TI + 4 do auth-gateway) por contexto do usuário
- Esforço estimado: ~8h (doc-mestre §7.1 lote 1.5)
- **Mais delicado da Onda 1** — toca em todos os controllers do Gestão TI
