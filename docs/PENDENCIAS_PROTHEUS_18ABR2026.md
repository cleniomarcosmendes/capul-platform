# CAPUL — Plataforma Capul / Módulo Fiscal
## Pendências técnicas sobre os contratos `/grvXML` e `/eventosNfe`

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 18/04/2026
- **Referência:** Contratos recebidos em 18/04/2026
  - `szr010-szq010.txt` — `POST /rest/api/INFOCLIENTES/FISCAL/grvXML`
  - `Eventos_nfe.txt` — `GET /rest/api/INFOCLIENTES/FISCAL/eventosNfe`

---

## 1. Resumo

Obrigado pelo envio dos contratos. Analisamos ambos e identificamos pontos que precisam ser esclarecidos ou complementados antes de iniciarmos a implementação no lado da Plataforma Capul (Módulo Fiscal).

As pendências estão organizadas em 3 grupos:

- **🔴 Bloqueadores** — impedem de fechar o fluxo desenhado na especificação v2.0 (download SEFAZ via Protheus, cache em SZR010).
- **🟡 Esclarecimentos** — afetam a forma como construímos o payload mas não bloqueiam o início do desenvolvimento.
- **🟢 Observações** — pequenos erros ou ajustes que não impactam o contrato.

---

## 2. 🔴 Bloqueadores

### 2.1. Falta endpoint GET para **recuperar XML** da SZR010

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

### 2.2. Falta endpoint para **download do XML via portal SEFAZ** (fallback)

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

## 5. O que a CAPUL pode adiantar **sem** essas respostas

Enquanto aguardamos o posicionamento da equipe Protheus, a CAPUL pode avançar:

1. **Cliente HTTP do `/eventosNfe`** — contrato claro, só GET, não bloqueia.
2. **Cliente HTTP do `/grvXML`** — pode ser esboçado, mas precisa esclarecer itens 3.1, 3.2, 3.7 e 3.8 antes de testar em homologação.
3. **`XmlParserToSzrSzq`** — service que extrai ~25 campos de cabeçalho e N campos por item de um XML `nfeProc` para montar o body do `/grvXML`. Pode ser desenvolvido e testado unitariamente sem dependência da API real.
4. **Atualização do `EventosTimeline`** (frontend) — para consumir o novo formato `{ quando, origem, tipo, ator, detalhes }` no lugar do formato atual.
5. **Filtragem de SF1010** na UI conforme regra interna (item 4.4).

Não avançaremos:

- Fluxo "cache SZR" até o bloqueador 2.1 estar resolvido
- Remoção das chamadas SEFAZ diretas até o bloqueador 2.2 estar resolvido
- Testes de integração real até as URLs/credenciais do item 3.6 estarem definidas

---

## 6. Próxima ação

Solicitamos gentilmente:

1. **Posicionamento formal** sobre os bloqueadores 2.1 e 2.2 (com preferência pelas opções propostas ou outra alternativa).
2. **Esclarecimentos** nos itens 3.1 a 3.8.
3. **Data estimada** para publicação em homologação dos endpoints acordados.

Nos colocamos à disposição para reunião técnica presencial ou remota para discutir qualquer ponto.

---

**Atenciosamente,**
**Departamento de T.I. — CAPUL**
