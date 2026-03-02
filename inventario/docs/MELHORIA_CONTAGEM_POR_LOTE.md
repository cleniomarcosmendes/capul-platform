# Melhoria: Pre-fill Inteligente de Lotes em Recontagem

**Data**: 01/03/2026 (planejado) → 02/03/2026 (implementado)
**Status**: IMPLEMENTADO
**Prioridade**: Media

---

## Contexto

Quando um produto com controle por lote apresenta divergencia em um ou mais lotes, o sistema marca o produto inteiro para recontagem no proximo ciclo. Anteriormente, o operador precisava recontar TODOS os lotes, mesmo que apenas 1 de N estivesse divergente.

## Solucao Implementada (02/03/2026)

### Abordagem: Pre-fill Inteligente (Frontend-only)

Em vez de criar campos JSONB, tabelas extras ou novos endpoints, a solucao usa os dados que o backend **ja retorna** (array `countings` com `lot_number`, `quantity`, `count_number`) para pre-preencher lotes no modal de contagem.

**Logica:**
- **Lotes que CONFERIRAM** no ciclo anterior (contagem == saldo sistema, tolerancia 0.01):
  - Pre-preenchidos com o valor do ciclo anterior
  - Visual verde (borda + badge "Conf. C1")
  - Editaveis, mas com dialog de confirmacao ao alterar
- **Lotes que DIVERGIRAM** no ciclo anterior:
  - Carregados como vazio (zero), forcando recontagem
  - Visual normal
  - Edicao livre

### Arquivos Alterados

1. **`frontend/src/types/index.ts`** — Adicionado campo `countings` ao `CountingListProduct`
2. **`frontend/src/pages/contagem/components/LoteContagemModal.tsx`** — Logica de pre-fill, visual diferenciado, ConfirmDialog
3. **`frontend/src/pages/inventarios/components/TabAnalise.tsx`** — Removido cast `(product as any).countings`

### Comportamento

| Cenario | Lote A (bateu C1) | Lote B (divergiu C1) |
|---------|-------------------|----------------------|
| Ciclo 1 | Vazio (normal) | Vazio (normal) |
| Ciclo 2 | Pre-preenchido, borda verde, badge "Conf. C1" | Vazio (forcar recontagem) |
| Operador altera Lote A | ConfirmDialog: "Deseja alterar?" | Edicao livre |

### Beneficios

- Reducao estimada de 60-80% no retrabalho de recontagem
- Zero alteracoes no backend (dados ja disponiveis)
- Zero alteracoes no banco de dados (sem migrations)
- Experiencia do operador: foco apenas nos lotes divergentes
- Seguranca: confirmacao ao alterar lote ja conferido

## Pre-requisitos Ja Implementados (01/03/2026)

1. **Visualizacao de divergencia por lote na analise** — TabAnalise com linhas expandiveis
2. **Relatorio por lote** — RelatoriosPage tab "Relatorio por Lote" com dados reais
3. **Backend `countings`** — Array com `lot_number`, `quantity`, `count_number` retornado por produto
4. **`snapshot_lots`** — Saldo do sistema congelado por lote no snapshot
