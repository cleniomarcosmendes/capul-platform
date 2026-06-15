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

## ⭐ Logística Fase 2 (Frota/Portaria) — pendências da spec (ATACAR 15/06)

Itens abertos do `Especificacao_Fase2_Frota_Portaria_Capul.docx` após a entrega do
núcleo em 14/06 (viagens, despesas+foto, monitor, manutenção KM, KM hodômetro). O
núcleo opera ponta a ponta; estes são refinamentos + 1 bloqueio externo. **Combinado
com o Clenio: atacar na sessão de 15/06.**

### ⏳ 2026-06-15 — Exceção da portaria: apontar saída por NOME (sem senha) [BLOQUEADO]
- **Spec:** doc "Frota e Portaria" — a portaria precisa tratar exceções (condutor sem
  senha, portal fora). Decidido (14/06): **só na web**, usuário autorizado busca o
  condutor por nome no Protheus e aponta a saída **sem senha**, sob a responsabilidade
  dele (auditável). Ver `[[project_logistica_frota_app_portaria]]`.
- **Bloqueio:** depende da **API Protheus de busca de funcionário por nome** — Clenio
  solicita à equipe Protheus em 15/06. Só dá pra codar quando a API existir (possível
  reuso do `buscarColaborador`/`infoPortal` por NOME do Chamado — confirmar).

### ⏳ 2026-06-15 — Notificação ATIVA ao supervisor de despesa pendente
- **Spec §5.3:** "o supervisor do veículo é notificado para validar". Hoje é **passivo**
  (contador `despesasPendentes` no Monitor). Falta notificação ativa (push/e-mail/sino).
- Avaliar reuso do mecanismo de notificações da plataforma; escopo por supervisor do veículo.

### ⏳ 2026-06-15 — Aviso de discrepância de KM ao fechar a viagem
- **Spec §5.4:** ao concluir, "avisa (mas não bloqueia) se KM total ≫ soma dos trechos das
  paradas, paradas sem KM próprio etc.". Hoje fecha sem checagem. Adicionar aviso não-bloqueante.

### ⏳ 2026-06-15 — Regras de exceção do fluxo de validação de despesa
- **Spec §7:** auto-notificação se o supervisor não validar em X dias; escalonamento ao gestor
  de frota. Depende da notificação ativa (item acima) existir primeiro.

### ⏳ 2026-06-15 — Manutenção preventiva por TEMPO e por TIPO de veículo
- **Spec §7:** hoje o alerta é só por **KM** (`359d3bf`). Estender p/ por **data/intervalo de
  tempo** (ex.: revisão a cada 6 meses) e variar regra por **tipo de veículo**.

### ⏳ 2026-06-15 — Relatórios/exportações da frota (planilha mensal por veículo)
- **Spec §7:** fechamento interno — planilha mensal de custos/KM por veículo (Excel/CSV).
  Os indicadores já existem na tela; falta o export.

### ⏳ 2026-06-15 — GPS sugere local/KM ao registrar parada (app)
- **Spec §5.2:** ao adicionar parada na viagem, o app sugere local pelo GPS e KM pela distância.
  Hoje a parada é manual. Refinamento do app (só valida em device).

### 🔎 Política de retenção/LGPD das fotos de comprovante de despesa
- **Spec §7:** definir retenção das fotos de cupom. Conversado 14/06 (binário no MinIO, fora do
  banco; ver `[[project_logistica_frota_app_portaria]]`). Falta formalizar a política/prazo
  (diferente da retenção 5a do cofre de entrega — despesa é menos crítica).

### 🔎 Mapa em tempo real no Monitor (adiado desde a Fase 1)
- **Spec §5.7:** "mapa com todos os veículos em viagem ativa". Hoje é a lista "Na rua agora".
  Rastreamento GPS contínuo está **adiado desde a Fase 1** (decisão: deep-link + OSRM, tracking
  depois). Reavaliar quando o OSRM/tracking entrar.

---

## Fiscal — Importação RFB (robustez contra share degradado)

### ⏳ 2026-06-15 — Retry da importação deve usar conexão NOVA por tentativa
**Contexto:** incidente 15/06 — o share WebDAV da RFB ficou degradado (arquivo
truncado num dia, trickle/socket pendurado no outro). Foram aplicados 2 fixes
(commits `a927ded` dedup do índice único; `af1cc3f` watchdog de progresso que
**mata o socket** após 5min sem avançar). O watchdog **passou a disparar**
corretamente (confirmado em log), MAS o `carregarComRetry` reusa a **mesma
conexão `client`** do COPY — e matar a stream no meio deixa essa conexão em
estado de COPY quebrado, então a tentativa seguinte não recupera limpa (COPY
zumbi). **Fix:** cada tentativa em `carregarComRetry` deve abrir/fechar sua
PRÓPRIA conexão `pg.Client` (ou resetar a conexão após um COPY abortado).

### 🔎 2026-06-15 — Download-para-disco antes do COPY (desacoplar da rede)
**Contexto:** hoje é stream direto WebDAV→unzip→csv→COPY; qualquer soluço de rede
no meio trava/aborta um COPY de dezenas de milhões de linhas. **Proposta:** baixar
o .zip pro disco primeiro (com retry/resume por Range, que o `abrirStream` já
suporta), validar o tamanho vs PROPFIND, e só então unzip→COPY a partir do
arquivo local. Mais resiliente à flutuação do share público.

### 📋 Playbook operacional — quando a importação RFB falhar
- **Causa mais comum NÃO é o código:** o share público da Receita varia (lento/
  truncado em horário de pico). **Re-rodar fora de pico** costuma resolver.
- Estado é seguro: o swap é por-tabela e atômico — uma tabela que falha **não
  derruba** as já importadas (dados do mês anterior ficam intactos; `simples`
  pode estar no mês novo e o resto no anterior — base segue operacional).
- Re-disparar só as que faltam: `POST /api/v1/fiscal/rfb/importar {"tabelas":[...]}`.
- Se travar (`IMPORTANDO` eterno): `docker compose restart fiscal-backend` +
  `UPDATE rfb.controle_importacao SET status='ERRO' WHERE status='IMPORTANDO'`.

---

## Fiscal — Qualidade de dados

### ⏳ 2026-05-16 — "Perfil específico de cliente" (segmentações salvas sobre a base RFB)

**Contexto:** Refino do "achado" da base pública CNPJ (RFB dados abertos —
ver `docs/PLANO_MODULO_CNPJ_RFB_v1.md` e memória
`project-fiscal-cnpj-base-publica`). O núcleo (cruzamento SA1+SA2 × base
RFB local + Inteligência Cadastral exploratória) será desenvolvido
primeiro. Este item é a camada **acima**: segmentações **nomeadas e
reutilizáveis** ("perfil de cliente/fornecedor").

**Proposta:** salvar filtros compostos como perfil (ex.: "fornecedores
ativos optantes Simples no CNAE X na minha região"; "clientes que viraram
INAPTO desde o último snapshot"). Detecção de **mudança mês-a-mês** entre
snapshots da RFB reusando o `fiscal.CadastroHistorico` já existente —
alertar quando um perfil monitorado muda entre importações.

**Adiada porque:** decisão Clenio 16/05 — tratar depois do núcleo. Depende
da base RFB local + da tela de Inteligência Cadastral existirem primeiro
(Fases 1-3 do plano). Não bloqueia o "achado" (cruzamento).

**Por quê vale:** transforma o cadastro baixado em inteligência
comercial/compliance recorrente (não consulta pontual) — é a "abertura de
oportunidade" que o Clenio citou.


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

### ⏳ 2026-05-30 — RolesGuard no auth-gateway + restringir leitura de usuários a staff

**Contexto:** O fix `a56fa77` (security-review 30/05) fechou os WRITES do
`UsuarioController` com `ConfiguradorAdminGuard`, mas `GET /usuarios`
(`findAll`) e `GET /usuarios/:id` (`findOne`) seguem acessíveis a **qualquer
usuário autenticado** — vazam a lista de usuários + e-mails (info disclosure
de baixa severidade). Mantidos abertos porque alimentam dropdowns em
hub/gestao-ti/fiscal/inventario.

**Proposta:** introduzir um `RolesGuard` parametrizado no auth-gateway (hoje
só existe o `ConfiguradorAdminGuard` pontual — ver comentário no próprio
guard sugerindo isso) e restringir as leituras a perfis staff, OU expor um
endpoint enxuto `/usuarios/lookup` (id+nome only) pros dropdowns e fechar o
`findAll` completo a admin. Avaliar impacto nos dropdowns antes.

**Adiada porque:** severidade baixa (info disclosure interno, exige login); o
vetor crítico — account takeover/escalonamento via writes — já foi fechado.

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

### ⏳ 2026-05-29 — Chamados: filtro inline de workspace na lista (opt-in)

**Contexto:** Hoje o filtro por workspace funciona via **`WorkspaceSwitcher`
global** no header (S15.1 / 25/05): user escolhe o workspace ativo, Axios
manda header `X-Workspace-Id` em todas as requests, backend filtra. Cobre
"Padrão" (auto pra single-perfil), "Específico" (escolha no Switcher) e
"Todos" (sem header). Backend já aceita `?departamentoId=` também
(`chamado.controller.ts:79`).

**Proposta (sugerida por Clenio 29/05):** Adicionar dropdown **inline** na
tela de Chamados (junto com filtros status/prioridade/equipe) pra **override
LOCAL** do workspace, sem mexer no Switcher global. Útil quando user
multi-perfil quer "dar uma olhada" em chamados de outro workspace sem mudar
o contexto global da sessão.

Opções no dropdown:
- "Padrão (workspace ativo)" — segue o Switcher do header (default)
- "Todos os workspaces" — força sem filtro mesmo com Switcher setado
- Lista de workspaces onde o user é STAFF/CHAVE — escolha pontual

**Adiada porque:** Switcher global pode bastar na prática. Aguardar feedback
de uso real dos multi-perfis (Juliana, Tatiane, outros) após deploy v7. Se
em algumas semanas eles reclamarem de ficar trocando o workspace toda hora,
implementar. Caso contrário, vira código morto duplicando funcionalidade.

**Escopo se for implementar:**
- Frontend: state local no `ChamadosListPage` (não persistir) + override do
  `?departamentoId=` no fetch. Coexistir com o `X-Workspace-Id` do header
  (override local prevalece).
- Backend: nenhuma mudança (`?departamentoId=` já existe).
- UX: indicador visual quando override local difere do workspace global.

**Como puxar:** memory `[[feedback_backlog_ler_ao_iniciar]]` garante revisão
periódica. Se aparecer pedido similar de USUARIO_FINAL/outros, virar
prioridade.

### ⏳ 2026-05-05 — CT-e Distribuição: validar comportamento com dados reais SEFAZ

**Contexto:** Módulo CT-e Distribuição entregou 10 commits hoje (Fases 1-4 +
extras + 4 pendências menores). Tudo testado tecnicamente, mas com:
- 1 CT-e mock inserido manualmente pra exercitar PapelDetector
- Smoke test contra HOM SEFAZ que tem 402 NSUs vazios
- **Nunca testou com CT-e real chegando da SEFAZ via distNSU**

**O que pode aparecer só em uso real:**
- XMLs com estruturas de schema fora do esperado (parser fail-safe registra
  `erro_parse` automaticamente — não trava sistema, mas vale auditar)
- Casos edge do PapelDetector (toma4 com valores inesperados, AUTXML
  como array, CT-e sem `<infCte>`, schema custom de transportadora, etc)
- Performance com volume real (10k+ NSUs no histórico de uma filial grande)
- Comportamento real do Protheus PROD com XMLs SEFAZ válidos vs mock fictício
  (smoke test deu HTTP 500 no mock — esperado, mas não validamos sucesso)

**Plano:** após Douglas aplicar deploy HOM:
1. Setor fiscal valida com `cte_distribuicao_ativo=true` por 2-3 dias
2. Acompanhar coluna `erro_parse` em `cte_documento` (queries simples
   no PgAdmin) — qualquer XML que falhou parse fica registrado com motivo
3. Acompanhar aba "CT-e Histórico" pra ver `iteracoes`, `docsPersistidos`,
   `motivoStop` por execução do scheduler
4. Acompanhar `papel_capul=NULL` em docs já enriquecidos (sinal de XML
   com Capul presente mas em campo não esperado)
5. Quando confiar do fluxo, ativar `cte_protheus_grava_ativo` em HOM
6. Soak Protheus 1 dia → ativar em PROD

**Onde investigar se aparecer bug:**
- Parsers em `fiscal/backend/src/cte/distribuicao/cte-documento.service.ts`
  (`extrairMetadadosDocumento`, `extrairMetadadosEvento`)
- PapelDetector em `papel-detector.service.ts` — pode precisar cobrir
  novos campos da NT 2014/2015

**Por quê está aqui:** validação técnica completa. Próximo gate é uso real.
Item não codável até dados reais aparecerem.

### ✅ 2026-05-07 — Otimizar `chown -R /app` nos Dockerfiles Node (deploy ~1h → ~40min)

**Contexto:** Douglas/Marco reportaram em 05/05/2026 que o build Docker do
deploy está demorando ~1h. Em análise visual (screenshot do `docker compose
build`), o gargalo é o layer:

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
```

Tempos observados na imagem do Douglas:
- `auth-migrate stage-1`: **173.5s** (~3min)
- `fiscal-backend runtime`: **169.1s** (~3min)
- `gestao-ti-migrate stage-1`: **117.9s** (~2min)

São 6 builds (3 backends Node + 3 init-migrate que usam mesma imagem) =
~12-15min só nesse layer.

**Causa raiz:** `chown -R /app` percorre o `node_modules` recursivamente
(~80-150k arquivos por backend NestJS). Cada arquivo = 1 syscall `chown()`.
No filesystem overlay2 do Docker, cada chown vira copy-on-write (duplica
inode no layer), inflando tempo + tamanho da imagem.

**Solução (padrão idiomático Docker):**

```dockerfile
# 1. Cria user/group ANTES do COPY
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# 2. COPY com --chown — owner já fica correto na cópia
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

USER appuser
```

**Ganho estimado:** 170s/imagem → 10-20s/imagem. Total: **12-15min →
1-2min** no deploy. Imagens também ficam menores (sem layer de chown
duplicado).

**Riscos:** primeiro deploy invalida cache (rebuild completo, ~1h),
depois melhora pra sempre. Comportamento idêntico (appuser dono dos
arquivos). Reversível.

**Onde alterado:**
- `auth-gateway/Dockerfile`
- `gestao-ti/backend/Dockerfile`
- `fiscal/backend/Dockerfile`

**Pré-requisito:** validar com Douglas em janela de manutenção
(primeiro build completo é lento). Diagnóstico técnico completo
em `C:\Arquivos-de-projeto\PlatformCapul_20260505_Diagnostico_BuildLento.md`.

**Esforço:** ~20min de implementação + 1 deploy lento de transição.
**Impacto:** todo deploy futuro ~10-13min mais rápido.

**Resultado real (07/05/2026, build do zero local sem cache):**

| Backend | Antes | Depois | Ganho |
|---|---|---|---|
| auth-gateway | ~3-4min (chown layer 173s) | 47.9s | ~80% |
| gestao-ti-backend | ~3min (chown 118s + COPY node_modules 37s) | 54.7s | ~70% |
| fiscal-backend | ~3-4min (chown 169s) | 49.1s | ~75% |
| **Total dos 3** | **~10-12min** | **~2.5min** | **~75%** |

COPY `--chown=appuser:appgroup` ficou em 2-3s em todos (vs 30-40s da
COPY sem chown + 170s do chown -R no final).

Init jobs `*-migrate` reusam a mesma imagem dos backends → herdam o
ganho automaticamente.

Estimativa pro Douglas no deploy: **~1h → ~30-40min** (npm ci + prisma
generate + build TypeScript continuam, mas o gargalo principal foi
eliminado).

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

### ⏳ 2026-05-16 — Divisor arrastável no drawer de tarefa (largura ajustável + persistência)

**Contexto:** Em 16/05 a largura do drawer de tarefa virou
`clamp(460px, 40vw, 640px)` (var CSS `--tarefa-drawer-w` em `index.css`,
consumida por `Drawer.tsx` e pelo `.tarefa-push`). Resolve a Conversa
espremida com risco/esforço mínimos. O "ideal de produto" — o usuário
arrastar a borda e o sistema lembrar — ficou DE FORA de propósito.

**Proposta:** handle na borda esquerda do painel; `pointerdown/move/up`
ajusta `--tarefa-drawer-w` (respeitando min/max do clamp); persistir a
preferência em `localStorage` e reidratar no mount. O `.tarefa-push` já
consome a var, então o push acompanha sozinho.

**Adiada porque:** exige handle + lógica de pointer events + estado +
persistência — é outra tarefa, não um ajuste de CSS. Não bundlar com o
clamp (já entregue). Estimativa: ~3-4h. Reavaliar se, no uso real, as
pessoas ainda quiserem ajustar manualmente após o clamp.

### ⏳ 2026-05-15 — Repaginar "Atividades" do Projeto/Subprojeto (List + Drawer)

**Contexto:** Aba "Atividades" em `ProjetoDetalhePage` (e idêntica no
subprojeto) está poluída visualmente. Diagnóstico em 6 pontos:
1. Form "Nova Tarefa" persistente ocupa ~250px sempre visíveis no topo
2. Expand de tarefa empurra layout (in-place) — uma tarefa expandida =
   ~800px de scroll, empurra as outras pra fora do viewport
3. Cronômetro vem em tabela completa de 7+ linhas dentro do card
4. "Notas" + "Comentários" são duas seções quase paralelas (confunde
   onde escrever)
5. Múltiplos controles repetidos por linha: 6 botões × 10 tarefas = 60
6. Cabeçalho projeto + tabs + form Nova Tarefa = ~450px de chrome antes
   da 1ª tarefa útil

**Decisão de design (V3 do mockup, 15/05 — `c:\temp\mockup-atividades-projeto-v3.html`):**
- **Lista densa + Drawer lateral data-driven** (padrão ClickUp/Linear/Notion)
- Drawer com tabs internas: *Visão / Cronômetro (N) / Conversa (N) / Anexos / Histórico*
- "Nova Tarefa" sai do topo → vira **inline-add** (Linear-style) + atalho `N` abre modal completo
- **Responsivo robusto**: push em ≥1440px, overlay em 768–1439px, full-screen em <768px (modal vira bottom-sheet em mobile)
- **Composer chat-style** na tab Conversa, reusa `ChatBubbleList` + `ComentarioTexto` + `MentionInput` (já existentes)
- **Cor primária**: verde Capul (`emerald-700` = `#047857`)
- **Ícones**: `lucide-react` (já instalado — não trocar pra Tabler como no mockup)
- **Drag-and-drop**: NÃO entra agora — fica pra view Kanban (Fase 4)
- **Dark mode**: NÃO entra agora — item separado neste backlog

**Plano técnico de implementação (3 PRs sequenciais):**
- **PR 1 — Quick wins (~2-3h):** mover form "Nova Tarefa" pra modal/inline-add.
  Já ganha -250px de chrome. Mexe só em `TabCronograma` (linha ~921 de
  `ProjetoDetalhePage.tsx`). Sem mudar estrutura.
- **PR 2 — Drawer da tarefa (~6-8h):** click numa tarefa abre drawer overlay/push
  (responsivo). Drawer **reusa** funções de `renderAtividade` por ora — só
  muda o container. Componente novo `<TarefaDrawer />` reutilizável.
- **PR 3 — Linha compacta + tabs internas (~10-12h):** lista vira 1 linha
  por tarefa (sem expand inline). Drawer ganha tabs Visão/Tempo/Conv/Anexos/Histórico.
  Tab Conversa reaproveita `ChatBubbleList`. Empty states implementados.

**Esforço total estimado:** ~20-25h. Sem virtualização (vem se passar de 200 tarefas).

**Onde mexe:**
- `gestao-ti/frontend/src/pages/projetos/ProjetoDetalhePage.tsx` (componente
  `TabCronograma` linha ~921, `renderAtividade` linha ~1276)
- Componente novo: `gestao-ti/frontend/src/components/TarefaDrawer.tsx`
- Componente novo: `gestao-ti/frontend/src/components/InlineAddTarefa.tsx`
- Reuso: `ChatBubbleList`, `ComentarioTexto`, `MentionInput`

**Pré-requisito antes de codificar:** validar mockup V3 com Diego/Marco/Juliana
(usuários-chave dessa tela) — UX coletiva pode revelar pedidos não-óbvios.

**Mesmo padrão deve ser aplicado depois em:** Acompanhamento de Item
(`AcompanhamentoItemPage`) — tem layout semelhante de "Registros de Tempo"
em tabela inline que vai ganhar o mesmo problema com volume.

**Por que adiado:** decisão de arquitetura tomada (V3 aprovada 15/05), mas
implementação real ~20-25h precisa de janela dedicada + soak HOM antes
de ir pra PROD (estratégia padrão 05/05).

### ⏳ 2026-05-15 — Dark mode unificado nos 5 frontends (Auth/Hub/Configurador/Gestão TI/Inventário/Fiscal)

**Contexto:** Mockup V3 de Atividades (15/05) testou dark mode via
`@media (prefers-color-scheme: dark)` e ficou bom — mas o Capul **não tem
infra de dark mode** em nenhum dos 5 frontends React. Tailwind sem
`darkMode: 'class'`, sem CSS vars como source of truth, sem toggle no
header, sem persistência de preferência.

**Status atual por frontend:**
- `auth-gateway` (login): light only — cores hard-coded no Tailwind
- `hub`: light only — cards com bg-white fixo
- `configurador`: light only
- `gestao-ti/frontend`: light only — `--primary-dark` definido em `index.css`
  mas só usado como variante de hover do verde, não como tema dark
- `inventario/frontend`: light only
- `fiscal/frontend`: light only

**Solução robusta (definitiva, não paliativa):**

1. **Tailwind config** em cada frontend:
   ```js
   // tailwind.config.* — todos os 6 frontends
   module.exports = {
     darkMode: 'class',  // não 'media' — usuário escolhe explícito
     // ...
   }
   ```
2. **CSS vars como source of truth** num arquivo compartilhado (criar
   `shared/styles/theme.css` ou copiar em cada frontend):
   ```css
   :root { --bg-page: #f8fafc; --text-primary: #0f172a; ... }
   .dark { --bg-page: #0f172a; --text-primary: #f1f5f9; ... }
   ```
3. **Toggle no Header** (sun/moon icon, lucide-react `Sun`/`Moon`) — toda
   tela tem header, então o toggle vira universal.
4. **Persistência via `localStorage`**:
   ```ts
   // hook compartilhado useTheme()
   const [theme, setTheme] = useState(() =>
     localStorage.getItem('capul-theme') || 'system'
   );
   useEffect(() => {
     const resolved = theme === 'system'
       ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
       : theme;
     document.documentElement.classList.toggle('dark', resolved === 'dark');
     localStorage.setItem('capul-theme', theme);
   }, [theme]);
   ```
5. **3 opções no toggle**: Light / Dark / System (segue OS) — padrão GitHub/Vercel.
6. **Sincronizar entre tabs/janelas** via `storage` event.
7. **Documentar** paleta semântica num `STYLEGUIDE.md` na raiz pra novas
   features sempre referenciarem `var(--bg-page)` em vez de `bg-white`.

**Esforço estimado por frontend:**
- Auth (login simples): ~1h
- Hub (cards): ~1.5h
- Configurador: ~2h
- Gestão TI: ~4-5h (mais telas, paleta mais rica)
- Inventário: ~2-3h
- Fiscal: ~3h
- Compartilhado (theme.css + useTheme hook + Toggle): ~2h
- Testes + ajustes de contraste WCAG AA: ~3h
- **Total: ~20-25h** numa sessão dedicada.

**Por que solução completa em vez de só gestao-ti:** se ligar dark só num
módulo, usuário navega Hub→GestãoTI e tem "flash" de paleta. Inconsistência
visual quebra a confiança da plataforma como produto integrado. Memory
[Hub — CONFIGURADOR sempre por último] e padrão de modais elegantes (sweep
nos 4 frontends) já estabeleceram esse princípio.

**Riscos:**
- Cores corporativas mantidas (verde Capul `#047857`) — só varia cinzas/bg
- Componentes de terceiros (chart libs, react-pdf-viewer) podem não respeitar
  CSS vars — testar e listar exceções
- Status pills (chip-status-done etc.) precisam variantes dark calibradas
  pra contraste AA

**Por que adiado:** Sessão 15/05 estava focada em "tela poluída de Atividades",
não em tema geral. Dark mode entrou na conversa como bônus do mockup V3.
Cliente (Clenio) optou explicitamente por solução robusta em vez de paliativo
local — então precisa janela própria com escopo nos 6 frontends.

**Pré-requisito:** decidir se vale fazer ANTES ou DEPOIS da reformulação
de Atividades. Se DEPOIS, Atividades vai sair em light-only e ganha dark
no mesmo PR do dark mode unificado. Se ANTES, Atividades já nasce
dark-aware.

**Recomendação:** ANTES — fazer dark mode unificado como item próprio
(20-25h), depois Atividades já nasce com suporte nativo (sem retrabalho).

---

### ✅ 2026-05-22 — Busca profunda em Chamados e Projetos (full-text com `pg_trgm`) — CONCLUÍDO (PR1+PR2+PR3)

**Origem:** pedido do Clenio — buscar um termo (ex.: `MV_DATAFIN`, um
parâmetro Protheus) e retornar todos os chamados/projetos que o mencionam
em **qualquer** campo, inclusive comentários. Hoje as buscas são rasas.

**Estado atual:**
- Chamado (`chamado-core.service.ts:208`): busca cobre número, título,
  descrição, solicitante — **não varre comentários/histórico**.
- Projeto (`projeto-core.service.ts:65`): cobre nome, descrição — **não
  varre atividades, comentários de tarefa, pendências**.

**Tecnologia:** `pg_trgm` (extensão nativa do Postgres) + índices GIN
trigram. Casa código técnico exato (`MV_DATAFIN`) **e** linguagem natural,
tolera erro de digitação, escala. **Não** usar Full-Text Search nativo
(tsvector) — o stemming/tokenização quebra termos técnicos com underscore
e maiúsculas. **Não** usar engine externa (Elastic/Meili) — overkill pro
volume da CAPUL.

**Plano — 3 PRs, ~20-23h:**
- **PR1 — Fundação ✅ FEITO 22/05 (commit `16aad20`):** migration
  `20260522110000_add_pg_trgm_search_indexes` — `CREATE EXTENSION pg_trgm`
  + 10 índices GIN trigram (`chamados` titulo/descricao, `historicos_chamado`
  descricao, `projetos` nome/descricao, `atividades_projeto` titulo/descricao,
  `comentarios_tarefa` texto, `pendencias_projeto` titulo/descricao). Additive,
  idempotente, aplicada e verificada em DEV. Já acelera as buscas `contains`
  atuais. **Não entra no deploy 20/05 (v8) — feature própria, deploy à parte.**
- **PR2 — Busca profunda Chamado ✅ FEITO 22/05:** backend (`chamado-core.
  service.ts`) soma ao `OR` do `filters.search` um `historicos.some`
  (campo `descricao`) com visibilidade D29 por role; enriquecimento
  pós-query `anexarMatchHistorico` anexa `buscaMatch {tipo, trecho}`.
  Frontend (`ChamadosListPage`) mostra badge "achado em comentário/
  histórico" + snippet com termo destacado. Verificado em DEV via smoke
  test de API.
- **PR3 — Busca profunda Projeto ✅ FEITO 22/05:** backend (`projeto-core.
  service.ts`) soma ao `OR` da busca EXISTS em `atividades_projeto`,
  `comentarios_tarefa` (campo `texto`, visibilidade D29 via `publica`) e
  `pendencias_projeto`; enriquecimento `anexarMatchProjeto` (3 queries)
  anexa `buscaMatch {campo, trecho}`. Frontend (`ProjetosListPage`) com
  badge "achado em atividade/comentário/pendência" + snippet. Verificado em
  DEV: os 3 caminhos (atividade/comentário/pendência) achados via smoke test.
- **PR4 — Busca global ✅ FEITO 22/05:** ajuste pós-feedback (busca por
  `CPFINE61` não retornava — projeto não era "meu"). Quando há termo
  digitado, a busca ignora os filtros "Meus Projetos"/"Meus Chamados" e
  varre tudo (como o objetivo do item pede: "achar TODOS"). Restrições de
  segurança (USUARIO_FINAL / USUARIO_CHAVE / TERCEIRIZADO) seguem aplicadas.
  Frontend desabilita o toggle com aviso "(busca abrange todos)".

**Transversal (nos 3 PRs):**
- **Visibilidade (D29) — inegociável:** a busca varre comentários, então o
  `WHERE` precisa filtrar `historicos_chamado.publico` /
  `comentarios_tarefa.publica` por role — non-staff (não-`isTI`) só casa
  conteúdo público. Sem isso, a busca vira vazamento de nota interna.
- **Ranking:** `ORDER BY` ponderado — match no título/nome da entidade
  pesa mais que match em campo-filho.
- **Compat multi-depto:** a busca soma com o `WHERE` existente — quando
  Chamado/Projeto ganharem `departamento_id` (projeto Workspace), já
  compõe naturalmente.

**Fora deste plano (evolução):** busca **global** — caixa única no topo,
chamados + projetos (e futuros módulos) num resultado só. Reusa 100% da
infra dos PR1-3; trabalho extra é só a página de resultados unificada.
~12-18h. Decidir após validar a busca por módulo.

**Sem migration destrutiva, sem serviço novo, sem dependência nova**
(pg_trgm é nativo do PostgreSQL).

---

## Histórico (feitos)

### ✅ 2026-05-30 — 🔴 Fix segurança: ConfiguradorAdminGuard nos endpoints privilegiados de usuário

Achado do `/security-review` do delta pré-PROD (escopo 163 commits). O
`auth-gateway` `UsuarioController` tinha só `@UseGuards(JwtAuthGuard)` na
classe — os endpoints de capabilities (LGPD) tinham `ConfiguradorAdminGuard`
por método, mas os de **gestão de usuário não**, e o service não valida o
caller. Qualquer usuário autenticado (até `USUARIO_FINAL`/`TERCEIRIZADO`)
podia, via `/api/v1/core/` (proxiado pelo nginx): **resetar a senha do admin
(account takeover)**, **autoconceder role ADMIN** (`/permissoes`), e CRUD de
usuários alheios. **Pré-existente — vivo em PROD (`65fd7d4`) hoje.**

Fix (`a56fa77`): `ConfiguradorAdminGuard` nos 7 writes (create, update,
updateStatus, reset-senha, permissoes POST/DELETE, `:id/preferencias` PATCH).
`findAll`/`findOne`/`me/preferencias` mantidos abertos (dropdowns +
self-service). Smoke: admin passa (200/404), leitura intacta. Validado que
todos os writes a `/usuarios` vêm só do `configurador` (admin). Por decisão
do Clenio, entra no deploy do Workspace (atualizar roteiro v6_marco).

Follow-up registrado: restringir `findAll`/`findOne` de usuários a staff
(info disclosure baixa) — exige um RolesGuard no auth-gateway (não existe;
hoje só há `ConfiguradorAdminGuard` pontual).

### ✅ 2026-05-30 — Worker do cruzamento grava `vinculosProtheus` com razão social + IE

Fix do item 21/04. O worker agendado (`cruzamento.worker.ts`) gravava o
vínculo Protheus com só 4 campos (`origem/filial/codigo/loja`) em 3 pontos
— as colunas "Razão social no Protheus" e "IE no Protheus" ficavam vazias
pros CNPJs sincronizados pelo cron 2×/dia. O dado já chegava no
`jobData.protheusSnapshot` (usado logo abaixo pra detectar divergências),
só não era copiado pro JSON.

- Novo helper `vinculoDoJob(jobData)` monta o vínculo enriquecido com
  `razaoSocial` + `inscricaoEstadual` + `cnae` do snapshot + `origemDescricao`
  (Cliente/Fornecedor derivado de SA1010/SA2010). Usado nos 3 pontos
  (create, update, contribuinte-não-encontrado). Sem migration.
- `bloqueado`/`nomeFantasia` não vêm no `protheusSnapshot` → ficam ausentes
  (não fabricados), igual ao comportamento anterior. Quem quiser esses
  campos completos ainda tem o caminho on-demand (`cadastro.service`).
- Repopulação dos registros antigos vem na próxima corrida de cruzamento
  (o worker sobrescreve o JSON) — **não disparada manualmente** (regra
  SEFAZ: nada de cron/loop não supervisionado).

Observação (fora do escopo deste item, não mexido): o worker sobrescreve
`vinculosProtheus` com um único vínculo por job; um CNPJ que seja cliente
E fornecedor não acumula os 2 vínculos pelo cruzamento (o on-demand
acumula). Avaliar se virar item próprio.

### ✅ 2026-05-30 — Validação client-side da chave NF-e/CT-e (antes de tocar o SEFAZ)

Puxado do backlog (item 29/05) porque acabamos de mexer nas telas de
consulta. Uma chave digitada errada agora é barrada **no navegador**, sem
queimar cota SEFAZ (limite 2000/dia, risco de bloqueio do CNPJ da CAPUL).

- `src/utils/chave.ts` (novo): função pura `validarChaveAcesso(chave, { modeloEsperado })`
  com 5 checagens — **44 dígitos · UF (IBGE) · modelo (55/57) · CNPJ/CPF do
  emitente · DV módulo-11**. Aceita CPF zero-preenchido (produtor rural PF)
  pra não bloquear emitente legítimo. Princípio: na dúvida, deixa passar.
- `ErrorCard.tsx`: modo `validacaoLocal` — rodapé honesto ("validado no
  navegador, sem chamada SEFAZ") + mensagem específica do motivo, sem fingir
  `cStat=236`.
- `NfeConsultaPage`/`CteConsultaPage`: validam no submit antes do backend.
- Lógica testada contra as chaves reais (NF-e 55, CT-e 57) + casos de erro
  (DV trocado, UF 99, modelo errado na tela, tamanho) — zero falso-negativo.
  Validado pelo user (NF-e com número errado → card sem consultar).

Extra além do backlog original: incluída a checagem de **modelo** (55/57) —
pega "chave de CT-e na tela de NF-e". Testes unitários formais ficaram de
fora (frontend fiscal não tem test runner; adicionar vitest é item à parte).

### ✅ 2026-05-29 — Navegação cruzada NF-e ↔ CT-e: mesma aba + ‹ Voltar preserva contexto

Follow-up do `fca2493` (que persistia a chave na URL). O teste do user
revelou que a *volta* não preservava o contexto: o link abria em nova aba
(back desativado) e o filtro da lista de Recebidos se perdia. Fechado em
3 commits:

- **NF-e → CT-e Vinculado mesma aba** (`cccc01f`): troca a âncora
  `target="_blank"` por `<Link>` client-side. ‹ Voltar retorna pra
  `/fiscal/nfe?chave=…` e a auto-consulta recarrega a NF-e. Corrige
  também o `<Link to="/fiscal/cte">` que com `basename="/fiscal"` virava
  `/fiscal/fiscal/cte` → caía no Dashboard; passa a usar `/cte`.
- **Filtros da lista de Recebidos preservados ao voltar** (`f2adf59`):
  snapshot dos 14 filtros em `sessionStorage`, restaurado SÓ quando a
  navegação é `POP` (back/forward) via `useNavigationType`. Navegação
  nova (PUSH — menu lateral) começa limpa; deep-link `?chave` tem
  precedência. Sem isso o ‹ Voltar trazia 462 resultados em vez do 1
  filtrado.
- **CT-e → NF-e (aba Documentos) mesma aba** (`575c606`): uniformiza a
  volta com a ida — `<Link to="/nfe?chave=…">` client-side. O ícone ↗
  "abrir em nova aba" (ExternalLink) permanece de propósito.

Padrão de UX consolidado: navegação cruzada = **mesma aba** + ‹ Voltar
restaura a tela de origem; ícone ↗ separado abre em nova aba quando o
operador quer comparar lado a lado. Validado pelo user nas duas direções.

**Pega-ratão documentado:** memória `feedback_react_router_link_basename_fiscal`
— no Fiscal `<Link to>` não leva `/fiscal` (basename prefixa), mas
`<a href>` leva o path literal.

**Ainda em aberto (não-bloqueante):** o ‹ Voltar do CT-e consulta-por-chave
pra lista de Recebidos volta sempre pra `page=1` (efeito de reset de
página dispara na remontagem). Filtros preservam; só a paginação reseta.

### ✅ 2026-05-05 — Módulo CT-e Distribuição completo (Fases 1+2+3+4 + extras)

10 commits no dia entregando o módulo end-to-end:

- **Fase 1** (`3dc5d9d`): cliente `consultarPorNsu` (modo distNSU), tabela
  `cte_controle_nsu`, services `NsuControle` + `DistribuicaoNsu`, endpoint
  admin manual, 5 camadas de proteção.
- **Fase 2** (`fdc73ae`): tabelas `cte_documento`/`cte_evento`/`cte_lote_consulta`
  + 4 enums, persistência com dedup SHA-256, scheduler `@Cron('0 */15 * * * *')`
  com **adaptive backoff** (60min synced / 15min com trabalho — aprendizado
  de cStat 656 nos testes).
- **Fase 3 backend** (`7ff69b4`): `PapelDetectorService` (TOMA/DEST/REM/etc),
  roteamento de eventos pra `cte_evento`, parsers `resCTe`/`resEventoCTe`,
  `CteEnriquecimentoService` + cron `@30min`, endpoint admin enriquecer.
- **Fase 3 frontend** (`c069a9c`): `CteRecebidosPage` (lista paginada + 6
  filtros + modal detalhe). `/cte` virou listagem; busca por chave virou
  rota secundária `/cte/consulta-por-chave`.
- **Sincronização auto filiais** (`08d84af`): `SincronizacaoFiliaisService`
  no tick do scheduler — filial nova vira plug-and-play em ≤15min.
- **Controle Operacional UI** (`c4be2b8` + `990fd12`): aba
  `/operacao/controle/cte-distribuicao` com toggle ATIVO/INATIVO + radio
  PROD/HOM **independente do global**. Substituiu env var
  `FISCAL_CTE_DISTRIBUICAO_ENABLED` (movida pra DB com auditoria).
- **Gravação Protheus** (`9012db1`): Fase 4 simplificada — reusa
  `ProtheusGravacaoHelper` da Onda 1 ao invés de drop UNC. Flag separada
  `cte_protheus_grava_ativo` + Fase 2 no enriquecimento + auditoria por
  doc (protheus_status/erro). Card 3 na aba operacional + coluna na lista.
- **Pendências menores fechadas** (`4d6102c`): limite retry Protheus
  (MAX 5 + reset admin), reconciliação retroativa `cte_evento.documento_id`,
  bloco "Status Protheus" no modal, aba "CT-e Histórico" listando
  `cte_lote_consulta` paginado.

**Memórias de referência:** `project_cte_fase1_concluida_05mai`,
`project_cte_fase2_concluida_05mai`, `project_cte_fase3_completa_05mai`,
`project_cte_sincronizacao_filiais_05mai`, `project_cte_controle_operacional_05mai`,
`project_cte_protheus_grava_05mai`, `project_cte_pendencias_fechadas_05mai`.

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

---

## [Logística FE] Harmonização de acabamento com Fiscal/Workspace

**Origem:** análise comparativa dos 3 frontends em 12/06/2026 (a pedido do
Clenio, que percebeu o FE da logística "um pouco a desejar" vs. Fiscal/Workspace).

**Veredito:** stack (React 19 / Vite 7 / Tailwind v4 / TS / axios / router 7 /
lucide) e arquitetura **idênticas**; páginas até mais enxutas (maior = 818
linhas vs. 1.500–3.758 dos maduros). Tabelas inline são o padrão dos TRÊS
módulos — não é deficiência. O gap real eram abstrações de acabamento.

**Feito (12/06):** ✅ Toast centralizado portado do Gestão-TI (commit `7ee8696`).

**Adiado por decisão (Clenio escolheu "só o Toast"):**
1. **Componentes de formulário compartilhados** — Gestão-TI tem `SearchSelect`,
   `EmptyState`, `Paginator`, `DepartamentoField`. Logística repete lógica de
   sort/`STATUS_META` entre páginas. Extrair p/ `components/`.
2. **`types.ts` central** — interfaces (`Status`, `Viagem`, `SortKey`)
   redefinidas por página; consolidar em `src/types.ts`.
3. **Refresh token no client web** — Fiscal/Gestão-TI fazem refresh silencioso
   com fila; o `api.ts` web da logística só faz 401→Hub. (O **app mobile** já
   tem refresh sofisticado.) Avaliar se vale, dado que o Hub centraliza login.

**Esforço estimado:** algumas sessões de refactor. Não bloqueia a Fase 1b/deploy.

---

## ✅ 2026-06-14 — [Logística] KM rodados — captura de hodômetro (FEITO)

**Entregue (commit `aa2e12e`):** despachar captura `kmInicial` (valida ≥ kmAtual);
concluir captura `kmFinal` (valida ≥ kmInicial) e atualiza `veiculo.kmAtual`.
Indicadores ganharam o bloco **Quilometragem**: KM no mês, KM/entrega, ranking
por veículo e por motorista (filtra `tipo=ENTREGA` — frota tem Monitor próprio).
UI: KM via prompt no despachar/concluir (opcional). E2E ok, Jest 50/50.
Auto-conclusão pelo app não tem hodômetro → viagem entra sem km (não conta).

---

## [Logística] KM rodados — captura de hodômetro (adiado 12/06)

**Contexto:** ao criar os Indicadores do mês (valor/origem, motorista, demanda,
re-entregas), o KM rodados por motorista/veículo ficou de fora — os campos
`viagem.kmInicial`/`kmFinal` existem no schema mas **nada os preenche hoje**.

**Decisão (Clenio, 12/06):** adiar. Demais indicadores entregues. **→ RETOMADO E
CONCLUÍDO em 14/06 (ver bloco ✅ acima).**

**Quando retomar — solução recomendada (robusta):** capturar hodômetro no fluxo
da viagem: KM na **saída** (despachar → kmInicial) e na **chegada** (concluir →
kmFinal). Benefícios: KM real por motorista/veículo + mantém `veiculo.kmAtual`
atualizado de quebra. Custo: 2 inputs no despachar/concluir + 2 indicadores no
Painel (KM por motorista, KM por veículo, e KM/entrega como eficiência de rota).
