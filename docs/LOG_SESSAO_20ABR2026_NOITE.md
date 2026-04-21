# Log da sessão — 20/04/2026 noite

> Use este documento para retomar o trabalho. Ele acompanha o estado gravado
> em memória em `project_fiscal_retomar_21abr.md`.

---

## 1. O que foi feito nesta sessão

### 1.1 Sanidade HOM — fluxo Protheus real validado

Testei 3 chaves de NF-e em ambiente HOM do Protheus com SEFAZ em PRODUÇÃO:

| Chave | Resultado | Contador SEFAZ |
|-------|-----------|----------------|
| `53260438004867000198550000001462301001462409` | `xmlNfe HIT origem=SZR010` (cache persistiu do dia 20/04 manhã) | não bateu |
| `31260443214055000107550000254957541872343470` | `xmlNfe MISS → SEFAZ → grvXML` → re-consulta virou `SZR010` | +1 |
| `31260443214055000107550000254957551872343486` | `xmlNfe MISS → SEFAZ → grvXML` (idem) | +1 |

Contador SEFAZ: **8 → 10** (de 2000/dia). Fluxo completo confirmado: grvXML está
gravando SZR010/SZQ010 no Protheus HOM silenciosamente (antes só logava falhas).

### 1.2 Melhorias aplicadas

**(a) Log de sucesso no `grvXML` helper**
- Arquivo: `fiscal/backend/src/protheus/protheus-gravacao.helper.ts`
- Antes só logava falha → agora loga também `status=GRAVADO` e `status=JA_EXISTIA`

**(b) TODO 2 — Caso C (transferência entre filiais) IMPLEMENTADO**

Contexto: quando uma NF-e é transferência entre duas filiais CAPUL (ex: 0018 → 0005)
onde nem a matriz (0001) é emitente nem destinatária, a SEFAZ retornava vazio
porque sempre mandávamos consulente=25834847000100 (matriz).

Solução: resolver dinamicamente o CNPJ consulente pelo código da filial
selecionada no request, usando `core.filiais` como fonte. O certificado único
da matriz tem procuração e-CAC para toda a família 25834847 — SEFAZ aceita.

Arquivos modificados:
- `fiscal/backend/prisma/schema.prisma` — novo `model FilialCore` (read-only de `core.filiais`)
- `fiscal/backend/src/sefaz/nfe-distribuicao.client.ts` — `consultarPorChave` aceita `cnpjConsulenteOverride`
- `fiscal/backend/src/nfe/nfe.service.ts`:
  - `baixarDoSefaz(chave, filial)` agora recebe filial
  - novo `resolverCnpjConsulentePorFilial(codigo)` com fallback para matriz
  - `PrismaService` injetado
  - log `distDFe consChNFe (consulente=NNNNNNNN…) retornou XML ...`

Estado: rebuild OK, startup sem erros. **Pendente:** validar com chave real de
transferência interna (não testei em UI porque não tinha chave à mão).

**(c) TODO 1 — Per-endpoint ambiente: PLANO ESCRITO (não implementado)**

Documento: `docs/PLANO_INTEGRACOES_API_PER_ENDPOINT.md`

Resumo da proposta:
- Ressignificar a coluna `integracoes_api_endpoints.ativo` (hoje todos `true`,
  inútil) → passa a ser "este endpoint é o usado para esta operação"
- Dropar `integracoes_api.ambiente` (global)
- Partial unique index `(integracao_id, operacao) WHERE ativo=true` garante a invariante
- Novo endpoint `PATCH /integracoes/:id/endpoints/:endpointId/ativar`
- Novo endpoint bulk `PATCH /integracoes/:id/ambiente` (substitui o atual)
- UI: dots clicáveis HOM/PROD por linha, mantém "Trocar Todos" como bulk
- Resolver fiscal transparente (continua lendo "endpoints ativos")
- Migration idempotente

**Pendente:** revisão + aprovação antes de executar. Estimativa 3h30.

---

## 2. Working tree — arquivos a commitar

```
 M docs/PENDENCIAS_PROTHEUS_18ABR2026.md
 M docs/PLANO_MODULO_FISCAL_v2.0.md
 M fiscal/backend/prisma/schema.prisma                         ← add FilialCore (sessão noite)
 M fiscal/backend/src/nfe/nfe.service.ts                       ← caso C + flow 1-call
 M fiscal/backend/src/protheus/mocks/protheus-xml.mock.ts
 M fiscal/backend/src/protheus/protheus-gravacao.helper.ts     ← log sucesso (sessão noite)
 M fiscal/backend/src/protheus/protheus-xml.service.ts
 M fiscal/backend/src/sefaz/nfe-distribuicao.client.ts         ← override consulente (sessão noite)
?? docs/PLANO_INTEGRACOES_API_PER_ENDPOINT.md                  ← (sessão noite)
?? docs/sql/varredura_chave_cte_producao.sql
?? fiscal/backend/src/protheus/interfaces/xml-nfe.interface.ts
?? fiscal/backend/src/protheus/protheus-xml-nfe.service.spec.ts
```

### Sugestão de agrupamento dos commits

| # | Tipo | Arquivos | Escopo |
|---|------|----------|--------|
| 1 | `feat(fiscal)` | interfaces/xml-nfe, protheus-xml.service, protheus-xml-nfe.service.spec, mocks/protheus-xml.mock, protheus-gravacao.helper, protheus-xml.service, partes do nfe.service (1-call flow), docs/PENDENCIAS, docs/PLANO_MODULO_FISCAL, sql/varredura, .env | Fluxo Protheus real end-to-end + grvXML + log de sucesso |
| 2 | `feat(fiscal)` | schema.prisma (FilialCore), nfe-distribuicao.client.ts, partes do nfe.service (resolverCnpj, baixarDoSefaz) | Caso C — CNPJ consulente por filial em transferências internas |
| 3 | `docs(fiscal)` | docs/PLANO_INTEGRACOES_API_PER_ENDPOINT.md | Plano per-endpoint ambiente |

> Nota: `nfe.service.ts` tem mudanças de 2 escopos (1-call flow + caso C). Se
> quiser separar, use `git add -p`; do contrário, agrupar tudo no commit (1)
> funciona — é uma mudança coerente do fluxo.

---

## 3. Próximos passos ao retomar

1. **Commits** (você disse que faria) — 3 grupos acima.
2. **Validar TODO 2 em UI** — pegar uma chave real de transferência entre filiais
   CAPUL e consultar dentro do UI escolhendo filial ≠ 01. Log deve mostrar
   `consulente=25834847…` com a parte variável do CNPJ da filial.
3. **Revisar `docs/PLANO_INTEGRACOES_API_PER_ENDPOINT.md`** — ler seção 3
   (Proposta) e 5 (Riscos). Aprovar ou ajustar.
4. **Executar o plano 1** se aprovado — 9 passos detalhados na seção 4 do plano.

---

## 4. Estado do ambiente

- **Docker Compose:** 11 containers up (verificado)
- **Fiscal backend:** rebuilt 2× nesta sessão, última versão com caso C + log
- **Protheus:** ambiente `HOMOLOGACAO` (via UI Configurador)
- **SEFAZ:** ambiente `PRODUCAO`
- **Contador SEFAZ:** 10/2000 em 20/04/2026
- **`.env`:** `FISCAL_PROTHEUS_MOCK=false` (persiste)

---

## 5. TODO menor que não dá pra resolver daqui

**PROD `xmlNfe` drop de conexão** — `apiportal.capul.com.br/rest/api/INFOCLIENTES/FISCAL/xmlNfe`
estava dropando conexão (`other side closed`) em tentativa anterior. HOM funciona.
Precisa confirmar com equipe Protheus se o endpoint está publicado em PROD quando
for a hora de migrar.

---

*Quando voltar: abra este arquivo ou peça ao Claude Code "continue de onde
paramos" / "leia `project_fiscal_retomar_21abr.md`". O ponto de entrada da
memória está atualizado.*
