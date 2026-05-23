# Plano — Onda 1 — Sub-fase 1.6 (Parte 1)

**Sub-fase:** 1.6 parte 1 — Substituir `getDefaultDepartamentoId` por contexto JWT
**Branch:** `feat/workspace-foundation` (continuação)
**Esforço estimado:** ~3h
**Status:** Plano fechado em 23/05/2026. Pronto pra execução.

> Documento de referência: `Workspace_Multi_Departamento_Design.md` v1.2.
> Pré-requisitos: Sub-fases 1.1 → 1.5 concluídas (commits `2007d9a` → `08c71e4`).

---

## 1. Contexto conceitual reforçado

Conversado com Clenio em 23/05 manhã. Três conceitos de "departamento" coexistem:

| Conceito | Onde | Para que serve |
|---|---|---|
| `core.usuarios.departamentoId` | Cadastro do colaborador | **Organizacional** — indicadores ("Supermercado abre X chamados") |
| `core.permissoes_modulo.departamentoId` (Sub-fase 1.2) | Permissão user × módulo | **Operacional** — em qual workspace o user atua no módulo |
| `gestao_ti.X.departamentoId` (Sub-fase 1.1) | Cada entidade operacional | **Dono** da operação (isolamento entre workspaces) |

Workspace = espaço de trabalho de um grupo de colaboradores. Hoje só T.I. tem espaço; vamos expandir (D34).

**Fonte de verdade pro "depto da operação"** = `core.permissoes_modulo.departamentoId`, exposto no JWT (Sub-fase 1.4) em `modulos[X].departamentos[Y].id`.

---

## 2. Escopo (parte 1 da Sub-fase 1.6)

### Entra
- Criar helper `resolveDepartamento` centralizado em **2 backends** (gestao-ti + auth-gateway)
- Lógica em cascata: `dto.departamentoId` → JWT → fallback `getDefaultDepartamentoId`
- Refatorar **~10 call sites Gestão TI** + **2 call sites auth-gateway**
- Adicionar `departamentoId?` opcional em DTOs relevantes (preparação UI multi-perfil)
- `getDefaultDepartamentoId` continua existir como fallback final (usado por import/seed sem user)

### NÃO entra (parte 2 da Sub-fase 1.6)
- ❌ UI Configurador (matriz user×depto×role + grid funcionalidades)
- ❌ 3 responses HTTP do login com extras cor/ícone (já no auth.service.ts:130, 359, 427)
- ❌ Aplicar `@RequiresFuncionalidade` em massa (~55 endpoints)
- ❌ Remover `role` denormalizada do JWT

### NÃO entra (Onda 2)
- ❌ Cadastrar Fiscal/Controladoria como deptos novos
- ❌ Onboarding piloto Fiscal/Controladoria

---

## 3. Helper `resolveDepartamento`

`gestao-ti/backend/src/common/helpers/resolve-departamento.helper.ts`:

```typescript
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { getDefaultDepartamentoId } from './default-departamento.helper.js';

/**
 * Cascata pra resolver o departamento_id da operação no módulo.
 *
 * Workspace Multi-Departamento (Onda 1 Sub-fase 1.6 parte 1 — D32/D36):
 *  1. dto.departamentoId       — UI multi-perfil explícita (parte 2/Onda 2)
 *  2. user JWT (depto do user no módulo) — Sub-fase 1.4 garantiu campo
 *  3. helper T.I. (fallback)   — import/seed sem user
 *
 * Comportamento em DEV (todos os users só têm 1 perfil = T.I.):
 *  - Path 1 não dispara (DTO não traz)
 *  - Path 2 retorna depto T.I.
 *  - Path 3 não atinge
 */
export async function resolveDepartamento(
  prisma: PrismaService,
  user: JwtPayload | null,
  moduloCodigo: string,
  dtoDepartamentoId?: string,
): Promise<string> {
  if (dtoDepartamentoId) return dtoDepartamentoId;

  const fromJwt = user?.modulos
    ?.find((m) => m.codigo === moduloCodigo)
    ?.departamentos?.[0]?.id;
  if (fromJwt) return fromJwt;

  return getDefaultDepartamentoId(prisma);
}
```

Equivalente em `auth-gateway/src/common/utils/resolve-departamento.ts` (sem `.js`, sem moduloCodigo — auth tem contexto diferente).

---

## 4. Call sites a refatorar

### 4.1 Gestão TI — call sites que recebem `user: JwtPayload`

| # | Arquivo | Linha | Função | Tratamento |
|---|---|---|---|---|
| 1 | `ativo/ativo.service.ts` | 79 | createAtivo | dto.departamentoId já existe — só wrap no novo helper |
| 2 | `equipe/equipe.service.ts` | 65 | createEquipe | adicionar `user` na assinatura; novo helper |
| 3 | `compra/services/compra-nota-fiscal.service.ts` | 278 | createNF | novo helper (user já no contexto) |
| 4 | `contrato/services/contrato-core.service.ts` | 152 | createContrato | novo helper |
| 5 | `licenca/licenca.service.ts` | 100 | createLicenca | novo helper |
| 6 | `ordem-servico/ordem-servico.service.ts` | 56 | createOS | novo helper (user já no contexto) |
| 7 | `parada/parada.service.ts` | 123 | criarParada | novo helper |
| 8 | `parada/parada.service.ts` | 409 | criarMotivo | adicionar `user`; novo helper |
| 9 | `projeto/services/projeto-core.service.ts` | 359 | createProjeto | manter herança pai; novo helper no else |
| 10 | `software/software.service.ts` | 81 | createSoftware | adicionar `user`; novo helper |

### 4.2 Gestão TI — call sites mantidos como estão (herança/sem user)

| # | Arquivo | Linha | Por quê |
|---|---|---|---|
| 4b | `compra-nota-fiscal.service.ts` | 455 | copyNF: já herda de `original.departamentoId` |
| 5b | `licenca.service.ts` | 142 | renovar: já herda de `anterior.departamentoId` |
| 6b | `contrato-core.service.ts` | 310 | renovar: já herda de `contrato.departamentoId` |
| 9b | `projeto-core.service.ts` | 731 | duplicar: já herda de `original.departamentoId` |
| 7c | `import/import.service.ts` | 132 | importar ativos: sem user no contexto |
| 8c | `import/import.service.ts` | 196 | importar softwares: sem user no contexto |

### 4.3 Auth-gateway

| # | Arquivo | Linha | Função | Tratamento |
|---|---|---|---|---|
| A | `usuario/usuario.service.ts` | 169 | createUsuario.permissoes (inline) | `dto.departamentoId` é do USUÁRIO (organizacional). Permissões herdam? Decidir |
| B | `usuario/usuario.service.ts` | 265 | atribuirPermissao.upsert | DTO `AtribuirPermissao` ganha `departamentoId?`; novo helper |

**Nuance em A:** o `createUsuario` cria um user + permissões num só shot. O `dto.departamentoId` é o depto **organizacional** do user. Pra criar permissão, a Sub-fase 1.2 já usou esse mesmo valor (fallback T.I. caso vazio). Vou manter o comportamento atual (não mexer no helper de permissão dentro de createUsuario — herda do user) — só refatorar o B.

### 4.4 DTOs a atualizar (campo opcional)

Adicionar `departamentoId?: string` (com `@IsOptional() @IsString()`) em:
- `CreateAtivoDto` (já tem)
- `CreateEquipeDto`
- `CreateNotaFiscalDto`
- `CreateContratoDto`
- `CreateLicencaDto`
- `CreateOsDto`
- `CreateParadaDto`
- `CreateMotivoParadaDto`
- `CreateProjetoDto`
- `CreateSoftwareDto`
- `AtribuirPermissaoDto` (auth-gateway)

10 DTOs Gestão TI + 1 auth-gateway = 11 DTOs.

---

## 5. Smoke tests

| # | Check | Esperado |
|---|---|---|
| 1 | Build Gestão TI | OK |
| 2 | Build auth-gateway | OK |
| 3 | LOGIN | HTTP 200 + JWT |
| 4 | Criar chamado via endpoint (POST com JWT do admin, sem `departamentoId` no body) | Cria com `departamento_id` = T.I. (via JWT — admin tem só T.I.) |
| 5 | DB confere: `SELECT departamento_id FROM gestao_ti.chamados ORDER BY created_at DESC LIMIT 1` = T.I. | ✅ |
| 6 | Endpoints existentes (`GET /chamados`, etc.) continuam respondendo | ✅ |
| 7 | 4 backends up & healthy | ✅ |

---

## 6. Procedimento operacional

1. Criar helper em ambos backends
2. Refatorar 10 call sites Gestão TI (alguns + atualizar assinaturas)
3. Refatorar 1 call site auth-gateway (B)
4. Atualizar 11 DTOs (adicionar `departamentoId?` opcional)
5. Build local OK
6. Rebuild: `docker compose build gestao-ti-backend auth-gateway`
7. Restart
8. Smoke tests (§5)
9. PAUSA #2
10. Commit + plano §15 + memória

---

## 7. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Algum call site fica sem user no escopo | Média | Médio | Helper aceita `user: null` → cai no fallback. Reviso ao mudar |
| DTO opcional quebra validação | Baixa | Baixo | `@IsOptional()` + `@IsString()` padrão |
| Endpoint mistura sub-fases (recebe `departamentoId` no body sem permissão pra outro depto) | Baixa | Médio | Sub-fase 1.6 parte 2 valida; por ora, DTO opcional não exposto na UI |
| Endpoints sem user que importam (import service) | N/A | N/A | Já mapeados como exceção — continuam com helper T.I. |

---

## 8. Critério de "feito"

- [ ] Helper criado em ambos backends
- [ ] 10 call sites Gestão TI refatorados
- [ ] 1 call site auth-gateway refatorado
- [ ] 11 DTOs com `departamentoId?` opcional
- [ ] Build OK em ambos
- [ ] LOGIN OK
- [ ] Criar chamado via API → `departamento_id` = T.I. (igual a antes)
- [ ] 3 commits criados
- [ ] Plano §15 + memória atualizados

---

## 9. Próximo passo após parte 1

**Sub-fase 1.6 parte 2** (futura):
- UI Configurador (matriz user×depto×role + grid funcionalidades) — frontend novo
- 3 responses HTTP do login com extras cor/ícone passam a usar `buildModulosPayload` com extras
- (Opcional) aplicar `@RequiresFuncionalidade` em massa

---

_Plano criado por Claude em 23/05/2026. Continuação da sub-fase 1.5 (commit `08c71e4`). Branch `feat/workspace-foundation`._
