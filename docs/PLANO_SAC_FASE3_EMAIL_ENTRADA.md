# Plano — SAC Fase 3: E-mail de ENTRADA

> Documento de **design** (para revisão do Clenio antes de codar). Fecha o ciclo
> de conversa do SAC: o cliente responde por e-mail e a mensagem cai no chamado.
> Complementa `AVALIACAO_SAC_WORKSPACE.md` (doc mestre) e a memória
> `project_sac_workspace_avaliacao`.
>
> **Status:** proposto, não iniciado. Base: `feat/sac`. Fases 1, 2 e 2c já entregues/validadas.

---

## 1. Onde estamos (fatos do código, jun/2026)

| Aspecto | Hoje |
|---|---|
| Saída (SMTP) | ✅ nodemailer no **auth-gateway**, centralizado em `POST /api/v1/internal/email/send`. SAC usa `enviarExterno` (com anexo na 2c). |
| Entrada (IMAP/webhook) | ❌ **Não existe** — zero dependências, zero código. |
| Provedor | DEV: **MailHog** (profile `mail`, SMTP `mailhog:1025`, UI `:8025`). PROD: SMTP externo via `SMTP_*`. |
| Threading | Assunto `[SAC-<numero>] <titulo>`. `Chamado.numero` = `Int @unique @default(autoincrement())`. Sem Message-ID/In-Reply-To armazenados. |
| Autoria de histórico | `HistoricoChamado.usuarioId` é **NOT NULL**; **não há usuário "sistema"**. |
| Anexos | `AnexoChamado` em disco (multer, whitelist `ACCEPT_ANEXO`, 10MB). 2c já salva o anexo de saída. |
| Config visível | Padrão singleton + tela (fiscal `AmbienteConfig`/`LimiteDiario`; Configurador `IntegracoesPage`). |
| Anti-loop | ❌ Nenhum tratamento de `Auto-Submitted`/`X-Auto-Response-Suppress`/bounces. |

---

## 2. Decisões de arquitetura (com recomendação)

### D1 — Transporte de entrada: **IMAP poll** (não webhook) ✅
**Recomendo poll IMAP** numa **caixa dedicada** (ex.: `sac@capul.com.br`):
- Funciona com **qualquer servidor de e-mail padrão** — encaixa na infra atual da CAPUL (já têm SMTP; IMAP é o par natural). Webhook exigiria um provedor SaaS de *inbound parse* (SendGrid/Mailgun) + endpoint HTTPS público — não é a realidade hoje.
- Em DEV, MailHog **não tem IMAP** → testamos com qualquer caixa IMAP de teste (ou um mock do cliente IMAP). Detalhe coberto na sub-fase 3b.
- Webhook fica como evolução futura (se migrarem pra provedor SaaS).

**Onde roda o poller: dentro do `gestao-ti`** (não no auth-gateway).
- O processamento é **100% domínio do Workspace/Chamado** (casar `[SAC-n]`, criar histórico, achar equipe, notificar). Centralizar e-mail no auth-gateway faz sentido pra **saída** (transporte genérico); a **entrada** é regra de negócio do SAC.
- Evita um hop cross-serviço por mensagem. Credencial IMAP é uma caixa/segredo **diferente** do remetente SMTP.

### D2 — Autor do histórico de entrada: **usuário "Sistema SAC"** ✅
`usuarioId` é NOT NULL e muitos `include`/telas assumem `historico.usuario`. Duas saídas:
- **(A) Criar um usuário de sistema** `SAC (e-mail)` no `core` (seed do auth-gateway) e atribuir os históricos de entrada a ele. **← Recomendado** (mínimo churn; relação `usuario` continua válida em todo lugar).
- (B) Tornar `usuarioId` nullable + campo de autoria. Mais churn no schema e nas queries.

Com (A): a mensagem de entrada é um **`COMENTARIO` público** do usuário-sistema, com a `descricao` prefixada pelo remetente real — UI renderiza como *"📨 Cliente (cliente@x.com) respondeu por e-mail: …"*. Um modelo rico de "participante externo" fica pra Fase 4.

### D3 — Casamento (matching) por **`[SAC-<numero>]` no assunto** ✅
- **Primário:** regex no `Subject` → extrai `numero` → acha o `Chamado` (chave `Int @unique`, confiável). Nós controlamos o assunto e instruímos *"responda este e-mail"*.
- **Hardening opcional (sub-fase tardia):** guardar o `Message-ID` das saídas e casar `In-Reply-To`/`References` da entrada — cobre cliente que apaga o `[SAC-n]` do assunto. **Não** é necessário pro v1.
- **Remetente:** registra o `From` real; se ≠ `clienteEmail`, **sinaliza** (não rejeita — cliente pode responder de outro endereço). Entrada **nunca** muda dono/solicitante do chamado.
- **Sem match** (`[SAC-n]` ausente ou número inexistente) → **lista de triagem / log** (NÃO cria chamado automático). Auto-criar chamado de e-mail arbitrário é Fase 4 (precisa de solicitante externo + controle de spam). Escopo seguro do v1: só **threada** em chamados existentes.

### D4 — Anti-loop, dedupe e bounces ✅
- **Dedupe** por `Message-ID` (tabela de processados) + marcar `\Seen` após processar.
- **Descartar** mensagens com `Auto-Submitted: auto-replied|auto-generated`, `X-Auto-Response-Suppress`, `Precedence: bulk|auto_reply`, ou remetente vazio/`MAILER-DAEMON` (bounces/férias).
- **Não reprocessar nossas próprias saídas**: pular mensagens cujo `From` = nosso `SMTP_FROM`.
- **Tetos com log** (regra "no silent caps"): limite de mensagens por ciclo; o que for descartado é **logado** (matched/unmatched/skipped/dup), nunca silencioso.

### D5 — Visível, não black-box ✅ (regra geral da plataforma)
- **Singleton de config** `sac_email_config` (schema `gestao_ti`): `enabled`, `imapHost/Port/User/Password` (cifrada), `mailboxFolder` (default INBOX), `pollIntervalMinutes`, `pauseSync` (freio de mão), `lastPollAt`, `lastError`, contadores.
- **Tela de admin** (no Workspace/gestão-ti, como o fiscal tem as suas — ou no Configurador; **ponto a decidir contigo**): on/off, credenciais, intervalo, **"Testar conexão"**, **"Buscar agora"** (manual), e **histórico de ingestão** (matched/unmatched/skipped, com horário e erro).
- Poller agendado **supervisionado** com pausa — espelha o `pauseSync` do fiscal. (A regra do SEFAZ-em-loop é específica de SEFAZ; pollar uma caixa IMAP é seguro, mas mesmo assim fica exposto e pausável.)

### D6 — Anexos de entrada
- Anexos recebidos viram `AnexoChamado` (mesma whitelist `ACCEPT_ANEXO` + teto 10MB; descarta/loga o que exceder). Reaproveita o diretório de uploads (grava o buffer direto, sem multer).

---

## 3. Sub-fases (incrementais, verificáveis)

> Cada sub-fase fecha com build + testes + checkpoint no DEV, no padrão das fases anteriores.

- **3a — Fundações (sem poller):** usuário "Sistema SAC" no seed; singleton `sac_email_config` + migration; tela de admin com **"Testar conexão"** (abre IMAP e lista contagem, sem ingerir). Deps: `imapflow` + `mailparser` no `gestao-ti/backend`. *Risco baixo — nada é ingerido ainda.*
- **3b — Fetch + parse + filtros:** buscar não-lidas, `mailparser`, **dedupe** por Message-ID, **anti-loop** (headers/bounces), **botão "Buscar agora"** (manual) + **log de ingestão**. Ainda **sem** agendamento automático → seguro pra testar à vontade.
- **3c — Threading + entrada no chamado:** casa `[SAC-n]` → cria `COMENTARIO` público (usuário-sistema) + **notifica** o atendente/equipe + ingere anexos. Sem match → **lista de triagem**.
- **3d — Agendador:** intervalo/cron com `pauseSync`, último status na tela, tetos + logging. Liga a automação só quando 3a–3c estiverem provados.

**Fase 4 (fora daqui):** solicitante externo de verdade; auto-criar chamado de e-mail sem `[SAC-n]`; hardening por `Message-ID`/`In-Reply-To`; SLA/relatórios/templates.

---

## 4. Segurança (a observar no código)
- **Senha IMAP cifrada em repouso** (padrão do certificado A1 / `authConfig` do Configurador) — ou via secret de env pros bits sensíveis. Nunca em texto puro no DB/log.
- **Spoofing:** registra `From` real; sinaliza divergência com `clienteEmail`; entrada **não** altera ownership.
- **Anexos:** whitelist + teto + nome saneado (mesma defesa do path-traversal já existente nos downloads).
- **Tamanho de mensagem** limitado; `mailparser` é seguro p/ parsing.
- **Endpoint interno** (se 3 usar auth-gateway pra algo) segue o bloqueio de rede `/internal/*` do Nginx.

## 5. Dependências e deploy
- Novas libs: `imapflow`, `mailparser` (em `gestao-ti/backend`).
- **1 migration** (singleton `sac_email_config`) + **1 seed** (usuário Sistema SAC no `core`/auth-gateway).
- **DEV:** caixa IMAP de teste (MailHog não serve IMAP) — ou mock do cliente nos testes.
- **PROD:** criar a caixa `sac@capul.com.br` (TI), preencher credenciais na tela, ligar o `enabled` por último.

---

## 6. Pontos a confirmar com o Clenio (antes de 3a)
1. **Caixa dedicada** `sac@capul.com.br` (ou outro endereço) — existe / TI consegue criar?
2. **Onde fica a tela de config**: Workspace (gestão-ti, como o fiscal faz) **ou** Configurador? (recomendo Workspace, perto do SAC.)
3. **Sem-match → triagem** (recomendado) vs auto-criar chamado já no v1 (eu adiaria pra Fase 4).
4. Começar por **3a** (fundações + testar conexão), certo?
