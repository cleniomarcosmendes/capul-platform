# Prompt Padrão — Auditoria de Estrutura, Boas Práticas e Segurança

**Versão:** 1.1
**Data:** 25/04/2026
**Quando usar:** revisão periódica (recomendado mensal/bimestral) ou antes de marcos importantes (deploy de novo módulo, expansão pública, auditoria externa, etc.)
**Tempo estimado de execução:** 30-60 min para varredura ampla; 2-4h para auditoria profunda

---

## Como invocar

Cole o prompt abaixo no início da sessão Claude Code. Pode ajustar o **escopo** (parágrafo "Escopo desta rodada") para focar num módulo específico ou uma dimensão (ex.: "só segurança", "só fiscal").

```
Execute auditoria completa da plataforma seguindo
docs/PROMPT_AUDITORIA_PLATAFORMA.md.

Escopo desta rodada: [TUDO | módulo específico | dimensão específica]
Profundidade: [varredura | profunda]
Gerar relatório em: docs/AUDITORIA_<DDMMAAAA>.md
```

---

## Contexto obrigatório

Esta plataforma é a **Capul Platform** (corporativa, multi-módulo, multi-tenant lógico) e **está exposta publicamente na Internet** — não apenas rede interna. A auditoria deve **sempre** considerar superfície de ataque externa.

Stack:
- **Auth Gateway** (NestJS 11 + Prisma 6) — JWT compartilhado
- **Hub / Configurador / Gestão TI / Fiscal** (React 19 + Vite + Tailwind v4)
- **Gestão TI / Fiscal Backend** (NestJS 11 + Prisma 6)
- **Inventário** (FastAPI + Python 3.11 + PWA Bootstrap)
- **PostgreSQL 16** multi-schema (`core`, `gestao_ti`, `fiscal`, `inventario`)
- **Redis 7** (sessões, BullMQ, rate limit)
- **Nginx 1.27** com SSL termination
- Docker Compose (13 containers)

---

## Dimensões da auditoria (obrigatórias)

Cada dimensão deve produzir: **(a) achados positivos**, **(b) gaps identificados**, **(c) risco (crítico / alto / médio / baixo)**, **(d) ação recomendada**, **(e) plano de correção detalhado** (ver §Plano de correção abaixo).

### 1. Segurança — Superfície externa

- **TLS / HTTPS**
  - Certificados válidos, expiração, cadeia completa, ciphers fortes
  - HSTS habilitado e com `includeSubDomains` + `preload`
  - Apenas TLS 1.2+ (TLS 1.0/1.1 desabilitados)
  - OCSP stapling ativo

- **Headers de segurança HTTP** (revisar `nginx/nginx.conf`)
  - `Content-Security-Policy` (sem `unsafe-inline`/`unsafe-eval` quando possível)
  - `Strict-Transport-Security`
  - `X-Frame-Options: DENY` ou `frame-ancestors`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer` ou `strict-origin-when-cross-origin`
  - `Permissions-Policy` restrita
  - **Sem `Server:` ou `X-Powered-By:`** vazando versão

- **Rate limiting / proteção DDoS leve**
  - Limites por IP no Nginx (`limit_req_zone`)
  - Rate limit aplicacional (NestJS Throttler) em endpoints sensíveis
  - Endpoints de login com proteção contra brute force (bloqueio temporário após N tentativas)

- **Endpoints expostos**
  - `pgAdmin` exposto? (deve estar restrito a localhost/VPN)
  - `prometheus` / `grafana` / outros dashboards expostos?
  - Endpoints de health/metrics públicos? (ok mostrar status, mas sem detalhes internos)
  - Endpoints `/docs` (Swagger) expostos em produção?

### 2. Segurança — Autenticação e autorização

- **JWT**
  - Secret rotacionável e armazenado em segredo (não hardcoded)
  - Tempo de expiração razoável (access curto, refresh longo)
  - Refresh token armazenamento seguro (httpOnly cookie ou banco com revogação)
  - Algoritmo forte (HS256/RS256, não `none`)

- **Senhas**
  - Hash bcrypt/argon2 com cost adequado
  - Política de complexidade mínima
  - Reset de senha sem vazar se conta existe

- **RBAC**
  - Roles centralizadas (verificar `common/constants/roles.constant.ts`)
  - Guards aplicados em todos endpoints sensíveis
  - Princípio do menor privilégio respeitado
  - Endpoints administrativos sem fallback "ADMIN sempre passa"

- **CSRF / CORS**
  - CORS configurado restritivo (não `*` em produção)
  - SameSite cookies adequado
  - CSRF token em forms críticos (se aplicável)

### 3. Segurança — Dados e segredos

- **Secrets management**
  - `.env` fora do repo (verificar `.gitignore`)
  - Sem secrets hardcoded em código (varredura por `grep`)
  - Sem secrets em logs (verificar logs recentes)
  - Sem secrets em mensagens de erro retornadas ao cliente

- **Dados sensíveis**
  - PII (CPF, e-mail, telefone) em logs?
  - LGPD: política de retenção, direito de exclusão, anonimização em backups
  - Dados de pagamento / fiscal sensível trafegando criptografados
  - **Certificado A1 (módulo Fiscal)** — armazenamento seguro, ACL no volume

- **SQL injection / XSS**
  - Prisma ORM cobrindo (raw queries auditadas)
  - Sanitização de input (validação Zod / class-validator)
  - Output escape (React por padrão; auditar `dangerouslySetInnerHTML`)

### 4. Estrutura e arquitetura

- **Separação de responsabilidades**
  - Cada módulo em seu schema PostgreSQL? ✅ esperado
  - Frontend não acessa DB diretamente
  - Auth centralizado, demais módulos só validam JWT
  - Inventário não escreve no schema `core` (read-only)

- **Padrões de código**
  - TypeScript strict habilitado
  - ESLint/Prettier configurados
  - Convenções consistentes entre módulos (rotas, naming, status codes)
  - Facade pattern em services grandes (verificar `gestao-ti/backend/src/*/services/`)

- **Dependências**
  - Pacotes desatualizados com CVEs (`npm audit` / `pip audit`)
  - Pacotes não usados (bundle bloat)
  - Versões pinadas (não `^` em produção crítica)

### 5. Performance e escalabilidade

- **Database**
  - Índices em colunas mais consultadas (foreign keys, filtros frequentes)
  - N+1 queries (Prisma `include` excessivo)
  - Connection pooling adequado
  - Slow query log ativo

- **Cache**
  - Redis usado onde faz sentido
  - Cache invalidation correta
  - TTLs adequados

- **Frontend**
  - Bundle size razoável (verificar build size)
  - Code splitting por rota
  - Imagens otimizadas

- **Backend**
  - Endpoints paginados onde retornam listas grandes
  - Compressão habilitada (gzip/brotli)
  - Timeouts configurados

### 6. Observabilidade e operações

- **Logs**
  - Estruturados (JSON ou similar parsável)
  - Níveis apropriados (info/warn/error/debug)
  - Sem PII / sem secrets
  - Rotação configurada

- **Monitoring**
  - Health checks expostos (mas sem revelar interno)
  - Métricas críticas observadas (latência, taxa de erro, fila BullMQ)
  - Alertas configurados (e-mail/Slack/etc.)

- **Backup e DR**
  - PostgreSQL com backup automático
  - Backups testados (restore funciona?)
  - Retenção definida
  - Documentado em `docs/`

### 7. Infraestrutura — Docker e Nginx

- **Imagens Docker**
  - Não rodam como `root` (verificar `USER` no Dockerfile)
  - Multi-stage builds para reduzir tamanho
  - Imagens base oficiais e atualizadas
  - `.dockerignore` adequado

- **docker-compose.yml**
  - Sem portas expostas no host além do necessário (Nginx 80/443)
  - Volumes nomeados consistentes
  - Healthchecks definidos
  - Restart policies adequadas
  - Recursos limitados (memory/cpu) para evitar runaway

- **Nginx**
  - Proxies reversos sem trust de headers do cliente
  - Buffer sizes adequados
  - Connection limits
  - Timeouts adequados

### 8. Práticas de desenvolvimento

- **Git**
  - `.gitignore` cobrindo `.env`, `node_modules`, `dist`, etc.
  - Sem secrets no histórico (verificar com `git log` por padrões)
  - Branch strategy clara

- **Testes**
  - Cobertura mínima em pontos críticos
  - Testes de integração para fluxos críticos (login, JWT, pagamento)
  - CI configurado? (atualmente não há, registrar como gap)

- **Documentação**
  - CLAUDE.md atualizado
  - README por módulo
  - Docs de API (Swagger expostos só em dev)
  - Roteiros de deploy/rollback

### 9. Específico — Módulo Fiscal (criticidade alta)

- **Certificado A1**
  - Armazenamento, ACL, expiração monitorada
  - Não exposto em endpoints públicos

- **Proteção SEFAZ (5-camadas)**
  - Dedup CNPJ funcionando
  - Rate limit 20 req/min ativo
  - Circuit breaker UF
  - Limite diário 2.000/dia
  - Freio de mão acessível

- **Cron supervisionado**
  - Sem disparos automáticos não controlados
  - Janela 12:00 + 06:00 D+1 respeitada

### 10. LGPD e compliance

- **Direitos do titular**
  - Endpoint de exportação de dados pessoais
  - Endpoint de exclusão (com soft delete + retenção legal)
  - Política de privacidade visível

- **Auditoria**
  - Trilha de quem fez o quê (mínimo: login, exclusão de dados, mudanças críticas)
  - Retenção de logs adequada

---

## Plano de correção — formato obrigatório por achado

Cada achado **crítico** ou **alto** deve trazer um plano de correção com **todos os campos abaixo**. Achados **médios** podem ter plano resumido (3-5 linhas). Achados **baixos** podem ficar só com a "Ação recomendada" sem plano detalhado.

```markdown
### Achado #N — <título curto>

- **Dimensão:** [1-10 conforme §Dimensões]
- **Severidade:** Crítico | Alto | Médio | Baixo
- **Localização:** `arquivo:linha` (uma ou mais)
- **Descrição:** o que foi encontrado, em 1-2 frases
- **Por que é problema:** impacto concreto se não corrigido (ataque possível, dado vazado, performance, etc.)
- **Evidência:** trecho de código / output de comando / screenshot / referência

#### Plano de Correção

1. **Pré-requisitos** — o que precisa estar pronto antes (acesso, ambiente, decisões de produto, alinhamento com outra equipe)
2. **Passos concretos** — lista numerada, cada passo executável:
   - Qual arquivo modificar / qual comando rodar / qual configuração alterar
   - Trecho exato de código sugerido (quando aplicável) em bloco
   - Variáveis de ambiente a criar/modificar
3. **Critério de validação** — como confirmar que ficou OK:
   - Comando que prova (ex.: `curl -I https://localhost/ | grep -i strict-transport`)
   - Comportamento esperado (ex.: header HSTS aparece com `max-age >= 31536000`)
   - Teste manual a executar
4. **Estimativa de esforço** — quantas horas/dias e nível (trivial/moderado/complexo)
5. **Riscos da correção** — o que pode quebrar quando aplicar (downtime, regressão em outro fluxo, breaking change para clientes)
6. **Rollback** — como reverter se der ruim (revert do commit, restaurar config, etc.)
7. **Dependências** — IDs de outros achados que precisam ser resolvidos antes/junto
8. **Quem executa** — perfil necessário (DevOps, backend dev, fiscal especialista, terceiro)
```

> **Importante:** o plano de correção é **escrito**, **não executado**. A auditoria não modifica código (regra §7.1). A execução é uma sessão separada — o plano precisa ser claro o suficiente para qualquer dev pegar e implementar sem ter participado da auditoria.

---

## Formato do relatório de saída

Gerar arquivo `docs/AUDITORIA_<DDMMAAAA>.md` com a estrutura:

```markdown
# Auditoria Capul Platform — <Data>

## Sumário Executivo
- Score global: X/100
- Achados críticos: N (esforço total estimado: Xh)
- Achados altos: N (esforço total estimado: Xh)
- Achados médios: N
- Achados baixos: N
- Pontos fortes: lista de 3-5
- **Quick wins** (alta criticidade + baixo esforço): N achados — resolver primeiro

## Achados Críticos (resolver imediatamente)
[Para cada achado crítico, usar o template completo "Plano de Correção" acima]

## Achados Altos (resolver em até 30 dias)
[Idem — template completo]

## Achados Médios (planejar para próximo trimestre)
[Plano resumido por achado]

## Achados Baixos / Boas Práticas Sugeridas
[Lista — só ação recomendada, sem plano detalhado]

## Pontos Fortes Identificados
- ...

## Comparativo com auditoria anterior (se houver)
- Achados resolvidos desde a última auditoria
- Achados que pioraram
- Novos achados

## Roadmap consolidado de correção

### Sprint 1 (semana 1-2) — Quick wins + Críticos
- [ ] Achado #X — <título> (Yh)
- [ ] Achado #Y — <título> (Yh)

### Sprint 2 (semana 3-4) — Críticos restantes
- [ ] ...

### Médio prazo (1-3 meses) — Altos + Médios
- [ ] ...

### Longo prazo (backlog) — Médios menos urgentes + Baixos
- [ ] ...

## Estimativa de esforço total
- Curto prazo: Xh
- Médio prazo: Xh
- Longo prazo: Xh
- **TOTAL:** Xh
```

---

## Regras para a execução

1. **Não mudar código durante a auditoria** — só inspeção e escrita do relatório. Implementação é etapa separada (sessão posterior).
2. **Citar arquivo:linha** quando apontar achado (ex.: `nginx/nginx.conf:42`).
3. **Distinguir o que é gap real vs preferência de estilo** — só apontar como "achado" o que tem impacto concreto.
4. **Não inventar problemas** — se não conseguir verificar uma dimensão (ex.: faltam permissões, não tem acesso à infra), registrar como "não verificado" em vez de chutar.
5. **Considerar contexto de produção pública** em todas as decisões de severidade — um endpoint exposto sem auth é crítico aqui, não médio.
6. **Cross-check com memory** — antes de apontar um problema, verificar se já está tratado em alguma decisão registrada na MEMORY.md (ex.: SEFAZ proteção 5-camadas é decisão consolidada).
7. **Ser específico em ações recomendadas** — "melhorar logs" é vago; "adicionar middleware morgan com formato `combined` em auth-gateway/main.ts e excluir campo `password` do log de body" é acionável.
8. **Plano de correção concreto** — para cada achado crítico/alto, usar o template completo (§Plano de correção). Quem executa o plano pode ser uma sessão futura, outro dev, ou consultor — não pode haver passo ambíguo. Se tiver dúvida em um passo, marcar como "**(decisão pendente: X)**" em vez de chutar.
9. **Quick wins ganham destaque** — achados de alta severidade com baixo esforço (ex.: ajustar header no Nginx) devem ser sinalizados na seção "Quick wins" do sumário executivo. São prioridade pra render score rápido.
10. **Estimativa honesta** — usar nível trivial (< 1h) / moderado (1-8h) / complexo (> 1 dia) e não acumular margem de segurança em cada achado (somar margem só no consolidado).

---

## Checklist mínima da varredura (modo "varredura rápida")

Quando o pedido for "varredura rápida" (~30 min), priorizar:

1. **TLS + headers** (`nginx/nginx.conf`)
2. **Secrets no repo** (`git ls-files | grep -E "\.env$"`, `grep -r "JWT_SECRET=" --include="*.ts"`)
3. **Endpoints expostos sem auth** (verificar guards globais)
4. **CORS configurado** (não `*`)
5. **`npm audit` em cada `package.json` modificado recentemente**
6. **Containers como root** (verificar Dockerfiles)
7. **Volumes/portas expostas além do necessário** (`docker-compose.yml`)
8. **Logs com PII / secrets**

---

## Histórico de auditorias

| Data | Versão | Modo | Críticos | Relatório |
|---|---|---|---|---|
| 25/04/2026 | 1.1 | varredura rápida | 2 | [`AUDITORIA_25042026.md`](AUDITORIA_25042026.md) |
| 26/04/2026 | 1.1 | profunda — Backup/DR | 3 | [`AUDITORIA_BACKUP_DR_26042026.md`](AUDITORIA_BACKUP_DR_26042026.md) |
| 26/04/2026 | 1.1 | profunda — Observabilidade | 1 | [`AUDITORIA_OBSERVABILIDADE_26042026.md`](AUDITORIA_OBSERVABILIDADE_26042026.md) |
