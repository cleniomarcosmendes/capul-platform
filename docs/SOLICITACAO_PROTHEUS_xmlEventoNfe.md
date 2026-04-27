# CAPUL — Plataforma Capul / Módulo Fiscal
## Solicitação de novo endpoint Protheus: `GET /xmlEventoNfe`

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 27/04/2026
- **Tipo:** Solicitação de novo endpoint, simétrico ao `/xmlNfe` já entregue em 20/04/2026
- **Prioridade:** Alta — bloqueia paridade visual com portal SEFAZ no detalhe de eventos

---

## 1. Contexto

Em 20/04/2026, a equipe Protheus entregou o endpoint `GET /xmlNfe?CHAVENFEE=...` que retorna o XML completo da NF-e a partir das tabelas internas (SZR010 ou SPED156.DOCXMLRET). Esse endpoint é a base do fluxo de consulta NF-e da Plataforma — quando o operador busca uma chave, o sistema chama `/xmlNfe`, parseia o XML e mostra todas as abas (Emitente, Destinatário, Produtos, Totais, Cobrança, etc.).

Em 27/04/2026, vocês adicionaram ao `GET /eventosNfe` os campos `id_evento` e `protocolo` por evento — ótimo trabalho, fechou 2 dos 5 campos pendentes da pendência 3 (sessão 24/04/2026). A Plataforma já consome e exibe.

**Problema remanescente:** ao abrir o detalhe de um evento (Confirmação da Operação, Cancelamento, CC-e, Operação Não Realizada, etc.), o portal SEFAZ exibe campos que dependem do **XML completo do `procEventoNFe`**:

| Campo (portal SEFAZ) | Origem no XML procEventoNFe | Hoje na Plataforma |
|----------------------|------------------------------|----------------------|
| Justificativa | `<infEvento><detEvento><xJust>` | ❌ não chega |
| Sequencial do Evento | `<infEvento><nSeqEvento>` | ⚠️ aproximado (=1 para manifestações) |
| Data/Hora Autorização | `<retEvento><infEvento><dhRegEvento>` | ⚠️ aproximado (= `dhEvento` do `/eventosNfe`) |
| Versão Evento | `<infEvento versao="...">` | ⚠️ hardcoded "1.00" |
| Mensagem completa de Autorização (xMotivo expandido) | `<retEvento><infEvento><xMotivo>` | ⚠️ parcial |

Esses campos são especialmente importantes em **Operação Não Realizada (210240)** e **Cancelamento (110111)**, onde a `xJust` justifica a ação e é exigida em auditorias fiscais e disputas comerciais.

**Caminhos descartados:**
- Acesso direto da Plataforma ao portal SEFAZ → exigiria certificado A1 instalado em cada máquina de operador (objetivo do módulo é justamente centralizar o A1 no servidor).
- Consulta SEFAZ via `NFeDistribuicaoDFe / consChNFe` → não retorna `procEventoNFe` para chaves cujos eventos AN já foram consumidos pelo Monitor NFe (comportamento observado em 27/04 com a chave `43260488379771004170550050008121081812108505`: SEFAZ devolveu apenas `procNFe_v4.00.xsd`, sem eventos).
- Implementar `consNSU` próprio na Plataforma → conflitaria com o consumo NSU já feito pelo Protheus, gerando buracos na fila e duplicação de estado.

A única fonte confiável e centralizada do `procEventoNFe` é o **próprio Protheus**, especificamente em `SPED156.ZIPPROC` (mesma origem do `/xmlNfe`).

---

## 2. Spec do endpoint solicitado

### Padrão simétrico ao `/xmlNfe`

**Rota:**
```
GET /rest/api/INFOCLIENTES/FISCAL/xmlEventoNfe?ID_EVENTO=<id-evento-54-chars>
```

**Parâmetros (query string):**

| Parâmetro | Obrigatório | Formato | Descrição |
|-----------|-------------|---------|-----------|
| `ID_EVENTO` | sim | 54 chars exatos: `ID` + tpEvento(6) + chNFe(44) + nSeqEvento(2) | Identificador único do evento, mesmo valor já devolvido em `/eventosNfe.id_evento` |

**Resposta de sucesso (HTTP 200):**

```json
{
  "id_evento": "ID2102404326048837977100417055005000812108181210850501",
  "origem": "SPED156",
  "xmlBase64": "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4..."
}
```

- `xmlBase64`: o **`<procEventoNFe>` completo** (com `<evento>`, `<infEvento>`, `<detEvento>`, `<retEvento>`, `<Signature>`), codificado em base64. Mesmo padrão do `/xmlNfe`.
- `origem`: indica de onde o XML veio. Esperamos sempre `SPED156` (já que SPED156.ZIPPROC armazena o XML do procEventoNFe), mas se houver outra fonte (ex.: cache local), reportar.

**Respostas de erro:**

| HTTP | Quando | Body |
|------|--------|------|
| 400 | `ID_EVENTO` ausente, vazio, ou formato inválido (≠ 54 chars, não bate regex `^ID\d{52}$`) | `{ "code": 400, "message": "<motivo>" }` |
| 404 | XML não localizado (id_evento não existe no SPED156, ou foi expurgado) | `{ "code": 404, "message": "XML do evento não localizado em SPED156." }` |
| 500 | Erro interno (ex.: falha de descompressão ZIPPROC) | `{ "code": 500, "message": "<motivo>" }` |

---

## 3. Mapeamento da fonte de dados

A fonte é **a mesma** do `/xmlNfe` e do `/eventosNfe`: o conteúdo está em `SPED156.ZIPPROC` (BLOB compactado em GZIP).

**Lógica esperada (pseudocódigo Protheus):**

```
function xmlEventoNfe(idEvento)
  // 1) Validar formato
  if not idEvento.matches("^ID\d{52}$") then
    return 400, "ID_EVENTO inválido."

  // 2) Localizar registro em SPED156 pelo id_evento
  // (mesmo critério que vocês já usam para popular o `id_evento`
  // no JSON de /eventosNfe — basta filtrar por essa coluna)
  registro = SELECT TOP 1 ZIPPROC FROM SPED156
             WHERE ID_EVENTO = :idEvento
               AND D_E_L_E_T_ <> '*'

  if registro is null then
    return 404, "XML do evento não localizado em SPED156."

  // 3) Descomprimir GZIP → string XML UTF-8
  xmlString = gunzip(registro.ZIPPROC)

  // 4) Codificar base64 e retornar
  return 200, {
    id_evento: idEvento,
    origem: "SPED156",
    xmlBase64: base64(xmlString)
  }
```

**Observação sobre o XML retornado:**

O `procEventoNFe` armazenado em SPED156.ZIPPROC já é o documento autorizado completo, exatamente como o SEFAZ devolve via `NFeDistribuicaoDFe`. Estrutura mínima esperada:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<procEventoNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <evento versao="1.00">
    <infEvento Id="ID2102404326048837977100417055005000812108181210850501">
      <cOrgao>91</cOrgao>
      <tpAmb>1</tpAmb>
      <CNPJ>25834847000100</CNPJ>
      <chNFe>43260488379771004170550050008121081812108505</chNFe>
      <dhEvento>2026-04-24T11:35:02-03:00</dhEvento>
      <tpEvento>210240</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Operacao nao Realizada</descEvento>
        <xJust>NOTA FISCAL EM DESCACORDO COM O PEDIDO</xJust>
      </detEvento>
    </infEvento>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">...</Signature>
  </evento>
  <retEvento versao="1.00">
    <infEvento>
      <tpAmb>1</tpAmb>
      <verAplic>...</verAplic>
      <cOrgao>91</cOrgao>
      <cStat>135</cStat>
      <xMotivo>Evento registrado e vinculado a NF-e</xMotivo>
      <chNFe>...</chNFe>
      <tpEvento>210240</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <dhRegEvento>2026-04-24T11:35:09-03:00</dhRegEvento>
      <nProt>891265869991478</nProt>
    </infEvento>
  </retEvento>
</procEventoNFe>
```

A Plataforma já tem parser pronto (`fiscal/backend/src/nfe/parsers/nfe-parser.service.ts:parseEventoXml`) — basta receber o XML e o detalhe sintético é substituído pelo detalhe real, idêntico ao portal SEFAZ.

---

## 4. Casos de uso afetados

A nova rota destrava os seguintes cenários hoje incompletos na Plataforma:

| Tipo de evento (tpEvento) | Descrição | xJust relevante? |
|----------------------------|-----------|-------------------|
| 110110 | Carta de Correção (CC-e) | ✅ obrigatório |
| 110111 | Cancelamento | ✅ obrigatório |
| 110140 | EPEC | ⚠️ contextual |
| 210200 | Confirmação da Operação | ⚠️ raro |
| 210210 | Ciência da Operação | ⚠️ raro |
| 210220 | Desconhecimento da Operação | ✅ recomendado |
| 210240 | Operação Não Realizada | ✅ obrigatório |

Para CC-e e Cancelamento, a `xJust` é **legalmente exigida** e auditada pela Receita. Para Operação Não Realizada e Desconhecimento, é prática operacional importante (justifica a ação para fornecedores e auditoria interna).

---

## 5. Caso de teste sugerido

Chave/evento real disponível para validação:

- **Chave NF-e:** `43260488379771004170550050008121081812108505`
- **Emitente:** Calçados Beira Rio S/A (88379771000417)
- **Destinatário:** Cooperativa Agropecuária Unaí Ltda (25834847000100)
- **id_evento alvo:** `ID2102404326048837977100417055005000812108181210850501`
- **Tipo:** 210240 — Operação Não Realizada
- **xJust esperada:** "NOTA FISCAL EM DESCACORDO COM O PEDIDO." (validada manualmente no portal SEFAZ em 27/04/2026)
- **Protocolo SEFAZ:** 891265869991478

**Critério de aceite:**

1. `GET /xmlEventoNfe?ID_EVENTO=ID2102404326048837977100417055005000812108181210850501` → HTTP 200
2. Após `Buffer.from(xmlBase64, 'base64').toString('utf-8')`, o XML resultante deve conter literalmente `<xJust>NOTA FISCAL EM DESCACORDO COM O PEDIDO`.
3. `GET /xmlEventoNfe?ID_EVENTO=ID0000000000000000000000000000000000000000000000000001` → HTTP 404 com mensagem clara.
4. `GET /xmlEventoNfe?ID_EVENTO=invalido` → HTTP 400 com mensagem clara.

---

## 6. Integração no lado da Plataforma (informativo)

Quando o endpoint estiver disponível em HOM, o trabalho na Plataforma é mecânico (estimativa: 1-2h):

1. Adicionar `ProtheusXmlEventoService.buscarXmlEvento(idEvento)` simétrico ao `ProtheusXmlService.buscarXml(chave)`.
2. No fluxo `atualizarStatus` em `nfe.service.ts`, depois de persistir os eventos via `/eventosNfe`, iterar os que vieram com `id_evento` mas sem XML local e popular via `/xmlEventoNfe`.
3. Persistir o XML em `documento_evento.xmlEvento` (coluna já existe) — o detalhe sintético é automaticamente substituído pelo `parseEventoXml(xmlEvento)`.
4. Cadastrar a operação `xmlEventoNfe` no Configurador (`core.integracoes_api_endpoints`) seguindo o padrão dos demais endpoints.

Nenhuma migration nova é necessária — a coluna `documento_evento.xmlEvento` já existe e é usada para CC-e/Cancelamento que vêm via SEFAZ.

---

## 7. Cronograma sugerido

| Etapa | Responsável | Estimativa |
|-------|-------------|------------|
| Implementação no Protheus (HOM) | Equipe Protheus | 1-2 dias |
| Validação contra caso de teste acima | Equipe Protheus + CAPUL | 1 hora |
| Cadastro do endpoint no Configurador CAPUL | CAPUL | 15 min |
| Integração no `atualizarStatus` da Plataforma | CAPUL | 1-2 horas |
| Validação ponta-a-ponta em HOM | CAPUL | 1 hora |
| Promoção para produção | CAPUL (após luz verde da equipe Protheus) | 30 min |

**Total estimado: 2-3 dias** (incluindo idas e vindas).

---

## 8. Referências

- Contrato `/xmlNfe` (entregue 20/04/2026) — endpoint simétrico, mesma fonte SPED156
- Contrato `/eventosNfe` (atualizado 27/04/2026) — já expõe `id_evento` que é o input deste novo endpoint
- `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` — pendências consolidadas anteriores (este pedido fecha a pendência 3)
- Memory `project_protheus_eventos_27abr.md` — contexto interno CAPUL sobre os 5 campos do detalhe sintético
- Schema oficial SEFAZ: `procEventoNFe_v1.00.xsd` (Portal Nacional NF-e)

---

*Quando puderem confirmar o aceite e prazo estimado, abrimos o card de implementação no nosso lado.*
