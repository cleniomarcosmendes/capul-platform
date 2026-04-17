# Módulo Fiscal — Fluxo de Consulta NF-e

**Versão:** 1.0
**Data:** 13/04/2026
**Status:** Produção (com Protheus em modo mock até cutover)

---

## 1. Resumo executivo

A consulta de NF-e por chave na plataforma Capul segue um fluxo **cache-first no Protheus**, com fallback para download do XML no SEFAZ quando a chave não está em cache. Ao final, o XML autorizado é parseado em abas estruturadas (Dados Gerais, Emitente, Destinatário, Produtos, Totais, Protocolo) e exibido no frontend.

O fluxo é usado tanto para NF-es **de saída** (emitidas pela CAPUL) quanto **de entrada** (recebidas de fornecedores) — com o detalhe importante de que NF-es emitidas pela própria CAPUL **não podem ser baixadas via `NFeDistribuicaoDFe`**, só via Protheus.

---

## 2. Fluxo técnico

```
Usuário informa chave NF-e (44 dígitos)
         │
         ▼
┌─────────────────────────────────┐
│ NfeController.consultar()       │
│ - Valida chave (44 dígitos)     │
│ - Valida filial (2 dígitos)     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ ProtheusXmlService.exists()     │  ← 1. Cache check Protheus (leve, só metadata)
│ GET /xmlFiscal/{chave}/exists   │
└─────────────────────────────────┘
         │
    existe?
      / \
    SIM  NÃO
     │    │
     ▼    ▼
  ┌────┐ ┌────────────────────────────────────┐
  │get │ │ NfeDistribuicaoClient              │  ← 2. Download SEFAZ
  └────┘ │ .consultarPorChave(UF, chave)      │
    │    │ POST NFeDistribuicaoDFe (nacional) │
    │    │   <consChNFe><chNFe>...</chNFe>    │
    │    │ Resposta: docZip (base64+gzip)     │
    │    └────────────────────────────────────┘
    │         │
    │         ▼
    │    ┌────────────────────────────────────┐
    │    │ ProtheusGravacaoHelper             │  ← 3. Grava no Protheus (best effort)
    │    │ POST /xmlFiscal                    │
    │    └────────────────────────────────────┘
    │         │
    └────┬────┘
         ▼
┌─────────────────────────────────┐
│ NfeParserService.parse(xml)     │  ← 4. Parse XML → estrutura por abas
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ DocumentoConsultaService        │  ← 5. Upsert em fiscal.documento_consulta
│ .registrar(...)                 │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Frontend NfeConsultaPage        │  ← 6. Exibe 6 abas estruturadas
│ [Dados gerais] [Emitente]       │     + OrigemBadge (cache/SEFAZ/erro)
│ [Destinatário] [Produtos]       │     + Download XML/DANFE
│ [Totais] [Protocolo]            │
└─────────────────────────────────┘
```

---

## 3. Web services SEFAZ usados

### 3.1. NFeDistribuicaoDFe (nacional)

- **Endpoint:**
  - Produção: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
  - Homologação: `https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
- **SOAPAction:** `http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse`
- **Versão:** 1.01
- **Modo usado:** `<consChNFe>` (consulta por chave — **único modo usado pelo fluxo interativo**)
- **Autenticação:** mTLS via certificado A1 ICP-Brasil (gerenciado por `SefazAgentService`)
- **Retorno:** XML autorizado (`<nfeProc>...</nfeProc>`) compactado base64+gzip no `<docZip>`
- **cStat esperado:** `138` (documento localizado)
- **cStat tratados com mensagem amigável:**
  - `641` — NF-e emitida pelo próprio consulente (tentar Protheus ou ERP)
  - `632` — Fora da janela de ~90 dias (solicitar ao emitente)

> **Nota crítica:** o NFeDistribuicaoDFe suporta três modos — `distNSU`, `consNSU`, `consChNFe`. O Módulo Fiscal usa **apenas `consChNFe`** (por chave) no fluxo interativo. O modo `distNSU` (download massivo por NSU sequencial) foi deliberadamente **vetado** hoje (13/04/2026) por risco de bloqueio do CNPJ consulente da CAPUL — ver Seção 6.

### 3.2. NFeConsultaProtocolo4 (per-UF)

- **Endpoint:** varia por UF. MG: `https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4`
- **SOAPAction:** `http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF`
- **Versão:** 4.00
- **Uso:** botão **"Atualizar status no SEFAZ"** — retorna status atual da NF-e (autorizada, cancelada, com CC-e) sem baixar XML de novo.

Mapa completo em `fiscal/backend/src/sefaz/sefaz-endpoints.map.ts` — contempla todas as UFs do Brasil com fallback SVRS/SVAN.

---

## 4. Tabelas Protheus envolvidas

| Tabela | Conteúdo | Endpoint API | Papel no fluxo |
|---|---|---|---|
| `SZR010` | Cabeçalho do XML (1 linha por chave, campo Memo `ZR_XML`) | `GET /xmlFiscal/{chave}`, `GET /xmlFiscal/{chave}/exists`, `POST /xmlFiscal` | Cache primário |
| `SZQ010` | Itens do XML (N linhas, `ZQ_XMLIMP` por item) | `POST /xmlFiscal` grava junto com SZR010 | Alimenta fluxo padrão de entrada de mercadoria |

**Como o Protheus alimenta SZR010/SZQ010:**
- **Saída (CAPUL emite):** Protheus emite, autoriza e grava o XML direto na SZR010 na hora da autorização
- **Entrada (CAPUL recebe):** Monitor DFe do Protheus consome `NFeDistribuicaoDFe` via `<distNSU>` em job agendado, baixa lotes de até 50 documentos e grava automaticamente
- **Gravação manual:** excepcional; geralmente só pra casos em que o XML foi recebido por e-mail e precisa ser anexado via portal interno

O Módulo Fiscal **nunca grava manualmente** em SZR010 — quando baixa um XML via SEFAZ, chama `POST /xmlFiscal` que delega toda a lógica de persistência ao Protheus.

---

## 5. Frontend

**Página:** `/fiscal/nfe` — `fiscal/frontend/src/pages/NfeConsultaPage.tsx`

**Abas exibidas (após consulta bem-sucedida):**

1. **Dados gerais** — número, série, data, natureza, tipo operação, finalidade, ambiente
2. **Emitente** — CNPJ, razão social, IE, endereço, CNAE, regime tributário
3. **Destinatário** — CNPJ, razão social, IE, endereço
4. **Produtos** — tabela com item, código, descrição, NCM, CFOP, quantidade, valor, ICMS
5. **Totais** — base ICMS, valor ICMS, produtos, frete, desconto, IPI, PIS, COFINS, valor total
6. **Protocolo** — número do protocolo, data de autorização, cStat, motivo

**Ações disponíveis:**
- Download do XML bruto (`GET /nfe/{chave}/filial/{filial}/xml`)
- Download do DANFE em PDF (geração local via pdfkit)
- **Atualizar status no SEFAZ** (chama `NFeConsultaProtocolo4` per-UF — 1 chamada avulsa, sem risco de loop)

**Banner "OrigemBadge":** mostra se o XML veio do cache Protheus (`PROTHEUS_CACHE`), de SEFAZ download (`SEFAZ_DOWNLOAD`), ou de race condition (`PROTHEUS_CACHE_RACE`), e o status de gravação Protheus.

---

## 6. Decisão crítica — NSU distribution foi VETADO (13/04/2026)

### Contexto

O portal SEFAZ público exibe, para uma NF-e, não só a autorização mas também **eventos vinculados**: CC-e, cancelamento, ciência da operação, CT-e que a transporta, MDF-e que a referencia. O depto fiscal da CAPUL pediu essa mesma visão de timeline completa na plataforma.

### Tentativa inicial

Foi implementado um `DistNsuSyncService` que chamaria `NFeDistribuicaoDFe` no modo `<distNSU>` sequencialmente — o único modo do serviço que traz eventos vinculados além do documento principal. O código previa um cron diário em 02:30 e um endpoint manual `POST /nfe/sync-nsu`.

### O que aconteceu

Na primeira chamada manual em homologação com `ultNSU=0`, a SEFAZ respondeu:

```
cStat=656
xMotivo=Rejeicao: Consumo Indevido
          (Deve ser utilizado o ultNSU nas solicitacoes subsequentes.
           Tente apos 1 hora)
```

A SEFAZ considerou a requisição massiva (a CAPUL como destinatária acumula milhares de NF-es) e bloqueou o CNPJ consulente `25834847000100` por 1 hora. Esse bloqueio **não afeta só o Módulo Fiscal** — afeta todas as operações fiscais reais da CAPUL (emissão, download, manifestação).

### Decisão tomada

**Todo o fluxo NFe automático foi revertido.** O Módulo Fiscal não faz mais:
- Nenhum cron SEFAZ de NF-e
- Nenhum `distNSU`
- Nenhum retry automático em falhas SEFAZ
- Nenhum download de eventos vinculados

O fluxo do NF-e volta ao design original: **1 chamada SEFAZ por consulta manual do usuário**, tratamento amigável de erros, cache Protheus prioritário.

### Por que o Protheus consegue mas a gente não

O Monitor DFe do Protheus também chama `<distNSU>`, mas ele é **o único dono** do cursor NSU da CAPUL. Se o Módulo Fiscal também começasse a chamar, teriam **dois processos compartilhando o mesmo cursor NSU** — e a SEFAZ não entrega o mesmo NSU duas vezes, gerando cStat=656 ou "buracos" em SZR010.

Conclusão: o dono do cursor NSU é sempre o ERP. O Módulo Fiscal **consome via API Protheus**, nunca em paralelo.

### Para ver eventos vinculados no futuro

Se precisar de timeline de eventos da NF-e no Módulo Fiscal, a abordagem correta é:

1. **Pedir ao Protheus que exponha uma API de eventos**: `GET /xmlFiscal/{chave}/eventos` → retorna procEventoNFe que o próprio Monitor DFe já baixou e armazena em tabelas de evento do Protheus
2. **Nunca** implementar `distNSU` no Módulo Fiscal

Referência do incidente: arquivo `memory/feedback_sefaz_nunca_em_loop.md`.

---

## 7. Código-fonte

### Backend

- `fiscal/backend/src/nfe/nfe.controller.ts` — rotas REST
- `fiscal/backend/src/nfe/nfe.service.ts` — fluxo de consulta + cache Protheus
- `fiscal/backend/src/nfe/parsers/nfe-parser.service.ts` — parser NF-e 4.00
- `fiscal/backend/src/nfe/parsers/nfe-parsed.interface.ts` — tipos das abas
- `fiscal/backend/src/nfe/documento-consulta.service.ts` — upsert em fiscal.documento_consulta
- `fiscal/backend/src/nfe/pdf/danfe-generator.service.ts` — gera DANFE via pdfkit
- `fiscal/backend/src/sefaz/nfe-distribuicao.client.ts` — cliente NFeDistribuicaoDFe
- `fiscal/backend/src/sefaz/nfe-consulta-protocolo.client.ts` — cliente NfeConsultaProtocolo4
- `fiscal/backend/src/sefaz/sefaz-endpoints.map.ts` — mapa de URLs per-UF
- `fiscal/backend/src/protheus/protheus-xml.service.ts` — adapter xmlFiscal

### Frontend

- `fiscal/frontend/src/pages/NfeConsultaPage.tsx` — tela de consulta
- `fiscal/frontend/src/components/OrigemBadge.tsx` — badge de cache/SEFAZ

### Banco de dados

- `fiscal.documento_consulta` — 1 linha por (chave, filial), upsert idempotente
- `fiscal.documento_xml` — opcional, cache de disco do XML (não usado hoje)

---

## 8. Referências

- Portal NF-e — [https://www.nfe.fazenda.gov.br/portal/webServices.aspx](https://www.nfe.fazenda.gov.br/portal/webServices.aspx)
- Nota Técnica 2014.002 — Web Service de Distribuição de DF-e
- Especificação API Protheus — `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md`
- Reunião equipe Protheus — `docs/REUNIAO_PROTHEUS_14ABR2026.md`
- Memória de feedback — `memory/feedback_sefaz_nunca_em_loop.md`
