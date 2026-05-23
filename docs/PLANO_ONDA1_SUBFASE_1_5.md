# Plano — Onda 1 — Sub-fase 1.5

**Sub-fase:** 1.5 — RBAC guards backend + decorator de funcionalidade
**Branch:** `feat/workspace-foundation` (continuação)
**Esforço estimado:** ~3-4h (escopo enxuto: infra + piloto)
**Status:** ✅ **CONCLUÍDA em 23/05/2026** — ver §15 (Resultado).

> Documento de referência: `Workspace_Multi_Departamento_Design.md` v1.2 §7.1 lote 1.5 + D32/D36.
> Pré-requisitos: Sub-fases 1.1 (`50624df`), 1.2 (`dfb362b`), 1.3 (`ede895a`), 1.4 (`5e5ba8d`) concluídas.

---

## 1. Escopo

### Entra
- Atualizar interfaces `JwtPayload` em 3 consumidores (gestao-ti, fiscal, inventario)
  - Adicionar `departamentos?: ModuloDepartamentoPayload[]` opcional em `ModuloPayload`
  - Tipo `ModuloDepartamentoPayload` (id, nome, role, funcionalidades)
- Atualizar guards existentes pra popular `request` com info departamental:
  - `gestao-ti.guard.ts` → `request.gestaoTiDepartamentos`
  - `fiscal.guard.ts` → `request.fiscalDepartamentos`
- **Novo decorator + guard `@RequiresFuncionalidade('CHAMADO')`** que valida se o usuário tem essa funcionalidade ativa em algum depto do módulo
- **Aplicar em 1 endpoint piloto** (ex: `chamado.controller.ts` GET list) pra validar o mecanismo
- Smoke tests

### NÃO entra (escopo da Sub-fase 1.6 ou Onda 2)
- ❌ Aplicar `@RequiresFuncionalidade` em todos os ~55 endpoints (Onda 2 — quando outros deptos pediram)
- ❌ Filtros departamentais em listings (`SELECT WHERE departamento_id = current`) — Onda 2
- ❌ Remover helper `getDefaultDepartamentoId` (Sub-fase 1.6 — quando UI permitir escolher depto na criação)
- ❌ Remover `role` denormalizado do JWT (Sub-fase 1.6+)
- ❌ UI Configurador grid funcionalidades (Sub-fase 1.6)
- ❌ 3 responses HTTP do login com extras cor/ícone (Sub-fase 1.6)

### Por que escopo enxuto

Aplicar `@RequiresFuncionalidade` em 55 endpoints não muda **comportamento de produção** hoje:
- Todos os users só têm depto T.I.
- T.I. tem todas as 12 funcionalidades ativas
- Logo, `@RequiresFuncionalidade(X)` sempre passa

Valor real aparece na **Onda 2** quando o Fiscal/Controladoria forem cadastrados (D34). Esta sub-fase entrega **infraestrutura validada** com piloto; aplicação em massa fica pra Onda 2.

---

## 2. Mudanças por arquivo

### 2.1 Interfaces consumidores

**`gestao-ti/backend/src/common/interfaces/jwt-payload.interface.ts`** (+8 linhas):
```typescript
export class ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
}

export class ModuloPayload {
  codigo: string;
  role: string;
  departamentos?: ModuloDepartamentoPayload[]; // NOVO (opcional — retrocompat)
}
```

**`fiscal/backend/src/common/interfaces/jwt-payload.interface.ts`** (+5 linhas):
```typescript
export interface ModuloPayload {
  codigo: string;
  role: string;
  departamentos?: Array<{ id: string; nome: string; role: string; funcionalidades: string[] }>;
}
// Atualizar JwtPayload pra usar ModuloPayload em vez de inline
```

**Inventário (Python)**: docstring em `app/core/security.py:160` ajustada (apenas comentário; tipagem stubs do Python não impacta runtime).

### 2.2 Guards existentes — popular departamentos no request

**`gestao-ti/backend/src/common/guards/gestao-ti.guard.ts`**:
```typescript
const modulo = user.modulos?.find((m) => m.codigo === 'GESTAO_TI');
if (!modulo) throw new ForbiddenException();
request.gestaoTiRole = modulo.role;
// NOVO Sub-fase 1.5:
request.gestaoTiDepartamentos = modulo.departamentos ?? [];
```

**`fiscal/backend/src/common/guards/fiscal.guard.ts`**: idem com `request.fiscalDepartamentos`.

### 2.3 Decorator + Guard `@RequiresFuncionalidade`

Novo arquivo `gestao-ti/backend/src/common/decorators/requires-funcionalidade.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';

export const REQUIRES_FUNCIONALIDADE_KEY = 'requiresFuncionalidade';

/**
 * Marca endpoint que exige funcionalidade ativa no módulo do usuário.
 * Usado junto com FuncionalidadeGuard.
 *
 * Ex: @RequiresFuncionalidade('CHAMADO')
 */
export const RequiresFuncionalidade = (funcionalidade: string) =>
  SetMetadata(REQUIRES_FUNCIONALIDADE_KEY, funcionalidade);
```

Novo arquivo `gestao-ti/backend/src/common/guards/funcionalidade.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_FUNCIONALIDADE_KEY } from '../decorators/requires-funcionalidade.decorator';

@Injectable()
export class FuncionalidadeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const funcionalidade = this.reflector.get<string>(
      REQUIRES_FUNCIONALIDADE_KEY,
      context.getHandler(),
    );
    if (!funcionalidade) return true; // sem decorator = sem check

    const req = context.switchToHttp().getRequest();
    const departamentos = req.gestaoTiDepartamentos ?? [];

    // Valida: pelo menos 1 depto do user tem essa funcionalidade ativa
    const tem = departamentos.some((d: { funcionalidades: string[] }) =>
      d.funcionalidades?.includes(funcionalidade),
    );

    if (!tem) {
      throw new ForbiddenException(
        `Funcionalidade ${funcionalidade} não habilitada para os departamentos do usuário no módulo Gestão TI.`,
      );
    }
    return true;
  }
}
```

### 2.4 Endpoint piloto

`gestao-ti/backend/src/chamado/chamado.controller.ts` — primeira rota GET list (linha 139):
```typescript
@Get()
@Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
@RequiresFuncionalidade('CHAMADO')  // NOVO Sub-fase 1.5 (piloto)
@UseGuards(FuncionalidadeGuard)
async listar(...) { ... }
```

**Ou** registrar guard globalmente no módulo (mais limpo) — decidir na implementação.

---

## 3. Smoke tests

| # | Check | Esperado |
|---|---|---|
| 1 | Build Gestão TI | ✅ OK |
| 2 | Build Fiscal | ✅ OK |
| 3 | LOGIN continua funcional | HTTP 200 + JWT com departamentos[] |
| 4 | Endpoint piloto `GET /chamados` com JWT do admin (tem CHAMADO ativo) | HTTP 200 (passa pelo guard novo) |
| 5 | Endpoint piloto SEM `@RequiresFuncionalidade` | HTTP 200 (guard ignora sem decorator) |
| 6 | 4 backends up & healthy | ✅ |

**Teste negativo** (opcional — pode ficar pra Onda 2):
- Criar usuário em depto sem funcionalidade CHAMODO ativa
- Tentar acessar endpoint com `@RequiresFuncionalidade('CHAMADO')` → deve retornar 403
- (Não há esse usuário em DEV — pularia este teste)

---

## 4. Procedimento operacional

1. Atualizar 2 interfaces (gestao-ti, fiscal)
2. Atualizar 2 guards existentes (popular `request.gestaoTiDepartamentos`)
3. Criar decorator + guard `@RequiresFuncionalidade`
4. Aplicar em 1 endpoint piloto
5. Build local OK
6. Rebuild: `docker compose build gestao-ti-backend fiscal-backend`
7. Restart: `docker compose up -d gestao-ti-backend fiscal-backend`
8. Smoke tests (§3)
9. **PAUSA #2** com Clenio
10. Commit final + plano §15 + memória

---

## 5. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Tipo TS quebra build em algum lugar inesperado | Média | Baixo | `departamentos?` opcional — retrocompat |
| `@UseGuards` confunde com guards existentes | Baixa | Médio | Testar manualmente; decorator + guard separados são padrão NestJS |
| Endpoint piloto deixa de funcionar | Baixa | Médio | Smoke #4 confirma; rollback simples (remover 2 linhas no controller) |
| Build do Fiscal não passa por divergência de tipos | Média | Baixo | Conferir interface antes; tipagem opcional |

---

## 6. Rollback plan

Como sem migration SQL, rollback é trivial:
```bash
git revert <hash_commits_1.5>
docker compose build gestao-ti-backend fiscal-backend
docker compose up -d gestao-ti-backend fiscal-backend
```

---

## 7. Critério de "feito"

- [ ] 2 interfaces atualizadas (gestao-ti, fiscal)
- [ ] 2 guards atualizados
- [ ] Decorator + guard novos criados
- [ ] 1 endpoint piloto com `@RequiresFuncionalidade`
- [ ] Build OK em ambos backends
- [ ] LOGIN OK
- [ ] Endpoint piloto retorna 200 com JWT do admin
- [ ] 3-4 commits criados
- [ ] Plano §15 + memória atualizados

---

## 8. Próximas sub-fases

- **Sub-fase 1.6** — UI Configurador (matriz user×depto×role + grid depto×funcionalidade) + 3 responses HTTP do login com extras + substituir `getDefaultDepartamentoId` por contexto JWT em ~20 call sites. **Maior sub-fase da Onda 1** (~12h estimado).
- **Onda 2** — Aplicar `@RequiresFuncionalidade` em massa nos ~55 endpoints; refactor de filtros departamentais em listings; onboarding piloto Fiscal e Controladoria.

---

_Plano criado por Claude em 23/05/2026. Continuação da sub-fase 1.4 (commit `5e5ba8d`). Branch `feat/workspace-foundation`._

---

## 15. Resultado (execução em 23/05/2026)

**Status:** ✅ **CONCLUÍDA**

### 15.1 Commits aplicados

| # | Hash | Conteúdo |
|---|---|---|
| 1 | `c1eab5a` | Plano sub-fase 1.5 |
| 2 | **`a601f38`** | **Interfaces + guards + decorator + 1 endpoint piloto** |
| 3 | (este commit) | **Fechamento** — plano §15 |

### 15.2 Smoke tests — todos passaram

| # | Check | Resultado |
|---|---|---|
| 1 | Build Gestão TI | ✅ OK |
| 2 | Build Fiscal | ✅ OK |
| 3 | LOGIN | ✅ HTTP 200 + JWT com departamentos[] |
| 4 | `GET /chamados` com `@RequiresFuncionalidade('CHAMADO')` (admin tem CHAMADO ativo) | ✅ HTTP 200 (guard novo aceita) |
| 5 | `GET /projetos` sem decorator | ✅ HTTP 200 (FuncionalidadeGuard ignora endpoints sem decorator) |
| 6 | `GET /api/v1/fiscal/health` | ✅ HTTP 200 (`fiscalDepartamentos` populado) |
| 7 | 4 backends up & healthy | ✅ |

### 15.3 Sem achados surpresa

Sub-fase 1.5 saiu na primeira tentativa. Caminho A da Sub-fase 1.4 (retrocompat) já tinha preparado o terreno — guards leem `modulo.departamentos ?? []` com fallback vazio pra JWT antigo.

### 15.4 Esforço real vs estimado

- **Estimado:** ~3-4h
- **Real:** ~1.5h efetivas
- **Diferença:** abaixo do estimado por causa do escopo enxuto (1 piloto) e dos padrões consolidados das sub-fases anteriores

### 15.5 Pendências técnicas registradas

- [ ] **Sub-fase 1.6** — aplicar `@RequiresFuncionalidade` em massa nos ~55 endpoints (decisão tomada na 1.5: deixar pra Onda 2 quando outros deptos forem cadastrados, mas pode ser feito também na 1.6 se quiser). Aplicar filtros departamentais nos listings.
- [ ] **Sub-fase 1.6** — UI Configurador (matriz user×depto×role + grid funcionalidades).
- [ ] **Sub-fase 1.6** — Substituir `getDefaultDepartamentoId` em ~20 call sites por contexto JWT (`currentUser.departamentoId` ou `dto.departamentoId`).
- [ ] **Sub-fase 1.6** — Remover role denormalizada do JWT após consumidores migrarem.
- [ ] **Inventário Python** — atualizar tipagem/docstring quando ele consumir `departamentos[]` (Sub-fase 1.6 ou Onda 2).
- [ ] **Teste negativo** do `FuncionalidadeGuard` — criar user sem funcionalidade e validar 403. Não há esse user em DEV; ficou pra quando outros deptos forem cadastrados.

### 15.6 Próximo passo — Sub-fase 1.6 ou pausa

**Sub-fase 1.6** é a maior e mais complexa da Onda 1:
- UI Configurador (matriz user×depto×role + grid depto×funcionalidade) — frontend novo
- 3 responses HTTP do login com extras cor/ícone passam a usar `buildModulosPayload` com extras
- Substituir 20 call sites do `getDefaultDepartamentoId` por contexto JWT
- (Opcional) aplicar `@RequiresFuncionalidade` em massa
- Esforço estimado: ~12h (doc-mestre §7.1 lote 1.6 sugere 12h — confirmar quando começar)
- Maior parte é frontend → tem perfil diferente das anteriores
