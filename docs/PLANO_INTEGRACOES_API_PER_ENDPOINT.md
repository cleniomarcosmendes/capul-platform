# Plano v2 — Per-endpoint ambiente + segregação por módulo

> **Status:** PROPOSTA (v2) | **Autores:** Claude Code + Clenio | **Data:** 20/04/2026 (revisado)
> **Estimativa:** 4–5h | **Origem:** `memory/project_fiscal_retomar_21abr.md` (TODO 1)
>
> **Diferença para v1:** além do per-endpoint `ativo`, adiciona coluna `modulo` em
> `integracoes_api_endpoints` e segrega UI + resolver por módulo consumidor.
> Motivação: hoje Fiscal, Gestão TI e Inventário compartilham o mesmo pool de 10
> operações Protheus — uma troca afeta os 3 de uma vez.

---

## 1. Contexto e problema

A integração Protheus (`core.integracoes_api` codigo=`PROTHEUS`) hoje:

- Tem um único atributo `ambiente` global → troca é tudo-ou-nada.
- Agrupa 10 operações consumidas por **3 módulos distintos** sem marcação de quem usa o quê.
- UI mostra dots HOMOL/PROD por linha, mas são só indicadores — não são clicáveis.

**Mapeamento real dos consumidores (validado 20/04):**

| Módulo | Operações |
|--------|-----------|
| **FISCAL** | `xmlNfe`, `grvXML`, `eventosNfe`, `cadastroFiscal` |
| **GESTAO_TI** | `INFOCLIENTES` |
| **INVENTARIO** | `DIGITACAO`, `HIERARQUIA`, `HISTORICO`, `PRODUTOS`, `TRANSFERENCIA` |

**Dor operacional atual (sessão 20/04):** durante homologação do Fiscal precisamos
`xmlNfe=HOM` + `grvXML=HOM`, enquanto inventário está em PROD e pode precisar
continuar assim. Hoje não dá.

**Dor arquitetural:** qualquer troca em uma operação invalida o cache dos 3
módulos simultaneamente (resolver do Fiscal recarrega por conta de mudança no
`INFOCLIENTES` que ele nem consome).

---

## 2. Estado atual

### 2.1 Schema (`auth-gateway/prisma/schema.prisma:272-309`)

```prisma
model IntegracaoApi {
  id        String             @id
  codigo    String             @unique         // "PROTHEUS"
  ambiente  AmbienteIntegracao @default(HOMOLOGACAO)  // GLOBAL ← remover
  ativo     Boolean            @default(true)         // liga/desliga integração inteira
  endpoints IntegracaoApiEndpoint[]
}

model IntegracaoApiEndpoint {
  id           String             @id
  ambiente     AmbienteIntegracao                 // já per-linha ✓
  operacao     String
  url          String
  ativo        Boolean            @default(true)  // hoje todos true (inútil)
  // ← falta: modulo
  @@unique([integracaoId, ambiente, operacao])
}
```

**Dados produção (20/04):** 10 operações × 2 ambientes = 20 linhas, todas `ativo=true`.

### 2.2 Consumidores do endpoint interno

`GET /api/v1/internal/integracoes/codigo/PROTHEUS/endpoints-ativos` é consumido por:

| Consumidor | Arquivo | Uso atual |
|------------|---------|-----------|
| Fiscal | `fiscal/backend/src/protheus/integracao-api.resolver.ts` | cache 5min + `find(operacao=X)` |
| Gestão TI | `gestao-ti/backend/src/protheus/protheus.service.ts` | cache 5min + `find(operacao=INFOCLIENTES)` |
| Inventário | `inventario/backend/app/core/protheus_config.py` | cache 5min (Python) + `get_url(op)` |

Todos leem `config.ambiente` **apenas para log** — não para routing.

---

## 3. Proposta

### 3.1 Princípios

1. **`ativo` passa a ser a fonte de verdade** do endpoint em uso por
   (integração, operação). A coluna global `integracoes_api.ambiente` é removida.
2. **Novo campo `modulo`** em `integracoes_api_endpoints` segrega endpoints pelo
   módulo consumidor (FISCAL / GESTAO_TI / INVENTARIO). Resolver e UI filtram por
   módulo → mudança em um não afeta cache do outro.
3. **Invariante:** para cada `(integracao_id, modulo, operacao)`, no máximo 1
   linha com `ativo=true`.

### 3.2 Mudanças no schema

```diff
 model IntegracaoApi {
   id        String             @id
   codigo    String             @unique
-  ambiente  AmbienteIntegracao @default(HOMOLOGACAO)
   ...
 }

 model IntegracaoApiEndpoint {
   ...
+  modulo   ModuloConsumidor                     // FISCAL | GESTAO_TI | INVENTARIO
   operacao String
   url      String
   ativo    Boolean @default(true)               // mantido true — invariante garantida por partial index
   ...
-  @@unique([integracaoId, ambiente, operacao])
+  @@unique([integracaoId, modulo, ambiente, operacao])
 }

+enum ModuloConsumidor {
+  FISCAL
+  GESTAO_TI
+  INVENTARIO
+}
```

Partial unique index (não expressável em Prisma, migration SQL):

```sql
CREATE UNIQUE INDEX integracoes_api_endpoints_ativo_unico
  ON core.integracoes_api_endpoints (integracao_id, modulo, operacao)
  WHERE ativo = true;
```

**Ajuste importante vs. v1:** manter `ativo @default(true)` (criar endpoint novo
já fica ativo — P2002 se violar invariante, controller pede para desativar o
irmão). Evita friction desnecessária.

### 3.3 Migração de dados (SQL idempotente)

```sql
-- 1. Adicionar coluna modulo (nullable temporariamente)
ALTER TABLE core.integracoes_api_endpoints
  ADD COLUMN modulo TEXT;

-- 2. Popular modulo pelo mapeamento conhecido
UPDATE core.integracoes_api_endpoints SET modulo = 'FISCAL'
 WHERE operacao IN ('xmlNfe','grvXML','eventosNfe','cadastroFiscal');

UPDATE core.integracoes_api_endpoints SET modulo = 'GESTAO_TI'
 WHERE operacao IN ('INFOCLIENTES');

UPDATE core.integracoes_api_endpoints SET modulo = 'INVENTARIO'
 WHERE operacao IN ('DIGITACAO','HIERARQUIA','HISTORICO','PRODUTOS','TRANSFERENCIA');

-- 3. NOT NULL + enum cast
ALTER TABLE core.integracoes_api_endpoints
  ALTER COLUMN modulo SET NOT NULL;

-- 4. Desativar linhas do ambiente não-corrente (preserva comportamento atual)
UPDATE core.integracoes_api_endpoints e
   SET ativo = (e.ambiente = i.ambiente)
  FROM core.integracoes_api i
 WHERE e.integracao_id = i.id;

-- 5. Partial unique index
CREATE UNIQUE INDEX integracoes_api_endpoints_ativo_unico
  ON core.integracoes_api_endpoints (integracao_id, modulo, operacao)
  WHERE ativo = true;

-- 6. Drop da coluna global ambiente (só depois que UI/resolvers foram atualizados)
-- ALTER TABLE core.integracoes_api DROP COLUMN ambiente;
```

Resultado: cada operação fica com 1 linha `ativo=true` (ambiente corrente) e 1
`ativo=false`. Idempotente — rodar de novo não muda nada.

> **Passo 6 fica comentado e vira uma segunda migration** após o deploy completo,
> para permitir rollback da camada de app sem DDL.

### 3.4 API auth-gateway

**Endpoint interno (modificado — signatura existente quebrada intencionalmente):**

```
GET /api/v1/internal/integracoes/codigo/:codigo/endpoints-ativos?modulo=FISCAL
→ 200 { codigo, nome, tipoAuth, authConfig, ambiente, endpoints: [...] }
```

- **Novo:** `?modulo=FISCAL` obrigatório → filtra só endpoints daquele módulo.
- Filtra `WHERE ativo = true AND modulo = :modulo`.
- Campo `ambiente` no response vira **derivado**: se todos os endpoints ativos
  são do mesmo ambiente → esse valor; se mistos → `"MIXED"`. Usado só para log
  pelos 3 consumidores.
- Sem `modulo` no query → 400 (força os clientes a declarar consumo).

**Novo endpoint (ativar individual):**

```
PATCH /api/v1/core/integracoes/:id/endpoints/:endpointId/ativar
→ 200 { endpoint atualizado }
```

Efeito em transação: marca endpoint como `ativo=true` e desativa o irmão
`(integracao_id, modulo, operacao, ambiente ≠ este)`. Valida pertencimento.

**Novo endpoint (bulk por módulo):**

```
POST /api/v1/core/integracoes/:id/modulos/:modulo/trocar-ambiente
  body: { ambiente: 'PRODUCAO' | 'HOMOLOGACAO' }
→ 200 { endpointsAtivados: N }
```

Efeito: para cada `operacao` do `(integracao, modulo)`, ativa a linha do
ambiente pedido e desativa a outra. Em transação. Substitui o antigo
`PATCH /integracoes/:id { ambiente }` no fluxo de troca.

**Endpoint antigo `PATCH /integracoes/:id`:**

Mantém para editar `nome/descricao/authConfig/ativo (geral)`. O campo `ambiente`
é **removido do `UpdateIntegracaoDto`** (não 404 no endpoint inteiro, só o campo
some). Migration da coluna DB acontece em passo separado (ver 3.3 passo 6).

### 3.5 Frontend Configurador

`configurador/src/pages/integracoes/IntegracoesPage.tsx`:

- **Nova estrutura por módulo:** dentro do card de cada integração (hoje
  Protheus é o único), um header por módulo:
  ```
  [Protheus]
   ├─ [FISCAL]        Ambiente atual: HOMOLOGACAO  [Trocar todos do Fiscal]
   │   ├─ xmlNfe            ● HOM  ○ PROD   | GET | 192.168.7.63:8115/...
   │   ├─ grvXML            ● HOM  ○ PROD   | POST| ...
   │   ├─ eventosNfe        ● HOM  ○ PROD   | GET | ...
   │   └─ cadastroFiscal    ● HOM  ○ PROD   | GET | ...
   ├─ [GESTAO_TI]     Ambiente atual: PRODUCAO     [Trocar todos do Gestão TI]
   │   └─ INFOCLIENTES      ○ HOM  ● PROD   | GET | ...
   └─ [INVENTARIO]    Ambiente atual: MIXED        [Trocar todos do Inventário]
       ├─ DIGITACAO         ● HOM  ○ PROD   | ...
       ├─ HIERARQUIA        ○ HOM  ● PROD   | ...
       └─ ...
  ```
- **Dots clicáveis** (verde = ativo, cinza = inativo). Clique → PATCH
  `/endpoints/:endpointId/ativar`.
- **"Trocar todos do [módulo]"** → abre modal, envia POST
  `/modulos/:modulo/trocar-ambiente`.
- Badge do módulo mostra `HOMOLOGACAO`, `PRODUCAO` ou `MIXED` (derivado).
- Header da integração (topo do card) **perde o `AmbienteBadge` global** — não
  existe mais esse conceito no nível integração.

### 3.6 Resolvers (3 consumidores)

**Fiscal — `fiscal/backend/src/protheus/integracao-api.resolver.ts`:**
- URL muda para `.../endpoints-ativos?modulo=FISCAL`.
- `IntegracaoEndpointResolved.ambiente` passa a vir do endpoint (não do config
  top-level). Fallback: se `config.ambiente === 'MIXED'`, usa o do próprio
  endpoint do response.

**Gestão TI — `gestao-ti/backend/src/protheus/protheus.service.ts`:**
- URL muda para `.../endpoints-ativos?modulo=GESTAO_TI`.
- Log `ambiente=X` continua funcionando (valor derivado).

**Inventário — `inventario/backend/app/core/protheus_config.py`:**
- URL muda para `.../endpoints-ativos?modulo=INVENTARIO`.
- Property `ambiente` continua lendo `_data["ambiente"]` (derivado).
- **Requer restart do container inventário** após deploy.

Impacto transversal mínimo: os 3 consumidores só mudam a URL.

---

## 4. Plano de execução

| # | Passo | Arquivos | Esforço |
|---|-------|----------|---------|
| 1 | Migration SQL (add `modulo`, popular, index parcial; **manter `ambiente` global por enquanto**) | `auth-gateway/prisma/migrations/` | 30min |
| 2 | Schema.prisma (add enum ModuloConsumidor + campo, novo unique; drop `ambiente` comentado) | `auth-gateway/prisma/schema.prisma` | 10min |
| 3 | Service: `ativarEndpoint`, `trocarAmbienteModulo(integracaoId, modulo, ambiente)`, ajuste em `getEndpointsAtivos(codigo, modulo)` | `auth-gateway/src/integracao/integracao.service.ts` | 50min |
| 4 | Controller: 2 novos endpoints + query param `?modulo` no interno + remove `ambiente` do `UpdateIntegracaoDto` | `auth-gateway/src/integracao/integracao.controller.ts`, `integracao-internal.controller.ts`, `dto/integracao.dto.ts` | 30min |
| 5 | Fiscal resolver: URL com `?modulo=FISCAL` | `fiscal/backend/src/protheus/integracao-api.resolver.ts` | 10min |
| 6 | Gestão TI resolver: URL com `?modulo=GESTAO_TI` | `gestao-ti/backend/src/protheus/protheus.service.ts` | 10min |
| 7 | Inventário resolver (Python): URL com `?modulo=INVENTARIO` | `inventario/backend/app/core/protheus_config.py` | 10min |
| 8 | UI Configurador: reestruturar em seções por módulo + dots clicáveis + modal bulk per-módulo | `configurador/src/pages/integracoes/IntegracoesPage.tsx`, `src/services/integracoes.service.ts` | 1h30 |
| 9 | Seed atualizar para incluir `modulo` nas 20 linhas (importante p/ ambientes novos) | `auth-gateway/prisma/seed.ts` | 15min |
| 10 | Smoke test: `xmlNfe=HOM` + `cadastroFiscal=PROD` (dentro Fiscal) + `INFOCLIENTES=PROD` + `HIERARQUIA=PROD` simultaneamente; validar nos logs URL correta em cada consumidor | UI + logs 3 serviços | 30min |
| 11 | Migration 2: `DROP COLUMN integracoes_api.ambiente` | `auth-gateway/prisma/migrations/` | 10min |

**Total estimado:** ~4h40.

---

## 5. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Migration 1 em produção com Fiscal/TI/Inventário em execução | Idempotente. Adiciona coluna sem bloquear; `UPDATE` preserva ambiente corrente. Executar fora do horário só por precaução. |
| Nova operação criada sem `modulo` definido | Enum NOT NULL → insert sem `modulo` falha. `CreateEndpointDto` obriga o campo. |
| Partial unique index falha se houver duplicatas ativas | Passo 4 da migration garante que só 1 ambiente por `(integracao, modulo, operacao)` fica ativo antes do index. |
| UI antiga aberta durante deploy | PATCH antigo com `ambiente` no body → validation drops o campo, retorna 200 sem efeito. Badge mostra valor stale por 5min até invalidar cache. Aceitável — ferramenta interna, F5. |
| Consumidor Python (inventário) não atualizado → `?modulo` obrigatório quebra | Deploy coordenado: endpoint interno **aceita `modulo` opcional por 1 release** (fallback: retorna todos os ativos como hoje). Depois força. |
| Mapeamento de módulo errado em alguma operação nova | Seed + teste de smoke (passo 10) cobre as 10 conhecidas. Novas ficam a cargo do Configurador explicitamente. |
| Drop da coluna `ambiente` em integracoes_api durante deploy em andamento | Passo 11 (migration separada) só executa depois que os 3 backends subiram. Rollback simples = reverter app; coluna ainda existe. |

---

## 6. Critérios de aceite

1. Ativar `xmlNfe → HOM` e `cadastroFiscal → PROD` simultaneamente (ambos Fiscal) sem erro de invariante.
2. Consulta NF-e no Fiscal usa URL `192.168.7.63:8115/.../xmlNfe` (HOM) nos logs.
3. Consulta CCC no Fiscal usa URL `apiportal.capul.com.br/.../cadastroFiscal` (PROD).
4. Gestão TI (`INFOCLIENTES` em PROD) continua funcionando sem redeploy adicional além do passo 6.
5. Inventário (`HIERARQUIA`, etc. em PROD) continua funcionando após passo 7 + restart.
6. Botão "Trocar todos do Fiscal" migra só 4 operações, não afeta Inventário/TI.
7. Badge "MIXED" aparece quando um módulo tem ambientes diferentes entre suas operações.
8. Desativar ambos HOM e PROD de uma operação → UI warning + resolver retorna 503 com mensagem amigável ("operacao X sem endpoint ativo no modulo Y").

---

## 7. Questões abertas

- **Permissão:** ativar endpoint requer role `ADMIN_CONFIGURADOR` existente? (proposta: sim, sem role nova).
- **Auditoria:** cada ativação grava em `core.system_logs`? Manter paridade com comportamento atual do PATCH global.
- **Criação de endpoints novos pela UI:** `modulo` deve ser select obrigatório no form. Novos módulos criados no futuro (ex: CONTABIL) precisam só update do enum.
- **Cache TTL de 5min nos 3 resolvers:** mantemos? Ou adicionamos invalidação push pelo Configurador ao ativar? (proposta: TTL mantido; botão "Invalidar caches agora" na UI como nice-to-have).

---

## 8. Não faz parte deste plano

- Criar novos módulos consumidores — só renomeia os 3 existentes com base no código.
- Mudança no contrato entre Configurador e auth-gateway (além dos 2 novos endpoints).
- Retry/circuit breaker nos resolvers — fora do escopo.

---

*Próximo passo:* aprovar esta v2 → executar passos 1-10 em sequência → passo 11 (drop coluna) em deploy separado após validação em staging/prod.
