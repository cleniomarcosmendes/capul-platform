# CAPUL — Cooperativa Agropecuária Unaí Ltda

## Plataforma Capul — Módulo Fiscal

### Especificação de API — Integração Protheus

**Documento técnico para análise e orçamento pelo time Protheus/TOTVS**

- **Autor:** Clenio Marcos — Departamento de T.I.
- **Data:** 11/04/2026
- **Versão:** 2.0
- **Versão anterior:** 1.1 (10/04/2026)

---

## Histórico de versões

| Versão | Data | Resumo |
|---|---|---|
| 1.0 | 10/04/2026 | Versão inicial. Recurso `cadastroFiscal` somente leitura, parâmetros `tipo`, `ativo`, `filial`, `desdeData`, paginação. |
| 1.1 | 10/04/2026 | Adicionado o parâmetro `comMovimentoDesde` para suportar a rotina diária do Módulo Fiscal (clientes/fornecedores com movimento fiscal/financeiro recente no Protheus). |
| **2.0** | **11/04/2026** | **Mudança de escopo após validação do Setor Fiscal/TI:** (1) **Novo recurso `xmlFiscal`** — POST para gravar XML baixado do SEFAZ em SZR010 (cabeçalho) e SZQ010 (itens), GET para recuperar e `/exists` para cache check leve; (2) **Permissão de escrita restrita** em SZR010/SZQ010 para o usuário técnico `API_FISCAL` (na v1.x era apenas leitura); (3) **Esclarecimento sobre `dataUltimoMovimento`** — campo solicitado em v1.1 cuja implementação tem esforço variável (JOIN on-the-fly × coluna materializada × view × job auxiliar) e merece estimativa separada do time Protheus; (4) **Estrutura real das tabelas SZR010/SZQ010 incorporada** com base no dicionário de dados fornecido pela TI da CAPUL (`SZQ_SZR.csv`, X3 do Protheus, recebido em 11/04/2026): SZR é o cabeçalho contendo o XML completo no campo Memo `ZR_XML`; SZQ contém uma linha por item do XML com os campos do XML mais campos "siga" reservados para o casamento manual NF × pedido durante a entrada de mercadoria. As tabelas suportam tanto NF-e quanto CT-e via `ZR_TPXML`/`ZR_MODELO`. Ver Seção 4.3 e Anexo C. |

---

## 1. Contexto e Objetivo

A CAPUL está desenvolvendo um novo módulo interno da Plataforma Capul chamado **Módulo Fiscal**. Após a primeira rodada de validação com o Setor Fiscal e a equipe de T.I., o módulo passou a abrigar **três frentes** que dependem desta API:

1. **Cruzamento cadastral (Sintegra/CCC × SA1010/SA2010)** — sincronizar periodicamente a base de clientes e fornecedores do Protheus com o cadastro de contribuintes mantido pelas SEFAZ estaduais, gerar relatório consolidado e alertar sobre rebaixamentos. Já estava na v1.0 deste documento.
2. **Persistência de XMLs faltantes em SZR010 (cabeçalho) + SZQ010 (itens)** *(NOVO na v2.0)* — quando o monitor de NF-e do Protheus, por qualquer motivo, não consegue baixar automaticamente um XML autorizado pela SEFAZ, o Módulo Fiscal entra em cena: baixa o XML via web service `NFeDistribuicaoDFe` (com seu próprio certificado A1) e o **grava em SZR010 + SZQ010 do Protheus**, alimentando o fluxo padrão de entrada de mercadoria do ERP. Sem esta etapa o Módulo Fiscal seria apenas mais uma "ferramenta de consulta avulsa" — o objetivo real é fechar o gap operacional do monitor de NF-e.
3. **Cache do Protheus para evitar consultas redundantes ao SEFAZ** *(NOVO na v2.0)* — antes de bater no `NFeDistribuicaoDFe`, o Módulo Fiscal consulta SZR010 para ver se a chave já está armazenada. Se está, usa o XML do Protheus diretamente (recuperando o conteúdo do campo Memo `ZR_XML`); se não, baixa, grava (frente 2) e usa. Isso reduz drasticamente o tráfego à SEFAZ e protege a quota de consultas do CNPJ.

A v2.0 deste documento formaliza, junto à frente `cadastroFiscal` da v1.1, o novo recurso REST `xmlFiscal` que viabiliza as frentes 2 e 3.

### 1.1. Por que um endpoint REST?

Mantém-se a justificativa da v1.0: a CAPUL já tem uma API REST oficial do Protheus publicada em `PROTHEUS_API_URL` (`https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES`), consumida pelo módulo Inventário. Há precedente técnico, infraestrutura disponível e padrão arquitetural consolidado. REST oferece desacoplamento, versionamento, logs centralizados, autenticação unificada, menor risco operacional e ausência de dependência do schema interno do Protheus.

A novidade da v2.0 é que o recurso `xmlFiscal` introduz **operações de escrita** (POST), exigindo a primeira permissão de escrita para a credencial técnica `API_FISCAL` em duas tabelas específicas (SZR010 e SZQ010). Detalhes e justificativa estão na Seção 5 (Segurança).

### 1.2. Alternativas consideradas

Mantidas as três alternativas da v1.1 para o recurso `cadastroFiscal`. Para o recurso `xmlFiscal`, não há alternativa razoável: gravar XMLs do lado externo via SQL direto em SZR010/SZQ010 seria altamente arriscado (acoplamento ao schema interno do Protheus, sem validação ADVPL de assinatura, sem garantia de consistência cabeçalho ↔ itens, sem disparar gatilhos do monitor de NF-e). **A criação do endpoint REST é fortemente preferida.**

---

## 2. Escopo da Integração

### 2.1. O que o Módulo Fiscal precisa

**Frente cadastroFiscal (mantida da v1.1):**
- Ler a lista de Clientes ativos (SA1010) com os campos fiscais essenciais.
- Ler a lista de Fornecedores ativos (SA2010) com os campos fiscais essenciais.
- Obter o carimbo de data/hora da última alteração de cada registro.
- Filtrar por filial.
- Obter um registro específico por CNPJ.
- Filtrar por movimento fiscal/financeiro recente (`comMovimentoDesde`).

**Frente xmlFiscal (NOVA na v2.0):**
- Verificar se um XML já está armazenado em SZR010 (cache check leve por chave, antes de decidir consultar o SEFAZ).
- Recuperar o XML armazenado (campo Memo `ZR_XML` em SZR010, mais metadados extraídos das colunas de SZR010 e a contagem de itens em SZQ010) para parsing pelo Módulo Fiscal.
- **Gravar um novo XML em SZR010 (cabeçalho) + SZQ010 (1 linha por item do XML)**, com validação de assinatura digital, idempotência (não duplicar se a chave já existir em SZR010) e marcação de origem em `ZR_USRREC`. Os campos "siga" da SZQ010 (`ZQ_CODSIG`, `ZQ_QTSIGA`, `ZQ_VLSIGA`, `ZQ_PEDCOM`, `ZQ_ITEMPC`) **NÃO** são preenchidos pela API — eles são reservados para o casamento manual NF × pedido durante a entrada de mercadoria executada pelo usuário do Protheus.

> **Suporte simultâneo a NF-e e CT-e**: a estrutura SZR010/SZQ010 acomoda os dois modelos via os campos `ZR_TPXML` (tipo do XML), `ZR_MODELO` (modelo SEFAZ — 55 NF-e, 57 CT-e, etc.) e `ZR_TPNF` (tipo da NF — entrada/saída) no cabeçalho, e `ZQ_CHVCTE`, `ZQ_CTNF`, `ZQ_CTSER`, `ZQ_CTFOR`, `ZQ_CTLOJ` nos itens (campos específicos de CT-e). O endpoint POST trata as duas frentes uniformemente, decidindo o preenchimento dos campos específicos a partir do `tipoDocumento` informado e da inspeção do XML.

### 2.2. O que NÃO faz parte do escopo

- Nenhuma escrita no Protheus exceto **SZR010 e SZQ010** (frente xmlFiscal, restrito a `INSERT` — sem `UPDATE`/`DELETE`). **Nenhuma escrita em SA1010, SA2010, SF1, SF2, SE1, SE2, SC5, SC7 ou qualquer outra tabela.**
- Nenhuma operação sobre notas fiscais já armazenadas: o Módulo Fiscal não cancela, não atualiza, não altera o status interno do monitor de NF-e.
- Nenhuma transformação de dados complexa — só leitura/gravação dos campos essenciais.
- Autenticação de usuário final — o acesso é servidor-a-servidor com credencial técnica.

### 2.3. Volume esperado

**Frente cadastroFiscal (inalterado):** 36.730 registros ativos em SA1010 + 79.383 em SA2010 = 116.113 contribuintes ativos.
- Rotina diária: dezenas a baixas centenas de chamadas/dia.
- Rotina semanal: ~120-250 chamadas paginadas (com `porPagina` 500 ou 1000).
- Consulta pontual: dezenas de chamadas/dia.

**Frente xmlFiscal (NOVA):**
- `GET /xmlFiscal/{chave}/exists` — chamado **toda vez** que um usuário consulta uma chave NF-e ou CT-e na UI do Módulo Fiscal. Volume estimado: dezenas a baixas centenas/dia em regime estável.
- `GET /xmlFiscal/{chave}` — chamado quando o `exists` retorna `true` (cache hit). Frequência: cobre a maior parte das consultas, porque a CAPUL é destinatária da maioria das NF-es que precisa visualizar, então o XML quase sempre já está no Protheus.
- `POST /xmlFiscal` — chamado quando o `exists` retorna `false` e o módulo acabou de baixar um XML novo do SEFAZ. Volume estimado: muito baixo (dezenas/dia no máximo) — são justamente os XMLs que escaparam do monitor automático.

Todas as chamadas são servidor-a-servidor entre o Módulo Fiscal e a API do Protheus.

---

## 3. Especificação dos Endpoints

### 3.1. Resumo

| # | Endpoint | Verbo | Finalidade |
|---|---|---|---|
| 1 | `/cadastroFiscal` | GET | Lista paginada de SA1010 ou SA2010 com sincronização incremental (`desdeData`, `comMovimentoDesde`). |
| 2 | `/cadastroFiscal/{cnpj}` | GET | Consulta pontual de um único CNPJ. |
| 3 | `/cadastroFiscal/health` | GET | Health check (cadastro). |
| **4** | **`/xmlFiscal/{chave}/exists`** | **GET** | **Cache check leve — informa se a chave já está em SZR010.** |
| **5** | **`/xmlFiscal/{chave}`** | **GET** | **Recupera o XML armazenado (campo `ZR_XML` em SZR010 + metadados de SZR010 + contagem de itens em SZQ010).** |
| **6** | **`/xmlFiscal`** | **POST** | **Grava um novo XML: insere 1 linha em SZR010 (cabeçalho com `ZR_XML`) e N linhas em SZQ010 (1 por item do XML), com validação de assinatura e idempotência por chave.** |
| **7** | **`/xmlFiscal/health`** | **GET** | **Health check (XML).** |

### 3.2. Nomenclatura proposta

```
Base:    https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES
Recurso: /cadastroFiscal  (frente Sintegra/CCC × SA1/SA2)
Recurso: /xmlFiscal        (frente persistência/cache de XMLs)
```

A nomenclatura pode ser ajustada a critério do time Protheus.

### 3.3. Endpoint 1 — Listagem de cadastros (`GET /cadastroFiscal`)

**Inalterado em relação à v1.1.** Reproduzido aqui apenas para integridade do documento.

#### 3.3.1. Parâmetros de query

| Parâmetro | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `tipo` | string | SIM | `SA1010` (Clientes) ou `SA2010` (Fornecedores). |
| `ativo` | boolean | NÃO | Padrão `true`. Quando `true`, retorna apenas registros não bloqueados (`A1_MSBLQL`/`A2_MSBLQL` ≠ '1'). |
| `filial` | string | NÃO | Código de filial (2 dígitos). Se omitido, retorna todas. |
| `desdeData` | string ISO 8601 | NÃO | Filtra por **alteração de cadastro** posterior à data. |
| `comMovimentoDesde` | string ISO 8601 | NÃO | Filtra por **movimento fiscal/financeiro** posterior à data. Ver Seção 3.3.6 para detalhes e nota da v2.0 sobre esforço variável. |
| `pagina` | integer | NÃO | Página (1-based). Padrão `1`. |
| `porPagina` | integer | NÃO | Registros por página. Padrão `500`, máximo `2000`. |

#### 3.3.2. Resposta de sucesso (HTTP 200)

```json
{
  "tipo": "SA2010",
  "filial": null,
  "ativo": true,
  "desdeData": "2026-04-09T23:59:59",
  "paginacao": {
    "pagina": 1,
    "porPagina": 1000,
    "totalRegistros": 3421,
    "totalPaginas": 4
  },
  "geradoEm": "2026-04-11T08:15:32",
  "registros": [
    {
      "filial": "01",
      "codigo": "000123",
      "loja": "01",
      "cnpj": "12345678000190",
      "tipoPessoa": "J",
      "inscricaoEstadual": "123456789",
      "inscricaoEstadualUF": "MG",
      "inscricaoMunicipal": "987654",
      "cnae": "4711302",
      "razaoSocial": "FORNECEDOR EXEMPLO LTDA",
      "nomeFantasia": "Fornecedor Exemplo",
      "endereco": {
        "logradouro": "RUA DAS FLORES",
        "numero": "123",
        "complemento": "SALA 4",
        "bairro": "CENTRO",
        "municipio": "UNAI",
        "municipioIbge": "3170206",
        "uf": "MG",
        "cep": "38610000"
      },
      "contato": {
        "telefone": "3836770000",
        "email": "contato@exemplo.com.br"
      },
      "regimeTributario": "SN",
      "bloqueado": false,
      "dataCadastro": "2018-03-15T00:00:00",
      "dataUltimaAlteracao": "2026-04-09T14:22:11",
      "dataUltimoMovimento": "2026-04-10T07:45:22"
    }
  ]
}
```

#### 3.3.3. Detalhamento do `comMovimentoDesde` — esforço variável (revisão v2.0)

Mantida a semântica da v1.1: retorna registros com pelo menos um lançamento em SF1/SD1 (entrada), SF2/SD2 (saída), SE1 (a receber), SE2 (a pagar), SC5/SC7 (pedidos) com data ≥ ao parâmetro.

**Esclarecimento adicionado na v2.0:** o time Protheus pode escolher entre quatro estratégias de implementação, com custos de desenvolvimento e de runtime bem diferentes. Pedimos **estimativa separada** desta parte do contrato:

| # | Estratégia | Esforço dev | Custo runtime | Observação |
|---|---|---|---|---|
| a | JOIN/EXISTS on-the-fly contra SF1/SF2/SE1/SE2/SC5/SC7 | Baixo | Alto (cresce com volume das tabelas de movimento) | Mais simples; aceitável se o volume diário for pequeno. |
| b | Coluna materializada `A1_DTULTMV` / `A2_DTULTMV`, atualizada por trigger ADVPL nas tabelas de movimento | Médio | Baixo | Requer manutenção das triggers; resposta instantânea. |
| c | View materializada agregando última data por cliente/fornecedor | Médio-alto | Baixo | Refresh incremental periódico; equivale ao (b). |
| d | Job noturno do Protheus que popula tabela auxiliar `ZF_ULTMOV` | Médio | Baixo | Janela de "stale data" de até 24h — aceitável para a rotina diária do Módulo Fiscal porque ela busca movimento das últimas 24h. |

O Módulo Fiscal só precisa do **resultado correto**. A escolha da estratégia é interna ao Protheus.

**Plano B do lado Módulo Fiscal:** se o time Protheus indicar que `comMovimentoDesde` será caro em runtime e quiser evitar a complexidade, o Módulo Fiscal pode adotar uma alternativa em duas etapas:
1. Consultar uma view simples ou um endpoint dedicado leve que retorne **apenas as chaves** (cnpj/codigo/loja) dos clientes/fornecedores com movimento.
2. Para cada chave retornada, chamar `GET /cadastroFiscal/{cnpj}` (Endpoint 2).

Essa estratégia distribui a carga em dois passos e simplifica drasticamente o lado Protheus. Se for da preferência da equipe, pedimos para indicar e ajustamos o cliente do Módulo Fiscal.

### 3.4. Endpoint 2 — Consulta pontual por CNPJ (`GET /cadastroFiscal/{cnpj}`)

**Inalterado em relação à v1.1.** Retorna o mesmo objeto `registro` com campo adicional `origem` indicando se veio de SA1010, SA2010 ou ambos.

```
GET /rest/api/INFOCLIENTES/cadastroFiscal/12345678000190
```

Sucesso (HTTP 200):
```json
{
  "encontradoEm": ["SA2010"],
  "registros": [ { "origem": "SA2010", "...": "demais campos como em 3.3.2" } ]
}
```

Não encontrado (HTTP 404):
```json
{
  "erro": "CNPJ_NAO_ENCONTRADO",
  "mensagem": "CNPJ 12345678000190 não encontrado em SA1010 nem SA2010.",
  "cnpj": "12345678000190"
}
```

### 3.5. Endpoint 3 — Health check `cadastroFiscal` (`GET /cadastroFiscal/health`)

**Inalterado em relação à v1.1.**
```json
{ "status": "OK", "versao": "2.0", "timestamp": "2026-04-11T08:15:32" }
```

### 3.6. Endpoint 4 — `GET /xmlFiscal/{chave}/exists` *(NOVO na v2.0)*

**Finalidade:** cache check leve. Antes de bater no SEFAZ via `NFeDistribuicaoDFe`, o Módulo Fiscal verifica se a chave já está armazenada em SZR010. Este endpoint é a versão "barata" do Endpoint 5 — **não trafega o conteúdo do campo Memo `ZR_XML`**, só metadados.

#### 3.6.1. Método e URL
```
GET /rest/api/INFOCLIENTES/xmlFiscal/{chave}/exists
```
Onde `{chave}` é a chave NF-e/CT-e de 44 dígitos (apenas dígitos, sem máscara).

A consulta interna esperada do lado Protheus (referência conceitual):
```sql
SELECT 1 FROM SZR010 WHERE ZR_CHVNFE = :chave AND D_E_L_E_T_ = ' '
```
A implementação fica a critério do time Protheus, desde que respeite a semântica.

#### 3.6.2. Resposta de sucesso (HTTP 200) — XML existe

```json
{
  "existe": true,
  "chave": "31260400000000000000550010000000011000000010",
  "tipoDocumento": "NFE",
  "modelo": "55",
  "filial": "01",
  "gravadoEm": "2026-04-09T14:22:11",
  "usuarioRecebedor": "MONITOR_NFE",
  "totalItens": 7
}
```

Campos:
- `tipoDocumento`: derivado de `ZR_TPXML` — `NFE`, `CTE`, ou outro valor mantido pelo Protheus.
- `modelo`: derivado de `ZR_MODELO` — `55` para NF-e, `57` para CT-e, etc.
- `filial`: `ZR_FILIAL` — chave composta com `ZR_CHVNFE`.
- `gravadoEm`: combinação `ZR_DTREC + ZR_HRREC`, em ISO 8601.
- `usuarioRecebedor`: `ZR_USRREC` — diferencia origem do XML (`MONITOR_NFE`, `API_FISCAL`, login de usuário Protheus, etc.). Convenção definida na Seção 5.4.
- `totalItens`: contagem de linhas em SZQ010 com mesma `ZQ_CHVNFE` e `ZQ_FILIAL` — útil para validar consistência.

#### 3.6.3. Resposta de sucesso (HTTP 200) — XML não existe

```json
{
  "existe": false,
  "chave": "31260400000000000000550010000000011000000010"
}
```

> **Importante:** "não existe" é resposta normal e retorna **HTTP 200**, não 404. O 404 fica reservado para "endpoint não encontrado" ou "chave em formato inválido".

#### 3.6.4. Erros

- `400 Bad Request` — chave em formato inválido (não tem 44 dígitos).
- `401/403` — autenticação/autorização.

### 3.7. Endpoint 5 — `GET /xmlFiscal/{chave}` *(NOVO na v2.0)*

**Finalidade:** recuperar o XML completo armazenado no campo Memo `ZR_XML` da SZR010, junto com os metadados do cabeçalho e a contagem de itens da SZQ010, para o Módulo Fiscal exibir o documento ao usuário.

#### 3.7.1. Método e URL
```
GET /rest/api/INFOCLIENTES/xmlFiscal/{chave}
```

#### 3.7.2. Resposta de sucesso (HTTP 200)

```json
{
  "chave": "31260400000000000000550010000000011000000010",
  "filial": "01",
  "tipoDocumento": "NFE",
  "modelo": "55",
  "tipoNF": "1",
  "serie": "001",
  "numeroNF": "000123456",
  "dataEmissao": "2026-04-09",
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><nfeProc>...</nfeProc>",
  "emitente": {
    "cnpj": "12345678000190",
    "razaoSocial": "FORNECEDOR EXEMPLO LTDA",
    "inscricaoEstadual": "123456789",
    "logradouro": "RUA DAS FLORES",
    "numero": "123",
    "bairro": "CENTRO",
    "municipio": "UNAI",
    "codigoMunicipio": "3170206",
    "uf": "MG",
    "cep": "38610000",
    "telefone": "3836770000"
  },
  "fornecedorProtheus": {
    "codigo": "000123",
    "loja": "01"
  },
  "terceiro": false,
  "transporte": {
    "ufOrigem": null,
    "municipioOrigem": null,
    "ufDestino": null,
    "municipioDestino": null,
    "valorCte": null
  },
  "recebimento": {
    "data": "2026-04-09",
    "hora": "14:22:11",
    "usuario": "MONITOR_NFE"
  },
  "totalItens": 7
}
```

**Mapeamento dos campos para SZR010:**
- `chave` ← `ZR_CHVNFE`
- `filial` ← `ZR_FILIAL`
- `tipoDocumento` ← derivado de `ZR_TPXML`
- `modelo` ← `ZR_MODELO`
- `tipoNF` ← `ZR_TPNF` (1 = entrada, 2 = saída — confirmar com time Protheus os valores válidos)
- `serie` ← `ZR_SERIE`
- `numeroNF` ← `ZR_NNF`
- `dataEmissao` ← `ZR_EMISSA`
- `xml` ← **`ZR_XML`** (campo Memo, conteúdo completo do XML em UTF-8)
- `emitente.*` ← `ZR_ECNPJ`, `ZR_ENOME`, `ZR_EIE`, `ZR_ELGR`, `ZR_ENRO`, `ZR_EBAIRR`, `ZR_EXMUN`, `ZR_ECMUN`, `ZR_EUF`, `ZR_ECEP`, `ZR_EFONE`
- `fornecedorProtheus.codigo` ← `ZR_CODFOR`
- `fornecedorProtheus.loja` ← `ZR_LOJSIG`
- `terceiro` ← `ZR_TERCEIR` (booleano)
- `transporte.*` (CT-e) ← `ZR_UFORITR`, `ZR_MUORITR`, `ZR_UFDESTR`, `ZR_MUDESTR`, `ZR_VALCTE` — `null` para NF-e
- `recebimento.data` ← `ZR_DTREC`
- `recebimento.hora` ← `ZR_HRREC`
- `recebimento.usuario` ← `ZR_USRREC`
- `totalItens` ← `SELECT COUNT(*) FROM SZQ010 WHERE ZQ_FILIAL = ZR_FILIAL AND ZQ_CHVNFE = ZR_CHVNFE`

> O Módulo Fiscal **não** consome os itens da SZQ010 por este endpoint — eles são extraídos diretamente do XML pelo parser do módulo (mais consistente porque o XML é a fonte canônica). A contagem `totalItens` serve apenas para validar consistência cabeçalho ↔ itens.

#### 3.7.3. Não encontrado (HTTP 404)

```json
{
  "erro": "CHAVE_NAO_ENCONTRADA",
  "mensagem": "Chave 31260400000000000000550010000000011000000010 não encontrada em SZR010.",
  "chave": "31260400000000000000550010000000011000000010"
}
```

### 3.8. Endpoint 6 — `POST /xmlFiscal` *(NOVO na v2.0 — endpoint de escrita)*

**Finalidade:** persistir um XML novo em SZR010 (1 linha de cabeçalho) + SZQ010 (N linhas, 1 por item do XML), alimentando o fluxo padrão de entrada de mercadoria do Protheus. Chamado pelo Módulo Fiscal **somente** quando o cache check (Endpoint 4) retornou `existe=false` e o módulo acabou de baixar o XML autorizado da SEFAZ via `NFeDistribuicaoDFe`.

> **Esta é a única operação de escrita autorizada para o usuário técnico `API_FISCAL`. Qualquer escrita em outras tabelas é proibida — ver Seção 5.3.**

#### 3.8.1. Método e URL
```
POST /rest/api/INFOCLIENTES/xmlFiscal
Content-Type: application/json
```

#### 3.8.2. Corpo da requisição

```json
{
  "chave": "31260400000000000000550010000000011000000010",
  "tipoDocumento": "NFE",
  "filial": "01",
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><nfeProc>...</nfeProc>",
  "usuarioCapulQueDisparou": "fulano.silva"
}
```

Campos:
- `chave` *(obrig.)*: chave NF-e/CT-e de 44 dígitos.
- `tipoDocumento` *(obrig.)*: `NFE` ou `CTE`. Determina o valor de `ZR_TPXML`/`ZR_MODELO` e quais campos específicos de CT-e populam SZR010 e SZQ010.
- `filial` *(obrig.)*: filial Protheus de 2 dígitos onde o documento será gravado. Vai para `ZR_FILIAL` e `ZQ_FILIAL` em todas as linhas. O Módulo Fiscal envia a filial determinada pela navegação do usuário no momento da consulta.
- `xml` *(obrig.)*: o documento XML completo, como string. Já vem da SEFAZ assinado. O Protheus usa este conteúdo tanto para validações (XSD + assinatura + extração de campos) quanto para gravar literalmente em `ZR_XML` (campo Memo).
- `usuarioCapulQueDisparou` *(opcional, mas recomendado)*: login do usuário do Módulo Fiscal que originou a operação. Útil para auditoria cruzada — pode ser concatenado com o prefixo padrão e gravado em `ZR_USRREC` (ver Seção 5.4).

> **Não enviamos `protocoloAutorizacao` nem `dataAutorizacao` separadamente:** ambos estão dentro do XML autorizado (no bloco `<protNFe>` da NF-e ou `<protCTe>` do CT-e). O Protheus já extrai esses dados ao processar o XML — duplicar no payload seria fonte de divergência.

#### 3.8.3. Validações executadas pelo Protheus

Em ordem, antes de persistir:

1. **Formato da chave**: 44 dígitos numéricos com DV correto.
2. **Filial existe**: `filial` informada corresponde a uma filial ativa do Protheus.
3. **XML bem-formado**: parser XML não retorna erro.
4. **Schema NF-e/CT-e**: o XML valida contra o XSD oficial da SEFAZ na versão correspondente.
5. **Chave bate com o XML**: o atributo `Id` do nó raiz (`NFe`/`CTe`) corresponde à `chave` informada no payload. Se divergir, retorna `400 CHAVE_NAO_BATE_XML`.
6. **Tipo de documento bate com o XML**: o XML é realmente NF-e (modelo 55) ou CT-e (modelo 57) conforme o `tipoDocumento` informado. Se divergir, retorna `400 TIPO_NAO_BATE_XML`.
7. **Assinatura digital válida**: a assinatura ICP-Brasil presente no XML é válida (rotina ADVPL existente, a mesma usada pelo monitor automático).
8. **CNPJ destinatário OU emitente bate com a CAPUL**: a chave é da CAPUL (a CAPUL é destinatária ou emitente). Se nenhum dos dois, retorna `409 NAO_RELACIONADO_CAPUL`.
9. **CNPJ contraparte cadastrado**: o CNPJ "do outro lado" (destinatário se a CAPUL é emitente; emitente se a CAPUL é destinatária) deve existir em SA1010 ou SA2010 e estar não bloqueado. Se não existir, retorna `409 CONTRAPARTE_NAO_CADASTRADA`. O `ZR_CODFOR`/`ZR_LOJSIG` da SZR010 é resolvido a partir desse cadastro.
10. **Idempotência por chave + filial**: se já existir registro em SZR010 com `(ZR_FILIAL, ZR_CHVNFE)` igual ao do payload, **não duplicar** — retornar `200 JA_EXISTENTE` em vez de `201 GRAVADO`. Isso é fundamental para não corromper o monitor de NF-e.

#### 3.8.4. Operação de gravação (transacional)

Quando todas as validações passam, o Protheus executa em **uma única transação** (rollback total em qualquer falha):

1. **INSERT em SZR010** (cabeçalho) com os campos extraídos do XML:
   - `ZR_FILIAL` ← `filial` do payload
   - `ZR_CHVNFE` ← `chave` do payload
   - `ZR_XML` ← XML completo (Memo)
   - `ZR_TPXML` ← derivado de `tipoDocumento` (convenção a confirmar com time Protheus)
   - `ZR_MODELO` ← derivado do XML (`<mod>` na ide — `55` NF-e, `57` CT-e)
   - `ZR_TPNF` ← derivado do XML (`<tpNF>` para NF-e — 0 entrada, 1 saída)
   - `ZR_SERIE`, `ZR_NNF`, `ZR_EMISSA` ← extraídos do bloco `<ide>`
   - `ZR_ECNPJ`, `ZR_ENOME`, `ZR_EIE`, `ZR_ELGR`, `ZR_ENRO`, `ZR_EBAIRR`, `ZR_EXMUN`, `ZR_ECMUN`, `ZR_EUF`, `ZR_ECEP`, `ZR_EFONE` ← extraídos do bloco `<emit>` (NF-e) ou equivalente (CT-e)
   - `ZR_CODFOR`, `ZR_LOJSIG` ← resolvidos da contraparte em SA1010/SA2010 (validação 9)
   - `ZR_DTREC` ← data corrente do servidor Protheus
   - `ZR_HRREC` ← hora corrente do servidor Protheus
   - `ZR_USRREC` ← `'API_FISCAL'` ou `'API_FISCAL:' || usuarioCapulQueDisparou` (ver Seção 5.4)
   - `ZR_TERCEIR` ← `.F.` por padrão (ou derivado do XML se aplicável)
   - **Para CT-e** (modelo 57): `ZR_UFORITR`, `ZR_MUORITR`, `ZR_UFDESTR`, `ZR_MUDESTR`, `ZR_VALCTE` ← extraídos dos blocos de transporte do XML CT-e
   - **Para NF-e** (modelo 55): os campos de transporte ficam vazios/`null`

2. **INSERT em SZQ010** — uma linha por item do XML (`<det>` para NF-e). Para cada item:
   - `ZQ_FILIAL` ← `filial` do payload
   - `ZQ_CHVNFE` ← `chave` do payload
   - `ZQ_ITEM` ← número do item (`<det nItem="X">`)
   - `ZQ_PROD` ← código do produto no XML do fornecedor (`<cProd>`)
   - `ZQ_EAN` ← `<cEAN>` (ou vazio)
   - `ZQ_DESCRI` ← `<xProd>` (descrição do item no XML)
   - `ZQ_UM` ← `<uCom>` (unidade comercial)
   - `ZQ_QTDE` ← `<qCom>` (quantidade comercial)
   - `ZQ_VLUNIT` ← `<vUnCom>` (valor unitário comercial)
   - `ZQ_TOTAL` ← `<vProd>` (valor total da linha)
   - `ZQ_CFOP` ← `<CFOP>` do item
   - `ZQ_XMLIMP` ← XML do bloco de impostos do item (`<imposto>...</imposto>` recortado), Memo
   - **Para CT-e**: `ZQ_CHVCTE`, `ZQ_CTNF`, `ZQ_CTSER`, `ZQ_CTFOR`, `ZQ_CTLOJ` populados a partir dos campos correspondentes do CT-e
   - **DEIXAR VAZIOS** (preenchidos depois pelo usuário durante a entrada de mercadoria):
     - `ZQ_CODSIG` (código do produto Protheus — depende de de-para)
     - `ZQ_QTSIGA` (quantidade convertida para UM Protheus)
     - `ZQ_VLSIGA` (valor unitário em UM Protheus)
     - `ZQ_PEDCOM` (pedido de compra Protheus a casar)
     - `ZQ_ITEMPC` (item do pedido de compra)

3. **Commit** da transação. Se qualquer INSERT falhar, **rollback completo** — nem cabeçalho nem itens ficam parcialmente gravados.

#### 3.8.5. Resposta de sucesso — gravado (HTTP 201 Created)

```json
{
  "status": "GRAVADO",
  "chave": "31260400000000000000550010000000011000000010",
  "filial": "01",
  "tipoDocumento": "NFE",
  "modelo": "55",
  "itensGravados": 7,
  "fornecedorProtheus": {
    "codigo": "000123",
    "loja": "01"
  },
  "gravadoEm": "2026-04-11T09:14:22"
}
```

- `itensGravados`: contagem de linhas inseridas em SZQ010. Deve bater com o `<det>` count do XML.
- `fornecedorProtheus`: o cadastro resolvido na validação 9 (devolvido para o Módulo Fiscal exibir ao usuário "XML gravado e vinculado ao fornecedor X").

#### 3.8.6. Resposta de sucesso — já existente (HTTP 200 OK)

```json
{
  "status": "JA_EXISTENTE",
  "chave": "31260400000000000000550010000000011000000010",
  "filial": "01",
  "gravadoEmOriginal": "2026-04-09T14:22:11",
  "usuarioRecebedorOriginal": "MONITOR_NFE"
}
```

> A diferença entre 201 e 200 sinaliza ao Módulo Fiscal se houve gravação efetiva ou se o XML já estava lá. Não é erro — é informação.

#### 3.8.7. Erros

| HTTP | `erro` | Quando ocorre |
|---|---|---|
| 400 | `CHAVE_INVALIDA` | Chave não tem 44 dígitos ou DV incorreto. |
| 400 | `FILIAL_INVALIDA` | Filial informada não existe ou está inativa. |
| 400 | `XML_MALFORMADO` | Parser XML falhou. |
| 400 | `XML_NAO_VALIDA_XSD` | Falha de validação contra XSD da SEFAZ. |
| 400 | `CHAVE_NAO_BATE_XML` | A chave informada não é a chave do XML enviado (atributo `Id`). |
| 400 | `TIPO_NAO_BATE_XML` | `tipoDocumento` informado divergente do modelo real do XML (ex.: enviou `NFE` mas o XML é CT-e). |
| 400 | `ASSINATURA_INVALIDA` | Assinatura digital ausente, expirada ou inválida. |
| 401/403 | `NAO_AUTORIZADO` | Credencial inválida ou usuário sem permissão de escrita em SZR/SZQ. |
| 409 | `NAO_RELACIONADO_CAPUL` | A CAPUL não é nem emitente nem destinatária da NF-e/CT-e. |
| 409 | `CONTRAPARTE_NAO_CADASTRADA` | O CNPJ contraparte não está em SA1010 nem SA2010, ou está bloqueado. |
| 500 | `FALHA_GRAVACAO` | Erro inesperado ao gravar (rollback aplicado em SZR e SZQ). |
| 503 | `PROTHEUS_INDISPONIVEL` | Protheus em manutenção ou sobrecarregado. |

Formato do corpo de erro (mantido da v1.1):
```json
{
  "erro": "CONTRAPARTE_NAO_CADASTRADA",
  "mensagem": "Emitente CNPJ 12345678000190 não consta em SA2010. Cadastre o fornecedor antes de tentar novamente.",
  "detalhe": "Validação CONTRAPARTE_PROTHEUS — Seção 3.8.3"
}
```

#### 3.8.8. Comportamento esperado do Módulo Fiscal diante dos códigos

- `201`: marca o `documento_consulta` com `origem=SEFAZ_DOWNLOAD` e segue para o parser.
- `200 JA_EXISTENTE`: marca como `origem=PROTHEUS_CACHE_RACE` (caso de corrida — alguém gravou entre o `exists` e o `POST`) e usa o XML retornado.
- `400`: erro de validação fatal — a operação aborta e o erro é exibido ao usuário do Módulo Fiscal.
- `409 NAO_RELACIONADO_CAPUL`: orienta o usuário ("Esta NF-e não tem a CAPUL como participante — não pode ser gravada").
- `409 CONTRAPARTE_NAO_CADASTRADA`: orienta o usuário ("Cadastre o fornecedor/cliente no Protheus antes de gravar este XML"). O Módulo Fiscal **não cadastra** automaticamente — segue sendo só leitura no SA1/SA2.
- `500/503`: retry com backoff exponencial (3 tentativas), depois aborta e registra em `audit_log`.

### 3.9. Endpoint 7 — Health check `xmlFiscal` (`GET /xmlFiscal/health`) *(NOVO na v2.0)*

```json
{ "status": "OK", "versao": "2.0", "timestamp": "2026-04-11T08:15:32" }
```

Pode reutilizar a mesma implementação do Endpoint 3 — separado apenas para que monitores externos possam diferenciar disponibilidade das duas frentes. Se preferir consolidar num único `/health`, sem problema.

---

## 4. Dicionário de Campos

### 4.1. Frente `cadastroFiscal` — campos obrigatórios

Inalterado em relação à v1.1. Reproduzido aqui para integridade:

| Campo JSON | Protheus (SA1/SA2) | Tipo | Observação |
|---|---|---|---|
| `filial` | `A1_FILIAL` / `A2_FILIAL` | string | Código da filial (2 caracteres). |
| `codigo` | `A1_COD` / `A2_COD` | string | Código no Protheus (6 caracteres). |
| `loja` | `A1_LOJA` / `A2_LOJA` | string | Loja (2 caracteres). |
| `cnpj` | `A1_CGC` / `A2_CGC` | string | CNPJ (apenas dígitos, 14 caracteres). |
| `tipoPessoa` | `A1_PESSOA` / `A2_TIPO` | string | `F` ou `J`. |
| `inscricaoEstadual` | `A1_INSCR` / `A2_INSCR` | string | IE ou ISENTO. |
| `inscricaoEstadualUF` | `A1_EST` / `A2_EST` | string | UF da IE. |
| `razaoSocial` | `A1_NOME` / `A2_NOME` | string | |
| `bloqueado` | `A1_MSBLQL` / `A2_MSBLQL` | boolean | `true` se '1'. |
| `dataUltimaAlteracao` | `R_E_C_A_L_T` ou equivalente | datetime | Crítico para `desdeData`. |
| **`dataUltimoMovimento`** | **MAX das tabelas de movimento (ver 3.3.3)** | **datetime** | **Crítico para `comMovimentoDesde`. *(v2.0: esforço variável — pedir estimativa separada.)*** |

### 4.2. Frente `cadastroFiscal` — campos desejáveis

Inalterado em relação à v1.1: `nomeFantasia`, `cnae`, `inscricaoMunicipal`, `endereco.*`, `contato.*`, `regimeTributario`, `dataCadastro`. Se não puderem ser entregues, retornar `null` — nada é bloqueante.

### 4.3. Frente `xmlFiscal` — estrutura real das tabelas SZR010 e SZQ010 *(NOVO na v2.0, baseado no dicionário X3 fornecido em 11/04/2026)*

Esta seção formaliza a estrutura real das duas tabelas customizadas da CAPUL no Protheus que armazenam XMLs fiscais. O dicionário completo está no **Anexo C** deste documento.

#### 4.3.1. SZR010 — Cabeçalho do XML (1 linha por chave/filial)

A SZR010 contém **uma linha por documento fiscal** (NF-e ou CT-e). Aqui mora o XML completo no campo Memo `ZR_XML`. A chave composta é `(ZR_FILIAL, ZR_CHVNFE)`.

| Campo Protheus | Tipo | Tam. | Origem (no POST do Endpoint 6) | Uso pelo Endpoint 5 (GET) |
|---|---|---|---|---|
| `ZR_FILIAL` | C | 2 | `filial` do payload | `filial` |
| `ZR_CHVNFE` | C | 44 | `chave` do payload | `chave` |
| `ZR_XML` | M | — | `xml` do payload (completo) | `xml` |
| `ZR_TPXML` | C | 3 | derivado de `tipoDocumento` (convenção a confirmar — ex.: `NFE`/`CTE`) | `tipoDocumento` |
| `ZR_MODELO` | C | 5 | extraído do XML (`<mod>` da `<ide>`) — `55` NF-e, `57` CT-e | `modelo` |
| `ZR_TPNF` | C | 1 | extraído do XML (`<tpNF>` para NF-e) — `0` entrada, `1` saída | `tipoNF` |
| `ZR_SERIE` | C | 3 | extraído do XML (`<serie>` da `<ide>`) | `serie` |
| `ZR_NNF` | C | 9 | extraído do XML (`<nNF>` da `<ide>`) | `numeroNF` |
| `ZR_EMISSA` | D | 8 | extraído do XML (`<dhEmi>`/`<dEmi>`) | `dataEmissao` |
| `ZR_DTREC` | D | 8 | data corrente do servidor Protheus | `recebimento.data` |
| `ZR_HRREC` | C | 8 | hora corrente do servidor Protheus (HH:MM:SS) | `recebimento.hora` |
| `ZR_USRREC` | C | 30 | `'API_FISCAL'` ou `'API_FISCAL:'+usuarioCapulQueDisparou` | `recebimento.usuario` |
| `ZR_TERCEIR` | L | 1 | `.F.` por padrão | `terceiro` (boolean) |
| `ZR_ECNPJ` | C | 14 | extraído do XML (bloco `<emit>` para NF-e) | `emitente.cnpj` |
| `ZR_ENOME` | C | 100 | extraído do XML (`<xNome>` do `<emit>`) | `emitente.razaoSocial` |
| `ZR_EIE` | C | 20 | extraído do XML (`<IE>` do `<emit>`) | `emitente.inscricaoEstadual` |
| `ZR_ELGR` | C | 100 | extraído do XML (`<xLgr>` do `<emit><enderEmit>`) | `emitente.logradouro` |
| `ZR_ENRO` | C | 6 | extraído do XML (`<nro>`) | `emitente.numero` |
| `ZR_EBAIRR` | C | 50 | extraído do XML (`<xBairro>`) | `emitente.bairro` |
| `ZR_EXMUN` | C | 50 | extraído do XML (`<xMun>`) | `emitente.municipio` |
| `ZR_ECMUN` | C | 8 | extraído do XML (`<cMun>`) | `emitente.codigoMunicipio` |
| `ZR_EUF` | C | 2 | extraído do XML (`<UF>`) | `emitente.uf` |
| `ZR_ECEP` | C | 8 | extraído do XML (`<CEP>`) | `emitente.cep` |
| `ZR_EFONE` | C | 30 | extraído do XML (`<fone>`) | `emitente.telefone` |
| `ZR_CODFOR` | C | 6 | resolvido em SA2010 a partir de `ZR_ECNPJ` (validação 9 do POST) | `fornecedorProtheus.codigo` |
| `ZR_LOJSIG` | C | 4 | resolvido em SA2010 idem | `fornecedorProtheus.loja` |
| `ZR_VALCTE` | N | 17,2 | apenas CT-e — `<vTPrest>` ou equivalente | `transporte.valorCte` |
| `ZR_UFORITR` | C | 2 | apenas CT-e — UF origem do transporte | `transporte.ufOrigem` |
| `ZR_MUORITR` | C | 5 | apenas CT-e — município origem | `transporte.municipioOrigem` |
| `ZR_UFDESTR` | C | 2 | apenas CT-e — UF destino | `transporte.ufDestino` |
| `ZR_MUDESTR` | C | 5 | apenas CT-e — município destino | `transporte.municipioDestino` |

**Pontos a confirmar com o time Protheus** (Seção 9):
- Valores válidos para `ZR_TPXML` — quais strings são usadas hoje pelo monitor automático? (`NFE`/`CTE`/`NFC`/outros?)
- Valores válidos para `ZR_TPNF` — `0`/`1` ou `1`/`2`?
- Para CT-e (modelo 57), o emitente corresponde à transportadora ou ao tomador? Confirmar a semântica para que o ZR_CODFOR/ZR_LOJSIG aponte para o cadastro correto.
- Existe campo de "protocolo de autorização" persistido fora do XML, ou ele só vive dentro do conteúdo de `ZR_XML` (precisa ser parseado quando necessário)?

#### 4.3.2. SZQ010 — Itens do XML (1 linha por item, vinculado a SZR010)

A SZQ010 contém **uma linha por item de produto/serviço** do XML. A chave composta é `(ZQ_FILIAL, ZQ_CHVNFE, ZQ_ITEM)`. O vínculo com SZR010 é feito por `(ZR_FILIAL = ZQ_FILIAL, ZR_CHVNFE = ZQ_CHVNFE)`.

**Importante**: a SZQ010 tem dois grupos de campos com propósitos distintos:
- **Grupo A — Campos do XML** (preenchidos pelo POST do Endpoint 6, com base no parsing do XML).
- **Grupo B — Campos "siga" / casamento manual** (NÃO preenchidos pela API; ficam vazios e são preenchidos pelo usuário do Protheus durante a entrada de mercadoria, no momento em que ele faz o de-para entre o item-XML e o produto/pedido interno do ERP).

| Campo Protheus | Tipo | Tam. | Grupo | Origem (no POST do Endpoint 6) |
|---|---|---|---|---|
| `ZQ_FILIAL` | C | 2 | A | `filial` do payload |
| `ZQ_CHVNFE` | C | 44 | A | `chave` do payload |
| `ZQ_ITEM` | C | 3 | A | número do item (`<det nItem="X">`) |
| `ZQ_PROD` | C | 30 | A | `<cProd>` do `<prod>` |
| `ZQ_EAN` | C | 15 | A | `<cEAN>` (ou vazio se `SEM GTIN`) |
| `ZQ_DESCRI` | C | 100 | A | `<xProd>` |
| `ZQ_UM` | C | 3 | A | `<uCom>` |
| `ZQ_QTDE` | N | 14,4 | A | `<qCom>` |
| `ZQ_VLUNIT` | N | 18,9 | A | `<vUnCom>` |
| `ZQ_TOTAL` | N | 14,2 | A | `<vProd>` |
| `ZQ_CFOP` | C | 5 | A | `<CFOP>` do item |
| `ZQ_XMLIMP` | M | — | A | conteúdo do bloco `<imposto>` recortado do item (Memo) |
| `ZQ_CTNF` | C | 9 | A | apenas CT-e — número da NF associada ao CT-e |
| `ZQ_CHVCTE` | C | 44 | A | apenas CT-e — chave do CT-e (= `chave` do payload) |
| `ZQ_CTSER` | C | 3 | A | apenas CT-e — série do CT-e |
| `ZQ_CTFOR` | C | 6 | A | apenas CT-e — fornecedor (transportadora) |
| `ZQ_CTLOJ` | C | 2 | A | apenas CT-e — loja do fornecedor |
| **`ZQ_CODSIG`** | **C** | **15** | **B** | **VAZIO — preenchido depois pelo usuário (código produto Protheus)** |
| **`ZQ_QTSIGA`** | **N** | **14,4** | **B** | **VAZIO — preenchido depois (qtde convertida para UM Protheus)** |
| **`ZQ_VLSIGA`** | **N** | **18,9** | **B** | **VAZIO — preenchido depois (valor unitário em UM Protheus)** |
| **`ZQ_PEDCOM`** | **C** | **6** | **B** | **VAZIO — preenchido depois (pedido de compra a casar)** |
| **`ZQ_ITEMPC`** | **C** | **4** | **B** | **VAZIO — preenchido depois (item do pedido)** |

> **Por que o Grupo B fica vazio:** o Módulo Fiscal não conhece (e não deve conhecer) a base de produtos do Protheus, nem sabe qual pedido de compra deve ser casado com cada item da NF. Isso é responsabilidade do usuário operacional durante a entrada de mercadoria. Se o Módulo Fiscal preenchesse esses campos, estaria substituindo decisão humana — coisa que não queremos. O comportamento aqui é exatamente o mesmo do monitor automático de NF-e do Protheus: ele também grava SZQ com o Grupo A preenchido e o Grupo B vazio, esperando o usuário completar.

#### 4.3.3. Validação cruzada cabeçalho ↔ itens

Após o POST, deve valer:
- Existe exatamente 1 linha em SZR010 com `(ZR_FILIAL, ZR_CHVNFE)` igual ao do payload.
- Existe pelo menos 1 linha em SZQ010 com `(ZQ_FILIAL, ZQ_CHVNFE)` igual ao do payload.
- A contagem de linhas em SZQ010 é igual ao número de `<det>` no XML.
- Para cada `<det nItem="X">` no XML existe uma linha com `ZQ_ITEM = X`.

O Endpoint 5 (GET) retorna `totalItens` justamente para que o Módulo Fiscal possa fazer essa validação cruzada do lado dele.

---

## 5. Autenticação e Segurança

### 5.1. Autenticação

Mantido o padrão da v1.1: usuário técnico `API_FISCAL`, autenticação via header HTTP (Basic ou Bearer conforme padrão do portal Protheus), credencial como secret no Docker Compose, rotação conforme política da CAPUL.

### 5.2. Restrição de rede

Inalterado em relação à v1.1: acesso restrito à rede interna da CAPUL, firewall já permite o fluxo.

### 5.3. Permissões mínimas *(REVISADO na v2.0 — escrita restrita)*

A permissão do usuário técnico `API_FISCAL` muda na v2.0:

| Tabela | v1.x | v2.0 | Justificativa |
|---|---|---|---|
| SA1010 | Leitura | Leitura | Frente `cadastroFiscal`. |
| SA2010 | Leitura | Leitura | Frente `cadastroFiscal` + resolução de fornecedor no POST `/xmlFiscal`. |
| SF1010, SF2010, SE1010, SE2010, SC5010, SC7010 | (não acessadas) | Leitura **opcional** | Apenas se a estratégia (a) ou (b) da Seção 3.3.3 exigir JOIN/EXISTS. Se a estratégia escolhida for (c) ou (d), nem leitura é necessária. |
| **SZR010** | (não acessada) | **Leitura + INSERT** | **Frente `xmlFiscal` — Endpoints 4, 5 e 6 (cabeçalho).** |
| **SZQ010** | (não acessada) | **Leitura + INSERT** | **Frente `xmlFiscal` — Endpoints 5 e 6 (itens, em cascata da gravação do cabeçalho).** |
| **Qualquer outra tabela** | (não acessada) | **PROIBIDO** | Inclusive UPDATE/DELETE em SZR/SZQ é proibido — apenas INSERT. |

**Pedido formal ao time Protheus:** ao criar a permissão para `API_FISCAL`, restringir explicitamente para:
- `SELECT, INSERT` em SZR010.
- `SELECT, INSERT` em SZQ010.
- `SELECT` em SA1010, SA2010 (e nas tabelas de movimento se a estratégia escolhida para `dataUltimoMovimento` exigir).
- **Sem `UPDATE`, sem `DELETE`, sem acesso a nenhuma outra tabela.**

A operação `INSERT` é isolada para a frente `xmlFiscal` e nunca atualiza registros existentes (idempotência via verificação pré-INSERT — Seção 3.8.3 item 10). Se em alguma situação extrema o Protheus precisar de UPDATE em SZR/SZQ (por exemplo, para reescrever um XML que veio errado), isso será feito **manualmente** pelo time fiscal/Protheus via interface ADVPL, **nunca** pelo Módulo Fiscal.

### 5.4. Auditoria do lado Protheus *(NOVO na v2.0)*

Toda gravação via Endpoint 6 deve gerar trilha auditável no Protheus:

- **Campo `ZR_USRREC`** (SZR010) preenchido com:
  - `'API_FISCAL'` quando o payload do POST não trouxer `usuarioCapulQueDisparou`.
  - `'API_FISCAL:'+usuarioCapulQueDisparou` (até o limite de 30 caracteres do campo) quando o usuário do Módulo Fiscal estiver identificado. Ex.: `API_FISCAL:joao.silva`.
- O prefixo `API_FISCAL` permite ao time fiscal distinguir, com um filtro simples em SZR010, **quais XMLs vieram via Módulo Fiscal** (`ZR_USRREC LIKE 'API_FISCAL%'`) versus quais vieram pelo monitor automático do Protheus (`ZR_USRREC = 'MONITOR_NFE'` ou outro valor padrão usado hoje).
- Os campos automáticos do Protheus (`USER_INSERT`, `D_E_L_E_T_`, `R_E_C_N_O_`, `R_E_C_A_L_T`) são preenchidos pelo próprio ERP — não estão sob responsabilidade do payload do POST.
- O Módulo Fiscal também guarda sua própria trilha em `fiscal.audit_log` do lado da Plataforma Capul (chave, filial, usuário Capul, timestamp, status retornado), então a auditoria é dupla — qualquer divergência futura entre os dois lados pode ser conciliada.

---

## 6. Tratamento de Erros

Mantém-se o padrão da v1.1 (Seção 6 anterior). Códigos HTTP esperados, formato do corpo de erro e comportamento esperado do Módulo Fiscal são os mesmos. A v2.0 acrescenta apenas os códigos de erro específicos do Endpoint 6, descritos na Seção 3.8.6.

---

## 7. Performance e SLA

### 7.1. Expectativas

| Cenário | Tempo máximo esperado |
|---|---|
| `cadastroFiscal` — rotina diária (com movimento, centenas) | ≤ 5 segundos por página |
| `cadastroFiscal` — rotina semanal (1000/página) | ≤ 10 segundos por página |
| `cadastroFiscal` — listagem incremental por `desdeData` | ≤ 3 segundos |
| `cadastroFiscal/{cnpj}` — pontual | ≤ 1 segundo |
| `cadastroFiscal/health` | ≤ 500 ms |
| **`xmlFiscal/{chave}/exists`** | **≤ 300 ms** *(query rápida sem trafegar BLOB)* |
| **`xmlFiscal/{chave}` — recuperação** | **≤ 2 segundos** *(inclui leitura do BLOB)* |
| **`xmlFiscal` POST — gravação** | **≤ 5 segundos** *(inclui validação XSD + assinatura + INSERTs)* |
| **`xmlFiscal/health`** | **≤ 500 ms** |

Estes valores são expectativas iniciais — se algum cenário exigir mais tempo, basta indicar e ajustamos os timeouts do Módulo Fiscal.

### 7.2. Horário de uso previsto

Mantido o padrão da v1.1 para `cadastroFiscal`. Para `xmlFiscal`:

- `exists`/`GET`: horário comercial, baixo volume (dezenas a baixas centenas/dia), seguindo a navegação dos usuários do Setor Fiscal.
- `POST`: horário comercial, volume **muito baixo** (são apenas os XMLs que escaparam do monitor automático — esperamos dezenas/dia em regime estável). Sem rotina noturna.

### 7.3. Rate limit

Mantida a sugestão da v1.1: 60 req/minuto por credencial é mais que suficiente, considerando o volume de ambas as frentes.

---

## 8. Ambientes e Testes

### 8.1. Ambientes necessários

Inalterado em relação à v1.1: homologação primeiro, produção depois.

### 8.2. Dados de teste *(REVISADO na v2.0)*

Para validar `cadastroFiscal` (mantido):
- 5 registros em SA1010 de filiais diferentes, com campos obrigatórios preenchidos.
- 10 registros em SA2010, incluindo pelo menos um bloqueado.
- 1 registro existente em ambas SA1010 e SA2010.
- 1 registro de cada regime tributário.
- 3 UFs diferentes.

**Para validar `xmlFiscal` (NOVO):**
- 3 chaves NF-e já presentes em SZR010 (`exists` deve retornar `true`).
- 3 chaves NF-e em formato válido mas inexistentes em SZR010 (`exists` deve retornar `false`).
- 1 chave em formato inválido para testar HTTP 400.
- 1 XML NF-e válido (modelo 55) de teste para POST (homologação SEFAZ — XML real anonimizado ou gerado para testes).
- 1 XML CT-e válido (modelo 57) de teste para POST — para validar o suporte a CT-e nas mesmas tabelas.
- 1 XML mal-formado para testar HTTP 400 `XML_MALFORMADO`.
- 1 XML de NF-e em que a CAPUL não é nem emitente nem destinatária (testar `409 NAO_RELACIONADO_CAPUL`).
- 1 XML de NF-e cujo emitente não está cadastrado em SA2010 (testar `409 CONTRAPARTE_NAO_CADASTRADA`).
- 1 chave que já existe em SZR010 para testar idempotência (POST deve retornar `200 JA_EXISTENTE` sem duplicar SZR010 nem SZQ010).
- 1 XML cujo `tipoDocumento` no payload diverge do modelo real (testar `400 TIPO_NAO_BATE_XML`).

### 8.3. Critérios de aceite *(REVISADO na v2.0)*

Os 12 critérios da v1.1 para `cadastroFiscal` permanecem. **Acrescentam-se** os seguintes critérios para `xmlFiscal`:

13. `GET /xmlFiscal/{chave}/exists` retorna `200 { existe: true, ... }` com `tipoDocumento`, `modelo`, `filial`, `gravadoEm`, `usuarioRecebedor` e `totalItens` para chave presente em SZR010.
14. `GET /xmlFiscal/{chave}/exists` retorna `200 { existe: false }` para chave válida ausente em SZR010 (não 404).
15. `GET /xmlFiscal/{chave}/exists` retorna `400 CHAVE_INVALIDA` para chave fora do formato 44 dígitos.
16. `GET /xmlFiscal/{chave}` retorna `200` com o conteúdo de `ZR_XML` no campo `xml` da resposta, todos os campos do bloco `emitente`, o vínculo `fornecedorProtheus.codigo`/`loja` e `totalItens` consistente com o número de linhas em SZQ010.
17. `GET /xmlFiscal/{chave}` retorna `404 CHAVE_NAO_ENCONTRADA` para chave válida ausente.
18. `POST /xmlFiscal` para um XML NF-e novo, válido e relacionado à CAPUL retorna `201 GRAVADO` com `itensGravados` igual ao número de `<det>` no XML e `fornecedorProtheus` resolvido corretamente em SA2010.
19. `POST /xmlFiscal` para um XML CT-e (modelo 57) novo retorna `201 GRAVADO` e popula corretamente os campos específicos de CT-e em SZR010 (`ZR_VALCTE`, `ZR_UFORITR`, `ZR_MUORITR`, `ZR_UFDESTR`, `ZR_MUDESTR`) e em SZQ010 (`ZQ_CHVCTE`, `ZQ_CTNF`, `ZQ_CTSER`, `ZQ_CTFOR`, `ZQ_CTLOJ`).
20. `POST /xmlFiscal` para a mesma chave repetida retorna `200 JA_EXISTENTE` sem duplicar registros — validação manual em SZR010 (1 linha) e SZQ010 (N linhas inalteradas).
21. `POST /xmlFiscal` com XML mal-formado retorna `400 XML_MALFORMADO`.
22. `POST /xmlFiscal` com assinatura digital inválida retorna `400 ASSINATURA_INVALIDA`.
23. `POST /xmlFiscal` com chave que não bate com o XML retorna `400 CHAVE_NAO_BATE_XML`.
24. `POST /xmlFiscal` com `tipoDocumento` divergente do modelo real do XML retorna `400 TIPO_NAO_BATE_XML`.
25. `POST /xmlFiscal` para NF-e/CT-e sem participação da CAPUL retorna `409 NAO_RELACIONADO_CAPUL`.
26. `POST /xmlFiscal` cuja contraparte não esteja cadastrada retorna `409 CONTRAPARTE_NAO_CADASTRADA`.
27. Após `POST /xmlFiscal` bem-sucedido, o monitor de NF-e do Protheus enxerga o XML normalmente em SZR010 e processa a entrada de mercadoria como se ele tivesse vindo do download automático — incluindo a etapa em que o usuário preenche os campos do Grupo B em SZQ010 (`ZQ_CODSIG`, `ZQ_QTSIGA`, `ZQ_VLSIGA`, `ZQ_PEDCOM`, `ZQ_ITEMPC`).
28. `ZR_USRREC` dos registros gerados via API começa com `'API_FISCAL'`.
29. Os campos do Grupo B de SZQ010 (`ZQ_CODSIG`, `ZQ_QTSIGA`, `ZQ_VLSIGA`, `ZQ_PEDCOM`, `ZQ_ITEMPC`) ficam **vazios** após o POST — não são populados pela API.
30. Credencial sem permissão de escrita em SZR/SZQ retorna `403` no POST.

---

## 9. Informações Necessárias do Time Protheus

Pedimos ao time Protheus, em retorno a este documento, que informe:

**Sobre `cadastroFiscal` (mantido da v1.1, com ajuste do item 4):**
1. Aceite da proposta, aceite com ajustes ou indicação de alternativa.
2. Estimativa de esforço (horas ou dias) para a frente `cadastroFiscal`.
3. **Estimativa SEPARADA** para a implementação do `dataUltimoMovimento` / `comMovimentoDesde`, indicando qual das estratégias (a/b/c/d) da Seção 3.3.3 será adotada e por quê.
4. Eventuais campos da Seção 4 que não existam ou estejam em nomenclatura diferente.

**Sobre `xmlFiscal` (NOVO na v2.0):**
5. **A rotina de gravação em SZR010 (cabeçalho) + SZQ010 (itens) está encapsulada como User Function ADVPL reutilizável** (que faça o parsing do XML, valide XSD + assinatura, extraia os campos do `<emit>`/`<ide>`/`<det>` e grave nas duas tabelas em uma única transação como o monitor de NF-e faz)? Se sim, o esforço do POST é mínimo — o endpoint apenas valida o payload e chama a função. Se não, o time precisa criar essa função antes do endpoint — pedimos **estimativa específica** para esse trabalho, separada da estimativa do endpoint REST em si.
6. Confirmação de que **SZR010 é o cabeçalho** (com o XML completo no campo Memo `ZR_XML`) e **SZQ010 são os itens** (uma linha por `<det>`), conforme o dicionário X3 fornecido pela TI da CAPUL em 11/04/2026 e mapeado na Seção 4.3 deste documento. Caso a estrutura tenha mudado desde a última extração do dicionário, pedimos para indicar e atualizamos.
7. Confirmação dos valores válidos para `ZR_TPXML` (provavelmente strings como `NFE`/`CTE`) e `ZR_TPNF` (`0`/`1` para entrada/saída?) usados hoje pelo monitor automático.
8. Confirmação de que existe (ou pode ser criada) uma rotina ADVPL que **resolve um CNPJ contraparte em SA1010/SA2010 e retorna o `A2_COD`/`A2_LOJA` correspondentes**, para que o POST possa popular `ZR_CODFOR`/`ZR_LOJSIG`.
9. Concordância com a permissão `SELECT + INSERT` restrita para o usuário `API_FISCAL` em SZR010/SZQ010 (Seção 5.3) — sem `UPDATE`/`DELETE` e sem acesso a outras tabelas.
10. Concordância com a estratégia de validação dupla (XSD + assinatura) executada **dentro** do endpoint POST, antes da gravação, em uma única transação ACID.
11. Confirmação de que os campos do Grupo B de SZQ010 (`ZQ_CODSIG`, `ZQ_QTSIGA`, `ZQ_VLSIGA`, `ZQ_PEDCOM`, `ZQ_ITEMPC`) **não devem ser populados** pelo POST e ficam vazios para o usuário do Protheus completar durante a entrada de mercadoria, mantendo paridade com o comportamento do monitor automático.

**Geral:**
12. Usuário técnico (login) que será criado/ajustado para o Módulo Fiscal em HOM e PRD.
13. URL exata dos endpoints (caso a nomenclatura `INFOCLIENTES/cadastroFiscal` e `INFOCLIENTES/xmlFiscal` precise ser ajustada).
14. Eventuais restrições de rate limit ou janela de uso.
15. Contato técnico do lado Protheus para suporte durante o desenvolvimento e as homologações.

---

## 10. Próximos Passos

1. Time Protheus recebe este documento (v2.0) e analisa viabilidade das duas frentes.
2. Reunião técnica entre TI da CAPUL e Protheus para alinhar dúvidas (60 minutos — a v2.0 traz escrita pela primeira vez, então requer mais tempo que a reunião da v1.1).
3. Retorno do Protheus com aceite, prazos separados para `cadastroFiscal` e `xmlFiscal`, e eventuais ajustes no contrato da API.
4. Publicação dos endpoints em homologação.
5. Desenvolvimento do cliente HTTP no Módulo Fiscal:
   - `cadastroFiscal` → Etapa 18 da Onda 2 do plano (`PLANO_MODULO_FISCAL_v1.5`).
   - `xmlFiscal` → Etapa 5-bis da Onda 1 do plano (`PLANO_MODULO_FISCAL_v1.5`).
6. Validação dos critérios de aceite em homologação (12 originais + 15 novos = 27 critérios totais).
7. Publicação em produção, condicionada também à provisionamento do **certificado A1 dedicado** ao Módulo Fiscal (Mitigação A do item 11 do addendum v1.5 — bloqueante para go-live).

---

## Anexo A — Referências

- **`PLANO_MODULO_FISCAL_v1.4.docx`** — plano original do módulo, especialmente Seção 6 (Frente Cruzamento) e Seção 2.3.1 (frente NF-e).
- **`PLANO_MODULO_FISCAL_v1.5_ADDENDUM.md`** — addendum v1.4 → v1.5, especialmente itens 9 (xmlFiscal), 10 (cache antes do SEFAZ) e 11 (mitigação rate limit).
- **`ESPECIFICACAO_API_PROTHEUS_FISCAL.docx`** — versão 1.1 deste documento (substituída por esta v2.0 quando consolidada em `.docx`).
- Integração existente: módulo Inventário da Plataforma Capul — consumidor atual da `PROTHEUS_API_URL` (referência arquitetural para o cliente HTTP do Módulo Fiscal).

---

## Anexo B — Glossário

- **SA1010 / SA2010**: tabelas padrão do Protheus para Clientes e Fornecedores. Sufixo `010` indica empresa corrente.
- **SZR010**: tabela customizada da CAPUL no Protheus para o **cabeçalho** de cada XML fiscal (NF-e ou CT-e). Contém o XML completo no campo Memo `ZR_XML`. Chave composta: `(ZR_FILIAL, ZR_CHVNFE)`. Estrutura completa no Anexo C.
- **SZQ010**: tabela customizada da CAPUL no Protheus para os **itens** de cada XML fiscal (uma linha por `<det>` da NF-e ou item de CT-e). Vinculada à SZR010 por `(ZQ_FILIAL, ZQ_CHVNFE)`. Tem dois grupos de campos: Grupo A (do XML) preenchido pela API, Grupo B (casamento manual) deixado vazio para o usuário. Estrutura completa no Anexo C.
- **Grupo A / Grupo B (SZQ010)**: separação conceitual dos campos da SZQ010 introduzida na v2.0 deste documento. Grupo A = campos extraídos do XML pelo POST. Grupo B = campos `ZQ_CODSIG`, `ZQ_QTSIGA`, `ZQ_VLSIGA`, `ZQ_PEDCOM`, `ZQ_ITEMPC`, populados depois pelo usuário durante a entrada de mercadoria, fora do escopo da API.
- **SF1/SD1, SF2/SD2, SE1, SE2, SC5/SC7**: tabelas de movimento do Protheus (entradas, saídas, contas a receber, contas a pagar, pedidos). Usadas como base para o cálculo do `dataUltimoMovimento`.
- **`PROTHEUS_API_URL`**: URL base da API REST oficial do Protheus na CAPUL (`https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES`).
- **CCC**: CadConsultaCadastro2 — web service oficial de cadastro de contribuintes de cada SEFAZ estadual, consumido pelo Módulo Fiscal para cruzar com SA1/SA2.
- **NFeDistribuicaoDFe**: web service da SEFAZ Nacional que entrega XMLs autorizados aos participantes (emitente, destinatário, transportador). Usado pelo Módulo Fiscal para baixar XMLs ausentes em SZR010.
- **NfeConsultaProtocolo**: web service da SEFAZ que retorna o status atual de uma NF-e (autorizada, cancelada, com CC-e, etc.). Usado pelo Módulo Fiscal no botão "Atualizar status no SEFAZ".
- **Sincronização incremental**: leitura apenas dos registros criados/alterados desde a última execução. Exige `dataUltimaAlteracao` confiável.
- **Idempotência (xmlFiscal POST)**: garantia de que enviar a mesma chave duas vezes resulta no mesmo estado final do banco — sem duplicação.
- **Health check**: endpoint de verificação simples para monitoração de disponibilidade.
- **API_FISCAL**: usuário técnico criado especificamente para o Módulo Fiscal consumir esta API. Permissões mínimas — Seção 5.3.
- **MODULO_FISCAL_CAPUL**: identificador conceitual da origem dos XMLs gravados pela API. Operacionalmente é registrado no campo `ZR_USRREC` com o prefixo `'API_FISCAL'` (ver Seção 5.4) para que o time fiscal consiga distinguir, com um filtro simples em SZR010, quais XMLs vieram via Módulo Fiscal versus os vindos do monitor automático do Protheus.

---

## Anexo C — Dicionário de dados das tabelas SZR010 e SZQ010

Esta seção reproduz a estrutura real das tabelas customizadas SZR010 e SZQ010 conforme o dicionário X3 do Protheus exportado pela TI da CAPUL em 11/04/2026 (arquivo `SZQ_SZR.csv`). Tipos: `C` = Caractere, `N` = Numérico, `D` = Data, `M` = Memo, `L` = Lógico.

### C.1. SZR010 — Cabeçalho do XML

| Ordem | Campo | Tipo | Tam. | Dec. | Título | Descrição |
|---|---|---|---|---|---|---|
| 01 | `ZR_MODELO` | C | 5 | 0 | Modelo | Modelo do documento (55 NF-e, 57 CT-e, etc.) |
| 02 | `ZR_FILIAL` | C | 2 | 0 | Filial | Filial do Sistema |
| 03 | `ZR_CHVNFE` | C | 44 | 0 | Chave Eletro | Chave de acesso eletrônica (NF-e ou CT-e) |
| 04 | `ZR_DTREC` | D | 8 | 0 | Dt Recebimen | Data de recebimento |
| 05 | `ZR_HRREC` | C | 8 | 0 | Hora Receb. | Hora de recebimento |
| 06 | `ZR_XML` | M | — | — | XML | Conteúdo completo do XML (Memo) |
| 07 | `ZR_ECMUN` | C | 8 | 0 | Cod Mun Emit | Código do município do emitente |
| 08 | `ZR_ECNPJ` | C | 14 | 0 | CNPJ Emit | CNPJ do emitente |
| 09 | `ZR_ELGR` | C | 100 | 0 | Longr. Emit | Logradouro do emitente |
| 10 | `ZR_ENOME` | C | 100 | 0 | Nome Emit | Razão social do emitente |
| 11 | `ZR_ENRO` | C | 6 | 0 | Numero Emit | Número do endereço do emitente |
| 12 | `ZR_EBAIRR` | C | 50 | 0 | Bairro Emit | Bairro do emitente |
| 13 | `ZR_NNF` | C | 9 | 0 | Numero NF | Número da nota fiscal |
| 14 | `ZR_EXMUN` | C | 50 | 0 | Mun Emit | Município do emitente |
| 15 | `ZR_EUF` | C | 2 | 0 | UF Emit | UF do emitente |
| 16 | `ZR_ECEP` | C | 8 | 0 | CEP Emit | CEP do emitente |
| 17 | `ZR_EFONE` | C | 30 | 0 | Fone E | Telefone do emitente |
| 18 | `ZR_EIE` | C | 20 | 0 | Inscr Emit | Inscrição estadual do emitente |
| 19 | `ZR_TPXML` | C | 3 | 0 | Tipo XML | Tipo do XML (NFE/CTE/etc. — confirmar valores) |
| 20 | `ZR_SERIE` | C | 3 | 0 | Serie NF | Série da nota fiscal |
| 21 | `ZR_EMISSA` | D | 8 | 0 | Emissao | Data de emissão |
| 22 | `ZR_CODFOR` | C | 6 | 0 | Fornece Siga | Código do fornecedor no Protheus (link com SA2010.A2_COD) |
| 23 | `ZR_LOJSIG` | C | 4 | 0 | Loja Siga | Loja do fornecedor (SA2010.A2_LOJA) |
| 24 | `ZR_USRREC` | C | 30 | 0 | Usuario Rec | Usuário recebedor (a v2.0 usa prefixo `API_FISCAL` para gravações via Módulo Fiscal) |
| 25 | `ZR_UFORITR` | C | 2 | 0 | UF Ori Trans | UF origem do transporte (CT-e) |
| 26 | `ZR_VALCTE` | N | 17 | 2 | Valor CTE | Valor do CT-e |
| 27 | `ZR_MUORITR` | C | 5 | 0 | Mun Ori Tran | Município original do transporte (CT-e) |
| 28 | `ZR_MUDESTR` | C | 5 | 0 | Mun Dest Tra | Município destino do transporte (CT-e) |
| 29 | `ZR_TERCEIR` | L | 1 | 0 | Terceiro | Indica se é operação por conta de terceiro |
| 30 | `ZR_UFDESTR` | C | 2 | 0 | UF Dest Tran | UF destino do transporte (CT-e) |
| 31 | `ZR_TPNF` | C | 1 | 0 | Tipo da NFe | Tipo da nota fiscal (entrada/saída — confirmar valores) |

### C.2. SZQ010 — Itens do XML (1 linha por `<det>` ou item de CT-e)

| Ordem | Campo | Tipo | Tam. | Dec. | Grupo | Título | Origem |
|---|---|---|---|---|---|---|---|
| 01 | `ZQ_FILIAL` | C | 2 | 0 | A | Filial | Payload `filial` |
| 02 | `ZQ_CHVNFE` | C | 44 | 0 | A | Chave NF | Payload `chave` |
| 03 | `ZQ_ITEM` | C | 3 | 0 | A | Item | `<det nItem="X">` |
| 04 | `ZQ_PROD` | C | 30 | 0 | A | Produto | `<cProd>` |
| 05 | `ZQ_EAN` | C | 15 | 0 | A | EAN | `<cEAN>` |
| 06 | `ZQ_CODSIG` | C | 15 | 0 | **B** | Codigo Siga | **VAZIO — código produto Protheus, casamento manual** |
| 07 | `ZQ_DESCRI` | C | 100 | 0 | A | Descricao | `<xProd>` |
| 08 | `ZQ_UM` | C | 3 | 0 | A | UM | `<uCom>` |
| 09 | `ZQ_QTDE` | N | 14 | 4 | A | Quantidade | `<qCom>` |
| 10 | `ZQ_VLUNIT` | N | 18 | 9 | A | Vl Unitario | `<vUnCom>` |
| 11 | `ZQ_TOTAL` | N | 14 | 2 | A | Total | `<vProd>` |
| 12 | `ZQ_CTNF` | C | 9 | 0 | A | CTE Nf | (CT-e) número da NF associada |
| 13 | `ZQ_QTSIGA` | N | 14 | 4 | **B** | Qt Siga | **VAZIO — quantidade convertida para UM Protheus** |
| 14 | `ZQ_VLSIGA` | N | 18 | 9 | **B** | Valor Siga | **VAZIO — valor unitário em UM Protheus** |
| 15 | `ZQ_PEDCOM` | C | 6 | 0 | **B** | Ped. Compra | **VAZIO — pedido de compra a casar** |
| 16 | `ZQ_ITEMPC` | C | 4 | 0 | **B** | Item PC | **VAZIO — item do pedido de compra** |
| 17 | `ZQ_CHVCTE` | C | 44 | 0 | A | Chv CTE | (CT-e) chave do CT-e |
| 18 | `ZQ_XMLIMP` | M | — | — | A | Xml Imp | XML do bloco `<imposto>` recortado do item (Memo) |
| 19 | `ZQ_CTSER` | C | 3 | 0 | A | CTe Serie | (CT-e) série |
| 20 | `ZQ_CTFOR` | C | 6 | 0 | A | CTe Forn | (CT-e) fornecedor (transportadora) |
| 21 | `ZQ_CTLOJ` | C | 2 | 0 | A | CTe Loja | (CT-e) loja do fornecedor |
| 22 | `ZQ_CFOP` | C | 5 | 0 | A | CFOP | `<CFOP>` do item |

**Legenda dos grupos:**
- **A** — Preenchido pelo POST `/xmlFiscal` a partir do parsing do XML.
- **B** — **NÃO preenchido pela API.** Reservado para o usuário do Protheus completar durante a entrada de mercadoria (casamento NF × pedido × produto interno).
