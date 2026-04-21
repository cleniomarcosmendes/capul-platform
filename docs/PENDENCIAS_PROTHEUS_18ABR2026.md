# CAPUL — Plataforma Capul / Módulo Fiscal
## Pendências técnicas sobre os contratos `/grvXML` e `/eventosNfe`

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 18/04/2026 — **Atualizado em 20/04/2026** (arquitetura revisada após alinhamento)
- **Referência:** Contratos recebidos em 18/04/2026
  - `szr010-szq010.txt` — `POST /rest/api/INFOCLIENTES/FISCAL/grvXML`
  - `Eventos_nfe.txt` — `GET /rest/api/INFOCLIENTES/FISCAL/eventosNfe`

---

## 🆕 Atualização 20/04/2026 (parte 2) — Decisão sobre CT-e

Após varredura em PRODUÇÃO da chave de teste `31260316505190000139570010013015461001507170` em todas as tabelas Protheus relevantes (SZR010, SZQ010, GZH010, SF1010, SF2010, C00010, CC0010, SPED150, SPED154, SPED156, SPED050) — **CT-e não foi localizado em nenhuma tabela**.

**Decisão:**

- **CT-e será tratado de forma diferente da NF-e** — fica **fora** do fluxo Protheus por enquanto.
- A plataforma **continua chamando SEFAZ direto** para CT-e (XML + eventos via `CteConsultaProtocolo` per-UF), conforme já implementado em `fiscal/backend/src/cte/cte.service.ts`.
- **NÃO grava CT-e em SZR010/SZQ010** via `/grvXML` — equipe Protheus precisa antes investigar/definir captação local.
- **NÃO chama `/xmlNfe` nem `/eventosNfe` com chave de CT-e** — só faz sentido para NF-e.
- Equipe Protheus vai aprofundar investigação. Quando trouxerem algo consistente sobre captação de CT-e (job, tabela, processo de geração de SZR010 com `ZR_TPXML='CTe'`), abriremos novo planejamento dedicado.

**Resumo da divisão de fluxo (20/04/2026):**

| Documento | Origem do XML | Origem dos eventos | Cache local Protheus |
|-----------|---------------|---------------------|----------------------|
| **NF-e (modelo 55)** | `/xmlNfe` Protheus → fallback SEFAZ → `/grvXML` | `/eventosNfe` Protheus | ✅ SZR010/SZQ010 + SPED150/156 |
| **CT-e (modelo 57)** | **SEFAZ direto** (NFeDistribuicaoDFe / nacional + per-UF) | **CteConsultaProtocolo SEFAZ** (per-UF) | ❌ Por enquanto, só `fiscal.documento_evento` (cache da plataforma) |

---

## 🆕 Atualização 20/04/2026 — Arquitetura revisada

Após alinhamento com a equipe Protheus, o fluxo de consulta ficou definido como **3 camadas hierárquicas**, e os **bloqueadores 2.1 e 2.2 foram removidos**:

```
[1] Plataforma → Protheus (endpoint único de consulta)
    Protheus resolve internamente (transparente):
      ├─ SZR010/SZQ010  (cache gravado)
      ├─ SPED156.ZIPPROC (XML extraído + gravado em SZR/SZQ automaticamente)
      └─ SPED150 (timeline de eventos)
    Resposta:
      ├─ achou → { xmlBase64, eventos[], origem: "SZR"|"SPED156" } → FIM
      └─ não achou → 404

[2] Plataforma → SEFAZ direto (com certificado A1 próprio da CAPUL)
    ├─ baixa XML via NFeDistribuicaoDFe
    └─ chama POST /grvXML (Protheus) para gravar em SZR/SZQ → FIM
```

**Decisões consolidadas:**

| Decisão | Valor |
|---------|-------|
| Quem consulta SZR/SZQ/SPED? | **Protheus** (transparente para o cliente) |
| Quem baixa SEFAZ no fallback? | **Plataforma Fiscal (CAPUL)** — com A1 próprio |
| Onde é gerido o certificado A1? | **Configurador** (Plataforma CAPUL) |
| Status dos endpoints | Equipe Protheus está **finalizando o endpoint unificado** |

**Impacto nos bloqueadores originais:**

- 🔴 **2.1 — Falta GET para recuperar XML**: **RESOLVIDO** — o endpoint unificado já retorna `xmlBase64` quando encontra em SZR/SZQ/SPED156.
- 🔴 **2.2 — Falta endpoint `baixarXmlSefaz`**: **RESOLVIDO** — quem baixa da SEFAZ é a própria plataforma (usando A1 da CAPUL, não do Protheus).

As seções 2.1 e 2.2 abaixo ficam **arquivadas** como histórico da negociação.

---

## 1. Resumo

Obrigado pelo envio dos contratos. Analisamos ambos e identificamos pontos que precisam ser esclarecidos ou complementados antes de iniciarmos a implementação no lado da Plataforma Capul (Módulo Fiscal).

As pendências estão organizadas em 3 grupos:

- **🔴 Bloqueadores** — impedem de fechar o fluxo desenhado na especificação v2.0 (download SEFAZ via Protheus, cache em SZR010).
- **🟡 Esclarecimentos** — afetam a forma como construímos o payload mas não bloqueiam o início do desenvolvimento.
- **🟢 Observações** — pequenos erros ou ajustes que não impactam o contrato.

---

## 2. 🔴 ~~Bloqueadores~~ — RESOLVIDOS em 20/04/2026 (ver topo da doc)

### 2.1. ~~Falta endpoint GET para **recuperar XML** da SZR010~~ [HISTÓRICO]

A especificação v2.0 (doc `ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md`, Seção 3.1) previa 3 operações para a frente de XML:

| # | Endpoint previsto | Status atual |
|---|---|---|
| 1 | `GET /xmlFiscal/{chave}/exists` — cache check leve | ❌ Não recebido |
| 2 | `GET /xmlFiscal/{chave}` — recuperar XML armazenado + metadados | ❌ Não recebido |
| 3 | `POST /xmlFiscal` — gravar XML | ✅ Recebido como `/grvXML` |

Sem o GET de recuperação, **o fluxo de consulta por chave não se fecha**: a plataforma até consegue saber que a chave existe no Protheus (via `/eventosNfe`, se houver evento com `origem = SZR010`), mas não consegue **ler o conteúdo do campo `ZR_XML`** para exibir ao usuário, parsear ou reenviar.

#### Impacto

Sem esse endpoint, a plataforma precisaria **sempre consultar o SEFAZ** quando o usuário pedisse um XML por chave — mesmo quando o XML já estivesse gravado em SZR010. Isso:

1. Viola a regra da Capul de **não chamar SEFAZ diretamente** (apenas via Protheus).
2. Consome a quota diária do CNPJ desnecessariamente.
3. Duplica XMLs no ambiente (baixados novamente mesmo quando já existem localmente).

#### Proposta de solução

Duas alternativas, qualquer uma atende:

**Opção A** — Criar os 2 endpoints previstos na spec v2.0:
- `GET /rest/api/INFOCLIENTES/FISCAL/xmlFiscal/{chave}/exists` → `{ existe: true|false }`
- `GET /rest/api/INFOCLIENTES/FISCAL/xmlFiscal/{chave}` → `{ chave, xmlBase64, metadados: { filial, modelo, emissao, ... } }`

**Opção B** — Estender o `/eventosNfe` com um parâmetro opcional:
- `GET /eventosNfe?CHAVENFEE=...&incluirXml=true`
- Resposta adicional: `{ ..., xmlBase64: "<...>" | null }` — null se não houver XML em SZR010

A Opção B é preferível porque resolve em **uma única chamada** (timeline + XML se existir) e tem menor custo de implementação no lado Protheus.

---

### 2.2. ~~Falta endpoint para **download do XML via portal SEFAZ** (fallback)~~ [HISTÓRICO]

A especificação v2.0 (Seção 2.1, frente 2) previa que **o Protheus faria o download** do XML na SEFAZ quando o XML ainda não existisse em SZR010, usando o certificado A1 já gerenciado pelo Protheus. A intenção era que a plataforma Fiscal **nunca** chamasse SEFAZ diretamente.

O `/grvXML` recebido **assume que o XML já está disponível no lado da plataforma** (campo `xmlBase64` do body). Isso implica que a plataforma precisa obter o XML por outro meio — hoje, apenas via SEFAZ direto.

#### Impacto

Mesmo problema do bloqueador 2.1: sem um endpoint Protheus que "baixe o XML da SEFAZ em nome da Capul", precisamos manter o cliente SEFAZ no lado da Plataforma Fiscal — o que contradiz a intenção arquitetural acordada.

#### Proposta de solução

Adicionar um endpoint:

- `POST /rest/api/INFOCLIENTES/FISCAL/baixarXmlSefaz`
- Body: `{ chave: string, ambiente: "PROD"|"HOM" }`
- Comportamento: o Protheus usa seu próprio certificado A1 para baixar o XML via `NFeDistribuicaoDFe` e retorna à plataforma
- Resposta 200: `{ chave, xmlBase64, origem: "SEFAZ_DOWNLOAD", dhDownload }`
- Resposta 404: `{ code: 404, message: "Chave não encontrada na SEFAZ (cStat=X)" }`
- Resposta 409: `{ code: 409, message: "Chave fora de prazo SEFAZ" }` (cStat=632, por exemplo)

**Nota:** uma implementação enxuta é: o endpoint `baixarXmlSefaz` também já **grava** em SZR010/SZQ010 no sucesso (faz a gravação internamente, sem exigir chamada separada a `/grvXML`). Isso é natural e simplifica o lado do cliente.

---

## 2bis. 🆕 Perguntas novas sobre o endpoint unificado (20/04/2026)

Com a arquitetura revisada, precisamos de algumas confirmações sobre o endpoint unificado que o Protheus está finalizando:

### 2bis.1. Nome e assinatura do endpoint

**Pergunta:** o endpoint unificado será:

1. O `/eventosNfe` existente **estendido** para já incluir `xmlBase64` na resposta?
2. Um endpoint novo (ex: `GET /rest/api/INFOCLIENTES/FISCAL/consultaNfe/{chave}`)?

A preferência é um endpoint **novo e explícito**, porque o nome `/eventosNfe` sugere "apenas timeline" e evita ambiguidade no cliente HTTP.

### 2bis.2. Formato da resposta de sucesso

Sugestão de contrato para alinhamento:

```json
// 200 OK — encontrado
{
  "chave": "53260455087053000183550010000008961143366160",
  "xmlBase64": "PD94bWwg...",
  "origem": "SZR" | "SPED156" | "SPED150_SEM_XML",
  "cabecalho": {
    "filial": "01",
    "modelo": "55",
    "serie": "001",
    "numero": "896114",
    "emissao": "2026-04-18",
    "emitente": { "cnpj": "...", "razaoSocial": "...", "codFor": "F14059", "loja": "0001" },
    "destinatario": { "cnpj": "...", "razaoSocial": "..." },
    "valorTotal": 12345.67
  },
  "eventos": [
    { "quando": "20260418 10:23:14", "origem": "SPED150", "tipo": "AUTORIZACAO", "ator": "SEFAZ", "detalhes": {...} },
    { "quando": "20260418 10:40:22", "origem": "SPED156", "tipo": "CCE", "ator": "SEFAZ", "detalhes": {...} },
    { "quando": "20260419 09:12:00", "origem": "SZR010",  "tipo": "ARMAZENAMENTO_XML", "ator": "PROTHEUS", "detalhes": {...} }
  ]
}

// 404 Not Found — não existe em SZR/SZQ/SPED156/SPED150 do Protheus
{ "code": 404, "message": "Chave não encontrada no Protheus — consultar SEFAZ" }
```

**Perguntas:**

1. O campo `origem` retorna de onde o Protheus extraiu o XML/eventos? Isso nos ajuda a saber se o SZR já foi gravado ou se o Protheus está montando a resposta a partir da SPED156 pela primeira vez.
2. Quando o Protheus extrai XML da **SPED156.ZIPPROC pela primeira vez**, ele **já grava automaticamente em SZR/SZQ** (como combinado) ou retorna só para a plataforma e nós disparamos o `/grvXML` depois?
3. Quando encontrado apenas em **SPED150 sem XML** (raro, mas possível — evento registrado mas XML nunca chegou), ainda retorna 200 com `xmlBase64: null` + lista de eventos? Ou retorna 404 porque o foco é o XML?

### 2bis.3. Comportamento do 404 e fallback SEFAZ

Confirmação: quando o Protheus retorna 404 (não achou em nenhuma das fontes), a plataforma:

1. Chama SEFAZ direto com seu próprio certificado A1 da CAPUL
2. Ao obter sucesso, chama `POST /grvXML` para gravar em SZR/SZQ
3. **Opcional**: registra um evento em SPED156 também? Ou o `/grvXML` já cuida disso?

**Pergunta:** após o fallback SEFAZ + `/grvXML`, uma consulta subsequente ao endpoint unificado deve retornar **200 OK** com `origem: "SZR"` (confirmando que foi gravado). Isso está implícito, mas queremos confirmar.

### 2bis.4. Certificado A1 da plataforma

Como a plataforma agora baixa direto da SEFAZ no fallback, vamos gerir o certificado A1 da CAPUL no **Configurador da Plataforma** (não no Protheus). Isso foi combinado em sessões anteriores. **Confirmação:** o Protheus não precisa nos fornecer acesso ao certificado A1 dele — só precisamos do endpoint unificado e do `/grvXML`.

---

## 3. 🟡 Esclarecimentos

### 3.1. Preenchimento de **CODFOR / LOJSIG** no body do `/grvXML`

No exemplo recebido, o body do `XMLCAB` traz:

```json
{ "campo": "CODFOR",  "valor": "F14059" },
{ "campo": "LOJSIG",  "valor": "0001" }
```

Esses são os códigos do fornecedor (SA2010) e da loja no Protheus, correspondentes ao CNPJ do emitente.

**Pergunta:** quem resolve essa informação?

1. **Cliente (Plataforma Fiscal)** — chama `/cadastroFiscal?cnpj=<ECNPJ>` antes, extrai SA2.A2_COD e SA2.A2_LOJA, e preenche no body do `/grvXML`?
2. **Protheus** — resolve internamente a partir do CNPJ do emitente no XML, usando SA2010?
3. **Opcional** — se o fiscal não enviar, o Protheus resolve sozinho; se enviar, respeita?

A preferência da CAPUL é a opção 2 (Protheus resolve) — economiza uma chamada e é mais robusto a inconsistências.

---

### 3.2. Campos "siga" no `/grvXML` (XMLIT)

No exemplo recebido, cada item (XMLIT) traz:

```json
{ "campo": "CODSIG",  "valor": "00034164" },
{ "campo": "QTSIGA",  "valor": "540" },
{ "campo": "VLSIGA",  "valor": "7.7778" },
{ "campo": "PEDCOM",  "valor": "431037" }
```

A especificação v2.0 (Seção 2.1, frente 2, in-line) dizia explicitamente: *"Os campos 'siga' da SZQ010 (`ZQ_CODSIG`, `ZQ_QTSIGA`, `ZQ_VLSIGA`, `ZQ_PEDCOM`, `ZQ_ITEMPC`) **NÃO** são preenchidos pela API — eles são reservados para o casamento manual NF × pedido durante a entrada de mercadoria."*

O exemplo recebido mostra esses campos **preenchidos**. Isso sugere que a interpretação mudou.

**Pergunta:** o que o Protheus espera no `/grvXML` para esses campos?

1. **Obrigatório** — o fiscal precisa calcular/resolver (vindo de onde?)
2. **Opcional** — pode enviar vazio ou omitir; Protheus grava nulo
3. **Ignorado** — mesmo que enviado, Protheus sobrescreve no casamento manual posterior

A preferência é a opção 2 (opcional) — o fiscal não tem como resolver esses campos (são do mundo de compras do Protheus).

---

### 3.3. Campo `USRREC` — qual usuário?

No exemplo: `{ "campo": "USRREC", "valor": "FRANCIELE SILVA" }`.

**Pergunta:** este campo deve conter:

1. O nome do usuário técnico fixo da API (ex: `API_FISCAL`)?
2. O nome do operador do Módulo Fiscal que disparou a consulta (propagado via JWT)?
3. Qualquer string descritiva (ex: `"PLATAFORMA_FISCAL_CAPUL"`)?

A preferência é a opção 2 — identifica **quem** na CAPUL originou a gravação, útil para auditoria interna.

---

### 3.4. Suporte a **CT-e** (modelos 57 e 67)

A documentação recebida exemplifica apenas **NF-e modelo 55**:
- `/grvXML` traz `{ "campo": "TPXML", "valor": "NFe" }` no exemplo
- `/eventosNfe` é nomeado só para NF-e

**Perguntas:**

1. O `/grvXML` aceita CT-e também, bastando enviar `TPXML: "CTe"` e `MODELO: "57"`?
2. Existe endpoint análogo `/eventosCte` para recuperar a timeline de CT-e, ou é o mesmo `/eventosNfe` que aceita chaves de CT-e?
3. Os campos específicos de CT-e mencionados na v2.0 (`ZQ_CHVCTE`, `ZQ_CTNF`, `ZQ_CTSER`, `ZQ_CTFOR`, `ZQ_CTLOJ`) devem aparecer no `XMLIT` ou são preenchidos pelo Protheus a partir do parsing do XML de CT-e?

---

### 3.5. Suporte a **NFC-e** (modelo 65)

A CAPUL não emite NFC-e atualmente, mas pode haver casos futuros (venda ao consumidor final em eventos/pontos de venda).

**Pergunta:** o `/grvXML` aceita NFC-e via `TPXML: "NFe"` + `MODELO: "65"`? A estrutura SZR010/SZQ010 suporta?

Se não for suportado no primeiro momento, tudo bem — podemos marcar como roadmap futuro.

---

### 3.6. Credencial técnica e URLs

Para iniciar a integração, precisamos:

1. **URL de homologação** da API Protheus para o Módulo Fiscal (presumimos que seja diferente de `https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES`, que é produção).
2. **Credencial técnica** (usuário `API_FISCAL` mencionado na spec v2.0, ou outro) — login + senha ou token.
3. **Endpoint de health** para o Fiscal — presumimos `/rest/healthcheck` (confirmado na API `cadastroFiscal` v1) ou endpoints próprios `/grvXML/health` e `/eventosNfe/health`?
4. **Quais IPs/origens** da Plataforma Capul estão liberados no firewall do Protheus para acessar os novos endpoints?

---

### 3.7. Idempotência do `/grvXML`

**Pergunta:** se a plataforma chamar `/grvXML` com uma chave que **já existe** em SZR010, qual é o comportamento esperado?

1. **Erro 409** — conflito, não grava nada
2. **200 idempotente** — detecta que já existe, retorna sucesso sem regravar
3. **Substituição** — sobrescreve cabeçalho e itens

A preferência da CAPUL é a opção 2 (idempotência por chave) — protege contra retries e duplicatas.

---

### 3.8. Response do `/grvXML`

A documentação mostra só o request. **Pergunta:** qual é o formato da resposta de sucesso e de erro?

Sugestão de contrato:

```json
// 201 Created (ou 200 se idempotente)
{
  "chave": "53260455087053000183550010000008961143366160",
  "resultado": "INSERIDO" | "JA_EXISTIA",
  "registrosCabecalho": 1,
  "registrosItens": 4
}

// 400 Bad Request (validação)
{
  "code": 400,
  "message": "XML inválido ou campos obrigatórios ausentes",
  "detalhes": [...]
}

// 422 Unprocessable Entity (XML não assinado / inválido para SEFAZ)
{
  "code": 422,
  "message": "Assinatura digital do XML inválida"
}
```

---

## 4. 🟢 Observações

### 4.1. Troca de alias na documentação `szr010-szq010.txt` (erro de digitação)

A doc menciona:

- *"`alias` = `XMLCAB` para cabeçalho de xml (**SZQ**)"*
- *"`alias` = `XMLIT` para itens do xml (**SZR**)"*

Pelos prefixos dos campos (`ZR_*` = SZR, `ZQ_*` = SZQ) e pelo dicionário do Protheus, o correto é:

- `XMLCAB` = cabeçalho → **SZR010** (campos `ZR_*`)
- `XMLIT` = itens → **SZQ010** (campos `ZQ_*`)

Sem impacto técnico (os campos estão consistentes), apenas sugestão de correção da doc.

---

### 4.2. Parâmetro de `/eventosNfe` é `CHAVENFEE` (duplo E)

Apenas registrando para evitar erro de digitação na implementação do cliente. O nome usual seria `chaveNfe` ou `CHAVENFE`.

---

### 4.3. Formato de data nos eventos

O campo `quando` em `/eventosNfe` segue `YYYYMMDD HH:MM:SS` (com espaço). Vamos parsear dessa forma no lado da Plataforma. Apenas confirmando que o **timezone** é **America/Sao_Paulo (UTC-03:00)**, correto?

---

### 4.4. Origem `SF1010` na timeline

O exemplo inclui entrada `SF1010` ("Entrada fiscal dada no Protheus"). Pelo acordo interno da CAPUL (Módulo Fiscal), SF1010 será **filtrado na UI** e exibido como card separado fora da timeline estrita (que fica apenas com SPED150/SPED156/SZR010/SPED156-CCE). Não precisamos de mudança no contrato — é tratamento no lado da plataforma.

---

## 5. O que a CAPUL pode adiantar **enquanto** o endpoint unificado é finalizado

Com a arquitetura revisada (20/04), a CAPUL pode avançar em paralelo:

1. **Cliente HTTP do endpoint unificado** — podemos esboçar com base no contrato sugerido em 2bis.2 e ajustar quando o Protheus publicar a versão final.
2. **Cliente HTTP do `/grvXML`** — pronto para uso no fallback SEFAZ; depende apenas dos esclarecimentos 3.1, 3.2, 3.7 e 3.8.
3. **Service `XmlParserToSzrSzq`** — extrai ~25 campos de cabeçalho e N campos por item de um XML `nfeProc` para montar o body do `/grvXML`. Desenvolvível e testável unitariamente.
4. **Cliente SEFAZ direto (NFeDistribuicaoDFe)** — com certificado A1 CAPUL gerido pelo Configurador, já previsto no plano v2.0.
5. **Atualização do `EventosTimeline`** (frontend) — para o novo formato `{ quando, origem, tipo, ator, detalhes }`.
6. **Filtragem de SF1010** na UI conforme regra interna (item 4.4).

**Bloqueios atuais:**

- Testes de integração real — dependem da publicação em homologação do endpoint unificado (equipe Protheus finalizando) e das URLs/credenciais (item 3.6).
- Confirmação do contrato de resposta em 2bis.2 — sem isso, o cliente HTTP fica em "esboço" e pode precisar de ajuste.

---

## 6. Próxima ação

**Status 20/04/2026:** bloqueadores 2.1 e 2.2 foram **resolvidos no alinhamento** e a equipe Protheus está **finalizando o endpoint unificado**.

Solicitamos gentilmente:

1. **Publicação do contrato final** do endpoint unificado (nome, parâmetros, formato de resposta) — ver perguntas 2bis.1 a 2bis.4.
2. **Esclarecimentos** nos itens 3.1 a 3.8 (preenchimento de CODFOR/LOJSIG, idempotência, response do `/grvXML`, credenciais de homologação etc.).
3. **Data estimada** para publicação em homologação dos 2 endpoints (unificado + `/grvXML`).

Nos colocamos à disposição para reunião técnica presencial ou remota para discutir qualquer ponto.

---

**Atenciosamente,**
**Departamento de T.I. — CAPUL**
