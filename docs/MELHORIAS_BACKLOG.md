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

## Qualidade / Tooling — ESLint dos frontends

### ✅ 2026-06-28 — Alinhar TODOS os frontends à config ESLint calibrada [FEITO]
- **Concluído no mesmo dia:** os 6 frontends ficaram **0 erros / 0 warnings** — logística
  `ea96e08`, hub `48115c5`, configurador `41a2009`, inventario `85fff02`, fiscal `0cb0447`
  (criou config), gestao-ti `92a74d6` (o maior: 144 problemas→0). Build de cada um verde.
  Ver `memory/project_eslint_calibrado_plataforma.md`. _(Contexto original abaixo.)_

### 🔎 2026-06-28 — [original] Alinhar TODOS os frontends à config ESLint calibrada (logística é a referência)
- **Contexto:** a logística era o único frontend sem ESLint (script `lint` sem pacote/config).
  Ao configurar, descobri que os demais frontends (gestao-ti, fiscal, inventario, hub,
  configurador) **falham as regras novas do `eslint-plugin-react-hooks` v7 às dezenas** —
  são as regras da era **React Compiler** (`static-components`, `set-state-in-effect`,
  `immutability`, `purity`, `preserve-manual-memoization`, `refs`). O **gestao-ti viola 144x**.
  A plataforma **não adotou o React Compiler** → essas regras são falsos-positivos sobre
  padrões usados de propósito.
- **Decisão:** config CALIBRADA (em `logistica/frontend/eslint.config.js`) — regras clássicas
  de hooks (`rules-of-hooks`=erro, `exhaustive-deps`=warn) + `no-unused-vars` com
  `ignoreRestSiblings`/`^_`. **Logística está 0 erros / 0 warnings** (commit `ea96e08`).
- **Tarefa:** rolar a mesma config para os outros 5 frontends e zerar cada um (fixes reais:
  split de não-componentes p/ Fast Refresh, deps estáveis, `no-explicit-any` tipado/justificado).
  **Em andamento (28/06).** Atualizar status conforme cada módulo for fechado.

## Logística — RBAC e nomenclatura (levantado 26/07)

Três itens que sairam de um caso real: a RENATA BORGES precisava aprovar o acerto
das despesas do setor **e** acompanhar o resultado das entregas. O acesso ao
painel foi resolvido no dia (`c21f09f`); estes três ficaram.

### ⏳ 2026-07-26 — Papel `SUPERVISOR_FROTA` embute DUAS responsabilidades

- **Sintoma:** ao receber o papel para aprovar acerto de frota, a pessoa passa a
  ver também **Prestação de Contas (RDV)** no menu — processo com o qual pode
  não ter relação. Na Renata a tela abre **vazia** (0 RDVs, 0 representantes no
  departamento dela).
- **Não é bug:** por desenho, `SUPERVISOR_FROTA` = "Supervisor de Departamento" =
  administrador do RDV (com `COORDENADOR` aprovando o time e `SUPERVISOR`
  planejando). O menu faz o que foi projetado. O problema é o papel **acumular**
  "aprova acerto de despesa de frota" + "administra RDV".
- **Ponto que não é cosmético:** com o papel, ela *pode cadastrar representantes*
  no departamento dela (aba Equipe aceita `SUPERVISOR_FROTA`). Não destrói nada,
  mas é porta provavelmente não intencional.
- **Opções:** (a) deixar como está — impacto é menu com tela vazia; (b) esconder
  o RDV quando o usuário não tem escopo (nenhum representante no depto) — resolve
  o sintoma mas torna o menu dependente de dado, padrão novo no código;
  (c) separar o papel em dois — correto conceitualmente, mais caro.
- **Adiado porque:** 26/07 fechou com 3 defeitos de RBAC corrigidos; mexer em
  papel no fim do dia, com deploy pendente, é onde se erra.

### ⏳ 2026-07-26 — Dois "supervisor de departamento" com o mesmo nome

- **Colisão:** o papel `SUPERVISOR_FROTA` aparece na UI como **"Supervisor de
  Departamento"**, e o cadastro do **veículo** tem um campo **"supervisor"** —
  nomes parecidos, eixos diferentes.
- **Por que confunde (caso real):** a Renata É supervisora do veículo SUP01, e
  isso **não** lhe dava direito de aprovar o acerto — aprovar segue o
  *departamento do condutor* e exige o papel. Supervisionar o veículo dá direito
  a **contestar**, não a aprovar (`despesa.service.ts:243` e a mensagem em `:626`).
- **NÃO renomear o papel para "Supervisor de Frota":** colidiria com
  `GESTOR_FROTA` ("Gestor de Frota"), que é justamente quem **não** aprova —
  dois nomes quase iguais para poderes opostos.
- **Sugestão:** manter o papel como "Supervisor de Departamento" (descreve o que
  ele faz) e renomear o **campo do veículo** para **"Responsável pelo veículo"**.
  Só rótulo — sem tocar em enum, API ou banco, igual ao que já se fez em
  "Viagem→Rota" e "Gestão TI→Workspace".

### ⏳ 2026-07-26 — Multi-perfil na logística (2 papéis no mesmo módulo)

- **Necessidade:** pessoas como a Renata acumulam funções (aprovar acerto +
  gestão de entregas). Hoje é 1 papel por pessoa no módulo.
- **A estrutura JÁ suporta:** o unique é
  `(usuario_id, modulo_id, departamento_id)` — dois papéis no mesmo módulo em
  departamentos diferentes. E já existe na prática no Workspace
  (`danielaelvira | WORKSPACE | SUPORTE + USUARIO_FINAL`). O JWT traz
  `modulos[].departamentos[]` **com role própria**.
- **O que impede:** a logística lê a role **denormalizada** —
  `user.modulos.find(m => m.codigo === 'LOGISTICA')?.role`, que o
  `build-modulos-payload.ts` documenta como "role do PRIMEIRO depto, mantida por
  retrocompatibilidade". Cadastrar dois papéis hoje **não** daria os dois
  acessos: daria um dos dois, dependendo da ordem no banco, **em silêncio**.
- **Escopo real:** migrar para iterar `departamentos[]` nos ~15 pontos com
  `roleLogistica` + `RolesGuard` + listas de papéis do app (`HomeScreen.tsx`) e
  dos menus. É a "Sub-fase 1.6" que o próprio código antecipa, aplicada à
  logística. Transversal e de RBAC → planejar, não improvisar.
- **Paliativo em uso:** 1 papel por pessoa, escolhendo o mais abrangente, e
  liberando telas pontuais por `@Roles` quando fizer sentido (foi o que
  `c21f09f` fez com o painel).

---

## ⭐ Logística Fase 2 (Frota/Portaria) — pendências da spec (ATACAR 15/06)

Itens abertos do `Especificacao_Fase2_Frota_Portaria_Capul.docx` após a entrega do
núcleo em 14/06 (viagens, despesas+foto, monitor, manutenção KM, KM hodômetro). O
núcleo opera ponta a ponta; estes são refinamentos + 1 bloqueio externo. **Combinado
com o Clenio: atacar na sessão de 15/06.**

### ✅ 2026-06-15 — Exceção da portaria: apontar saída por NOME (sem senha) [FEITO]
- **Entregue** (commit `110dd13`): modo "pela portaria" na saída da frota (web, só
  gestores). Reusa a operacao `infoFuncionario` (=.../infoPortal, aceita `?NOME=`) →
  zero cadastro novo no Configurador. `Viagem.registradaPortaria` audita (accountability
  do criadoPorId). E2E ok com Protheus real. Ver `[[project_logistica_frota_app_portaria]]`.

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

### ⏳ 2026-06-18 — Mapa CONSOLIDADO das paradas/fazendas visitadas
- **Origem:** Clenio 18/06 — "realizamos várias visitas em fazenda e precisamos mapear nossos
  clientes/fazendas". Hoje (FEITO 18/06, commit `6accdcb`): toda parada — check-in da planejada
  E ad-hoc — captura GPS (`parada.latitude/longitude`); o detalhe da viagem (web) já tem link
  **"📍 mapa"** por parada (deep-link Google Maps, ponto-a-ponto).
- **Falta (este item):** uma **tela de mapa único** com TODOS os pontos das paradas plotados
  (pins), com filtro por período / veículo / cliente, pra enxergar a malha de
  fazendas/clientes visitados. Reusar OSRM/Leaflet já cogitado na Fase 1 (ver
  "Mapa em tempo real no Monitor"). Considerar agrupar paradas próximas e linkar com o
  cliente/endereço quando houver. Dado já existe (lat/long nas paradas) — é só a visualização.

### ✅ 2026-06-15 — Carimbo na FOTO da prova de entrega (coords+endereço+data/hora) [FEITO]
- **Origem:** Clenio mostrou comprovante do AliExpress/J&T (15/06) — foto com endereço +
  coordenadas + data/hora "queimados" na imagem. A foto crua não provava onde/quando.
- **Entregue** (commit `1a8157f`): carimbo no **servidor** ao dar baixa (`entrega.service.
  baixar()`, antes do `cofre.gravar`, só FOTO). `jimp` 0.22 (JS puro). Helper
  `watermark.ts` (`carimbarProvaEntrega` + `fmtGeo`). Rodapé: `#numero · destinatário ·
  endereço (campos denormalizados da entrega) · GPS · data/hora` (fuso SP). Imagem
  normalizada p/ 1080px. Best-effort (falha → grava original + log, não bloqueia).
- **Validado E2E**: baixa da entrega #56 → comprovante no cofre carimbado com dados reais.
- Decisão: servidor em vez de cliente (data/hora+coords autoritativas; independe do Expo
  Go; `react-native-view-shot` é nativa e pode não rodar lá).

### ✅ 2026-06-15 — App: tela-lançador FROTA / ENTREGA (usuário com os dois perfis) [FEITO]
- **Origem:** levantado pelo Clenio testando o app no celular (15/06) — duas equipes
  diferentes validam Frota e Entrega ao mesmo tempo, e o roteamento por role + logout
  travado impedia alternar.
- **Entregue** (commit `9be5341`): tela-lançador `Home` após o login com 2 cards (Entregas
  / Frota). Cada card é habilitado conforme a role na Logística, espelhando a RBAC do
  backend (`roles.guard`: ADMIN sempre) — `ROLES_ENTREGA` / `ROLES_FROTA` em
  `HomeScreen.tsx`. Volta ao lançador (botão voltar) troca de app sem deslogar. A Home
  como rota inicial autenticada também resolveu o "preso na Frota" de sessão em cache.
- Removido o fork por role em `navigation/index.tsx`. Para o testador ver os dois cards,
  basta role `ADMIN` na Logística (backend libera ambos).

### 🔎 Política de retenção/LGPD das fotos de comprovante de despesa
- **Spec §7:** definir retenção das fotos de cupom. Conversado 14/06 (binário no MinIO, fora do
  banco; ver `[[project_logistica_frota_app_portaria]]`). Falta formalizar a política/prazo
  (diferente da retenção 5a do cofre de entrega — despesa é menos crítica).

### 🔎 2026-06-16 — Cadastro CENTRALIZADO de Fornecedor (core + tag de módulo) — iniciativa de plataforma
- **Origem:** ao fazer a despesa de frota (7c), o Clenio sugeriu um cadastro ÚNICO de
  fornecedor com checkbox de em qual(is) módulo(s) é usado (um fornecedor pode servir TI +
  Logística; módulos futuros também). Ideia certa pro longo prazo.
- **Por que NÃO foi feito agora:** o fornecedor existente (`FornecedorConfig`) vive em
  `gestao_ti` e está **muito amarrado ao gestao-ti em produção** (Contrato, NotaFiscal,
  Licenças). Centralizar = mover/mesclar pro `core` (FKs cross-schema), criar tela no
  Configurador + write-path, e repontar TI/Logística/Fiscal → **projeto de plataforma**, não
  sub-passo da frota.
- **Estado atual (16/06):** a logística ganhou um cadastro PRÓPRIO pequeno (`FornecedorDespesa`,
  postos/borracharias) — fácil de migrar depois (poucas linhas). O `FornecedorConfig` de TI é o
  trabalho pesado.
- **Plano quando atacar:** tabela `core.fornecedores` (codigo opcional, nome, status) + join/array
  `modulos[]` (tag), dona = Configurador (padrão do `core.integracoes_api_endpoints`); módulos leem
  RO via `$queryRaw`. Migrar `FornecedorConfig` (TI) e `FornecedorDespesa` (logística) pra dentro.

### ✅ 2026-06-19 — Rastreamento em tempo real (mapa "tipo Maps/Waze") no Monitor da Frota — FASE A FEITA (núcleo)

- **✅ ENTREGUE 19/06 (Fase A, foreground):** backend `PosicaoVeiculo` + módulo `rastreamento`
  (`POST /rastreamento/posicao`, `GET /rastreamento/ativos`); app `useRastreamento`
  (watchPositionAsync ~25s/150m, só viagem EM_CURSO) enganchado em ENTREGA (`ViagemDetalheScreen`)
  e FROTA (`ViagemFrotaScreen`) + banner "📍 Localização ativa"; mapa Leaflet/OSM no Monitor
  (`MapaFrota` em `PainelFrotaPage`, polling 12s). Commits `9370ba7` (backend) + `c078ec4` (app) +
  `54f61c7` (web). Migração `20260619140000`. tsc/smoke E2E ok. **Falta push do Clenio.**
- **⏳ Pendências de governança (Fase A polish):**
  1. ✅ **Retenção/purga do rastro bruto** (LGPD) — FEITO 19/06 (`01aea65`): cron diário 03:30
     (`@nestjs/schedule`) apaga `posicao_veiculo` > `RASTREAMENTO_RETENCAO_DIAS` (default 7) +
     `POST /rastreamento/purga` manual (GESTOR_FROTA). GPS da baixa fica intocado.
  2. ✅ **Tela no Configurador** FEITA 19/06 (`0f216b8`): `/configurador/rastreamento-gps`
     (orientação + política LGPD + métricas ao vivo best-effort + botão de purga manual).
     Endpoint `GET /rastreamento/config` na logística.
  3. Testar no celular real com viagem em curso; afinar intervalo/bateria.
- **🚧 Fase B — background (CÓDIGO FEITO 19/06 `4be7341`, FALTA TESTAR NO DEVICE):**
  `expo-task-manager` + `expo-location` background + foreground-service Android;
  `backgroundLocation.ts` (task + start/stop), `useRastreamento` tenta background e cai
  pro foreground (Expo Go) sem regressão; `app.json` com ACCESS_BACKGROUND_LOCATION +
  versionCode 2. **NÃO roda no Expo Go** — precisa `npm run build:apk` (EAS) + validar no
  celular (permissão "permitir o tempo todo", app em background, ponto andando no Monitor).

<!-- entrada original preservada abaixo -->
### (spec) Rastreamento em tempo real — detalhe técnico
- **Origem:** gerente do supermercado pediu tela pra monitorar veículos/entregadores ao vivo.
  Spec §5.7 ("mapa com todos os veículos em viagem ativa") — hoje é só a lista "Na rua agora"
  em `PainelFrotaPage.tsx`. Rastreamento contínuo foi **adiado desde a Fase 1** (decisão original:
  deep-link + OSRM, tracking depois). **Agora destravado** — combinado com o Clenio em 19/06:
  **Fase A (foreground), planejar primeiro**.

- **Contexto LGPD favorável:** os celulares são **CORPORATIVOS** (uso exclusivo de trabalho) →
  base legal sólida (legítimo interesse/execução de contrato). Mesmo assim, manter governança
  (abaixo) — o aparelho corporativo reduz risco, não dispensa transparência/retenção.

- **Fundação que JÁ existe:** app captura GPS via `expo-location` (foreground) na baixa
  (`BaixaScreen`) e nas paradas/check-ins (`ViagemFrotaScreen`); device-session/aparelho
  corporativo vinculado; RBAC `GESTOR_ENTREGA`; tela Monitor (`PainelFrotaPage.tsx`).
  **Falta:** modelo de posição contínua + envio periódico + render de mapa.

- **A bifurcação técnica (decidida: Fase A primeiro):**
  - **Fase A — foreground (escolhida, roda no Expo Go atual):** `Location.watchPositionAsync`
    enquanto o app está aberto (uso normal do entregador: navega/dá baixa). Esforço baixo.
    Limite honesto: se ele **fechar** o app, o ponto **congela** até reabrir.
  - **Fase B — background (futuro):** localização com app fechado/tela bloqueada exige
    `expo-task-manager` + **build standalone (EAS)** — NÃO roda no Expo Go. É o passo que se
    daria pra produção de qualquer forma. Deixar pra quando a gerente validar a Fase A.

- **Escopo da Fase A (a implementar depois):**
  1. **Backend — modelo** `PosicaoVeiculo` (schema `logistica`): `viagemId`, `veiculoId`,
     `latitude`, `longitude`, `precisao?`, `velocidade?`, `bateria?`, `capturadoEm`. Índice por
     `viagemId`+`capturadoEm`. Decidir hot (última posição por viagem) vs trail (histórico curto).
  2. **Backend — endpoints:** `POST /frota/viagens/:id/posicao` (app envia ping; herda condutor
     da viagem, sem senha — padrão das paradas/despesa) + `GET /frota/posicoes` (gestor: últimas
     posições das viagens EM_CURSO da filial). Reusar fila offline (`filaFrota.ts`) com idempotência.
  3. **App:** liga `watchPositionAsync` ao entrar na viagem em curso, intervalo ~20–30s ou ~150m;
     desliga no retorno. Aviso visível "localização ativa durante a entrega" + aceite no 1º uso.
  4. **Web (Monitor):** mapa **Leaflet + OpenStreetMap** (grátis, sem chave; alinhado ao OSRM já
     previsto) em `PainelFrotaPage`; marcadores por veículo, auto-refresh (poll ~10–15s; só
     viagens EM_CURSO da filial), clique → condutor/viagem. WebSocket/SSE é overkill p/ poucos
     veículos — polling resolve.
  5. **Governança/LGPD (obrigatório):** rastrear **só durante viagem ativa** (liga na saída,
     **desliga automático no retorno** — rastreia a *entrega*, não a pessoa 24h); **retenção curta**
     do rastro bruto (purga após N dias; o GPS da *baixa* é lastro de cobrança, retém à parte);
     acesso só `GESTOR_ENTREGA`/ADMIN; **tela no Configurador** documentando a política (regra da
     plataforma — [[feedback_funcionalidade_visivel_no_configurador]]).
  6. **Bateria/dados:** afinar intervalo; foreground já limita ao horário de trabalho.

- **Possível "entrega 0" (validação rápida):** plotar no mapa o **rastro do dia** com os pontos
  de GPS já capturados nas baixas/paradas — protótipo da tela sem mexer no app, pra a gerente
  validar o layout antes de investir no ao vivo. Relacionado: [[#]] item "Mapa CONSOLIDADO das
  paradas/fazendas visitadas" (2026-06-18) reusa a mesma base de render Leaflet.

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

### 🔎 2026-06-19 — Workspace/Chamado para o SAC (atendimento ao consumidor) — CONCEITO AVALIADO
- **Ideia do Clenio:** usar o Workspace/Chamado pra atender o SAC (vários SAC entrando/saindo por
  e-mail, atendimento central pra todas as filiais, responsável único que aciona apoiadores).
- **Avaliação completa em `docs/AVALIACAO_SAC_WORKSPACE.md`** (viável, sem implementação ainda).
- **Conclusões-chave:** (1) "Em cópia" já existe (não confundir: Colaborador é T.I.-only) e é o
  mecanismo certo pro "apoiador vê só o chamado em que foi puxado" — **equipe NÃO serve** (vê a fila
  toda). (2) Maior gap estrutural: o **cliente do SAC não é usuário do sistema** → modelar
  "solicitante externo". (3) **Entrada e saída por e-mail NÃO existem** (porte médio-alto: IMAP/
  webhook + dedupe + threading + anti-loop; resposta externa com anexo). Fases sugeridas no doc.

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

### ✅ 2026-07-26 — [FEITO] Repetir a varredura de classes de defeito no Workspace, Fiscal e Inventário

**Executada em 26/07. Placar: 1 problema real em 3 módulos.**

| módulo | resultado |
|---|---|
| **Fiscal** | ✅ limpo — a hierarquia `OPERADOR_ENTRADA < ANALISTA_CADASTRO < GESTOR_FISCAL < ADMIN_TI` é respeitada nos 14 itens de menu, nas abas de operação (cada uma com `minRole` próprio) e nas ações. As 2 abas sem checagem de papel são somente-leitura em nível já permitido. |
| **Inventário** | 🔴 **6 rotas sem autenticação nenhuma** — corrigido em `41035b4` |
| **Workspace** | ✅ limpo — `JwtAuthGuard` é `APP_GUARD` global, só `/health` é `@Public()`; endpoints sem token devolvem 401 |

**O que foi corrigido no Inventário (`41035b4`):** `POST /api/v1/import/bulk`
gravava em `SB1010/SB2010/SLK010/SB8010/SBZ010` **sem token e alcançável de
fora** (o nginx proxia `/api/v1/import/`). Mais `update-status`,
`items-for-assignment(/ids)`, `release-for-recount` e as duas `clear/{tabela}`
(estas só internas). Removida a rota morta de `main.py` + auth no
`include_router` do `import_data` + `get_current_active_user` nas demais.
⚠️ `scripts/cleanup_inventories.py` passa a falhar com 403 — ele manda um token
FALSO hardcoded e só funcionava porque a rota não validava nada.

**Dois "achados" que morreram ao serem medidos** — vale mais que o achado real:

1. No Workspace, um `USUARIO_FINAL` recebe **200** em 11 telas que o menu esconde
   dele. Parecia exposição ampla. Medindo o **conteúdo**: `projetos` 0 vs 99,
   `paradas` 0 vs 37, `contratos` 0 vs 36, `licenças` 0 vs 41 — o filtro está na
   **camada de serviço** (o `findAll` recebe `user.sub` e `role`). Era
   "autorizado porém vazio", não falha.
2. `GET /equipes` devolve as 5 equipes a qualquer papel — mas é **deliberado e
   documentado** em `equipe.service.ts:27-35`: a transferência de chamado precisa
   enxergar até equipes privadas, e a abertura usa o `findSelecionaveis`
   filtrado. Bloquear com `@Roles` quebraria Chamados e Base de Conhecimento
   para os 105 `USUARIO_FINAL`. O `include: { usuario: true }` também foi
   conferido: só `id/nome/username/email/departamentoId/preferencias`, nada
   sensível.

**Não testável no DEV:** `/ativos` e `/sla` devolvem 0 para todos os papéis —
sem dado para distinguir "filtrado" de "vazio". Não afirmo que estão corretos.

**Contexto original abaixo.**

**Contexto:** em 25/07 varri a **logística** procurando irmãos de quatro classes
de defeito encontradas no dia. Achei **um** defeito real e três classes limpas.
As classes valem para os outros módulos, e a primeira já mordeu **duas vezes** só
na logística — é a mais provável de existir lá também.

**As quatro classes:**

1. **Menu liberado ≠ backend liberado.** Item aparece no menu/tile para um papel
   que o `@Roles` do controller não admite → a tela abre, lista e morre no
   clique com 403. Aconteceu 2× na logística: `OPERADOR_ENTREGA` × cofre de
   comprovantes (`7531175`) e `GESTOR_FROTA` × painel de entregas (`f4697de`).
2. **Endpoint de leitura por `:id` sem recorte de filial/escopo** — dava para ler
   registro de outra filial sabendo o id (`comprovantes/por-entrega`, corrigido
   em `7531175`).
3. **Fallback silencioso** — backend degrada e devolve um marcador que a tela
   nunca lê, então o usuário não sabe que está vendo resultado degradado
   (`origemRota: PRIMEIRA_ENTREGA` na sugestão de rota, corrigido em `f1429b2`).
4. **Ação permitida fora de ordem** — transição de estado sem guarda, ou etapa
   que parecia obrigatória e nunca foi (baixa sem "iniciar", `8e84ec8`).

**Como varrer (o método importa):** o grep **não conclui** nada aqui — errou 3×
na varredura da logística. `@Roles` pode vir antes OU depois do `@Get`, pode
estar separado do `@Controller` por bloco de comentário, e guarda de estado pode
morar dentro de helper (`rascunhoOuErro`). Levante a hipótese por grep e **bata
no endpoint com token de cada papel** — o HTTP é a única fonte de verdade.
Para a classe 1, o mais rápido é montar a matriz `item de menu × papel × código
HTTP` e procurar 403 onde o menu mostra.

**Cuidado ao testar a classe 4:** escolha casos que devem ser REJEITADOS
(rejeição não muta). E atenção ao falso alarme: baixar entrega já terminal
devolve **201 por idempotência deliberada** (reenvio da fila offline do app) —
confirme no banco antes de chamar de bug.

**Por que adiado:** decisão do Clenio em 25/07 — a varredura da logística nasceu
do bug que ele estava testando; abrir os outros três módulos no mesmo dia
desviaria o foco. Sem urgência conhecida: não há relato de 403 nesses módulos,
só a suspeita estrutural.

**Referência:** `memory/project_onda_logistica_24_25jul.md`.


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

---

## 🌙 Modo Escuro (Dark Mode) opcional — Workspace/plataforma

**Origem (Clenio, 21/06):** ao padronizar o layout do Workspace (telas brancas
em card centralizado), surgiu a dúvida sobre fadiga ocular das telas claras.

**Avaliação:** o tema claro **está correto** pro uso da CAPUL (escritório, luz
diurna) — fundo já é `#F8FAFC` (não branco puro) + texto slate (não preto puro),
e o layout em card **reduz** o "muro branco" da tela full-width antiga. Dark mode
ajuda em **pouca luz**, mas em escritório iluminado pode piorar pra quem tem
astigmatismo (halo). Por isso fica como **opção do usuário**, não default.

**Escopo (feature à parte — sistema de temas):**
- Toggle por usuário (persistir em `usuario.preferencias`, já existe a coluna).
- Paleta dark (tokens via CSS vars `--bg-main`/`--bg-sidebar`/texto — `index.css`
  já usa vars, facilita) + classe `dark` no root (Tailwind `darkMode: 'class'`).
- Revisar contraste WCAG AA em todos os componentes (cards, badges, inputs).
- **Não** é um passo de layout — é projeto próprio. Avaliar prioridade depois do
  rollout de layout do Workspace.

---

## [Logística/RDV] Pontos em aberto da onda de 27/07

**Contexto:** onda de 8 commits no RDV (escopo do conteúdo, cancelar/devolver
planejamento, despesa da autoridade nascendo aprovada, adiantamento só-leitura no
app, e a amarração explícita Supervisor de Departamento × departamento). Tudo
entregue e verificado; o que segue são resíduos de decisão, não pendência técnica.

### 1. Departamento com DOIS supervisores — o modelo admite um só
A migration `20260727180000_supervisor_departamento` tem `@@unique(filial,
departamento)`. No DEV, um departamento da filial matriz tinha dois supervisores
entre seus veículos (`clenio` e `supdept01`) e ficou **sem responsável de
propósito** (conceder autoridade sobre dinheiro no chute é pior). **Decidir:** um
departamento pode legitimamente ter titular + substituto? Se sim, o unique vira
`(filial, departamento, usuario)` e a tela passa a listar N responsáveis.
**Verificar após o deploy:** a tela Equipe › Supervisores de Departamento mostra
em amarelo os departamentos sem responsável — em PROD isso depende do estado de
`veiculo.supervisorId` de lá.

### 2. ✅ RESOLVIDO em 01/08 — auto-serviço de adiantamento encerrado
Decisão do Clenio: **tirar de vez**. O lançamento saiu também do desktop
(`086447a`) e virou ato de **quem aprova** aquele representante.

A trava ficou por **AUTORIDADE**, não por papel — com duas consequências que vale
ter em mente:
- o **coordenador também não lança o próprio**: o cadastro dele roteia para o
  Supervisor de Departamento, que passa a lançar o adiantamento dele;
- afrouxar o `@Roles` por engano no futuro **não reabre** o auto-serviço.

Quem está no topo da pirâmide (Sup. de Departamento sobre o próprio departamento)
segue lançando o seu — é autoridade sobre si, mesma regra que a despesa já usava
desde 27/07. O estado `PENDENTE` deixa de nascer; `decidir` continua no ar para
resolver os pendentes legados.

### 3. Frota × RDV: duas fontes de "departamento", de propósito
O RDV agora usa `supervisor_departamento`; a **frota** segue derivando de
`veiculo.supervisorId` + `departamentoLotacaoId`. É intencional (lá o campo
significa "responsável pelo veículo"). **Não reunificar** — está comentado no
código dos dois lados. Se um dia a frota também precisar de amarração explícita,
é outra decisão, não uma "correção de inconsistência".


---

## [Logística/RDV] Pontos em aberto da onda de 31/07–01/08

**Contexto:** 12 commits em dois dias, disparados pelos testes do Clenio com as
personas reais (lidyanerocha → fabricioneiva → kelvereduardo). Três princípios
ficaram estabelecidos e estão nos testes:

1. **Planejar ≠ executar** — montar o roteiro é do time; *enviar*, *liberar*,
   *apontar visita* e *concluir* são do **dono**.
2. **Despesa de veículo tem veículo** — cadastro do veículo aponta o responsável →
   planejamento sugere → despesa herda. Categoria VEÍCULO exige o carro.
3. **A decisão vale para o valor decidido** — editar valor/tipo/data/veículo de
   despesa decidida devolve para análise; depois de decidido só a autoridade
   apaga; `editar`/`remover` respeitam o fechamento do mês.

E uma regra transversal: **quem decide é quem não lançou** (aprovar o próprio
lançamento é barrado; *contestar* o próprio segue livre, porque é ato contra o
próprio lançamento).

### 1. Supervisor de Departamento e a manutenção — RESOLVIDO, mas registrar o porquê
Decisão do Clenio (01/08): **manutenção é do Gestor de Frota**. Ele consulta a
tela de Veículos (campos desabilitados, sem "Novo veículo", sem registrar
manutenção) e continua vendo o **custo** dela em Custos da Frota, porque a
manutenção gera despesa. O dinheiro chega nele, a operação não.

### 2. Relato da visita reusa `parada.observacao` — separar um dia?
O relato escrito no apontamento grava no MESMO campo da observação de
planejamento, e o formulário abre pré-preenchido com ela para o representante
**complementar** em vez de apagar. **Decidir se um dia vale separar** "anotação do
roteiro" (escrita por quem monta) de "relato de campo" (escrito por quem executa)
— seriam +1 migration e uma coluna a mais no relatório de visitas.

### 3. ✅ RESOLVIDO em 06/08 — `editarViagem` removido (era porta dos fundos da regra 4)

A conferência pedida aqui virou achado. O que se apurou:

- **Não havia dupla contagem.** No acerto (`supervisor.service.ts`), o
  `advs.reduce` **substitui** o valor pelos adiantamentos APROVADOS do mês; o
  campo legado só entra como *fallback* quando não existe nenhum.
- **Mas o campo continuava gravável, e por um caminho que contornava a regra
  "ninguém lança o próprio adiantamento, nem o coordenador"** (01/08).
  `PATCH /supervisor/viagens/:id` era `@Roles('COORDENADOR','SUPERVISOR_FROTA')`, e
  `assertEscopoSupervisor` tem um ramo de auto-serviço (`ehProprioSupervisor`) —
  então o COORDENADOR alcançava o **próprio** planejamento. Sem linha aprovada no
  mês, o valor gravado virava o adiantamento efetivo do acerto.
- É o padrão que a onda de 31/07–01/08 expôs cinco vezes: **`lançar` valida,
  `editar` herdou menos**.

**Correção:** o endpoint, o método e o `EditarViagemSupervisorDto` foram
**removidos**. `viagem.adiantamento` segue sendo **lido** como fallback, mas
ninguém mais o escreve no RDV. Corrigir um legado se faz pelo caminho certo —
lançar o Adiantamento APROVADO do mês, que substitui o campo no cálculo.

Alcance real, para não superdimensionar: era **só por API** (nenhuma tela
chamava; o `adiantamento` que o frontend edita vai para `/frota/viagens/:id`,
que é outro módulo), exigia token de coordenador e só mordia sem adiantamento
aprovado no mês. No DEV, **0 de 19** viagens de supervisor tinham valor legado.

⚠️ **Conferir em PROD** antes do deploy — se houver viagem de supervisor com
`adiantamento` legado, o valor continua valendo como fallback (não se perde),
mas vale saber que existe:

```sql
SELECT count(*) FROM logistica.viagem
 WHERE tipo='SUPERVISOR' AND adiantamento IS NOT NULL AND adiantamento <> 0;
```

---

## [Inventário] Migrations fora de controle — RESOLVIDO em 07/08/2026

**Achado ao começar a "finalizar o módulo".** O Inventário tem um runner próprio
(`inventario/database/migrate.sh`, com `schema_migrations` + checksum), mas ele
**não estava ligado a nada** — era o único backend da plataforma sem job
`*-migrate`. Dependia de alguém lembrar de rodar à mão.

O que se encontrou:

| Migration | Estado real |
|---|---|
| até 013 | aplicada e registrada (última em 05/05) |
| **014** — alarga códigos mercadológicos | **NÃO aplicada** havia ~6 semanas |
| **015** — Fase 0 offline | aplicada à mão, **sem registro** |

A 014 é a que corrige o `StringDataRightTruncation` do sync com o Protheus de
**produção** (código de 6 dígitos em coluna `varchar(4)`). Ou seja: **o sync
estava quebrado** e ninguém tinha percebido, porque nada avisa.

**Causa de fundo (o que realmente estava errado):** a 014 **se auto-registrava**
no próprio `.sql`. Como o runner também registra, o INSERT dele colidia na chave
única, o `set -e` matava o script — e **as migrations seguintes não eram
aplicadas**. Foi exatamente assim que a 015 ficou para trás. Um erro numa
migration silenciava todas as posteriores.

**Correções:**
1. `migrate.sh` — `INSERT ... ON CONFLICT (filename) DO UPDATE SET checksum`.
   Defesa em profundidade: auto-registro não derruba mais o runner, e o checksum
   que o auto-registro deixava nulo é preenchido.
2. `014_*.sql` — removido o auto-registro. Escrituração é do runner; migration
   nova **não** deve registrar a si mesma.
3. **Job `inventario-migrate` no compose**, espelhando os outros 4 backends
   (`service_completed_successfully` antes do backend subir). Usa a imagem do
   Postgres, porque o runner é SQL + `psql` e o backend é Python sem `psql`.

**Verificado ponta a ponta:** removido o registro da 015, o job detectou,
aplicou e re-registrou com checksum; o backend só sobe depois do job terminar.

⚠️ **Para o deploy:** a linha manual da 015 no roteiro **deixa de ser
necessária** — o job aplica. Mas conferir que a **014** entra, porque em PROD ela
provavelmente também está pendente (mesmo sintoma: sync do mercadológico
truncando).

---

## [Inventário] Pendências levantadas em 02/08/2026

**Como apareceu:** a suíte do Inventário quebrava na coleta do pytest. Ao corrigir
(`96b1ec2`), descobriu-se que os dois arquivos `test_*.py` do módulo eram **scripts de
diagnóstico** — nenhum `assert`, `print()` e chamada à API de **produção** do Protheus.

**Tratar quando houver trabalho no Inventário** — não vale abrir frente só para isto.

### 1. ~~Sem cobertura de regra de negócio~~ — ⚠️ CORRIGIDO EM 05/08/2026

**O item 1 original estava ERRADO e foi retirado.** Ele afirmava que "o módulo nunca teve
teste automatizado" e que "hoje há só `test_smoke.py`". Não é o caso:
`inventario/backend/tests/` tem **31 cenários desde 09/05/2026** (`8dfb3e1`), cobrindo
justamente o que o item pedia — `test_handoff_supervisor.py`, `test_avanco_ciclos.py`,
`test_cycle_critical_scenarios.py`, `test_estados_e_edge.py`, `test_ciclos_stress.py`.

**Como o engano aconteceu:** `tests/` está no **`.dockerignore`** de propósito (não vai
para a imagem de produção). Rodar `pytest` dentro do container coleta só o
`test_smoke.py` da raiz e devolve "2 tests" — foi essa leitura que virou o item. O
runner correto é **`inventario/backend/run-tests.sh`**, que copia `tests/` para o
container antes de rodar:

```bash
cd inventario/backend
./run-tests.sh                              # suíte completa
./run-tests.sh -k handoff                   # filtro
```

Os testes usam o banco real com `search_path=inventario`, mas **cada teste roda em
transação revertida no fim** (`tests/conftest.py`) — não deixa resíduo.

**Estado em 05/08/2026: 31 passando.** Havia 1 falha
(`test_cycle_critical_scenarios.py::test_audit_logs_are_created`), que era **teste
desatualizado, não bug de produto**: usava `log.metadata[...]`, mas `metadata` é
reservado pelo SQLAlchemy (é o `MetaData` do `Base`) e a coluna JSONB do modelo chama
`extra_metadata`; além disso lia a chave `new_divergencies`, enquanto o serviço grava
`new_divergences`. Corrigido.

**O que segue realmente sem cobertura** (este é o item que vale manter):

- **sincronização Protheus** — parser da resposta e o `sync` da migration 014;
- **RBAC** — `OPERATOR` não vê saldo (`feedback_inventario_rbac_operator`);
- **contagem cega** (`feedback_inventario_contagem_cega`).

**Lição que fica:** medir cobertura de um módulo rodando o test runner *dentro do
container* dá resposta errada quando o `.dockerignore` exclui os testes. Conferir o
`git ls-files` antes de concluir que não existe teste.

### 2. Credencial de produção do Protheus no código — 2 ocorrências restantes
`96b1ec2` tirou a do script (`diag_api_protheus.py`, agora via
`PROTHEUS_INVENTARIO_AUTH`). **Continuam:**

```
inventario/backend/app/core/config.py:59, :136     ← valor FIXO
inventario/backend/app/core/protheus_config.py:118 ← default do os.getenv
```

Não foram tocadas de propósito: mexer no default sem alinhamento pode derrubar a
integração se a env não estiver definida nos ambientes.

**Verificado em 05/08/2026:** as três linhas continuam lá. No DEV a env
`PROTHEUS_INVENTARIO_AUTH` **está definida**, então o default embutido não chega a ser
usado — ele é rede de segurança silenciosa, não o valor efetivo. Conferir o mesmo em
HLG/PROD antes de exigir a env, senão a troca derruba a integração.

**A mesma credencial aparece fora do Inventário** (levantado em 05/08, não estava no
registro original): `docker-compose.yml:338,:341` (como default de `${VAR:-...}`) e
`auth-gateway/prisma/seed.ts:377`. A rotação no Protheus resolve todas de uma vez —
mais um motivo para o caminho ser rotacionar, não caçar ocorrência por ocorrência.
Menor gravidade, mesma família: `inventario/backend/tests/conftest.py:52` traz a senha
do Postgres de **desenvolvimento** como default.

⚠️ **A credencial está no histórico do git.** Removê-la do código **não** a invalida —
o caminho é **rotacionar no Protheus** e então deixar o código exigir a env. Faz parte
do Anexo B de `docs/PENDENCIAS_PROTHEUS_10052026_SEGURANCA.md` (achado de 10/05, ainda
aberto), e depende do Marco/Protheus, não só de nós.

### 3. Scripts soltos na raiz do backend
`run_migration.py`, `update_b2_xentpos.py`, `update_sb2_cm1.py`, `update_sb2_cm1_v2.py`
e os dois `diag_*` convivem com o código da aplicação. Avaliar mover para `scripts/`
— some o risco de coleta acidental pelo pytest e fica claro o que é aplicação e o que
é ferramenta de operação.

**Verificado em 05/08/2026:** os 7 arquivos continuam na raiz (incluindo o
`test_smoke.py`, que é o único `test_*` que a imagem enxerga). Ao mover, atenção: o
`test_smoke.py` na raiz é justamente o que faz `pytest` dentro do container não sair
vazio — se ele for para `scripts/`, decidir conscientemente se a imagem passa a não ter
teste nenhum ou se `tests/` sai do `.dockerignore`.
