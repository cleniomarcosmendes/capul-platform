# Documentação do módulo CT-e

Pasta para documentação técnica e planos do módulo `fiscal/cte`.

## Documentos

| Arquivo | Descrição | Status |
|---|---|---|
| [`PLANO_CTE_DISTRIBUICAO_v2.md`](./PLANO_CTE_DISTRIBUICAO_v2.md) | Plano técnico de implementação do `CTeDistribuicaoDFe` (modo `distNSU` + scheduler + persistência) | Aprovado, Opção A confirmada — aguardando início |

## Histórico

- **04/05/2026** — Plano v2 gerado integrando análise da infraestrutura existente. Decisão Opção A (4 tabelas dedicadas) confirmada.
- **03/05/2026** — Plano v1 gerado pelo Claude Desktop (greenfield, 23 dias úteis estimados) — superado pela v2.

## Contexto

A v2 substitui a v1 porque:

1. ~50% da infra já existe (`fiscal/backend/src/cte/` + `cte-distribuicao.client.ts` + parsers + DACTe PDF + frontend `CteConsultaPage`).
2. Estimativa revisada: **8-12 dias úteis** (vs 23 do plano v1).
3. Confirmado em 04/05: caminho TSS+appserver.ini **não funciona** (TOTVS não suporta CT-e via TSS na prática). Desenvolvimento próprio é único caminho viável sem contratar TOTVS Transmite.

## Fonte de verdade

A pasta `docs/` é **documentação não-executável**. Não confundir com módulos NestJS (não tem `.ts` aqui).
