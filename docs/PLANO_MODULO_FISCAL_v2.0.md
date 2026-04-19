# CAPUL — Cooperativa Agropecuária Unaí Ltda
## Plataforma Capul — Módulo Fiscal
### Plano Mestre v2.0

- **Autor:** Clenio Marcos — Departamento de T.I.
- **Data:** 17/04/2026
- **Versão:** 2.0
- **Substitui:** `PLANO_MODULO_FISCAL_v1.5_ADDENDUM.md` (11/04/2026) e todas as versões anteriores do plano
- **Status:** Plano ativo — em execução

---

## Histórico de versões

| Versão | Data | Resumo |
|---|---|---|
| 1.0 – 1.4 | Jan–Mar/2026 | Planejamento inicial; consultas SEFAZ diretas; cruzamento batch massivo; escopo "xmlFiscal" não-formalizado. |
| 1.5 (addendum) | 11/04/2026 | 11 ajustes pós-auditoria: gate de bootstrap, circuit breaker, LGPD, esboço de recurso `xmlFiscal`. |
| **2.0** | **17/04/2026** | **Reestruturação mestre após alinhamento operacional com Setor Fiscal.** Pontos-chave: (1) cruzamento deixa de ser "bootstrap + semanal massivo" e passa a ser **movimento-based com duas corridas diárias** (12:00 e 06:00) dentro da janela de cancelamento de 24h da NF-e; (2) novo contrato Protheus `cadastroFiscal` recebido em 17/04 (v1 spec-driven, sem `xmlFiscal`) — `xmlFiscal` fica na Onda 2; (3) **divisão clara** de responsabilidades entre Configurador (certificado, integrações API) e Fiscal (operação); (4) **proteção de 5 camadas** contra bloqueio SEFAZ, com **limite diário global de 2.000 consultas/dia** e **rate limit de 20 req/min**, incluindo **política escrita** exposta na UI; (5) menu do módulo reorganizado; (6) remoção do conceito de "fila de NFs pendentes de SZR" (não é caso de uso real). |

---

## 1. Contexto

A Plataforma Capul consolida, em **módulos integrados**, a operação administrativa da cooperativa. O **Módulo Fiscal** nasceu da necessidade de dar ao Setor Fiscal ferramentas que o Protheus não oferece nativamente, com foco em **três frentes operacionais**:

1. **Cruzamento cadastral** — validar periodicamente os cadastros de clientes (SA1010) e fornecedores (SA2010) do Protheus contra o cadastro de contribuintes mantido pelas SEFAZ estaduais (CCC / Sintegra), detectar rebaixamentos e alertar a tempo de evitar emissão de NF-e com destinatário em situação irregular.
2. **Consulta pontual cadastral** — permitir ao operador validar manualmente um CNPJ/CPF antes de cadastrar ou atualizar no Protheus.
3. **Consulta individual de NF-e e CT-e por chave** — visualização, download de XML/DANFE/DACTE, histórico de eventos. Serve como "janela SEFAZ" para o setor fiscal operar no dia-a-dia.

A v2.0 formaliza a **mecânica diária** do cruzamento e fecha as **divergências arquiteturais** acumuladas nas versões anteriores.

---

## 2. Decisões estruturais da v2.0

### 2.1. Cruzamento passa a ser **movimento-based**, não bootstrap

**O que muda:** as versões anteriores previam uma carga total (bootstrap) seguida de uma varredura semanal completa. Na prática, 116 mil cadastros ativos (36.730 SA1010 + 79.383 SA2010) é volume demais para consultar semanalmente sem risco SEFAZ.

**Novo modelo:** consultar apenas **CNPJs que tiveram movimento fiscal/financeiro recente no Protheus**, em duas corridas diárias alinhadas à **janela de cancelamento de NF-e de 24h**:

| Corrida | Horário | Janela de movimento | Propósito |
|---|---|---|---|
| **Meio-dia** | 12:00 | NFs emitidas **hoje 00:00 → 12:00** | Detectar problema cadastral **no mesmo dia** → permite cancelar a NF ainda hoje |
| **Manhã seguinte** | 06:00 (D+1) | NFs emitidas **ontem 12:00 → 23:59** | Cobrir o 2º bloco ainda dentro das 24h de cancelamento |

**Dedup por CNPJ:** mesmo que um cliente tenha 30 NFs no bloco, ele é consultado **uma única vez**. A corrida é consolidada (todas as filiais, todas as NFs) e deduplicada por CNPJ+UF antes de enfileirar os jobs BullMQ.

### 2.2. Filtro por filial **deixa de existir** no cadastro

As tabelas SA1010 e SA2010 do Protheus são compartilhadas entre filiais (A1_FILIAL / A2_FILIAL não é chave efetiva). O filtro por filial só se aplica à **subquery de movimento** (SF1/SF2/SE1/SE2) — nunca à lista de cadastros.

Consequência: a consulta cadastral pontual (Consulta Cadastral) e a recuperação por CNPJ no novo `cadastroFiscal` **não recebem parâmetro de filial**.

### 2.3. `xmlFiscal` (frente NF-e/CT-e via Protheus) fica na Onda 2

O contrato `/cadastroFiscal` recebido em 17/04/2026 é **somente leitura de cadastros**. A frente de armazenamento de XMLs em SZR010/SZQ010 (necessária para o fluxo `SZR → SPED156 → portal SEFAZ via Protheus`) continua dependendo da segunda API, ainda em desenvolvimento pela equipe Protheus.

**Na prática:**
- Onda 1 (imediata, ao receber `/cadastroFiscal`): destrava cruzamento e consulta cadastral.
- Onda 2 (quando `/xmlFiscal` destravar): migra NF-e/CT-e do SEFAZ-direto atual para o fluxo via Protheus.

### 2.4. Separação clara Configurador × Fiscal

| Responsabilidade | Local | Motivo |
|---|---|---|
| Gestão do Certificado Digital A1 | **Configurador** | Já existe UI lá (`/configurador/certificado-fiscal`); administração rara, feita pelo T.I., não pelo operador fiscal. O Fiscal **remove** sua tela duplicada. |
| Cadastro de endpoints de integração API (Protheus) | **Configurador** | Já existe como `core.integracoes_api` / `core.integracoes_api_endpoints`. Fiscal passa a **consumir** esse cadastro dinamicamente, em vez de ler `PROTHEUS_API_URL` de env var. |
| Ambiente SEFAZ (PROD/HOM) | **Fiscal** | Toggle operacional exclusivo do Módulo Fiscal. |
| Circuit Breaker por UF | **Fiscal** | Observabilidade operacional do Módulo Fiscal. |
| Agendamentos (corridas 12:00 / 06:00) | **Fiscal** | Operacional do Fiscal. |
| Status da cadeia TLS ICP-Brasil | **Fiscal** | Diagnóstico específico quando mTLS SEFAZ falha. |
| Limites e política de consultas | **Fiscal** | Operacional e documental — tela dedicada com política escrita. |

### 2.5. Proteção 5 camadas contra bloqueio SEFAZ

Ver Seção 6 deste documento. As 5 camadas atuam em conjunto — nenhuma substitui a outra.

### 2.6. Remoção de escopo: "Fila de NFs pendentes de SZR"

Descartado após análise do Setor Fiscal. O caso das 357 NFs em estado anômalo em Mar/2026 é **resíduo de comportamento de uma empresa específica**, não um caso de uso recorrente. O módulo trata NF-e/CT-e **sempre chave a chave, sob demanda**.

---

## 3. Contratos externos

Esta versão **não redefine** os contratos — eles vivem em documentos próprios, versionados separadamente:

| Documento | Versão | Conteúdo | Status |
|---|---|---|---|
| `API – Integração Protheus – Leitura de Cadastros Fiscais.md` | v1 (spec-driven) | Endpoints `/cadastroFiscal` e `/cadastroFiscal?cnpj=` + `/healthcheck`. SQL de referência para SA1010, SA2010 e filtro `comMovimentoDesde`. | **Recebido 17/04/2026.** Destrava Onda 1. |
| `ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` | v2.0 | Especificação original incluindo `/xmlFiscal` (POST grava SZR+SZQ, GET recupera, `/exists` cache check). | Aguardando segunda API do Protheus para Onda 2. |
| `FLUXO_CONSULTA_NFE.md` | v1.0 | Fluxo técnico NF-e. **Precisa atualização** para refletir `SZR → SPED156 → SEFAZ via Protheus` (fluxo definido na memória de 16/04). | Atualização prevista na Onda 2. |
| `FLUXO_CONSULTA_CTE.md` | v1.0 | Fluxo técnico CT-e. Mesma observação. | Atualização prevista na Onda 2. |

---

## 4. Arquitetura dos fluxos

### 4.1. Consulta pontual cadastral (operador)

```
[UI Operação] → informa CNPJ/CPF + UF
      ↓
[fiscal-backend]
   ├─ CccClient.consultarPorCnpj(cnpj, uf, ambiente)   → SEFAZ (situação + IE + CNAE + endereço)
   ├─ ReceitaClient.enriquecer(cnpj)                   → BrasilAPI/ReceitaWS (porte, natureza, capital)
   └─ ProtheusCadastroService.porCnpj(cnpj)            → GET /cadastroFiscal?cnpj=...
                                                          (retorna array: SA1010, SA2010 ou ambos)
      ↓
[UI] exibe:
   ├─ Bloco SEFAZ (situação cadastral, IE, CNAE, endereço)
   ├─ Bloco Receita (porte, natureza jurídica, capital social, data abertura)
   └─ Bloco Vínculo Protheus (Cliente SA1010 / Fornecedor SA2010 / Ambos / Nenhum)
```

Conta: **1 consulta SEFAZ** (CCC) + 1 chamada BrasilAPI + 1 chamada Protheus.

### 4.2. Cruzamento movimento-based (2 corridas/dia)

```
[Scheduler cron 12:00 / 06:00]
      ↓
[ExecucaoService.iniciar(MOVIMENTO_MEIO_DIA ou MOVIMENTO_MANHA_SEGUINTE)]
      ↓
1. GET /cadastroFiscal?tipo=SA1010&ativo=true&comMovimentoDesde=<início_janela>
   GET /cadastroFiscal?tipo=SA2010&ativo=true&comMovimentoDesde=<início_janela>
         → retorna só clientes/fornecedores com movimento no período, todas as filiais
2. Dedup por (cnpj, uf) — mesmo CNPJ em várias NFs = 1 consulta
3. Consulta limite diário (Seção 6) — se passou, aborta com status FALHADA e alerta
4. Enfileira jobs BullMQ (fiscal-cruzamento queue)
      ↓
[CruzamentoWorker × 3 concurrency, respeitando 20 req/min]
      ↓
Para cada CNPJ:
   a. Verifica circuit breaker da UF → se ABERTO, falha o job imediatamente
   b. CccClient.consultarPorCnpj(cnpj, uf, ambiente)
   c. Upsert em fiscal.cadastro_contribuinte
   d. Se situação mudou vs. última leitura → insere fiscal.cadastro_historico
   e. Incrementa contador sucessos / erros
      ↓
[Finalização]
   a. Marca execução CONCLUIDA ou CONCLUIDA_COM_ERROS
   b. Computa resumoMudancas
   c. AlertasService.enviarDigest() → e-mail para GESTOR_FISCAL + ANALISTA_CADASTRO
```

Volume esperado por corrida: ~200–500 CNPJs distintos (após dedup). Dia completo (2 corridas + consultas NF-e/CT-e + pontuais): **~500–1.000 consultas SEFAZ** (estimativa inicial).

### 4.3. Consulta NF-e/CT-e por chave (Onda 2 — aguarda `/xmlFiscal`)

```
[UI] → informa chave de 44 dígitos
      ↓
[fiscal-backend]
1. ProtheusXmlService.exists(chave)         → GET /xmlFiscal/{chave}/exists
      ↓ se TRUE:
2. ProtheusXmlService.getXml(chave)          → GET /xmlFiscal/{chave}
                                                (retorna XML + itens + eventos SPED156)
      ↓ FIM — sem consulta SEFAZ
      ↓ se FALSE:
3. NfeDistribuicaoClient.consultarPorChave() → SEFAZ (pela primeira vez)
4. ProtheusXmlService.post(xml)              → POST /xmlFiscal
                                                (grava SZR010 + SZQ010 + eventos)
5. Devolve XML + parsed para a UI
```

Até a Onda 2 estar pronta, o código permanece chamando SEFAZ direto (como é hoje). Esta é **dívida técnica conhecida** e acompanhada.

---

## 5. Escopo e não-escopo

### 5.1. Escopo do Módulo Fiscal

- Consulta pontual cadastral (CCC + Receita + vínculo Protheus)
- Cruzamento cadastral movimento-based, 2× por dia, dedup por CNPJ
- Consulta NF-e por chave (visualização + DANFE + download XML + timeline de eventos)
- Consulta CT-e por chave (idem, com DACTE)
- Trilha de divergências Protheus ↔ SEFAZ com workflow de tratamento
- Histórico de execuções de cruzamento + digest de alertas por e-mail
- Monitoramento operacional (circuit breaker UF, cadeia TLS, limite diário, ambiente)

### 5.2. Fora de escopo

- Gestão do Certificado A1 → Configurador
- Cadastro de endpoints de integração API → Configurador
- Emissão de qualquer documento fiscal → Protheus
- Cancelamento / carta de correção → Protheus
- Gestão de usuários e filiais → Configurador / Auth Gateway
- Contabilidade, SPED, obrigações acessórias → fora da plataforma
- "Fila" coletiva de NFs pendentes de SZR → descartado (ver 2.6)

---

## 6. Proteção contra bloqueio SEFAZ — 5 camadas

### 6.1. Por que importa

O SEFAZ não publica limite oficial de consultas, mas aplica **monitoramento silencioso por CNPJ**. Consumo acima de ~3.000 consultas/dia começa a atrair atenção; acima de ~5.000 há risco real de bloqueio temporário. O **mesmo certificado** usado para consultar é o usado para emitir NF-e — um bloqueio silencia o faturamento. O risco é operacionalmente inaceitável.

A Capul compartilha o mesmo CNPJ raiz entre todas as filiais. Não há como dividir a quota SEFAZ entre certificados — a identificação é feita exclusivamente pelo CN do certificado (que contém o CNPJ).

### 6.2. As 5 camadas

| # | Camada | Mecanismo | Onde |
|---|---|---|---|
| 1 | **Dedup por CNPJ** | Cruzamento agrupa por CNPJ distinto antes de consultar. Mesmo CNPJ em 30 NFs = 1 consulta. | `ExecucaoService.iniciar()` |
| 2 | **Rate limit por minuto** | Máximo **20 consultas SEFAZ por minuto**. Protege contra rajadas — padrão mais agressivamente detectado pelos monitores SEFAZ. | `ThrottlerModule` (grupo `sefaz`) |
| 3 | **Circuit breaker por UF** | UF com muitos erros recentes é bloqueada por X minutos. Recuperação gradual via estado MEIO_ABERTO. | `CircuitBreakerService` + tabela `fiscal.uf_circuit_state` |
| 4 | **Limite diário global** | **2.000 consultas/dia**. Contadores persistidos; alertas 80%/90%; pausa automática a 100%. | Nova tabela `fiscal.limite_diario` (a criar) |
| 5 | **Freio de mão manual** | `pauseSync` global — Admin T.I. desliga tudo em emergência. | `ambiente_config.pauseSync` |

### 6.3. Política de consultas SEFAZ — texto exposto na UI

Este é o texto que deve aparecer na tela **Operação → Limites e Política de Consultas**, tanto para o Setor Fiscal quanto para a Gestão:

---

> ### Política de consultas SEFAZ — por que existe este limite?
>
> A Plataforma Fiscal consulta os web services das SEFAZ estaduais para validar cadastros de clientes, fornecedores e notas fiscais. Embora o **SEFAZ não publique um limite oficial** de consultas por dia, há consenso no mercado de que consumo acima de **~3.000 consultas diárias por CNPJ** começa a atrair monitoramento automático, podendo levar a *throttling* (redução de velocidade) ou ao **bloqueio temporário** do CNPJ da Capul.
>
> Um bloqueio tem consequência grave: o mesmo certificado digital usado para **consultar** também é usado para **emitir e autorizar NF-e**. Se o SEFAZ bloqueia o CNPJ da Capul por consulta abusiva, **a emissão de notas fiscais também trava** — o faturamento para até o bloqueio ser removido.
>
> Por isso a Plataforma adota uma postura conservadora e aplica **duas barreiras de volume** que funcionam em conjunto:
>
> #### Barreira 1 — Limite diário global: **2.000 consultas/dia**
>
> Valor conservador, cerca de 2× o volume operacional esperado. Cobre:
>
> - Cruzamento cadastral automático (corridas 12:00 e 06:00)
> - Consulta NF-e e CT-e por chave
> - Consulta cadastral pontual (CNPJ / CPF)
>
> #### Barreira 2 — Limite por minuto: **20 consultas/min**
>
> Mesmo estando longe do teto diário, a plataforma nunca envia mais de 20 consultas por minuto ao SEFAZ. Esta barreira evita **rajadas** (picos instantâneos) que são o padrão que mais chama atenção dos sistemas de monitoramento da SEFAZ — um ritmo constante e baixo é muito mais seguro do que volumes concentrados em poucos minutos.
>
> As duas barreiras atuam juntas: o limite diário protege o volume total, o limite por minuto protege o ritmo. Uma não substitui a outra.
>
> ### O que NÃO entra nestes limites
>
> Nenhuma operação de **emissão** de documentos fiscais é contada, pois o SEFAZ trata emissão e consulta como famílias distintas de web services:
>
> - **NF-e** (modelo 55) — emissão e autorização (serviço `nfeAutorizacao4`)
> - **NFC-e** (modelo 65) — emissão e autorização (mesmo serviço `nfeAutorizacao4`)
> - **NFS-e** (Nota Fiscal de Serviço) — é municipal, não usa SEFAZ estadual; totalmente fora do escopo destes limites
> - **Cancelamento** de NF-e / NFC-e e **Carta de Correção** (serviço `nfeRecepcaoEvento`)
> - **Inutilização** de numeração (serviço `nfeInutilizacao4`)
> - Qualquer operação do Protheus relacionada à emissão
>
> Somente **consultas** (distribuição de XML, consulta de protocolo, consulta cadastral) contam para estes limites.
>
> ### Como funciona na prática
>
> - A cada consulta SEFAZ bem-sucedida, o contador do dia aumenta em 1.
> - O limite por minuto é aplicado automaticamente em todas as chamadas — se uma operação precisa de muitas consultas (ex: cruzamento), ela é naturalmente distribuída ao longo do tempo.
> - **80% do diário (1.600 consultas)** — e-mail de atenção para o Gestor Fiscal.
> - **90% do diário (1.800 consultas)** — e-mail crítico para Gestor Fiscal + Admin T.I.
> - **100% do diário (2.000 consultas)** — a plataforma **pausa automaticamente** todas as consultas SEFAZ até 00:00 do dia seguinte. O Admin T.I. pode liberar manualmente em caso de urgência.
> - Consultas em excesso recebem erro "Limite diário atingido. Nova tentativa após 00:00".
> - **O contador zera à meia-noite todos os dias.**
>
> ### Por que não consultar sem limite?
>
> O Setor Fiscal não tem como saber em tempo real se o SEFAZ está monitorando a Capul. O bloqueio é silencioso — quando acontece, já está afetando a emissão. **O custo de um dia parado no faturamento é muito maior do que o benefício de consultar 10% a mais por dia.** Estes limites protegem o faturamento.
>
> ### Como estes valores podem evoluir
>
> Após 30 dias de operação real, o time de T.I. analisa os dados de consumo registrados na plataforma e, se necessário, propõe ao Gestor Fiscal ajuste (para cima ou para baixo) dos dois limites. Os valores iniciais são **intencionalmente conservadores**.

---

### 6.4. Implementação do limite diário

Estrutura proposta:

```prisma
model LimiteDiario {
  id                 Int      @id @default(1)
  limiteDiario       Int      @default(2000)
  alertaAmarelo      Int      @default(1600)   // 80%
  alertaVermelho     Int      @default(1800)   // 90%
  contadorHoje       Int      @default(0)
  dataContador       DateTime @db.Date
  pausadoAutomatico  Boolean  @default(false)
  pausadoEm          DateTime?
  alertasEnviadosHoje Json?                     // { amarelo: bool, vermelho: bool }
  atualizadoEm       DateTime @updatedAt
  atualizadoPor      String?

  @@map("limite_diario")
  @@schema("fiscal")
}
```

- Cron diário 00:05 → zera `contadorHoje`, `pausadoAutomatico`, `alertasEnviadosHoje`, atualiza `dataContador`.
- Interceptor global em todas as chamadas SEFAZ: antes de enviar, verifica `contadorHoje < limiteDiario && !pausadoAutomatico`; senão `throw LimiteDiarioAtingidoException`.
- Após sucesso da chamada SEFAZ: incrementa atomicamente via `UPDATE ... SET contadorHoje = contadorHoje + 1 RETURNING contadorHoje`.
- Hooks de alerta: se contadorHoje passa 1600 e `alertasEnviadosHoje.amarelo = false`, dispara alerta e marca `alertasEnviadosHoje.amarelo = true`. Idem 1800. Em 2000, dispara corte.

---

## 7. Estrutura de menus

### 7.1. Sidebar do Módulo Fiscal

```
🏠 Dashboard

🔎 CONSULTAS
   ├─ NF-e por chave
   ├─ CT-e por chave
   └─ Cadastral (CNPJ/CPF)

🔄 CRUZAMENTO CADASTRAL
   ├─ Execuções
   ├─ Divergências
   └─ Alertas enviados

🛡️ OPERAÇÃO
   ├─ Ambiente (PROD/HOM)
   ├─ Limites e Política de Consultas
   ├─ Circuit Breaker por UF
   ├─ Agendamentos (12:00 / 06:00)
   └─ Status cadeia TLS ICP-Brasil
```

### 7.2. Configurador (itens relacionados ao Fiscal)

```
🏢 EMPRESA
   ├─ Dados da Empresa
   ├─ Filiais
   ├─ Departamentos
   └─ Centros de Custo

🔑 INTEGRAÇÕES
   ├─ APIs (cadastro de endpoints — Protheus, etc.)
   └─ Certificado Fiscal A1   ← usado pelo Módulo Fiscal
```

### 7.3. Rotas frontend-fiscal atualizadas

| Rota | Componente | Role mínima |
|---|---|---|
| `/` | `DashboardPage` | OPERADOR_ENTRADA |
| `/nfe` | `NfeConsultaPage` | OPERADOR_ENTRADA |
| `/cte` | `CteConsultaPage` | OPERADOR_ENTRADA |
| `/cadastro` | `CadastroConsultaPage` | OPERADOR_ENTRADA |
| `/execucoes` | `ExecucoesListPage` | ANALISTA_CADASTRO |
| `/execucoes/:id` | `ExecucaoDetalhePage` | ANALISTA_CADASTRO |
| `/divergencias` | `DivergenciasListPage` *(novo)* | ANALISTA_CADASTRO |
| `/alertas` | `AlertasHistoricoPage` | GESTOR_FISCAL |
| `/operacao/ambiente` | `OperacaoAmbientePage` *(novo, extraído de AdminPage)* | GESTOR_FISCAL |
| `/operacao/limites` | `OperacaoLimitesPage` *(novo — contém a política)* | GESTOR_FISCAL |
| `/operacao/circuit-breaker` | `OperacaoCircuitBreakerPage` *(novo, extraído)* | ANALISTA_CADASTRO |
| `/operacao/agendamentos` | `OperacaoAgendamentosPage` *(novo, extraído)* | GESTOR_FISCAL |
| `/operacao/tls` | `OperacaoTlsPage` *(novo, extraído)* | ADMIN_TI |
| ~~`/admin`~~ | ~~`AdminPage`~~ | Removido — quebrado nas 5 rotas `/operacao/*` |
| ~~`CertificadoAdminPage`~~ | — | Removido — fica só no Configurador |

---

## 8. Mudanças no schema `fiscal`

### 8.1. Enum `TipoSincronizacao`

```prisma
// ANTES
enum TipoSincronizacao {
  BOOTSTRAP
  SEMANAL_AUTO
  DIARIA_AUTO
  DIARIA_MANUAL
  PONTUAL
  COMPLETA_MANUAL
}

// DEPOIS (v2.0)
enum TipoSincronizacao {
  MOVIMENTO_MEIO_DIA        // corrida automática 12:00 (hoje 00:00 → 12:00)
  MOVIMENTO_MANHA_SEGUINTE  // corrida automática 06:00 D+1 (ontem 12:00 → 23:59)
  MANUAL                    // botão "sincronizar agora" (GESTOR_FISCAL)
  PONTUAL                   // 1 CNPJ acionado pela UI
}
```

Migração: não há como mapear 1:1 os valores antigos — as execuções históricas das versões v1.x ficam com valor preservado (migration só altera o enum sem CAST). Em produção o schema ainda não foi aplicado (bloqueador 3 do PROXIMOS_PASSOS_FISCAL.md), então o impacto é baixo.

### 8.2. `AmbienteConfig` — novos campos

```prisma
// ANTES
janelaSemanalCron     String?
janelaDiariaCron      String?

// DEPOIS
cronMovimentoMeioDia      String @default("0 12 * * *")
cronMovimentoManhaSeguinte String @default("0 6 * * *")
```

### 8.3. `CadastroSincronizacao` — campo `filial` reinterpretado

- Hoje: `filial String?` — representava a filial "dona" da sincronização.
- Novo: `filiaisMovimento String[]` — array das filiais que tiveram movimento no período (informativo; o cadastro é global).

### 8.4. Nova tabela `LimiteDiario`

Ver 6.4.

### 8.5. Remoção

- Campo `endereco.numero` removido do payload `ProtheusCadastro` (não está mais no contrato).
- Não há migration no Prisma porque o campo nunca foi persistido — era só transient.

---

## 9. Plano de execução — duas ondas

### Onda 1 — Destravar cadastro (assim que `/cadastroFiscal` entrar no ar)

**Duração estimada:** 3–5 dias úteis.

**Backlog (ordem de execução):**

1. **Backend — cadastro API resolution**
   - Criar `IntegracaoApiResolver` que lê `core.integracoes_api_endpoints` com `operacao='cadastroFiscal'` e ambiente atual.
   - `ProtheusHttpClient` aceita `baseUrl` resolvido no runtime (remove dependência de `PROTHEUS_API_URL` env).
   - `FISCAL_PROTHEUS_MOCK=true` continua como flag de dev local.

2. **Backend — cadastro: trocar mock**
   - `ProtheusCadastroService.listar()` e `.porCnpj()` batendo no endpoint real.
   - Remover parâmetro `filial` dos métodos de cadastro (mantido só no filtro `comMovimentoDesde` se houver).
   - Remover transformação/gravação de `endereco.numero`.
   - Suporte a array no `porCnpj` (SA1010+SA2010 no mesmo CNPJ).

3. **Backend — schema**
   - Migration do enum `TipoSincronizacao`.
   - Migration do `AmbienteConfig` (cron fields).
   - Migration do `LimiteDiario` (nova tabela).
   - Migration do `CadastroSincronizacao.filiaisMovimento`.

4. **Backend — scheduler**
   - Reescrever `SchedulerService` com 2 repeatable jobs: `MOVIMENTO_MEIO_DIA` (cron 12:00) e `MOVIMENTO_MANHA_SEGUINTE` (cron 06:00).
   - Remover jobs `SEMANAL_AUTO` e `DIARIA_AUTO`.

5. **Backend — execução**
   - `ExecucaoService.iniciar()` exige `tipo` novo + `janelaInicio` / `janelaFim`.
   - Dedup por `(cnpj, uf)` antes de enfileirar jobs BullMQ.
   - Pré-check do limite diário: se passou, aborta e alerta.

6. **Backend — limite diário (camada 4)**
   - `LimiteDiarioService` — increment atômico, check, alertas.
   - `LimiteDiarioInterceptor` global em todos os clientes SEFAZ (CCC, NfeDistribuicao, NfeConsultaProtocolo, CteConsultaProtocolo).
   - Cron 00:05 para reset diário.

7. **Backend — certificado (remover duplicidade)**
   - Mantém `/certificado` endpoints (Configurador consome).
   - Nenhuma mudança no schema `fiscal.certificado`.

8. **Frontend — menu e rotas**
   - Renomear seção "Administração" → "Operação".
   - Quebrar `AdminPage` em 5 rotas `/operacao/*`.
   - Remover `CertificadoAdminPage` do fiscal-frontend.
   - Criar `OperacaoLimitesPage` com o texto da política (Seção 6.3) + widget de consumo em tempo real + form de edição (ADMIN_TI).

9. **Frontend — consulta cadastral**
   - Adicionar bloco "Vínculo Protheus" à `CadastroConsultaPage` (cliente / fornecedor / ambos / nenhum).
   - Ajustar tipo `CadastroConsultaResult` para suportar array de cadastros Protheus.

10. **Frontend — divergências**
    - Criar `DivergenciasListPage`: lista `fiscal.cadastro_divergencia` com filtros (criticidade, status, UF) + ações (resolver, ignorar).

11. **Frontend — execuções**
    - Atualizar filtros para novos valores de `TipoSincronizacao`.
    - Exibir `filiaisMovimento[]` (chip list).

12. **Smoke test end-to-end**
    - Consulta pontual CNPJ real → vê SEFAZ + Receita + Protheus.
    - Corrida manual `MANUAL` com janela de 1h → poucos CNPJs, rastreia dedup, incrementa contador diário, gera divergência se houver mudança.
    - Alerta de 80% simulado → e-mail recebido.

### Onda 2 — NF-e/CT-e via Protheus (quando `/xmlFiscal` destravar)

**Duração estimada:** 5–7 dias úteis.

**Backlog:**

1. **Configurador** — cadastrar endpoints `xmlFiscal` (GET exists, GET, POST) em `core.integracoes_api_endpoints`.

2. **Backend** — criar `ProtheusXmlService` que encapsula:
   - `exists(chave)` → GET `/xmlFiscal/{chave}/exists`
   - `getXml(chave)` → GET `/xmlFiscal/{chave}`
   - `post(xml, tipoDocumento)` → POST `/xmlFiscal`

3. **Backend** — refatorar `NfeService.consultarPorChave()` para o fluxo `SZR → SPED156 → SEFAZ via Protheus`:
   - Passo 1: `ProtheusXmlService.getXml(chave)` — se vier XML, retorna direto.
   - Passo 2: se não, fallback para o mesmo endpoint Protheus que faz o download SEFAZ e persiste.
   - Passo 3: `ProtheusXmlService.getEventos(chave)` — lista eventos da SPED156.

4. **Backend** — mesma refatoração para `CteService`.

5. **Backend** — remover chamadas diretas a `NfeDistribuicaoClient`, `CteConsultaProtocoloClient`, `NfeConsultaProtocoloClient`. Elas passam a viver no Protheus (via API).

6. **Backend** — atualizar interceptor de limite diário (continua contando, mas agora são chamadas ao Protheus, não direto ao SEFAZ; a **contagem deve considerar só as que o Protheus encaminhou ao SEFAZ**). Protocolo: o endpoint `xmlFiscal` retorna no payload um header/metadado indicando `origemConsulta` ∈ {PROTHEUS_CACHE, SEFAZ_DOWNLOAD}. Incrementamos o contador só em `SEFAZ_DOWNLOAD`.

7. **Docs** — atualizar `FLUXO_CONSULTA_NFE.md` e `FLUXO_CONSULTA_CTE.md` para refletir o novo fluxo.

8. **Smoke test**:
   - Chave em SZR010 → retorna instantaneamente (cache hit).
   - Chave não em SZR010 → Protheus baixa, grava, retorna; plataforma soma 1 consulta ao contador diário.
   - CT-e mesma lógica.

---

## 10. Bloqueadores conhecidos

| Bloqueador | Ação | Prazo |
|---|---|---|
| **Certificado A1 vence 25/04/2026** | Renovar com a AC, upload novo .pfx no Configurador, ativar | 8 dias |
| **`/xmlFiscal` não implementado pelo Protheus** | Segunda API em desenvolvimento pela equipe Protheus; acompanhar | Sem prazo definido |
| **`FISCAL_PROTHEUS_MOCK=false`** | Só após `/cadastroFiscal` publicado e certificado renovado | Quando 1 e 2 resolverem |

---

## 11. Critérios de aceite por onda

### Onda 1

- [ ] Cadastro por CNPJ retorna vínculo Protheus (SA1/SA2/ambos/nenhum) via API real.
- [ ] Corrida 12:00 rodou em produção com pelo menos 1 CNPJ real, gerando divergência detectada no histórico.
- [ ] Corrida 06:00 rodou na manhã seguinte, sem overlap com 12:00.
- [ ] Dedup comprovado: 1 CNPJ com 5 NFs no bloco = 1 linha no log, 1 consulta contabilizada.
- [ ] Contador diário incrementa a cada consulta e zera à meia-noite.
- [ ] Alerta 80% disparado em simulação e entregue por e-mail.
- [ ] Corte automático a 100% pausa corrida seguinte.
- [ ] Freio de mão manual (`pauseSync`) continua funcionando.
- [ ] Tela `/operacao/limites` exibe o texto da política + consumo em tempo real.
- [ ] `AdminPage` removida; 5 rotas `/operacao/*` funcionando.
- [ ] `CertificadoAdminPage` do fiscal-frontend removida; certificado gerenciado só no Configurador.
- [ ] Divergências visíveis em `/divergencias` com filtros e ações.

### Onda 2

- [ ] Consulta NF-e por chave já em SZR → resposta < 2s, 0 consultas SEFAZ incrementadas.
- [ ] Consulta NF-e por chave não em SZR → Protheus baixa, grava, retorna; 1 consulta SEFAZ incrementada.
- [ ] Consulta CT-e segue o mesmo fluxo.
- [ ] Backend Fiscal não faz mais chamadas diretas ao SEFAZ para NF-e/CT-e (CCC permanece direto).
- [ ] `FLUXO_CONSULTA_NFE.md` e `FLUXO_CONSULTA_CTE.md` atualizados.

---

## 12. Roles e permissões (sem alteração da v1.5)

Os 4 roles do Fiscal permanecem:

| Role | Descrição | Exemplo de uso |
|---|---|---|
| `OPERADOR_ENTRADA` | Operador do dia-a-dia | Consulta cadastral, NF-e, CT-e por chave |
| `ANALISTA_CADASTRO` | Analista do Setor Fiscal | Visualiza execuções, resolve divergências |
| `GESTOR_FISCAL` | Gestor do Setor Fiscal | Aprova ambiente PROD/HOM, vê alertas, dispara MANUAL |
| `ADMIN_TI` | Administrador plataforma | Edita limites, força circuit breaker, pauseSync, gerencia cadeia TLS |

---

## 13. Anexos

### 13.1. Glossário

- **CCC** — Cadastro Centralizado de Contribuintes (`CadConsultaCadastro4`) — web service SEFAZ estadual para validar situação cadastral por CNPJ/CPF + UF.
- **Circuit Breaker** — padrão de resiliência que "abre" automaticamente quando um serviço externo (aqui: uma UF SEFAZ) apresenta muitos erros recentes, evitando cascata de falhas.
- **Dedup** — agrupar entradas repetidas por uma chave (aqui, por CNPJ+UF) antes de processar, para não consultar o mesmo destino várias vezes.
- **mTLS** — mutual TLS; modo em que cliente e servidor validam certificados digitais um do outro. O SEFAZ exige mTLS para serviços fiscais.
- **NFeDistribuicaoDFe** — web service nacional que distribui XML autorizado por chave (único modo permitido à Capul).
- **SPED156** — tabela Protheus (TSS) que armazena eventos SEFAZ (autorização, cancelamento, CC-e, manifestações) associados a chaves NF-e/CT-e.
- **SZR010 / SZQ010** — tabelas customizadas do Protheus CAPUL que armazenam cabeçalho e itens de XMLs de entrada (alimentam customizações de entrada de mercadoria).

### 13.2. Documentos relacionados

- `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` — contrato completo da API Protheus (inclui `xmlFiscal` da Onda 2).
- `API – Integração Protheus – Leitura de Cadastros Fiscais.md` — contrato spec-driven do `/cadastroFiscal` (recebido 17/04).
- `docs/FLUXO_CONSULTA_NFE.md` / `docs/FLUXO_CONSULTA_CTE.md` — fluxos técnicos por documento (atualizar na Onda 2).
- `docs/PROXIMOS_PASSOS_FISCAL.md` — lista operacional dos próximos passos (este plano expande e substitui).
- `fiscal/backend/certs/icp-brasil/README.md` — manutenção da cadeia TLS ICP-Brasil.

---

*Documento ativo. Alterações estruturais requerem nova versão com changelog no topo.*
