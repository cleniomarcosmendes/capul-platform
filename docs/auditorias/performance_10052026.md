# Auditoria — Performance & Escalabilidade — 10/05/2026

**Frente:** 4 (do `PLAYBOOK_AUDITORIA_v1.md`)
**Modo:** profunda
**Branch:** `audit/performance`
**Auditor:** Claude Opus 4.7 (sessão Clenio)
**Escopo:** latência, throughput, eficiência sob carga real e projetada. DB (índices, slow queries, N+1, pool), cache (Redis), frontend (bundle), backend (paginação, compressão), filas (BullMQ). LGPD/Segurança/Robustez fora de escopo (frentes próprias).

---

## Sumário Executivo

| Severidade | Qtd | Esforço estimado |
|---|---|---|
| **Críticos** | 0 | — |
| **Altos** | 3 | 3-8h |
| **Médios** | 4 | 4-8h |
| **Baixos** | 2 | 1-2h |
| **Pontos fortes** | 8 | — |

**TOTAL esforço de remediação:** 8-18h

### Quick wins (alta criticidade + baixo esforço)
1. **#A2** — Habilitar `gzip` no nginx (5min) — ~70% redução bandwidth, melhora tempo carga em qualquer rede lenta
2. **#A1 lote prioritário** — Adicionar 12 índices em FKs hot path de `gestao_ti.chamados`, `projetos`, `registros_parada` (1h migration + teste)
3. **#M2** — Configurar Redis `maxmemory` + policy `allkeys-lru` (5min) — evita OOM silencioso

### Achado mais grave
**#A1** — **118 FKs sem índice** no banco (40 em gestao_ti, 50 em inventario, 1 em core). Tabelas hot path (chamados, projetos, counting_lists) têm múltiplas FKs não indexadas. Em listas com filtro `WHERE filial_id = X` sem índice, Postgres faz seq scan na tabela inteira.

---

## Achados Altos

### Achado #A1 — 118 Foreign Keys sem índice (impacto em hot paths)

- **Dimensão:** 5 (Database — Performance)
- **Severidade:** **Alto**
- **Localização:** distribuição por schema:
  - `gestao_ti`: ~40 FKs (chamados, projetos, contratos, paradas, NFs, etc.)
  - `inventario`: ~50 FKs (counting_lists, counting_assignments, products, etc.)
  - `core`: 1 FK (departamentos.filial_id)
  - `fiscal`: 0 (boa cobertura existente)

- **Descrição:** Postgres não cria índice automático em colunas de FK (diferente de PK). Sem índice, JOIN ou DELETE em CASCADE faz seq scan da tabela inteira. Em produção há ~1 ano, isso já está custando latência em queries de lista com filtros.

- **Por que é problema:**
  - Listagem de chamados filtrando por `filial_id` ou `departamento_id` faz seq scan em `chamados`
  - DELETE em `usuarios` força seq scan em ~15 tabelas que referenciam `usuario_id`
  - Em escala (chamados crescendo), problema piora não-linearmente

- **Evidência:** `pg_stat_user_tables` + lista completa via query em pg_constraint. Ver Anexo A.

#### Plano de Correção — Lote prioritário (12 índices em hot paths)

```sql
-- gestao_ti.chamados — 7 FKs sem índice
CREATE INDEX CONCURRENTLY IF NOT EXISTS chamados_filial_id_idx ON gestao_ti.chamados(filial_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS chamados_departamento_id_idx ON gestao_ti.chamados(departamento_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS chamados_projeto_id_idx ON gestao_ti.chamados(projeto_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS chamados_software_id_idx ON gestao_ti.chamados(software_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS chamados_software_modulo_id_idx ON gestao_ti.chamados(software_modulo_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS chamados_catalogo_servico_id_idx ON gestao_ti.chamados(catalogo_servico_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS chamados_sla_definicao_id_idx ON gestao_ti.chamados(sla_definicao_id);

-- gestao_ti.historicos_chamado — 3 FKs (timeline de chamado)
CREATE INDEX CONCURRENTLY IF NOT EXISTS historicos_chamado_usuario_id_idx ON gestao_ti.historicos_chamado(usuario_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS historicos_chamado_equipe_origem_id_idx ON gestao_ti.historicos_chamado(equipe_origem_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS historicos_chamado_equipe_destino_id_idx ON gestao_ti.historicos_chamado(equipe_destino_id);

-- gestao_ti.projetos — 3 FKs (relatórios de projeto)
CREATE INDEX CONCURRENTLY IF NOT EXISTS projetos_responsavel_id_idx ON gestao_ti.projetos(responsavel_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS projetos_tipo_projeto_id_idx ON gestao_ti.projetos(tipo_projeto_id);
```

**Sub-lote 2 (paradas + ordens de serviço, ~10 índices):**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS registros_parada_motivo_parada_id_idx ON gestao_ti.registros_parada(motivo_parada_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS registros_parada_software_modulo_id_idx ON gestao_ti.registros_parada(software_modulo_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS registros_parada_registrado_por_id_idx ON gestao_ti.registros_parada(registrado_por_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ordens_servico_filial_id_idx ON gestao_ti.ordens_servico(filial_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ordens_servico_solicitante_id_idx ON gestao_ti.ordens_servico(solicitante_id);
-- ... (lista completa no Anexo A)
```

**Sub-lote 3 (Inventário hot paths — counting_lists e counting_assignments, ~10 índices):**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS counting_lists_inventory_id_idx ON inventario.counting_lists(inventory_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS counting_lists_created_by_idx ON inventario.counting_lists(created_by);
-- ... (lista completa no Anexo A)
```

#### Esforço e validação

- **Esforço:** 1h (escrever migration única) + 30min testes em DEV
- **Risco:** baixo — `CREATE INDEX CONCURRENTLY` não bloqueia escrita; índices não removem dados
- **Validação:**
  ```sql
  -- antes/depois — explain analyze em queries reais
  EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM gestao_ti.chamados WHERE filial_id = 'XXX' AND status = 'ABERTO';
  -- esperado: "Index Scan using chamados_filial_id_idx" (era "Seq Scan")
  ```
- **Rollback:** `DROP INDEX CONCURRENTLY` — sem perda de dados
- **Recomendação:** aplicar **lote prioritário (12 índices)** primeiro, observar 1 semana em produção antes de aplicar sub-lotes 2-3

---

### Achado #A2 — Nginx sem compressão gzip/brotli

- **Dimensão:** 5 (Backend Performance)
- **Severidade:** **Alto** (impacto direto em UX cliente final)
- **Localização:** `nginx/nginx.conf` — sem diretivas `gzip` ou `brotli`

- **Descrição:** Todos os assets servidos pelo nginx (JS, CSS, JSON de API, HTML) trafegam **sem compressão**. Em conexões lentas (3G/4G fraco), isso multiplica o tempo de carga.

- **Por que é problema:**
  - Bundle Inventário 1.7M = 1.7M trafegados (com gzip seria ~510K)
  - Bundle Gestão TI 1.2M = 1.2M (com gzip ~360K)
  - Respostas JSON de listagem (chamados, projetos) facilmente 100-500K — todas sem compressão

- **Evidência:**
  ```bash
  $ curl -sk -I https://localhost/gestao-ti/ | grep -i encoding
  # vazio (nenhum Content-Encoding)
  ```

#### Plano de Correção

Adicionar bloco gzip no `nginx/nginx.conf` dentro do `server { ... 443 ... }`:

```nginx
# Compressão gzip — auditoria 10/05/2026 #A2
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 5;
gzip_types
  text/plain
  text/css
  text/xml
  text/javascript
  application/javascript
  application/x-javascript
  application/json
  application/xml
  application/xml+rss
  application/wasm
  image/svg+xml;
# Não comprime imagens já comprimidas (jpg/png/woff2 já são lossy/compressed)
```

#### Esforço e validação

- **Esforço:** 5min config + reload nginx (`docker exec capul-nginx nginx -s reload`)
- **Risco:** Baixo — gzip é universalmente suportado por browsers desde 2000
- **Validação:**
  ```bash
  curl -sk -I -H "Accept-Encoding: gzip" https://localhost/gestao-ti/
  # esperado: Content-Encoding: gzip
  ```
- **Rollback:** comentar bloco e reload

> **Nota sobre brotli:** módulo brotli não vem na imagem `nginx:alpine` oficial — exigiria image custom. gzip dá ~70% do ganho de brotli com zero esforço de imagem.

---

### Achado #A3 — Bundles frontend monolíticos sem code splitting

- **Dimensão:** 5 (Frontend Performance)
- **Severidade:** **Alto** (UX inicial — primeira tela demora pra renderizar)
- **Localização:**
  - `inventario/frontend/` — bundle 1.7M único (`index-XXX.js`)
  - `gestao-ti/frontend/` — bundle 1.2M único
  - `fiscal/frontend/` — bundle 880K único
  - `configurador/` — 420K
  - `hub/` — 288K (OK pra portal)

- **Descrição:** Vite gera um único `index-XXX.js` com TODO o código de TODAS as rotas. Usuário que entra em `/chamados` baixa também `/projetos`, `/configuracoes`, `/contratos`, etc.

- **Por que é problema:**
  - Tempo de parse JS proporcional ao tamanho — 1.7M demora ~2-3s pra parsear em mobile
  - Time-to-Interactive cresce
  - Cliente que só usa "Chamados" baixa código de "Configurador"
  - Mesmo após gzip (~510K), parse ainda é caro

#### Plano de Correção

Em cada `frontend/src/App.tsx` (ou onde estão as rotas), trocar imports estáticos por dinâmicos:

```typescript
// ANTES
import ChamadosListPage from './pages/chamados/ChamadosListPage';
import ProjetosListPage from './pages/projetos/ProjetosListPage';

// DEPOIS — code splitting por rota
const ChamadosListPage = lazy(() => import('./pages/chamados/ChamadosListPage'));
const ProjetosListPage = lazy(() => import('./pages/projetos/ProjetosListPage'));

// envolver Routes com Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/chamados" element={<ChamadosListPage />} />
    ...
  </Routes>
</Suspense>
```

#### Esforço e validação

- **Esforço:** 2-4h por frontend (Inventario + Gestao TI prioritários — 4-8h total)
- **Risco:** médio — quebra se algum hook depende de código que agora é lazy. Testar fluxo de cada rota.
- **Validação:** após `npm run build`, `dist/assets/` deve ter múltiplos chunks `index-X.js`, `chamados-Y.js`, `projetos-Z.js` etc.
- **Ganho esperado:** carga inicial de 1.7M → 300-400K + chunks sob demanda

---

## Achados Médios

### Achado #M1 — `pg_stat_statements` não habilitado

- **Dimensão:** 5 (DB observability)
- **Severidade:** Médio (não bloqueia, mas impede medir slow queries empíricas)
- **Localização:** Postgres não tem `shared_preload_libraries='pg_stat_statements'`. Verificação:
  ```sql
  SELECT * FROM pg_extension WHERE extname='pg_stat_statements';
  -- 0 rows
  ```
- **Plano resumido:** modificar `docker-compose.yml` postgres `command` adicionando `-c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.max=10000 -c pg_stat_statements.track=all`. Rebuild + `CREATE EXTENSION pg_stat_statements;`. Esforço: 30min + restart postgres.

### Achado #M2 — Redis sem `maxmemory` configurado (risco OOM)

- **Dimensão:** 5 (Cache)
- **Severidade:** Médio (tempo limitado — depende de crescimento do uso)
- **Localização:** `docker-compose.yml` redis service — `command: redis-server --requirepass ${REDIS_PASSWORD}` sem `--maxmemory`
- **Estado atual:**
  - `maxmemory: 0` (sem limite)
  - `maxmemory_policy: noeviction` (rejeita SETs novos quando memória cheia)
  - Container `mem_limit: 256m` — Redis vai dar OOM em vez de evictar
  - Uso atual: 1.71M (ainda muito longe — janela de tempo OK)
- **Plano resumido:** adicionar ao `command`:
  ```yaml
  command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 200mb --maxmemory-policy allkeys-lru
  ```
  - 200MB deixa headroom de 56MB pro overhead Redis
  - `allkeys-lru` evicta o que foi menos usado (cache real, não dados críticos)
  - Esforço: 5min + restart redis

### Achado #M3 — Hit rate Redis baixo (31.8%)

- **Dimensão:** 5 (Cache)
- **Severidade:** Médio (depende — pode ser uso correto se maioria é write-only)
- **Estado atual:**
  - `keyspace_hits: 17204`
  - `keyspace_misses: 36899`
  - Hit rate = 31.8%
- **Análise:** Redis na plataforma serve principalmente:
  1. BullMQ (filas — write/read intensivo, hit rate alto esperado em jobs ativos, baixo em jobs novos)
  2. Sessões/refresh tokens (read-once típico)
  3. Cache de config Protheus (read-many esperado, hit alto)
- **Plano resumido:** investigar PADRÃO de uso (qual app está dominando misses?). Comando:
  ```bash
  docker compose exec redis redis-cli -a "$REDIS_PASSWORD" --bigkeys
  docker compose exec redis redis-cli -a "$REDIS_PASSWORD" CLIENT LIST | head -20
  ```
- **Esforço:** 1-2h investigação. Se uso for legítimo (BullMQ dominante), aceitar. Se não, identificar e cachear queries pesadas.

### Achado #M4 — Connection pool sem config explícita

- **Dimensão:** 5 (DB scalability)
- **Severidade:** Médio (OK no momento, vira gargalo em escala)
- **Estado atual:**
  - Postgres `max_connections=100` (default)
  - Conexões abertas: 35 / 100 (35%)
  - Backends Prisma: sem `connection_limit` em DATABASE_URL — usa default Prisma `num_cpus * 2 + 1`
  - FastAPI Inventário: SQLAlchemy sem config explícita
- **Plano resumido:**
  - Definir `connection_limit` explícito em DATABASE_URL: `?connection_limit=10` por backend
  - 4 backends × 10 = 40 conexões — espaço pro pgAdmin/manutenção
  - Considerar PgBouncer se chegar perto de 80% saturação
- **Esforço:** 30min config + monitoramento

---

## Achados Baixos

### Achado #B1 — `cte_documento` com seq_scan ocasional

- **Dimensão:** 5 (DB hot table)
- **Severidade:** Baixo (193 seq_scan vs 24809 idx_scan = 0.8% — não-crítico)
- **Estado:** queries que disparam seq scan provavelmente são `COUNT(*)` sem WHERE ou agregações — Postgres prefere seq scan quando precisa varrer 100% das linhas mesmo. Tabela tem boa cobertura de índices.
- **Plano resumido:** investigar queries específicas via `pg_stat_statements` (depende #M1 ser habilitado). Provavelmente sem ação.

### Achado #B2 — Sem teste de carga / baseline de capacidade

- **Dimensão:** 5 (Capacidade)
- **Severidade:** Baixo (não-funcional, mas valioso)
- **Plano resumido:** definir baseline empírico de "usuários simultâneos suportados" usando `wrk`/`k6`/`locust` em DEV. Sem isso, escalada futura é "tentativa e erro".
- **Esforço:** 4h pra setup inicial + relatório

---

## Pontos Fortes Identificados

1. **fiscal schema com boa cobertura de índices** — 0 FKs sem índice em fiscal (cte_documento, documento_consulta, etc.)
2. **`cte_documento` com índices funcionais e parciais bem desenhados** — `WHERE inconsistencia_resolvida_em IS NULL` (índice partial), composto em `(protheus_status, protheus_tentativas)` — bem otimizado
3. **BullMQ com config razoável** — `attempts: 3, removeOnComplete: 1000, removeOnFail: 500` evita acúmulo
4. **Sem N+1 óbvio detectado** — greps por `forEach async`, `for of` com query e `map async + await prisma` retornaram zero matches
5. **Resource limits em todos containers** — previne runaway
6. **`maxRetriesPerRequest: null` em BullMQ** — config correta (BullMQ exige)
7. **Conexões DB longe da saturação** — 35/100 = 35% (~9/backend)
8. **Redis sem eviction até agora** — `evicted_keys: 0`, mas é por sorte (sem maxmemory) — corrigir antes que cresça (ver #M2)
9. **Logs JSON estruturados** — ajuda agregação futura (Loki/ELK)
10. **Init jobs `*-migrate`** — schema sempre sincronizado antes do backend subir

---

## Roadmap consolidado de correção

### Sprint 1 (semanas 1-2) — Quick wins (3 entregas, ~2h)

- [ ] **#A2** — Habilitar gzip nginx (5min)
- [ ] **#A1 lote prioritário** — 12 índices em chamados/projetos/historicos (1h)
- [ ] **#M2** — Redis maxmemory + LRU policy (5min)

**Impacto esperado:** redução ~70% bandwidth (gzip) + queries de chamado/projeto significativamente mais rápidas (índices) + zero risco de OOM Redis.

### Sprint 2 (semanas 3-4) — Altos restantes

- [ ] **#A1 sub-lotes 2-3** — restantes 100 índices (paradas, OS, contratos, inventário) — 2-3h
- [ ] **#A3** — Code splitting Vite em Inventário e Gestão TI — 4-8h
- [ ] **#M1** — Habilitar pg_stat_statements — 30min

### Médio prazo (1-3 meses)

- [ ] **#M3** — Investigar hit rate Redis (1-2h)
- [ ] **#M4** — Definir connection_limit por backend (30min)
- [ ] **#B2** — Baseline de capacidade com `wrk`/`k6` (4h)

### Longo prazo (backlog)

- [ ] **#B1** — Investigar seq scans cte_documento (depende #M1)
- [ ] **PgBouncer** — quando conexões atingirem 70% de max_connections

---

## Estimativa de esforço total

- **Sprint 1 (Quick wins):** ~2h
- **Sprint 2 (Altos):** 8-12h
- **Médio prazo:** 5-8h
- **TOTAL:** 15-22h

---

## Decisões pendentes (alinhar com Clenio)

1. **Quick wins agora ou aguardar Douglas?** Os 3 quick wins (#A2, #A1 lote prioritário, #M2) são baixo risco e poderiam ser commitados nesta branch hoje. Mas mexer em DB de produção ainda assim merece coordenação com Douglas. **Sugestão:** commitar tudo nesta branch como migration/config, gerar roteiro próprio, Douglas aplica quando voltar.
2. **Code splitting (#A3)** — vale o esforço (4-8h) ou bundle 1.7M é aceitável pra rede interna CAPUL? Se a maioria dos usuários acessa de dentro da rede com 1Gbps, gzip + bundle único é OK. Se há uso externo (mobile, casa), code splitting traz ganho real.
3. **PgBouncer no roadmap** — ainda não precisa, mas vale planejar?

---

## Anexo A — Lista completa das 118 FKs sem índice

### gestao_ti (40 FKs)
```
gestao_ti.notas_fiscais.criado_por_id
gestao_ti.anexos_nota_fiscal.usuario_id
gestao_ti.anexos_parada.usuario_id
gestao_ti.parada_historico.usuario_id
gestao_ti.chamados.{departamento_id, filial_id, catalogo_servico_id, sla_definicao_id, software_id, software_modulo_id, projeto_id}
gestao_ti.historicos_chamado.{usuario_id, equipe_origem_id, equipe_destino_id}
gestao_ti.ordens_servico.{solicitante_id, filial_id}
gestao_ti.softwares.equipe_responsavel_id
gestao_ti.software_licencas.{contrato_id, categoria_id}
gestao_ti.contratos.{produto_id, contrato_original_id, fornecedor_id}
gestao_ti.contrato_historicos.usuario_id
gestao_ti.registros_parada.{finalizado_por_id, reaberta_por_id, motivo_parada_id, software_modulo_id, registrado_por_id}
gestao_ti.projetos.{contrato_id, responsavel_id, tipo_projeto_id}
gestao_ti.atividades_projeto.{fase_id, usuario_id}
gestao_ti.riscos_projeto.responsavel_id
gestao_ti.anexos_projeto.usuario_id
gestao_ti.apontamentos_horas.fase_id
gestao_ti.ativos.{responsavel_id, departamento_id}
gestao_ti.artigos_conhecimento.equipe_ti_id
gestao_ti.anexos_chamado.usuario_id
gestao_ti.rateio_template_itens.natureza_id
gestao_ti.parcela_rateio_itens.natureza_id
gestao_ti.contrato_renovacoes.{contrato_anterior_id, contrato_novo_id}
gestao_ti.comentarios_tarefa.usuario_id
gestao_ti.pendencias_projeto.{criador_id, fase_id}
gestao_ti.interacoes_pendencia.usuario_id
gestao_ti.anexos_pendencia.usuario_id
gestao_ti.anexos_conhecimento.usuario_id
gestao_ti.produtos.tipo_produto_id
gestao_ti.historicos_ordem_servico.usuario_id
```

### inventario (50 FKs)
```
inventario.users.store_id
inventario.warehouses.store_id
inventario.products.store_id
inventario.user_stores.{created_by, user_id, store_id}
inventario.product_barcodes.{store_id, product_id}
inventario.product_stores.{store_id, product_id}
inventario.inventory_lists.{store_id, created_by, analisado_por_id, counter_cycle_2, counter_cycle_3, closed_by, released_by, counter_cycle_1}
inventario.system_logs.{user_id, store_id}
inventario.product_prices.{product_id, store_id}
inventario.slk010.{store_id, product_id}
inventario.inventory_items.{last_counted_by, inventory_list_id, product_id}
inventario.closed_counting_rounds.{user_id, inventory_list_id}
inventario.counting_lists.{closed_by, created_by, entregue_por_id, devolvido_por_id, counter_cycle_3, released_by, counter_cycle_1, counter_cycle_2, inventory_id}
inventario.counting_list_items.{last_counted_by, counting_list_id, inventory_item_id}
inventario.counting_list_handoff_history.ator_id
inventario.inventory_items_snapshot.created_by
inventario.inventory_lots_snapshot.{created_by, inventory_item_id}
inventario.countings.{counted_by, inventory_item_id}
inventario.discrepancies.{inventory_item_id, created_by, resolved_by}
inventario.counting_assignments.{counter_cycle_3, previous_counter_id, counter_cycle_2, counter_cycle_1, assigned_by, assigned_to, inventory_item_id}
inventario.cycle_audit_log.{inventory_list_id, counting_list_id, user_id}
inventario.counting_lots.{created_by, counting_id}
inventario.protheus_integrations.{created_by, cancelled_by}
inventario.protheus_integration_items.integration_id
```

### core (1 FK)
```
core.departamentos.filial_id
```

### Migration completa pronta pra aplicar

Ver arquivo separado em `gestao-ti/backend/prisma/migrations/<timestamp>_add_missing_fk_indexes/migration.sql` (não criado nesta auditoria — aguarda decisão do Clenio).

---

## Próximos passos

Conforme `PLAYBOOK_AUDITORIA_v1.md` Frente 4:

1. **Pausa para alinhamento** com Clenio — auditoria não tem Crítico mas tem 3 Altos. Decidir:
   - Quais quick wins commitar nesta branch agora
   - Quais ficam pra Douglas voltar
   - Se Code Splitting (#A3) é prioridade
2. Após decisão, aplicar Lote(s) aprovado(s) na branch `audit/performance`
3. Gerar `C:\Arquivos-de-projeto\PlatformCapul_<DDMMAAAA>_Roteiro_Performance.md` quando Douglas voltar
