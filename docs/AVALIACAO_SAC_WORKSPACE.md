# Avaliação — Workspace/Chamado para o SAC da empresa

**Data:** 19/06/2026 · **Atualizado:** 20/06/2026 (desenho de 5 camadas) · **Status:** 🔎 conceito avaliado, SEM implementação · **Origem:** ideia do Clenio
**Objetivo:** usar o módulo Workspace/Chamado (Gestão TI) para atender o **SAC** (atendimento ao consumidor), com vários SAC entrando por e-mail e respondidos por e-mail, atendidos de forma central para todas as filiais.

> Este doc é a validação do conceito contra o que o sistema **já faz hoje**. Não é spec de
> implementação — é o mapa de decisões + viabilidade + fases para quando o desenvolvimento for autorizado.
>
> **Veja primeiro a §9 — Desenho consolidado (5 camadas)**, que sintetiza as decisões abaixo
> com os dois complementos do Clenio (equipe restrita + rosters por departamento), reverificados
> no código em 20/06.

---

## 1. O que o sistema JÁ tem (fatos verificados no código)

- **"Em cópia" EXISTE** (desde 13/05/2026): mecanismo para **pessoas de FORA do T.I.** Quem está em cópia lê o chamado (papel de "solicitante extra"). Staff/T.I. **não** pode entrar em cópia (usa Colaborador). Adicionar/remover a qualquer momento já funciona.
- **Colaborador EXISTE, mas é T.I.-only** (atua na solução). Adicionar não-T.I. como colaborador é **bloqueado** por design (`chamado-helpers.service.ts`).
- **Modelo de visibilidade** (`chamado-core.service.findAll`):
  - **Staff do depto/workspace** (gestor/suporte daquele depto) → vê **toda a fila** do depto.
  - **Membro de equipe** (`membroEquipe` ATIVO) → vê **todos** os chamados roteados pra aquela equipe (`equipeAtualId`).
  - **Colaborador** → vê **aquele** chamado (T.I.-only).
  - **Em cópia** → lê **aquele** chamado (garantido no detalhe; ver §6 ponto técnico).
  - **PRIVADO** → staff-only. **Comentário interno** → staff-only (copiado nunca vê).
- **E-mail**: só **notificação interna** (EmailEnvolvidosService). **NÃO existe** entrada de chamado por e-mail nem resposta externa ao cliente por e-mail.

---

## 2. O que do conceito do Clenio encaixa bem ✅

- **SAC como Workspace/Departamento** — o sistema já é multi-workspace por depto. SAC vira um depto-workspace com um **responsável** (gestor/operador). Casa com "um local central p/ várias filiais".
- **Filial no chamado** (`filialId`) — atendimento central, com a filial identificando a origem de cada SAC.
- **Adicionar/remover apoiador a qualquer momento** — já existe via "em cópia".

---

## 3. Correção conceitual IMPORTANTE ⚠️ (equipe ≠ "ver só o que foi puxado")

Requisito do Clenio: *"o apoiador vê só o SAC em que foi incluído, não todos"*.

- **Equipe NÃO faz isso:** ser membro de equipe = ver a **fila inteira** daquela equipe. "Equipes por departamento" daria acesso a **todos** os SACs — o oposto do desejado.
- **Mecanismo certo = "Em cópia"** (acesso **por chamado**).

**Tradução do desenho pro modelo certo:**
- **Responsável + operadores do SAC** = staff do workspace SAC → veem a fila.
- **Apoiadores dos departamentos** = adicionados **em cópia** caso a caso → veem **só aquele** chamado.
- "Equipes por departamento" servem, no máximo, como **catálogo de quem pode ser puxado** (lista de apoiadores por área), não como visibilidade.

**Atualização 20/06 — dois complementos do Clenio (reverificados no código):**
- **Equipe `restritaVisibilidade` (18/06) — isola a FILA do SAC.** `findAll` (~L444-470): GESTOR/ADMIN do depto vê tudo; **SUPORTE não-membro NÃO vê** chamados de equipe restrita; membro da equipe vê a fila daquela equipe. Logo, uma **Equipe SAC restrita** mantém a fila do SAC visível só aos operadores (+ gestor), sem vazar pro resto do Gestão TI. ⚠️ Continua sendo **fila inteira da equipe**, não per-chamado — por isso é camada de **isolamento**, não o controle por-apoiador.
- **Rosters por departamento curados pelos líderes — catálogo de elegíveis.** Cada líder de setor mantém a equipe (membros) de quem pode apoiar o SAC; o **seletor de "em cópia" do SAC passa a oferecer só esses usuários**. ⚠️ **Regra de ouro:** essas equipes-catálogo **NUNCA** podem ser `equipeAtualId` (roteadas) de um SAC — senão todos os membros veriam a fila. Servem **só** pra popular o seletor; o acesso real é per-chamado via cópia.

---

## 4. Dúvidas do Clenio — respostas

- **Ao remover da cópia, mantém acesso ao que foi tratado?** Hoje **não** (visibilidade = estar na lista de cópia atual). Comentário **interno** o copiado nunca viu (só públicos). **Recomendação:** perder o acesso ao sair é o correto (privacidade/LGPD) — mas é decisão de regra.
- **É correto excluir o usuário do SAC também?** Separar: **remover da CÓPIA** (perde aquele chamado) ≠ **remover do WORKSPACE SAC** (perde o módulo). Normalmente só se tira da cópia.
- **Em cópia vs Colaborador?** Pro SAC, **Em cópia** (Colaborador é T.I.-only e bloqueia não-T.I.). Só mudaria se o apoiador fosse **atuar na solução como técnico**.

---

## 5. O cliente não é usuário — mas o ponto de ENTRADA primário é o colaborador (decisão 20/06)

**Reenquadramento do Clenio (20/06):** o ponto de entrada primário do SAC **não** é o cliente
mandando e-mail — é o **colaborador da filial** que recebe o SAC no balcão/telefone e **registra
o chamado na plataforma** em nome do cliente, repassando as infos pro responsável do SAC responder.

Isso **muda a antiga conclusão** ("o cliente não ser usuário é a maior mudança estrutural"):
- Com entrada via colaborador, o **solicitante é um usuário real** (login, filial, RBAC — tudo
  que o Chamado já tem). O **cliente vira um conjunto de CAMPOS** no chamado (nome / contato /
  produto / filial de origem), **não uma nova identidade**. Trivial (alguns campos opcionais no
  workspace SAC), não um subsistema.
- O **"solicitante externo"** (cliente sem login) deixa de ser bloqueador do núcleo. Ele **só
  reaparece** num canal específico: **e-mail de ENTRADA que cria chamado sozinho** (cliente manda
  e-mail sem colaborador no meio) — Fase 3, opcional e aditivo. Ver §6.1.

**Decisão de arquitetura (20/06):** **reaproveitar o Chamado** (não construir do zero). Os ajustes
são pontuais (a cláusula `copias` no `findAll` + campos SAC), e o reenquadramento elimina o gap que
justificaria um módulo próprio. Só reavaliar "do zero / ferramenta dedicada" se o SAC virar
**omnichannel** (e-mail + WhatsApp + chat + portal do cliente com login + CSAT externo). Dá pra
começar no Chamado e extrair depois se crescer.

---

## 6. O que falta de verdade (e-mail) + ponto técnico

- **Entrada (inbound)** — NÃO existe. Serviço lê a caixa do SAC (IMAP) ou recebe via webhook → cria o chamado → atribui ao responsável. **Pontos críticos:** dedupe (não duplicar do mesmo e-mail), **threading** (resposta do cliente = nova interação no MESMO chamado, via `Message-ID`/`In-Reply-To` ou token no assunto `[SAC-123]`), **anti-loop** (auto-resposta/out-of-office), spam/anexo.
- **Saída (resposta ao cliente)** — NÃO existe como e-mail externo. Precisa de uma **interação tipo "Resposta SAC"**: externa/pública, dispara e-mail ao cliente (com **anexo**), mantém threading.
- **Ponto técnico ✅ CONFIRMADO (20/06) — é um GAP real:** "em cópia" garante acesso no **detalhe** (`chamado-core.service.ts` findOne, ~L603 `isCopiado`), mas no **`findAll` (listagem) NÃO existe cláusula para `copias`** (o OR de visibilidade, ~L472-478, só tem solicitante/técnico/colaborador/`equipeAtualId`/depto-staff). Logo, o SAC em cópia **não aparece na lista** do apoiador — só por link direto. **Ajuste necessário na Fase 1:** adicionar `{ copias: { some: { usuarioId: user.sub } } }` ao OR do `findAll`.
- **Regra de elegibilidade da cópia ✅ CONFIRMADA (20/06):** `adicionarCopias` chama `assertNaoSeTI` (~L826) → **só usuários NÃO-T.I.** entram em cópia. Bom para o SAC (apoiadores são de outros setores). Limite: apoiador que seja staff de T.I. não entra por cópia (usaria Colaborador, T.I.-only).

### 6.1 Arquitetura multicanal — o e-mail NÃO é excluído (decisão 20/06)

Entrada via colaborador é o ponto de partida, mas **não fecha a porta do e-mail**. Os canais
**convivem** sobre o MESMO chamado/workspace SAC (o chamado é o registro canônico; cada canal só
cria ou adiciona interação nele):

| Canal | O que faz | Fase | Precisa de |
|-------|-----------|------|-----------|
| **Colaborador registra** (plataforma) | colaborador da filial abre o SAC em nome do cliente | 1 (MVP) | nada novo — solicitante é usuário real |
| **E-mail de SAÍDA** (resposta ao cliente) | interação "Resposta SAC" dispara e-mail ao contato do cliente (com anexo) | 2 | contato do cliente salvo no chamado |
| **E-mail de ENTRADA** (cliente manda direto) | e-mail do cliente cria/atualiza o chamado | 3 (opcional) | threading + dedupe + anti-loop + **solicitante externo** (§5) |

**Barato agora pra não doer depois — a Fase 1 já deve prever 2-3 campos** que deixam o e-mail virar
um "plug-in de canal" sem refazer o núcleo:
1. **Contato do cliente** (e-mail/telefone) → habilita o e-mail de **saída**.
2. **Canal/origem** do SAC (balcão / telefone / e-mail) → rastreia como entrou.
3. **Token de threading** no assunto (`[SAC-123]`) → pré-condição pro e-mail de **entrada** casar a resposta no chamado certo.

> Conclusão: começar pelo colaborador é o MVP barato e de baixo risco; o e-mail (saída → entrada)
> entra como **canais adicionais** no roadmap, **não cortado**.

---

## 7. Outros pontos a considerar

- **LGPD** — reclamação de cliente é dado pessoal: retenção, quem acessou, finalidade.
- **Privacidade entre filiais** — o modelo "em cópia por chamado" já garante; "equipe vê tudo" não.
- **Categorização/relatórios de SAC** (reclamação/dúvida/elogio, por filial/produto) + **SLA de 1ª resposta** (métrica típica de SAC).
- **Templates de resposta** (respostas-padrão) — nice-to-have.

---

## 8. Veredito de viabilidade + fases sugeridas

- **Núcleo** (workspace SAC + entrada via colaborador + apoiadores em cópia + visibilidade por chamado + campos do cliente): **viável e barato** — reaproveita o Chamado, ajustes pontuais (a cláusula `copias` no `findAll` + 2-3 campos SAC). O reenquadramento de 20/06 (§5) **tira o "cliente externo" do caminho crítico**.
- **E-mail in/out**: deixa de ser o que "viabiliza" o SAC e vira **canal adicional** (§6.1). Saída (Fase 2) é leve; entrada que cria chamado sozinho (Fase 3, opcional) é a única que reintroduz o **solicitante externo**.

**Fases sugeridas (revisadas 20/06):**
1. **Núcleo:** workspace SAC + entrada via **colaborador** + **campos do cliente/canal/token** (§6.1) + visibilidade (em cópia + rosters + equipe restrita) + **fix da listagem `copias`** (§6).
2. **Saída por e-mail** (interação "Resposta SAC" ao contato do cliente, com anexo).
3. **Entrada por e-mail** (IMAP/webhook + dedupe + anti-loop + threading + **solicitante externo**) — opcional.
4. **Relatórios/templates/SLA de SAC.**

---

## 9. Desenho consolidado — controle de acesso em 5 camadas (20/06)

Síntese das decisões acima + os dois complementos do Clenio, reverificados no código.
**Cada camada resolve um problema distinto; elas se somam, não competem.**

| # | Camada | Mecanismo | Resolve |
|---|--------|-----------|---------|
| 1 | **Workspace SAC** (departamento) | responsável + operadores = staff do depto | fila central do SAC, multi-filial (`filialId` marca a origem) |
| 2 | **Equipe SAC `restritaVisibilidade`** | flag de equipe (18/06) | **isola a fila do SAC** do resto do Gestão TI (só operadores + gestor veem) |
| 3 | **Rosters por departamento** (equipes curadas pelos líderes) | membros de equipe = catálogo | **governança:** só quem o líder de setor indicou pode ser puxado |
| 4 | **Em cópia** (por chamado) | `ChamadoCopia` (já existe) | apoiador puxado vê/interage **só naquele SAC** (somente não-T.I.) |
| 5 | **Fix do `findAll`** | cláusula `copias` no OR | o SAC em cópia **aparece na listagem** do apoiador (gap §6) |

**Fluxo resultante:** o líder de cada setor cura sua equipe (camada 3) → o operador do SAC,
ao precisar de apoio, só consegue puxar (em cópia) alguém dessas listas (camada 4) → o apoiador
passa a ver/interagir **apenas naquele SAC** (camadas 4 + 5), e a fila central permanece isolada
do resto do Gestão TI (camada 2). Governança descentralizada + isolamento + controle por-chamado.

**Regra de ouro (não vazar):** as equipes-catálogo da camada 3 **nunca** podem ser alvo de
roteamento (`equipeAtualId`) de um SAC — senão a visibilidade vira "fila inteira da equipe"
(camada 2/equipe), o oposto do desejado. Elas existem só para popular o seletor de cópia.

**Trabalho de código do núcleo (Fase 1), em ordem:**
1. **Workspace SAC** + **entrada via colaborador** (solicitante = usuário real) + **campos do cliente** (contato), **canal/origem** e **token `[SAC-123]`** (§6.1) — camada 1, sem identidade externa.
2. **`findAll`:** adicionar `{ copias: { some: { usuarioId } } }` ao OR de visibilidade (camada 5).
3. **Seletor de cópia do SAC** restrito aos rosters (camada 3) + **guard "roster não é roteável"** (regra de ouro).
4. Equipe SAC marcada `restritaVisibilidade` (camada 2 — só configuração, já existe no código).

> O núcleo (Fase 1) é **barato** — reaproveita o Chamado, sem identidade externa. O peso real fica no
> **e-mail (Fases 2-3, §6.1)**; e o único ajuste estrutural de visibilidade é a cláusula da cópia no `findAll`.

---

> Referências de código: `gestao-ti/backend/src/chamado/services/chamado-core.service.ts` (visibilidade/findAll),
> `chamado-helpers.service.ts` (regra em cópia ≠ colaborador), `chamado-colaborador.service.ts` (T.I.-only),
> `email/email-envolvidos.service.ts` (notificação interna existente).
