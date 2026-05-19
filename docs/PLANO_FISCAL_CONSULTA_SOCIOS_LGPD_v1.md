# Plano — Acesso a Dado de Sócio (PII) via Capability por Usuário

**Versão:** 1.1 (decisões fechadas — pronto para implementar)
**Data:** 19/05/2026
**Status:** 🟢 SPEC CONGELADA · implementação faseada · deploy prorrogado
**Sensibilidade:** ALTA — PII de pessoa física, escopo LGPD

---

## 1. Contexto LGPD

"Busca por Sócio" e o QSA da Consulta Cadastral local expõem **PII de
pessoa física** (nome, vínculos societários, qualificação, faixa etária)
sobre 27,6M de sócios. Controle por papel é amplo demais. Objetivo:
só usuários **nominalmente autorizados** acessam, com **autorização e
acesso rastreáveis** (minimização + need-to-know).

## 2. Decisões fechadas (Clenio 19/05)

| # | Decisão | Resposta |
|---|---|---|
| **D1** | Escopo | **Ambos** — Busca por Sócio **e** QSA da Consulta Cadastral local |
| **D2** | Modelo | **Liga/desliga por usuário** (v1, sem granularidade) |
| **D3** | Transporte | **Backend Fiscal lê `core` cacheado** (não mexe no JWT/Auth) |
| **D4** | Auditoria | **Ambos** — concessão/revogação **e** cada acesso/consulta |
| **D5** | Quem concede | **ADMIN** (Configurador) |
| **D6** | Interino | **Sem interino** — implementar a capability primeiro; Busca por Sócio segue ANALISTA_CADASTRO até lá; deploy prorrogado |

## 3. Design técnico (aterrado no código real)

Capability nomeada **`FISCAL_CONSULTA_SOCIOS`**, por usuário, independente
do papel.

**Fronteira de módulo (crítico):**
- `core` é owned pelo **auth-gateway**. Fiscal lê `core` **read-only,
  cacheado** (espelha `alertas/destinatarios.resolver.ts`, TTL 5min).
- **Concessão + auditoria de concessão** → vivem em `core` (auth-gateway
  escreve; gerido no Configurador).
- **Auditoria de acesso** (cada consulta de sócio) → vive em `fiscal`
  (Fiscal escreve no próprio schema; **não pode** escrever em core).

**Schema (core, via migration auth-gateway):**
- `core.usuario_capability` — `id, usuario_id (FK), capability (text),
  ativo (bool), concedido_por (FK usuario), concedido_em, motivo (text),
  revogado_por, revogado_em`. UNIQUE(usuario_id, capability).
  (Auditoria de concessão = as próprias colunas + linha mantida em
  revogação com `ativo=false` + revogado_*; histórico append-only se o
  setor exigir vira tabela `usuario_capability_log` — avaliar na F1.)

**Schema (fiscal, via migration fiscal):**
- `fiscal.socio_acesso_log` — `id, usuario_id, usuario_email, escopo
  ('BUSCA_SOCIO'|'QSA'), termo (text, ex.: nome buscado ou CNPJ),
  resultado_qtd (int), em (timestamp)`. Append-only, retenção a definir.

**Enforcement (3 camadas, defesa em profundidade):**
- Backend Fiscal: `SocioCapabilityService` (lê `core.usuario_capability`
  cacheado por usuário). Guard em `GET /rfb/socios/busca` e no bloco QSA
  de `RfbConsultaService.porCnpj` (consulta-local) → 403 / QSA omitido
  sem a capability, **independente do papel**. Toda passagem grava
  `fiscal.socio_acesso_log`.
- Frontend Fiscal: esconde menu "Busca por Sócio" + rota + oculta
  sub-tabela QSA na Consulta Cadastral p/ quem não tem.
- Concessão: só **ADMIN** no Configurador (motivo obrigatório).

**Como o frontend/back sabem da capability:** endpoint Fiscal leve
`GET /rfb/socios/capability` (lê core cacheado p/ o usuário do JWT) →
o front usa pra decidir menu/tela; o back enforce de verdade nos
endpoints sensíveis. (Não embute no JWT — D3.)

## 4. Fases (incremental, build+verifica+commit por fase, sem push)

- **F1 — Core: modelo + concessão + auditoria de concessão**
  auth-gateway: migration `core.usuario_capability` + model Prisma +
  service/controller (conceder/revogar/listar, **só ADMIN**, motivo
  obrigatório) + DTO. Reusa o init job `auth-migrate`.
- **F2 — Configurador: UI de concessão**
  Tela (na gestão de permissões do usuário) p/ ADMIN ligar/desligar
  `FISCAL_CONSULTA_SOCIOS` com motivo; lista quem tem + quem concedeu/quando.
- **F3 — Fiscal backend: enforcement + auditoria de acesso**
  `SocioCapabilityService` (core cacheado) + guard em `/rfb/socios/busca`
  e QSA de `porCnpj` + migration `fiscal.socio_acesso_log` + gravação +
  `GET /rfb/socios/capability`.
- **F4 — Fiscal frontend: gating**
  Esconde menu/rota "Busca por Sócio" + sub-tabela QSA conforme capability.
- **F5 — Doc + gates de deploy**
  Atualizar este plano p/ "implementado"; manual/Configurador; SÓ ENTÃO
  fluxo de deploy com gates (check-migrations-all.sh + /security-review).

## 5. Fora de escopo

- Inteligência Cadastral / Base RFB Empresas: seguem ANALISTA_CADASTRO
  (dado de empresa); export CSV já restrito a GESTOR_FISCAL+ (`f8592d9`).
- Sem papel novo na hierarquia. Sem mexer no JWT/Auth (D3).
- Sem medida interina (D6) — Busca por Sócio segue como está até F4.

## 6. Riscos / atenção

- `core` é do auth-gateway: F1 e F2 mexem em auth-gateway/Configurador
  (não só Fiscal). Migration core via `auth-migrate`.
- Cache de 5min: ao revogar, acesso pode persistir até 5min — aceitável
  p/ v1 (documentar); se o setor exigir revogação imediata, invalidar
  cache no revogar (evolução).
- LGPD: `socio_acesso_log` é log de acesso a PII — definir retenção e
  quem pode lê-lo (provável ADMIN/DPO) na F3.
