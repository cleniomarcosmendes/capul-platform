# Módulo Fiscal — Plataforma Capul

Módulo independente da Plataforma Capul responsável por:

1. **Consulta de NF-e e CT-e** via web services oficiais da SEFAZ (`NFeDistribuicaoDFe`, `CTeDistribuicaoDFe`, `NfeConsultaProtocolo`), com persistência do XML baixado em **SZR010 + SZQ010 do Protheus** (alimentando o monitor de NF-e do ERP).
2. **Consulta cadastral de contribuintes (Sintegra/CCC)** via `CadConsultaCadastro2` por UF.
3. **Cruzamento das tabelas SA1010 (Clientes) + SA2010 (Fornecedores) do Protheus** com a base CCC, produzindo relatório de status fiscal e alertas consolidados via e-mail para a role `GESTOR_FISCAL`.

## Arquitetura

- **Backend**: NestJS 11 + Prisma 6 + TypeScript 5.7, porta `3002`, schema PostgreSQL `fiscal` (com leitura no schema `core`).
- **Frontend**: React 19 + Vite 7 + Tailwind v4, porta `5176` (a ser criado na Etapa 12 da Onda 1).
- **Fila/Scheduler**: BullMQ sobre Redis (já existente na plataforma).
- **HTTP Client Protheus**: `undici` (built-in Node 22), com retry exponencial.
- **E-mail**: nodemailer via SMTP corporativo, destinatários dinâmicos via role `GESTOR_FISCAL`.
- **Certificado**: A1 dedicado (separado do certificado de emissão do Protheus — ver mitigação 11.A do addendum v1.5).

## Status do scaffolding

- [x] Estrutura de diretórios + config (`package.json`, `tsconfig.json`, `Dockerfile`, `nest-cli.json`)
- [x] Prisma schema com todas as tabelas do plano v1.5 (12 tabelas em `fiscal` + leitura em `core`)
- [x] Bootstrap NestJS (`main.ts`, `app.module.ts`, `PrismaService` com extensão read-only para `core`)
- [x] Common (constants, decorators, JWT strategy, FiscalGuard, RolesGuard, AllExceptionsFilter)
- [x] **CryptoModule** — AES-256-GCM com `FISCAL_MASTER_KEY` (aceita base64-32B ou passphrase derivada via scrypt)
- [x] Módulo `protheus/` com interfaces + adapter REAL (undici) + adapter MOCK (toggle por env `FISCAL_PROTHEUS_MOCK`)
- [x] **Etapa 3 — `CertificadoModule` completo**: upload/listagem/ativação/remoção + parser `.pfx` com `node-forge` + extração CNPJ/validade ICP-Brasil + alerta de vencimento < 60 dias + **persistência do binário em `${certsDir}/<id>.pfx` com `chmod 600`** + `CertificadoReaderService`
- [x] **Etapa 4 — `SefazModule` completo**: `SefazAgentService` (mTLS via `https.Agent` com pfx+passphrase, cache 10min), `NfeDistribuicaoClient` (SOAP 1.2 para consulta por chave, gunzip de `docZip`), `NfeConsultaProtocoloClient` (consulta per-UF), `sefaz-endpoints.map.ts` (AN nacional + UFs principais + mapa IBGE)
- [x] **Etapa 5 — `NfeParserService`**: parser NF-e 4.00 com `fast-xml-parser`, estruturado em abas (Dados Gerais, Emitente, Destinatário, Produtos, Totais, Transporte, Cobrança, Eventos) + extração de protocolo
- [x] **Etapa 6 — CT-e completo**: `CteParserService` (modelo 57 + 67, identificação de tomador, carga, componentes de valor, documentos transportados), `CteDistribuicaoClient` (CTeDistribuicaoDFe nacional via mTLS), `CteService` integrado com fluxo espelho do NF-e, endpoints REST + download XML
- [x] **Etapa 7 — `DocumentoConsultaService`**: upsert em `fiscal.documento_consulta` (NF-e e CT-e compartilham via `TipoDocumentoFiscal` enum), histórico por usuário, marcação de status SEFAZ atualizado
- [x] **Etapa 8 — `DanfeGeneratorService`**: DANFE PDF via pdfkit com layout compacto (cabeçalho, protocolo, emitente, destinatário, produtos tabulados, totais, transporte, rodapé). Trocável por `node-danfe-pdf` se exigido layout ENCAT.
- [x] **Etapas 10 + 11 — CCC + Cadastro pontual**: `CccClient` (CadConsultaCadastro4 SOAP per-UF), `CadastroService` com upsert em `fiscal.cadastro_contribuinte`, histórico de mudança de situação, enriquecimento opcional via SA1010/SA2010 do Protheus
- [x] **`NfeService` integrado**: fluxo completo cache Protheus → SEFAZ → grava SZR/SZQ → parser → persistência; botão "Atualizar status no SEFAZ" via NfeConsultaProtocolo; download XML e DANFE PDF
- [x] **Onda 2 prep — `CircuitBreakerService`**: circuit breaker por UF persistido em `fiscal.uf_circuit_state` (FECHADO/MEIO_ABERTO/ABERTO) com threshold 3 erros e 30min de bloqueio, API admin para forçar estado
- [x] **Onda 2 prep — `BullMqModule`**: conexão Redis compartilhada + 3 filas base (`fiscal:cruzamento`, `fiscal:scheduler`, `fiscal:alertas`) prontas para workers da Onda 2
- [x] **Jest fixtures + specs**: `nfe-fixture.xml` + `cte-fixture.xml` de homologação (anonimizados, 2 itens cada, protocolos fake); `nfe-parser.service.spec.ts` (15 asserts cobrindo dados gerais, participantes, produtos, impostos, totais, transporte, cobrança, protocolo, erros de entrada); `cte-parser.service.spec.ts` (8 asserts cobrindo dados gerais, participantes, tomador, valores, carga, documentos, protocolo)
- [x] Fragmento `docker-compose.fiscal.yml` (a mesclar manualmente no `docker-compose.yml` raiz após validação)
- [x] Fragmento `nginx-fiscal.conf` (a mesclar no `nginx/nginx.conf` raiz)
- [x] `INIT_INSTRUCTIONS.md` com SQL para registrar o módulo em `core.modulos_sistema`
- [x] **Etapas 12–15 — Frontend completo (9 páginas)**: Vite 7 + React 19 + Tailwind v4, AuthProvider com refresh-token + timeout inatividade 30min, MainLayout com sidebar agrupada por seção, guards por role, Dockerfile + nginx.conf
  - **Geral**: `DashboardPage` com 4 cards de status + próximas execuções agendadas + últimas 5 execuções inline
  - **Consultas**: `NfeConsultaPage` (abas), `CteConsultaPage` (com DACTE), `CadastroConsultaPage` (UX diferenciada para 3 estados Protheus)
  - **Cruzamento**: `ExecucoesListPage` (tabela com filtros, stat cards, disparos manuais), `ExecucaoDetalhePage` (progresso em tempo real, erros por UF, alertas, reenvio), `AlertasHistoricoPage` (digests com indicador de fallback e erro SMTP)
  - **Administração**: `CertificadoAdminPage` (upload/ativar/remover), `AdminPage` (freio de mão + circuit breaker)
- [x] **Etapa 9 — `DacteGeneratorService`**: DACTE PDF via pdfkit com layout adaptado para CT-e (modalidade, origem/destino, tomador, componentes de valor, carga, documentos transportados). Frontend CteConsultaPage ganhou botão "Baixar DACTE".
- [x] **Onda 2 — Motor de cruzamento completo**:
  - `AlertasModule` — `MailTransportService` (nodemailer com `verify()` no boot), `DestinatariosResolver` (role `GESTOR_FISCAL` dinâmica + cache 5min + fallback `FISCAL_FALLBACK_EMAIL`), `DigestTemplate` (HTML inline-styled + texto plain), `AlertasService` persistindo em `fiscal.alerta_enviado` com flag `fallback`
  - `ExecucaoService` — orquestrador: lê SA1/SA2 paginado via `ProtheusCadastroService`, cria `cadastro_sincronizacao` e `protheus_snapshot`, enfileira 1 job BullMQ por CNPJ no `fiscal:cruzamento`, libera gate `bootstrapConcluidoEm` quando bootstrap termina
  - `CruzamentoWorker` — BullMQ Worker (concurrency=3) que consome `fiscal:cruzamento`: integra `CircuitBreakerService.assertCanRequest()`, respeita freio de mão, chama `CccClient`, upsert em `cadastro_contribuinte`, registra histórico de mudança de situação com vínculo à `sincronizacaoId`, autofinaliza a sincronização quando o último job termina e dispara `AlertasService.enviarDigest()`
  - `SchedulerService` — cron semanal + diário via `@nestjs/schedule` + lib `cron`, padrões lidos de `ambiente_config.janela*Cron`, reagendamento dinâmico via endpoint `POST /cruzamento/scheduler/recarregar`
  - `WatchdogService` — cron horário alertando atrasos (>10 dias para semanal, >36h para diária) com janela de supressão de 6h via `audit_log`
  - `ExpurgoService` — cron noturno às 03:30 (fora da janela de carga diária) aplicando política LGPD da Seção 11.5 (5 anos fiscais / 2 anos operacionais / 90 dias snapshots)
  - `CruzamentoController` — 11 endpoints novos: `POST /cruzamento/sincronizar` (diaria/completa/bootstrap), `GET /cruzamento/execucoes`, `GET /cruzamento/execucoes/:id`, `GET /cruzamento/scheduler/status`, `POST /cruzamento/scheduler/recarregar`, `GET/POST /cruzamento/circuit-breaker[/force]`, `POST /cruzamento/alertas/:id/reenviar`, `GET /cruzamento/alertas/historico`, `DELETE /cruzamento/expurgo`
- [x] **Mapa SEFAZ completo** — `sefaz-endpoints.map.ts` preenchido para todas as 27 UFs: `NFE_CONSULTA_PROTOCOLO` (11 UFs com autorizador próprio + 14 atendidas por SVRS + 2 por SVAN) e `CCC_CAD_CONSULTA_CADASTRO` (9 UFs próprias + 18 SVRS)
- [x] **Endpoint `/health` consolidado** — `HealthController` com verificações independentes: PostgreSQL (`$queryRaw`), Redis (`PING`), SMTP (status do transport verify). Retorna `ok` / `degraded` (SMTP falhou) / `down` (DB ou Redis falhou). Público, pronto para Docker HEALTHCHECK.
- [ ] Implementação real do `ProtheusXmlService` (substituir mock pela chamada real) — após reunião com time Protheus

## Documentação de referência

- **Plano**: `../docs/PLANO_MODULO_FISCAL_v1.4.docx` + `../docs/PLANO_MODULO_FISCAL_v1.5_ADDENDUM.md`
- **Especificação API Protheus**: `../docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` (com Anexo C — dicionário X3 das tabelas SZR010/SZQ010)

## Como rodar localmente

Veja `INIT_INSTRUCTIONS.md` neste diretório.
