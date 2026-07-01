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
> 4. O supervisor/atendente técnico **fica responsável por UM veículo** → precisa de um
>    **vínculo PRÓPRIO** colaborador↔veículo (com **troca**). **⚠️ NÃO confundir** com o
>    `veiculo.supervisorId` atual — esse é o papel RBAC **"Supervisor"** (encarregado que
>    *gerencia* alguns veículos), **não** o **Supervisor de Área** (que *usa* um veículo em
>    campo). Reaproveita-se só o *padrão* (vínculo + histórico), num **campo novo** (§3.4/§4.3).
> 5. **Papéis RBAC** (complemento): **GESTOR (GESTOR_FROTA)** gerencia TODA a frota;
>    **Supervisor** (`Veiculo.supervisorId`) gerencia ALGUNS veículos. Ver §3.5.

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
| **Padrão de vínculo colaborador↔veículo + troca (histórico)** | `Veiculo.supervisorId` (= **encarregado do departamento**, supervisiona todos os veículos do depto) + `veiculo_supervisor_historico`. Serve de **MODELO** p/ o vínculo do **Supervisor de Área** (§4.3) — que é OUTRO campo. |
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
4. **Supervisor de Área (atendente técnico) = condutor + responsável por UM veículo**
   (resolve o item antes em aberto):
   - É um **funcionário Protheus** (matrícula+senha — como hoje na frota; a RDV usa
     matrícula 5222 / setor "Fábrica de Ração"). **Reusa o fluxo de condutor** (sem
     cadastro à parte).
   - **⚠️ NÃO é o `Veiculo.supervisorId` atual.** Esse campo é o **encarregado**
     (papel RBAC "Supervisor", ver §3.5) — quem **gerencia** um conjunto de veículos.
     O **Supervisor de Área** é o colaborador que **fica com AQUELE veículo** para as
     visitas da sua área → precisa de um **vínculo próprio** (campo novo, §4.3).
   - Reaproveita-se o **padrão** (vínculo + histórico de troca), mas em campo novo,
     **por matrícula Protheus** (o supervisor de área é funcionário, não necessariamente
     usuário do sistema).

### 3.5 Papéis (RBAC) do módulo Logística — complemento (Clenio, 01/07)

| Papel | Escopo de gestão |
|---|---|
| **GESTOR (GESTOR_FROTA)** | Gerencia **TODA** a frota (todos os veículos/viagens). |
| **Supervisor** (= `Veiculo.supervisorId`) | Gerencia **ALGUNS** veículos — os atribuídos a ele (o "encarregado"). Opera/ajusta só os SEUS. |
| **Supervisor de Área** (Indústria/Filial 18) | **Não é papel de gestão** — é o atendente técnico que **usa** um veículo p/ visitas. Vínculo próprio (§4.3), distinto do papel acima. |

> **Não confundir os dois "supervisores":** o **RBAC "Supervisor"** *gerencia* veículos
> (subconjunto da frota); o **"Supervisor de Área"** *usa* um veículo em campo. Podem até
> ser a mesma pessoa às vezes, mas são conceitos separados no sistema.

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

### 4.3 Vínculo Supervisor de Área ↔ veículo (NOVO — ≠ `supervisorId` do depto)
- **Dois vínculos distintos, não confundir** (ver §3.5):
  - `Veiculo.supervisorId` (já existe) = papel RBAC **"Supervisor"** → *gerencia* um
    conjunto de veículos. **Fica como está.**
  - **Supervisor de Área** (novo) = o atendente técnico que **fica com AQUELE veículo**
    para as visitas. É o vínculo que o Clenio pediu.
- **Novo:** `Veiculo.supervisorAreaMatricula?` (+ `supervisorAreaNome?` cache do Protheus)
  e histórico de troca próprio (mesmo **padrão** de `veiculo_supervisor_historico`).
  Vínculo **por matrícula Protheus**. Cadastro/troca na tela do veículo, em campo separado
  do "Supervisor responsável" (encarregado).
- A viagem mensal do supervisor de área usa esse vínculo (o veículo já "sabe" seu
  supervisor de área).

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
