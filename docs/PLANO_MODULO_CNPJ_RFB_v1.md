# CAPUL — Cooperativa Agropecuária Unaí Ltda
## Plataforma Capul — Módulo Fiscal · Base Pública CNPJ (RFB Dados Abertos)
### Plano de Implementação v1.0

- **Autor:** Clenio Marcos — Departamento de T.I. · + Claude Code (análise aterrada no código)
- **Data:** 16/05/2026
- **Versão:** 1.0
- **Status:** ✅ Plano aprovado (Clenio, 16/05/2026) — execução **gateada por F0 (disco Postgres PROD)** + PoC de 1 arquivo. NADA implementado.
- **Documento de origem:** `C:\Arquivos-de-projeto\clenio\Plano_Modulo_CNPJ_Capul_v3.docx` (v3 — escrito no Claude Desktop **sem acesso ao código** da plataforma). Este documento o **substitui e aprofunda**: corrige as suposições genéricas com o estado real do módulo Fiscal.
- **Relacionado:** `docs/PLANO_MODULO_FISCAL_v2.0.md` (plano-mestre Fiscal — fonte de verdade), `docs/MELHORIAS_BACKLOG.md` (item "Perfil específico de cliente", 16/05).

---

## Histórico de versões

| Versão | Data | Resumo |
|---|---|---|
| v3 (docx) | 15/05/2026 | Plano original (Claude Desktop). Tese correta (base pública sem certificado), mas trata como **módulo novo standalone**, só SA1010, consulta só por CNPJ, `truncate+insert` no DB compartilhado — por desconhecer o que o Fiscal já tem. |
| **1.0** | **16/05/2026** | **Reescrita aterrada no código.** Decisões travadas com o Clenio: (1) **dentro do Fiscal** (sub-módulo, reusa ~70% do encanamento); (2) núcleo = cruzamento **SA1+SA2** × base local; (3) **schema isolado `rfb` + staging+swap** (não truncate no DB compartilhado); (4) busca por nome/razão social + base local como fonte da Consulta Cadastral; (5) "perfil específico de cliente" → backlog. |

---

## 1. Contexto e o "achado"

O cruzamento cadastral do Fiscal hoje valida clientes/fornecedores (Protheus SA1/SA2) contra a SEFAZ via **CCC com o certificado A1 da CAPUL** (mTLS). Por ser o mesmo certificado que sustenta NF-e/eSocial/eCAC, consultas em volume **podem disparar bloqueio automático na Receita**, derrubando toda a operação fiscal da cooperativa. Por isso o cruzamento atual vive sob **proteção de 5 camadas** (dedup, rate 20 req/min, circuit breaker por UF, limite diário 2.000/dia, freio de mão) e janela semanal — ou seja, é deliberadamente **limitado**.

**O "achado" (Clenio, 16/05/2026):** a Receita Federal publica **mensalmente** a base completa de CNPJ como **dados abertos** — pública, gratuita, **sem certificado**, sem webservice SEFAZ, ~60M de estabelecimentos. Importando essa base **localmente** e cruzando com SA1/SA2, a validação cadastral em massa deixa de depender do certificado: **risco de bloqueio = zero**. Isso **liberta** o cruzamento da limitação atual.

> **Distinção crítica (regra da casa `feedback_sefaz_nunca_em_loop`):** a regra "nunca SEFAZ em loop" trata de **webservices SEFAZ com o certificado A1** (CCC/Sintegra/distNSU). Este módulo **não toca certificado nem webservice SEFAZ**. A única chamada externa automática é um `HTTP HEAD` semanal num **servidor de arquivos estáticos público** (`arquivos.receitafederal.gov.br/.../dados_abertos_cnpj/`) — apenas para detectar se há nova versão. Classe de risco distinta e benigna. Nenhuma transmissão, manifestação ou escrita é feita. O Protheus continua dono de toda operação fiscal.

**Os dois trilhos coexistem (não se substituem):**

| Trilho | Para quê | Risco |
|---|---|---|
| Cruzamento atual (certificado, movimento-based, supervisionado) | Validação tempo-real dentro da janela de cancelamento NF-e | Alto em volume — **mantido como está** |
| Base pública RFB (este plano) | Validação cadastral **em massa** + exploração estratégica | **Zero** |

---

## 2. O que JÁ existe no Fiscal (mapa de reuso — ~70% do encanamento)

Levantamento no código (`fiscal/backend/src`, `fiscal/frontend/src`, `configurador/src`):

| Recurso | Estado | Localização |
|---|---|---|
| Integração Protheus **SA1010 (clientes) + SA2010 (fornecedores)** | ✅ pronto | `protheus/protheus-cadastro.service.ts` (`listar`, `porCnpj`) + `protheus/integracao-api.resolver.ts` (resolve via Configurador `core.integracoes_api_endpoints`, op. `cadastroFiscal`) |
| Consulta Cadastral pontual (CC) | ✅ pronto | `cadastro/cadastro.controller.ts` + `cadastro/cadastro.service.ts` — hoje 3 fontes em paralelo: SEFAZ CCC (cert) · Receita Federal API online (`cadastro/receita.client.ts`, BrasilAPI→ReceitaWS, cache 24h) · Protheus SA1/SA2 |
| Cruzamento Protheus↔SEFAZ + histórico + divergências | ✅ pronto | `cadastro.service.ts`; models `CadastroContribuinte`, `CadastroHistorico`, `CadastroDivergencia`, `CadastroSincronizacao`, `ProtheusSnapshot` |
| Job supervisionado (scheduler 2 crons, BullMQ, circuit breaker UF, dedup, janela semanal, freio de mão) | ✅ pronto | `cruzamento/scheduler.service.ts`, `cruzamento/execucao.service.ts`, `cruzamento/circuit-breaker.service.ts` |
| Proteção 5 camadas + tela operacional | ✅ pronto | `LimiteDiario`/`UfCircuitState`; `fiscal/frontend/.../operacao/tabs/{Limites,Agendamentos,CircuitBreaker}Tab.tsx` |
| Padrão Configurador p/ integração+histórico | ✅ pronto | `configurador/src/pages/integracoes/IntegracoesPage.tsx` |
| **Base pública RFB CNPJ + ETL CSV/ZIP + tabelas `rfb_*`** | ❌ **não existe** | — **(o genuinamente novo)** |
| **Busca por nome/razão social na base** | ❌ não existe | — (só viável com base local) |

**Implicação:** este módulo **não recria** integração Protheus, auth, Configurador, scheduler nem proteção. Reaproveita tudo. O novo é a **base RFB local** + a **camada de exploração**.

---

## 3. Decisões travadas (16/05) e correções ao doc v3

| # | Doc v3 dizia | Decisão v1.0 |
|---|---|---|
| 1 | Módulo novo standalone `cnpj` | **Sub-módulo dentro do Fiscal** (`fiscal/backend/src/rfb-base/`). Só para o Fiscal por ora. |
| 2 | Cruzamento só SA1010 | **SA1010 (clientes) + SA2010 (fornecedores)** — endpoint Protheus já cobre ambos. |
| 3 | Consulta só por CNPJ | **+ busca por nome/razão social** e exploração (camada estratégica). |
| 4 | `truncate + insert` no DB compartilhado | **Schema isolado `rfb` + staging + swap atômico** (zero downtime, churn isolado). |
| 5 | Cron/import em tela própria | **Padrão Configurador + `/operacao`** (regra `feedback_funcionalidade_visivel_no_configurador` — sem caixa-preta). |
| 6 | "Perfil específico de cliente" no escopo | → **Backlog** (`docs/MELHORIAS_BACKLOG.md`, 16/05), após o núcleo. |

---

## 4. Arquitetura — onde mora

Sub-módulo no backend Fiscal e abas no frontend Fiscal/Configurador:

```
fiscal/backend/src/
  rfb-base/
    rfb-base.module.ts
    importacao/
      verificacao.service.ts     # Cron semanal: HEAD na RFB, grava flag (DISPONIVEL)
      importacao.service.ts       # download + parse ISO-8859-1 (streaming) + carga staging + swap
      importacao.controller.ts    # disparo manual (T.I.) + progresso ao vivo
    consulta/
      rfb-consulta.service.ts     # busca por CNPJ / nome / razão / facetas
      rfb-consulta.controller.ts
  cadastro/                       # EXISTENTE — ganha base local como fonte (Fase 2)
  cruzamento/                     # EXISTENTE — ganha cruzamento massa × RFB local (Fase 1)

fiscal/frontend/src/pages/
  operacao/tabs/                  # EXISTENTE — nova aba "Base RFB" (status/import/log)
  inteligencia-cadastral/         # NOVO (Fase 3) — exploração SA1+SA2 × RFB

configurador/src/pages/integracoes/  # EXISTENTE — config da fonte RFB (URL base, cron) + histórico
```

Migrations entram pelo init job **`fiscal-migrate`** (padrão `project-init-jobs-migrate`).

---

## 5. Estratégia de dado (recomendação — Clenio delegou)

**Schema isolado `rfb` no banco `capul_platform` + carga em staging + swap atômico. Só tabelas essenciais.**

- **Schema próprio `rfb`:** isola fisicamente a base (60M linhas) do schema `fiscal` e dos demais módulos. O datasource Prisma do Fiscal já é multi-schema (`fiscal` + `core` read-only) — adiciona-se `rfb`.
- **Staging + swap (não `truncate` na tabela viva):** a importação carrega `rfb.estabelecimentos_staging`; ao concluir, faz swap atômico (rename/`ALTER TABLE ... RENAME` em transação) → zero downtime, sem janela de tabela vazia, churn/vacuum isolado dos outros módulos. Supera o "truncate+insert" do doc v3.
- **Só tabelas essenciais (fase 1):** Estabelecimentos, Empresas, Simples + domínios (CNAE, Município, Natureza Jurídica). **Sócios fica fora** (é o maior volume e não serve o núcleo).
- **Footprint:** muito menor que os ~85GB "crus" (CSV transitório). Em banco, só campos essenciais + índices (`cnpjCompleto`, `situacaoCadastral`, `razaoSocial`/`nomeFantasia` para busca textual).
- **Por que base completa e não só a interseção com SA1/SA2:** o join é trivial e rápido com índice; a base completa já entrega de graça a busca por nome/razão e a consulta pontual de CNPJ que não temos; manter um subconjunto filtrado dá *mais* manutenção (re-filtrar quando o cadastro muda).

> **Pré-requisito externo (não bloqueia planejar; bloqueia executar a Fase 1):** confirmar disco livre do Postgres de produção. O job de importação terá **pré-check de disco como gate** — recusa iniciar se o espaço livre for menor que o necessário (CSV transitório + tabela + índices + staging). Número exato dimensionado na F0 com a folga real.

---

## 6. Schema Prisma proposto (schema `rfb`)

```prisma
// datasource: schemas = ["fiscal", "core", "rfb"]

model RfbEstabelecimento {
  id                  BigInt  @id @default(autoincrement())
  cnpjBasico          String  @db.VarChar(8)
  cnpjOrdem           String  @db.VarChar(4)
  cnpjDv              String  @db.VarChar(2)
  cnpjCompleto        String  @db.VarChar(14)
  matrizFilial        String? @db.VarChar(1)
  nomeFantasia        String? @db.VarChar(120)
  situacaoCadastral   String? @db.VarChar(2)   // 2 ATIVA · 3 SUSPENSA · 4 INAPTA · 8 BAIXADA · 1 NULA
  dataSituacao        String? @db.VarChar(8)
  cnaeFiscalPrincipal String? @db.VarChar(7)
  logradouro          String? @db.VarChar(120)
  numero              String? @db.VarChar(10)
  bairro              String? @db.VarChar(60)
  cep                 String? @db.VarChar(8)
  uf                  String? @db.VarChar(2)
  municipio           String? @db.VarChar(4)
  ddd1                String? @db.VarChar(4)
  telefone1           String? @db.VarChar(12)
  correioEletronico   String? @db.VarChar(120)
  @@index([cnpjCompleto])
  @@index([situacaoCadastral])
  @@index([uf, municipio])
  @@index([cnaeFiscalPrincipal])
  // índice de busca textual (nomeFantasia / razão via join) — pg_trgm na migration
  @@map("estabelecimentos")
  @@schema("rfb")
}

model RfbEmpresa {
  cnpjBasico        String  @id @db.VarChar(8)
  razaoSocial       String? @db.VarChar(200)
  naturezaJuridica  String? @db.VarChar(4)
  porte             String? @db.VarChar(2)
  capitalSocial     Decimal? @db.Decimal(18,2)
  @@index([razaoSocial])
  @@map("empresas")
  @@schema("rfb")
}

model RfbSimples {
  cnpjBasico       String  @id @db.VarChar(8)
  optanteSimples   String? @db.VarChar(1)
  dataOpcaoSimples String? @db.VarChar(8)
  optanteMei       String? @db.VarChar(1)
  @@map("simples")
  @@schema("rfb")
}

model RfbCnae        { codigo String @id @db.VarChar(7); descricao String  @map("descricao"); @@map("cnaes")            @@schema("rfb") }
model RfbMunicipio   { codigo String @id @db.VarChar(4); descricao String  @map("descricao"); @@map("municipios")       @@schema("rfb") }
model RfbNatureza    { codigo String @id @db.VarChar(4); descricao String  @map("descricao"); @@map("naturezas")        @@schema("rfb") }

model RfbControleImportacao {
  id             Int       @id @default(autoincrement())
  versaoRfb      String    @unique          // ex: '2026-05'
  status         String                     // DISPONIVEL | IMPORTANDO | CONCLUIDO | ERRO
  dataDeteccao   DateTime?
  dataInicio     DateTime?
  dataFim        DateTime?
  totalRegistros BigInt?
  disparadoPor   String?                    // userId T.I. (importação é sempre manual)
  observacao     String?
  @@map("controle_importacao")
  @@schema("rfb")
}
```

> Decimal/BigInt e larguras ampliadas vs. o doc v3 (defensivo contra dados sujos da RFB). Índice `pg_trgm` em `razaoSocial`/`nomeFantasia` criado via SQL na migration (busca por nome rápida).

---

## 7. ETL — importação supervisionada (padrão "Windows Update")

**Detecção automática · Importação SEMPRE manual pela T.I.** (ninguém processa 60M sem decisão consciente).

1. **Cron de detecção** (`verificacao.service.ts`): semanal (ex.: seg 07:00). `HEAD` na URL da próxima versão (`.../dados_abertos_cnpj/AAAA-MM/`). HTTP 200 → grava `RfbControleImportacao{status:DISPONIVEL}`. *(HEAD em servidor estático público — fora da regra SEFAZ.)*
2. **Notificação:** banner na UI Fiscal para perfil T.I. enquanto houver versão `DISPONIVEL` não importada (estados: amarelo disponível → azul importando %→ verde concluído → vermelho erro).
3. **Disparo manual:** T.I. clica "Importar agora" (banner ou aba Operação → Base RFB). **Gate de pré-check de disco** antes de baixar.
4. **Importação** (`importacao.service.ts`): download dos `.zip` → extração → parse **streaming em chunks** (10k linhas) com **conversão ISO-8859-1→UTF-8** (`iconv-lite`), mapeando colunas **por posição** (CSV sem cabeçalho, `;`) conforme metadados RFB → carrega `*_staging`.
5. **Swap atômico:** ao concluir todas as tabelas, transação que troca staging↔produção (rename). Falha em qualquer etapa = staging descartado, base atual intacta.
6. **Histórico:** cada importação gravada em `RfbControleImportacao` (versão, quem, quando, total, erro).
7. **Configurador:** URL base da RFB + agenda do cron + última versão importada são **configuráveis e visíveis no Configurador** com histórico (regra `feedback_funcionalidade_visivel_no_configurador`) — nada de cron silencioso.

**Atenção infra:** o parse deve ser **streaming** (jamais carregar 85GB em memória); o processo/worker de import precisa de limites de container adequados (os backends têm `mem_limit` apertado — a importação roda como job dedicado, não no request path).

---

## 8. Cruzamento em massa SA1+SA2 × RFB local (núcleo — o "achado")

`cruzamento` ganha um modo **massa sem certificado**:

1. Carrega base Protheus via endpoint existente `cadastroFiscal` (SA1010 **e** SA2010, paginado).
2. Normaliza CNPJ (remove máscara).
3. `JOIN` local `rfb.estabelecimentos` (zero chamada externa, zero risco).
4. Gera alertas por situação: **4 INAPTA / 8 BAIXADA → vermelho**, **3 SUSPENSA → amarelo**, **1 NULA → cinza**, **2 ATIVA → ok**. Enriquecimento: Simples/MEI, divergência de endereço/e-mail Protheus↔RFB.
5. Reaproveita `CadastroDivergencia`/`CadastroHistorico` já existentes → **detecção de mudança mês-a-mês** entre snapshots (ex.: "fornecedor X virou INAPTO neste snapshot"), não só foto estática.

Casos de uso (compliance): clientes/fornecedores INAPTO/BAIXADO; CNPJ SUSPENSO com título a pagar; divergência cadastral Protheus×RFB; fornecedor optante Simples (classificação fiscal).

---

## 9. Consulta Cadastral (CC) com base local como fonte

A CC existente (`cadastro.service.ts`) consulta 3 fontes em paralelo. **Adiciona-se a base RFB local como fonte primária** do enriquecimento cadastral; a Receita online (BrasilAPI/ReceitaWS) vira **fallback** (só para CNPJ ausente da base local — ex.: aberto após o último snapshot). Ganhos: resposta instantânea, sem rate-limit de terceiros, funciona com a API online fora. Ponto de integração pequeno (o slot de enriquecimento já existe). Cobre **SA1 e SA2**.

---

## 10. Inteligência Cadastral — o frontend "muito intuitivo" (Fase 3)

Painel exploratório sobre **SA1+SA2 × RFB** — não só listas de irregulares, mas exploração estruturada de todo o cadastro:

```
┌──────────────────────────────────────────────────────────────┐
│  Inteligência Cadastral            [ Exportar Excel ]  [ �myUF ]│
│  ┌─ Busca ──────────────────────────────────────────────────┐ │
│  │ 🔎 nome / razão social / CNPJ ...                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│  Facetas:  Situação ▾  CNAE ▾  Porte ▾  UF ▾  Simples ▾       │
│  ┌─ Resumo ─────────────────────────────────────────────────┐ │
│  │  ● 2.143 ATIVA   ● 87 SUSPENSA   ● 31 INAPTA   ● 12 BAIX. │ │
│  │  Clientes 1.604 · Fornecedores 681 · Ambos 18            │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌─ Resultado (drill-down) ─────────────────────────────────┐ │
│  │ Razão social      CNPJ          Situação  Origem  Δ mês  │ │
│  │ ACME LTDA         12.../0001..  🔴 INAPTA  SA2     ↓novo  │ │
│  │ BETA COM          98.../0001..  🟢 ATIVA   SA1     —      │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Características: busca textual (nome/razão), facetas combináveis, resumo agregado, drill-down ao detalhe (reusa a tela de CC), coluna "Δ mês" (mudança desde o último snapshot), export. Base para estratégia comercial/compliance recorrente.

---

## 11. Pontos de atenção técnicos

| Ponto | Tratamento |
|---|---|
| Encoding ISO-8859-1 | `iconv-lite` no stream antes de inserir |
| CSV sem cabeçalho, `;` | Mapear por posição conforme metadados RFB (apêndice) |
| CNPJ mascarado no Protheus | Normalizar (`replace`) antes do join |
| Volume no DB compartilhado | Schema `rfb` isolado + staging+swap (§5) |
| Disco | Pré-check como **gate** no job; só tabelas essenciais; sem Sócios |
| Memória | Parse streaming em chunks; job dedicado (não request path) |
| Snapshot mensal não-incremental | Swap substitui; mudança mês-a-mês via `CadastroHistorico` |
| HEAD na RFB | Testar antes (robots/firewall); semanal; servidor estático (não SEFAZ) |
| API Protheus SA1/SA2 | **Já existe** (`cadastroFiscal`) — sem dependência nova |

---

## 12. Faseamento e estimativa

| Fase | Entrega | Estimativa* |
|---|---|---|
| **F0** | Confirmar disco Postgres PROD + dimensionar números reais | ~1-2h (externo) |
| **F1 — Núcleo** | Schema `rfb` + migration (init job) + ETL streaming + staging/swap + detecção HEAD + import manual supervisionado (Configurador/operacao) + cruzamento massa SA1+SA2×RFB | ~30-45h (fase pesada) |
| **F2 — CC turbinada** | Base local como fonte primária da Consulta Cadastral (SA1+SA2), online=fallback | ~6-10h |
| **F3 — Inteligência Cadastral** | Frontend exploratório (facetas, busca nome/razão, drill-down, export, Δ mês) | ~20-30h |
| **F4 — Backlog** | "Perfil específico de cliente" (segmentações salvas + alerta de mudança) | ver backlog |

\* Estimativas grosseiras pré-implementação; refinar após F0 com número real de disco/volume e prova de conceito do ETL num subconjunto.

**Estratégia de release** (padrão `project-estrategia-release-05mai`): dev local → HOM → soak → PROD com flag `FISCAL_RFB_BASE_ENABLED` default false em PROD. Primeira importação completa em HOM antes de PROD.

---

## 13. Pré-requisitos e itens em aberto

1. **F0 — disco do Postgres PROD** (Clenio/Douglas): folga livre real → dimensiona footprint e o gate do job.
2. Validar `HEAD` na URL RFB a partir do servidor (robots/firewall corporativo).
3. Confirmar layout/posições das colunas com os **metadados oficiais RFB** (link no apêndice) na implementação da F1.
4. Decidir agenda exata do cron de detecção (sugestão: seg 07:00, fora de horário de pico).
5. Definir perfis/roles que enxergam a Inteligência Cadastral (provável GESTOR_FISCAL + ADMIN_TI; alinhar com o RBAC do Fiscal).

---

## 14. Próximos passos

1. Clenio aprova / ajusta este plano.
2. F0: número de disco PROD.
3. Prova de conceito do ETL com **1 arquivo** (`Estabelecimentos0.zip`) num schema `rfb` de DEV — valida encoding, mapeamento por posição, tempo e footprint reais antes de comprometer a F1 inteira.
4. Plano formal vira execução faseada (branch dedicada, migrations via `fiscal-migrate`, flag de release).

---

## Apêndice — Fonte e referências

- Download oficial RFB: `https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/` (partição `AAAA-MM/`)
- Metadados (layout das colunas): `https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf`
- Mirror (Casa dos Dados): `https://dados-abertos-rf-cnpj.casadosdados.com.br/`
- Situação cadastral: `2` ATIVA · `3` SUSPENSA · `4` INAPTA · `8` BAIXADA · `1` NULA
- Volume RFB: ~20GB zip / ~85GB CSV / ~60M estabelecimentos / publicação mensal (1ª semana)
- Memória interna: `project-fiscal-cnpj-base-publica` (ponto de entrada), `feedback-sefaz-nunca-em-loop`, `feedback-funcionalidade-visivel-no-configurador`, `integracoes-api-30mar2026`

---

*Plataforma Capul — Gerência de T.I. — Unaí, MG — v1.0 — 16/05/2026 — NADA implementado (plano proposto).*
