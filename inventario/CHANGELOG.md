# Changelog - Sistema de Inventário Protheus

Todas as mudanças notáveis do projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [2.18.1] - 2025-11-04

### 🐛 Correções Críticas - Relatório de Transferências (6 bugs)

#### Bug #1: Erro de Sintaxe JavaScript (BLOQUEADOR)
- **Fixed**: Removido bloco duplicado de tabela Análise Manual em `comparison_results.html`
- **Commit**: `869d421`
- **Impacto**: Página não carregava (Syntax Error)

#### Bug #2: Coluna "Dif. Final" com Valores Incorretos
- **Fixed**: Mudança de `||` para `!== undefined` no cálculo de Diferença Final
- **Commit**: `c2409e4`
- **Impacto**: Produtos com divergência zerada mostravam valor original
- **Files**: `frontend/comparison_results.html` (2 locais: display + CSV)

#### Bug #3: Economia Calculada com Custo Real (B2_CM1)
- **Fixed**: Substituído R$ 850 fixo por custo médio real (`produto.b2_cm1 × quantidade_transferida`)
- **Commit**: `c2409e4`
- **Impacto**: Economia agora reflete valores reais dos produtos
- **Files**: `backend/app/api/v1/endpoints/inventory_comparison.py` (7 mudanças)

#### Bug #4: Backend Não Retornando b2_cm1_a/b
- **Fixed**: Adicionados campos `b2_cm1_a` e `b2_cm1_b` nas respostas da API
- **Commit**: `50f6dd1`
- **Impacto**: Frontend recebia undefined
- **Files**: `backend/app/api/v1/endpoints/inventory_comparison.py`

#### Bug #5: Descrição Desatualizada Sobre R$ 850
- **Fixed**: Atualizada descrição para explicar cálculo real (Custo Médio × Qtd Transferida)
- **Commit**: `0e5e353`
- **Files**: `frontend/comparison_results.html`

#### Bug #6: Produtos com Lote Sem Economia (CRÍTICO)
- **Fixed**: Adicionado `b2_cm1_a` e `b2_cm1_b` para produtos com lote individual
- **Commit**: `d41f603`
- **Impacto**: 50% dos produtos não calculavam economia
- **Files**: `backend/app/api/v1/endpoints/inventory_comparison.py` (linhas 512-524)

### ✅ Validação
- Página carrega sem erros de sintaxe
- Coluna "Dif. Final" mostra 0 (verde) para divergências zeradas
- Economia calculada com B2_CM1 real (ex: R$ 190,74, R$ 88,66)
- Produtos COM lote exibem economia corretamente
- Produtos SEM lote continuam exibindo economia

### 📚 Documentação
- [CORRECOES_CRITICAS_v2.18.1.md](CORRECOES_CRITICAS_v2.18.1.md)

---

### 📊 Relatórios Individuais A e B

#### Added
- **Página de relatórios individuais** com impacto de transferências
- **Estrutura de 11 colunas** consistente com Análise Manual
- **Color-coding** (verde, amarelo, azul) para facilitar visualização
- **Economia visível** calculada com B2_CM1 real

#### Changed
- Função `openInventoryReportPage()` agora passa 3 parâmetros (inventory_id, inventory_a_id, inventory_b_id)
- Redirecionamento corrigido de `reports.html` para `inventory_transfer_report.html`
- Relatórios agora usam dados do backend (`transferencia_logica`) ao invés de cálculos manuais

#### Commits
- `f138db7` - fix: corrigir redirecionamento dos relatórios individuais
- `4eb32fb` - feat: reestruturar inventory_transfer_report.html com 11 colunas
- `b1e98a6` - feat: adicionar color-coding e usar dados do backend
- `ba3dbfe` - refactor: remover código temporário de debug

#### Files Modified
- `frontend/inventory.html` (linhas 24111-24154)
- `frontend/inventory_transfer_report.html` (reestruturação completa)

### 📚 Documentação
- [IMPLEMENTACAO_RELATORIOS_INDIVIDUAIS_v2.18.1.md](IMPLEMENTACAO_RELATORIOS_INDIVIDUAIS_v2.18.1.md)

---

### 🐛 Bug Fixes - Sistema de Transferências (4 bugs encadeados)

#### Bug #1: Backend Não Retornava Array `transfers`
- **Fixed**: Criado array agregando produtos com transferência > 0
- **Commit**: `4128ee5`
- **Files**: `backend/app/api/v1/endpoints/inventory_comparison.py` (linhas 908-947)

#### Bug #2: Array `transfers` Sem Campos Necessários
- **Fixed**: Adicionados campos `expected_a`, `counted_a`, `expected_b`, `counted_b`
- **Commit**: `2f7aa35`
- **Files**: `backend/app/api/v1/endpoints/inventory_comparison.py` (linhas 923-926, 942-945)

#### Bug #3: Frontend Usando Cache Desatualizado
- **Fixed**: Forçar busca da API quando `mode === 'transfers'`
- **Commit**: `27d3c2e`
- **Files**: `frontend/comparison_results.html` (linhas 410-430)

#### Bug #4: URL Sem Parâmetros (CAUSA RAIZ)
- **Fixed**: Função `openComparisonResultsPage()` agora passa IDs na URL
- **Commits**: `e0b76f3`, `7a661d5`
- **Files**: `frontend/inventory.html` (linhas 24069-24105)

### ✅ Exemplo Real (Produto 00010037)
**Antes (v2.18.0 - BUG)**:
```
SALDO ANTES | SALDO DEPOIS | SALDO ANTES | SALDO DEPOIS | QTD TRANSF.
    0       |      0       |     0       |      0       |     73
```

**Depois (v2.18.1 - CORRIGIDO)**:
```
ARM.06 (ORIGEM)              | ARM.02 (DESTINO)            | QTD TRANSF.
SALDO ANTES | SALDO DEPOIS   | SALDO ANTES | SALDO DEPOIS |  LÓGICA
    79      |      6         |     864     |     937      |    73
```

### 📚 Documentação
- [CORRECOES_CRITICAS_v2.18.1.md](CORRECOES_CRITICAS_v2.18.1.md) (atualizado com todos os 10 bugs)

---

## [2.18.0] - 2025-11-04

### 💰 Sistema de Transferência Lógica (Otimização Fiscal)

#### Added
- **Algoritmo de transferência lógica** em 3 cenários (A→B, B→A, sem transferência)
- **Cálculo de economia** baseado em NFs evitadas (R$ 850/NF)
- **6 novas colunas** na tabela Análise Manual:
  - Transf. → B / Transf. ← A (quantidade transferida)
  - Estoque Ajust. (saldo após ajuste lógico)
  - Dif. Final (divergência após ajuste)
  - Economia (R$) (valor monetário)
- **Color-coding** para visualização:
  - 🟢 Verde: Divergência zerou
  - 🟡 Amarelo: Divergência reduzida
  - 🔵 Azul: Transferências lógicas
- **Banners explicativos** em todas as modalidades
- **Badges "LÓGICA"** em produtos com transferência
- **Cards de resumo** por inventário (produtos zerados, divergências reduzidas, unidades transferidas)
- **Exportação completa** (CSV 17 colunas, Excel com formatação)

#### Changed
- Tabela Análise Manual: 11 colunas → 17 colunas
- Tabela Transferências: reestruturada com saldos antes/depois
- API `/api/v1/inventory/compare` retorna novos campos:
  - `transferencia_logica` (objeto com 12 campos)
  - `saldo_ajustado_a`, `saldo_ajustado_b`
  - `diferenca_final_a`, `diferenca_final_b`

#### Commits
- Múltiplos commits implementando 6 fases do sistema

#### Files Modified
- `backend/app/api/v1/endpoints/inventory_comparison.py` (+150 linhas)
- `frontend/comparison_results.html` (+400 linhas)

#### Files Created
- `PLANO_TRANSFERENCIA_LOGICA_v2.18.0.md` (740 linhas)
- `IMPLEMENTACAO_TRANSFERENCIA_LOGICA_v2.18.0.md` (documentação completa)
- `/mnt/c/temp/test_transferencia_logica.py` (3 testes automatizados)

### 📚 Documentação
- [IMPLEMENTACAO_TRANSFERENCIA_LOGICA_v2.18.0.md](IMPLEMENTACAO_TRANSFERENCIA_LOGICA_v2.18.0.md)

---

## [2.17.4] - 2025-11-02

### 🎯 Sistema de Profissionalização Global

#### Added
- **Interceptor global de sessão expirada** (redirecionamento automático para login)
- **Mensagens de erro amigáveis** (tradução de códigos HTTP para português)
- **Loading state global** (feedback visual em operações longas)
- **Confirmações de ações destrutivas** (modal antes de deletar)
- **Funções utilitárias** (`fetchWithLoading`, `validateNumericInput`, `validateRequiredFields`)

#### Files Created
- `frontend/js/global_utils.js` (350+ linhas)

#### Files Modified
- 8 páginas HTML (adicionado script global_utils.js):
  - `frontend/inventory.html`
  - `frontend/counting_improved.html`
  - `frontend/counting_mobile.html`
  - `frontend/reports.html`
  - `frontend/users.html`
  - `frontend/import.html`
  - `frontend/comparison_results.html`
  - `frontend/stores.html`

### 🐛 Bug Fixes (4 correções críticas)

#### Bug #1: Desalinhamento de Colunas no Modal "Criar Listas"
- **Fixed**: Corrigido colspan 16→17, adicionada coluna "Ações"
- **Files**: `frontend/inventory.html`

#### Bug #2: Lógica "Zero Confirmado" (needs_count_cycle)
- **Fixed**: Adicionado caso especial para produtos com expected=0 e campo vazio
- **Files**: `backend/app/main.py` (linhas 9718-9733, 9786-9801)

#### Bug #3: Lógica "Zero Confirmado" (status)
- **Fixed**: Adicionado `ZERO_CONFIRMED` ao ENUM + trigger atualizado
- **Files**:
  - `database/migration_status_triggers.sql`
  - `database/migrations/005_add_zero_confirmed_enum.sql` (NOVO)

#### Bug #4: Erro 500 ao Abrir Modal "Criar Lista" (CRÍTICO)
- **Fixed**: Adicionado `ZERO_CONFIRMED` ao modelo Python `CountingStatus`
- **Files**: `backend/app/models/models.py`

### 📚 Documentação
- [MELHORIAS_PROFISSIONALIZACAO_v2.17.4.md](MELHORIAS_PROFISSIONALIZACAO_v2.17.4.md)

---

## [2.17.3] - 2025-11-02

### 📊 Melhorias em Relatórios e UX

#### Added
- **Cálculo de diferença por lote** nas linhas analíticas (HTML, CSV, Excel)
- **Coluna "Armazém"** em todos os relatórios
- **Preenchimento "Total Esperado"** nas linhas analíticas
- **Atalho ENTER** para criar inventário (modal + auto-focus)

#### Changed
- Badge de armazém simplificado (texto simples ao invés de badge)
- PDF do Relatório de Comparação otimizado (14 colunas, orientação paisagem)

#### Files Modified
- `frontend/reports.html` (linhas ~810-1453)
- `frontend/inventory.html` (linhas 1057-1111, 1857-1949, 21438-21649)
- `frontend/comparison_results.html` (linhas 151-642)

---

## [2.17.2] - 2025-11-02

### 🎨 Correção Completa de Células Vazias no Modal Análise

#### Fixed
- Células vazias em "Qtd Final" e "Diferença" na linha sintética (amarela)
- Células vazias em "Total Esperado" nas linhas analíticas (verdes)
- Desalinhamento de colunas
- Validação incorreta (`!== null` → `!= null`)

#### Commits (7 sequenciais)
- `5874951` - Validação null vs undefined
- `07585fd` - Colunas faltantes + valores agregados
- `b06010d` - Debug de cálculos agregados
- `aa5bf4c` - Debug de validação de tipos
- `43668c6` - Debug detalhado
- `652a95a` - Colunas Entregas Post. e Total Esperado
- `38d2480` - **FINAL v2.17.2** - Limpeza e conclusão

#### Files Modified
- `frontend/inventory.html` (modal Análise - linhas 19190-19530)

---

## [2.17.1] - 2025-11-01

### 📦 Campo "Lote do Fornecedor" (B8_LOTEFOR)

#### Added
- Campo `b8_lotefor` no snapshot (backend)
- Campo `b8_lotefor` na API endpoint (3 pontos estratégicos)
- Coluna "Lote Fornecedor" no modal "Ver Detalhes" (frontend)
- Suporte a drafts (lotes digitados manualmente)

#### Fixed
- Produtos 00010093 e 00010119 não exibiam lote fornecedor no relatório
- Backend não retornava `saved_lots` no endpoint `/final-report`
- Salvamentos duplicados no modal de lotes (6 vezes → 1 vez)
- API retornava contagens duplicadas (DISTINCT ON)

#### Commits
- `dc300c9` - fix(reports): adicionar campo saved_lots ao endpoint final-report
- `b401fb6` - fix: prevenir salvamentos duplicados ao fechar modal
- Múltiplos commits implementando B8_LOTEFOR

#### Files Modified
- `backend/app/services/snapshot_service.py`
- `backend/app/main.py`
- `frontend/inventory.html`
- `frontend/counting_improved.html`
- `frontend/reports.html`

### 📚 Documentação
- [PLANO_B8_LOTEFOR_v2.17.1.md](PLANO_B8_LOTEFOR_v2.17.1.md)
- [CORRECAO_SALVAMENTOS_DUPLICADOS_LOTES_v2.17.1.md](CORRECAO_SALVAMENTOS_DUPLICADOS_LOTES_v2.17.1.md)
- [CORRECAO_COUNTINGS_DUPLICADOS_API_v2.17.1.md](CORRECAO_COUNTINGS_DUPLICADOS_API_v2.17.1.md)

---

## [2.16.2] - 2025-10-30

### 🎨 Sistema de 5 Cards + Otimizações

#### Added
- **Sistema de 5 cards horizontais** (Match, Manual, Transferências, Relatório A, B)
- **Botão "Voltar"** reabre modal automaticamente

#### Fixed
- Bug Fix - Hierarquia mercadológica (importação com campos errados)

#### Changed
- Otimização de performance - Cálculo de economia movido para backend
- Modal de comparação: 1200px de largura

#### Files Modified
- `backend/app/api/v1/endpoints/inventory_comparison.py` (linhas 574-640)
- `frontend/inventory.html` (linhas 23237-23330, 23371-23400, 23590-23632)
- `frontend/comparison_results.html` (linhas 689-726)

---

## [2.15.7.8] - 2025-10-29

### 🐛 Correções de Relatórios e Lotes (5 correções)

#### Fixed
- v2.15.7.3 - Quantidade esperada por lote no Modal "Análise"
- v2.15.7.5 - Nome do inventário no modal Análise
- v2.15.7.6 - Quantidade esperada por lote nos Relatórios
- v2.15.7.7 - Correção de "MULTIPLOS_LOTES"
- v2.15.7.8 - Correção do lote falso "09" (timestamp capturado como lote)

#### Commits
- `4bd6527` - feat: adicionar Qtd Esperada por lote no Modal Análise
- `e1b16aa` - fix: corrigir endpoint da API para buscar nome do inventário
- `6e0f9f8` - feat: adicionar snapshot_lots no endpoint final-report (backend)
- `406ce19` - feat: adicionar Qtde Lote e corrigir "MULTIPLOS_LOTES" no relatório
- `cf3c7f8` - fix: corrigir extração de múltiplos lotes (MULTIPLOS_LOTES)
- `c73f16f` - fix: corrigir regex de lotes para ignorar timestamp

#### Files Modified
- `frontend/inventory.html`
- `frontend/reports.html`
- `backend/app/main.py`

---

## [2.15.5] - 2025-10-28

### 🔴 CORREÇÃO CRÍTICA: Produtos Não Contados Subindo para Recontagem

#### Fixed
- **Bug crítico** com impacto financeiro: produtos NÃO contados não apareciam para recontagem
- **Causa raiz 1**: Dessincronização de ciclos (backend)
- **Causa raiz 2**: Filtro excluía produtos com `count_cycle_X = NULL` (frontend)

#### Added
- Sincronização condicional de ciclos (1 lista = sincronizar, múltiplas = isolar)
- Filtros ciclo 2 e 3 agora incluem produtos não contados

#### Files Modified
- `backend/app/main.py` (linhas 9817-9840)
- `frontend/counting_improved.html` (linhas 2720-2766)

### 📚 Documentação
- [CORRECAO_CRITICA_PRODUTOS_NAO_CONTADOS_v2.15.5.md](CORRECAO_CRITICA_PRODUTOS_NAO_CONTADOS_v2.15.5.md)

---

## [2.15.4] - 2025-10-28

### ⚠️ Correção: Usuários Disponíveis Multi-Filial

#### Fixed
- Endpoint `available-users` não considerava tabela `user_stores`
- Comparava apenas com `user.store_id` (filial padrão)

#### Changed
- 4 locais corrigidos para usar `user_stores` ao invés de `user.store_id`

#### Files Modified
- `backend/app/api/v1/endpoints/inventory.py` (linhas 1305-1317, 39-48)
- `backend/app/main.py` (linhas 3345-3388)
- `backend/app/api/v1/endpoints/assignments.py` (linhas 507-526)

### 📚 Documentação
- [CORRECAO_USUARIOS_DISPONIVEIS_v2.15.4.md](CORRECAO_USUARIOS_DISPONIVEIS_v2.15.4.md)

---

## [2.15.3] - 2025-10-28

### 🔥 Correção Crítica: Códigos de Filial

#### Fixed
- **Bug crítico**: Modal "Adicionar Produtos" retornava 0 produtos
- **Causa raiz**: Tabelas exclusivas (SB2, SB8, SBZ) com código de filial vazio
- Endpoint usava `b1_filial` (vazio) ao invés de parâmetro `filial`

#### Changed
- Funções `_prepare_sb2010()`, `_prepare_sb8010()`, `_prepare_sbz010()` corrigidas

#### Files Modified
- `backend/app/api/v1/endpoints/import_produtos.py` (linhas 507-553, 164-174)
- `backend/app/main.py` (linhas 1557-1576)

### 📚 Documentação
- [CORRECAO_CODIGO_FILIAL_v2.15.3.md](CORRECAO_CODIGO_FILIAL_v2.15.3.md)

---

## [2.15.0] - 2025-10-26

### ⭐ Sistema de Comparação de Inventários

#### Added
- Endpoint `POST /api/v1/inventory/compare`
- 3 modalidades de análise:
  - 🟢 Match Perfeito
  - 🟡 Análise Manual
  - 🔵 Relatório de Transferências
- Modal com cards clicáveis
- Página dedicada de resultados
- Sistema de exportação (Excel, CSV, JSON, Impressão)
- Cálculo de economia estimada (R$ 850/produto)

#### Files Created
- `frontend/comparison_results.html` (700+ linhas)

#### Files Modified
- `frontend/inventory.html` (+400 linhas)
- `backend/app/api/v1/endpoints/inventory.py` (+150 linhas)

### 📚 Documentação
- [PLANO_COMPARACAO_INVENTARIOS_v1.0.md](PLANO_COMPARACAO_INVENTARIOS_v1.0.md)

---

## [2.14.0] - 2025-10-24

### ⭐ Sincronização com API Protheus

#### Added
- Endpoint `POST /api/v1/sync/protheus/hierarchy`
- Lógica UPDATE + INSERT + DELETE soft (4 tabelas)
- Performance: 2.706 registros/segundo
- Interface modal em `import.html`
- Tratamento de erros HTTP (504, 502, 403, 500)

#### Changed
- 4 tabelas ajustadas: Campos código VARCHAR(20), descrição VARCHAR(100)

#### Files Created
- `backend/app/api/v1/endpoints/sync_protheus.py` (400 linhas)

#### Files Modified
- `backend/app/main.py` (+14 linhas)
- `backend/app/core/config.py` (+10 linhas)
- `backend/requirements.txt` (+1 linha)
- `frontend/import.html` (+238 linhas)

### 📚 Documentação
- [IMPLEMENTACAO_SYNC_PROTHEUS_v2.14.0.md](IMPLEMENTACAO_SYNC_PROTHEUS_v2.14.0.md)

---

## [2.12.0] - 2025-10-21

### ⭐ Sistema Multi-Filial

#### Added
- Relacionamento N:N (tabela `user_stores`)
- Login Multi-Filial (modal de seleção)
- Migração automática de dados existentes
- Certificados SSL/HTTPS (porta 8443)

#### Changed
- Modelo de usuário: 1 loja → múltiplas lojas

#### Files Created
- `database/migrations/003_multi_store_users.sql`
- `database/migrations/004_migrate_existing_stores.sql`

#### Files Modified
- `backend/app/api/auth.py`
- `frontend/login.html`
- `frontend/users.html`

### 🐛 Bug Fixes
- Página de contagem desktop (3 correções sequenciais)
- Implementação SZB010 (armazéns Protheus)

### 📚 Documentação
- [ANALISE_MULTI_FILIAL_USUARIO_v2.12.0.md](ANALISE_MULTI_FILIAL_USUARIO_v2.12.0.md)
- [IMPLEMENTACAO_SZB010_v2.12.0.md](IMPLEMENTACAO_SZB010_v2.12.0.md)

---

## [2.11.0] - 2025-10-19

### ⭐ Sistema de Contagem Mobile

#### Added
- Página mobile dedicada (`counting_mobile.html`)
- **Contagem Cega**: NÃO exibe qty esperada
- Interface touch-friendly (cards 44x44px, fontes 16-24px)
- Sistema de lotes completo
- RBAC aplicado (OPERATOR vê apenas mobile)

#### Fixed
- 14 bugs corrigidos (filtro "Todos", validação, logout, scanner)
- Propagação de produtos pendentes entre ciclos
- Rastreabilidade de lotes

### 📚 Documentação
- [PLANO_COUNTING_MOBILE_v2.11.0.md](PLANO_COUNTING_MOBILE_v2.11.0.md)
- [TESTE_COUNTING_MOBILE_v2.11.0.md](TESTE_COUNTING_MOBILE_v2.11.0.md)

---

## [2.10.1] - 2025-10-19

### ⭐ Triggers Automáticos de Status

#### Added
- Função `calculate_counting_status()` (PostgreSQL)
- Auto-atualização do campo `status`
- Performance: < 1ms por atualização

#### Fixed
- Bug crítico - Cálculo de lotes (2 modais corrigidos)
- Lógica bifurcada: `b1_rastro='L'` → `SUM(b8_saldo)`

#### Validated
- 100% imutabilidade do snapshot comprovada

### 📚 Documentação
- [IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md](IMPLEMENTACAO_TRIGGERS_STATUS_v2.10.1.md)

---

## [2.10.0] - 2025-10-15

### 🚧 Sistema de Snapshot

#### Added
- Tabela `inventory_items_snapshot` (1:1)
- Tabela `inventory_lots_snapshot` (1:N)
- Imutabilidade total após criação

#### Changed
- Dados do inventário congelados (não mudam com Protheus)

### 📚 Documentação
- [PLANO_SNAPSHOT_INVENTARIO_v1.0.md](PLANO_SNAPSHOT_INVENTARIO_v1.0.md)

---

## Versões Anteriores

Para correções v2.9 e anteriores, consulte:
- 📜 **[docs/CHANGELOG_HISTORICO.md](docs/CHANGELOG_HISTORICO.md)** - Histórico completo (v2.9.3.2 → v2.2)

---

## Legenda

- 🐛 **Bug Fix**: Correção de bug
- ⭐ **Feature**: Nova funcionalidade
- 🔥 **Critical**: Correção crítica (bloqueador)
- ⚠️ **Warning**: Correção importante (impacto financeiro)
- 📊 **Enhancement**: Melhoria de funcionalidade existente
- 🎨 **UI/UX**: Melhorias de interface
- 🚧 **Infrastructure**: Mudanças na infraestrutura
- 📚 **Documentation**: Atualização de documentação
- ⚡ **Performance**: Otimização de performance
- 🔒 **Security**: Correção de segurança

---

**Última Atualização**: 04/11/2025
