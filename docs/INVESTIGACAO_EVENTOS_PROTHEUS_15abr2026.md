# Investigação: Onde o Protheus CAPUL armazena eventos SEFAZ de NF-e

**Data**: 15/04/2026
**Autor**: Equipe Plataforma Corporativa — Módulo Fiscal
**Destinatário**: Equipe Protheus (para alinhamento da API de integração)
**Status**: Investigação concluída — aguardando definição da API

---

## 1. Contexto e motivação

O **Módulo Fiscal** da Plataforma Corporativa Capul precisa apresentar, para as áreas fiscal e compras, uma **visão unificada de cada NF-e de entrada** com:

- Dados do documento (cabeçalho, itens, protocolo de autorização SEFAZ)
- **Todos os eventos vinculados** à chave (cancelamento, carta de correção, manifestações do destinatário)
- Status atual da entrada fiscal no Protheus

### Dor operacional atual

Hoje, para baixar XML de NF-e de entrada, a equipe fiscal acessa o **portal SEFAZ (e-CAC)** manualmente, o que exige o **certificado digital instalado em cada máquina**. Além disso, o **processo de importação que alimenta `SZR010` caiu drasticamente em Março/2026** (queda de 93% no volume), deixando um backlog de XMLs não importados.

O objetivo do Módulo Fiscal é:

1. Consumir os dados já presentes no Protheus via **API Protheus em desenvolvimento**
2. **Substituir o acesso manual** ao portal SEFAZ por um fluxo centralizado via **certificado A1 único no servidor**
3. **Cobrir os gaps** do job de importação atual

### Pergunta central desta investigação

> **Onde, exatamente, o Protheus CAPUL armazena os retornos dos eventos SEFAZ (CC-e, cancelamento, manifestação) das NF-es de entrada?**

Tentativas anteriores de obter esses dados via webservice SEFAZ direto e Portal Nacional NF-e não avançaram. A hipótese de trabalho era que esses dados **já estão no Protheus** em alguma tabela não documentada. Esta investigação confirma a hipótese e mapeia as tabelas.

### ⚠️ Decisão de escopo (15/04/2026)

A timeline de eventos exibida pelo módulo Fiscal mostra **apenas eventos das tabelas SPED** (SPED150 + SPED156). Estado operacional Protheus (SF1010, C00010) é **excluído da timeline** porque:

- SPED é fonte oficial — XMLs assinados pela SEFAZ (XML_SIG/XML_RET)
- SF1010 pode ter customizações ADV-PL e falhas operacionais (caso real: 357 NFs com `F1_STATUS` vazio = 2,5% do total)
- Misturar oficial com operacional confunde quem usa o sistema

Estado operacional será exposto em **outra seção** da UI ("Estado no Protheus"), claramente separada, e usado para detectar anomalias (alertas), não para contar a história fiscal.

---

## 2. Ambiente investigado

| Item | Valor |
|---|---|
| Banco Oracle | `CAPULFIS` (recorte de produção feito em Março/2026 — dados mais recentes) |
| Host | `192.168.7.85:1521` |
| Service name | `capulfis` |
| Schema Protheus | `TOTVS_PRD` |
| Schema TSS local | `SPED_NFE` |
| Usuário usado | `totvs_prd` (read-only para a investigação) |
| Ferramenta | Oracle SQLcl 25.3.1 |

> Observação: os bancos `capulhlg` e `capuldsv` (host `192.168.7.92`) foram consultados antes mas têm estrutura diferente — várias tabelas do dicionário SX2/SX3 não existem fisicamente lá. **Toda a análise final foi feita em `CAPULFIS`**.

---

## 3. Metodologia

1. Inventário das tabelas existentes fisicamente em `TOTVS_PRD` e `SPED_NFE` via `all_tables` / `all_tab_columns`
2. Busca no dicionário Protheus (`SX2010`/`SX3010`) por nomes e campos relacionados a evento, CC-e, cancelamento, manifestação, chave NFe
3. Inspeção de estruturas candidatas (colunas, tipos, BLOB/CLOB)
4. Contagem de registros por tabela
5. Amostragem de conteúdo (com decodificação de BLOBs para ver se são XML válido)
6. **Cruzamentos** entre tabelas pela chave NFe de 44 dígitos
7. Agrupamento por `TPEVENTO` para entender cobertura dos códigos SEFAZ

Todas as queries foram **read-only** (`SELECT` puro, sem DDL ou DML).

---

## 4. Descobertas principais

### 4.1 Mapa resumido das tabelas relevantes

| Tabela | Schema | Linhas ativas | Papel |
|---|---|---:|---|
| **`SZR010`** | `TOTVS_PRD` | **9.278** NFe mod. 55 | XMLs importados — cabeçalho (XML completo em `ZR_XML` BLOB) |
| **`SZQ010`** | `TOTVS_PRD` | **63.495** | XMLs importados — itens (com de-para para código Protheus) |
| **`C00010`** | `TOTVS_PRD` | **7.291** | Manifesto do destinatário — espelho simples do distDFe (sem XML bruto) |
| **`SPED150`** | `SPED_NFE` | **9.922** | ⭐ Eventos NF-e **enviados pela CAPUL** (manifestações + CC-e + cancelamento próprios) |
| **`SPED156`** | `SPED_NFE` | **7.521** | ⭐⭐ Retorno do `NFeDistribuicaoDFe` — inclui **eventos de terceiros** (CC-e e cancelamento dos fornecedores) |
| `SPED154` | `SPED_NFE` | 20.323 | Log histórico de eventos (mesma estrutura de `SPED150`) |
| `SPED050` | `SPED_NFE` | 162.255 | NFes emitidas pela CAPUL (cabeçalho) — escopo saída |
| `SF1010` | `TOTVS_PRD` | 14.171 | NF Entrada (entrada fiscal dada) |
| `SF2010` | `TOTVS_PRD` | — | NF Saída |

### 4.2 `SZR010` + `SZQ010` — XMLs importados (sem eventos)

**Propósito**: essas são as tabelas custom onde o job de importação Protheus grava os XMLs completos das NF-es de entrada quando baixados.

**Evidência de XML real**: amostra do BLOB `ZR_XML` do registro mais recente começa com:
```xml
<cteProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte"><CTe...
```
(exemplo de CT-e; NFes trazem `<nfeProc>`)

**Volume mensal (mostrando o colapso do job)**:

| Mês | NFes importadas | Tamanho total |
|---|---:|---:|
| Jan/2026 | 4.791 | 58,4 MB |
| Fev/2026 | 4.962 | 57,9 MB |
| **Mar/2026** | **350** ⚠️ | 3,5 MB |
| Abr/2026 (até 15/04) | **2** ⚠️ | ~0 MB |

> **Interpretação**: o processo que populava `SZR010` quebrou em Março/2026. **Esse é o gatilho operacional do Módulo Fiscal** — precisamos entender o que rodava e se será reativado, ou se o módulo assume o papel.

### 4.3 `SPED150` — eventos que a CAPUL gerou/enviou

**Distribuição por tipo de evento**:

| TPEVENTO | Descrição | Qtd | Direção |
|---:|---|---:|---|
| 210210 | Manifestação: Confirmação da Operação | 7.095 | ⬅️ Entrada |
| 110111 | Cancelamento | 1.985 | ➡️ Saída |
| 110112 | Cancelamento por substituição | 595 | ➡️ Saída |
| 210200 | Manifestação: Ciência da Operação | 212 | ⬅️ Entrada |
| 210240 | Manifestação: Operação Não Realizada | 26 | ⬅️ Entrada |
| 110110 | CC-e (Carta de Correção) | 12 | ➡️ Saída |
| 610110 | CC-e de CT-e | 4 | Transporte |

**Estrutura relevante**:

| Coluna | Tipo | Descrição |
|---|---|---|
| `NFE_CHV` | CHAR(44) | Chave NF-e |
| `TPEVENTO` | NUMBER | Código SEFAZ do evento |
| `SEQEVENTO` | NUMBER | Sequência (para CC-e permite múltiplas) |
| `DATE_EVEN`/`TIME_EVEN` | CHAR | Data/hora do evento |
| `DHREGEVEN` | CHAR(30) | Data/hora de registro SEFAZ |
| `CSTATEVEN` | NUMBER | Código de status SEFAZ do evento |
| `CMOTEVEN` | CHAR(254) | Motivo SEFAZ |
| `XML_ERP` | BLOB | XML gerado pelo ERP |
| `XML_SIG` | BLOB | XML assinado |
| **`XML_RET`** | BLOB | **XML de retorno do SEFAZ** |
| `XML_CANC` / `XML_RETCAN` | BLOB | XMLs de cancelamento do evento |
| `PROTOCOLO` | NUMBER | Número do protocolo |
| `EVENPROT` | CHAR(17) | Protocolo do evento |

### 4.4 `SPED156` — retorno do `NFeDistribuicaoDFe` ⭐

**Esta é a tabela mais importante para o caso de uso de eventos de entrada.**

O Protheus grava aqui **o resultado de cada chamada ao webservice `NFeDistribuicaoDFe`** (distDFe por NSU), que inclui:

- Resumo das NF-es emitidas contra o CNPJ da CAPUL
- **Eventos gerados por terceiros** sobre essas NF-es: cancelamento do fornecedor, CC-e do fornecedor, etc.

**Cobertura dos BLOBs (7.521 registros ativos)**:

| BLOB | Preenchidos | % |
|---|---:|---:|
| `DOCXMLRET` (resumo da NFe) | 7.500 | 99,7% |
| `CANCXMLRET` (XML cancelamento de terceiro) | **244** | 3,2% |
| `CCEXMLRET` + `CCECORR` (XML CC-e de terceiro) | **37** | 0,5% |
| `ZIPNFE` (XML NFe compactado) | 0 | 0% |
| `ZIPPROT` (protocolo compactado) | 0 | 0% |

> **Observação importante**: `ZIPNFE` e `ZIPPROT` estão **sempre vazios**. Ou seja, o job de distDFe do Protheus recebe o resumo mas **não baixa o XML completo via `downloadNFe`**. Para baixar o XML completo, existe o outro processo (o que alimenta `SZR010`) — e esse está em colapso desde Março/2026.

**Estrutura principal**:

| Coluna | Tipo | Descrição |
|---|---|---|
| `DOCCHV` | CHAR(44) | Chave da NF-e |
| `DOCNSU` | CHAR(15) | NSU do distDFe (documento) |
| `DOCDTEMIS` / `DOCDTAUT` | CHAR(8) | Datas de emissão / autorização SEFAZ |
| `DOCSIT` | CHAR(1) | Situação do documento (`1`=autorizada, `3`=cancelada, ...) |
| `DOCTPOP` | CHAR(1) | Tipo operação |
| `DOCVTOT` | NUMBER | Valor total da NF |
| `DOCXMLRET` | BLOB | XML do resumo retornado pelo distDFe |
| `EMITCNPJ` / `EMITCPF` | CHAR | CNPJ/CPF do emitente |
| `EMITNOME` | CHAR(60) | Nome/razão social do emitente |
| `DESTCNPJ` | CHAR(14) | CNPJ do destinatário (CAPUL) |
| **`CANCNSU`** | CHAR(15) | **NSU do evento de cancelamento de terceiro** |
| **`CANCDTEMIS`/`CANCDTAUT`** | CHAR(8) | Datas do cancelamento |
| **`CANCXMLRET`** | BLOB | **XML do cancelamento emitido pelo fornecedor** |
| **`CCENSU`** | CHAR(15) | NSU do evento CC-e de terceiro |
| **`CCEDTEMIS`/`CCEDTAUT`** | CHAR(8) | Datas da CC-e |
| **`CCECORR`** | BLOB | Texto da correção |
| **`CCEXMLRET`** | BLOB | XML da CC-e emitida pelo fornecedor |
| `ENCNSU`/`ENCXMLRET` | CHAR/BLOB | Encerramento (MDF-e) |
| `CONDNSU`/`CONDXMLRET` | CHAR/BLOB | Condutor (MDF-e) |
| `RESPDTHR`/`RESPGSTAT`/`RESPGMOT`/`RESPSTAT`/`RESPMOT` | CHAR/BLOB | Retorno geral da chamada distDFe |
| `STATDOWN` | CHAR(1) | Status do download |

### 4.5 Cruzamento entre as tabelas

Chave NF-e de 44 dígitos como join:

| Relação | Linhas | % do total `SPED156` |
|---|---:|---:|
| **`SPED156` total** | 7.521 | 100% |
| `SPED156 ∩ SZR010` (distDFe + XML baixado) | 6.995 | **93%** |
| `SPED156 ∩ SF1010` (entrada fiscal dada) | 6.647 | 88% |
| **`SPED156 \ SZR010`** (distDFe chegou mas XML NÃO baixado) | **526** | **7%** |
| `SPED150` cuja chave também está em `SZR010` | 7.135 | — |

**Os 526 registros órfãos de `SZR010` são o backlog imediato**: o SEFAZ já avisou que existem NFes contra a CAPUL, mas o Protheus não baixou o XML completo. São os candidatos diretos para o fallback de download via A1 centralizado do Módulo Fiscal.

---

## 5. Timeline completa de uma NF-e de entrada

Combinando as tabelas por chave, o Módulo Fiscal pode montar a seguinte **linha do tempo** para cada NF-e:

```
┌────────────────────────────────────────────────────────────────┐
│  FORNECEDOR                                                    │
│  └─▶ emite NFe     → SEFAZ autoriza                            │
│                                                                │
│  SEFAZ                                                         │
│  └─▶ disponibiliza via distDFe (por NSU)                       │
│                                                                │
│  PROTHEUS CAPUL                                                │
│  ├─▶ [1] job distDFe grava em SPED156.DOCCHV                   │
│  │     (com DOCXMLRET = resumo)                                │
│  │                                                             │
│  ├─▶ [2] job download XML grava em SZR010.ZR_XML               │
│  │     (com XML completo + itens em SZQ010)                    │
│  │     ↑ ESTE PASSO ESTÁ QUEBRADO DESDE MAR/2026               │
│  │                                                             │
│  ├─▶ [3] CAPUL envia manifestação (210200 ciência ou           │
│  │     210210 confirmação) → grava em SPED150                  │
│  │                                                             │
│  ├─▶ [4] (se houver) Fornecedor emite CC-e ou cancelamento     │
│  │     → novo distDFe grava em SPED156.CCEXMLRET /             │
│  │       SPED156.CANCXMLRET                                    │
│  │                                                             │
│  └─▶ [5] Usuário dá entrada fiscal → grava em SF1010           │
│                                                                │
│  PLATAFORMA FISCAL (novo)                                      │
│  └─▶ Lê tudo acima por chave e apresenta timeline unificada    │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. Gaps identificados (problemas reais que o Módulo Fiscal resolve)

| # | Gap | Evidência | Proposta |
|---|---|---|---|
| G1 | Processo de importação de XML completo (SZR010) caiu em Mar/2026 | Volume caiu de 4.962 (Fev) para 350 (Mar) e 2 (Abr parcial) | Módulo Fiscal assume como fallback, com A1 centralizado, ou equipe Protheus reativa o job |
| G2 | 526 NFes conhecidas via distDFe mas **sem XML completo** no banco | `SPED156 \ SZR010` = 526 linhas | Módulo Fiscal baixa via `NFeConsultaProtocolo` e grava em `SZR010` |
| G3 | Acesso ao portal SEFAZ exige certificado instalado em N máquinas | Processo atual | Módulo Fiscal centraliza A1 único no servidor |
| G4 | Não há visão unificada das NFes de entrada (hoje é planilha/portal) | Observação operacional | Nova UI no Módulo Fiscal lendo as 4 tabelas por chave |

---

## 7. Proposta para a equipe Protheus — contrato da API

A API Protheus em desenvolvimento deve expor os dados já existentes nas tabelas `SZR010`, `SZQ010`, `SPED150`, `SPED156` (e opcionalmente `SF1010` e `C00010`). Sugestão de endpoints:

### 7.1 Endpoints REST propostos

#### `GET /api/v1/fiscal/nfe/{chave}`

Retorna a **visão unificada** de uma NF-e por chave de 44 dígitos, com tudo que o Protheus conhece sobre ela.

**Response 200** (JSON):
```json
{
  "chave": "31260325834847000100550010026204661117760414",
  "emitente": {
    "cnpj": "25834847000100",
    "nome": "COOPERATIVA AGROPECUARIA UNAI LTDA",
    "ie": "...",
    "uf": "MG"
  },
  "destinatario": { "cnpj": "...", "nome": "CAPUL" },
  "documento": {
    "numero": "002620466",
    "serie": "001",
    "modelo": "55",
    "dataEmissao": "2026-03-03",
    "dataAutorizacao": "2026-03-03",
    "valorTotal": 10232.00,
    "situacao": "autorizada",
    "protocolo": "131..."
  },
  "xml": {
    "completo": "<nfeProc>...</nfeProc>",     // base64 ou string
    "disponivel": true,
    "origem": "SZR010",
    "dataImportacao": "2026-03-03T15:22:00Z"
  },
  "itens": [
    {
      "numero": 1,
      "codigoProduto": "...",
      "descricao": "...",
      "ean": "...",
      "um": "KG",
      "quantidade": 10,
      "valorUnitario": 100,
      "valorTotal": 1000,
      "cfop": "5102",
      "codigoProtheus": "...",   // ZQ_CODSIG (de-para)
      "pedidoCompra": "...",      // ZQ_PEDCOM
      "itemPedidoCompra": "..."   // ZQ_ITEMPC
    }
  ],
  "eventos": [
    {
      "origem": "SPED156",
      "tipo": "AUTORIZACAO",
      "descricao": "NFe autorizada SEFAZ",
      "dataAutorizacaoSefaz": "2026-03-02T08:59:34-03:00",
      "enviadoPor": "FORNECEDOR"
    },
    {
      "origem": "SPED150",
      "tipo": 210210,
      "descricao": "Manifestação: Confirmação da Operação",
      "sequencia": 1,
      "dataEventoErp":   "2026-03-02T09:54:19-03:00",
      "dataEventoSefaz": "2026-03-02T09:54:44-03:00",
      "latenciaSegundos": 25,
      "status": "autorizado",
      "cStat": 135,
      "motivo": "Evento registrado e vinculado a NF-e",
      "protocolo": "891262938222515",
      "xmlRetorno": "<...>",
      "enviadoPor": "CAPUL"
    },
    {
      "origem": "SPED156",
      "tipo": "CANCELAMENTO_TERCEIRO",
      "descricao": "Cancelamento do fornecedor",
      "dataEmissao": "2026-03-02",
      "dataAutorizacaoSefaz": "2026-03-02T10:11:02-03:00",
      "nsu": "000000000652789",
      "xmlRetorno": "<...>",
      "enviadoPor": "FORNECEDOR"
    },
    {
      "origem": "SPED156",
      "tipo": "CCE_TERCEIRO",
      "descricao": "CC-e do fornecedor",
      "texto": "...",
      "nsu": "...",
      "dataAutorizacaoSefaz": "2026-03-02T11:00:00-03:00",
      "xmlRetorno": "<...>",
      "enviadoPor": "FORNECEDOR"
    }
  ],
  "estadoProtheus": {
    "// NOTA": "Estado operacional, NAO eh evento SEFAZ. Usado para alertas, nao para timeline.",
    "entradaFiscal": {
      "presente": true,
      "origem": "SF1010",
      "numero": "000000123",
      "dataDigitacao": "2026-03-10",
      "horaDigitacao": "11:55",
      "status": "(vazio - nao finalizada)",
      "fornecedorProtheus": "F00051",
      "lojaProtheus": "01"
    },
    "alertas": [
      {
        "nivel": "warning",
        "tipo": "STATUS_VAZIO",
        "mensagem": "F1_STATUS vazio — entrada nao foi finalizada"
      },
      {
        "nivel": "error",
        "tipo": "ENTRADA_APOS_CANCELAMENTO",
        "mensagem": "Entrada fiscal dada apos o cancelamento conhecido pelo SEFAZ"
      }
    ]
  }
}
```

> **Importante para a equipe Protheus**: o array `eventos` deve conter exclusivamente registros vindos das tabelas `SPED150` e `SPED156`. Estado operacional (`SF1010`, `C00010`) vai no objeto `estadoProtheus`, separado, e alimenta o array de `alertas` quando há anomalia detectada.

**Response 404**: chave não encontrada em nenhuma das tabelas.

**Response 206 — parcial**: chave existe em `SPED156` mas **não há XML** em `SZR010`. Módulo Fiscal pode então acionar fallback de download via A1.
```json
{
  "chave": "...",
  "xml": { "disponivel": false, "origem": null },
  "observacao": "Chave conhecida via distDFe (SPED156), mas XML completo ainda não foi importado em SZR010."
}
```

#### `GET /api/v1/fiscal/nfe/entrada?fornecedor=&dataInicio=&dataFim=&situacao=&temCCe=&temCancelamento=&page=&size=`

Lista paginada de NFes de entrada com filtros, retornando resumo (sem XML).

**Filtros úteis**:
- `situacao`: `autorizada` | `cancelada` | `denegada`
- `temCCe=true` → `SPED156.CCEXMLRET IS NOT NULL`
- `temCancelamento=true` → `SPED156.CANCXMLRET IS NOT NULL` OR `DOCSIT='3'`
- `xmlBaixado=false` → `SPED156 \ SZR010` (o backlog)
- `semEntradaFiscal=true` → `SZR010 \ SF1010`
- `semManifestacao=true` → `SPED156 \ SPED150 (210210)`

#### `GET /api/v1/fiscal/nfe/{chave}/xml`

Retorna diretamente o conteúdo de `SZR010.ZR_XML` (ou 404 se não existe).

#### `POST /api/v1/fiscal/nfe/{chave}/manifestar`

Registra um evento de manifestação do destinatário. Aciona o job Protheus existente que envia para SEFAZ e grava em `SPED150`.

**Body**:
```json
{
  "tipo": 210210,
  "justificativa": "..."
}
```

### 7.2 SQL de referência (já validados na investigação)

Estão no anexo A.

### 7.3 Requisitos não funcionais sugeridos

| Requisito | Valor proposto |
|---|---|
| Autenticação | Bearer Token (compatível com JWT do Auth Gateway) |
| Latência p95 | < 500ms para `GET /nfe/{chave}` (chave tem índice) |
| Paginação | Page/size padrão, máx 200 por página |
| Rate limit | 60 req/min por usuário |
| Modo read-only | A API **não grava** em tabelas Protheus (exceto o endpoint de manifestação, que usa job existente) |
| Caches | Permitir `Cache-Control: private, max-age=60` para `GET /nfe/{chave}` |

---

## 8. Próximos passos

### Para a equipe Protheus
1. **Validar este mapa de tabelas** — confirmar que nossa interpretação dos campos está correta
2. **Confirmar o contrato da API** da seção 7 ou propor ajustes
3. **Estimar prazo** para os endpoints prioritários (`GET /nfe/{chave}` e `GET /nfe/entrada`)
4. **Esclarecer o status do job que popula `SZR010`** — por que caiu em Mar/2026? Será reativado?
5. **Confirmar índices** existentes em `SZR010.ZR_CHVNFE`, `SPED150.NFE_CHV`, `SPED156.DOCCHV` (para garantir performance)

### Para a equipe Plataforma / Módulo Fiscal
1. Aguardar retorno da equipe Protheus antes de começar o consumo
2. Enquanto isso, evoluir o protótipo de UI do Módulo Fiscal usando as chaves-amostra
3. Implementar o fallback de download via A1 centralizado para os 526 registros de `SPED156 \ SZR010`
4. Definir política de sincronização/cache do Módulo Fiscal (ler sob demanda ou pré-popular?)

### Questões abertas
- [ ] O job de importação de `SZR010` pode ser reativado? Se sim, o Módulo Fiscal vira **consumidor** em vez de **backfill**.
- [ ] Existe log/erro do job que parou em Mar/2026?
- [ ] O schema `SPED_NFE` é o TSS da CAPUL ou um mirror? Qual a frequência de sincronização?
- [ ] `ZIPNFE`/`ZIPPROT` em `SPED156` estão sempre vazios porque o job não pede esses campos no distDFe — pode ser habilitado?

---

## 9. Anexos

### Anexo A — Queries SQL de validação

Ver arquivo companheiro: [`docs/sql/queries_eventos_nfe_entrada.sql`](./sql/queries_eventos_nfe_entrada.sql)

### Anexo B — Códigos de evento SEFAZ (referência rápida)

| Código | Descrição | Usado em |
|---:|---|---|
| 110110 | CC-e (Carta de Correção) | Emitente NFe |
| 110111 | Cancelamento | Emitente NFe |
| 110112 | Cancelamento por substituição | Emitente NFe |
| 110140 | EPEC | Emitente NFe (contingência) |
| 210200 | Manifestação: Ciência da Operação | Destinatário NFe |
| 210210 | Manifestação: Confirmação da Operação | Destinatário NFe |
| 210220 | Manifestação: Desconhecimento da Operação | Destinatário NFe |
| 210240 | Manifestação: Operação Não Realizada | Destinatário NFe |
| 610110 | CC-e de CT-e | Emitente CTe |
| 310600 | Cancelamento CT-e | Emitente CTe |

### Anexo C — Códigos de status SEFAZ mais frequentes

| cStat | Significado |
|---:|---|
| 100 | NF autorizada |
| 101 | Cancelamento homologado |
| 135 | Evento registrado e vinculado |
| 138 | Documento localizado |
| 155 | Cancelamento homologado fora do prazo |
| 573 | Rejeição: duplicidade de evento |
| 596 | Rejeição: evento apresentado após prazo |

### Anexo D — Chaves de NF-e reais para teste

15 chaves selecionadas do `CAPULFIS` (todas com XML completo em `SZR010` + itens em `SZQ010`):

```
31260325834847003622550010000846021389402924   Coop. Agrop. Unaí   15 itens
53260334274233001257550000022748911908762609   Vibra Energia        1 item
31260325834847001840550010005544441158042970   Coop. Agrop. Unaí    3 itens
35260253309795000180550010007826731940096253   Morlan S/A           2 itens
31260310260716000181550040004698751826834460   Noroeste MG Bebidas 10 itens
31260325834847002650550010000019901325800857   Coop. Agrop. Unaí    4 itens
31260325834847000100550010026204501948329256   Coop. Agrop. Unaí   11 itens
31260244155254000154550010000154351101173360   Triângulo das Gerais 2 itens
31260325834847000100550010026204661117760414   Coop. Agrop. Unaí    5 itens
31260201684129000129550010000006161745974150   Vitraux Vidros       1 item
31260225834847002650550010000019851793887028   Coop. Agrop. Unaí    6 itens
31260325834847001840550010005544971645568946   Coop. Agrop. Unaí    3 itens
31260325834847001840550010005544431116264284   Coop. Agrop. Unaí    3 itens
53260334274233001257550000022748891908731268   Vibra Energia        1 item
31260325834847001840550010005544961101940886   Coop. Agrop. Unaí    9 itens
```

### Anexo E — 12 chaves do backlog (recebidas após o recorte CAPULFIS)

Essas chaves não estão em nenhuma tabela do CAPULFIS (emitidas após o corte de Mar/2026), mas servem de **caso de teste para o fallback** de download do Módulo Fiscal:

```
31260443214055000107550000254957541872343470
31260443214055000107550000254957551872343486
31260443214055000107550000254957561872343491
31260443214055000107550000254957571872343502
31260443214055000107550000254957581872343518
31260443214055000107550000254957591872343523
31260443214055000107550000254957601872343532
31260443214055000107550000254957611872343548
31260443214055000107550000254957621872343561
31260443214055000107550000254957631872343585
31260404695085000120550010013076931300667114
31260401838723044337550010062994511456301210
```

---

## 10. Histórico do documento

| Versão | Data | Autor | Descrição |
|---|---|---|---|
| 1.0 | 2026-04-15 | Plataforma / Módulo Fiscal | Versão inicial com investigação completa em CAPULFIS |
