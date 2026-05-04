# Melhorias & Ajustes — Backlog

Itens anotados durante o desenvolvimento que não mereciam desvio de foco
no momento em que surgiram, mas valem revisita periódica. Adiar sem
esquecer — e sem poluir a conversa principal.

## Como usar

- **Adicionar entrada** com data (ISO), módulo, contexto e por que foi adiada.
- **Status**: ⏳ pendente · 🔎 em análise · ✅ feito · ❌ descartado
- **Revisar ao iniciar cada sessão** — o Claude Code abre este arquivo e
  sugere itens maduros para puxar se fizerem sentido com o tópico do dia.
- **Ao implementar**, marcar ✅ com a data e mover para o bloco "Histórico"
  no final, preservando o contexto.
- **Descartar** é OK — se a ideia não faz mais sentido, marca ❌ e explica
  o motivo. Não some, fica documentado.

---

## Fiscal — Qualidade de dados

### ⏳ 2026-04-21 — Corrigir worker do cruzamento para gravar `vinculos_protheus` completos

**Contexto:** O campo `fiscal.cadastro_contribuinte.vinculos_protheus` (JSON)
chega inconsistente — às vezes com TODOS os campos
(`loja`, `codigo`, `filial`, `origem`, `origemDescricao`, `bloqueado`,
`razaoSocial`, `inscricaoEstadual`), às vezes só com 4
(`loja`, `codigo`, `filial`, `origem`) faltando os demais.

**Exemplo real (21/04):** CNPJs como `44700997672` (ARNALDO JOSE PEREIRA),
`04154414000126` (ROSELY), `21175203000431` (EMBRAURB) vieram com vínculo
incompleto. Outros CNPJs (ex: CLENIO `82652970682`) vieram completos.

**Impacto:** a coluna "Razão social no Protheus" e "IE no Protheus" na UI
de Divergências ficou vazia para esses registros, mesmo o dado existindo
em `divergencia.valorProtheus` quando há divergência do campo.

**Paliativo aplicado hoje (UI-side):** `DivergenciasListPage` faz merge
best-effort — se o vínculo não tem `razaoSocial`, pega de
`divergencia.valorProtheus` (campo=razao_social); idem para IE.
O backlog do worker continua — outras telas que leem `vinculosProtheus`
diretamente (sem ter as divergências à mão) ainda verão os dados parciais.

**Onde consertar:** `fiscal/backend/src/cruzamento/cruzamento.worker.ts`
(provável) — ao persistir o contribuinte, garantir que `vinculosProtheus`
armazene todos os campos vindos do `cadastroFiscal` do Protheus, não
apenas os 4 identificadores.

**Re-executar** uma corrida de cruzamento após o fix repopula os dados
corretamente (o worker sobrescreve o JSON). Não requer migration.

---

## Integração Protheus

### ⏳ 2026-04-21 — Pedir parâmetro `comMovimentoAte` à equipe Protheus (API `cadastroFiscal`)

**Contexto:** A funcionalidade "Disparar manual com período" (`/execucoes`,
modal `ModalManualPeriodo`) permite ao usuário escolher `dataInicio` +
`dataFim`. Do lado do backend, ambas são gravadas em
`fiscal.cadastro_sincronizacao` (`janela_inicio`, `janela_fim`) para
documentação, mas **a consulta ao Protheus usa apenas `comMovimentoDesde`**
— a API atual não oferece filtro por data final.

**Impacto prático:** usuário escolhe "20/04 → 20/04" (1 dia), mas a API
traz TODOS os CNPJs com movimento desde 20/04 até agora. Para janelas
curtas (1-3 dias), o ruído é pequeno; para janelas longas, aumenta
proporcionalmente. Consumo extra de cota SEFAZ.

**O que pedir à equipe Protheus:**
- Adicionar parâmetro `comMovimentoAte=YYYYMMDD` no endpoint
  `GET /rest/api/INFOCLIENTES/FISCAL/cadastroFiscal`
- Semântica: retornar apenas CNPJs com movimento **dentro da janela
  fechada [comMovimentoDesde, comMovimentoAte]**
- Manter retrocompatibilidade: se `comMovimentoAte` omitido, comportamento
  atual ("desde X até agora")

**Por que adiado:** Dependência externa (equipe Protheus). Enquanto isso,
o sistema funciona com a limitação documentada no modal.

**Quando retomar:**
1. Formalizar o pedido via `PENDENCIAS_PROTHEUS_18ABR2026.md` (ou novo arquivo)
2. Quando Protheus publicar, atualizar:
   - `protheus-cadastro.service.ts` (aceitar `comMovimentoAte` no `listar()`)
   - `execucao.service.ts:carregarBase` (passar o `janela.fim` ao chamar)
   - `ModalManualPeriodo` em `ExecucoesListPage.tsx` (remover aviso âmbar)

**Arquivos já prontos para a expansão:**
- Schema `fiscal.cadastro_sincronizacao.janela_fim` já existe
- `ExecucaoService.iniciar(tipo, user, janela?)` já recebe `janela.fim`

---

## Processo & Deploy

### ⏳ 2026-04-21 — Revisar `PlatformCapul_Roteiro_Completo.md` (master) com novo rigor

**Contexto:** Deploy de 19/04/2026 custou a Douglas o dia inteiro ajustando
6 arquivos que o roteiro não cobriu direito (`fiscal-schema-init.sql`,
`seed-fiscal-modulo.sql`, `schema.prisma`, `destinatarios.resolver.ts`,
`seed.ts`, `prisma.service.ts`). Resultou em 3 commits de `fix:` pós-deploy.

Já documentado:
- Checklist obrigatório em `memory/reference_roteiro_deploy.md` (seção F)
- Regra de bootstrap em `memory/feedback_deploy_cenarios_iniciais.md`

**Por que adiado:** A correção na memória/processo atende as próximas
gerações de roteiros. O master (`PlatformCapul_Roteiro_Completo.md`) ainda
precisa de uma passada manual para absorver esses aprendizados de forma
**retroativa** — alguns módulos podem ter descrições superficiais herdadas
de versões anteriores.

**Quando retomar:** Antes do próximo deploy grande, fazer uma varredura
seção a seção no master aplicando o checklist F:
- Todo `.sql` tem passo próprio?
- Cada módulo tem bootstrap + incremental listados separadamente?
- PASSO 0.5 de diagnóstico existe para cenário de instalação do zero?
- Descrições de arquivos citam impacto ("o que quebra se não aplicar")?

**Arquivos:** `/mnt/c/Arquivos-de-projeto/PlatformCapul_Roteiro_Completo.md`
(e referências cruzadas em `docs/ROTEIRO_MIGRACAO_PRODUCAO.md` se houver
divergência entre os dois).

**Nota sobre o padrão:** `feedback_roteiro_deploy_completo.md` registra
incidente similar em 08/04/2026 — é padrão recorrente. Se esta revisão
não resolver, considerar automatizar parte do checklist (script que lê
`git diff` e valida coverage do roteiro).

---

## Gestão TI — UX

### ⏳ 2026-04-25 — Bubbles estilo WhatsApp na interação de equipes (Chamado e Projeto)

**Status (29/04/2026):** ✅ aplicado em **Chamado** (`ChatBubbleList` em `gestao-ti/frontend/src/components/`). Pendente em **Projeto** porque o shape de `ComentarioTarefa` é diferente (`texto`/`visivelPendencia`, sem `tipo`, operação de remover) — adaptar o componente exigiria abstração extra que não vale agora. Fica como item separado do backlog para sessão dedicada.

**Contexto original:** Hoje as áreas de "interação entre equipes" em **Chamado** e
**Projeto** mostram comentários/mensagens em uma lista vertical homogênea —
sem distinção visual clara entre quem escreveu o quê. Em conversas longas
fica difícil seguir o fluxo.

**Proposta:** Layout estilo WhatsApp com 2 colunas lógicas:
- **Mensagens "minhas"** (autor = usuário logado): alinhadas à **direita**, fundo cor suave A (ex.: verde-claro / azul-claro)
- **Mensagens "dos outros"** (qualquer outro autor): alinhadas à **esquerda**, fundo cor suave B (ex.: cinza-claro / lilás-claro)
- Avatar/nome do autor visível só do lado correspondente
- Timestamp pequeno abaixo da bubble
- Como temos mais espaço que mobile, podemos enriquecer com:
  - Anexos inline (preview de imagem, link de PDF) dentro da bubble
  - Reações emoji rápidas (👍 ✅ 👀)
  - Citação/quote da mensagem anterior

**Onde aplica:**
- `gestao-ti/frontend/src/pages/chamados/ChamadoDetalhePage.tsx` — aba/seção de comentários ou histórico
- `gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx` — aba de comunicação/comentários
- Provavelmente componente comum reutilizável (ex.: `ChatBubbleList.tsx` em `components/`)

**Adiada porque:** mudança puramente visual; sistema funcional do jeito atual.
Vai bem com uma sessão dedicada a polish UX (junto com outros ajustes
visuais que aparecerem). Estimativa: ~3-4h (componente + 2 telas).

**Por quê vale fazer:** comunicação fluida em chamados longos é onde a
ferramenta vira "experiência de uso" vs "formulário corporativo". Diferença
de adoção real pelos técnicos e usuários-chave.

---

## Histórico (feitos)

### ✅ 2026-04-21 — Drop da coluna global `integracoes_api.ambiente`

Migration `20260421180000_drop_ambiente_integracao_global/migration.sql`
aplicada. Removido do schema Prisma, do `CreateIntegracaoDto`, do seed e da
interface `IntegracaoApi` do Configurador. Response de `getEndpointsAtivos`
continua retornando `ambiente` derivado (PRODUCAO / HOMOLOGACAO / MIXED)
apenas para log.

### ✅ 2026-04-21 — Header do Configurador derivar ambiente dos endpoints

Adotada a opção 2 do plano. `Header.tsx` agora deriva de todos os endpoints
ativos do PROTHEUS: badge mostra **API-PRD** (vermelho), **API-HLG** (âmbar)
ou **API-MIX** (roxo) conforme uniformidade. Algoritmo equivalente ao
`ambienteDoModulo` usado na página de integrações, porém sem filtro por módulo.

### ✅ 2026-04-21 — Divergências agrupadas por contribuinte + export Excel

Fragmentação real da tela `/divergencias`: 110 linhas na UI eram apenas
**49 contribuintes** (mesmo CNPJ com 3-4 campos divergentes aparecia 3-4
vezes, espalhado pela criticidade). Analista perdia contexto — cliente
corrigido parcialmente no ERP porque ele só via a primeira divergência.

**Backend** (`divergencia.controller.ts`):
- Novo `GET /divergencias/por-contribuinte` — agrupa por contribuinte,
  retorna `[{contribuinte, divergencias:[...], total, criticidadeMax,
  detectadaEmMaisAntiga}]`. Ordem: criticidadeMax DESC, detectada ASC.
- Filtro `?campo=X` filtra quais contribuintes aparecem (têm ≥ 1
  divergência nesse campo), mas retorna TODAS as divergências deles —
  contexto completo para ajuste no ERP. Decisão operacional, não técnica.
- Novos endpoints em lote:
  `PATCH /divergencias/por-contribuinte/:id/resolver-todas` e
  `.../ignorar-todas`. Afeta só divergências `status=ABERTA` (preserva
  trilha de RESOLVIDAs/IGNORADAs existentes).
- Visão plana (`GET /divergencias`) preservada para relatório analítico.

**Frontend** (`DivergenciasListPage.tsx` + `utils/export.ts`):
- Tabela reestruturada: 1 linha = 1 contribuinte, expansível para ver
  detalhes por campo. Badges coloridos dos campos divergentes na linha
  principal (vermelho=ALTA, amarelo=MEDIA, cinza=BAIXA).
- Ações em lote: "Resolver todas" / "Ignorar todas" direto na linha.
- Ações individuais ainda disponíveis ao expandir (caso precise tratar
  só um campo específico).
- Novo filtro `campo` dropdown + stats agregados no topo.
- **Botão "Exportar Excel"**: gera `.xlsx` com 1 linha por divergência,
  mas agrupadas por CNPJ — útil pro Setor Fiscal encaminhar para o setor
  que vai corrigir no ERP. 15 colunas (CNPJ, UF, Razão, Fantasia, IE,
  Município, Situação, Campo, valores Protheus/SEFAZ, Criticidade,
  Status, detectadaEm, resolvidaEm, Nº divergências do CNPJ).
- `xlsx` adicionado como dependência (mesma versão do Inventário, para
  consistência de padrão entre módulos).

Testado: endpoint agrupado retornou 110 divergências em 49 contribuintes
ordenados por ALTA primeiro. Filtro por campo funciona corretamente.

### ✅ 2026-04-21 — Proteção contra execuções concorrentes + cooldown + UI "Nova execução"

Fechou buraco real de operação descoberto ao observar a tela `/execucoes`:
os 4 botões de disparo não tinham lock no backend, então clique duplo criava
N execuções paralelas consultando os MESMOS CNPJs no SEFAZ N vezes (dedup
era per-execução, não entre execuções). A UI só travava durante o POST axios.

**Backend** (`execucao.service.ts`):
- Novo guard `guardConcorrenciaECooldown()` em `iniciar()` — rejeita 409:
  - Se já existe EM_EXECUCAO do mesmo tipo (`EXECUCAO_JA_EM_CURSO`)
  - Se última CONCLUIDA foi há < cooldown (`EXECUCAO_EM_COOLDOWN`)
- Cooldowns: `MOVIMENTO_*=6h` (cron natural roda 2x/dia), `MANUAL=15min`,
  `PONTUAL=0` (isento — consultas por chave)
- Novo método `statusExecucaoPorTipo()` + endpoint
  `GET /cruzamento/status-execucao-tipos` com estado consolidado
  (emCurso, ultimaConcluida, disponivelEm, bloqueadoPor) para a UI

**Frontend** (`ExecucoesListPage.tsx`):
- 4 botões soltos → **1 único "Nova execução"** que abre `ModalNovaExecucao`
- Modal mostra 3 opções com badge dinâmico por estado: disponível / em curso
  (spinner) / em cooldown (Clock + hora disponível) / freio ativo. Botão
  desabilitado quando não pode disparar — UI antecipa o 409 do backend.
- **Banner de status** acima da tabela (3 cards: meio-dia, manhã seguinte,
  ambiente SEFAZ) com refresh automático a cada 30s
- Removido botão "Disparar manual (24h)" — redundante com "Manual (período)"
  cujo default é 24h

Testado end-to-end: 2ª tentativa retorna 409 com mensagem precisa
("Aguarde até DD/MM/AAAA, HH:MM (cooldown de Xmin)"), status endpoint marca
`bloqueadoPor: COOLDOWN`, banner reflete corretamente.

### ✅ 2026-04-21 — Consolidar seção "Operação" do Fiscal em 2 hubs com abas

Executada a Opção B (consolidação parcial, não centralizar em tela única).
Sidebar reduziu de **5 para 2 entries** na seção OPERACAO:
- **Controle Operacional** (`/operacao/controle`) — 4 abas: Ambiente, Agendamentos, Freio de Mão, Limites SEFAZ
- **Diagnóstico** (`/operacao/diagnostico`) — 2 abas: Circuit Breaker, Cadeia TLS

Roteamento via **React Router sub-routes** (opção robusta escolhida no lugar
de state local + query param), permitindo deep-link direto para aba
(`/operacao/controle/freio`). Rotas antigas (`/operacao/ambiente`, etc.)
preservadas via `<Navigate replace>` — bookmarks não quebram.

Freio de Mão foi extraído da antiga página Ambiente para **aba dedicada**,
com contexto didático ("o que o freio pausa" vs "o que continua funcionando").

Cada aba autocontida com seu próprio `useEffect` + fetch — só carrega
quando ativada.

Arquivos: 6 `*Tab.tsx` + 2 `Operacao*Page.tsx` (hubs) em `pages/operacao/`,
+ App.tsx reescrito, + Sidebar simplificada, + 3 Links do Dashboard ajustados.
5 páginas antigas removidas. Role-filtering mantido por tab.

---

## Meta

- **Criado em:** 2026-04-20
- **Dono:** Clenio (decide prioridade) + Claude (proativo em sugerir)
- **Revisão recomendada:** no início de cada sessão, ou antes de grandes
  mudanças no módulo correspondente.
