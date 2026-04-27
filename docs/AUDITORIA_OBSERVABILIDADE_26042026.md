# Auditoria Observabilidade — Capul Platform — 26/04/2026

**Modo:** profunda (foco em logs estruturados, métricas, alertas, tracing)
**Versão do prompt:** 1.1 (`docs/PROMPT_AUDITORIA_PLATAFORMA.md`)
**Cenário:** plataforma exposta publicamente; 13 containers; 4 backends (3 NestJS + 1 FastAPI)

---

## Sumário Executivo

| Métrica | Valor |
|---|---:|
| Achados **críticos** | **1** |
| Achados altos | **5** |
| Achados médios | **3** |
| Achados baixos | **2** |
| Pontos fortes | 7 |
| **Esforço total estimado** | **~12-18h** |

### Quick Wins

1. **#1 — Configurar rotação de logs Docker** (~15min, fecha único crítico)
2. **#2 — Migrar para logger JSON** (`nestjs-pino` nos 3 backends + dictConfig no FastAPI) — ~2-3h, libera todo o resto
3. **#10 — Reaproveitar webhook do backup pra alertas de erro** — ~30min

### Pontos fortes identificados

- ✅ Healthchecks 13/13 (auditoria 25/04 #6)
- ✅ NestJS Logger consistente nos 3 backends + `Logger` instanciado por classe
- ✅ Throttler global + Nginx rate-limit (ambos retornam 429 visível)
- ✅ Webhook + e-mail já integrados no Backup (estrutura pra reusar)
- ✅ Fiscal `/health` retorna 3 estados (`ok | degraded | down`) com componentes detalhados
- ✅ `journalctl` cobre tudo do host (systemd timers já documentados em Backup/DR)
- ✅ Auth-gateway tem `audit_log` (tabela `core.audit_logs`) registrando ações sensíveis

---

## Achados Críticos

### Achado #1 — Logs Docker sem rotação → disco vai encher

- **Dimensão:** 6 — Observabilidade / 7 — Infraestrutura
- **Severidade:** **Crítico** (em produção pública, único caminho pra negar serviço silencioso)
- **Localização:** `docker-compose.yml` — todos os 13 services usam driver `json-file` default sem `max-size`/`max-file`
- **Descrição:** Docker grava logs em `/var/lib/docker/containers/<id>/<id>-json.log` indefinidamente. Em prod com volume real (logins, requisições API, jobs Fiscal), o disco enche em semanas/meses sem aviso.
- **Por que é problema:** disco cheio = postgres não escreve → DB read-only → app fora. E recovery exige rotação manual em emergência.
- **Evidência:**
  ```
  $ docker inspect capul-auth --format '{{.HostConfig.LogConfig}}'
  {json-file map[]}
  ```
  Sem `max-size` configurado.

#### Plano de Correção

1. **Pré-requisitos:** nenhum. Mudança de configuração.
2. **Passos concretos** — adicionar bloco de logging no `docker-compose.yml`. Pode ser em cada service ou via default na CLI:

   **Opção A — global no compose (melhor):** adicionar em CADA service:
   ```yaml
   logging:
     driver: json-file
     options:
       max-size: "50m"      # 50MB por arquivo
       max-file: "5"        # mantém 5 arquivos rotacionados
       compress: "true"     # comprime arquivos antigos
   ```
   Total por container: ~250MB de logs (50MB × 5). 13 containers × 250MB = **~3.25GB max** vs hoje **ilimitado**.

   **Opção B — daemon-wide** (afeta TODOS containers do host, simples):
   ```bash
   sudo tee /etc/docker/daemon.json <<EOF
   {
     "log-driver": "json-file",
     "log-opts": { "max-size": "50m", "max-file": "5", "compress": "true" }
   }
   EOF
   sudo systemctl restart docker
   ```
   ⚠️ Reinicia Docker — agendar janela.

   **Recomendação: Opção A** — explícita por container, sem reiniciar Docker.

3. **Critério de validação:**
   ```bash
   docker inspect capul-auth --format '{{json .HostConfig.LogConfig}}'
   # Esperado: {"Type":"json-file","Config":{"max-size":"50m","max-file":"5","compress":"true"}}
   ```
   E após uns dias: `du -sh /var/lib/docker/containers/*/` se mantém < 250MB por container.

4. **Estimativa:** **trivial (~15min)** Quick Win
5. **Riscos:** logs antigos perdidos (esperado — atualmente não há retenção planejada). Pra preservar, exportar antes via `docker compose logs --since 30d <service> > backup.log`.
6. **Quem executa:** DevOps

---

## Achados Altos

### Achado #2 — Logs em **texto plano**, não JSON (impossível parsear/agregar)

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto**
- **Localização:** todos os 4 backends — NestJS Logger default (Pino/Winston ausentes nos 3 NestJS) + `logging.basicConfig(level=INFO)` no inventário
- **Descrição:** logs saem assim:
  ```
  [Nest] 1  - 04/26/2026, 7:58:20 PM     LOG [RouterExplorer] Mapped {/api/v1/core/...} route +1ms
  ```
  Para parsear (filtrar por nível, módulo, tempo), tem que escrever regex frágil. Agregação em ferramentas (Loki, ELK, CloudWatch) **exige JSON**.
- **Por que é problema:** quando precisar investigar um incidente em prod ("qual usuário fez X às 14:32?"), só sobra `grep | awk` em arquivo. Não escala.

#### Plano de Correção

1. **Pré-requisitos:** decisão entre Pino (mais rápido) ou Winston (mais features). Recomendo **Pino** + `nestjs-pino` (padrão de fato em NestJS produção).
2. **Passos concretos:**

   ```bash
   # Em cada um dos 3 backends NestJS:
   cd auth-gateway && npm i nestjs-pino pino pino-http && cd ..
   cd gestao-ti/backend && npm i nestjs-pino pino pino-http && cd ../..
   cd fiscal/backend && npm i nestjs-pino pino pino-http && cd ../..
   ```

   Em `app.module.ts` de cada um:
   ```typescript
   import { LoggerModule } from 'nestjs-pino';

   @Module({
     imports: [
       LoggerModule.forRoot({
         pinoHttp: {
           level: process.env.LOG_LEVEL || 'info',
           transport: process.env.NODE_ENV !== 'production'
             ? { target: 'pino-pretty', options: { singleLine: true } }
             : undefined,  // produção: JSON puro
           redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.senha'],
           customProps: () => ({ service: 'auth-gateway' }),  // identifica service na agregação
         },
       }),
       // ... resto
     ],
   })
   ```

   Em `main.ts`:
   ```typescript
   import { Logger } from 'nestjs-pino';
   const app = await NestFactory.create(AppModule, { bufferLogs: true });
   app.useLogger(app.get(Logger));
   ```

   **Inventário FastAPI** — substituir `logging.basicConfig` por `dictConfig` JSON (~30 linhas, padrão Python):
   ```python
   import logging.config, json, sys
   logging.config.dictConfig({
       'version': 1,
       'formatters': {
           'json': {
               '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
               'format': '%(asctime)s %(name)s %(levelname)s %(message)s',
           }
       },
       'handlers': {
           'console': {'class': 'logging.StreamHandler', 'formatter': 'json', 'stream': sys.stdout}
       },
       'root': {'level': os.getenv('LOG_LEVEL', 'INFO'), 'handlers': ['console']},
   })
   ```
   `pip install python-json-logger`.

3. **Critério de validação:** `docker compose logs auth-gateway | tail -1 | jq .` retorna objeto JSON válido (não erro de parse).

4. **Estimativa:** **moderado (~3h)** — 3 backends NestJS + 1 FastAPI + testar smoke + ajustar redact list
5. **Riscos:** mudança de formato — qualquer ferramenta downstream que dependa do formato atual quebra (não há nenhuma hoje, baixo risco)
6. **Quem executa:** backend dev

---

### Achado #3 — Sem **error tracking** (Sentry / Rollbar / GlitchTip)

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto**
- **Descrição:** quando uma exception é jogada em produção, ela vai pro `journalctl` ou Docker log. Ninguém é avisado. Pode passar **dias** sem ninguém perceber que um endpoint específico está quebrado pra subset de usuários.
- **Por que é problema:** plataforma pública = usuários encontram bugs primeiro. Sem error tracking, dependemos do usuário reportar — muito tarde, e ele já saiu chateado.

#### Plano de Correção

1. **Pré-requisitos:** decisão entre Sentry (paid após volume baixo) ou GlitchTip (open-source self-hostable) ou Rollbar.
2. **Recomendado:** **GlitchTip** self-hostable — compatível com SDK do Sentry, sem custos, roda num container.
3. **Passos concretos:**
   - Adicionar service `glitchtip` no `docker-compose.yml` (imagem oficial)
   - Em cada backend NestJS: `npm i @sentry/node` + interceptor global + DSN no `.env`
   - Inventário: `pip install sentry-sdk` + `init` no `main.py`
4. **Critério de validação:** lançar `throw new Error('teste sentry')` num endpoint protegido → erro aparece no painel GlitchTip
5. **Estimativa:** **moderado (~3h)** — 1h infra + 2h integrações
6. **Quem executa:** DevOps + backend dev

---

### Achado #4 — Sem **métricas** (latência, throughput, taxa de erro)

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto**
- **Descrição:** healthcheck só responde **binário** (saudável / não saudável). Não temos:
  - Latência p50/p95/p99 dos endpoints
  - Requests/segundo por endpoint
  - Taxa de erro 5xx
  - Latência de query DB
  - Tamanho da fila BullMQ Fiscal
- **Por que é problema:** quando user reclama "tá lento", não temos como saber **onde**. Endpoint específico? DB? SEFAZ? Frontend?

#### Plano de Correção

1. **Pré-requisitos:** decisão de stack — opções: **Prometheus + Grafana** (auto-hospedado, mais comum) ou **OpenTelemetry → Grafana Cloud** (gerenciado, free tier generoso).
2. **Recomendado:** Prometheus + Grafana self-hosted (alinha com filosofia "tudo no Configurador" — métricas locais, não no cloud)
3. **Passos concretos:**
   - Backends NestJS: `npm i @willsoto/nestjs-prometheus prom-client` → expõe `/metrics`
   - FastAPI: `pip install prometheus-fastapi-instrumentator` → expõe `/metrics`
   - Adicionar 2 services no compose: `prometheus` + `grafana`
   - Configurar Prometheus pra scrape dos 4 backends
   - Importar dashboards prontos do Grafana (NestJS, PostgreSQL, Redis)
4. **Estimativa:** **moderado (~4h)**
5. **Quem executa:** DevOps

---

### Achado #5 — Sem **correlation ID** entre serviços

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto**
- **Descrição:** quando uma request passa por múltiplos backends (ex: usuário faz upload → gestao-ti-backend → auth-gateway pra validar JWT → postgres), não há um ID único pra rastrear toda a cadeia nos logs.
- **Por que é problema:** debug de fluxos cross-service vira arqueologia em logs separados.

#### Plano de Correção

1. **Pré-requisitos:** Achado #2 implementado (Pino) — mais simples integrar
2. **Passos concretos:**
   - Nginx: adicionar header `X-Request-ID $request_id` no proxy_pass
   - NestJS Pino: já tem suporte nativo a `req.id` — só ativar `genReqId: () => req.headers['x-request-id'] || randomUUID()`
   - FastAPI: middleware lendo `X-Request-ID` ou gerando, propaga em logs
3. **Estimativa:** **trivial (~1h)** — uma vez Pino estiver lá
4. **Quem executa:** backend dev

---

### Achado #6 — Logs **não centralizados** entre containers

- **Dimensão:** 6 — Observabilidade
- **Severidade:** **Alto**
- **Descrição:** `docker compose logs <service>` precisa ser rodado por service. Pra investigar um incidente que cruza serviços, é dor.
- **Por que é problema:** debug é manual, lento, exige SSH. Não escala em produção.

#### Plano de Correção

1. **Recomendado:** **Loki** (Grafana — par natural do Prometheus do Achado #4) com **Promtail** coletando dos volumes Docker
2. **Passos concretos:**
   - Adicionar 2 services no compose: `loki` + `promtail`
   - Promtail monta `/var/lib/docker/containers` → lê todos os JSON logs → manda pra Loki
   - Grafana já consome Loki como datasource (mesma stack do #4)
3. **Estimativa:** **moderado (~2h)**
4. **Risco:** consumo de RAM (Loki ~200MB) — caber nos limites mem definidos na auditoria 25/04 #5
5. **Quem executa:** DevOps

---

## Achados Médios

### Achado #7 — Inventário Python usa `logging.basicConfig` simplista

- **Dimensão:** 6
- **Localização:** `inventario/backend/app/main.py` — `logging.basicConfig(level=logging.INFO)` (linha sem formatter, sem handler)
- **Plano resumido:** vai junto com #2 (migração JSON).

### Achado #8 — Sem **dashboard de visualização** (depende dos achados #4 e #6)

- Plano resumido: já contemplado em #4 (Grafana). Sem ele, métricas e logs ficam só no terminal.

### Achado #9 — `audit_logs` (já existe!) sem retenção definida

- **Localização:** `core.audit_logs` (tabela já criada — auth-gateway grava logins, mudanças de senha, etc.)
- **Análise:** tabela existe e está sendo populada. **Sem política de retenção** — vai crescer indefinidamente.
- **Plano resumido:** definir retenção (ex: 365 dias) + cron mensal pra limpar registros antigos. Esforço trivial. Considerar exportar pra Loki antes de limpar (compliance LGPD).

---

## Achados Baixos

### Achado #10 — Webhook do backup é exclusivo dele — pode reutilizar pra erros críticos

- Já existe `BACKUP_ALERT_WEBHOOK` configurado. Pode ser generalizado pra `ALERT_WEBHOOK_URL` e usado por error tracker (Achado #3) também.
- **Plano resumido:** renomear env + criar service `AlertNotifierService` reutilizável. Quick Win pós-Sentry/GlitchTip.

### Achado #11 — Healthcheck do Fiscal mostra `degraded` mas não notifica

- Hoje `/api/v1/fiscal/health` retorna `degraded` quando SMTP fora — só visível pra quem fizer GET. Não dispara alerta.
- **Plano resumido:** quando `degraded` aparecer mais de N vezes consecutivas, postar no webhook. Esforço pequeno; útil quando #10 estiver pronto.

---

## Roadmap consolidado

### Sprint 1 (Quick Wins) ✅ **CONCLUÍDO 26/04/2026**

- [x] **#1** — Rotação de logs Docker (~15min) ✅ — YAML anchor `x-logging:` + `logging: *default-logging` em todos os 13 services. 50MB × 5 arquivos = ~250MB max por container. Validado: todos com `{compress:true max-file:5 max-size:50m}`.

**Total Sprint 1: ~15min** | resolve único crítico

### Sprint 2 (semana 1) — Logs estruturados ✅ **CONCLUÍDO 26/04/2026**

- [x] **#2** — `nestjs-pino` em auth-gateway, gestao-ti-backend, fiscal-backend + `python-json-logger` no inventário ✅
- [x] **#5** — Correlation ID via `genReqId` no Pino (lê X-Request-ID, gera UUID se ausente, devolve no response header) + `RequestIdMiddleware` no FastAPI usando `contextvars` ✅
- [x] **#7** — Coberto por #2 (Inventário JsonFormatter com filter pra reqId) ✅

**Validação:**
- Todos os 4 backends agora emitem JSON estruturado com level, time, context, message, reqId
- `curl -H "X-Request-ID: foo" /endpoint` → response devolve `x-request-id: foo` em todos os 4 serviços
- Headers sensíveis (`authorization`, `cookie`, `x-api-key`) redactados pelo Pino
- Health checks ignorados (sem ruído no log)
- 13/13 containers healthy após mudança

**Total Sprint 2: ~2h** | logs prontos pra agregação (Loki/ELK)

### Sprint 3 (semana 2-3) — Stack de observabilidade

- [ ] **#4** — Prometheus + Grafana + `/metrics` nos 4 backends (~4h)
- [ ] **#6** — Loki + Promtail consumindo logs JSON (~2h)
- [ ] **#3** — GlitchTip (self-hosted Sentry) integrado nos 4 backends (~3h)

**Total Sprint 3: ~9h** | observabilidade completa

### Sprint 4 — Refinamento ✅ **CONCLUÍDO 26/04/2026** (parcial — #8 depende de Sprint 3)

- [x] **#10** — `AlertNotifierService` em `auth-gateway/src/alert-notifier/` reusando webhook+email do BackupDR via `DrConfigService`. Endpoint interno `POST /api/v1/internal/alerts/notify` pra outros backends. Suporta severidades info/warn/error/critical (email só pra error+).
- [x] **#11** — `HealthWatchdogService` no fiscal-backend faz polling de `/health` a cada 5min. Conta degradeds consecutivos: 3 (=15min) → alerta WARN, 1 down → alerta CRITICAL imediato. Cooldown 1h pra não floodar. Reaviso a cada 1h se persistir.
- [x] **#9** — `AuditLogRetentionService` no auth-gateway com cron `0 3 1 * *` (dia 1 às 03:00 BR). Lê `audit_log_retention_dias` de `core.system_config` (default 365). Tela no Configurador `/configurador/audit-retention` com status, edit, "disparar agora". Alerta WARN se deletar >100k linhas.
- [ ] **#8** — Dashboards iniciais no Grafana — **bloqueado por Sprint 3** (Grafana não instalado).

**Validação:**
- Endpoint `/api/v1/internal/alerts/notify` testado: 201 + log "Alerta nao entregue: sem destinos configurados" (esperado, webhook vazio)
- Watchdog: 3 ticks simulados → alerta WARN disparou na 3ª, recebido pelo auth-gateway (HTTP 201)
- Retention: getStatus retornou `{retentionDias:365, totalLinhas:964, maisAntigo:2026-03-19, maisRecente:2026-04-26}`
- Configurador rebuild + sidebar com novo item "Retencao Logs"
- 13/13 containers healthy

**Total Sprint 4 (sem #8): ~2h** | observabilidade fechada — falta só Sprint 3 (stack pesado de infra)

### Estimativa total

| Sprint | Horas |
|---|---:|
| 1 (Quick Wins) | ~15min |
| 2 (Logs JSON) | ~4h |
| 3 (Stack observabilidade) | ~9h |
| 4 (Refinamento) | ~4h |
| **TOTAL** | **~17h** |

---

## Itens não verificados

- **Distributed tracing** (OpenTelemetry traces) — uma camada acima da correlation ID, requer Jaeger ou Tempo. Fica pra próxima auditoria se Sprint 3 for bem.
- **Synthetic monitoring** (uptime checks externos tipo UptimeRobot) — orto à plataforma; decisão de produto separada.

---

## Histórico de auditorias

| Data | Versão prompt | Modo | Críticos | Relatório |
|---|---|---|---|---|
| 25/04/2026 | 1.1 | varredura rápida | 2 | [`AUDITORIA_25042026.md`](AUDITORIA_25042026.md) |
| 26/04/2026 | 1.1 | profunda — Backup/DR | 3 → 0 | [`AUDITORIA_BACKUP_DR_26042026.md`](AUDITORIA_BACKUP_DR_26042026.md) |
| 26/04/2026 | 1.1 | profunda — Observabilidade | 1 | (este arquivo) |

---

> **Próxima frente sugerida:** Performance (N+1 queries, índices DB, bundle frontend) ~2h ou LGPD/compliance ~2-3h.
