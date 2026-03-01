# Melhoria Futura: Contagem por Lote Individual

**Data**: 01/03/2026
**Status**: Planejado (futuro)
**Prioridade**: Media

---

## Contexto

Atualmente, quando um produto com controle por lote apresenta divergencia em um ou mais lotes, o sistema obriga a recontagem de TODOS os lotes do produto no proximo ciclo. Isso gera retrabalho desnecessario quando apenas 1 de N lotes esta divergente.

## Situacao Atual

- Produto com lote tem N lotes (ex: 5 lotes diferentes)
- Se 1 lote diverge no 1o ciclo, o sistema marca o PRODUTO inteiro para recontagem no 2o ciclo
- O operador precisa recontar todos os 5 lotes, mesmo que 4 estejam corretos
- Desperdicio de tempo e recursos

## Melhoria Proposta

### Fase 1: Controle Granular de Recontagem por Lote

1. **Novo campo**: `needs_recount_by_lot` (JSONB) no `InventoryItem` ou `CountingListItem`
   - Formato: `{"000000000022629": true, "000000000022631": false}`
   - Indica quais lotes especificos precisam de recontagem

2. **Logica de ciclos por lote**:
   - Ao encerrar um ciclo, verificar divergencia por lote (nao apenas por produto)
   - Marcar apenas os lotes divergentes para recontagem
   - Lotes que conferem ficam "travados" (nao editaveis no proximo ciclo)

3. **Endpoints backend**:
   - `POST /api/v1/inventory/items/{item_id}/lot-recount` — marcar lotes para recontagem
   - Alterar logica de `advance-cycle` para considerar lotes individuais
   - Alterar calculo de `needs_count_cycle_2/3` para ser por lote

### Fase 2: Interface de Contagem por Lote

1. **Mobile/Desktop**: Na tela de contagem de lotes, indicar visualmente:
   - Lotes que precisam recontagem (editaveis, destacados)
   - Lotes que conferem (somente leitura, esmaecidos)

2. **Analise**: Na tab de analise, mostrar status por lote (OK / Divergente / Recontagem)

3. **Relatorios**: No relatorio por lote, adicionar coluna "Ciclo" indicando em qual ciclo cada lote foi confirmado

### Fase 3: Otimizacao de Performance

- Contagem parcial: operador so precisa escanear/contar os lotes marcados
- Reducao estimada de retrabalho: 60-80% para produtos com multiplos lotes
- Melhoria na velocidade de encerramento de ciclos

## Impacto Tecnico

### Banco de Dados
- Novo campo JSONB em `counting_list_items` ou `inventory_items`
- Possivel nova tabela `lot_recount_status` (inventory_item_id, lot_number, cycle, status)

### Backend
- Alterar `counting_lists.py` — logica de avancar ciclo
- Alterar `main.py` — endpoint de encerrar ciclo
- Novo endpoint de contagem por lote individual

### Frontend
- `ContagemMobilePage.tsx` / `ContagemDesktopPage.tsx` — modo contagem parcial de lotes
- `LoteContagemModal.tsx` — indicador visual de lotes obrigatorios vs opcionais
- `TabAnalise.tsx` — ja preparado com expansao por lote (implementado em 01/03/2026)

## Pre-requisitos Ja Implementados (01/03/2026)

1. **Visualizacao de divergencia por lote na analise** — TabAnalise com linhas expandiveis mostrando lotes com divergencia (Saldo Sistema vs Qtd Contada vs Diferenca)
2. **Relatorio por lote** — RelatoriosPage tab "Relatorio por Lote" com dados reais de `counted_lots`
3. **Backend `counted_lots`** — Endpoint final-report retorna contagem por lote extraida de countings
4. **`snapshot_lots`** — Saldo do sistema congelado por lote no snapshot

## Estimativa

- Fase 1 (Backend): 2-3 dias
- Fase 2 (Frontend): 2-3 dias
- Fase 3 (Otimizacao): 1-2 dias
- Testes: 1-2 dias
- **Total estimado**: 6-10 dias
