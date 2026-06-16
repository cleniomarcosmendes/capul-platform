# Plano de Execução — Logística (16/06/2026) — v2 (revisado c/ observações do Clenio)

Revisão após o Clenio revisar a v1. Mudanças relevantes marcadas com 🔄. Decisões
pendentes (precisam de OK antes de codar) marcadas com ❓.

Branch: `feat/logistica-frota` (= `main`, já pushada até `11ee5ed`).
Dados DEV: `clenio`/`123456` (ADMIN), `entregador_teste`/`entrega123` (ENTREGADOR).

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

## FASE 4 — Credencial por SESSÃO no cadastro de entrega (caixas) ⏳ (feature)
Os **caixas do mercado** cadastram entregas. Mesma lógica **PADRAO × INDIVIDUAL** da Fase 1:
- Usuário **PADRAO** (caixa compartilhado): pede matrícula+senha do portal RH **1x por
  sessão** (cache em memória, NÃO persistir senha) + botão **"trocar operador"** + expiração
  por inatividade + limpa no logout/fechar aba. Revalida no backend ao criar a entrega.
- Usuário **INDIVIDUAL**: não pede (usa a matrícula do próprio login).
- Reusa o conceito do **Chamado PADRAO** (`loginPortal`, resposta 200 `{valida,motivo}`).
- Tela: `logistica/frontend .../EntregaNovaPage.tsx`.

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

### 7c. Fornecedor nas despesas reutilizando o cadastro do Workspace ❓ (decisão de arquitetura)
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

## Decisões pendentes (precisam de OK)
- ❓ **7c — arquitetura do Fornecedor**: A (raw cross-schema, recomendado) / B (API) / C (core).
- ❓ **7a — campo veículo**: enum `PROPRIO | ALUGADO` cobre, ou precisa de mais (ex.: TERCEIRIZADO)?
- ✅ **PADRAO×INDIVIDUAL** + matrícula do usuário INDIVIDUAL via `core.usuarios.matricula` (confirmar que estará preenchida).
