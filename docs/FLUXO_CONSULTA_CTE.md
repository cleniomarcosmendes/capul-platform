# Módulo Fiscal — Fluxo de Consulta CT-e

**Versão:** 1.0
**Data:** 13/04/2026
**Status:** Produção (com Protheus em modo mock até cutover)

---

## 1. Resumo executivo

A consulta de CT-e por chave na plataforma Capul segue um fluxo **cache-first no Protheus** (mesma estratégia do NF-e) + **enriquecimento de timeline via `CteConsultaProtocolo` per-UF**. Quando o Protheus tem o XML, a tela exibe dados completos (Gerais, Participantes, Valores) + timeline cronológica de eventos; quando não tem, exibe apenas a timeline (status + eventos) com banner explicativo.

O fluxo tem **uma limitação estrutural importante**: diferente do NF-e, o serviço nacional `CTeDistribuicaoDFe` da SEFAZ **não suporta consulta por chave** — só `distNSU`/`consNSU`. Isso força um design diferente do NF-e para CT-es de entrada que ainda não estão no Protheus.

---

## 2. Fluxo técnico

```
Usuário informa chave CT-e (44 dígitos, modelo 57 ou 67)
         │
         ▼
┌─────────────────────────────────┐
│ CteController.consultar()       │
│ - Valida chave + modelo (57/67) │
│ - Valida filial                 │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ ProtheusXmlService.exists()     │  ← 1. Cache check Protheus
└─────────────────────────────────┘
         │
    existe?
      / \
    SIM  NÃO
     │    │
     ▼    ▼
  ┌──────────┐  ┌──────────────────────────────────┐
  │ protheus │  │ xmlString = null                 │
  │ .get()   │  │ parsed    = null                 │
  │ parser   │  │ origem    = SEFAZ_STATUS_ONLY    │
  │ .parse() │  └──────────────────────────────────┘
  └──────────┘         │
     │                 │
     └────┬────────────┘
          ▼
┌─────────────────────────────────────┐
│ documentoConsulta.registrar(...)    │  ← 2. Upsert em fiscal.documento_consulta
│ (parsed pode ser null — metadata   │     (mesmo sem XML cria stub)
│  parcial)                           │
└─────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ CteService.construirTimeline()      │  ← 3. Enriquecimento de eventos
│                                     │
│ a) Autoriza (se tem XML):           │
│    evento AUTORIZACAO ← protCTe     │
│                                     │
│ b) CteConsultaProtocolo per-UF:     │
│    CTeConsultaV4 (1 chamada SOAP)  │
│    → status + eventos procEventoCTe│
│    (tolerante a falha)              │
│                                     │
│ c) documentoEvento.upsertMany()     │  ← persiste com dedup via unique
└─────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ Frontend CteConsultaPage        │  ← 4. Renderização condicional
│                                 │
│ SE xmlDisponivel:               │
│   [Gerais] [Participantes]      │
│   [Valores] [Histórico (N)]     │
│                                 │
│ SE !xmlDisponivel:              │
│   banner "XML não disponível"   │
│   [Histórico (N)] somente       │
└─────────────────────────────────┘
```

---

## 3. Web services SEFAZ usados

### 3.1. CTeConsultaProtocolo V4 (per-UF) — ÚNICO serviço de consulta por chave

- **Endpoint:** varia por UF. MG: `https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4`
- **SOAPAction:** `http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4/cteConsultaCT`
- **Versão:** 4.00
- **Request body:**
  ```xml
  <consSitCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
    <tpAmb>1</tpAmb>
    <xServ>CONSULTAR</xServ>
    <chCTe>{chave44}</chCTe>
  </consSitCTe>
  ```
- **Envelope:** `<cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4">` direto no Body (sem wrapper — operação despachada pelo SOAPAction)
- **Autenticação:** mTLS via certificado A1 ICP-Brasil
- **Retorno:**
  - `cStat=100` + `xMotivo=Autorizado o uso do CT-e` → sucesso
  - `protCTe/infProt` — protocolo de autorização
  - `procEventoCTe[]` — lista de eventos (cancelamento, registro multimodal, comprovante de entrega, MDF-e vinculado, prestação em desacordo, etc.)
- **Importante:** retorna status + protocolo + eventos. **NUNCA retorna o XML autorizado completo.**

Mapa completo em `fiscal/backend/src/sefaz/sefaz-endpoints.map.ts` — todas as UFs mapeadas com fallback SVRS e SVSP.

### 3.2. CTeDistribuicaoDFe (nacional) — NÃO usado no fluxo interativo

Existe no código (`fiscal/backend/src/sefaz/cte-distribuicao.client.ts`) mas **não é chamado pelo `CteService`**. Fica disponível caso a Plataforma precise no futuro de sync massivo — que hoje é responsabilidade do Monitor DFe do Protheus.

- **Endpoint:** `https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx`
- **Modos suportados:** `distNSU`, `consNSU`
- **Modo NÃO suportado:** `consChCTe` (por chave) — **não existe no schema oficial**

Confirmado via `sped-cte` (referência PHP de mercado):
- XSD: `https://github.com/nfephp-org/sped-cte/tree/master/schemes/PL_CTe_400`
- Tools.php: `sefazDistDFe($ultNSU, $numNSU)` — não aceita parâmetro chave

---

## 4. Tabelas Protheus envolvidas

Mesmas do NF-e — **SZR010** (cabeçalho) + **SZQ010** (itens). O campo `tipoDocumento` do endpoint `POST /xmlFiscal` aceita `"CTE"`.

**Como SZR010 é alimentada para CT-e:**
- **Saída:** CAPUL não emite CT-e (não é transportadora) — N/A
- **Entrada:** Monitor DFe do Protheus **precisa estar configurado para baixar também modelo 57** (muitas implementações default só baixam NF-e modelo 55)
- **Manual:** não usado

### Pergunta em aberto (para reunião Protheus 14/04/2026)

O Monitor DFe do Protheus da CAPUL está ativo para CT-e modelo 57? Se não estiver, os CT-es recebidos **não chegam ao SZR010**, e o fluxo da Plataforma sempre cai no caminho "XML não disponível". Solução: pedir ao time Protheus para ativar no SIGACFG.

---

## 5. Frontend

**Página:** `/fiscal/cte` — `fiscal/frontend/src/pages/CteConsultaPage.tsx`

**Renderização condicional baseada em `result.xmlDisponivel`:**

### Cenário A — XML disponível (Protheus tem)

```
[Dados gerais] [Participantes] [Valores] [Histórico (N)]
```

Abas exibidas:
1. **Dados gerais** — número, série, data, natureza, tipo, serviço, modalidade, origem/destino, CFOP
2. **Participantes** — emitente (transportador), remetente, destinatário, tomador
3. **Valores** — produto predominante, valor da carga, valor total da prestação, valor a receber
4. **Histórico** — timeline cronológica de eventos (autorização + eventos subsequentes)

Ações: download XML, download DACTE (pdfkit local)

### Cenário B — XML não disponível (Protheus não tem)

```
┌────────────────────────────────────────────────────┐
│ ⚠ XML completo não disponível                      │
│                                                    │
│ O XML completo deste CT-e não está no Protheus    │
│ (SZR010). O serviço nacional CTeDistribuicaoDFe   │
│ só permite download por NSU — não por chave.      │
│ Mostrando apenas status e eventos retornados pelo │
│ CteConsultaProtocolo da SEFAZ.                    │
└────────────────────────────────────────────────────┘

[Histórico (N)]    ← única aba disponível
```

### Componente compartilhado — EventosTimeline

`fiscal/frontend/src/components/EventosTimeline.tsx` — timeline cronológica com ícones e cores por tipo de evento:

| Tipo | Ícone | Cor |
|---|---|---|
| `AUTORIZACAO` | ShieldCheck | Verde |
| `110110` Carta de Correção | FileEdit | Azul |
| `110111` / `110112` Cancelamento | XCircle | Vermelho |
| `110180` / `110190` Comprovante de Entrega | PackageCheck | Azul |
| `210200` Confirmação da Operação | CheckCircle2 | Roxo |
| `210220` Desconhecimento | XCircle | Roxo |
| `310610` MDF-e vinculado | Truck | Âmbar |
| `510630` Registro de Passagem | MapPin | Âmbar |
| `610110` Prestação em Desacordo | AlertTriangle | Laranja |

Reutilizado também pelo `NfeConsultaPage` caso no futuro queiramos exibir eventos de NF-e (hoje não é usado lá — ver seção 6).

---

## 6. Decisão crítica — CTe por chave NÃO baixa XML da SEFAZ

### Contexto

Depto fiscal reportou em 13/04/2026 duas situações:
1. "Consulta CT-e não retorna nada, segue chave `31260316505190000139570010013015461001507170`"
2. "Precisamos listar todos os movimentos (mudança de situação do protocolo), não só o último status"

### Investigação

O código anterior implementava `CteDistribuicaoClient.consultarPorChave()` chamando `CTeDistribuicaoDFe` com `<consChCTe><chCTe>...</chCTe></consChCTe>`. A SEFAZ rejeitava com:

```
cStat=215 — Rejeicao: Falha no esquema XML
```

Verificação do schema oficial via `sped-cte` (referência PHP de mercado) revelou que **o elemento `<consChCTe>` não existe no XSD `distDFeInt_v1.00.xsd` do CT-e**. Somente `<distNSU>` e `<consNSU>` são aceitos:

```xml
<!-- schemes/PL_CTe_400/retDistDFeInt_v1.00.xsd -->
<xs:choice>
  <xs:element name="distNSU" ...>
  <xs:element name="consNSU" ...>
  <!-- NÃO EXISTE consChCTe -->
</xs:choice>
```

### Decisão tomada

**Trocar a estratégia completamente:**

1. Remover o uso de `CteDistribuicaoClient.consultarPorChave` do fluxo principal
2. Implementar novo cliente `CteConsultaProtocoloClient` — serviço **per-UF** que aceita `<consSitCTe>` por chave
3. Este serviço retorna status + protocolo + eventos (`procEventoCTe[]`), mas **nunca o XML completo**
4. Quando o Protheus não tem o XML, exibir apenas a timeline + banner explicativo
5. Quando o Protheus tem, exibir dados completos + timeline (melhor dos dois mundos)

### Por que não usamos `distNSU` do CTeDistribuicaoDFe

Mesma razão do NF-e (ver `docs/FLUXO_CONSULTA_NFE.md` Seção 6):

- O cursor NSU da CAPUL é compartilhado entre o Protheus e qualquer outro consumidor
- O Monitor DFe do Protheus já é dono desse cursor (via `distNSU`)
- Se a Plataforma também chamar, há colisão: cStat=656 ou "buracos" nas tabelas SZR010/SZQ010
- O design correto é **Protheus = dono do cursor NSU**, **Plataforma = consome via API Protheus**

### Validação (13/04/2026)

Teste com a chave reportada `31260316505190000139570010013015461001507170` (CT-e MG):

```json
{
  "origem": "SEFAZ_STATUS_ONLY",
  "xmlDisponivel": false,
  "consultaProtocoloStatus": { "sucesso": true },
  "eventos": [
    { "dataEvento": "2026-03-19T23:29:12Z",
      "tipoEvento": "AUTORIZACAO",
      "tipoEventoLabel": "Autorização",
      "protocolo": "131264138066472" },
    { "dataEvento": "2026-03-19T23:42:23Z",
      "tipoEvento": "310610",
      "tipoEventoLabel": "MDF-e Autorizado vinculado ao CT-e",
      "protocolo": "731260099006169" },
    { "dataEvento": "2026-03-20T01:31:07Z",
      "tipoEvento": "510630",
      "tipoEventoLabel": "Registro de Passagem (MDFe)",
      "protocolo": "731260099122052" },
    { "dataEvento": "2026-03-23T16:07:51Z",
      "tipoEvento": "110180",
      "tipoEventoLabel": "Comprovante de Entrega do CT-e",
      "protocolo": "131264150169580" }
  ]
}
```

4 eventos retornados do `CteConsultaProtocolo` MG em 1 chamada SOAP, parseados e persistidos em `fiscal.documento_evento`.

---

## 7. Schema de banco — documento_evento

Tabela `fiscal.documento_evento` armazena a timeline completa:

```sql
CREATE TABLE fiscal.documento_evento (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  documento_id      uuid NOT NULL REFERENCES fiscal.documento_consulta(id),
  tipo_evento       varchar(20) NOT NULL,  -- AUTORIZACAO, 110110, 110180, 310610...
  descricao         text NOT NULL,
  data_evento       timestamp(3) NOT NULL,
  protocolo_evento  text,
  c_stat            varchar(4),
  x_motivo          text,
  xml_evento        text,
  created_at        timestamp(3) NOT NULL DEFAULT now(),

  CONSTRAINT documento_evento_unique
    UNIQUE (documento_id, tipo_evento, data_evento)
);
```

**Dedup via unique constraint:** o mesmo evento não é persistido duas vezes quando o usuário re-consulta a chave.

---

## 8. Código-fonte

### Backend

- `fiscal/backend/src/cte/cte.controller.ts` — rotas REST
- `fiscal/backend/src/cte/cte.service.ts` — fluxo de consulta + construirTimeline
- `fiscal/backend/src/cte/parsers/cte-parser.service.ts` — parser CT-e 4.00
- `fiscal/backend/src/cte/parsers/cte-parsed.interface.ts` — tipos
- `fiscal/backend/src/cte/pdf/dacte-generator.service.ts` — gera DACTE via pdfkit
- `fiscal/backend/src/sefaz/cte-consulta-protocolo.client.ts` — cliente CTeConsultaV4 per-UF ⭐ (novo 13/04)
- `fiscal/backend/src/sefaz/cte-distribuicao.client.ts` — cliente CTeDistribuicaoDFe (não usado no fluxo)
- `fiscal/backend/src/sefaz/sefaz-endpoints.map.ts` — mapa CTE_CONSULTA_PROTOCOLO per-UF ⭐
- `fiscal/backend/src/nfe/documento-evento.service.ts` — upsert em fiscal.documento_evento ⭐
- `fiscal/backend/src/nfe/documento-consulta.service.ts` — upsert em fiscal.documento_consulta (compartilhado com NF-e)

### Frontend

- `fiscal/frontend/src/pages/CteConsultaPage.tsx` — tela de consulta (renderização condicional)
- `fiscal/frontend/src/components/EventosTimeline.tsx` — timeline reutilizável ⭐
- `fiscal/frontend/src/types/index.ts` — tipos `TimelineEvento`, `ConsultaProtocoloStatus`

⭐ = arquivos criados ou refatorados na sessão de 13/04/2026

---

## 9. Limitações conhecidas

1. **Sem XML = sem aba Gerais/Participantes/Valores**. Só timeline. Solução correta é Protheus ter o CT-e em SZR010.
2. **Timeline pode estar incompleta se `CteConsultaProtocolo` falhar**. O fluxo é tolerante: se o serviço estiver fora, exibe o que já estiver persistido no banco + banner âmbar de aviso.
3. **Descrições dos eventos às vezes vêm genéricas da SEFAZ**. O mapa `TIPO_EVENTO_LABEL` em `documento-evento.service.ts` traduz os códigos conhecidos para rótulos amigáveis.
4. **Protheus em modo mock** (até cutover pós-reunião 14/04). Enquanto estiver em mock, `xmlDisponivel` é sempre `false` para qualquer chave → o fluxo cai sempre na timeline.

---

## 10. Referências

- Portal CT-e — [https://www.cte.fazenda.gov.br/portal/webServices.aspx](https://www.cte.fazenda.gov.br/portal/webServices.aspx)
- sped-cte (referência PHP) — [https://github.com/nfephp-org/sped-cte](https://github.com/nfephp-org/sped-cte)
- XSD consSitCTe v4.00 — `schemes/PL_CTe_400/consSitCTe_v4.00.xsd`
- XSD distDFeInt — `schemes/PL_CTe_400/retDistDFeInt_v1.00.xsd`
- Nota Técnica 2015.002 — CTeDistribuicaoDFe
- Fluxo NF-e — `docs/FLUXO_CONSULTA_NFE.md` (mesma plataforma, serviço SEFAZ diferente)
- Reunião equipe Protheus — `docs/REUNIAO_PROTHEUS_14ABR2026.md`
- Memória de feedback — `memory/feedback_sefaz_nunca_em_loop.md`
