# Melhorias Futuras — Sistema de Inventario (React)

*Documento gerado em 01/03/2026 apos auditoria completa do frontend React.*

---

## Prioridade ALTA

### 1. Historico/Audit Log do Inventario
- **O que**: Timeline de atividades do inventario (criacao, liberacao, contagens, encerramentos)
- **Onde**: Nova tab no `InventarioDetalhePage` (removida temporariamente por ser placeholder)
- **Dependencia**: Criar endpoint no backend (`GET /api/v1/inventory/lists/{id}/history`) com audit log
- **Impacto**: Rastreabilidade completa das operacoes — essencial para auditoria

### 2. Pagina de Comparacao sem seletor de inventarios
- **O que**: `ComparacaoPage` so funciona via URL com query params (`?inv_a=...&inv_b=...`), sem UI para selecionar inventarios
- **Onde**: `src/pages/ComparacaoPage.tsx`
- **Solucao**: Adicionar seletores de inventario na propria pagina + link no Sidebar
- **Service pronto**: `comparisonService.listarDisponiveis()` ja existe mas nao e usado

### 3. Sincronizacao dos campos do inventory_lists
- **O que**: `inventory_lists.current_cycle` e `list_status` ficam desatualizados quando counting lists progridem
- **Onde**: Backend `main.py` — endpoints de avanco de ciclo e encerramento de lista
- **Solucao**: Atualizar `inventory_lists` sempre que uma counting list muda de ciclo ou status
- **Nota**: Frontend ja contorna isso derivando valores das counting lists, mas o ideal e corrigir no backend

---

## Prioridade MEDIA

### 4. Armazens — CRUD completo
- **O que**: `ArmazensPage` e somente leitura (lista armazens do Protheus)
- **Onde**: `src/pages/ArmazensPage.tsx` + `warehouse.service.ts`
- **Services prontos**: `buscarPorId()`, `criar()`, `atualizar()` existem mas nunca sao chamados
- **Avaliacao**: Pode nao ser necessario se armazens vem exclusivamente do Protheus

### 5. Historico real na Sincronizacao
- **O que**: `TabHistorico` em `SincronizacaoPage` mostra apenas status atual, sem log de envios passados
- **Onde**: `src/pages/SincronizacaoPage.tsx` (linhas 444-490)
- **Solucao**: Listar integracoes passadas com data, tipo, status, valores

### 6. Cancelar integracao
- **O que**: `integrationService.cancelar()` existe mas nao tem botao na UI
- **Onde**: `src/pages/SincronizacaoPage.tsx` — tabela de integracoes existentes
- **Solucao**: Adicionar botao "Cancelar" com ConfirmDialog para integracoes pendentes

### 7. Workflow de revisao/aprovacao de itens
- **O que**: Status `REVIEWED` e `APPROVED` existem no tipo `ItemStatus` mas nao ha acoes na UI para setar
- **Onde**: `InventarioDetalhePage` TabItens
- **Solucao**: Botoes de aprovacao individual ou em lote para supervisores

---

## Prioridade BAIXA

### 8. Filtro de produtos por faixa
- **O que**: `productService.filtrarPorFaixa()` e tipo `FilteredProductResponse` existem mas nunca sao usados
- **Onde**: `src/services/product.service.ts` + `types/index.ts`
- **Uso potencial**: Filtrar produtos por faixa de codigo na adicao ao inventario

### 9. "Meus Itens" na contagem
- **O que**: `countingListService.listarMeusItens()` existe mas nao e usado
- **Onde**: `src/services/counting-list.service.ts`
- **Uso potencial**: Na pagina de contagem, mostrar apenas itens atribuidos ao usuario logado

### 10. Editar counting list (nome/descricao)
- **O que**: `countingListService.atualizar()` existe mas a UI nao permite editar nome/descricao de listas
- **Onde**: `src/services/counting-list.service.ts`

### 11. Sincronizacao individual (hierarquia/produtos/estoque)
- **O que**: 3 metodos em `syncService` (sincronizarHierarquia, sincronizarProdutos, sincronizarEstoque) nunca sao chamados
- **Onde**: `src/services/sync.service.ts`
- **Nota**: A importacao usa `importService` em vez de `syncService`

---

## Limpeza de Codigo

### Types nao utilizados (podem ser removidos ou mantidos para uso futuro)
| Tipo | Arquivo | Linha |
|------|---------|-------|
| `Store` | `types/index.ts` | 231 |
| `Counting` | `types/index.ts` | 173 |
| `CountingCreate` | `types/index.ts` | 186 |
| `FilteredProductResponse` | `types/index.ts` | 282 |

### Services com metodos nao utilizados
| Service | Metodo | Motivo |
|---------|--------|--------|
| `inventoryService` | `adicionarItem()` | Substituido por `adicionarProdutosPorCodigos()` |
| `inventoryService` | `adicionarItensBulk()` | Idem |
| `inventoryService` | `listarContagens()` | Substituido por `buscarHistoricoContagem()` |
| `productService` | `listar()` | Substituido por `listarProtheus()` |
| `monitoringService` | `getStatistics()` | Nunca integrado na UI |

---

## Melhorias de UX

### 12. Tab Itens — colunas demais
- A tabela de itens tem 19 colunas, muitas com texto minusculo (11px)
- **Sugestao**: Agrupar colunas em expandable rows ou usar toggle de colunas visiveis

### 13. Contagem mobile — feedback visual
- Apos registrar contagem, nao ha animacao ou feedback alem do toast
- **Sugestao**: Checkmark animado no card do produto + auto-scroll para proximo

### 14. Dashboard — filtros por periodo
- Dashboard mostra dados gerais sem filtro de data
- **Sugestao**: Seletor de periodo (7d, 30d, 90d) para graficos e metricas

### 15. Export — nome do arquivo com inventario
- Exports geram nomes genericos (`itens_inventario_2026-03-01.csv`)
- **Sugestao**: Incluir nome do inventario no filename

---

*Ultima atualizacao: 01/03/2026*
