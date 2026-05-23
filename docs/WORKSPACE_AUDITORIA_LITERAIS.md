# Workspace Multi-Departamento — Pré-Onda 0 — Auditoria de Literais

**Gerado em:** 2026-05-22 22:19:42
**Branch:** chore/workspace-pre-onda0-auditoria-literais
**Commit base:** 65fd7d4
**Ferramenta:** grep -r

Auditoria sem alteração de código. Resultado dimensiona o **Lote 1.7** da Onda 1 (rename de roles).
Documento de referência: `Workspace_Multi_Departamento_Design.md` §7.0 (Pré-Onda 0).

## Literais auditados

| Literal | Destino na Onda 1 |
|---|---|
| `GESTOR_TI` | Renomear → `GESTOR` |
| `SUPORTE_TI` | Renomear → `SUPORTE` |
| `TECNICO` | Remover (role não-usada) |
| `DESENVOLVEDOR` | Remover (role não-usada) |
| `MANUTENCAO` | Remover (role não-usada) |
| `INFRAESTRUTURA` | Remover (role não-usada) |

**Word boundary** (`-w`) aplicado pra não casar substrings (ex: `VARIAVEL_TECNICO`).

## ⚠️ Achados críticos (revisar antes do Lote 1.7)

### Achado 1 — `INFRAESTRUTURA` é polissêmico

O literal `INFRAESTRUTURA` aparece em **4 contextos distintos** no código, e **apenas 1 é role legacy a remover**:

| Contexto | Onde | Ação na Onda 1 |
|---|---|---|
| Role legacy de Gestão TI | `roles_modulo` (seed antigo) — provavelmente não existe mais | Remover se sobrar (verificar) |
| Enum `TipoSoftware` | `gestao_ti.softwares` — categoria de software | **MANTER** (valor de domínio) |
| Enum `TipoProjeto` | `gestao_ti.projetos` — tipo do projeto | **MANTER** (valor de domínio) |
| Enum `CategoriaCusto` | `gestao_ti.notas_fiscais` itens — categoria contábil | **MANTER** (valor de domínio) |
| Enum `TipoProjetoConfig` | configuração de tipos de projeto | **MANTER** (valor de domínio) |

**Implicação:** o script `-w` casa todas as ocorrências. Quem for renomear precisa **filtrar** por contexto, não por literal. Heurística rápida: se o arquivo é `*.prisma`, `*.sql` ou `types/index.ts` e o literal está dentro de um `enum`/`CREATE TYPE`/`type X = ...`, **não tocar**.

### Achado 2 — Refactor está concentrado em 2 módulos

Distribuição:
- **`gestao-ti/backend`**: 376 ocorrências (73% do total)
- **`gestao-ti/frontend`**: 131 ocorrências (25% do total)
- **`auth-gateway`**: 2 ocorrências (seed inicial de roles) (<1%)
- **`hub`, `configurador`, `fiscal/*`, `inventario/*`**: zero

**Implicação:** 99% do trabalho de rename está no módulo Gestão TI. Outros módulos não foram contaminados (consequência boa de já usarem `core.permissoes_modulo` via JWT). Auth Gateway tem apenas registros de seed — fix simples.

### Achado 3 — Migrations Prisma já aplicadas estão na lista

Várias linhas apontam pra `gestao-ti/backend/prisma/migrations/*/migration.sql`. **NÃO tocar** nesses arquivos — são histórico imutável.

## 1. Sumário por literal

| Literal | Total | Produção | Testes | Docs | Outros |
|---|---:|---:|---:|---:|---:|
| `GESTOR_TI` | 292 | 291 | 0 | 1 | 0 |
| `SUPORTE_TI` | 187 | 185 | 2 | 0 | 0 |
| `TECNICO` | 4 | 2 | 1 | 1 | 0 |
| `DESENVOLVEDOR` | 5 | 4 | 0 | 1 | 0 |
| `MANUTENCAO` | 5 | 4 | 0 | 1 | 0 |
| `INFRAESTRUTURA` | 24 | 23 | 0 | 1 | 0 |
| **TOTAL** | **517** | | | | |

## 2. Sumário por subdiretório (apenas código de produção)

| Subdiretório | Ocorrências (prod) |
|---|---:|
| `hub` | 0 |
| `gestao-ti/frontend` | 131 |
| `gestao-ti/backend` | 376 |
| `configurador` | 0 |
| `fiscal/frontend` | 0 |
| `fiscal/backend` | 0 |
| `auth-gateway` | 2 |
| `inventario/backend` | 0 |
| `inventario/frontend` | 0 |

## 3. Detalhe por arquivo (apenas código de produção)

Cada linha tem o formato `file:line | literal | trecho`. Ordenado por arquivo.

<details>
<summary>Clique para expandir (pode ter muitas linhas)</summary>

```
auth-gateway/prisma/seed.ts:110                                                  | GESTOR_TI       | { codigo: 'GESTOR_TI', nome: 'Gestor de TI', descricao: 'Gestao completa do departamento', moduloId: modGestaoTi.id },
auth-gateway/prisma/seed.ts:111                                                  | SUPORTE_TI      | { codigo: 'SUPORTE_TI', nome: 'Suporte de TI', descricao: 'Equipe de TI: atender chamados, projetos, contratos, OS, paradas e base de conhecimento', moduloId: modGestaoTi.id },
gestao-ti/backend/prisma/migrations/20260222230842_init/migration.sql:24         | INFRAESTRUTURA  | CREATE TYPE "gestao_ti"."TipoSoftware" AS ENUM ('ERP', 'CRM', 'SEGURANCA', 'COLABORACAO', 'INFRAESTRUTURA', 'OPERACIONAL', 'OUTROS');
gestao-ti/backend/prisma/migrations/20260222230842_init/migration.sql:69         | INFRAESTRUTURA  | CREATE TYPE "gestao_ti"."TipoProjeto" AS ENUM ('DESENVOLVIMENTO_INTERNO', 'IMPLANTACAO_TERCEIRO', 'INFRAESTRUTURA', 'OUTRO');
gestao-ti/backend/prisma/migrations/20260222230842_init/migration.sql:90         | INFRAESTRUTURA  | CREATE TYPE "gestao_ti"."CategoriaCusto" AS ENUM ('MAO_DE_OBRA', 'INFRAESTRUTURA', 'LICENCIAMENTO', 'CONSULTORIA', 'TREINAMENTO', 'VIAGEM', 'MATERIAL', 'OUTRO');
gestao-ti/backend/prisma/migrations/20260402130000_add_tipo_projeto_config/migration.sql:20 | INFRAESTRUTURA  | (gen_random_uuid(), 'INFRAESTRUTURA', 'Infraestrutura', CURRENT_TIMESTAMP),
gestao-ti/backend/prisma/migrations/20260512150000_add_stakeholder_to_tipo_projeto/migration.sql:11 | INFRAESTRUTURA  | --     INFRAESTRUTURA, OUTRO)
gestao-ti/backend/prisma/migrations/20260513120000_chamados_externos_mensal/migration.sql:14 | GESTOR_TI       | -- normal). Apenas ADMIN/GESTOR_TI lancam.
gestao-ti/backend/prisma/migrations/20260516120000_add_publica_comentario_tarefa/migration.sql:9 | GESTOR_TI       | -- (isTI: ADMIN/GESTOR_TI/SUPORTE_TI). Defesa em profundidade backend+frontend.
gestao-ti/backend/prisma/migrations/20260516120000_add_publica_comentario_tarefa/migration.sql:9 | SUPORTE_TI      | -- (isTI: ADMIN/GESTOR_TI/SUPORTE_TI). Defesa em profundidade backend+frontend.
gestao-ti/backend/prisma/schema.prisma:1102                                      | GESTOR_TI       | /// (ADMIN/GESTOR_TI). Decidido em 13/05/2026.
gestao-ti/backend/prisma/schema.prisma:1802                                      | GESTOR_TI       | // publica=false => nota interna: só staff TI (isTI: ADMIN/GESTOR_TI/
gestao-ti/backend/prisma/schema.prisma:1803                                      | SUPORTE_TI      | // SUPORTE_TI) vê/cria. Regra única 14/05 — espelha HistoricoChamado.publico
gestao-ti/backend/prisma/schema.prisma:611                                       | INFRAESTRUTURA  | INFRAESTRUTURA
gestao-ti/backend/prisma/schema.prisma:860                                       | INFRAESTRUTURA  | INFRAESTRUTURA
gestao-ti/backend/prisma/schema.prisma:944                                       | INFRAESTRUTURA  | INFRAESTRUTURA
gestao-ti/backend/prisma/seed.ts:656                                             | INFRAESTRUTURA  | tipo: 'INFRAESTRUTURA',
gestao-ti/backend/src/ativo/ativo.controller.ts:43                               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/ativo/ativo.controller.ts:49                               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/ativo/ativo.controller.ts:55                               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/ativo/ativo.controller.ts:61                               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/ativo/ativo.controller.ts:72                               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/ativo/ativo.controller.ts:78                               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/catalogo-servico/catalogo-servico.controller.ts:28         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/catalogo-servico/catalogo-servico.controller.ts:34         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/catalogo-servico/catalogo-servico.controller.ts:40         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/catalogo-servico/catalogo-servico.controller.ts:46         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:139                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:139                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:145                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:145                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:156                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:156                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:188                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:188                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:199                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:199                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:219                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:229                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:229                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:239                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:239                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:312                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:312                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:325                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:325                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:336                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:336                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:364                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:364                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:377                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:377                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:388                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/chamado.controller.ts:388                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/chamado/services/chamado-agrupamento.service.ts:22         | GESTOR_TI       | * - Apenas T.I. (ADMIN/GESTOR_TI/SUPORTE_TI) agrupa/desagrupa.
gestao-ti/backend/src/chamado/services/chamado-agrupamento.service.ts:22         | SUPORTE_TI      | * - Apenas T.I. (ADMIN/GESTOR_TI/SUPORTE_TI) agrupa/desagrupa.
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:1382              | GESTOR_TI       | const rolesPermitidas = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:1382              | SUPORTE_TI      | const rolesPermitidas = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:429               | GESTOR_TI       | // (vazamento). Regra única: staff = ADMIN/GESTOR_TI/SUPORTE_TI (isTI).
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:429               | SUPORTE_TI      | // (vazamento). Regra única: staff = ADMIN/GESTOR_TI/SUPORTE_TI (isTI).
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:448               | DESENVOLVEDOR   | // (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA, USUARIO_CHAVE,
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:448               | INFRAESTRUTURA  | // (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA, USUARIO_CHAVE,
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:448               | MANUTENCAO      | // (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA, USUARIO_CHAVE,
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:452               | GESTOR_TI       | const ROLES_PODE_PRIVADO = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:452               | SUPORTE_TI      | const ROLES_PODE_PRIVADO = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:457               | GESTOR_TI       | 'Apenas equipe de TI (ADMIN/GESTOR_TI/SUPORTE_TI) pode criar chamados PRIVADOS',
gestao-ti/backend/src/chamado/services/chamado-core.service.ts:457               | SUPORTE_TI      | 'Apenas equipe de TI (ADMIN/GESTOR_TI/SUPORTE_TI) pode criar chamados PRIVADOS',
gestao-ti/backend/src/common/constants/roles.constant.ts:10                      | GESTOR_TI       | export const ROLES_TI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'] as const;
gestao-ti/backend/src/common/constants/roles.constant.ts:10                      | SUPORTE_TI      | export const ROLES_TI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'] as const;
gestao-ti/backend/src/common/constants/roles.constant.ts:6                       | GESTOR_TI       | /** Roles com acesso de gestao (ADMIN + GESTOR_TI) */
gestao-ti/backend/src/common/constants/roles.constant.ts:7                       | GESTOR_TI       | export const ROLES_GESTORES = ['ADMIN', 'GESTOR_TI'] as const;
gestao-ti/backend/src/common/constants/roles.constant.ts:9                       | SUPORTE_TI      | /** Roles de TI (inclui SUPORTE_TI) */
gestao-ti/backend/src/compra/compra.controller.ts:105                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/compra/compra.controller.ts:151                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:151                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:161                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:161                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:173                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:173                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:186                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/compra/compra.controller.ts:196                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:196                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:213                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:213                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:250                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:250                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/compra/compra.controller.ts:68                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/compra/compra.controller.ts:74                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/compra/compra.controller.ts:80                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/compra/compra.controller.ts:93                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/compra/compra.controller.ts:99                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/compra/services/compra-nota-fiscal.service.ts:126          | GESTOR_TI       | * ADMIN e GESTOR_TI sempre tem acesso. Outros precisam ser membro da equipe com podeGerirCompras.
gestao-ti/backend/src/compra/services/compra-nota-fiscal.service.ts:129          | GESTOR_TI       | if (role === 'ADMIN' || role === 'GESTOR_TI') return;
gestao-ti/backend/src/compra/services/compra-nota-fiscal.service.ts:131          | GESTOR_TI       | throw new ForbiddenException('NF sem equipe associada. Associe uma equipe ou solicite a um ADMIN/GESTOR_TI.');
gestao-ti/backend/src/compra/services/compra-nota-fiscal.service.ts:145          | GESTOR_TI       | if (role === 'ADMIN' || role === 'GESTOR_TI') {
gestao-ti/backend/src/compra/services/compra-nota-fiscal.service.ts:189          | GESTOR_TI       | if (usuarioId && role && role !== 'ADMIN' && role !== 'GESTOR_TI') {
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:134                | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:134                | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:64                 | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:64                 | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:70                 | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:70                 | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:76                 | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:76                 | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:82                 | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:82                 | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:95                 | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/conhecimento/conhecimento.controller.ts:95                 | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:106                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:112                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:118                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:131                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:137                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:143                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:184                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:184                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:190                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:190                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:201                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:201                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:212                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:212                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:230                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:230                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:241                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:241                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:253                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:253                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:265                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:276                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:276                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:294                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:294                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:305                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:305                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:318                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:318                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:330                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:330                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:342                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:342                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:359                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:359                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:371                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:371                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:389                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:389                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:435                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:435                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:454                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:454                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:465                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:465                        | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:56                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:62                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:68                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:81                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:87                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/contrato.controller.ts:93                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:29              | GESTOR_TI       | * ADMIN e GESTOR_TI sempre tem acesso. TECNICO precisa ser membro da equipe com podeGerirContratos.
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:29              | TECNICO         | * ADMIN e GESTOR_TI sempre tem acesso. TECNICO precisa ser membro da equipe com podeGerirContratos.
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:32              | GESTOR_TI       | if (role === 'ADMIN' || role === 'GESTOR_TI') return;
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:34              | GESTOR_TI       | throw new ForbiddenException('Contrato sem equipe associada. Associe uma equipe ao contrato ou solicite a um ADMIN/GESTOR_TI.');
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:62              | GESTOR_TI       | * ADMIN e GESTOR_TI sempre tem acesso. Outros precisam ser membro de alguma equipe com podeGerirContratos.
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:65              | GESTOR_TI       | if (role === 'ADMIN' || role === 'GESTOR_TI') return true;
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:96              | SUPORTE_TI      | // SUPORTE_TI e outros roles: filtrar por equipes com podeGerirContratos
gestao-ti/backend/src/contrato/services/contrato-core.service.ts:97              | GESTOR_TI       | if (usuarioId && role && role !== 'ADMIN' && role !== 'GESTOR_TI') {
gestao-ti/backend/src/dashboard/dashboard.controller.ts:171                      | SUPORTE_TI      | // Gestores e líderes de equipe (SUPORTE_TI) podem ver relatórios de outros técnicos
gestao-ti/backend/src/dashboard/dashboard.controller.ts:174                      | SUPORTE_TI      | const isSuporte = role === 'SUPORTE_TI';
gestao-ti/backend/src/dashboard/dashboard.controller.ts:182                      | SUPORTE_TI      | // SUPORTE_TI: validar que o tecnico e da sua equipe
gestao-ti/backend/src/dashboard/dashboard.controller.ts:92                       | SUPORTE_TI      | // SUPORTE_TI: retorna apenas tecnicos das equipes onde e lider
gestao-ti/backend/src/dashboard/dashboard.controller.ts:94                       | SUPORTE_TI      | if (role === 'SUPORTE_TI') {
gestao-ti/backend/src/equipe/equipe.controller.ts:39                             | GESTOR_TI       | * ADMIN/GESTOR_TI: todas as equipes ativas.
gestao-ti/backend/src/equipe/equipe.controller.ts:43                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:43                             | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:57                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:63                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:69                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:77                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:83                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:93                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/equipe/equipe.controller.ts:99                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/equipe/equipe.service.ts:201                               | GESTOR_TI       | * Para ADMIN/GESTOR_TI retorna todas as equipes ativas.
gestao-ti/backend/src/equipe/equipe.service.ts:205                               | GESTOR_TI       | if (role === 'ADMIN' || role === 'GESTOR_TI') {
gestao-ti/backend/src/export/export.controller.ts:15                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/export/export.controller.ts:15                             | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/export/export.controller.ts:21                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/export/export.controller.ts:21                             | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/export/export.controller.ts:31                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/export/export.controller.ts:31                             | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/import/import.controller.ts:18                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/import/import.controller.ts:37                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/licenca/licenca.controller.ts:30                           | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/licenca/licenca.controller.ts:36                           | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/licenca/licenca.controller.ts:42                           | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:102              | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:102              | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:108              | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:108              | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:40               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:40               | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:46               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:46               | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:53               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:53               | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:59               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:59               | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:65               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:65               | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:89               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:89               | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:95               | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/ordem-servico/ordem-servico.controller.ts:95               | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:112                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:112                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:118                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:118                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:124                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:124                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:134                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:134                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:140                            | GESTOR_TI       | * Reabre parada FINALIZADA → EM_ANDAMENTO. Equipe T.I. (ADMIN/GESTOR_TI/
gestao-ti/backend/src/parada/parada.controller.ts:141                            | SUPORTE_TI      | * SUPORTE_TI) pode reabrir — necessário para editar/anexar/adicionar
gestao-ti/backend/src/parada/parada.controller.ts:145                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:145                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:151                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:151                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:160                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:160                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:174                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:174                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:183                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:183                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:199                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:199                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:247                            | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:247                            | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:58                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:58                             | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:64                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:64                             | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:70                             | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/parada/parada.controller.ts:70                             | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:128                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:128                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:134                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:134                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:145                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:145                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:152                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:152                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:159                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:159                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:166                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:166                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:178                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:184                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:184                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:199                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:199                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:205                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:205                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:212                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:212                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:229                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:229                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:236                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:236                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:249                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:249                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:267                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:267                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:279                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:279                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:292                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:292                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:305                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:305                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:331                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:331                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:359                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:359                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:421                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:421                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:428                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:428                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:442                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:442                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:449                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:449                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:462                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:462                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:476                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:476                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:483                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:483                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:496                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:496                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:510                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:510                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:517                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:517                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:530                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:530                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:544                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:544                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:551                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:551                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:560                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:560                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:566                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:566                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:578                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:578                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:598                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:598                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:620                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:620                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:634                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:634                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:646                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:646                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:688                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:688                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:694                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:694                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:701                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:701                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:710                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:710                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:725                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:725                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:736                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:736                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:747                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:747                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:761                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:761                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:773                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:773                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:788                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:788                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:811                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:811                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
gestao-ti/backend/src/projeto/projeto.controller.ts:834                          | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/projeto.controller.ts:834                          | SUPORTE_TI      | @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
gestao-ti/backend/src/projeto/services/projeto-atividade.service.ts:379          | GESTOR_TI       | // ADMIN/GESTOR_TI/SUPORTE_TI). USUARIO_CHAVE/TERCEIRIZADO/non-staff só veem
gestao-ti/backend/src/projeto/services/projeto-atividade.service.ts:379          | SUPORTE_TI      | // ADMIN/GESTOR_TI/SUPORTE_TI). USUARIO_CHAVE/TERCEIRIZADO/non-staff só veem
gestao-ti/backend/src/projeto/services/projeto-core.service.ts:399               | GESTOR_TI       | * Permissão: ADMIN/GESTOR_TI sempre; SUPORTE_TI se for membro do projeto.
gestao-ti/backend/src/projeto/services/projeto-core.service.ts:399               | SUPORTE_TI      | * Permissão: ADMIN/GESTOR_TI sempre; SUPORTE_TI se for membro do projeto.
gestao-ti/backend/src/projeto/services/projeto-helpers.service.ts:125            | GESTOR_TI       | * TI (ADMIN/GESTOR_TI/SUPORTE_TI), responsavel, membro da equipe ou
gestao-ti/backend/src/projeto/services/projeto-helpers.service.ts:125            | SUPORTE_TI      | * TI (ADMIN/GESTOR_TI/SUPORTE_TI), responsavel, membro da equipe ou
gestao-ti/backend/src/projeto/services/projeto-helpers.service.ts:93             | GESTOR_TI       | * Verifica se o usuario e membro do projeto, responsavel ou ADMIN/GESTOR_TI.
gestao-ti/backend/src/projeto/services/projeto-helpers.service.ts:94             | SUPORTE_TI      | * SUPORTE_TI precisa ser membro do projeto para editar.
gestao-ti/backend/src/projeto/services/projeto-helpers.service.ts:97             | GESTOR_TI       | // ADMIN, GESTOR_TI e SUPORTE_TI podem editar qualquer projeto
gestao-ti/backend/src/projeto/services/projeto-helpers.service.ts:97             | SUPORTE_TI      | // ADMIN, GESTOR_TI e SUPORTE_TI podem editar qualquer projeto
gestao-ti/backend/src/projeto/services/projeto-pendencia.service.ts:103          | GESTOR_TI       | // GESTOR_TI/SUPORTE_TI (isTI). Antes filtrava apenas USUARIO_CHAVE e
gestao-ti/backend/src/projeto/services/projeto-pendencia.service.ts:103          | SUPORTE_TI      | // GESTOR_TI/SUPORTE_TI (isTI). Antes filtrava apenas USUARIO_CHAVE e
gestao-ti/backend/src/projeto/services/projeto-pendencia.service.ts:105          | DESENVOLVEDOR   | // DESENVOLVEDOR/MANUTENCAO/INFRAESTRUTURA) viam internos.
gestao-ti/backend/src/projeto/services/projeto-pendencia.service.ts:105          | INFRAESTRUTURA  | // DESENVOLVEDOR/MANUTENCAO/INFRAESTRUTURA) viam internos.
gestao-ti/backend/src/projeto/services/projeto-pendencia.service.ts:105          | MANUTENCAO      | // DESENVOLVEDOR/MANUTENCAO/INFRAESTRUTURA) viam internos.
gestao-ti/backend/src/projeto/services/projeto-pendencia.service.ts:364          | GESTOR_TI       | // Staff = ADMIN/GESTOR_TI/SUPORTE_TI (isTI). 14/05/2026 — alinhamento com
gestao-ti/backend/src/projeto/services/projeto-pendencia.service.ts:364          | SUPORTE_TI      | // Staff = ADMIN/GESTOR_TI/SUPORTE_TI (isTI). 14/05/2026 — alinhamento com
gestao-ti/backend/src/sla/sla.controller.ts:27                                   | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/sla/sla.controller.ts:33                                   | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/sla/sla.controller.ts:39                                   | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/sla/sla.controller.ts:45                                   | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:108                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:120                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:130                        | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:47                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:53                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:59                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:65                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:73                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:79                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:92                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/backend/src/software/software.controller.ts:98                         | GESTOR_TI       | @Roles('ADMIN', 'GESTOR_TI')
gestao-ti/frontend/src/components/tarefa-tabs/ConversaTab.tsx:24                 | GESTOR_TI       | /** staff TI (ADMIN/GESTOR_TI/SUPORTE_TI) — só eles criam nota interna. */
gestao-ti/frontend/src/components/tarefa-tabs/ConversaTab.tsx:24                 | SUPORTE_TI      | /** staff TI (ADMIN/GESTOR_TI/SUPORTE_TI) — só eles criam nota interna. */
gestao-ti/frontend/src/layouts/Sidebar.tsx:120                                   | SUPORTE_TI      | if (gestaoTiRole === 'SUPORTE_TI') {
gestao-ti/frontend/src/layouts/Sidebar.tsx:126                                   | SUPORTE_TI      | if ('label' in item && item.label === 'Contratos' && gestaoTiRole === 'SUPORTE_TI') {
gestao-ti/frontend/src/layouts/Sidebar.tsx:44                                    | GESTOR_TI       | const STAFF = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/layouts/Sidebar.tsx:44                                    | SUPORTE_TI      | const STAFF = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/layouts/Sidebar.tsx:45                                    | GESTOR_TI       | const MANAGERS = ['ADMIN', 'GESTOR_TI'];
gestao-ti/frontend/src/layouts/Sidebar.tsx:46                                    | GESTOR_TI       | const CONTRATO_ROLES_STATIC = ['ADMIN', 'GESTOR_TI'];
gestao-ti/frontend/src/layouts/Sidebar.tsx:47                                    | GESTOR_TI       | const CONTRATO_ROLES_DYNAMIC = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/layouts/Sidebar.tsx:47                                    | SUPORTE_TI      | const CONTRATO_ROLES_DYNAMIC = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/layouts/Sidebar.tsx:71                                    | INFRAESTRUTURA  | { section: 'INFRAESTRUTURA', roles: STAFF },
gestao-ti/frontend/src/pages/DashboardPage.tsx:72                                | GESTOR_TI       | const STAFF_ROLES = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/DashboardPage.tsx:72                                | SUPORTE_TI      | const STAFF_ROLES = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/DashboardPage.tsx:73                                | GESTOR_TI       | const MANAGERS = ['ADMIN', 'GESTOR_TI'];
gestao-ti/frontend/src/pages/acompanhamento/AcompanhamentoItemPage.tsx:118       | GESTOR_TI       | const isManager = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/acompanhamento/AcompanhamentoPage.tsx:317           | GESTOR_TI       | const isManager = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/acompanhamento/RelatorioOsPage.tsx:66               | GESTOR_TI       | const isManager = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/acompanhamento/RelatorioOsPage.tsx:66               | SUPORTE_TI      | const isManager = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/ativos/AtivoDetalhePage.tsx:33                      | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/ativos/AtivosListPage.tsx:50                        | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/CategoriaLicencaPage.tsx:14               | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/ChamadosExternosPage.tsx:24               | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/FornecedoresPage.tsx:14                   | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/NaturezasPage.tsx:14                      | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/ProdutosPage.tsx:15                       | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/TiposContratoPage.tsx:14                  | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/TiposProdutoPage.tsx:14                   | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/cadastros/TiposProjetoPage.tsx:14                   | GESTOR_TI       | const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/catalogo/CatalogoServicosPage.tsx:19                | GESTOR_TI       | const isAdmin = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/centros-custo/CentrosCustoPage.tsx:14               | GESTOR_TI       | const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:146                  | GESTOR_TI       | const isStaff = gestaoTiRole && ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:18                   | GESTOR_TI       | const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR_TI', 'SUPORTE_TI']);
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:18                   | SUPORTE_TI      | const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR_TI', 'SUPORTE_TI']);
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:32                   | GESTOR_TI       | // Visibilidade PRIVADO restrita à equipe de TI (ADMIN/GESTOR_TI/SUPORTE_TI —
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:32                   | SUPORTE_TI      | // Visibilidade PRIVADO restrita à equipe de TI (ADMIN/GESTOR_TI/SUPORTE_TI —
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:34                   | DESENVOLVEDOR   | // Demais roles (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA,
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:34                   | INFRAESTRUTURA  | // Demais roles (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA,
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:34                   | MANUTENCAO      | // Demais roles (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA,
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:37                   | GESTOR_TI       | const podeEscolherVisibilidade = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole ?? '');
gestao-ti/frontend/src/pages/chamados/ChamadoCreatePage.tsx:37                   | SUPORTE_TI      | const podeEscolherVisibilidade = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole ?? '');
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:1073                | GESTOR_TI       | const rolesStaff = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:1073                | SUPORTE_TI      | const rolesStaff = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:161                 | GESTOR_TI       | const isTecnico = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:161                 | SUPORTE_TI      | const isTecnico = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:162                 | GESTOR_TI       | const isGestor = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:17                  | GESTOR_TI       | const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR_TI', 'SUPORTE_TI']);
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:17                  | SUPORTE_TI      | const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR_TI', 'SUPORTE_TI']);
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:615                 | GESTOR_TI       | {/* Checkbox e "Solicitar info" só pra staff TI (ADMIN/GESTOR_TI/
gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx:616                 | SUPORTE_TI      | SUPORTE_TI). Antes mostrava pra todos !USUARIO_FINAL — incluindo
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:104                   | DESENVOLVEDOR   | const isStaffTI = gestaoTiRole && ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'TECNICO', 'DESENVOLVEDOR', 'INFRAESTRUTURA', 'MANUTENCAO'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:104                   | GESTOR_TI       | const isStaffTI = gestaoTiRole && ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'TECNICO', 'DESENVOLVEDOR', 'INFRAESTRUTURA', 'MANUTENCAO'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:104                   | INFRAESTRUTURA  | const isStaffTI = gestaoTiRole && ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'TECNICO', 'DESENVOLVEDOR', 'INFRAESTRUTURA', 'MANUTENCAO'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:104                   | MANUTENCAO      | const isStaffTI = gestaoTiRole && ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'TECNICO', 'DESENVOLVEDOR', 'INFRAESTRUTURA', 'MANUTENCAO'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:104                   | SUPORTE_TI      | const isStaffTI = gestaoTiRole && ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'TECNICO', 'DESENVOLVEDOR', 'INFRAESTRUTURA', 'MANUTENCAO'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:104                   | TECNICO         | const isStaffTI = gestaoTiRole && ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'TECNICO', 'DESENVOLVEDOR', 'INFRAESTRUTURA', 'MANUTENCAO'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:154                   | GESTOR_TI       | const isStaff = gestaoTiRole && ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:163                   | GESTOR_TI       | const rolesStaff = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/chamados/ChamadosListPage.tsx:163                   | SUPORTE_TI      | const rolesStaff = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/compras/NotaFiscalDetalhePage.tsx:30                | GESTOR_TI       | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/compras/NotaFiscalDetalhePage.tsx:30                | SUPORTE_TI      | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/compras/NotaFiscalDetalhePage.tsx:31                | GESTOR_TI       | const canDelete = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/compras/NotaFiscalFormPage.tsx:95                   | GESTOR_TI       | const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/compras/NotasFiscaisListPage.tsx:31                 | GESTOR_TI       | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/compras/NotasFiscaisListPage.tsx:31                 | SUPORTE_TI      | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/conhecimento/ConhecimentoDetalhePage.tsx:41         | GESTOR_TI       | const canEdit = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/conhecimento/ConhecimentoDetalhePage.tsx:41         | SUPORTE_TI      | const canEdit = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/conhecimento/ConhecimentoDetalhePage.tsx:43         | GESTOR_TI       | const canDelete = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/conhecimento/ConhecimentoDetalhePage.tsx:43         | SUPORTE_TI      | const canDelete = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/conhecimento/ConhecimentoListPage.tsx:28            | GESTOR_TI       | const canCreate = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/conhecimento/ConhecimentoListPage.tsx:28            | SUPORTE_TI      | const canCreate = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/contratos/ContratoDetalhePage.tsx:149               | GESTOR_TI       | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/contratos/ContratoDetalhePage.tsx:149               | SUPORTE_TI      | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/contratos/ContratoFormPage.tsx:180                  | GESTOR_TI       | : 'Solicite a um ADMIN/GESTOR_TI para associar uma equipe a este contrato.'}
gestao-ti/frontend/src/pages/contratos/ContratoFormPage.tsx:19                   | GESTOR_TI       | const isManager = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/contratos/ContratoFormPage.tsx:233                  | GESTOR_TI       | {/* Em modo edicao, apenas ADMIN/GESTOR_TI pode alterar a equipe */}
gestao-ti/frontend/src/pages/contratos/ContratoFormPage.tsx:250                  | GESTOR_TI       | Apenas ADMIN/GESTOR_TI pode alterar a equipe responsavel
gestao-ti/frontend/src/pages/contratos/ContratosListPage.tsx:33                  | GESTOR_TI       | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/contratos/ContratosListPage.tsx:33                  | SUPORTE_TI      | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/departamentos/DepartamentosPage.tsx:14              | GESTOR_TI       | const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/equipes/EquipeDetalhePage.tsx:16                    | GESTOR_TI       | const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/equipes/EquipesListPage.tsx:20                      | GESTOR_TI       | const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:109            | GESTOR_TI       | // Filtra apenas staff de TI (ADMIN, GESTOR_TI, SUPORTE_TI) — outros usuários
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:109            | SUPORTE_TI      | // Filtra apenas staff de TI (ADMIN, GESTOR_TI, SUPORTE_TI) — outros usuários
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:112            | GESTOR_TI       | const rolesStaff = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:112            | SUPORTE_TI      | const rolesStaff = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:120            | GESTOR_TI       | const isStaff = gestaoTiRole && ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole);
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:46             | GESTOR_TI       | const isTecnico = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:46             | SUPORTE_TI      | const isTecnico = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/ordens-servico/OrdensServicoPage.tsx:484            | GESTOR_TI       | {(h.usuario.id === usuario?.id || ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '')) && (
gestao-ti/frontend/src/pages/portfolio/LicencasPage.tsx:39                       | GESTOR_TI       | const isAdmin = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/portfolio/LicencasPage.tsx:39                       | SUPORTE_TI      | const isAdmin = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/portfolio/SoftwareDetalhePage.tsx:71                | GESTOR_TI       | const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/portfolio/SoftwareFormPage.tsx:166                  | INFRAESTRUTURA  | <option value="INFRAESTRUTURA">Infraestrutura</option>
gestao-ti/frontend/src/pages/portfolio/SoftwaresListPage.tsx:31                  | INFRAESTRUTURA  | INFRAESTRUTURA: 'Infraestrutura',
gestao-ti/frontend/src/pages/portfolio/SoftwaresListPage.tsx:52                  | GESTOR_TI       | const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/projetos/PendenciaDetalhePage.tsx:43                | GESTOR_TI       | const isGestor = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/projetos/PendenciaDetalhePage.tsx:45                | GESTOR_TI       | const isStaffTI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/projetos/PendenciaDetalhePage.tsx:45                | SUPORTE_TI      | const isStaffTI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/projetos/PendenciaDetalhePage.tsx:513               | GESTOR_TI       | {/* Checkbox só pra staff TI (ADMIN/GESTOR_TI/SUPORTE_TI). Antes era
gestao-ti/frontend/src/pages/projetos/PendenciaDetalhePage.tsx:513               | SUPORTE_TI      | {/* Checkbox só pra staff TI (ADMIN/GESTOR_TI/SUPORTE_TI). Antes era
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:126                 | INFRAESTRUTURA  | MAO_DE_OBRA: 'Mao de Obra', INFRAESTRUTURA: 'Infraestrutura', LICENCIAMENTO: 'Licenciamento', CONSULTORIA: 'Consultoria', TREINAMENTO: 'Treinamento', VIAGEM: 'Viagem', MATERIAL: 'Material', OUTRO: 'Ou
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:129                 | INFRAESTRUTURA  | MAO_DE_OBRA: 'bg-capul-100 text-capul-700', INFRAESTRUTURA: 'bg-blue-100 text-blue-700', LICENCIAMENTO: 'bg-cyan-100 text-cyan-700', CONSULTORIA: 'bg-amber-100 text-amber-700', TREINAMENTO: 'bg-green-
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:197                 | GESTOR_TI       | // canManage: usuario deve ser membro/responsavel do projeto (ou ADMIN/GESTOR_TI)
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:199                 | GESTOR_TI       | const isGestorOrAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:687                 | GESTOR_TI       | <TabCronograma projetoId={projeto.id} isCompleto={isCompleto} canManage={canManage} canAdd={canAddAtividade} userId={usuario?.id || ''} isGestor={gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_T
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:858                 | GESTOR_TI       | const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR_TI', 'SUPORTE_TI']);
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:858                 | SUPORTE_TI      | const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR_TI', 'SUPORTE_TI']);
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:86                  | INFRAESTRUTURA  | INFRAESTRUTURA: 'Infraestrutura',
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:873                 | GESTOR_TI       | Quem executa tecnicamente o projeto (ADMIN / GESTOR_TI / SUPORTE_TI). Para usuarios-chave / terceirizados (negocio), use a aba <strong>Usuarios-Chave</strong> ao lado.
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:873                 | SUPORTE_TI      | Quem executa tecnicamente o projeto (ADMIN / GESTOR_TI / SUPORTE_TI). Para usuarios-chave / terceirizados (negocio), use a aba <strong>Usuarios-Chave</strong> ao lado.
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:936                 | GESTOR_TI       | const isStaffTI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx:936                 | SUPORTE_TI      | const isStaffTI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/projetos/ProjetoFormPage.tsx:62                     | GESTOR_TI       | // ADMIN, GESTOR_TI, SUPORTE_TI (staff TI) + USUARIO_CHAVE (negócio liderando projeto).
gestao-ti/frontend/src/pages/projetos/ProjetoFormPage.tsx:62                     | SUPORTE_TI      | // ADMIN, GESTOR_TI, SUPORTE_TI (staff TI) + USUARIO_CHAVE (negócio liderando projeto).
gestao-ti/frontend/src/pages/projetos/ProjetoFormPage.tsx:64                     | GESTOR_TI       | const rolesElegiveis = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE'];
gestao-ti/frontend/src/pages/projetos/ProjetoFormPage.tsx:64                     | SUPORTE_TI      | const rolesElegiveis = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE'];
gestao-ti/frontend/src/pages/projetos/RelatorioProjetoPage.tsx:141               | INFRAESTRUTURA  | MAO_DE_OBRA: 'Mao de Obra', INFRAESTRUTURA: 'Infraestrutura',
gestao-ti/frontend/src/pages/sla/SlaPage.tsx:19                                  | GESTOR_TI       | const isAdmin = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/sustentacao/MotivosParadaPage.tsx:11                | GESTOR_TI       | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/sustentacao/MotivosParadaPage.tsx:11                | SUPORTE_TI      | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/sustentacao/ParadaDetalhePage.tsx:60                | GESTOR_TI       | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/sustentacao/ParadaDetalhePage.tsx:60                | SUPORTE_TI      | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/sustentacao/ParadaDetalhePage.tsx:62                | GESTOR_TI       | // Igualdade total entre ADMIN/GESTOR_TI/SUPORTE_TI no módulo Paradas
gestao-ti/frontend/src/pages/sustentacao/ParadaDetalhePage.tsx:62                | SUPORTE_TI      | // Igualdade total entre ADMIN/GESTOR_TI/SUPORTE_TI no módulo Paradas
gestao-ti/frontend/src/pages/sustentacao/ParadasListPage.tsx:52                  | GESTOR_TI       | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/pages/sustentacao/ParadasListPage.tsx:52                  | SUPORTE_TI      | const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
gestao-ti/frontend/src/services/equipe.service.ts:51                             | GESTOR_TI       | * Para ADMIN/GESTOR_TI retorna todas. Para SUPORTE_TI, apenas as autorizadas.
gestao-ti/frontend/src/services/equipe.service.ts:51                             | SUPORTE_TI      | * Para ADMIN/GESTOR_TI retorna todas. Para SUPORTE_TI, apenas as autorizadas.
gestao-ti/frontend/src/types/index.ts:109                                        | INFRAESTRUTURA  | export type TipoSoftware = 'ERP' | 'CRM' | 'SEGURANCA' | 'COLABORACAO' | 'INFRAESTRUTURA' | 'OPERACIONAL' | 'OUTROS';
gestao-ti/frontend/src/types/index.ts:738                                        | INFRAESTRUTURA  | export type TipoProjeto = 'DESENVOLVIMENTO_INTERNO' | 'IMPLANTACAO_TERCEIRO' | 'INFRAESTRUTURA' | 'OUTRO';
gestao-ti/frontend/src/types/index.ts:826                                        | INFRAESTRUTURA  | export type CategoriaCusto = 'MAO_DE_OBRA' | 'INFRAESTRUTURA' | 'LICENCIAMENTO' | 'CONSULTORIA' | 'TREINAMENTO' | 'VIAGEM' | 'MATERIAL' | 'OUTRO';
```

</details>

## 4. Estimativa de esforço (heurística)

Critério: 1 arquivo único = ~1-3 minutos de revisão+rename. Arquivos com muitas
ocorrências do mesmo literal são candidatos a `sed -i` mecânico; arquivos com
literais diferentes exigem revisão caso-a-caso.

- **Arquivos de produção únicos com literais**: 81
- **Arquivos de teste únicos com literais**: 2
- **Arquivos de documentação únicos**: 1

**Estimativa bruta:** 164 minutos (~2.7 horas) de rename + revisão.
Soma-se ~2h de testes manuais (smoke test JWT + RBAC) → total Lote 1.7 entre 4-8h.

## 5. Recomendações para a Onda 1 (Lote 1.7)

1. **Estratégia de rename mecânico vs revisão manual:**
   - Arquivos com `GESTOR_TI` ou `SUPORTE_TI` em isolado (constantes, types, fixtures): `sed -i` mecânico aceita.
   - Arquivos com TECNICO/DESENVOLVEDOR/MANUTENCAO/INFRAESTRUTURA: **revisar caso-a-caso** — pode ser referência a permissão obsoleta que precisa ser **removida** (não renomeada).

2. **Ordem sugerida pra rename:**
   a. Backend Node (constantes em `common/constants/roles.constant.ts`, decorators de guard).
   b. Schema Prisma (seed pra roles_modulo).
   c. Frontend (componentes de Configurador, RoleSelect, etc.).
   d. Testes (atualizar fixtures).
   e. Docs (atualizar README, documentacao-tecnica).

3. **Testes obrigatórios pós-rename:**
   - Smoke test de login (JWT carrega role correta).
   - RBAC guard em rota privada (`@Roles('GESTOR')` aceita usuário recém-renomeado).
   - UI Configurador renderiza dropdown de roles sem as 4 removidas.

4. **NÃO renomear**:
   - Migrations Prisma já aplicadas (são histórico — não tocar).
   - Arquivos do diretório `memory/` do Claude (são point-in-time).

---

_Auditoria executada por `scripts/workspace-auditoria-literais.sh`. Para regenerar: rode o script novamente._
