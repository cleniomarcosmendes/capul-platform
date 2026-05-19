# Plano — Acesso a Dado de Sócio (PII) via Capability por Usuário

**Versão:** 1.0 (rascunho para revisão)
**Data:** 19/05/2026
**Status:** 🟡 PLANEJAMENTO — nada implementado · deploy prorrogado por decisão do Clenio
**Sensibilidade:** ALTA — PII de pessoa física, escopo LGPD

> Decisão Clenio 19/05: acesso a sócio não deve ser por papel (mesmo
> ANALISTA_CADASTRO é amplo demais). Vira **capability explícita por
> usuário**. Sem pressa — planejar com calma, deploy pode esperar.

---

## 1. Problema / Contexto LGPD

A "Busca por Sócio" e o QSA dentro da Consulta Cadastral local expõem
**PII de pessoa física**: nome do sócio, vínculos societários (em quais
empresas é sócio), qualificação, faixa etária. Origem: base pública RFB
(Dados Abertos) — pública na origem, mas o **cruzamento + busca reversa
em massa** sobre 27,6M de sócios é tratamento de dado pessoal que pede
governança: **minimização**, **necessidade de conhecer** (need-to-know),
**autorização explícita e rastreável**.

Controle por papel (qualquer ANALISTA_CADASTRO/GESTOR_FISCAL vê) é amplo
demais para esse dado. Objetivo: só usuários **nominalmente autorizados**
acessam, com trilha de quem autorizou e (idealmente) quem consultou.

## 2. Superfície afetada (o que a capability deve proteger)

| Item | Onde | Hoje |
|---|---|---|
| Tela "Busca por Sócio" | `/rfb/socios` (`BuscaSocioPage`) | ANALISTA_CADASTRO+ |
| Endpoint busca reversa | `GET /rfb/socios/busca` | ANALISTA_CADASTRO+ |
| QSA (lista de sócios) na Consulta Cadastral local | `POST /cadastro/consulta-local` → `RfbConsultaService.porCnpj` (bloco sócios) | herda acesso da Consulta Cadastral |
| Item de menu "Busca por Sócio" | Sidebar | ANALISTA_CADASTRO+ |

**Decisão a confirmar (D1):** a capability cobre **só a Busca por Sócio**
ou **também o QSA** dentro da Consulta Cadastral local? (Recomendação:
ambos — é o mesmo dado pessoal; senão fica brecha pelo QSA.)

## 3. Modelo proposto (recomendado)

**Capability nomeada por usuário, independente do papel**, ex.:
`FISCAL_CONSULTA_SOCIOS`.

- **Não** é um papel novo nem um nível na hierarquia (papel = o que a
  pessoa faz; capability = autorização pontual a dado sensível).
- Concedida **por usuário** no **Configurador** (coerente com a regra
  "funcionalidade sensível tem tela no Configurador" — nada de flag
  escondida). Tela mostra: quem tem, quem concedeu, quando, motivo.
- Enforcement em **3 camadas** (defesa em profundidade, padrão do
  projeto): guard backend nos endpoints (socios/busca + consulta-local
  filtrando QSA) · ProtectedRoute/condicional frontend · item de menu.
- **Trilha de auditoria** (LGPD): registrar concessão/revogação (quem,
  quando, motivo) e — decisão a confirmar (D4) — log de acesso (quem
  consultou qual termo/CNPJ e quando).

**Decisões a confirmar:**
- **D2 — Modelo:** liga/desliga simples por usuário (recomendado p/ v1)
  vs granular (por filial / por período / com justificativa por acesso).
  Recomendação: v1 liga/desliga + auditoria de concessão; granularidade
  fica como evolução se o setor exigir.
- **D3 — Transporte:** hoje o papel do módulo FISCAL chega no JWT via
  `usuario.modulos[].role`. A capability precisa chegar ao backend de
  forma confiável. Opções: (a) embutir no JWT (`modulos[].capabilities`)
  — exige mudança no Auth Gateway + refresh de token ao conceder;
  (b) backend Fiscal consulta `core` (read-only) a cada request/cacheado
  — sem mexer no token, custo de I/O. Recomendação: (b) com cache curto
  (padrão já usado p/ destinatários de alerta), evita acoplar Auth.
- **D4 — Auditoria de acesso:** registrar cada consulta de sócio
  (quem/termo/quando) ou só a concessão da capability? Recomendação
  mínima LGPD: concessão sempre; acesso = recomendado (defensável em
  fiscalização), avaliar volume.
- **D5 — Quem concede:** ADMIN do Configurador? Gestor Fiscal? DPO?
  (Recomendação: ADMIN Configurador, com motivo obrigatório.)
- **D6 — Estado interino até a capability existir:** Busca por Sócio
  fica em ANALISTA_CADASTRO (atual) ou sobe p/ GESTOR_FISCAL nesse
  meio-tempo? (Clenio não escolheu interino — quer a opção 2 inteira;
  como deploy está prorrogado, pode ficar como está até lá.)

## 4. Implementação faseada (incremental, verificável)

> Só inicia após D1–D6 fechadas com o Clenio. Cada fase: build + verifica
> DEV + commit por escopo. Sem push (Clenio).

- **F1 — Modelo + Configurador (concessão):** persistência da capability
  por usuário (tabela/coluna em `core` — definir em D3) + tela no
  Configurador p/ conceder/revogar com motivo + auditoria de concessão.
- **F2 — Enforcement backend:** guard em `GET /rfb/socios/busca` e
  filtragem do bloco QSA em `consulta-local`/`porCnpj`; nega sem a
  capability (independe do papel). Testes.
- **F3 — Enforcement frontend:** esconder menu "Busca por Sócio" + rota
  + ocultar sub-tabela QSA na Consulta Cadastral p/ quem não tem.
- **F4 — (se D4=sim) Auditoria de acesso:** log de consulta de sócio.
- **F5 — Doc + roteiro:** atualizar este plano p/ "implementado",
  documentar no manual/Configurador, e SÓ ENTÃO entrar no fluxo de
  deploy (com os gates: check-migrations-all.sh + /security-review).

## 5. Fora de escopo / não fazer

- Não mexer no acesso de Inteligência Cadastral e Base RFB — Empresas
  (dado de empresa; seguem ANALISTA_CADASTRO; export CSV já restrito a
  GESTOR_FISCAL+ por LGPD, commit `f8592d9`).
- Não criar papel novo na hierarquia Fiscal.
- Não implementar nada antes do alinhamento de D1–D6.

## 6. Próximo passo

Clenio revisa este rascunho **com calma** e responde D1–D6 (ou marca
reunião com setor fiscal/DPO se quiser validar a política antes). Só
depois eu detalho a F1 e começo. Deploy permanece prorrogado até o
módulo estar com a governança de sócio fechada.
