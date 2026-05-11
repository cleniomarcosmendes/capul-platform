# CAPUL — Plataforma Capul / Módulo Fiscal
## Pendências técnicas sobre os contratos `/grvXML` e `/eventosNfe`

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 18/04/2026 — **Atualizado em 11/05/2026** (validação fix U_AMARRCTE em HOM)
- **Referência:** Contratos recebidos em 18/04/2026
  - `szr010-szq010.txt` — `POST /rest/api/INFOCLIENTES/FISCAL/grvXML`
  - `Eventos_nfe.txt` — `GET /rest/api/INFOCLIENTES/FISCAL/eventosNfe`

---

## 🆕 Atualização 11/05/2026 — Validação do fix U_AMARRCTE em HOM

A equipe Protheus comunicou em 11/05/2026 a aplicação do fix das SPs custom `U_AMARRCTE` / `U_AMARRAC7` / `U_GERASA5` em ambiente de **HOMOLOGAÇÃO** (incidente registrado em 08/05/2026, ver `memory/project_cte_incidente_u_amarrcte_08mai.md`).

### Validação executada em 11/05/2026

- Endpoint `grvXML` temporariamente apontado para HOM (`https://192.168.7.63:8115/.../grvXML`) na tabela `core.integracoes_api_endpoints`.
- 4 CT-es novos (não pré-carregados pela equipe Protheus em HOM) disparados via `POST /api/v1/fiscal/cte/recebidos/:id/regravar-protheus-local`:

| id local | Chave | Filial CAPUL | Resultado |
|---|---|---|---|
| 5114 | `31260526866501000149570010000011871024653324` | 18 | `GRAVADO_PRENOTA_FALHOU` |
| 5115 | `31260526866501000149570010000011891019592694` | 18 | `GRAVADO_PRENOTA_FALHOU` |
| 5116 | `31260526866501000149570010000011901047966782` | 18 | `GRAVADO_PRENOTA_FALHOU` |
| 5117 | `31260526866501000149570010000011911224882435` | 18 | `GRAVADO_PRENOTA_FALHOU` |

Adicionalmente, 5 CT-es do bucket `FALHA_TECNICA` original (ids 54–58, lote 08/05) retornaram `JA_EXISTIA` — a equipe Protheus já havia injetado o XML em HOM em 09/05/2026 às 19:15 para teste da correção.

### Conclusão

- ✅ **U_AMARRCTE / U_AMARRAC7 / U_GERASA5** corrigida em HOM. **Zero ocorrências de `DisarmTransaction`** na amarração CT-e. `protheus_grv_xml_gravado=true` em 100% das tentativas.
- ⚠️ **U_PRENF / U_NFeSaida** **continua falhando** — XML grava corretamente em XMLCAB/XMLIT, porém a geração da pré-nota não ocorre automática. Verificar `error_<chave>.log` no AppServer Protheus HOM.

### Impacto atual do bug remanescente (U_PRENF)

Antes do fix de 11/05, o bug U_PRENF afetava **614 documentos DEST** já em status `GRAVADO_PRENOTA_FALHOU` (XML salvo, pré-nota pendente — fiscal precisa concluir manualmente no Protheus).

Após o fix de U_AMARRCTE, o U_PRENF passa a afetar também:

- **154 documentos TOMA filial 01** que estavam bloqueados em `FALHA_TECNICA` / `PROTHEUS_DESISTIU` (139 DESISTIU + 15 FALHA_TECNICA na contagem original, hoje 51 FALHA_TECNICA + os DESISTIU que viraram retentativa). Esses agora migram para `GRAVADO_PRENOTA_FALHOU` ao serem regravados.
- **1.635 documentos TOMA** ainda não tentados (status_protheus NULL).

Total estimado de pré-notas pendentes pós-regravação: **~2.400 docs**.

### Pedido formal à equipe Protheus

1. **Promover o fix U_AMARRCTE para PROD** (apiportal.capul.com.br). Hoje endpoint segue apontando para PROD, sem o fix — qualquer disparo automatic em PROD vai continuar falhando.
2. **Investigar / corrigir U_PRENF / U_NFeSaida** — root cause da falha na criação de pré-nota a partir do XML em XMLCAB/XMLIT. Esse é hoje o **único bloqueador remanescente** do fluxo CT-e/NF-e na CAPUL após o fix de U_AMARRCTE.

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

### 3.9. ⚠ Comportamento atual sobrescreve sem checar duplicata (descoberto 07/05/2026)

**Teste empírico — confirmação:** Em ambiente PROD, fizemos 2 chamadas idênticas de `POST /grvXML` para a mesma chave de CT-e:

```
1ª chamada → status=GRAVADO (SZR010 + SZQ010)
2ª chamada → status=GRAVADO (SZR010 + SZQ010)   ← deveria ser JA_EXISTIA
```

**Conclusão:** o `grvXML` atual **sobrescreve silenciosamente** quando a chave já existe em SZR010 — não retorna `JA_EXISTIA` conforme contrato esperado em §3.8.

**Impacto operacional na CAPUL:**

Setor fiscal grava manualmente em SZR010 com `USRREC=fulano` (rotina diária). Quando nosso sistema baixa o mesmo CT-e via SEFAZ (CTeDistribuicaoDFe) e chama `grvXML`, **sobrescreve com `USRREC=sistema:cte-enriquecimento`**, perdendo a auditoria de quem importou primeiro.

Validação real (07/05/2026): teste com 74 CT-es já gravados manualmente — todos seriam sobrescritos sem aviso.

**🛡️ Defesa implementada do nosso lado (Pedido B — pré-check via xmlNfe):**

Antes de chamar `grvXML`, fazemos um GET `xmlNfe` pela chave:
- Se `found=true && origem=SZR010` → marcamos `JA_EXISTIA` e **NÃO chamamos grvXML** (preserva gravação manual)
- Se `found=true && origem=SPED156` → seguimos grvXML normalmente (precisa popular SZR)
- Se `found=false` (404) → seguimos grvXML normalmente
- Erros de rede no pré-check → seguimos grvXML padrão (sem regressão)

Custo: 1 GET extra por chave antes de cada gravação. Aceitável diante da segurança operacional.

**📨 Pedido A à equipe Protheus:**

Padronizar `POST /grvXML` para:

1. **Antes de inserir**, checar se a chave já existe em SZR010
2. Se existir, **NÃO sobrescrever** — retornar:
   ```json
   {
     "chave": "...",
     "status": "JA_EXISTIA",
     "resultado": "JA_EXISTIA"
   }
   ```
3. Se não existir, INSERT normal e retornar:
   ```json
   {
     "chave": "...",
     "status": "GRAVADO",
     "resultado": "INSERIDO",
     "registrosCabecalho": 1,
     "registrosItens": N
   }
   ```

**Quando a equipe Protheus implementar isso**, nosso pré-check fica redundante — mas é seguro mantê-lo (não causa dano, custo de 1 GET extra é desprezível).

**Por que isso importa pra CAPUL:**

- Setor fiscal mantém rotina manual de importação enquanto CT-e Distribuição não está em produção massa
- Quando ativarmos em PROD, conviveremos com cenário "alguns gravados manualmente, outros pelo sistema"
- Sem proteção, perdemos auditoria — não saberemos quem gravou cada chave
- Com proteção (pré-check + Pedido A no Protheus), 0% de sobrescritas silenciosas

---

### 3.10. 🚨 Perda silenciosa em `grvXML` — ~15% das gravações somem (descoberto 07/05/2026)

**Mais grave que §3.9.** Detectado durante batch real de 693 CT-es:

**Cenário do teste (07/05/2026, tarde):**

1. CT-e Distribuição varreu SEFAZ-AN PROD da Capul (CNPJ matriz + filial 08)
2. Baixou 788 documentos (papel TOMA/DEST/REM detectado em todos)
3. Pré-check (Pedido B) identificou 95 já em SZR010 (importação manual prévia) → marca `JA_EXISTIA` sem chamar `grvXML`
4. Restantes 693 → chamou `POST /grvXML` no Protheus PROD
5. **Todas as 693 chamadas retornaram `200 OK` com `status=GRAVADO`**

**Validação cruzada com SZR010 (mesma data):**

```sql
-- Query do setor fiscal (07/05/2026, ZR_DTREC=20260507, modelo 57)
SELECT zr_chvnfe FROM szr010
WHERE zr_dtrec='20260507' AND zr_modelo='57' AND d_e_l_e_t_=' ';
```

Resultado:

| Categoria | Esperado | Encontrado | Diferença |
|---|---|---|---|
| Nosso DB GRAVADO | 693 | — | — |
| SZR010 hoje (todas filiais) | 693 + manuais | **632** chaves únicas | — |
| **Confirmados em ambos** | 693 | **591** | — |
| **🔴 Nosso DB GRAVADO mas FALTA em SZR010** | 0 | **102** | **15% perda** |

**Análise dos 102 desaparecidos — sem padrão:**

- Distribuídos uniformemente no tempo (1-8 por minuto, das 17:51 às 19:35)
- Distribuídos proporcionalmente por papel (DEST 559, TOMA 91, REM 19 — segue distribuição global)
- Distribuídos por filial enviada no body (101 com `FILIAL=01`, 1 com `FILIAL=08`)
- Verificadas com query direta: `SELECT * FROM szr010 WHERE zr_chvnfe IN (3 chaves problematicas)` retornou **VAZIO** — registros realmente não existem

**Conclusão:** `grvXML` retorna `200 OK status=GRAVADO` mas **não persiste o registro em SZR010** em ~15% dos casos, sem aviso, sem padrão evidente. Aparenta ser bug intermitente do Protheus (timeout interno? rollback silencioso? race condition?).

**Impacto operacional severo:**

Setor fiscal vê "GRAVADO" em 100% dos modais, mas SZR010 só tem 85%. Sistema fica inconfiável — nem o nosso lado nem o Protheus reportam erro. Perda invisível.

**🛡️ Defesa implementada (Pedido D — pós-validação `xmlNfe`):**

Após cada `grvXML` retornar `GRAVADO`, o sistema espera 500ms e faz 1 GET `xmlNfe` pra confirmar persistência:

- `found=true && origem=SZR010` → confirmou, retorna GRAVADO de fato
- `!found` ou `origem!=SZR010` → grvXML mentiu, retorna FALHA_TECNICA pra retry da camada superior (até 5 tentativas)
- Erro técnico no GET → loga warn, assume GRAVADO (degradação graciosa)

Custo: +1 GET xmlNfe por GRAVADO (JA_EXISTIA continua sem custo extra). Aceitável diante da confiabilidade ganha (15% → 0% perda silenciosa).

**📨 Pedido C à equipe Protheus:**

Investigar a causa-raiz da perda silenciosa em `POST /grvXML`. Possibilidades a checar:

1. **Timeout de transação** — DB demora >Xs e Protheus dá rollback mas API já respondeu OK
2. **Race condition** — múltiplas conexões competem pelo lock de SZR010 e algumas perdem
3. **Lock de tabela** — quando Protheus está em outro processo (importação manual concorrente, batch JOB), grvXML "passa" mas não persiste
4. **Buffer não-flushed** — commit não completa antes do response ser enviado
5. **Trigger SQL** que rejeita silenciosamente em alguns cenários

**Solicitação:**

1. Garantir que `200 OK status=GRAVADO` seja sempre acompanhado de **commit confirmado** em SZR010
2. Se ocorrer falha de persistência após chamada aceita, retornar erro `5XX` com código específico (`GRAVACAO_NAO_PERSISTIU` ou similar) — pra que defesas client-side façam retry sem precisar de pós-verificação custosa
3. Se possível, log Protheus interno dos casos de "aceitou mas não persistiu" pra investigação

**Como reproduzir do lado Protheus:**

- Disparar 100+ `grvXML` em sequência rápida (1-3 req/s) e comparar contagem antes/depois em SZR010
- Verificar logs `system.log` do RPO no momento das chamadas — provavelmente há erros silenciosos que não chegam ao response

**Status temporário:** Capul mantém pós-validação `xmlNfe` ativa até equipe Protheus identificar e resolver. Após fix, pós-validação fica como **defesa em profundidade** (não causa dano, custo 1 GET extra por gravação).

**🎯 ATUALIZAÇÃO 07/05/2026 noite — Causa-raiz identificada:**

Investigação dos 102 perdidos revelou **padrão único**: **100% têm `CODFOR=""` (vazio)** no body grvXML.

| Análise | Resultado |
|---|---|
| 89 dos 102 | CNPJ emitente `00033613000125` (Santa Izabel Transportes) — não cadastrado em SA2 |
| 13 outros | 12 transportadoras distintas — também não cadastradas em SA2 |
| **Padrão comum** | **CODFOR vazio em 102/102 (100%)** |

Quando Protheus recebe `grvXML` com `CODFOR=""`:
1. Aceita request (response 200 OK status=GRAVADO)
2. Internamente rejeita por validação SA2 (cadastro não existe)
3. **Não persiste em SZR010, não retorna erro** — bug do contrato

**Solução em duas frentes:**

**(a) Operacional Capul** — cadastrar 13 transportadoras em SA2 do Protheus PROD:
   - Santa Izabel Transportes (00033613000125) — 89 CT-es
   - Patrus Transportes (17463456001081) — 2
   - BRASPRESS (3 lojas: 48740351000831, 48740351002109, 48740351007178) — 3
   - Mais 9 transportadoras com 1 CT-e cada

**(b) Pedido C reforçado pra equipe Protheus**:

Quando `grvXML` recebe `CODFOR=""` (ou inválido — não bate com SA2), retornar:

```json
// 400 Bad Request
{
  "code": 400,
  "errorCode": "CODFOR_INVALIDO",
  "message": "CODFOR vazio ou não cadastrado em SA2",
  "chave": "..."
}
```

Não silenciar a falha — sem isso, qualquer integração externa ao Protheus tem o mesmo problema.

Quando esses 2 forem resolvidos:
- Pré-check (Pedido B) protege auditoria de SZR010 manual
- Pós-validação (Pedido D) garante persistência confirmada
- 13 transportadoras cadastradas eliminam o caso CODFOR vazio
- Cobertura: 100% dos cenários conhecidos

---

### 3.11. 🚨 grvXML insere REGISTRO DUPLICADO em SZR010 (~5% — descoberto 07/05/2026)

**3º bug do `grvXML` descoberto na mesma sessão.** Comparação SZR010 (filial 01, ZR_DTREC=20260507) revelou **34 chaves duplicadas em SZR010** com mesma `HRREC` (mesmo segundo).

**Análise empírica:**

| Métrica | Resultado |
|---|---|
| Chaves duplicadas em SZR010 hoje | 34 |
| Status no nosso DB | Todas `GRAVADO`, todas `protheus_tentativas=1` |
| Origem | Nosso sistema enviou `grvXML` **1 única vez** |
| Resultado | Protheus persistiu **2 INSERTs idênticos** com mesmo HRREC |

Não é retry do nosso lado (ainda mais reforçado pelo `tentativas=1`). Não é race condition (timestamps idênticos no segundo). É **comportamento interno do Protheus duplicando** linhas em SZR010 em ~5% dos INSERTs.

**Como reproduzir lado Protheus:**

Disparar batch de 100+ `grvXML` em sequência rápida (1-3 req/s) com chaves novas (sem pré-existência em SZR010). Comparar:
- Total de requests enviados (= N)
- Total de linhas em SZR010 com `ZR_DTREC=hoje`

Em ~5% dos casos: 1 request → 2 linhas em SZR010.

**Hipóteses de causa-raiz:**

1. **INSERT em duas etapas** (cabeçalho + itens) com transação não-atômica — re-tenta cabeçalho mas não verifica antes
2. **Trigger duplicado** acionando 2 vezes pra mesma chamada
3. **Pool de conexões** retransmitindo packet TCP que chegou parcial
4. **Race entre INSERT e validação** — INSERT entra antes da validação completar, e re-INSERT acontece

**🛡️ Defesa Capul ainda não implementada:**

Diferente de §3.9 e §3.10, este bug é mais difícil de defender client-side:
- Pre-check xmlNfe (Pedido B) só detecta presença, não duplicidade
- Pós-validação xmlNfe (Pedido D) também só verifica presença
- Detecção de duplicidade exigiria query especifica em SZR010 (`COUNT(*) WHERE ZR_CHVNFE=...`) — endpoint não existe hoje

**Possível defesa server-side a estudar:**

- **Endpoint Protheus** `GET /xmlNfe/duplicatas?CHVNFE=...` que retorne contagem em SZR010 (>1 = duplicata)
- Ou: `GET /xmlNfe?CHVNFE=...` retornar campo `qtdRegistros` no response

**📨 Pedido E à equipe Protheus:**

Investigar e corrigir duplicação interna em `grvXML`:

1. Reproduzir bug com batch de 100+ chaves novas em sequência rápida
2. Identificar trigger/transação responsável pela duplicação
3. Garantir **idempotência** — 1 request `grvXML` = no máximo 1 linha em SZR010 (mesmo em caso de retry interno do Protheus)
4. Se duplicidade pré-existente em SZR010 (criada por bug anterior), oferecer endpoint de limpeza (DELETE de duplicatas mantendo a mais recente)

**Impacto operacional Capul:**

- Setor fiscal vê 2 entradas pra mesma NF/CT-e na visão SZR010 — pode confundir
- Relatórios fiscais podem contar 2x — comprometimento de auditoria
- 4.9% de duplicação em batch normal = volume não desprezível

**Status:**

Pedido E somado aos pedidos A, C — **3 bugs combinados em `grvXML` afetam confiabilidade da integração**. Sem fix completo, Capul opera com defesas client-side parciais (B e D cobrem A e C). Pedido E ainda sem defesa client-side viável.

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
