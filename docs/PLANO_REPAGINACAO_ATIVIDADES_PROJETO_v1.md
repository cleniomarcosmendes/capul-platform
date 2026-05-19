# Plano de Repaginação — Atividades de Projeto/Subprojeto

**Versão:** 1.0
**Data:** 15/05/2026
**Status:** ✅ PR1+PR2+PR3 (+PR3a backend) implementados em `feat/projetos-atividades-v2` (16/05) · aguardando validação equipe + soak HOM antes de PROD
**Autor:** Clenio + Claude Code
**Mockup de referência:** `docs/mockups/atividades-projeto-v3.html`

---

## 1. Contexto e queixa original

Aba "Atividades" em `ProjetoDetalhePage` (e tela idêntica no subprojeto) está poluída visualmente. Diagnóstico em 6 pontos:

1. Form "Nova Tarefa" persistente ocupa ~250px sempre visíveis no topo
2. Expand de tarefa empurra layout (in-place) — uma tarefa expandida = ~800px de scroll, empurra as outras pra fora do viewport
3. Cronômetro vem em tabela completa de 7+ linhas dentro do card expandido
4. "Notas" + "Comentários" são duas seções quase paralelas — confunde onde escrever
5. Múltiplos controles repetidos por linha: status ⏷, fase ⏷, ▷ iniciar, ✎, 🗑, ▶ — 6 controles × 10 tarefas = 60 botões na tela
6. Cabeçalho do projeto + tabs + form Nova Tarefa = ~450px de chrome antes da 1ª tarefa útil

Prints em `c:\temp\1.jpg`, `2.jpg`, `3.jpg`, `subprojeto.jpg`.

---

## 2. Decisão de design (V3)

Adotar padrão **List + Drawer** que ClickUp, Linear e Notion convergem:

- **Lista densa por fase** (1 tarefa = 1 linha, 12-15 tarefas visíveis sem scroll em viewport típico)
- **Drawer lateral data-driven** abre ao clicar na tarefa
- **Tabs internas no drawer**: Visão geral / Cronômetro (N) / Conversa (N) / Anexos / Histórico
- **"Nova Tarefa"** sai do topo da aba → vira **inline-add** (Linear-style) + atalho `N` abre **modal completo**
- **Composer chat-style** na tab Conversa, reusa `ChatBubbleList` + `ComentarioTexto` + `MentionInput` (já existentes)

### Responsividade (decidida em conjunto, 15/05)

| Viewport | Comportamento drawer | Comportamento modal nova tarefa |
|----------|---------------------|--------------------------------|
| ≥ 1440px | **Push** (alarga layout, lista visível ao lado) | Modal centralizado |
| 768–1439px | **Overlay** (flutua sobre, backdrop escuro) | Modal centralizado |
| < 768px | **Full-screen** | **Bottom-sheet** (slide up) |

### Cor primária

Verde Capul (`#047857` = `emerald-700`) — mantém identidade da plataforma.

### Ícones

`lucide-react` (já instalado no projeto). **Não trocar** pra Tabler como no mockup standalone — é só renomear ícones (`PlayerPlay` → `Play`, `Message` → `MessageCircle`, etc.).

### Não entra agora

- **Drag-and-drop entre fases**: reservado pra Fase 4 (Kanban) — drag faz mais sentido entre colunas Kanban que entre fases numa lista.
- **Dark mode**: precisa infra base nos 5 frontends (ver [backlog dark mode unificado](MELHORIAS_BACKLOG.md)). Adiar pra antes ou depois dessa entrega, conforme janela do time.

---

## 3. Plano técnico — 3 PRs sequenciais

### PR 1 — Quick Wins (~2-3h)

**Objetivo:** Ganhar -250px de chrome sem mexer estrutura. Validar com usuário se a abordagem alivia a queixa antes de investir em PR 2/3.

**Arquivos:**

| Arquivo | Mudança |
|---------|---------|
| `gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx` (linha ~921, `TabCronograma`) | Remover form "Nova Tarefa" do topo. Substituir por botão `<NovaTarefaButton />` + modal já existente |
| `gestao-ti/frontend/src/components/NovaTarefaModal.tsx` *(NOVO)* | Modal com 5 campos atuais (título, início, fim, fase, responsável, descrição). Padrão dos demais modais da plataforma. |
| `gestao-ti/frontend/src/components/NovaTarefaButton.tsx` *(NOVO)* | Botão verde "⊕ Nova tarefa" — abre o modal. Reusa estilo `btn-primary` existente. |

**Atalho de teclado**: `N` global na aba Atividades abre o modal (handler em `useEffect` do `TabCronograma`).

**Smoke tests (DEV):**
- [ ] Aba Atividades sem nenhuma tarefa: chrome inicial ≤ 200px
- [ ] Botão "Nova tarefa" abre modal centralizado
- [ ] Modal cria tarefa, fecha, lista atualiza
- [ ] Esc fecha modal
- [ ] Atalho `N` abre modal (só na aba Atividades)
- [ ] Funciona idêntico em projeto e subprojeto

**Risco:** Baixo. Reorganização visual, sem mudar endpoints nem dados.

**Definition of done:** lista mostra > 5 tarefas em viewport 1366×768 sem scroll (era 2-3 antes).

---

### PR 2 — Drawer da tarefa (~6-8h)

**Objetivo:** Click numa tarefa abre drawer lateral. Drawer reusa funções existentes de `renderAtividade` por ora — só muda o container. Não mexe na estrutura interna (cronômetro inline, notas, comentários continuam exatamente como hoje, só dentro do drawer em vez de inline na lista).

**Arquivos:**

| Arquivo | Mudança |
|---------|---------|
| `gestao-ti/frontend/src/components/TarefaDrawer.tsx` *(NOVO)* | Componente drawer responsivo (push/overlay/full-screen). Recebe `tarefaId`, `open`, `onClose`. Renderiza `renderAtividade` da `TabCronograma` por composição. |
| `gestao-ti/frontend/src/hooks/useTarefaDrawer.ts` *(NOVO)* | Hook controla estado (`openTarefaId`, `open`, `close`). |
| `gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx` (linha ~1276, `renderAtividade`) | Tarefa **colapsada** vira default. Click na linha abre drawer (em vez de expandir inline). Conteúdo expandido **migra** pro drawer mas mantém o mesmo JSX. |
| `gestao-ti/frontend/src/index.css` ou `tailwind.config.ts` | CSS vars de breakpoint pra drawer (`--drawer-width: 420px`). Media queries 1440 e 768. |
| `gestao-ti/frontend/src/components/Drawer.tsx` *(NOVO, base reutilizável)* | Drawer genérico responsivo (push/overlay/full-screen). Reutilizado depois em outros lugares (AcompanhamentoItem etc.) |

**Comportamento esperado:**
- Click numa linha → drawer abre com dados dela
- Click em outra linha (drawer ainda aberto) → drawer atualiza com nova tarefa (não fecha)
- Tarefa selecionada ganha highlight verde lateral na lista
- Esc fecha drawer
- Backdrop click (modo overlay) fecha drawer

**Smoke tests (DEV):**
- [ ] Click numa tarefa abre drawer com dados corretos
- [ ] Click em outra tarefa (drawer aberto) troca dados sem fechar
- [ ] Esc fecha drawer
- [ ] Backdrop click fecha drawer (≥768px overlay)
- [ ] Em viewport 1440px: drawer push, lista visível ao lado
- [ ] Em viewport 1024px: drawer overlay
- [ ] Em viewport 375px: drawer full-screen
- [ ] Cronômetro funciona dentro do drawer (iniciar/parar)
- [ ] Adicionar comentário funciona dentro do drawer
- [ ] Editar tarefa funciona dentro do drawer

**Risco:** Médio. Mexe em foco/teclado e responsivo. Reuso do `renderAtividade` minimiza risco de regressão funcional.

**Definition of done:** Tarefa pode ser editada, cronometrada e comentada inteiramente pelo drawer, sem perder feature da versão anterior.

---

### PR 3 — Linha compacta + tabs internas (~10-12h)

**Objetivo:** Lista vira 1 linha por tarefa (sem expand inline em hipótese alguma). Drawer ganha tabs internas. Cronômetro, comentários, anexos passam pra abas dedicadas. Aplica padrão chat-style igual chamado/pendência na tab Conversa.

**Arquivos:**

| Arquivo | Mudança |
|---------|---------|
| `gestao-ti/frontend/src/components/TarefaDrawer.tsx` | Adiciona estrutura de tabs internas (Visão / Tempo / Conv / Anexos / Histórico) |
| `gestao-ti/frontend/src/components/tarefa-tabs/VisaoTab.tsx` *(NOVO)* | Descrição + grid de metadados (Responsável, Fase, Início, Fim, Cronômetro total, Conversa N) |
| `gestao-ti/frontend/src/components/tarefa-tabs/TempoTab.tsx` *(NOVO)* | Total no topo + tabela de registros + botão "Adicionar manual". Migra código de `RegistrosTempo` existente. |
| `gestao-ti/frontend/src/components/tarefa-tabs/ConversaTab.tsx` *(NOVO)* | Reusa `<ChatBubbleList />` + `<ComentarioTexto />` + `<MentionInput />`. Composer no rodapé (sticky). |
| `gestao-ti/frontend/src/components/tarefa-tabs/AnexosTab.tsx` *(NOVO)* | Lista de anexos + uploader. Empty state com CTA "+ Adicionar anexo". |
| `gestao-ti/frontend/src/components/tarefa-tabs/HistoricoTab.tsx` *(NOVO)* | Timeline cronológica (criou tarefa / iniciou cronômetro / encerrou / comentou / mudou status). Backend já tem `tarefa_historico` ou precisa criar? **VERIFICAR** antes de codificar — se não tem, vira mini-PR adicional. |
| `gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx` (linha ~1276) | `renderAtividade` simplifica drasticamente — vira só linha compacta com hover-actions. Conteúdo expandido vai todo pras tabs do drawer. |
| `gestao-ti/frontend/src/components/InlineAddTarefa.tsx` *(NOVO)* | Inline-add Linear-style. Botão "⊕ Nova tarefa" do PR 1 fica acima da lista de fases — clique abre o inline em vez do modal. Atalho `N` continua abrindo modal completo. Link "+ Detalhar com mais campos" troca inline pelo modal. |
| `gestao-ti/frontend/src/components/EmptyState.tsx` *(NOVO se não existir)* | Componente reutilizável (ícone + mensagem + CTA opcional). Usado em Tempo/Conv/Anexos vazios. |

**Backend novo (se HistoricoTab exigir):**
- Verificar se `gestao_ti.atividade_historico` existe. Se não:
  - Migration nova: `add_atividade_historico` com colunas (id, atividadeId, tipo, descricao, usuarioId, createdAt)
  - Service em `atividade.service.ts` registra eventos nos pontos chave (create, status change, cronometro start/stop, comentário)
  - Endpoint `GET /atividades/:id/historico`

**Endpoints novos (se ainda não existem):**
- `GET /atividades/:id` retorna detalhes ricos pro drawer (com `_count` de tempo/conversas)
- `GET /atividades/:id/historico` *(condicional)*

**Estado da tarefa selecionada:**
- Salva em URL (`?tarefa=<uuid>`) → permite linkar direto pra uma tarefa
- Ao fechar drawer, limpa query param

**Smoke tests (DEV):**
- [ ] Lista densa: 12+ tarefas visíveis em viewport 1366px sem scroll
- [ ] Click numa tarefa abre drawer com tab "Visão geral" ativa
- [ ] Trocar de tab carrega conteúdo data-driven
- [ ] Tab Conversa: composer com Enter quebra linha, Shift+Enter envia
- [ ] Tab Conversa: chat-style espelha layout do chamado/pendência
- [ ] Tab Tempo: registros listados corretamente, botão "Adicionar manual" funciona
- [ ] Tab Anexos: upload funciona, lista atualiza
- [ ] Tab Histórico: eventos em ordem cronológica
- [ ] Inline-add no topo: Enter cria, Esc cancela, "+ Detalhar" troca pra modal
- [ ] URL contém `?tarefa=<uuid>` quando drawer aberto; F5 reabre o drawer na mesma tarefa
- [ ] Mobile (<768px): drawer full-screen, modal bottom-sheet, sem horizontal scroll
- [ ] Performance: scrollar lista de 50+ tarefas sem lag

**Risco:** Médio-alto. Toca em vários componentes existentes (ChatBubbleList, comentários, anexos). Importante: rodar `tsc --noEmit` antes de cada commit.

**Definition of done:** Lista densa entrega 5× a densidade anterior (12-15 tarefas vs 2-3). Drawer com tabs cobre 100% das ações que hoje estão inline. Padrão visual consistente com chat-style de chamado/pendência.

---

## 4. Fora do escopo (vai pra fase posterior)

| Item | Por quê adiar |
|------|---------------|
| **View Kanban** (toggle Lista/Kanban/Timeline) | Esforço alto (~16h), requer drag-and-drop + libs. Faz mais sentido depois que List + Drawer estiver soak em produção. |
| **Drag-and-drop entre fases** | Casa melhor com Kanban (drag entre colunas). Sem isso agora, usuário muda fase via dropdown `<select>` na linha (já existe). |
| **Filtros avançados** (status, responsável, busca) | Versão V3 do mockup tem botões visuais. Implementação real pode ficar pra PR 4 se sobrar tempo, ou adiar pra próxima janela. |
| **Virtualização da lista** (`react-virtual`) | Só vira problema com > 200 tarefas num projeto. Sem evidência hoje. Adicionar quando aparecer. |
| **Dark mode** | Item próprio no backlog (~20-25h, todos os 5 frontends). |
| **Replicar padrão em `AcompanhamentoItemPage`** | Mesma estrutura visual hoje (linha + registros de tempo inline). Aplicar mesmo padrão depois de validar em Projetos. |

---

## 5. Pré-requisitos antes de codificar

| # | Pré-requisito | Bloqueia? |
|---|---------------|-----------|
| 1 | **Validar mockup V3 com Diego/Marco/Juliana** (usuários-chave) | Sim — UX coletiva pode revelar pedidos não-óbvios |
| 2 | Decidir se dark mode vem **antes** ou **depois** dessa repaginação | Não bloqueia, mas evita retrabalho |
| 3 | Verificar se backend tem `atividade_historico` (PR 3 depende) | Bloqueia PR 3 (mas não PR 1/2) |
| 4 | Janela dedicada de ~22-25h (3 sessões longas ou 1 semana spread) | Sim — não é trabalho pra encaixar entre fixes |

---

## 6. Estratégia de release (segue padrão Capul de 05/05)

1. **DEV local** — desenvolver os 3 PRs sequencialmente, mergear em `main` local após cada
2. **HOM** — Douglas aplica via roteiro deploy (cada PR pode ir junto ou separado)
3. **Soak HOM** ≥ 30 min com usuários reais (Diego/Marco) navegando
4. **PROD** — só depois de validação HOM, com feature flag se viável (`PROJETOS_ATIVIDADES_V2_ENABLED`)

> **Feature flag opcional**: Se quiser fallback pra layout antigo enquanto valida em PROD, envelopar a tela nova em flag. Custa ~1h de implementação. Sugiro **não fazer** — mudança é puramente visual/UX, sem mudança de dados. Rollback de código (`git reset`) é suficiente se algo der errado.

---

## 7. Métricas de sucesso (medir 1 semana pós-deploy PROD)

| Métrica | Antes | Meta |
|---------|-------|------|
| Tarefas visíveis sem scroll (1366×768) | 2-3 | 12-15 |
| Pixels de chrome antes da 1ª tarefa | ~450 | ≤ 250 |
| Cliques pra ver cronômetro de 1 tarefa | 1 | 2 |
| Cliques pra trocar entre 2 tarefas | 2 (collapse + expand) | 1 (click outra linha, drawer atualiza) |
| Feedback usuário "tela poluída" em chamado interno | 1+ por mês | 0 por mês (3 meses consecutivos) |

---

## 8. Anexos

- **Mockup V3 standalone**: `docs/mockups/atividades-projeto-v3.html` (abre direto no browser)
- **Prints originais do problema**: `c:\temp\1.jpg`, `c:\temp\2.jpg`, `c:\temp\3.jpg`, `c:\temp\subprojeto.jpg`
- **Backlog item dark mode**: `docs/MELHORIAS_BACKLOG.md` (entrada `⏳ 2026-05-15 — Dark mode unificado`)
- **Backlog item Atividades**: `docs/MELHORIAS_BACKLOG.md` (entrada `⏳ 2026-05-15 — Repaginar "Atividades"`)

---

## 9. Histórico do plano

- **15/05/2026** — Plano criado após sessão de design com 3 iterações de mockup (V1, V2 do outro Claude, V3 consolidada). Decisões de responsividade + ícones + dark mode tomadas em conjunto com Clenio.
- **16/05/2026** — Implementação completa em `feat/projetos-atividades-v2` (4 commits: PR1 `05f84b0`, PR2 `8e4ff8e`, PR3a backend `5690dfb`, PR3 frontend `ca22a3e`). Pré-requisito #3 resolvido: `gestao_ti.atividade_historico` criado (migration `20260515120000_add_atividade_historico` + service + endpoint). Desvios conscientes do plano: (a) aba **Anexos** = empty state honesto — `AtividadeProjeto` não tem anexos no backend (fora de escopo, igual ao mockup); (b) **TempoTab** sem botão "Adicionar manual" — evita feature pela metade (ajuste inline mantido); (c) Conversa reusa **MentionInput** mas tem chat-list próprio (não `ChatBubbleList`, que é acoplado a tipos de Chamado — reuso forçado seria paliativo). Branch **não** foi pushada (decisão do Clenio).

---

**Próxima ação:** pré-requisito #1 ainda aberto — validar com Diego/Marco/Juliana (em DEV na branch). Depois seguir §6: push → HOM via roteiro Douglas (a migration entra pelo init job `gestao-ti-migrate`) → soak ≥30min → PROD.
