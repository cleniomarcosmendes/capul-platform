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

## Fiscal

### ⏳ 2026-04-20 — Drop da coluna global `integracoes_api.ambiente`

**Contexto:** Passo 11 do plano per-endpoint/modulo (v2). Depois do refactor,
a coluna ficou "morta-viva" — ainda existe no banco mas nenhum código de
produção lê mais dela para routing. UI removeu o campo do `UpdateIntegracaoDto`.

**Por que adiado:** DDL (`DROP COLUMN`) num banco com 3 backends ativos é
uma ação irreversível. Boa prática é observar 1-2 dias de uso real da nova
UI e dos 3 resolvers (Fiscal, Gestão TI, Inventário) antes de remover, pra
garantir que nada escapou da varredura inicial.

**Quando retomar:** Se nada quebrar até 22-23/04/2026, criar migration
`20260423000000_drop_ambiente_global/migration.sql` com:
```sql
ALTER TABLE core.integracoes_api DROP COLUMN ambiente;
```
Rollback trivial: reverter a migration anterior restaura coluna + dados.

**Arquivos afetados quando for fazer:**
- `auth-gateway/prisma/migrations/` (novo diretório)
- `auth-gateway/prisma/schema.prisma` (remove `ambiente` do model `IntegracaoApi`)
- `configurador/src/layouts/Header.tsx` (ver item abaixo — provavelmente
  quebra o badge stale, já fica oportuno)

---

### ⏳ 2026-04-20 — Header do Configurador derivar ambiente dos endpoints

**Contexto:** `configurador/src/layouts/Header.tsx` ainda lê
`protheus.ambiente` (a coluna global) para mostrar o badge "API-HLG" ou
"API-PRD". Depois do refactor per-endpoint, essa flag ficou stale — não
reflete mais a realidade quando há ambientes mistos entre os módulos.

**Por que adiado:** Não bloqueia funcionalidade — é só um badge informativo.
Apagar agora deixaria o cabeçalho sem indicador nenhum, o que é pior.

**Quando retomar:** Junto com o drop da coluna (item acima). Alternativas:
1. Remover o badge de vez.
2. Derivar do primeiro módulo (se todos iguais, mostra o valor; se mistos,
   mostra "MIXED"). Mesmo algoritmo do `ambienteDoModulo` já usado na
   página de integrações.
3. Mostrar um badge por módulo (FIS-HLG, TI-PRD, INV-PRD) — mais denso mas
   mais informativo.

**Arquivos:** `configurador/src/layouts/Header.tsx`,
`configurador/src/services/integracao.service.ts` (se precisar de helper).

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

## Histórico (feitos)

*(vazio — quando um item for concluído, mover para cá com a data da conclusão
e um breve resumo do que foi feito)*

---

## Meta

- **Criado em:** 2026-04-20
- **Dono:** Clenio (decide prioridade) + Claude (proativo em sugerir)
- **Revisão recomendada:** no início de cada sessão, ou antes de grandes
  mudanças no módulo correspondente.
