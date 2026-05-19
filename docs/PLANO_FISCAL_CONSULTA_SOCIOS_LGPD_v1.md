# Plano — Acesso a Dado de Sócio (PII) via Capability por Usuário

**Versão:** 1.2 (IMPLEMENTADO — F1→F5)
**Data:** 19/05/2026
**Status:** ✅ IMPLEMENTADO e verificado E2E em DEV · ⚠️ deploy PRORROGADO (gates pendentes)
**Sensibilidade:** ALTA — PII de pessoa física, escopo LGPD

> Decisão Clenio 19/05: acesso a sócio não por papel → capability
> explícita por usuário. Sem pressa, deploy podia esperar. Feito.

---

## 1. Contexto LGPD

"Busca por Sócio" e o QSA da Consulta Cadastral local expõem PII de
pessoa física (nome, vínculos, qualificação, faixa etária) sobre 27,6M
de sócios. Controle por papel era amplo demais → **capability nominal
por usuário**, com autorização e acesso rastreáveis (minimização +
need-to-know).

## 2. Decisões (Clenio 19/05) — fechadas

D1 **ambos** (Busca por Sócio + QSA) · D2 **liga/desliga por usuário** ·
D3 **backend lê core cacheado** (sem mexer no JWT) · D4 **audita
concessão E acesso** · D5 **só ADMIN concede** · D6 **sem interino**
(implementar primeiro; deploy prorrogado).

## 3. As-built (o que ficou)

**Capability:** `FISCAL_CONSULTA_SOCIOS`, por usuário, independente do papel.

| Fase | Commit | Entregue |
|---|---|---|
| Plano v1.0 / v1.1 | `46b62c7` / `13482b6` | Spec + design aterrado |
| **F1** auth-gateway | `fcbf668` | `core.usuario_capability` (migration idemp. via auth-migrate) + `CapabilityService` (conceder/revogar/listar, upsert idemp., linha preservada na revogação = auditoria de concessão) + DTO whitelist + motivo obrigatório. Endpoints `/usuarios/:id/capabilities` sob `ConfiguradorAdminGuard` (só ADMIN). |
| **F2** configurador | `984c76e` | Card "Dados sensíveis (LGPD)" na aba Permissões do usuário (só ADMIN, usuário existente): conceder com motivo / revogar (ConfirmDialog) / estado + concedidoEm + motivo. |
| **F3** fiscal backend | `1631944` | `SocioCapabilityService` (lê `core.usuario_capability` mirror read-only, cache por usuário TTL 5min). Enforce: `GET /rfb/socios/busca` → 403 sem cap (independe do papel); QSA da `consulta-local` omitido (`sociosRestrito=true`) sem cap; demais dados de empresa seguem OPERADOR_ENTRADA+. `GET /rfb/socios/capability` (sinalização UI). Migration `fiscal.socio_acesso_log` (D4 — auditoria de ACESSO, append). |
| **F4** fiscal frontend | `a5de64f` | AuthContext busca capability 1×/sessão (`socioPermitido`). Sidebar esconde "Busca por Sócio"; rota `/rfb/socios` bloqueada; Consulta Cadastral mostra aviso LGPD no lugar do QSA quando restrito. |
| **F5** doc | (este) | Plano → as-built; notas operacionais; gates de deploy. |

**Verificação E2E (DEV):** F1 ciclo conceder/idemp./revogar + auditoria
preservada; F3 conceder→200+log, revogar+restart→**403 mesmo ADMIN_TI**,
`socios/capability` true/false; builds limpos; migrations aplicadas.

## 4. Operação / notas

- **Conceder:** Configurador → Usuários → (usuário) → aba **Permissões**
  → card **"Dados sensíveis (LGPD)"** → motivo obrigatório → Conceder.
  Só **ADMIN** do Configurador. Revogar idem (linha fica p/ auditoria).
- **Cache 5min (trade-off conhecido):** ao revogar, o acesso pode
  persistir até ~5min (TTL do `SocioCapabilityService`). Aceito p/ v1.
  Se exigir revogação imediata → invalidar cache no revogar (evolução).
- **Auditoria:** concessão/revogação = `core.usuario_capability`
  (`concedido_por/em`, `revogado_por/em`, `motivo`). Acesso =
  `fiscal.socio_acesso_log` (usuário, escopo BUSCA_SOCIO/QSA, termo,
  qtd, timestamp). Definir retenção + quem lê (ADMIN/DPO) se o setor
  formalizar.
- **Migrations novas:** `core.usuario_capability` (auth-gateway,
  `20260519160000`) + `fiscal.socio_acesso_log` (fiscal,
  `20260519180000`). Mirror `UsuarioCapabilityCore` no Fiscal é
  read-only (sem migration fiscal — auth-gateway é dono).

## 5. ⚠️ Gates de deploy (NÃO gerar roteiro sem ordem do Clenio)

Deploy **prorrogado**. Quando o Clenio mandar gerar o roteiro:
1. `check-migrations-all.sh` (convenção pós-incidente 28/04)
2. **`/security-review` da branch** (gate fixo 19/05) — crítico/alto →
   PARAR antes do roteiro
3. Só então gerar o roteiro (2 docs / template versionado)

Branch `integra/fiscal+atividades`, **não pushada** (controle Clenio).

## 6. Fora de escopo / evoluções possíveis

- Inteligência Cadastral / Base RFB Empresas: seguem ANALISTA_CADASTRO
  (dado de empresa); export CSV restrito a GESTOR_FISCAL+ (`f8592d9`).
- Evoluções: invalidar cache no revogar; granularidade (filial/período/
  justificativa por acesso, D2 dispensou em v1); tela de leitura do
  `socio_acesso_log` p/ DPO; capability genérica reusável p/ outros
  dados sensíveis futuros.
