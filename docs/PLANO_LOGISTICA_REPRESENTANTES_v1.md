# Plano — Logística: Representantes & Prestação de Contas (RDV)

> **Status:** planejamento (28/06/2026). A *melhoria da Saída de Veículo* (busca de
> cliente/propriedade + prospect na Rota Planejada) foi implementada como **fundação**
> (ver "Fase 1" no fim). Este documento cobre a parte **NOVA — Representantes** —
> que se integra ao que já existe. Avaliação baseada nas planilhas reais de Maio
> (`RDV Maio.xlsx`, `Visitas Maio.xlsx`) e no código atual.

## 1. Contexto

A Indústria de Ração (Filial 18) tem representantes espalhados por vários
municípios/estados. A empresa custeia despesas (alimentação, hospedagem +
veículo) e o representante **presta contas** mensalmente (RDV) e registra suas
**visitas técnicas/comerciais**. Hoje isso é feito em planilhas:

- **RDV (Relatório de Despesas de Viagem)** — extrato mensal dia × região, com
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
| Despesa com foto + **fila offline + idempotência** | App Expo `logistica/app/` — `ViagemFrotaScreen` → `DespesaForm` |
| Governança de despesa (PENDENTE→APROVADA/CONTESTADA, anormalidade) | `despesa.service` |
| Impressão (modelo) | Romaneio / Linha do KM |

## 3. Decisões tomadas (Clenio, 28/06)

1. **Viagem de representante = período/mês** — 1 adiantamento por período; dias →
   visitas + despesas; ao fechar, gera a **RDV do mês** com o saldo.
2. **Região = híbrido** — cadastro de Região macro (ex.: "Campo das Vertentes",
   com municípios associados) **+** município por visita (já vem do cliente).
3. **Menu** da tela atual: "Controle de Frota" → **"Saída de Veículos"** (feito).
4. **Aberto (confirmar):** representante é um **condutor** (funcionário Protheus,
   matrícula+senha — como hoje na frota; a RDV usa matrícula 5222 / setor "Fábrica
   de Ração") ou um **cadastro à parte**? _Recomendação: reusar o fluxo de condutor._

## 4. Modelo de dados (deltas no schema `logistica`)

> Migrations **formais** (sem `db push`). Atenção ao gotcha da logística:
> `migrate dev` quer resetar (tabela `_prisma_migrations` compartilhada) → usar
> `migrate diff` + pasta manual + `migrate deploy`.

### 4.1 Fase 1 entregue (fundação — front-end puro, sem migration)
- A "Rota Planejada" da **Saída de Veículos** ganhou **busca de cliente** (matrícula/telefone
  → propriedade, reusando `/cadastro/busca`) + prospect. A parada planejada nasce já com o
  rótulo "Cliente — endereço · município" em `planejadoLocal` (campo de texto que já existe).
- **Os campos estruturados** (`clienteMatricula?`, `clienteNome?`, `municipio?` na `Parada`)
  entram na **Fase 3** (Representante), quando a matrícula precisa virar vínculo p/ os
  relatórios (RDV/Visitas). Assim a melhoria do que já existe sai sem mexer no schema.

### 4.2 Novos (Representante)
| Modelo | Campos |
|---|---|
| **`AtividadeVisita`** (catálogo) | `nome`, escopo `filialId?` (global se null), `ativo` — seed com os 10 tipos |
| **`Regiao`** (cadastro) | `nome`, `filialId?`, `ativo`; opcional `RegiaoMunicipio[]` (lista de municípios) |
| **`Parada`** (+ representante) | `atividadeId?` (FK), `regiaoId?`, `propriedade?` (fazenda), `obs?` |
| **`TipoDespesa`** | + `categoria: VEICULO \| INDIVIDUO` (default VEICULO) |
| **`DespesaVeiculo`** | `veiculoId` → **opcional**; + `regiaoId?` — despesa de INDIVÍDUO não tem veículo |
| **`Viagem`** | + `tipo REPRESENTANTE`; + `adiantamento Decimal?`; + `regiaoId?`; + `periodoInicio/Fim` |

**Integração "de graça":** Custo de Frota e Linha do KM já filtram por `veiculoId` →
despesas de INDIVÍDUO (sem veículo) ficam **fora** desses relatórios automaticamente;
a **RDV** soma **todas** as despesas da viagem (veículo + indivíduo).

## 5. Backend (endpoints novos)

- `GET/POST /atividades-visita` (catálogo) — gestor.
- `GET/POST /regioes` (+ municípios) — gestor.
- `TipoDespesa` CRUD ganha `categoria`.
- `Viagem` de representante: criar com `tipo REPRESENTANTE` + adiantamento + período.
- Despesa de indivíduo: `POST /despesas/viagem` aceita `veiculoId` nulo quando
  `tipo.categoria=INDIVIDUO`.
- **RDV**: `GET /viagens/:id/rdv` → agrega dias × região × categorias + adiantamento + saldo.
- **Relatório de Visitas**: `GET /viagens/:id/visitas` (ou por período/representante).

## 6. Telas (desktop)

- **Menu novo "Representantes"** (gate por role/filial — Filial 18): lista de viagens
  de representante (mês), criar viagem-mês + adiantamento.
- **Detalhe da viagem**: dias → visitas (busca de cliente já pronta da Fase 1 +
  Atividade + Região) e despesas (categoria).
- **RDV**: extrato imprimível (dia × região, categorias indivíduo/veículo, adiantamento,
  saldo a devolver/reembolsar) — modelo do RDV assinado.
- **Relatório de Visitas**: grid imprimível.
- **Administração/Manutenção** (gestor): corrigir visita/despesa sem região,
  reclassificar categoria, ajustar adiantamento.

## 7. App (Expo — já existe)

Estender `ViagemFrotaScreen`:
- Tipo de viagem **Representante**.
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
| **3 — Representante + RDV** | Viagem mensal + adiantamento + RDV + Relatório de Visitas + catálogos (Atividade/Região) | a fazer |
| **4 — App** | Estender `ViagemFrotaScreen` (representante) | a fazer |
| **5 — Administração** | Tela gestor de manutenção/correção | a fazer |

## 10. Adjacente (backlog)
- Digitalizar o **Check List de veículos leves** (inspeção mensal de segurança, 26 itens,
  C/NC/NA, assinaturas) — observado na pasta de análise; separado deste escopo.

---
*Planilhas de referência: `C:\temp\arquivo_analise\` (RDV Maio, Visitas Maio, RDV assinado, Check list veículo).*
