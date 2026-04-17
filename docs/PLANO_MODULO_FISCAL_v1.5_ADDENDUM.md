# PLANO MÓDULO FISCAL — Addendum v1.4 → v1.5

**Autor:** Clenio Marcos
**Data:** 11/04/2026
**Base:** `PLANO_MODULO_FISCAL_v1.4.docx` + `ESPECIFICACAO_API_PROTHEUS_FISCAL.docx` (v1.1)
**Natureza:** Addendum — não substitui o v1.4, acrescenta correções pontuais derivadas de revisão técnica e validação contra o código existente da plataforma (gestao-ti, inventario, auth-gateway), **acrescidas das observações do Setor Fiscal/TI registradas em 11/04/2026** sobre persistência de XML no Protheus, cache antes de SEFAZ e mitigação de rate limit cruzado com a emissão de NF-e.

Este documento lista **11 ajustes**. Quando aprovado, será consolidado em `PLANO_MODULO_FISCAL_v1.5.docx` e em `ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.docx` (a Especificação API sobe de v1.1 para v2.0 porque ganha uma nova frente — XMLs — com endpoint de escrita).

---

## Resumo das mudanças

| # | Seção v1.4 afetada | Tipo | Impacto |
|---|---|---|---|
| 1 | 6.5 / 16.2 Etapa 18 | Buffer de cronograma | +3 dias na Onda 2 |
| 2 | 6.2.2 / 13.3 | Gate operacional do bootstrap | Flag em DB + validação no backend |
| 3 | 17 (Riscos) / 16.2 Etapa 20 | Health-check dos repeatable jobs | +1 dia na Etapa 20 |
| 4 | Especificação API 3.3.6 / 4.1 | `dataUltimoMovimento` como esforço variável | Aviso ao time Protheus |
| 5 | 11 (Segurança) | Política de retenção LGPD | Nova subseção 11.5 |
| 6 | 8.2 (Stack) / Etapa 18 | Cliente HTTP Protheus — alinhar com inventario | Troca de biblioteca |
| 7 | 12.3 / Fase 0 de Onda 1 | Registro em `core.modulos_sistema` | Nova Etapa 0 |
| 8 | 6.3.1 / 13.3 | Cache de lookup de GESTOR_FISCAL | Detalhe de implementação |
| **9** | **2.3.1 / 6 / Especificação API §2** | **Persistência de XML em SZR010 (cabeçalho) + SZQ010 (itens) do Protheus** | **+3 dias Onda 1; Especificação API → v2.0** |
| **10** | **2.3.1 / 13.1** | **Cache no Protheus antes de consultar o SEFAZ + botão "Atualizar status"** | **+1 dia Onda 1; redesenho de UX da consulta NF-e/CT-e** |
| **11** | **3.4 / 11 / 17** | **Mitigação de rate limit cruzado com emissão de NF-e** | **Certificado A1 dedicado + circuit breaker + freio de mão; +2 dias Onda 2** |

---

## 1. Dependência do endpoint Protheus — buffer de cronograma

**Gap no v1.4:** Seção 6.5 lista "retorno do time Protheus sobre a API v1.1" como único ponto aberto, mas a Etapa 18 da Onda 2 (4 dias) já assume o endpoint publicado em homologação. Se o Protheus atrasar ou contrapropuser mudanças no contrato, a Onda 2 inteira desliza sem sinalização.

**Correção v1.5:**

- A Etapa 18 passa a ser "Integração Protheus — preferencialmente REST; fallback ODBC conforme Seção 3.4 da Especificação API v1.1" com **7 dias** (4 + 3 de buffer/fallback).
- Novo marco explícito na Seção 6.5: **até 20 dias antes do início previsto da Etapa 18**, se não houver aceite do time Protheus com prazo firmado, o desenvolvedor inicia o caminho B (ODBC direto contra Oracle), utilizando o SQL de referência documentado na Seção 3.3.6 da Especificação. A decisão de fallback é do ADMIN_TI + Setor Fiscal.
- Critério: o fallback ODBC é aceitável para o MVP mesmo que o endpoint REST fique pronto depois — a migração REST ↔ ODBC é transparente para o restante do módulo porque o adapter `ProtheusService` expõe a mesma interface.

---

## 2. Gate operacional do bootstrap

**Gap no v1.4:** Seção 6.2.2 afirma "os botões manuais só serão habilitados na interface depois que o bootstrap estiver concluído", mas não define COMO essa verificação acontece em runtime.

**Correção v1.5:**

- Novo campo em `fiscal.ambiente_config`: `bootstrapConcluidoEm: DateTime?`. Preenchido pelo `execucao.service` ao final com sucesso da execução `tipo='bootstrap'`.
- Novo endpoint público para o frontend: `GET /cruzamento/status` → `{ bootstrapConcluido: boolean, bootstrapConcluidoEm: ISO, proximaSemanalAuto: ISO, proximaDiariaAuto: ISO }`.
- Guard no backend: endpoints `POST /cruzamento/sincronizar` e `POST /cruzamento/sincronizar-cnpj` retornam **HTTP 409 `BOOTSTRAP_PENDENTE`** enquanto `bootstrapConcluidoEm` for null. O frontend esconde os botões e exibe banner "Aguardando primeira carga completa (agendada para DD/MM)".
- Exceção: `ADMIN_TI` pode forçar o bypass do gate via header `X-Fiscal-Override-Gate` (log obrigatório em `audit_log`).

---

## 3. Health-check dos repeatable jobs

**Gap no v1.4:** Seção 17 lista o risco "repeatable job do BullMQ deixar de rodar silenciosamente" e cita health-check como mitigação, mas não existe tarefa correspondente no cronograma da Onda 2.

**Correção v1.5:**

- A Etapa 20 ("Scheduler: repeatable jobs") passa de 3 para **4 dias** e ganha os seguintes entregáveis adicionais:
  - Cron dedicado `watchdog` (executa a cada 1 hora): consulta `fiscal.cadastro_sincronizacao` pelo `tipo='semanal-auto'` e `tipo='diaria-auto'` mais recentes. Se a última execução for mais antiga que `expected_interval * 1.5`, emite alerta.
  - Alerta do watchdog é enviado para `GESTOR_FISCAL` **e** `ADMIN_TI` via o mesmo canal de e-mail consolidado (subject: `[FISCAL] Rotina agendada atrasada`).
  - Endpoint `GET /cruzamento/health-scheduler` → expõe status dos jobs para scraping externo (futura integração com Uptime/Grafana).

---

## 4. `dataUltimoMovimento` — esforço variável no lado Protheus

**Gap nas duas especs:** A Especificação API v1.1 trata `dataUltimoMovimento` como campo obrigatório (Seção 4.1), mas a Seção 3.3.6 admite que a implementação pode exigir materialização (trigger/view/coluna auxiliar). Isso pode dominar o prazo do lado Protheus e não está sinalizado como esforço variável.

**Correção v1.5 (a aplicar na Especificação API, gerando v1.2):**

- Na Seção 4.1, `dataUltimoMovimento` passa a "obrigatório, com esforço variável — ver 3.3.6".
- Na Seção 9 ("Informações necessárias do time Protheus"), incluir explicitamente:
  > Confirmação do approach para `dataUltimoMovimento`: (a) JOIN/EXISTS on-the-fly contra SF1/SF2/SE1/SE2/SC5/SC7, (b) coluna materializada atualizada por trigger, (c) job noturno que popula tabela auxiliar, (d) view materializada. Cada alternativa tem custo diferente de implementação e de performance em runtime. **Pedimos estimativa separada para esta parte do contrato.**
- Fallback do Módulo Fiscal caso o Protheus indique que `comMovimentoDesde` é caro: o módulo executará uma **consulta prévia** (endpoint leve ou query ODBC) listando apenas os CNPJs com movimento, e depois chamará `GET /cadastroFiscal/{cnpj}` em lote. Essa estratégia já está mencionada en passant na Seção 3.3.6 da Especificação — v1.5 explicita-a como plano B oficial.

---

## 5. LGPD — retenção e expurgo

**Gap no v1.4:** Seção 11.3 cobre LGPD para dados cadastrais ("são públicos"), mas não define política de retenção para `fiscal.audit_log`, `fiscal.cadastro_historico` e `fiscal.alerta_enviado`, que crescem linearmente com o uso.

**Correção v1.5 — nova Seção 11.5 "Retenção e expurgo":**

| Tabela | Retenção | Justificativa |
|---|---|---|
| `fiscal.documento_consulta` | 5 anos | Prazo fiscal padrão (guarda de documentos). |
| `fiscal.documento_xml` (arquivos em disco) | 5 anos | Idem — são a prova material da consulta. |
| `fiscal.cadastro_historico` | 5 anos | Trilha de mudanças de status de contribuinte. |
| `fiscal.cadastro_sincronizacao` | 2 anos | Metadados operacionais, sem valor fiscal direto. |
| `fiscal.alerta_enviado` | 2 anos | Auditoria de quem recebeu alerta. |
| `fiscal.audit_log` | 5 anos | Auditoria administrativa — alinhado com gestão TI. |
| `fiscal.protheus_snapshot` | 90 dias | Dado reproduzível; mantém só histórico recente. |

- Job de expurgo (cron noturno, separado dos repeatable jobs de sincronização): remove registros fora da janela. Nova Etapa 21-bis na Onda 2: **1 dia** para implementação do expurgo + endpoint `DELETE /historico/limpeza` para disparo manual (já listado na Seção 13.4 da v1.4, mas sem escopo definido).

---

## 6. Cliente HTTP Protheus — alinhar com `inventario`

**Descoberta da validação contra código existente:**

- `gestao-ti/backend/src/protheus/protheus.service.ts` usa `https` nativo do Node, **sem retry nem circuit breaker**, cache em memória (TTL 5min).
- `inventario/backend/app/services/protheus*` (Python) usa `httpx` assíncrono com **2 retries em 5xx**, timeout configurável.

O Módulo Fiscal tem requisitos operacionais mais próximos do Inventário (rotinas agendadas, tolerância a falhas transitórias) do que do Gestão TI (requisições interativas síncronas).

**Correção v1.5 — Seção 8.2 Stack:**

- Linha "Cliente HTTP Protheus: axios com retry + circuit breaker" → substituir por:

  > **Cliente HTTP Protheus:** `undici` (nativo Node 22) ou `got` com `got-retry`. Justificativa: (a) alinhado com a política de retry já aplicada no Inventário, (b) evita dependência nova de `axios` + plugin de retry, (c) `undici` é built-in e oferece interceptors. Configurar: 3 retries com backoff exponencial em 5xx/429 e timeouts de conexão (5s) e request (30s).

- A credencial `PROTHEUS_API_AUTH` é reaproveitada do padrão atual (variável de ambiente já exposta nos outros módulos). Documentar no `.env.example` do fiscal.

---

## 7. Registro em `core.modulos_sistema` — nova Etapa 0

**Gap no v1.4:** A Seção 12.3 lista "core.modulos (dados) — Aditivo: +1 registro (FISCAL)" como impacto, mas a Onda 1 começa na Etapa 1 ("Scaffolding") sem nenhuma tarefa preparatória de registro.

**Correção v1.5 — nova Etapa 0 antes da Etapa 1:**

| Etapa | Atividade | Responsável | Duração |
|---|---|---|---|
| **0** | **Registro do módulo FISCAL na plataforma**: inserção em `core.modulos_sistema` (codigo=`FISCAL`, nome, `urlFrontend`, `urlBackend`), criação das roles `OPERADOR_ENTRADA`/`ANALISTA_CADASTRO`/`GESTOR_FISCAL`/`ADMIN_TI` via Configurador, atribuição inicial ao Setor Fiscal, entrada em `core.modulos_roles`. | Dev + ADMIN_TI | 1 dia |

- Essa etapa valida o fluxo Configurador → Auth Gateway → JWT com módulo `FISCAL` ANTES de qualquer desenvolvimento do backend. Reduz risco de descobrir na Etapa 16 que o JWT não resolve a role do novo módulo.
- Total Onda 1 passa de 39 para **40 dias úteis**.

---

## 8. Resolução dinâmica de destinatários GESTOR_FISCAL — detalhe de implementação

**Gap no v1.4:** Seção 6.3.1 define o modelo dinâmico mas não trata de performance (cada execução faz lookup no Auth Gateway) nem do caso "nenhum gestor configurado".

**Correção v1.5:**

- O `alertas.service.ts` resolve destinatários **no momento do envio**, via query ao schema `core` (read-only, já suportado pelo `multiSchema` do Prisma 6):

  ```ts
  SELECT u.email, u.nome
  FROM core.usuarios u
  JOIN core.usuarios_modulos um ON um.usuario_id = u.id
  WHERE um.modulo_codigo = 'FISCAL' AND um.role = 'GESTOR_FISCAL' AND u.ativo = true
  ```

- Resultado é cacheado em memória por **5 minutos** (padrão do gestao-ti para lookups de core) — invalidação manual via `POST /alertas/refresh-destinatarios` (role ADMIN_TI).
- **Caso degenerado:** se a query retornar zero destinatários, o e-mail NÃO é silenciosamente descartado. Em vez disso, é enviado para o endereço configurado em `FISCAL_FALLBACK_EMAIL` (variável de ambiente, ex.: `ti@capul.com.br`) com subject prefixado `[FALLBACK — sem GESTOR_FISCAL configurado]`. Registro obrigatório em `fiscal.alerta_enviado` com flag `fallback=true`.
- Essa regra é documentada em `docs/ROTEIRO_FINALIZACAO.md` como verificação pós-deploy: "confirmar que há ao menos um `GESTOR_FISCAL` ativo no Configurador".

---

## 9. Persistência de XML baixado em SZR010 (cabeçalho) + SZQ010 (itens) do Protheus

**Origem da observação:** Setor Fiscal/TI, 11/04/2026.

> **Atualização (11/04/2026 — após recebimento do `SZQ_SZR.csv`):** a estrutura real das tabelas, conforme o dicionário X3 fornecido pela TI da CAPUL, é:
> - **SZR010 = cabeçalho** (1 linha por documento, chave composta `ZR_FILIAL + ZR_CHVNFE`). Contém o XML completo no campo Memo `ZR_XML` mais 30 colunas com os dados extraídos do XML (emitente, série, modelo, datas, recebimento, fornecedor Protheus, transporte para CT-e).
> - **SZQ010 = itens** (1 linha por `<det>`, chave composta `ZQ_FILIAL + ZQ_CHVNFE + ZQ_ITEM`). 22 colunas, divididas em **Grupo A** (preenchido pela API a partir do XML — produto, EAN, descrição, UM, qtde, valor, CFOP, impostos) e **Grupo B** (deixado vazio pela API — `ZQ_CODSIG`, `ZQ_QTSIGA`, `ZQ_VLSIGA`, `ZQ_PEDCOM`, `ZQ_ITEMPC` — preenchidos depois pelo usuário durante a entrada de mercadoria, mantendo paridade com o monitor automático do Protheus).
>
> Bônus descoberto: **NF-e e CT-e cabem nas mesmas duas tabelas** via `ZR_TPXML`/`ZR_MODELO`/`ZR_TPNF` no cabeçalho e `ZQ_CHVCTE`/`ZQ_CTNF`/`ZQ_CTSER`/`ZQ_CTFOR`/`ZQ_CTLOJ` nos itens. Não precisa de endpoint separado para CT-e.
>
> O detalhamento completo (mapeamento JSON ↔ campo Protheus, dicionário de tipos/tamanhos, validações transacionais) está em **`ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` Seção 4.3 e Anexo C**. Este item 9 do addendum mantém apenas a visão de alto nível.

**Contexto:** A CAPUL possui as tabelas customizadas SZR010/SZQ010 que armazenam os XMLs de NF-e e CT-e usados para a entrada de mercadoria pelo monitor do ERP. A maioria dos XMLs chega automaticamente via DistribuicaoDFe do próprio Protheus. Os casos em que o XML **não** chega automaticamente (timeout, indisponibilidade, NF emitida fora da janela de busca) hoje exigem download manual fora do sistema, o que é justamente uma das motivações originais do Módulo Fiscal.

**Mudança de propósito da frente NF-e na v1.5:** deixa de ser apenas "consultar/baixar XML avulso" e passa a ser **"fechar o gap de XMLs faltantes no Protheus, alimentando o fluxo padrão de entrada de mercadoria"**. Todo XML baixado pelo Módulo Fiscal é gravado em SZR010 + SZQ010 e fica imediatamente disponível para o monitor de NF-e processar como qualquer outro XML.

**Correção v1.5 — novo recurso na Especificação API (sobe para v2.0):**

Novo recurso `xmlFiscal` em paralelo ao `cadastroFiscal` já existente:

```
POST   /rest/api/INFOCLIENTES/xmlFiscal               # grava SZR010 + SZQ010 transacional
GET    /rest/api/INFOCLIENTES/xmlFiscal/{chave}       # recupera XML completo + metadados
GET    /rest/api/INFOCLIENTES/xmlFiscal/{chave}/exists # cache check leve sem trafegar BLOB
```

**`POST /xmlFiscal`** — payload mínimo:
```json
{
  "chave": "31260400000000000000550010000000011000000010",
  "tipoDocumento": "NFE",
  "filial": "01",
  "xml": "<?xml version=\"1.0\"?>...",
  "usuarioCapulQueDisparou": "fulano.silva"
}
```

Validações executadas pelo Protheus (10 itens, em ordem — detalhe na Especificação v2.0 §3.8.3): formato da chave, filial existe, XML bem-formado, valida XSD SEFAZ, chave bate com `Id` do XML, tipoDocumento bate com `<mod>`, assinatura digital válida, CAPUL é participante, contraparte cadastrada em SA1/SA2 (resolvendo `ZR_CODFOR`/`ZR_LOJSIG`), idempotência por `(ZR_FILIAL, ZR_CHVNFE)`. Se passar, INSERT transacional em SZR010 (1 linha, com `ZR_XML` Memo) + SZQ010 (N linhas Grupo A) — rollback total se qualquer um falhar.

Respostas:
- `201 GRAVADO` — gravou cabeçalho + N itens. Retorna `itensGravados` e `fornecedorProtheus { codigo, loja }` resolvido.
- `200 JA_EXISTENTE` — chave já existia em SZR010. Não é erro; o módulo segue usando o XML do cache.
- `400` — `CHAVE_INVALIDA` / `FILIAL_INVALIDA` / `XML_MALFORMADO` / `XML_NAO_VALIDA_XSD` / `CHAVE_NAO_BATE_XML` / `TIPO_NAO_BATE_XML` / `ASSINATURA_INVALIDA`.
- `409` — `NAO_RELACIONADO_CAPUL` / `CONTRAPARTE_NAO_CADASTRADA`.
- `500 FALHA_GRAVACAO` / `503 PROTHEUS_INDISPONIVEL` — gatilham retry com backoff (3 tentativas).

**`GET /xmlFiscal/{chave}`** — recupera o XML armazenado: retorna chave, filial, modelo, série/número/emissão, conteúdo de `ZR_XML`, bloco `emitente` (todos os campos `ZR_E*`), `fornecedorProtheus { codigo, loja }`, dados de transporte (CT-e), `recebimento { data, hora, usuario }` e `totalItens`. `404 CHAVE_NAO_ENCONTRADA` se ausente.

**`GET /xmlFiscal/{chave}/exists`** — versão leve, retorna `{ existe, chave, tipoDocumento, modelo, filial, gravadoEm, usuarioRecebedor, totalItens }` (sem trafegar `ZR_XML`). "Não existe" é resposta normal `200 { existe: false }`, não 404.

**Permissão de escrita restrita:** o usuário técnico `API_FISCAL` (Especificação 5.3) deixa de ser "apenas leitura" e ganha **`SELECT + INSERT`** em SZR010 e SZQ010 (sem `UPDATE`/`DELETE`), e **`SELECT`** em SA1010/SA2010 + tabelas de movimento (se a estratégia escolhida para `dataUltimoMovimento` exigir). Em nenhuma outra tabela.

**Auditoria do lado Protheus:** o campo `ZR_USRREC` (capacidade 30) é preenchido com `'API_FISCAL'` ou `'API_FISCAL:'+usuarioCapulQueDisparou` (ex.: `API_FISCAL:joao.silva`). Filtro simples para o time fiscal distinguir XMLs vindos do Módulo Fiscal: `ZR_USRREC LIKE 'API_FISCAL%'`.

**Perguntas a confirmar com o time Protheus** (lista completa na Especificação v2.0 §9):
- Existe User Function ADVPL reutilizável que faça parsing do XML, valide XSD + assinatura e grave SZR010 + SZQ010 em uma única transação? Se sim, esforço do POST é mínimo. Se não, é o item dominante de prazo do lado Protheus.
- Confirmação dos valores válidos para `ZR_TPXML` (provavelmente `NFE`/`CTE`) e `ZR_TPNF` (`0`/`1` para entrada/saída?).
- Existe rotina ADVPL que resolve CNPJ contraparte → `A2_COD/A2_LOJA` em SA2010?
- Confirmação de que o Grupo B de SZQ010 **não** deve ser populado pelo POST.

**Etapas afetadas na Onda 1:**
- Nova Etapa **5-bis**: "Cliente HTTP `xmlFiscal` (POST + GET) + lógica de idempotência + tratamento dos status 200/201/409" — **2 dias**.
- Etapa 12 ("Frontend NF-e"): +1 dia para o badge de origem e o tratamento de erro `409 CNPJ não cadastrado` (com link "Cadastrar fornecedor no Protheus" — informativo apenas, sem escrita).
- **Total: +3 dias na Onda 1.**

---

## 10. Cache no Protheus antes de consultar o SEFAZ — fluxo redesenhado

**Origem da observação:** Setor Fiscal/TI, 11/04/2026.

**Racional:** A consulta no portal SEFAZ (e os web services equivalentes `NFeDistribuicaoDFe` + `NfeConsultaProtocolo`) extraem suas informações do XML autorizado, que para a maioria das NF-es da CAPUL **já está armazenado no Protheus** em SZR010 (campo Memo `ZR_XML`). Bater no SEFAZ todas as vezes é desperdício de quota e mais lento. **Mas** o status atual de uma NF-e (cancelada, com CC-e, manifestada) muda no SEFAZ depois da emissão e o XML estático no Protheus não reflete isso — então **o botão de consulta ao SEFAZ continua sendo essencial** para ver eventos posteriores.

**Correção v1.5 — fluxo da consulta NF-e/CT-e:**

```
Usuário informa chave (44 dígitos)
        │
        ▼
[Backend Fiscal] GET /xmlFiscal/{chave}/exists no Protheus
        │
        ├── existe=true ─► GET /xmlFiscal/{chave} ─► parser ─► abas
        │                  Badge na UI: "Origem: Protheus
        │                                (gravado em DD/MM/AAAA HH:MM)"
        │                  Botão sempre visível: "Atualizar status no SEFAZ"
        │                                          ↓
        │                                          NfeConsultaProtocolo
        │                                          (sem rebaixar XML)
        │                                          ↓
        │                                          atualiza eventos na UI
        │
        └── existe=false ─► NFeDistribuicaoDFe (SEFAZ) ─► XML
                            ↓
                            POST /xmlFiscal (grava no Protheus)
                            ↓
                            parser ─► abas
                            Badge: "Origem: SEFAZ (recém-baixado e
                                    persistido no Protheus)"
```

**Por que o botão "Atualizar status no SEFAZ" continua disponível mesmo com cache:**
- O XML é estático — fotografa a NF-e no momento da autorização.
- O **status** é dinâmico: cancelamento (evento 110111), CC-e (110110), Ciência da Operação (210210), Confirmação (210220), Operação Não Realizada (210240), Desconhecimento (210220).
- Uma NF-e "autorizada" no Protheus pode estar "cancelada" no SEFAZ — o setor fiscal precisa ver isso ao auditar.
- Por isso o desenho separa **XML do cache** + **eventos sempre on-demand do SEFAZ via NfeConsultaProtocolo** (com cache curto de até 1 hora para evitar reconsulta na mesma sessão do usuário).

**Tabela `fiscal.documento_consulta` (Seção 9 do v1.4) ganha colunas:**
- `origem`: enum `PROTHEUS_CACHE` | `SEFAZ_DOWNLOAD`.
- `consultaSefazAtualizadaEm`: DateTime nullable — última vez que o usuário pediu "Atualizar status no SEFAZ" para essa chave.

**Rastreio de economia:** o painel administrativo mostra "Nas últimas 24h: X consultas, Y resolvidas pelo cache Protheus, Z baixadas do SEFAZ". Isso justifica a iniciativa para o Setor Fiscal e ajuda a calibrar o rate limit.

**Etapas afetadas:**
- Etapa 4 ("SefazClient NF-e") ganha integração com o cache check antes de chamar a SEFAZ — **0 dias adicionais** (já é parte natural da implementação).
- Etapa 12 ("Frontend NF-e") ganha o botão "Atualizar status no SEFAZ", o badge de origem e o painel de economia — **+1 dia**.
- **Total: +1 dia na Onda 1.**

---

## 11. Rate limit cruzado com a emissão de NF-e — mitigação obrigatória

**Origem da observação:** Setor Fiscal/TI, 11/04/2026. Esta é a preocupação mais crítica do addendum porque atinge diretamente a operação comercial: se o cruzamento Sintegra/CCC gerar bloqueio do CAPUL nos serviços SEFAZ, a emissão de NF-e de saída (Protheus) pode travar e parar o faturamento.

**Análise técnica:**

Os web services da SEFAZ que entram em cena para a CAPUL após o Módulo Fiscal entrar em produção:

| Serviço SEFAZ | Para quê | Quem usa |
|---|---|---|
| `NfeAutorizacao` | EMITIR NF-e de saída | Protheus |
| `NfeRetAutorizacao` | Confirmar emissão | Protheus |
| `NfeStatusServico` | Verificar SEFAZ no ar | Protheus |
| `RecepcaoEvento` | Cancelar / CC-e / Manifestar | Protheus |
| `NFeDistribuicaoDFe` | Baixar XMLs em lote | **Módulo Fiscal** |
| `NfeConsultaProtocolo` | Status atual de uma NF-e | **Módulo Fiscal** |
| `CadConsultaCadastro2` | Cadastro de contribuinte (Sintegra/CCC) | **Módulo Fiscal** |

Os contadores de rate limit são, na maioria das UFs, **independentes por serviço** — cluster e fila separados por endpoint. Bloqueio em `CadConsultaCadastro2` da SEFAZ MG não derruba `NfeAutorizacao` da SEFAZ MG. Mas há uma sobreposição perigosa: **a SEFAZ identifica o cliente pelo CNPJ do certificado digital, não pelo IP**. Se o Módulo Fiscal usar o mesmo certificado A1 que o Protheus usa para emissão, qualquer rate limit/bloqueio aplicado por CNPJ consulente cobre os dois sistemas.

**Riscos, em ordem decrescente de impacto:**

1. **Crítico — baixa probabilidade:** SEFAZ aplica rate limit por CNPJ cruzando todos os serviços. Resultado: emissão fica lenta ou trava.
2. **Médio — média probabilidade:** SEFAZ bloqueia `CadConsultaCadastro2` por CNPJ por algumas horas. Cruzamento para; emissão segue normal.
3. **Médio — baixa probabilidade:** SEFAZ bloqueia por IP de origem (afeta todos os serviços que saem do mesmo egress).

### 11.1. Mitigação A — Certificado A1 dedicado para o Módulo Fiscal (OBRIGATÓRIA)

**Decisão arquitetural:** o Módulo Fiscal **NÃO** compartilha o certificado A1 que o Protheus usa para emissão. A CAPUL adquire um **segundo certificado A1**, emitido para o mesmo CNPJ jurídico, exclusivo para o Módulo Fiscal.

- Custo estimado: **R$ 200 a R$ 400/ano** (uma única emissão na certificadora — Serasa, Certisign, AC Safeweb etc.).
- Para o SEFAZ, são "dois clientes diferentes" mesmo sendo o mesmo CNPJ (a chave é o serial do certificado, não o CNPJ).
- Qualquer bloqueio que atinja o certificado do Módulo Fiscal **não afeta** o certificado de emissão do Protheus. E vice-versa.
- Esta mitigação isolada já reduz o risco a quase zero.
- **Provisionamento:** ADMIN_TI providencia o certificado durante a Onda 1 (em paralelo ao desenvolvimento, sem bloquear cronograma). Em homologação podemos usar o mesmo certificado de teste do Protheus, mas em produção o uso do certificado dedicado é **obrigatório** — o go-live só acontece com ele.

### 11.2. Mitigação B — Janelas de execução fora do horário de emissão

- Carga completa semanal: sábado de madrugada (já no v1.4).
- Carga incremental diária: **entre 00:00 e 04:00**, fora da janela de emissão de NF-e da CAPUL.
- Consultas pontuais (horário comercial): volume baixíssimo — sem risco.
- Configurável em `fiscal.ambiente_config` (campos `janelaSemanalCron` e `janelaDiariaCron`) para o ADMIN_TI ajustar conforme rotina da operação.

### 11.3. Mitigação C — Circuit breaker, freio de mão e watchdog cruzado

- **Circuit breaker por UF**: ao detectar 3 erros consecutivos com HTTP 429 (Too Many Requests) ou 503 (Service Unavailable) numa UF, pausa consultas àquela UF por 30 minutos. Estado registrado em `fiscal.uf_circuit_state` (uf, status, retomadaEm).
- **Freio de mão global**: variável de ambiente `FISCAL_PAUSE_SYNC=true` para imediatamente todas as rotinas automáticas e bloqueia disparos manuais. Comando exposto via endpoint `POST /admin/pause-sync` (role `ADMIN_TI`, log obrigatório em `audit_log`). Endpoint inverso `POST /admin/resume-sync` para retomar. Para uso emergencial quando o setor comercial reportar lentidão na emissão.
- **Watchdog cruzado**: nos primeiros 30 dias após go-live da Onda 2, o ADMIN_TI acompanha diariamente os logs de emissão NF-e do Protheus comparando o tempo médio de resposta dos serviços SEFAZ ANTES e DEPOIS da janela do Módulo Fiscal. Se houver degradação significativa, aciona o freio de mão e abre análise.

### 11.4. Mitigação D — Plano de contingência: API comercial para o cruzamento

Se mesmo com A+B+C houver impacto comprovado na emissão, o caminho C do plano original (Caminho C — API comercial: Assertiva, InfoSimples, SerPro) entra em cena **apenas para o cruzamento Sintegra/CCC**. O download de XML continua com o certificado próprio (volume baixo, baixo risco).

Custo de referência: R$ 0,05–0,15 por consulta. Cenários:
- Carga completa semanal via API paga: 116k consultas × R$ 0,10 ≈ **R$ 11.600/semana** = R$ 50.000/mês — **caro**, descartado como modelo padrão.
- Apenas carga incremental diária via API paga: 500 consultas/dia × 30 × R$ 0,10 ≈ **R$ 1.500/mês** — **viável** como modo conservador.
- Apenas para UFs cronicamente instáveis (ex.: SP, RJ): proporcional ao volume daquelas UFs — provavelmente **R$ 200–500/mês**.

A decisão entre os cenários é da Diretoria, baseada em dados reais coletados nos primeiros 60 dias após go-live.

### 11.5. Mitigação E (rejeitada) — abrir mão da carga completa semanal

Alternativa mais conservadora descartada: ficar apenas com a incremental diária (centenas de CNPJs/dia) e abrir mão da carga completa semanal. Eliminaria quase todo o risco de rate limit, mas perderia a capacidade de detectar mudanças no lado SEFAZ que não passam pelo Protheus (contribuinte rebaixado a inapto sem movimento). **Não recomendada** porque elimina justamente o ponto mais valioso da solução. Documentada aqui apenas para constar como opção avaliada.

### 11.6. Decisão consolidada

Para o v1.5, adota-se o pacote **A + B + C** como obrigatório para o go-live:

| Mitigação | Status | Responsável |
|---|---|---|
| A — Certificado A1 dedicado | **Obrigatória — bloqueante para go-live** | ADMIN_TI provisiona até o final da Onda 1 |
| B — Janelas noturnas configuráveis | **Obrigatória** | Dev (Etapa 20 da Onda 2) |
| C — Circuit breaker + freio de mão + watchdog | **Obrigatória** | Dev (nova Etapa 19-bis na Onda 2) |
| D — API comercial | **Plano de contingência** | Aciona apenas se houver impacto na emissão |
| E — Sem carga completa semanal | **Rejeitada** | Documentada |

**Etapas afetadas na Onda 2:**
- Nova Etapa **19-bis**: "Circuit breaker por UF + freio de mão global + telemetria cruzada com Protheus emissão" — **2 dias**.
- Etapa 22 ("Serviço de alertas") ganha um template adicional: "alerta de emergência — freio de mão acionado" — **0 dias adicionais** (parte natural).
- ADMIN_TI provisiona o certificado dedicado em paralelo ao desenvolvimento — **sem impacto no cronograma de dev**.
- **Total: +2 dias na Onda 2.**

---

## Impacto consolidado no cronograma

| Onda | v1.4 | v1.5 (após items 1-11) | Diferença |
|---|---|---|---|
| Onda 1 | 39 dias | **44 dias** | +1 (Etapa 0) +3 (item 9 — XML SZR/SZQ) +1 (item 10 — cache UI) |
| Onda 2 | 29 dias | **36 dias** | +3 (Etapa 18 buffer) +1 (Etapa 20 watchdog) +1 (Etapa 21-bis expurgo) +2 (Etapa 19-bis circuit breaker) |
| **Total** | **68 dias** | **80 dias** | **+12 dias (~2,4 semanas)** |

---

## Checklist de aprovação

### Itens 1-8 (revisão técnica original)
- [ ] ADMIN_TI aprova Etapa 0 e o fluxo de registro em `core.modulos_sistema`.
- [ ] Setor Fiscal aprova política de retenção da Seção 11.5.
- [ ] Setor Fiscal define e-mail do `FISCAL_FALLBACK_EMAIL`.
- [ ] Desenvolvedor confirma escolha de `undici` vs `got` (decisão livre).

### Itens 9-11 (observações do Setor Fiscal/TI de 11/04/2026)
- [ ] **Item 9** — Time Protheus confirma viabilidade do recurso `xmlFiscal` (POST + GET + exists) e informa se já existe User Function ADVPL para gravar em SZR010 (cabeçalho) + SZQ010 (itens) transacional com validação de XSD + assinatura.
- [ ] **Item 9** — Setor Fiscal aprova a mudança de propósito da frente NF-e ("fechar gap de XMLs faltantes" em vez de apenas "consulta avulsa").
- [ ] **Item 10** — Setor Fiscal valida o desenho de UX do botão "Atualizar status no SEFAZ" e a separação cache de XML × consulta on-demand de eventos.
- [ ] **Item 11 — A** — ADMIN_TI inicia processo de aquisição do **segundo certificado A1** dedicado ao Módulo Fiscal (custo R$ 200–400/ano). **Bloqueante para go-live da Onda 2.**
- [ ] **Item 11 — B** — Setor Fiscal/Comercial confirma janela de emissão de NF-e (horário em que NÃO emite) para definir o cron das rotinas noturnas.
- [ ] **Item 11 — C** — ADMIN_TI assume o compromisso do watchdog cruzado nos 30 primeiros dias após go-live da Onda 2.
- [ ] **Item 11 — D** — Diretoria toma ciência do plano de contingência (API comercial) e do custo estimado, sem necessidade de aprovação prévia (só aciona se houver problema).

### Documentação derivada
- [ ] Time Protheus recebe **`ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.docx`** contendo:
  - Esclarecimento sobre `dataUltimoMovimento` (item 4 deste addendum).
  - **Novo recurso `xmlFiscal`** com endpoints POST/GET/exists (item 9).
  - **Permissão `SELECT + INSERT` restrita** em SZR010 e SZQ010 para o usuário `API_FISCAL`, sem `UPDATE`/`DELETE` (item 9 + Especificação v2.0 §5.3).
  - **Anexo C novo** com o dicionário X3 completo das tabelas SZR010 e SZQ010 (51 campos), reproduzindo o `SZQ_SZR.csv` recebido em 11/04/2026.
- [ ] Após aprovação completa, consolidar em **`PLANO_MODULO_FISCAL_v1.5.docx`** e arquivar este addendum.
