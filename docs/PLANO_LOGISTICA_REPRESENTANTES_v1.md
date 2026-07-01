# Plano — Logística: Supervisores / Atendentes Técnicos & Prestação de Contas (RDV)

> **Status:** planejamento (28/06/2026). A *melhoria da Saída de Veículo* (busca de
> cliente/propriedade + prospect na Rota Planejada) foi implementada como **fundação**
> (ver "Fase 1" no fim). Este documento cobre a parte **NOVA — Supervisores /
> Atendentes Técnicos** — que se integra ao que já existe. Avaliação baseada nas
> planilhas reais de Maio (`RDV Maio.xlsx`, `Visitas Maio.xlsx`) e no código atual.

> **Atualizado 01/07/2026 (correções do Clenio):**
> 1. O papel correto é **Supervisor / Atendente Técnico** (não "representante").
> 2. O fechamento (prestação de contas) é **MENSAL** — confirmado.
> 3. **Um município pode ter VÁRIAS regiões** (relação N:N Região↔Município) — confirmado.
> 4. O supervisor/atendente técnico **fica responsável por UM veículo** → o vínculo
>    colaborador↔veículo (com **troca**) **JÁ EXISTE**: `veiculo.supervisorId` +
>    histórico `veiculo_supervisor_historico` (campo "Supervisor responsável" no
>    cadastro do veículo). Reaproveitar isso (ver §3.4 e §4.3).

## 1. Contexto

A Indústria de Ração (Filial 18) tem **supervisores / atendentes técnicos** espalhados
por vários municípios/estados. A empresa custeia despesas (alimentação, hospedagem +
veículo) e o supervisor **presta contas MENSALMENTE** (RDV) e registra suas
**visitas técnicas/comerciais**. Hoje isso é feito em planilhas:

- **RDV (Relatório de Despesas de Viagem)** — extrato **mensal** dia × região, com
  categorias de despesa, reconciliado contra um **adiantamento** (a devolver /
  a reembolsar).
- **Visitas** — grid `DATA | Matrícula | Cliente | Fazenda | Município | Atividade | Obs`,
  onde a matrícula busca o cliente (sócio/cliente Protheus) ou é "Cliente sem
  cadastro" (prospect) ou em branco (evento/sem cliente). Atividade vem de uma
  **lista fixa de 10 tipos**.

## 2. O que JÁ existe e será reaproveitado

| Peça | Onde |
|---|---|
| Busca de cliente matrícula/telefone → endereço (Protheus SA1) | `GET /cadastro/busca?termo=` → `ProtheusClienteService.buscar()` (operação `clienteEndereco`) |
| Cliente "não identificado"/prospect | `ClienteLocal` + `tipoCliente EVENTUAL` (Entrega) |
| Viagem de frota (condutor matrícula+senha Protheus, paradas, despesas) | `Viagem(tipo FROTA)`, `Parada`, `DespesaVeiculo` |
| **Vínculo supervisor↔veículo (+ troca com histórico)** | `Veiculo.supervisorId` + `veiculo_supervisor_historico`; campo "Supervisor responsável" no cadastro do veículo |
| Despesa com foto + **fila offline + idempotência** | App Expo `logistica/app/` — `ViagemFrotaScreen` → `DespesaForm` |
| Governança de despesa (PENDENTE→APROVADA/CONTESTADA, anormalidade) | `despesa.service` |
| Impressão (modelo) | Romaneio / Linha do KM |

## 3. Decisões tomadas (Clenio, 28/06 · atualizado 01/07)

1. **Viagem do supervisor = MENSAL** — 1 adiantamento por **mês**; dias →
   visitas + despesas; ao fechar o mês, gera a **RDV do mês** com o saldo.
2. **Região = híbrido, N:N com município** — cadastro de Região (ex.: "Campo das
   Vertentes") **+** município por visita (já vem do cliente). **Um município pode
   pertencer a VÁRIAS regiões** e uma região pode ter vários municípios → associação
   **N:N** (`RegiaoMunicipio`). A região da visita não é derivada só do município
   (que é ambíguo) — é escolhida/confirmada na visita.
3. **Menu** da tela atual: "Controle de Frota" → **"Saída de Veículos"** (feito).
4. **Supervisor / atendente técnico = condutor + responsável pelo veículo** (resolve
   o item antes em aberto):
   - É um **funcionário Protheus** (matrícula+senha — como hoje na frota; a RDV usa
     matrícula 5222 / setor "Fábrica de Ração"). **Reusa o fluxo de condutor** (sem
     cadastro à parte).
   - Fica **responsável por UM veículo** → usa o **`Veiculo.supervisorId`** que já
     existe (com **troca** registrada em `veiculo_supervisor_historico`). Assim os
     relatórios podem partir do veículo → seu supervisor, e a troca de responsável
     é rastreada.
   - **Refinamento a validar:** hoje `supervisorId` referencia `core.usuarios`
     (usuário do sistema). Se o atendente técnico é só funcionário Protheus (matrícula,
     sem usuário do sistema), avaliar se o vínculo passa a aceitar **matrícula Protheus**
     ou se esses supervisores viram usuários do sistema.

## 4. Modelo de dados (deltas no schema `logistica`)

> Migrations **formais** (sem `db push`). Atenção ao gotcha da logística:
> `migrate dev` quer resetar (tabela `_prisma_migrations` compartilhada) → usar
> `migrate diff` + pasta manual + `migrate deploy`.

### 4.1 Fase 1 entregue (fundação — front-end puro, sem migration)
- A "Rota Planejada" da **Saída de Veículos** ganhou **busca de cliente** (matrícula/telefone
  → propriedade, reusando `/cadastro/busca`) + prospect. A parada planejada nasce já com o
  rótulo "Cliente — endereço · município" em `planejadoLocal` (campo de texto que já existe).
- **Os campos estruturados** (`clienteMatricula?`, `clienteNome?`, `municipio?` na `Parada`)
  entram na **Fase 3**, quando a matrícula precisa virar vínculo p/ os
  relatórios (RDV/Visitas). Assim a melhoria do que já existe sai sem mexer no schema.

### 4.2 Novos (Supervisor / Atendente Técnico)
| Modelo | Campos |
|---|---|
| **`AtividadeVisita`** (catálogo) | `nome`, escopo `filialId?` (global se null), `ativo` — seed com os 10 tipos |
| **`Regiao`** (cadastro) | `nome`, `filialId?`, `ativo` |
| **`RegiaoMunicipio`** (N:N) | `regiaoId`, `municipio` — um município em várias regiões e vice-versa |
| **`Parada`** (+ visita) | `atividadeId?` (FK), `regiaoId?`, `propriedade?` (fazenda), `obs?` |
| **`TipoDespesa`** | + `categoria: VEICULO \| INDIVIDUO` (default VEICULO) |
| **`DespesaVeiculo`** | `veiculoId` → **opcional**; + `regiaoId?` — despesa de INDIVÍDUO não tem veículo |
| **`Viagem`** | + `tipo SUPERVISOR`; + `adiantamento Decimal?`; + `regiaoId?`; + `mesReferencia` (mês da RDV) |

### 4.3 Reuso do vínculo supervisor↔veículo (SEM modelo novo)
- **Não criar** tabela de "representante × veículo" — o `Veiculo.supervisorId` já é o
  "colaborador responsável pelo veículo", e `veiculo_supervisor_historico` já guarda as
  **trocas** (data, de/para, quem alterou). O cadastro do veículo já tem o campo.
- A viagem do supervisor herda o responsável do veículo (ou o condutor identificado na
  saída, se diferente do responsável).

**Integração "de graça":** Custo de Frota e Linha do KM já filtram por `veiculoId` →
despesas de INDIVÍDUO (sem veículo) ficam **fora** desses relatórios automaticamente;
a **RDV** soma **todas** as despesas da viagem (veículo + indivíduo).

## 5. Backend (endpoints novos)

- `GET/POST /atividades-visita` (catálogo) — gestor.
- `GET/POST /regioes` (+ municípios N:N) — gestor.
- `TipoDespesa` CRUD ganha `categoria`.
- `Viagem` de supervisor: criar com `tipo SUPERVISOR` + adiantamento + mês de referência.
- Despesa de indivíduo: `POST /despesas/viagem` aceita `veiculoId` nulo quando
  `tipo.categoria=INDIVIDUO`.
- **RDV**: `GET /viagens/:id/rdv` → agrega dias × região × categorias + adiantamento + saldo.
- **Relatório de Visitas**: `GET /viagens/:id/visitas` (ou por mês/supervisor).

## 6. Telas (desktop)

- **Menu novo "Supervisores"** (gate por role/filial — Filial 18): lista de viagens
  mensais do supervisor, criar viagem-mês + adiantamento.
- **Detalhe da viagem**: dias → visitas (busca de cliente já pronta da Fase 1 +
  Atividade + Região) e despesas (categoria).
- **RDV**: extrato imprimível (dia × região, categorias indivíduo/veículo, adiantamento,
  saldo a devolver/reembolsar) — modelo do RDV assinado.
- **Relatório de Visitas**: grid imprimível.
- **Administração/Manutenção** (gestor): corrigir visita/despesa sem região,
  reclassificar categoria, ajustar adiantamento.

## 7. App (Expo — já existe)

Estender `ViagemFrotaScreen`:
- Tipo de viagem **Supervisor**.
- **Visitas com paradas opcionais** (a Parada já nasce planejada/opcional) — busca de
  cliente + Atividade + Obs.
- **Despesa** já pronta (`DespesaForm`) — passa a respeitar `categoria`; foto + offline
  já funcionam.

## 8. Relatórios (saída)

1. **RDV** — espelha `RDV Maio.xlsx`: cabeçalho (funcionário/matrícula/placa/setor),
   detalhamento financeiro (adiantamento, totais por categoria), grade dia × região,
   "a devolver à CAPUL" / "a reembolsar".
2. **Visitas** — espelha `Visitas Maio.xlsx`: `DATA | Cliente/Matrícula | Propriedade |
   Município | Atividade | Obs`.

## 9. Plano incremental (sub-fases)

| Fase | Entrega | Status |
|---|---|---|
| **1 — Visita/Saída** | Busca de cliente/propriedade + prospect na Rota Planejada | **FEITA** (fundação) |
| **2 — Despesa categorizada** | `TipoDespesa.categoria`; despesa de indivíduo; integração Custo de Frota | a fazer |
| **3 — Supervisor + RDV** | Viagem mensal + adiantamento + RDV + Relatório de Visitas + catálogos (Atividade/Região N:N) | a fazer |
| **4 — App** | Estender `ViagemFrotaScreen` (supervisor) | a fazer |
| **5 — Administração** | Tela gestor de manutenção/correção | a fazer |

## 10. Adjacente (backlog)
- Digitalizar o **Check List de veículos leves** (inspeção mensal de segurança, 26 itens,
  C/NC/NA, assinaturas) — observado na pasta de análise; separado deste escopo.

---
*Planilhas de referência: `C:\temp\arquivo_analise\` (RDV Maio, Visitas Maio, RDV assinado, Check list veículo).*
