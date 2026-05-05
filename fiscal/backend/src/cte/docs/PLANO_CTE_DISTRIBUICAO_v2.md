# Plano Técnico — Módulo CT-e Distribuição (v2 — REVISADO)

**Plataforma Capul / Módulo `fiscal/cte`**
**Versão:** 2.0 — revisada em 04/05/2026 com base em análise da infraestrutura existente
**Versão anterior:** `PLANO_CTE_DISTRIBUICAO_1.md` (gerada 03/05/2026 pelo Claude Desktop, partiu do zero)

---

## ⚠️ Por que essa revisão

A v1 (Claude Desktop) é tecnicamente sólida, mas assume **greenfield**. Análise local em 04/05/2026 revelou que **~50% da infraestrutura já está implementada** no projeto, mudando significativamente a estimativa, o esforço e a estratégia de implementação.

Adicionalmente:

1. **Confirmado em 04/05/2026:** tentativa via TSS+appserver.ini (caminho oficial TOTVS) **NÃO funciona** — TSS não baixa CT-e mesmo configurado. Conclusão: desenvolver consumer próprio é **único caminho viável** sem contratar TOTVS Transmite.
2. **Correção:** o arquivo de configuração TSS é `appserver.ini`, não `tss.ini`. Mas isso é histórico — fica registrado para evitar confusão futura.

---

## 1. Diagnóstico atual (o que já existe)

### 1.1 Backend — `fiscal/backend/`

```
src/cte/
├── cte.controller.ts          ← Endpoints existentes
├── cte.service.ts             ← Lógica de consulta + integração Protheus
├── parsers/                   ← Parsers procCTe + procEventoCTe
└── pdf/                       ← Gerador DACTe (PDF)

src/sefaz/
├── cte-distribuicao.client.ts        ← Cliente SOAP CTeDistribuicaoDFe (modo consChCte)
├── cte-consulta-protocolo.client.ts  ← Consulta protocolo
├── sefaz-agent.service.ts            ← mTLS + carrega certificado A1
├── soap-envelope.helper.ts           ← Builder de envelope SOAP
└── sefaz-http.helper.ts              ← Helper HTTP+mTLS
```

**Endpoints HTTP atuais:**
- `POST /cte/consulta` — consulta CT-e por chave
- `POST /cte/{chave}/filial/{filial}/regravar-protheus` — força reescrita do XML no Protheus
- `GET /cte/{chave}/filial/{filial}/xml` — retorna XML armazenado
- `GET /cte/{chave}/filial/{filial}/dacte` — retorna PDF DACTe
- `GET /cte/health`

**Schema Prisma usado (compartilhado com NF-e):**
- `Certificado` — gestão certificado A1 multi-empresa
- `AmbienteConfig` — switch produção/homologação
- `LimiteDiario` — proteção rate limit (já protege NF-e)
- `UfCircuitState` — circuit breaker por UF
- `DocumentoConsulta` — armazena consultas (NF-e e potencialmente CT-e)
- `DocumentoEvento` — eventos vinculados
- `DocumentoXmlIndex` — índice de XMLs

### 1.2 Frontend — `fiscal/frontend/`

- `src/pages/CteConsultaPage.tsx` — página de consulta por chave (existe e funciona)

### 1.3 O que está **realmente faltando** (gap)

| Componente | Status | Esforço estimado |
|---|---|---|
| Modo `distNSU` no `CteDistribuicaoClient` | ❌ Falta (só tem `consChCte`) | 1-2d |
| Tabela `CteControleNsu` (NSU sequencial por CNPJ) | ❌ Falta | 0,5d |
| Persistência automatizada (CteDocumento ou estender DocumentoConsulta) | ❌ Falta | 1-1,5d |
| Scheduler (cron iterando filiais) | ❌ Falta | 1d |
| `PapelDetectorService` (identifica DEST/TOMA/REM/etc.) | ❌ Falta | 0,5d |
| Parser de resumos (`resCTe`, `resEventoCTe`) | ❌ Parcial (só completo) | 1d |
| Frontend listagem de CT-es recebidos | ❌ Falta | 1-2d |
| Integração Protheus (drop UNC) | ❌ Falta | 1-2d |

**Total: 8-12 dias úteis** (vs 23 do plano v1).

---

## 2. Endpoints SEFAZ (atualizado 04/05/2026)

### 2.1 Ambiente Nacional CT-e (AN-RFB)

URLs **já confirmadas e versionadas** no código em `fiscal/backend/src/sefaz/sefaz-endpoints.map.ts`:

| Ambiente | URL |
|---|---|
| Produção | `https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx` |
| Homologação | `https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx` |

Helper já implementado:
```typescript
import { getCteDistribuicaoUrl, type AmbienteSefazStr } from './sefaz-endpoints.map.js';

const url = getCteDistribuicaoUrl(ambiente); // 'PRODUCAO' | 'HOMOLOGACAO'
```

**Validação no Day 1 da Fase 1** (~5min): conferir vigência no portal oficial → https://www.cte.fazenda.gov.br/portal/webServices.aspx . SEFAZ raramente muda URLs, mas é boa prática verificar antes de cada nova NT.

### 2.2 Operação SOAP

- Método: `cteDistDFeInteresse`
- Protocolo: SOAP 1.2
- Autenticação: mTLS com A1 (CNPJ base — gestão pelo `Certificado` model existente)
- Processo: síncrono

### 2.3 Schema XSD

NT 2015.002 v1.05 (incluiu CT-e Simplificado em nov/2024)
Schemas necessários:
- `cteDistDFe_v1.00.xsd`
- `procCTe_v4.00.xsd` (já parsea no projeto)
- `procEventoCTe_v4.00.xsd` (já parsea no projeto)
- `resCTe_v4.00.xsd` (**NOVO** — falta no projeto)
- `resEventoCTe_v1.00.xsd` (**NOVO** — falta no projeto)

### 2.4 Identidade do consumidor

Empresa autenticada pelo **CNPJ base** do certificado A1. Pode consultar **qualquer filial** desde que o CNPJ base bata. Um único certificado da matriz cobre todas as filiais Capul.

### 2.5 ⚠️ Limitação importante — `consChCTe` NÃO é suportado pelo Nacional

**Descoberto na análise do código existente** (comentário no `cte-consulta-protocolo.client.ts`):

> "O CTeDistribuicaoDFe nacional só suporta `distNSU`/`consNSU` (sem `consChCTe`)."

**Implicações para o plano:**

- A **Fase 1** usa apenas `distNSU` (consulta sequencial por NSU) — funciona via Nacional sem problema.
- Para **consultar CT-e por chave específica** (caso de uso de "buscar um CT-e que sei a chave"), usar:
  - `CTeConsultaProtocolo` (per UF) — já mapeado em `sefaz-endpoints.map.ts`, retorna apenas protocolo (não XML completo)
  - `SVRS_CTE` — fallback via SEFAZ-RS, já mapeado
  - **Nota:** essas vias retornam protocolo/eventos, NÃO o XML completo do CT-e. Para XML completo via chave, depende do Protheus/SZR010 ou aguardar o NSU distribution capturar.

**Conclusão:** o fluxo principal do nosso consumer é exatamente `distNSU` — não temos esse problema. Documentado aqui para evitar confusão quando alguém implementar UI de "buscar CT-e por chave".

### 2.6 Endpoints já mapeados e funcionais no projeto

```typescript
// fiscal/backend/src/sefaz/sefaz-endpoints.map.ts — JÁ IMPLEMENTADO

CTE_DISTRIBUICAO_DFE      // Nacional, distNSU/consNSU (Fase 1 usa este)
CTE_CONSULTA_PROTOCOLO_*  // Por UF, consulta protocolo
SVRS_CTE                  // SEFAZ-RS, fallback
```

Helpers exportados:
- `getCteDistribuicaoUrl(ambiente)` — Nacional
- `getCteConsultaProtocoloUrl(uf, ambiente)` — per UF
- `getSvrsCteUrl(ambiente)` — SEFAZ-RS

---

## 3. Fluxo de mensagens (idem v1, sem mudança)

### 3.1 Modo `distNSU` — XML de requisição
```xml
<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00">
  <tpAmb>1</tpAmb>
  <cUFAutor>31</cUFAutor>
  <CNPJ>00000000000000</CNPJ>
  <distNSU>
    <ultNSU>000000000000000</ultNSU>
  </distNSU>
</distDFeInt>
```

### 3.2 Resposta — `cStat=138` quando há documentos
Estrutura igual à v1. `loteDistDFeInt` com vários `docZip` em gzip+base64.

### 3.3 Compactação dos `docZip`

**Já implementado em `cte-distribuicao.client.ts`:**
```typescript
import { gunzipSync } from 'node:zlib';
// ...
const xml = gunzipSync(Buffer.from(docZipContent, 'base64')).toString('utf-8');
```

Mover para `shared/util/docZipDecoder.ts` se ainda não está modular.

### 3.4 Schemas no `docZip`

| Schema | Conteúdo | Status no projeto |
|---|---|---|
| `procCTe_v4.00.xsd` | CT-e completo | ✅ Parser existe |
| `procCTeSimp_v4.00.xsd` | CT-e Simplificado | ⚠️ A confirmar (NT 1.05 nov/24) |
| `resCTe_v4.00.xsd` | Resumo (Capul é só "terceiro") | ❌ Falta parser |
| `procEventoCTe_v4.00.xsd` | Evento vinculado | ✅ Parser existe |
| `resEventoCTe_v1.00.xsd` | Resumo de evento | ❌ Falta parser |

---

## 4. Modelagem de dados — DECISÃO PENDENTE

### 4.1 Opção A: Tabelas dedicadas CT-e (igual plano v1)

```prisma
model CteControleNsu { ... }      // NOVO
model CteDocumento { ... }         // NOVO
model CteEvento { ... }            // NOVO
model CteLoteConsulta { ... }      // NOVO
```

**Prós:** queries específicas simples, modelagem limpa.
**Contras:** duplica padrões já cobertos por `DocumentoConsulta`/`DocumentoEvento`.

### 4.2 Opção B: Estender modelos existentes

```prisma
model DocumentoConsulta {
  // existente
  modelo Int   // 55=NF-e, 57=CT-e (já tem o campo?)
  // ... resto compartilhado
}

model CteControleNsu { ... }       // só esse é novo
```

**Prós:** reusa código de listagem/timeline/auditoria.
**Contras:** mistura conceitos NF-e e CT-e no mesmo registro.

### 4.3 Decisão: **Opção A — confirmada por Clenio em 04/05/2026** ✅

Mais limpo conceitualmente. CT-e tem campos específicos importantes (`vTPrest`, `nCt`, `chavesNFeRef` — relação com NFs transportadas, `papelCapul` específico) que poluiriam o modelo `DocumentoConsulta`.

**Decisão final:** 4 tabelas dedicadas (`cte_controle_nsu`, `cte_documento`, `cte_evento`, `cte_lote_consulta`), todas no schema `fiscal`.

### 4.4 Schema das tabelas novas (se Opção A)

#### `CteControleNsu`
```prisma
model CteControleNsu {
  id                Int       @id @default(autoincrement())
  cnpj              String    @db.VarChar(14)
  ambiente          Int       // 1=prod, 2=homolog
  ultimoNsuProcessado String  @db.VarChar(15)
  maxNsuConhecido   String    @db.VarChar(15)
  ultimaConsulta    DateTime?
  proximaConsulta   DateTime?
  bloqueadoAte      DateTime?  // se cStat 656, bloqueia 1h
  consultasNaJanela Int       @default(0)
  janelaInicio      DateTime?
  ativo             Boolean   @default(true)

  @@unique([cnpj, ambiente])
  @@map("cte_controle_nsu")
  @@schema("fiscal")
}
```

#### `CteDocumento`
Igual à v1, com 3 ajustes:
- `@@schema("fiscal")` (multi-schema do projeto)
- Campo `papelCapul` deve usar enum Prisma (não string solta)
- Adicionar campo `cnpjBase` (referência ao certificado)

#### `CteEvento` e `CteLoteConsulta`
Idem v1, com `@@schema("fiscal")`.

---

## 5. Estrutura de código — APROVEITANDO O QUE JÁ EXISTE

### 5.1 Plano v1 (greenfield):
```
fiscal/cte/backend/src/
├── cte.module.ts
├── distribuicao/
├── sefaz/                  ← cliente SOAP NOVO
├── parser/                 ← parsers NOVOS
├── persistencia/
├── scheduler/
├── certificado/            ← reusa nfe
└── shared/
```

### 5.2 v2 (incremental):
```
fiscal/backend/src/cte/
├── cte.controller.ts                    ← EXISTE — adicionar endpoints distNSU
├── cte.service.ts                       ← EXISTE — adicionar métodos distNSU
├── distribuicao/                        ← NOVO subdiretório
│   ├── distribuicao-nsu.service.ts      ← NSU orchestrator (NOVO)
│   ├── papel-detector.service.ts        ← NOVO
│   ├── nsu-controle.service.ts          ← NOVO
│   └── scheduler/
│       └── cte-distribuicao.job.ts      ← Cron a cada 15min
├── parsers/                             ← EXISTE — adicionar resCTe, resEventoCTe
└── pdf/                                 ← EXISTE
```

**O `CteDistribuicaoClient` em `fiscal/backend/src/sefaz/` ganha o método `consultarPorNsu`** ao lado do `consultarPorChave` existente.

---

## 6. Componentes — apenas o que precisa ser ADICIONADO

### 6.1 Adição ao `CteDistribuicaoClient`

```typescript
async consultarPorNsu(params: {
  cnpj: string;
  cUFAutor: string;
  ultNsu: string;
  ambiente: AmbienteSefazStr;
}): Promise<RetDistDFeInt> {
  const envelope = buildSoapEnvelope({
    operation: 'cteDistDFeInteresse',
    body: this.buildDistNsuBody(params),
  });

  const url = getCteDistribuicaoUrl(params.ambiente);
  const agent = await this.agentService.getAgent(params.cnpj);

  const response = await soapPost(url, envelope, agent);
  return this.parser.parse(response).retDistDFeInt;
}
```

### 6.2 `DistribuicaoNsuService` (orquestrador)

Igual ao plano v1, com adaptação:
- Usa `Certificado` existente (não criar nova gestão)
- Usa `LimiteDiario` existente para rate limit (não duplicar)
- Loop com `MAX_ITERACOES = 50` e proteção 656

### 6.3 `PapelDetectorService` (NOVO)

```typescript
detectarPapel(infCte: ParsedCte, cnpjCapul: string): PapelCte {
  if (infCte.dest?.CNPJ === cnpjCapul) return 'DEST';
  if (this.isTomadorCapul(infCte, cnpjCapul)) return 'TOMA';
  if (infCte.rem?.CNPJ === cnpjCapul) return 'REM';
  if (infCte.exped?.CNPJ === cnpjCapul) return 'EXPED';
  if (infCte.receb?.CNPJ === cnpjCapul) return 'RECEB';
  if (infCte.autXML?.some(a => a.CNPJ === cnpjCapul)) return 'AUTXML';
  return 'TERCEIRO';
}

private isTomadorCapul(infCte, cnpjCapul) {
  // toma3 = tomador é um dos atores (rem/exped/receb/dest)
  // toma4 = outro CNPJ não previsto em toma3
  // ... lógica completa da NT 2015.002
}
```

### 6.4 Scheduler (NOVO)

```typescript
@Cron('0 */15 * * * *')
async executar() {
  const filiais = await this.nsuControle.listarFiliaisAtivas();
  for (const filial of filiais) {
    if (await this.featureFlag.isCteDisabled()) {
      this.logger.warn('CT-e distribuição desligada por feature flag');
      return;
    }
    try {
      await this.distribuicao.consultarFilial(filial.cnpj);
    } catch (e) {
      this.logger.error(`Falha consulta CT-e ${filial.cnpj}`, e);
    }
    await sleep(2000); // espaçamento mínimo entre filiais
  }
}
```

---

## 7. Tratamento de erros (cStat) — sem mudança da v1

| cStat | Significado | Ação |
|---|---|---|
| 137 | Nenhum documento | Normal — agenda próxima 60min |
| 138 | Documentos localizados | Processa lote, continua se ultNSU<maxNSU |
| 142 | Ambiente indisponível | Backoff exponencial |
| 207 | CNPJ inválido | Crítico — alerta admin |
| 215 | Falha schema | Crítico — bug local |
| 280 | Cert vencido | Crítico — alerta urgente |
| 286 | Versão leiaute | Atualizar XSD |
| 656 | **Consumo indevido** | **Bloqueia 1h via `LimiteDiario`** |
| 108/109 | Manutenção | Backoff 30min |

**Reusa `UfCircuitState` existente** para tratar 142/108/109.

---

## 8. Cronograma realista (8-12 dias úteis)

### Fase 1 — distNSU funcional (3 dias)
- [ ] Adicionar método `consultarPorNsu` no `CteDistribuicaoClient`
- [ ] Criar tabela `CteControleNsu` + service
- [ ] Endpoint manual de teste: `POST /cte/distribuicao/consultar-filial/:cnpj`
- [ ] Logs estruturados para debug
- [ ] Testar com 1 CNPJ real da Capul (homologação)

### Fase 2 — Persistência + scheduler (2-3 dias)
- [ ] Criar tabela `CteDocumento` (Opção A) ou estender `DocumentoConsulta` (Opção B)
- [ ] Service de persistência com SHA-256 + dedup
- [ ] Cron @15min iterando filiais ativas
- [ ] Feature flag `FISCAL_CTE_DISTRIBUICAO_ENABLED` (default `false` em prod)
- [ ] Auditoria via `CteLoteConsulta` ou `AlertaEnviado` existente

### Fase 3 — PapelDetector + parser eventos + frontend (2-3 dias)
- [ ] `PapelDetectorService` com cobertura de toma3/toma4
- [ ] Parser `resCTe_v4.00.xsd` (resumo quando Capul é só terceiro)
- [ ] Parser `resEventoCTe_v1.00.xsd`
- [ ] Tabela `CteEvento` (ou estender `DocumentoEvento`)
- [ ] Frontend: nova página `CteRecebidosPage.tsx` (lista paginada com filtros papel/CFOP/UF/data)

### Fase 4 — Integração Protheus (2 dias)
- [ ] Drop XMLs em pasta UNC monitorada (ex: `\\srv-protheus\import_xml\cte`)
- [ ] Testar com Importador XML do Protheus (COMXCOL)
- [ ] Documentação operacional pra Marco

---

## 9. Pré-requisitos antes de começar

1. **Validar URLs SEFAZ vs código** (rotina ~5min) — URLs já estão em `sefaz-endpoints.map.ts` e funcionam para NF-e. Conferir vigência em https://www.cte.fazenda.gov.br/portal/webServices.aspx no Day 1 da Fase 1. SEFAZ raramente muda, mas é boa prática.
2. **Baixar XSDs v1.05** da NT 2015.002 e versionar em `fiscal/backend/src/cte/schemas/` (~15min):
   - `cteDistDFe_v1.00.xsd`
   - `procCTe_v4.00.xsd` + `procCTeSimp_v4.00.xsd` (NT 1.05 nov/24)
   - `procEventoCTe_v4.00.xsd`
   - `resCTe_v4.00.xsd` ← novo, não existe no projeto ainda
   - `resEventoCTe_v1.00.xsd` ← novo, não existe no projeto ainda
3. **Lista de CNPJs Capul ativos** — matriz + filiais que recebem CT-e (consultar setor fiscal)
4. **Pasta UNC compartilhada** com administração Protheus (apenas Fase 4 — drop XMLs)
5. ✅ **Decisão Opção A** (4 tabelas dedicadas) — confirmada por Clenio em 04/05/2026
6. **Alinhamento fiscal/contábil** — política sobre paralelismo com TOTVS Transmite (não tecnicamente necessário, mas politicamente — confirmar antes de ativar produção)

---

## 10. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Erro 656 (consumo indevido) | Média | Alta — bloqueia 1h | Rate limit local via `LimiteDiario` (max 2/min/CNPJ) + feature flag |
| URLs SEFAZ mudam | Baixa | Média | Validar antes de cada deploy + monitoramento health |
| Schema XSD nova versão | Baixa | Média | Watch nas NTs CT-e + alerta automatizado |
| Volume de XMLs > 50GB | Baixa (12 meses) | Média | Plano de migração TEXT → S3/MinIO documentado |
| Bug em loop de paginação | Média | **Alta — Capul fica offline 1h** | `MAX_ITERACOES=50` + alerta se hit |
| Equipe Protheus mudar appserver.ini sem avisar | Média | Baixa (já não funciona mesmo) | Não dependência |

---

## 11. Próximos passos imediatos

**Decisões já tomadas:**

1. ✅ **Continuar desenvolvimento próprio?** Sim — TSS não baixa CT-e (testado 04/05).
2. ✅ **Opção A ou B na modelagem?** Opção A — 4 tabelas dedicadas (Clenio, 04/05).

**Decisões pendentes:**

3. **Prioridade de fase?** Sugiro Fase 1 + 2 (5-6d) como MVP funcional.
4. **CNPJs ativos a iniciar?** Matriz primeiro (`25834847000100`) + 1 filial piloto.
5. **Quando começar?** Após o deploy do Douglas concluir (evita conflito de scopo).

**Quando der OK:**
- Eu adiciono método `consultarPorNsu` no cliente existente
- Criamos a primeira migration Prisma com `CteControleNsu`
- Endpoint manual de teste
- Testamos com CNPJ piloto em homologação SEFAZ

---

## Histórico

- **v1 (03/05/2026)** — Claude Desktop, plano greenfield, 23 dias úteis
- **v2 (04/05/2026)** — Revisão local após análise do código existente, 8-12 dias úteis
- **v2.1 (04/05/2026, noite)** — Pequena revisão pós-análise dos endpoints já mapeados:
  - URLs do `CTeDistribuicaoDFe` confirmadas no código (eram "URL provável")
  - Adicionada Seção 2.5 — limitação `consChCTe` não suportado pelo Nacional
  - Adicionada Seção 2.6 — helpers `getCteDistribuicaoUrl`/etc. já implementados
  - Pré-requisito de validação de URL ajustado de "obrigatório" pra "rotina ~5min"

**Revisor:** Claude Opus 4.7 (1M context) + Clenio
**Localização:** `C:\Users\TI-16052\Downloads\PLANO_CTE_DISTRIBUICAO_v2.md`
**Memory de referência:** `project_cte_modulo_existente_diagnostico.md`
