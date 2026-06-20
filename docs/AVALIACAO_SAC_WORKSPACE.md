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

## 5. O ponto mais importante NÃO considerado 🔑 — o cliente não é usuário do sistema

- O Chamado hoje assume **`solicitante = usuário do core`** (login interno). No SAC, o solicitante é um **cliente EXTERNO** (e-mail/nome, sem login). Sem um conceito de **"solicitante externo"**, não há como atribuir, responder, nem manter histórico por cliente. **É a maior mudança estrutural.**
- Lado bom: o cliente **não precisa de acesso ao sistema** — o "portal" dele é o **e-mail**. Simplifica (sem login de cliente), mas exige modelar o solicitante externo.

---

## 6. O que falta de verdade (e-mail) + ponto técnico

- **Entrada (inbound)** — NÃO existe. Serviço lê a caixa do SAC (IMAP) ou recebe via webhook → cria o chamado → atribui ao responsável. **Pontos críticos:** dedupe (não duplicar do mesmo e-mail), **threading** (resposta do cliente = nova interação no MESMO chamado, via `Message-ID`/`In-Reply-To` ou token no assunto `[SAC-123]`), **anti-loop** (auto-resposta/out-of-office), spam/anexo.
- **Saída (resposta ao cliente)** — NÃO existe como e-mail externo. Precisa de uma **interação tipo "Resposta SAC"**: externa/pública, dispara e-mail ao cliente (com **anexo**), mantém threading.
- **Ponto técnico ✅ CONFIRMADO (20/06) — é um GAP real:** "em cópia" garante acesso no **detalhe** (`chamado-core.service.ts` findOne, ~L603 `isCopiado`), mas no **`findAll` (listagem) NÃO existe cláusula para `copias`** (o OR de visibilidade, ~L472-478, só tem solicitante/técnico/colaborador/`equipeAtualId`/depto-staff). Logo, o SAC em cópia **não aparece na lista** do apoiador — só por link direto. **Ajuste necessário na Fase 1:** adicionar `{ copias: { some: { usuarioId: user.sub } } }` ao OR do `findAll`.
- **Regra de elegibilidade da cópia ✅ CONFIRMADA (20/06):** `adicionarCopias` chama `assertNaoSeTI` (~L826) → **só usuários NÃO-T.I.** entram em cópia. Bom para o SAC (apoiadores são de outros setores). Limite: apoiador que seja staff de T.I. não entra por cópia (usaria Colaborador, T.I.-only).

---

## 7. Outros pontos a considerar

- **LGPD** — reclamação de cliente é dado pessoal: retenção, quem acessou, finalidade.
- **Privacidade entre filiais** — o modelo "em cópia por chamado" já garante; "equipe vê tudo" não.
- **Categorização/relatórios de SAC** (reclamação/dúvida/elogio, por filial/produto) + **SLA de 1ª resposta** (métrica típica de SAC).
- **Templates de resposta** (respostas-padrão) — nice-to-have.

---

## 8. Veredito de viabilidade + fases sugeridas

- **Núcleo** (SAC como workspace + apoiadores em cópia + visibilidade por chamado): **viável**, encaixa bem — com a correção de usar **Em cópia**, não "equipe".
- **E-mail in/out + solicitante externo**: é o **trabalho de verdade** (porte médio-alto) — é o que transforma o Chamado interno num SAC externo.

**Fases sugeridas:**
1. **Modelo de cliente externo** (solicitante sem login) + workspace SAC + regra de visibilidade por cópia (+ ajuste da listagem do §6).
2. **Saída por e-mail** (resposta ao cliente com anexo + threading).
3. **Entrada por e-mail** (IMAP/webhook + dedupe + anti-loop + threading).
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
1. **Cliente externo** (solicitante sem login) + **workspace SAC** (camada 1).
2. **`findAll`:** adicionar `{ copias: { some: { usuarioId } } }` ao OR de visibilidade (camada 5).
3. **Seletor de cópia do SAC** restrito aos rosters (camada 3) + **guard "roster não é roteável"** (regra de ouro).
4. Equipe SAC marcada `restritaVisibilidade` (camada 2 — só configuração, já existe no código).

> O peso real do projeto continua sendo **cliente externo + e-mail (Fases 2-3)**, não a
> visibilidade — o único ajuste estrutural de visibilidade é a cláusula da cópia no `findAll`.

---

> Referências de código: `gestao-ti/backend/src/chamado/services/chamado-core.service.ts` (visibilidade/findAll),
> `chamado-helpers.service.ts` (regra em cópia ≠ colaborador), `chamado-colaborador.service.ts` (T.I.-only),
> `email/email-envolvidos.service.ts` (notificação interna existente).
