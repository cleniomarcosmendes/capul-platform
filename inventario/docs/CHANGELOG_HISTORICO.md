# 📜 Histórico de Correções - Sistema de Inventário Protheus

**Arquivo**: Histórico de correções v2.9 e versões anteriores
**Propósito**: Documentar correções históricas para referência técnica
**Última Atualização**: 24/10/2025

---

## 📋 Índice

- [Correções v2.9.3.2 (13/10/2025)](#correções-v2932-13102025)
- [Correções v2.9.3.1 (12/10/2025)](#correções-v2931-12102025)
- [Correções v2.9.3 (12/10/2025)](#correções-v293-12102025)
- [Correções v2.9.2 (12/10/2025)](#correções-v292-12102025)
- [Correções v2.9.1 (12/10/2025)](#correções-v291-12102025)
- [Correções v2.9 (12/10/2025)](#correções-v29-12102025)
- [Correções v2.8.2 (12/10/2025)](#correções-v282-12102025)
- [Correções v2.8.1 (12/10/2025)](#correções-v281-12102025)
- [Correções v2.8 (10/10/2025)](#correções-v28-10102025)
- [Correções v2.7.1 (06/10/2025)](#correções-v271-06102025)
- [Correções v2.7 (06/10/2025)](#correções-v27-06102025)
- [Correções Anteriores (v2.6 - v2.2)](#correções-anteriores-v26---v22)

---

## Correções v2.9.3.2 (13/10/2025)

### ✅ FILTRO "PENDENTES" CORRIGIDO
**Problema**: Modal "Ver Detalhes" mostrava produtos incorretos no filtro "Pendentes"
- Filtro listava `count_2` mesmo com `current_cycle=1`
- Endpoint `/api/v1/counting-lists/{list_id}` não existia (404)
- Frontend usava default `current_cycle=1` incorretamente

**Solução Implementada**:
- Criado novo endpoint `GET /api/v1/counting-lists/{list_id}` retornando dados corretos do banco
- Filtro agora mostra apenas produtos não contados no ciclo atual da lista
- **Arquivo**: `backend/app/main.py:8689-8758`

**Impacto**: Filtro funciona corretamente por ciclo

---

### ✅ NOMES CONSISTENTES
**Problema**: Inventários COMPLETED com nomes inconsistentes
- Ex: "clenio_01" vs "[FINALIZADO] clenio_01"
- Sistema usava localStorage do navegador para adicionar prefixo
- Só inventários encerrados na sessão tinham prefixo

**Solução Implementada**:
- Removida dependência de localStorage + fallback que alterava nome no banco
- Todos inventários COMPLETED exibem nome original (sem prefixos)
- **Arquivos**: `frontend/inventory.html:19600-19612, 18938-18945, 18890-18894`

**Impacto**: Nomes sempre consistentes no sistema

---

### ✅ STATUS SIMPLIFICADOS
**Motivação**: Sistema tem apenas 2 ações reais (Criar → Em Andamento | Encerrar → Encerrado)

**Antes**: 10+ status confusos
- "Em Preparação", "Em Contagem", "Liberada", "DRAFT", etc.

**Depois**: Apenas 2 estados
- 🔵 **Em Andamento**: Qualquer status exceto COMPLETED
- ✅ **Encerrado**: COMPLETED

**Arquivos**: `frontend/inventory.html:19988-20051`
- Funções: `getStatusText()`, `getStatusClass()`, `getStatusBadgeClass()`

**Benefício**: Interface alinhada com fluxo real de uso

---

## Correções v2.9.3.1 (12/10/2025)

### ✅ BUG CRÍTICO - MÚLTIPLAS LISTAS NÃO APARECIAM
**Problema**: Modal mostrava inventário agregado
- Ex: "clenio_04: 2 produtos, 2 contados, 0 pendentes"
- Query buscava apenas `counter_cycle_1`, ignorando reatribuições nos ciclos 2 e 3

**Solução Implementada**:
- Query reescrita com OR em `counter_cycle_1/2/3` para capturar todas atribuições
- OPERATOR agora vê TODAS as listas atribuídas em qualquer ciclo
- **Arquivo**: `backend/app/api/v1/endpoints/assignments.py:1055-1061`

**Impacto**: Sistema funcional para múltiplas listas

---

### ✅ PADRONIZAÇÃO DE INTERFACE
**Mudança**: Modal de seleção com tabela (igual a "Gerenciar Lista")

**Antes**: Cards grandes clicáveis (inconsistente)
**Depois**: Tabela com radio buttons (padrão do sistema)

**Colunas**: Sel | Código | Nome da Lista | Local | Ciclo | Status | Itens

**Arquivo**: `frontend/counting_improved.html:1107-1133, 5261-5365`

**Benefício**: Experiência consistente em todo o sistema

---

### ✅ OTIMIZAÇÃO DE ESPAÇO
**Melhorias de layout**:
- **Removido**: Coluna "Data Ref." (informação secundária)
- **Renomeado**: "Armazém" → "Local" (mais compacto, economiza 50px)
- **Aumentado**: Largura "Nome da Lista" de 180px → 300px (+67%)

**Resultado**: Nomes completos em uma única linha, sem quebras

**Arquivo**: `frontend/counting_improved.html:1112-1119`

---

### ✅ CORREÇÃO DE CONTAGEM DE ITENS
**Problema**: Coluna "Itens" exibia `0/0` para todas as listas
- Backend não consultava `counting_list_items`

**Solução Implementada**:
- Queries adicionadas para total_items e completed_items por ciclo
- Badge: 🟢 Verde (completo) | 🟡 Amarelo (pendente)
- **Arquivo**: `backend/app/api/v1/endpoints/assignments.py:1141-1175`

**Impacto**: Informações precisas na interface

---

### ✅ CONSISTÊNCIA DE UX
**Mudança**: Botão "X" do modal com comportamento uniforme
- Botão fechar agora executa `logoutUsuario()` (igual ao botão "Sair")
- OPERATOR não tem outra página para voltar, logout é a ação correta
- **Arquivo**: `frontend/counting_improved.html:1092`

---

## Correções v2.9.3 (12/10/2025)

### ✅ ACESSO VIA 2 CORRIGIDO
**Problema**: SUPERVISOR/ADMIN não conseguiam acessar via "Gerenciar Lista"
- Modal de seleção não mostrava inventários com status 'ABERTA'
- Query filtrava apenas ['RELEASED', 'EM_CONTAGEM'], ignorando 'ABERTA'

**Solução Implementada**:
- Adicionado 'ABERTA' aos filtros de status no backend
- **Arquivo**: `backend/app/api/v1/endpoints/assignments.py:1053,1080`

**Benefício**: Acesso funcional em todas as etapas do inventário

---

### ✅ INFORMAÇÕES DO CARD MELHORADAS
**Dados exibidos**: Armazém, Data de Referência, Loja/Filial
- Backend: Queries retornam `warehouse`, `reference_date`, `store_name`
- Frontend: Mapeamento correto dos campos na interface
- **Arquivo**: `backend/app/api/v1/endpoints/assignments.py:1122-1139`

---

### ✅ BOTÃO "SAIR DO SISTEMA"
**Motivo**: OPERATOR não tem acesso à página de inventários
- Implementação: Botão no modal de seleção com limpeza completa
- Função: `logoutUsuario()` limpa localStorage e redireciona para login
- **Arquivo**: `frontend/counting_improved.html:1105-1114, 1327-1344`

---

### ✅ MODAL-FIRST APPROACH
**Fluxo**: Login → Página branca → Modal → Seleção → Reload com inventoryId
- Elementos ocultos: Header e main-container escondidos até seleção
- Bug corrigido: Parâmetro URL inconsistente (inventoryId vs inventory_id)
- **Arquivo**: `frontend/counting_improved.html:1909-1928, 5368`

---

### ✅ INTERFACE MOBILE-FRIENDLY
**Fontes otimizadas para dispositivos móveis**:
- Nome do inventário: 22px (desktop) → 24px (mobile)
- Informações (armazém, data, loja): 16px (desktop) → 17px (mobile)
- Badges de status: 15px (desktop) → 16px (mobile)
- Ícones: Aumentados proporcionalmente (16-18px)
- Padding aumentado: 18px (desktop) → 20px (mobile) para melhor toque

**Media query**: `@media (max-width: 768px)` com otimizações específicas

**Arquivo**: `frontend/counting_improved.html:703-784`

**Benefício**: Melhor legibilidade em smartphones durante contagem física

---

## Correções v2.9.2 (12/10/2025)

### ✅ REDIRECIONAMENTO INTELIGENTE NO LOGIN
**Problema**: OPERATOR via dashboard (sem permissão) → alerta de erro → redirect para contagem

**Solução Implementada**:
- Login verifica role e redireciona DIRETO para página correta
- **OPERATOR**: `login.html` → `counting_improved.html` (direto)
- **ADMIN/SUPERVISOR**: `login.html` → `dashboard.html` (direto)

**Performance**: 2 redirects → 1 redirect (50% mais rápido)

**UX**: Zero alertas de erro, experiência fluida para todos os perfis

**Arquivo**: `frontend/login.html:673-681, 738-746`

**Documentação**: Ver [CORRECAO_LOGIN_RBAC_v2.9.2.md](../CORRECAO_LOGIN_RBAC_v2.9.2.md)

---

## Correções v2.9.1 (12/10/2025)

### ✅ CORREÇÃO DE EXCLUSÃO DE USUÁRIOS
**Problema**: Usuários excluídos continuavam aparecendo na lista
- GET /users retornava TODOS os usuários (ativos + inativos)

**Solução Implementada**:
- GET /users agora filtra apenas usuários ativos por padrão
- Parâmetro opcional: `include_inactive=true` para admin ver todos
- Soft Delete: Mantido para auditoria (`is_active = false`)

**UX**: Usuário excluído desaparece da interface imediatamente

**Arquivo**: `backend/app/api/v1/endpoints/users.py:19-30, 273`

**Documentação**: Ver [CORRECAO_EXCLUSAO_USUARIOS_v2.9.1.md](../CORRECAO_EXCLUSAO_USUARIOS_v2.9.1.md)

---

## Correções v2.9 (12/10/2025)

### ✅ SISTEMA RBAC COMPLETO
**Implementação**: Controle de acesso centralizado por perfil

**Componentes**:
- Módulo centralizado: `frontend/js/access_control.js`
- 3 Perfis: OPERATOR (só contagem), SUPERVISOR (+ relatórios/inventário), ADMIN (acesso total)
- Proteção automática: Verificação em todas as páginas do sistema
- Menus dinâmicos: Visibilidade baseada em role do usuário
- Redirecionamento: Automático quando acesso negado
- Logs detalhados: Debug completo de permissões

**Páginas protegidas**: Dashboard, Usuários, Lojas, Produtos, Relatórios, Inventário

**Arquivos**: 10 páginas HTML + `access_control.js` + documentação

**Documentação**: Ver [IMPLEMENTACAO_CONTROLE_ACESSO_v2.9.md](../IMPLEMENTACAO_CONTROLE_ACESSO_v2.9.md)

---

### ✅ RASTREAMENTO DE LOTES MULTI-CICLO
**Feature**: Extração e visualização de múltiplos lotes por contagem

**Implementação**:
- Modais: "Ver Detalhes" e "Análise do Inventário" com linhas sintéticas (🟡) e analíticas (🟢)
- Backend: Array completo de `countings` com todos os detalhes de lotes
- Frontend: Função `extractAllLotsFromObservation()` extrai todos os pares lote:quantidade
- Visualização: 3 colunas (1ª Cont, 2ª Cont, 3ª Cont) para cada lote individual

**Arquivo**: `frontend/inventory.html` (+803 linhas) e `backend/app/main.py` (+64 linhas)

**Impacto**: Rastreabilidade total de lotes em todos os ciclos de contagem

**Documentação**: Ver [IMPLEMENTACAO_RASTREAMENTO_LOTES_v2.9.md](../IMPLEMENTACAO_RASTREAMENTO_LOTES_v2.9.md)

---

## Correções v2.8.2 (12/10/2025)

### ✅ BUG CRÍTICO - ENCERRAMENTO DE INVENTÁRIO
**Problema**: Botão "Encerrar Inventário" sempre bloqueava mesmo com todas as listas finalizadas

**Causa**: Frontend consultava tabela errada (`inventory_lists` em vez de `counting_lists`)

**Solução Implementada**:
- Alterado endpoint de `/api/v1/inventory/lists/{id}` para `/api/v1/inventories/{id}/counting-lists`
- Regra: Inventário só pode ser encerrado quando **todas** as `counting_lists` estão com `list_status='ENCERRADA'`

**Arquivo**: `frontend/inventory.html:17502-17540` - Função `showClosureModal()`

**Impacto**: Sistema agora valida corretamente o status real das listas de contagem

---

## Correções v2.8.1 (12/10/2025)

### ✅ RELATÓRIOS - REDESIGN COMPLETO
**Interface profissional e funcional**:
- Cabeçalho redesenhado: layout em grid 3x1 (Inventário | Armazém | Data Referência)
- Removidas redundâncias: título duplicado e informações repetidas eliminadas
- Hierarquia visual clara com labels uppercase e valores destacados
- Rodapé simplificado apenas com "Por: [usuário]"

---

### ✅ EXPORTAÇÕES IMPLEMENTADAS
**Sistema completo de exportação de dados**:
- **CSV**: Formato tabulado para planilhas (UTF-8, com cabeçalhos)
- **Excel**: Arquivo .xls com cabeçalho completo e resumo financeiro
- **JSON**: Dados estruturados para integrações e backups
- Nome dos arquivos padronizado: `relatorio_[nome]_[data].ext`

---

### ✅ SIMPLIFICAÇÃO DA TABELA
**Coluna "Status" removida** (informação redundante)
- Tabela mais limpa com 5 colunas: Código, Produto, Esperado, Contado, Diferença
- Foco nas informações essenciais para análise de divergências

---

## Correções v2.8 (10/10/2025)

### ✅ SISTEMA DE RECÁLCULO DE DIVERGÊNCIAS
**Arquitetura profissional implementada**:
- Função reutilizável `recalculate_discrepancies_for_list()` (backend/app/main.py:8878-9003)
- Recálculo automático ANTES de validar encerramento (elimina bugs de timing)
- Recálculo ao liberar lista para ciclo 2/3 (flags sempre atualizadas)
- Encerramento automático quando sem divergências (ciclo 2/3)
- Logging detalhado para rastreabilidade total

---

### ✅ BUG DE ENCERRAMENTO DE RODADA
**Corrigido salvamento de contagens**:
- Flag `needs_count_cycle_*` agora é marcada como `false` ao salvar (backend/app/main.py:9613)
- Sistema valida corretamente produtos contados em TODOS os ciclos
- Correção de lógica de validação diferenciada por ciclo

---

## Correções v2.7.1 (06/10/2025)

### ✅ CÓDIGO ÚNICO POR LISTA
**Identificação imutável de 8 caracteres**:
- Código baseado em UUID (primeiros 8 chars em uppercase)
- Nova coluna "Código" na tabela de listas (frontend/inventory.html:2416)
- Facilita comunicação e rastreabilidade ("Lista 23AA4A06")

---

### ✅ BUG DE TROCA DE NOMES
**Corrigido comportamento ao selecionar lista**:
- Data-attribute `data-original-counter-name` preserva nome original
- Restauração correta de nomes ao desselecionar (frontend/inventory.html:4669-4681)

---

## Correções v2.7 (06/10/2025)

### ✅ BOTÕES ENCERRAR vs FINALIZAR
**Lógica diferenciada por ciclo**:
- **ENCERRAR (🟠)**: Avança para próximo ciclo (validação obrigatória)
- **FINALIZAR (🔴)**: Encerra lista definitivamente (permite pular ciclos)
- Validações específicas por ciclo no backend (backend/app/main.py:9135-9200)
- Modais educativos explicando diferença entre os botões
- Regras claras: Ciclo 1 exige contagens, Ciclo 2/3 pode usar anteriores

---

## Correções Anteriores (v2.6 - v2.2)

### Correções v2.6 (05/10/2025)
- ✅ **BUG CRÍTICO - FINALIZAÇÃO**: Erro SQLAlchemy corrigido
- ✅ **MODAL "VER DETALHES"**: Mapeamento completo API → Frontend
- ✅ **UX MELHORADA**: Interface limpa e focada

### Correções v2.5 (05/10/2025)
- ✅ **VALIDAÇÃO DE CONTAGENS**: Sistema não permite encerrar sem contagens
- ✅ **UX PROFISSIONAL**: Modais informativos com instruções
- ✅ **BACKEND ROBUSTO**: Dupla camada de validação

### Correções v2.3 e v2.2
- ✅ **Sistema de Ciclos**: Transição 2 → 3 corrigida
- ✅ **Status Dinâmico**: Detecção em tempo real
- ✅ **Casos Especiais**: Produtos com qty=0 tratados corretamente

---

## 📚 Referências

### Documentação Relacionada
- [CLAUDE.md](../CLAUDE.md) - Guia principal do projeto
- [DOCUMENTACAO.md](../DOCUMENTACAO.md) - Índice master da documentação
- [CHANGELOG_CICLOS.md](CHANGELOG_CICLOS.md) - Histórico de mudanças do sistema de ciclos
- [TROUBLESHOOTING_CICLOS.md](TROUBLESHOOTING_CICLOS.md) - Resolução de problemas

### Arquivos de Correção Específicos
- [CORRECAO_LOGIN_RBAC_v2.9.2.md](../CORRECAO_LOGIN_RBAC_v2.9.2.md)
- [CORRECAO_EXCLUSAO_USUARIOS_v2.9.1.md](../CORRECAO_EXCLUSAO_USUARIOS_v2.9.1.md)
- [IMPLEMENTACAO_CONTROLE_ACESSO_v2.9.md](../IMPLEMENTACAO_CONTROLE_ACESSO_v2.9.md)
- [IMPLEMENTACAO_RASTREAMENTO_LOTES_v2.9.md](../IMPLEMENTACAO_RASTREAMENTO_LOTES_v2.9.md)
- [CORRECAO_DEFINITIVA_CICLOS_v2.8.md](../CORRECAO_DEFINITIVA_CICLOS_v2.8.md)
- [CORRECAO_BOTOES_ENCERRAR_FINALIZAR_v2.7.md](../CORRECAO_BOTOES_ENCERRAR_FINALIZAR_v2.7.md)
- [CORRECAO_TROCA_NOMES_USUARIOS_v2.7.1.md](../CORRECAO_TROCA_NOMES_USUARIOS_v2.7.1.md)

---

**📜 Este arquivo documenta correções históricas para referência técnica. Para informações atuais, consulte [CLAUDE.md](../CLAUDE.md).**
