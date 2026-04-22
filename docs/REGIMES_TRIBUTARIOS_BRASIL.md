# Regimes Tributários — Análise para Cruzamento Protheus × SEFAZ

> **Contexto:** 22/04/2026. O setor fiscal da CAPUL solicitou levantamento dos regimes tributários vigentes no Brasil para orientar a classificação dentro do Protheus. Uma vez que o Protheus exponha essa informação na API, o Módulo Fiscal passará a comparar contra o `xRegApur` retornado pelo CCC/SEFAZ e gerar divergência quando aplicável.
>
> **Status:** aguardando equipe fiscal + dev Protheus definirem a regra de classificação (início 22/04/2026 — sem prazo definido).
>
> **Responsável CAPUL:** setor fiscal + equipe de desenvolvimento Protheus.
> **Responsável Módulo Fiscal:** backend Fiscal (Clenio) — adiciona o campo na interface + comparação quando o contrato for atualizado.

---

## 1. Regimes tributários PJ vigentes no Brasil (2026)

| # | Regime | Base legal | Escopo típico |
|---|---|---|---|
| 1 | **MEI** (Microempreendedor Individual) | LC 123/2006 art. 18-A | PJ ≤ R$ 81 mil/ano, titular único |
| 2 | **Simples Nacional** | LC 123/2006 | ME ≤ R$ 360k/ano, EPP ≤ R$ 4,8M/ano |
| 3 | **Lucro Presumido** | Lei 9.430/1996 | Faturamento ≤ R$ 78M/ano. **2026**: IN RFB 2.306/2026 acrescentou 10% sobre parcela > R$ 5M |
| 4 | **Lucro Real** | Decreto 9.580/2018 (RIR) | Obrigatório acima de R$ 78M/ano ou atividades específicas; opcional para qualquer PJ |
| 5 | **Lucro Arbitrado** | Lei 9.430/1996 art. 47 | Imposição quando LR/LP não é comprovado (quase sempre via fiscalização) |
| 6 | **Imune / Isento** | CF art. 150 e 195; LC 87/1996 | Templos, partidos, entidades sem fins lucrativos |

## 2. Valores que o CCC/SEFAZ devolve no `xRegApur`

O XML do `CadConsultaCadastro4` traz um campo `xRegApur` (string livre) dentro de `infCad`. A taxonomia varia entre SEFAZs estaduais, mas é **mais enxuta** que a lista oficial:

| Valor observado em `xRegApur` | Interpretação |
|---|---|
| `NORMAL` ou `REGIME DE TRIBUTACAO NORMAL` | LP, LR ou LA — **o SEFAZ não distingue os 3 subtipos** |
| `SIMPLES NACIONAL` ou `EMPRESA OPTANTE PELO SIMPLES NACIONAL` | SN (pode incluir MEI, dependendo da SEFAZ) |
| `SIMEI` | MEI específico (algumas SEFAZs usam em vez de `SIMPLES NACIONAL`) |
| *(vazio)* | Não aplicável: CPF sem IE, isento de ICMS, IE cancelada sem regime |

### Implicação crítica

Se quisermos distinguir **Lucro Presumido × Lucro Real × Lucro Arbitrado**, essa granularidade **não vem do SEFAZ** — tem de ser fonte Protheus.

### Distribuição real no HOM da CAPUL (22/04/2026)

Amostra de 134 contribuintes consultados:

| Valor | Qtd |
|---|---|
| `REGIME DE TRIBUTACAO NORMAL` | 53 |
| `EMPRESA OPTANTE PELO SIMPLES NACIONAL` | 4 |
| *(vazio)* | 77 |

**Breakdown dos vazios:**
- **CPF**: 73 vazios / 48 preenchidos (121 total). SEFAZ-MG só preenche `xRegApur` para CPF quando é **produtor rural com IE ativa**.
- **CNPJ MG**: 4 vazios / 9 preenchidos (13 total). Vazios costumam ser IE isenta/cancelada.
- **Outras UFs**: 0 casos na base HOM — comportamento de SP/RJ/GO não validado ainda.

## 3. Campo CRT da NF-e (dimensão auxiliar)

O CRT é preenchido em cada NF-e emitida (não no cadastro central), informado pelo próprio emitente. **Diferente** do `xRegApur`.

| CRT | Significado |
|---|---|
| 1 | Simples Nacional |
| 2 | Simples Nacional — excesso de sublimite da receita bruta |
| 3 | Regime Normal (LP/LR/LA — como no CCC, não distingue) |
| 4 | Simples Nacional — MEI (obrigatório desde 04/2024 — NT 2024.001) |

Não é a fonte primária do cruzamento, mas serve como **2ª fonte** quando o `xRegApur` vier vazio e a empresa emitir NF-e regularmente.

## 4. Mapeamento canônico proposto para o contrato Protheus

Para a API `cadastroFiscal` retornar um novo campo `regimeTributario` com um dos 7 valores padronizados:

```typescript
type RegimeTributarioCanonico =
  | 'MEI'             // equivale a CRT=4 e/ou xRegApur=SIMEI
  | 'SIMPLES'         // equivale a CRT=1 ou 2, xRegApur=SIMPLES NACIONAL
  | 'PRESUMIDO'       // Lucro Presumido — granularidade Protheus
  | 'REAL'            // Lucro Real
  | 'ARBITRADO'       // Lucro Arbitrado
  | 'ISENTO_IMUNE'    // templos, partidos, entidades sem fins lucrativos
  | 'NAO_APLICAVEL'   // CPF sem IE, IE cancelada sem regime
  | null;             // não classificado ainda (situação transiente)
```

### Exemplo de payload do endpoint `GET /cadastroFiscal/{cnpj}`

```json
{
  "cnpj": "25834847000100",
  "registros": [
    {
      "origem": "SA1010",
      "inscricaoEstadual": "0450890000436",
      "inscricaoEstadualUF": "MG",
      "razaoSocial": "COOPERATIVA AGROPECUARIA UNAI LTDA",
      "regimeTributario": "REAL",        // ← NOVO CAMPO
      "endereco": { ... }
    }
  ]
}
```

## 5. Regra de equivalência no DivergenciaService

O SEFAZ é **amplo em cima** (`NORMAL` engloba LP/LR/LA) e **granular em baixo** (`SIMPLES` pode englobar MEI). O cruzamento precisa usar **equivalência hierárquica**, não igualdade literal:

```typescript
// Protheus → valores SEFAZ aceitáveis (não gera divergência)
const EQUIVALENCIA: Record<RegimeCanonico, string[]> = {
  MEI:            ['SIMPLES NACIONAL', 'SIMEI', 'MEI'],
  SIMPLES:        ['SIMPLES NACIONAL', 'SIMEI'],
  PRESUMIDO:      ['NORMAL', 'REGIME DE TRIBUTACAO NORMAL'],
  REAL:           ['NORMAL', 'REGIME DE TRIBUTACAO NORMAL'],
  ARBITRADO:      ['NORMAL', 'REGIME DE TRIBUTACAO NORMAL'],
  ISENTO_IMUNE:   ['ISENTO', 'IMUNE', ''],
  NAO_APLICAVEL:  ['', null],
};

function compararRegime(protheus, sefaz) {
  const normalizado = normalizarXRegApur(sefaz);
  if (EQUIVALENCIA[protheus].includes(normalizado)) return null; // bate
  return {
    campo: 'regime_tributario',
    valorProtheus: protheus,
    valorSefaz: sefaz,
    criticidade: 'MEDIA', // contradição real vira MEDIA; BAIXA dentro da família NORMAL
  };
}
```

### Casos de teste

| Protheus | SEFAZ | Esperado |
|---|---|---|
| `PRESUMIDO` | `NORMAL` | **Sem divergência** (SEFAZ não distingue) |
| `SIMPLES` | `NORMAL` | **Divergência ALTA** (contradição real) |
| `MEI` | `SIMPLES NACIONAL` | **Sem divergência** (MEI é sub-conjunto de SN) |
| `null` | `NORMAL` | **Sem divergência** (Protheus não classificou ainda) |
| `PRESUMIDO` | *(vazio)* | **Sem divergência** (SEFAZ não retornou dado) |

## 6. Campos prováveis no Protheus como fonte

A equipe Protheus deve confirmar com ADVPL qual dos campos abaixo é a fonte correta para a CAPUL:

| Campo | Descrição | Observação |
|---|---|---|
| `SA1.A1_SIMPNAC` / `SA2.A2_SIMPNAC` | Flag Simples Nacional (`'1'`=Sim, `'2'`=Não) | Padrão TOTVS — resolve SN × não-SN, não distingue LP/LR/LA |
| `SA1.A1_SUBSIM` / `SA2.A2_SUBSIM` | Sublimite SN | Complemento para CRT=2 |
| `SA1.A1_TPJ` / `SA2.A2_TPJ` | Tipo de pessoa jurídica | Às vezes usado como proxy de regime |
| `A1_XREGIME` / `A2_XREGIME` | Campo customizado CAPUL | Se existir, é a fonte ideal |
| `SF4.F4_SITTRIB` | Situação tributária por TES | Alternativa indireta (menos confiável) |

## 7. Heads-up: Reforma Tributária 2026

Em 2026 entra em transição o **IBS + CBS** (substituindo ICMS, IPI, PIS, COFINS — transição até 2033):

- Alíquota **teste** de IBS a 0,9% em 2026
- Simples Nacional continua existindo, com regra específica para adesão ao IBS/CBS
- **Não muda** os valores que o `xRegApur` retorna nem a estrutura do CCC — o cruzamento que está sendo planejado segue válido

## 8. Próximos passos operacionais

1. **Setor fiscal CAPUL + dev Protheus**: definir regra de classificação e expor `regimeTributario` (string, valores canônicos do item 4) no endpoint `cadastroFiscal`.
2. **Atualizar** `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` §3.3.2 (incluir `regimeTributario` na resposta `registros[]`).
3. **Módulo Fiscal** (uma vez que o contrato venha atualizado):
   - Adicionar `regimeTributario?: string | null` em `CadastroFiscalRegistro` (interface).
   - Adicionar `regimeTributario` em `DadosProtheusComparacao` + `DadosSefazComparacao` (`divergencia.service.ts`).
   - Implementar `compararRegime` com a lógica de equivalência da seção 5.
   - Adicionar `regime_tributario` ao `CAMPO_LABEL` no frontend (`DivergenciasListPage.tsx`).
4. **Validação**: rodar cruzamento em HOM com amostra conhecida e verificar que os casos de teste da seção 5 se comportam como esperado.

Estimativa: ~20 linhas de código + 1 teste unitário quando o contrato chegar.

## 9. Referências

- [LC 123/2006 — Estatuto da Micro e Pequena Empresa](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm)
- [Lei 9.430/1996 — Lucro Real, Presumido e Arbitrado](https://www.planalto.gov.br/ccivil_03/leis/l9430.htm)
- [Decreto 9.580/2018 — Regulamento do Imposto de Renda](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9580.htm)
- [NT 2024.001 — CRT MEI — Portal da NF-e](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=6luq3tpmg08%3D)
- [Web Service NFeConsultaCadastro — MOC SEFAZ-PR](http://moc.sped.fazenda.pr.gov.br/NFeConsultaCadastro.html)
- [Consulta Cadastro de Contribuintes — SEFAZ-MG](https://portalsped.fazenda.mg.gov.br/spedmg/nfe/Consulta-Cadastro-de-Contribuintes/)
- [IN RFB 2.306/2026 — Ajustes no Lucro Presumido](https://tactus.com.br/lucro-presumido-mudancas/)
- [Reforma Tributária 2026 — guia da transição](https://www.taxgroup.com.br/intelligence/reforma-tributaria-2026-guia-completo-sobre-o-que-muda-e-a-transicao/)

---

**Documento vivo** — atualizar quando a equipe Protheus definir a regra de classificação ou quando o CCC v5 (se houver) mudar a taxonomia do `xRegApur`.
