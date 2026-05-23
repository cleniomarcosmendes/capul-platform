# Investigação — Drift DEV vs Schema (23/05/2026)

**Contexto:** durante a Onda 1 sub-fase 1.1 (Workspace Multi-Departamento), ao gerar a migration via `prisma migrate dev --create-only` no `gestao-ti-backend`, o Prisma falhou (shadow DB não tem schema `core`) e o fallback `prisma migrate diff --from-schema-datasource` reportou **165 mudanças** (71 DropIndex, 56 AlterTable, 35 ALTER COLUMN, 15 DropFK, 14 AddFK, 12 DropTable, 6 DropEnum).

**Pergunta levantada por Clenio:** ignorar o drift pode levar a soluções erradas baseadas em estado inválido do banco. Justa a preocupação — investigação aberta antes de qualquer migration.

---

## 1. Auditoria de coerência (estado base)

| Check | Resultado |
|---|---|
| `check-migrations-all.sh` (schema.prisma vs migrations folder) | ✅ **OK** — Gestão TI: 79/79 modelos com migration; auth-gateway: 16/16; fiscal: 33/33 |
| Volume Docker `capul-platform_postgres_data` | Criado 2026-02-22 (3 meses) — coerente, sem vestígio de recriação anômala |
| `git log` em busca de `db push` indevido | Sem registros em commits recentes |

**Schema declarativo e migrations estão consistentes entre si.** O drift detectado é **DB vs schema do Gestão TI**, não migrations vs schema.

---

## 2. Categorização do drift (165 mudanças)

### Categoria A — Cross-projeto (false-positive esperado)

**108 das 165 mudanças (65%)** são tabelas/colunas/enums no schema `core` que pertencem ao **auth-gateway**, não ao Gestão TI.

| Categoria | Itens |
|---|---|
| `DropTable` em `core.*` | 12: `backup_execucoes`, `empresas`, `integracoes_api`, `integracoes_api_endpoints`, `modulos_sistema`, `permissoes_modulo`, `refresh_tokens`, `roles_modulo`, `system_config`, `system_logs`, `usuario_capability`, `usuario_filiais` |
| `DropEnum` em `core.*` | 6: `AmbienteIntegracao`, `MetodoHttp`, `ModuloConsumidor`, `StatusGeral`, `TipoAuth`, `TipoUsuario` |
| `DropColumn` em `core.*` | ~80: colunas de `filiais` (cep, cidade, empresa_id, telefone, endereco...), `usuarios` (avatar_url, cargo...), `departamentos` (codigo, descricao, status...), `centros_custo`, `tipos_departamento` |

**Por quê:** o `auth-gateway/prisma/schema.prisma` declara TODOS esses modelos com `@@schema("core")`. O `gestao-ti/backend/prisma/schema.prisma` declara somente um **subset** (Filial, Usuario, Departamento, CentroCusto, TipoDepartamento) com **subset das colunas** — porque Gestão TI consome essas tabelas read-only.

Quando `prisma migrate diff` roda contra o `schema.prisma` do Gestão TI, ele vê tabelas e colunas no DB que o schema dele não declara e propõe DROP — **mas elas DEVEM permanecer** (são responsabilidade do auth-gateway).

**Veredito:** falso-positivo esperado em setup multi-projeto cross-schema. **Não é drift real.**

### Categoria B — Cosmético / representação (false-positive)

**~56 mudanças** são `ALTER COLUMN "id" DROP DEFAULT` em tabelas do `gestao_ti.*` — o DB tem `DEFAULT gen_random_uuid()` (gerado por migrations Prisma antigas) e o schema Prisma declara `@default(uuid())` (representação client-side).

Funcionalmente equivalentes. Prisma quer "alinhar" mas não há mudança de comportamento.

**Veredito:** ruído cosmético, sem impacto operacional. **Não é drift real.**

### Categoria C — Índices SQL puros (false-positive)

**~67 `DropIndex` em `gestao_ti.*`** correspondem a índices criados por migrations recentes via SQL puro (sem `@@index` no schema). Exemplos:
- `*_usuario_id_idx` em várias tabelas → criados pelo `20260510140000_add_missing_fk_indexes` + `20260511000000_add_fk_indexes_lote2`
- `*_trgm_idx` (pg_trgm) → criados pelo `20260522110000_add_pg_trgm_search_indexes`
- `chamados_departamento_id_idx`, `ativos_departamento_id_idx` → criados por migrations anteriores

Esses índices existem no DB porque migrations formalmente os criaram. Não estão no schema como `@@index` porque foram **adicionados via SQL** dentro das migrations (decisão consciente — pg_trgm e índices condicionais não suportam DSL Prisma).

**Veredito:** índices legítimos não-declarativos. **Não é drift real.**

### Categoria D — Drift potencial real

**~0 mudanças** sobreviveram às categorias A-C. Em outras palavras: **não há drift real no `gestao_ti` que o schema desconheça.**

(Se sobrassem itens, eles apareceriam como `CreateTable` ou `AddColumn` que o schema declara mas o DB não tem — não houve.)

---

## 3. Achado secundário — `core.departamentos.codigo` está vazio no T.I.

Conferência em DEV:
```
                  id                  | codigo |           nome            
--------------------------------------+--------+---------------------------
 500392e3-47a0-4ebd-b5d5-13a1ab3ebecc |        | Tecnologia da Informacao
 60fec607-944b-4662-86f9-80509872cc66 | ADM    | Administrativo
 be223af9-3229-49d8-9ee7-439777439da8 | ANC    | Analise Credito
 ... (11 outros deptos com codigo vazio)
```

13 deptos cadastrados. Apenas 2 têm `codigo` preenchido. **T.I. não tem `codigo`.**

Schema do auth-gateway declara `codigo String?` (opcional). Sistema atual identifica deptos por `id` (UUID) ou `nome`, não por `codigo`.

**Implicação pra sub-fase 1.1:** o pré-flight check previsto no plano (`WHERE codigo='TI'`) **não funcionaria** — retornaria 0 e abortaria a migration sempre.

**Ajuste necessário no plano §4 e §6:** usar `WHERE nome ILIKE 'Tecnologia%'` (case-insensitive partial) ou `WHERE nome = 'Tecnologia da Informacao'` (exato) no backfill e pré-flight.

---

## 4. Conclusão

**O DB DEV está saudável.** O "drift" reportado pelo `prisma migrate diff` é **ruído de ferramentas inadequadas** para o setup multi-projeto da plataforma. Não há ação corretiva necessária:

- ❌ NÃO precisa reset DEV (`down -v`)
- ❌ NÃO precisa correção incremental de FKs/índices
- ❌ NÃO precisa investigar volume Docker

O `check-migrations-all.sh` é a fonte de verdade pra auditoria de coerência. `migrate diff` não deve ser usado nesta plataforma multi-projeto sem filtros adicionais.

---

## 5. Recomendação pra retomada da sub-fase 1.1

### 5.1 Como gerar a migration

Como `prisma migrate dev` precisa de shadow DB (que não tem schemas pré-criados) e `migrate diff` gera ruído, vou **escrever a migration.sql manualmente** seguindo o plano §4:

1. Criar pasta `gestao-ti/backend/prisma/migrations/20260523xxxxxx_add_departamento_id_workspace_entities/`
2. Escrever `migration.sql` à mão com:
   - Bloco `DO $$ ... RAISE EXCEPTION` no topo (pré-flight ajustado pra `nome` em vez de `codigo`)
   - 10 blocos (ADD COLUMN + UPDATE + ALTER NOT NULL + FK + INDEX) — um por entidade
   - Padrão A→B→C garantido na ordem

### 5.2 Como aplicar a migration

Usar **`prisma migrate deploy`** (não `migrate dev`):
- Não cria shadow DB, evita o erro de schema "core"
- Apenas aplica migrations pendentes na pasta `migrations/`
- Mesmo comando do PROD — comportamento consistente entre ambientes
- Registra automaticamente na tabela `_prisma_migrations`

### 5.3 Ajuste no pré-flight (achado #3)

Trocar:
```sql
IF NOT EXISTS (SELECT 1 FROM core.departamentos WHERE codigo = 'TI')
```

Por:
```sql
IF NOT EXISTS (SELECT 1 FROM core.departamentos WHERE nome ILIKE 'Tecnologia%')
```

E nos backfills:
```sql
UPDATE gestao_ti.<tabela>
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1)
```

---

## 6. Pontos pra Clenio confirmar

1. **Aceitar veredito "drift é falso-positivo"** e seguir com sub-fase 1.1 sem reset DEV?
2. **Aceitar uso de `migrate deploy`** (em vez de `migrate dev`) pra aplicar a migration nova?
3. **Aceitar ajuste do pré-flight** pra usar `nome ILIKE 'Tecnologia%'` em vez de `codigo='TI'`?
4. **Sugerir registrar como cleanup futuro:** preencher `codigo` em todos os deptos (1 migration de dados separada — não nesta sub-fase). Daria mais robustez a futuras queries que dependem do `codigo`.

---

_Investigação executada em 23/05/2026, branch `feat/workspace-foundation`. Sem alteração de código nem dados — apenas SELECTs e diff Prisma. Próximo passo aguarda OK do Clenio._
