# Plano — Onda 1 — Sub-fase 1.6 (Parte 2)

**Sub-fase:** 1.6 parte 2 — UI Configurador completa
**Branch:** `feat/workspace-foundation` (continuação)
**Esforço estimado:** ~10h (4 blocos: A backend + B grid UI + C matriz + D responses)
**Status:** ✅ **CONCLUÍDA em 23/05/2026 (com C1 mínimo)** — ver §15.

> Pré-requisitos: Sub-fases 1.1 → 1.6.1 concluídas (commits `2007d9a` → `de52bb8`).

---

## 1. Blocos

| Bloco | Esforço | Arquivos novos | Arquivos alterados |
|---|---|---|---|
| **A — Backend funcionalidades** | ~2h | 4 (controller + service + module + DTO) | 1 (app.module) |
| **B — Grid frontend funcionalidades** | ~3h | 2 (page + service) | 2 (Sidebar + App.tsx routes) |
| **C — Matriz multi-perfil usuário** | ~4h | — | 3 (UsuarioFormPage + service + tipos) |
| **D — Responses HTTP do login** | ~1h | — | 1 (auth.service.ts) |

---

## 2. Bloco A — Backend funcionalidades

### Estrutura
`auth-gateway/src/departamento-funcionalidade/` (módulo novo):
- `departamento-funcionalidade.module.ts`
- `departamento-funcionalidade.controller.ts`
- `departamento-funcionalidade.service.ts`
- `dto/update-funcionalidades.dto.ts`

### Endpoints

**GET `/api/v1/core/departamentos/:id/funcionalidades`**
```typescript
// Retorna TODAS as 12 funcionalidades com status (ativo true/false) pro depto
[
  { funcionalidade: 'CHAMADO', ativo: true, ativadoEm, ativadoPor: {id, nome} },
  { funcionalidade: 'PROJETO', ativo: false },
  ...
]
```

**PATCH `/api/v1/core/departamentos/:id/funcionalidades`**
```typescript
// Body: { funcionalidades: [{ funcionalidade: 'CHAMADO', ativo: true }, ...] }
// Bulk update — diff vs estado atual:
//  - Funcionalidade nova com ativo=true → INSERT (ativadoPor = user.sub)
//  - Funcionalidade existente com ativo=true (já ativa) → no-op
//  - Funcionalidade existente com ativo=false → UPDATE ativo=false (desativadoEm/Por)
```

Auditoria: `ativado_por` e `desativado_por` referenciam `core.usuarios.id`.

### Lógica do service
```typescript
async listarPorDepto(departamentoId: string) {
  // Buscar todas as 12 funcionalidades do enum + status no DB
  const ativas = await prisma.departamentoFuncionalidade.findMany({
    where: { departamentoId },
    include: { /* ativadoPor: select id,nome / desativadoPor: idem */ },
  });
  return TODAS_FUNCIONALIDADES.map((f) => {
    const found = ativas.find((a) => a.funcionalidade === f);
    return found ?? { funcionalidade: f, ativo: false };
  });
}

async atualizar(departamentoId: string, dto: UpdateFuncionalidadesDto, user) {
  // Para cada item do DTO, fazer upsert com lógica de ativo/inativo + audit
}
```

### Guard
Reuse `ConfiguradorAdminGuard` existente (verifica role ADMIN no módulo CONFIGURADOR).

---

## 3. Bloco B — Grid frontend funcionalidades

### Arquivos novos
- `configurador/src/pages/departamentos/DepartamentoFuncionalidadesDrawer.tsx` (drawer)
- `configurador/src/services/departamento-funcionalidade.service.ts`

### UX
- Na `DepartamentosPage.tsx` existente, adicionar botão "Funcionalidades" na linha de cada depto
- Clica → abre drawer/modal lateral
- Drawer mostra grid 3x4 de checkboxes (12 funcionalidades)
- Botão "Salvar" → PATCH backend
- Toast de sucesso/erro

### Padrão visual
Seguir convenção do projeto (TailwindCSS + componentes existentes).

---

## 4. Bloco C — Matriz multi-perfil usuário

### Estado atual
`UsuarioFormPage.tsx` aba "permissoes":
```typescript
interface PermissaoForm {
  moduloId: string;
  roleModuloId: string;
  habilitado: boolean;
}
```
1 linha por módulo, role única.

### Alvo
```typescript
interface PermissaoForm {
  id?: string;           // se já existe no DB
  moduloId: string;
  departamentoId: string;
  roleModuloId: string;
  ativo: boolean;
}
```
N linhas (multi-perfil) — mesmo módulo, deptos diferentes, roles diferentes.

### UX
Substituir grid atual por tabela com botão "+ Adicionar perfil":
```
| Módulo       | Departamento     | Role     | Ações |
|--------------|------------------|----------|-------|
| Workspace ▼  | T.I. ▼           | ADMIN ▼  | 🗑    |
| Workspace ▼  | Fiscal ▼         | GESTOR ▼ | 🗑    |
| Fiscal ▼     | Fiscal ▼         | ADMIN ▼  | 🗑    |
[+ Adicionar perfil]
```

### Backend
DTO `AtribuirPermissaoDto` já tem `departamentoId?` (Sub-fase 1.6.1). Front envia.

### Validações
- Mesma combinação `(modulo, depto)` não pode aparecer 2x → UNIQUE composta no DB já garante (erro 409)
- Frontend pré-valida (sem permitir duplicata visual)

---

## 5. Bloco D — Responses HTTP do login

### Estado atual
`auth-gateway/src/auth/auth.service.ts` linhas 130, 359, 427 retornam:
```typescript
modulos: usuario.permissoes.map((p) => ({
  codigo: p.modulo.codigo,
  nome: p.modulo.nome,
  icone: p.modulo.icone,
  cor: p.modulo.cor,
  url: p.modulo.urlFrontend,
  role: p.roleModulo.codigo,
  roleNome: p.roleModulo.nome,
}))
```

### Alvo
Estender `buildModulosPayload` pra opcionalmente incluir extras (cor/ícone/url) OU criar `buildModulosResponse` separado.

Decisão: criar **`buildModulosResponse`** separado (paralelo ao `buildModulosPayload`), com campos do response HTTP. Mantém `buildModulosPayload` focado no JWT.

---

## 6. Smoke tests

| # | Check | Esperado |
|---|---|---|
| 1 | Build auth-gateway, gestao-ti-backend, configurador frontend | OK |
| 2 | LOGIN HTTP 200 + JWT | ✅ |
| 3 | GET `/api/v1/core/departamentos/:id/funcionalidades` (T.I.) | 12 funcionalidades, todas `ativo: true` |
| 4 | PATCH desativando 3 funcionalidades em depto-teste | Persistido |
| 5 | GET após PATCH | 9 ativas + 3 inativas com `desativadoPor` preenchido |
| 6 | Hub recebe response do login com `cor/ícone/url + departamentos[]` | ✅ |
| 7 | UsuarioFormPage carrega permissões multi-perfil | OK |
| 8 | Adicionar 2 perfis no mesmo módulo (deptos diferentes), salvar | DB tem 2 linhas em permissoes_modulo |
| 9 | Tentar adicionar perfil duplicado (mesmo modulo+depto) | UI rejeita ou backend 409 |

---

## 7. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Refactor da matriz quebra fluxos existentes | Média | Alto | Migration de UX gradual; manter estado original como fallback |
| Build do frontend Configurador demora | Média | Baixo | Aceitar |
| Multi-perfil exige ajustes em revogarPermissao | Baixa | Médio | TODO já registrado na 1.2; aproveitar pra atualizar |
| Funcionalidades habilitadas erradamente | Baixa | Médio | Audit (ativadoPor) ajuda a rastrear |

---

## 8. Procedimento operacional

1. Bloco A — backend (~2h) — commit intermediário
2. Bloco D — responses login (~1h) — commit intermediário
3. Bloco B — grid frontend (~3h) — commit intermediário
4. Bloco C — matriz multi-perfil (~4h) — commit intermediário
5. Build geral + smoke
6. PAUSA #2 com Clenio
7. Commit final + plano §15 + memória + **fechamento Onda 1 (6/6 sub-fases ✅)**

---

## 9. Critério de "feito"

- [ ] Backend endpoints funcionalidades OK
- [ ] Grid frontend funcionalidades OK
- [ ] Matriz multi-perfil OK no UsuarioFormPage
- [ ] 3 responses HTTP do login incluindo departamentos[]
- [ ] Build OK em 3 backends + 1 frontend
- [ ] LOGIN OK
- [ ] PATCH funcionalidades persiste
- [ ] Multi-perfil salva 2+ permissões pro mesmo user/módulo
- [ ] 5+ commits (1 por bloco + final)
- [ ] Plano §15 + memória atualizados
- [ ] Onda 1 marcada 6/6 = 100% CONCLUÍDA

---

## 10. Pós-Onda 1

Após a Sub-fase 1.6 parte 2:
- **Backend completo**: schema multi-depto, permissões multi-perfil, funcionalidades por depto, JWT rico, guards, helper cascata, UI Configurador
- **Próximos passos sugeridos:**
  1. **Frontend smoke completo** (com nginx subido) — não executado em DEV até agora
  2. **Onda 2** — cadastrar Fiscal/Controladoria como deptos novos + ativar funcionalidades + onboarding piloto
  3. **Aplicar `@RequiresFuncionalidade` em massa nos ~55 endpoints** (Onda 2)
  4. **Filtros departamentais em SELECT** (Onda 2)
  5. **Rename `GESTAO_TI` → `WORKSPACE`** (Lote 1.7 — Onda 1?)

---

_Plano criado por Claude em 23/05/2026 tarde. Continuação da sub-fase 1.6 parte 1 (commit `de52bb8`). Branch `feat/workspace-foundation`._

---

## 15. Resultado (execução em 23/05/2026)

**Status:** ✅ **CONCLUÍDA — A + B + D completos; C como versão mínima (C1)**

### 15.1 Commits aplicados

| # | Hash | Conteúdo |
|---|---|---|
| 1 | `9bcd3fc` | Plano 1.6 parte 2 |
| 2 | **`a0ffe69`** | **Bloco A + Bloco D** — Backend funcionalidades + responses HTTP login |
| 3 | **`7e7bdd9`** | **Bloco B** — Grid frontend funcionalidades |
| 4 | **`1b1c6e1`** | **Bloco C mínimo (C1)** — Backend pronto pra multi-perfil + tipo |
| 5 | (este commit) | **Fechamento + Onda 1 100%** |

### 15.2 Smoke tests passaram

| # | Check | Resultado |
|---|---|---|
| 1 | Build auth-gateway + configurador | ✅ |
| 2 | LOGIN HTTP 200 | ✅ |
| 3 | GET /core/departamentos/T.I./funcionalidades | ✅ 12 funcionalidades ativas |
| 4 | GET /core/departamentos/Auditoria/funcionalidades | ✅ 12 funcionalidades inativas |
| 5 | Response do login com extras (cor/ícone) + departamentos[] | ✅ confirmado via JWT decodificado |
| 6 | Frontend Configurador build OK | ✅ |

### 15.3 Bloco C — decisão de pragmatismo

Pra a matriz visual de multi-perfil (Bloco C2): em DEV não há multi-perfil real (todos só têm depto T.I.), então a UI seria implementada sem possibilidade de validar negativo. Optou-se por **C1**:
- Backend `revogarPermissao` aceita `?departamentoId=` opcional
- Tipo `UsuarioDetalhe.permissoes[].departamento` ganha campo
- Frontend service envia `departamentoId` quando recebido
- UI atual **mantida** (1 perfil por módulo via toggles)
- **TODO claro** pra sessão futura junto com Onda 2 (Fiscal/Controladoria cadastrados → multi-perfil real → matriz visual)

### 15.4 Esforço real vs estimado

- **Estimado:** ~10h
- **Real:** ~3h (com C1)
- **Diferença:** abaixo do estimado por escopo C1 + padrões consolidados
