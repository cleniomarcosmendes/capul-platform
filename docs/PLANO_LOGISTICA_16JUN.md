# Plano de Execução — Logística (16/06/2026) — v2 (revisado c/ observações do Clenio)

Revisão após o Clenio revisar a v1. Mudanças relevantes marcadas com 🔄. Decisões
pendentes (precisam de OK antes de codar) marcadas com ❓.

Branch: `feat/logistica-frota` (= `main`, já pushada até `11ee5ed`).
Dados DEV: `clenio`/`123456` (ADMIN/PADRAO), `entregador_teste`/`entrega123` (ENTREGADOR/INDIVIDUAL),
`frota_teste`/`123456` (INDIVIDUAL, OPERADOR_ENTREGA, filial c/ veículos — testa saída sem senha).

## Progresso (16/06)
- ✅ **FASE 1** (saída PADRAO×INDIVIDUAL, msg veículo, busca/depto, olhinho) — testado pelo Clenio.
- ✅ **FASE 1b** (filtro Pendentes/Entregues/Todas no app de entrega).
- ✅ **Sair do app** (botão no corpo do lançador — header engolia o toque).
- ✅ **FASE 2** (olhinho global — faltavam Chamado PADRAO + Frota web; PasswordInput reutilizável).
- ✅ **FASE 3** (matrícula com/sem 'E' — inputs liberados; backend já normalizava).
- ✅ **Ajustes pós-teste**: removido "Sair" do header (só o do corpo do lançador); KM sugerido/
  atualizado ao escolher veículo (app + desktop).
- ✅ **FASE 7a** (veículo próprio/alugado — enum+migration+form). Migration via diff+deploy
  (ver `[[feedback_logistica_migrate_dev_reseta]]`).
- ✅ **FASE 7b** (tipos de despesa) — JÁ EXISTIA: aba "Tipos" na DespesasPage (criar/listar/ativar).
- ✅ **FASE 4** (credencial por sessão no cadastro de entrega): role `REGISTRADOR_ENTREGA`;
  PADRAO identifica operador por matrícula+senha 1x/sessão (cache em memória + "trocar
  operador"); INDIVIDUAL usa o próprio; grava registradoPorMatricula/Nome. Migration
  `20260616130000`. Usuário de teste `caixa_teste`/`123456` (PADRAO+REGISTRADOR_ENTREGA).
- ✅ **FASE 7c** (fornecedor da despesa): decidido **cadastro PRÓPRIO da logística**
  (`FornecedorDespesa`, postos/borracharias) em vez do FornecedorConfig de TI (domínio errado).
  Backend (CRUD + migration `20260616140000` + seed "NÃO DEFINIDO") + web (aba Fornecedores +
  select no lançamento) + app (chips). Centralizar fornecedor (core + tag de módulo) → backlog.
- ⏳ Próximas: 5 (navegação/validação cupom-valor) → 6 (revamp Frota).
- ⏳ Refinamento aberto: nav do frontend web ainda não esconde links não-entrega p/
  REGISTRADOR_ENTREGA (backend já bloqueia por RBAC).

---

## FASE 1 — APP: Saída de Veículo (revisado) ⏳
Arquivo: `logistica/app/src/screens/SaidaFrotaScreen.tsx`.

1. 🔄 **Veículo "sumido" era falso alarme** — na verdade NÃO havia veículo disponível e o
   texto informativo passou despercebido. **Não reordenar nada.** Ação: **deixar a mensagem
   de indisponibilidade bem clara/visível** (hoje: "Nenhum veículo disponível na filial."
   discreto). Tornar destacada e orientativa.
2. 🔄 **Saída condicionada ao TIPO do usuário (PADRAO × INDIVIDUAL)** — o JWT já carrega
   `tipo` (enum `TipoUsuario`: INDIVIDUAL | PADRAO).
   - **INDIVIDUAL**: NÃO pede matrícula+senha (já autenticado no login). Usa a **matrícula
     do próprio usuário** como condutor → `core.usuarios.matricula` (campo já existe,
     `@unique`). Garantir que esteja preenchida p/ quem opera frota.
   - **PADRAO** (ex.: terminal compartilhado): pede **matrícula + senha do portal RH**
     (fluxo atual).
   - Revisar `podeRegistrar` para o caminho INDIVIDUAL (sem `credOk`).
3. 🔄 **Lista de veículos por departamento de lotação + busca por placa** — `Veiculo` tem
   `departamentoLotacaoId`. Default: listar os veículos do **depto do usuário/colaborador**;
   adicionar **campo de busca por placa/chave** para achar outros.
4. **Botão "Sair"**: revalidar em todas as telas (Home, FrotaHome, MinhasViagens, Saída,
   ViagemFrota). [Fix do AuthContext já feito; só validar.]
5. **Olhinho na senha** (só no caminho PADRAO, onde o campo senha existe) — Saída/ViagemFrota.

## FASE 1b — APP: Entregas com filtro de status 🔄 (novo) ⏳
Arquivo: `logistica/app/src/screens/MinhasViagensScreen.tsx`.
- Filtro/abas: **Pendentes** (default — o que falta entregar na rua), **Entregues**, **Todas**.
- Conforme o entregador dá baixa, a lista de Pendentes some o item; a aba Entregues mantém
  o histórico do dia. (O endpoint `/viagens/minhas` já aceita `situacao` — confirmar/usar.)

## FASE 2 — Olhinho (mostrar senha) em TODO o sistema 🔎
Componente reutilizável por frontend. Pontos mapeados (`type=password`/`secureTextEntry`):
`gestao-ti .../ChamadoCreatePage.tsx`, `logistica/frontend .../FrotaPage.tsx`,
`logistica/app .../LoginScreen.tsx` (✅), `ViagemFrotaScreen.tsx`, `SaidaFrotaScreen.tsx`.
Varrer ainda: login do **Hub**, **Configurador**, **Fiscal**, **Inventário** (login + troca de senha).

## FASE 3 — Matrícula com/sem 'E' (E01047 == 001047) 🔎
Normalizar via `toChapaPortal` (já em `gestao-ti .../protheus.service.ts:67` e
`logistica .../protheus/protheus-condutor.service.ts:32`) em TODOS os pontos de matrícula+
senha do portal RH. Frontend aceita os dois formatos. Aplicar em: entrega, frota (web+app)
e **Workspace "abrir chamado"**. (Reusa também na matrícula do usuário INDIVIDUAL da Fase 1.)

## FASE 4 — Identificação do colaborador (PADRAO×INDIVIDUAL) no cadastro de entrega ⏳ (feature)
Conceito (esclarecido pelo Clenio): **PADRAO = login genérico/compartilhado** (ex.: o caixa).
Ele entra com a senha do próprio usuário PADRAO, mas por ser genérico, **na ação que precisa
identificar a pessoa** o sistema pede **matrícula + senha do colaborador** (igual ao Chamado).
**INDIVIDUAL** já é a pessoa → não pede (usa a matrícula do próprio login).
Aplicar essa identificação em DOIS pontos: **cadastro de ENTREGA** (esta fase) e **registro de
SAÍDA DE VEÍCULO** (Fase 1).
- **PADRAO**: pede matrícula+senha do portal RH **1x por sessão** (cache em memória, NÃO
  persistir senha) + botão **"trocar operador"** + expiração por inatividade + limpa no
  logout/fechar aba. Revalida no backend ao criar/alterar a entrega.
- **INDIVIDUAL**: não pede (usa `core.usuarios.matricula` do login).
- Reusa o conceito do **Chamado PADRAO** (`loginPortal`, resposta 200 `{valida,motivo}`).
- Tela: `logistica/frontend .../EntregaNovaPage.tsx`.
- ❓🔄 **ROLE restrito p/ o caixa**: o usuário PADRAO do caixa deve ter um role que **só**
  permite **incluir e alterar entrega** (não ver frota/painel/comprovantes). Hoje os roles
  da logística são OPERADOR_ENTREGA / GESTOR_ENTREGA / GESTOR_FROTA / ENTREGADOR / ADMIN.
  Proposta: criar `REGISTRADOR_ENTREGA` (ou nome a definir) limitado a POST/PATCH de entrega
  na própria filial. Ajustar `@Roles` dos endpoints de entrega + matriz de permissões no
  Configurador.

## FASE 5 — Padronização de navegação + validação (logística) ⏳
- **ENTER/TAB** consistente em todos os formulários do módulo (Enter avança/foca próximo;
  Enter no submit confirma).
- **Cupom + Valor** (`EntregaNovaPage`): Enter só adiciona nova linha se cupom + valor do
  item atual estiverem válidos; senão foca o campo faltante.

## FASE 6 — Revamp de usabilidade da FROTA 🎨 (maior, incremental)
Usuário de **baixa habilidade** → simplicidade. Elevar ao padrão do **Workspace** (ref.:
tela de **Nota Fiscal** do gestao-ti). Revisar `FrotaPage`, `PainelFrotaPage`, `DespesasPage`.
Diretrizes: passos numerados, menos densidade, botões grandes, rótulos diretos, feedback
visível, sem campos escondidos atrás de etapas. Validar por tela com o Clenio.

## FASE 7 — Cadastros e Fornecedor (novos itens do Clenio) ⏳

### 7a. Veículo: próprio × alugado 🔄 (novo)
- `Veiculo` não tem esse campo. Adicionar (migration) `propriedade` enum
  `PROPRIO | ALUGADO` (default PROPRIO) + UI no cadastro de veículo.

### 7b. Cadastro de Tipos de Despesa (tela) 🔄 (novo)
- O backend **já tem CRUD** (`POST/PATCH /despesas/tipos`, model `TipoDespesa`:
  nome/descricao/ativo). Falta a **tela de gestão** no frontend p/ o usuário cadastrar os
  tipos conforme a necessidade (em vez de lista fixa).

### 7c. Fornecedor nas despesas reutilizando o cadastro do Workspace ✅ (decisão: Opção A)
- Hoje `DespesaVeiculo.fornecedor` é **texto livre** (opcional).
- O cadastro do Workspace é **`FornecedorConfig`** (schema `gestao_ti`, tabela `fornecedores`;
  campos codigo/loja/nome/status) — **muito acoplado** ao gestao-ti (Contrato, NotaFiscal,
  Licenças). **A logística só enxerga `logistica` + `core` (RO via `$queryRaw`); NÃO acessa
  `gestao_ti` por Prisma.**
- **Opções:**
  - **(A) Leitura cross-schema via `$queryRaw`** de `gestao_ti.fornecedores` na logística —
    mesmo padrão já usado p/ `core`. Rápido, baixo risco; acopla (read-only) logística →
    tabela do gestao-ti. Exige grant SELECT em `gestao_ti` p/ o usuário do banco (ok em DEV;
    conferir PROD).
  - **(B) Integração via API** gestao-ti → logística (HTTP). Mantém o limite de módulo, mas
    adiciona dependência/integração + auth entre serviços.
  - **(C) Promover Fornecedor p/ `core`** (master data compartilhado). Mais "correto" a longo
    prazo, mas **migração pesada** (muitas relações no gestao_ti) — alto risco agora.
  - **Recomendação:** **(A)** como caminho imediato (consistente com o padrão core-RO, baixo
    risco), deixando **(C)** como evolução futura se o fornecedor virar master data central.
- **Fornecedor "NÃO DEFINIDO":** seed de um fornecedor padrão `código 999999 — NÃO DEFINIDO`
  (no `FornecedorConfig`); a despesa referencia ele quando não informado, **mantendo o campo
  livre** (retrocompat). Assim os indicadores futuros (despesa por fornecedor) sempre fecham
  com um balde "NÃO DEFINIDO".
- **Modelagem:** em `DespesaVeiculo`, adicionar `fornecedorId`/`fornecedorCodigo` (ref ao
  FornecedorConfig) e **manter** `fornecedor` (string) p/ retrocompat — espelha o que o
  gestao-ti já fez (`fornecedor` string + `fornecedorRef`).
- **Sweep:** revisar TODOS os pontos com "fornecedor" no módulo Entrega/Frota.

---

## Ordem sugerida
1. **FASE 1 + 1b** (app — desbloqueia teste real; inclui a lógica PADRAO×INDIVIDUAL).
2. **FASE 2 + 3** (sweeps rápidos: olhinho + matrícula).
3. **FASE 7a + 7b** (cadastros simples: próprio/alugado + tela de tipos de despesa).
4. **FASE 4** (credencial por sessão — depende da decisão PADRAO×INDIVIDUAL, já definida).
5. **FASE 7c** (fornecedor — depende da ❓ decisão de arquitetura A/B/C).
6. **FASE 5** (navegação + validação).
7. **FASE 6** (revamp FROTA — maior, incremental por tela).

Checkpoint por fase: build + verifica DEV + commit.

## Decisões — TODAS FECHADAS (16/06) ✅
- ✅ **7c — Fornecedor**: **Opção A** — leitura cross-schema (`$queryRaw` read-only de
  `gestao_ti.fornecedores`, mesmo padrão do `core`). Default `999999 - NÃO DEFINIDO` (seed no
  FornecedorConfig). Conferir grant SELECT em `gestao_ti` no deploy PROD.
- ✅ **7a — Veículo**: enum **`PROPRIO | ALUGADO`** (default `PROPRIO`).
- ✅ **Fase 4 — role do caixa**: criar **`REGISTRADOR_ENTREGA`** — restrito a incluir/alterar
  entrega na própria filial (não vê frota/painel/comprovantes).
- ✅ **PADRAO×INDIVIDUAL**: PADRAO = login genérico → pede matrícula+senha por ação (entrega +
  saída de veículo); INDIVIDUAL usa `core.usuarios.matricula` do login (confirmar preenchida).

> Plano fechado — pronto para executar pela ordem sugerida.
