# Playbook de Auditoria Capul Platform — v1.0

**Data:** 10/05/2026
**Status:** ativo
**Documento complementar:** [`PROMPT_AUDITORIA_PLATAFORMA.md`](PROMPT_AUDITORIA_PLATAFORMA.md) (v1.1, 25/04/2026) — define o **conteúdo técnico** (dimensões, formato de achado, plano de correção). Este playbook define a **orquestração** (frentes, branches, prompt-triggers, deploys).

---

## Por que existe este playbook

A auditoria completa (10 dimensões do `PROMPT_AUDITORIA_PLATAFORMA.md`) é robusta, mas executá-la inteira numa sessão é caro e mistura riscos heterogêneos:

- "JWT secret fraco" e "índice faltando em consulta lenta" são achados de **gravidade incomparável** — um expõe a empresa, outro só doi nossa latência.
- Aplicar fixes de segurança e refactor de performance no mesmo PR confunde rollback se algo quebrar.
- Algumas frentes precisam de **janela de manutenção** (rotação JWT, mudança de header CORS); outras podem entrar como hotfix normal.

O playbook resolve isso **fatiando a auditoria em 6 frentes independentes**, cada uma com:
- escopo bem delimitado,
- branch dedicada,
- prompt-trigger curto pra acionar a partir de qualquer sessão,
- critério de "frente fechada",
- entrega final (relatório + roteiro de deploy próprio).

---

## Prioridades estratégicas

Quando rodar mais de uma frente, priorizar nesta ordem:

| Eixo | Lógica |
|---|---|
| **Eixo 1 — Risco lateral à empresa** | Vulnerabilidade que permita pivot pra **outras aplicações da CAPUL** (Protheus, AD, rede interna). Hacker que entre pelo Capul e ataque o resto. Aqui dano não é só do Capul — é da empresa toda. **Prioridade absoluta.** |
| **Eixo 2 — Risco operacional ao Capul** | Indisponibilidade, perda de dados, regressão em pico. Doi muito mas é interno. |
| **Eixo 3 — Conformidade interna** | LGPD, retenção, anonimização. Importante mas não cria abertura pra ataque lateral. |

**Frentes mapeadas nos eixos:**
- Eixo 1: Frente 1 (Segurança Externa Deep)
- Eixo 2: Frentes 3 (Backup/DR), 4 (Performance), 6 (Robustez)
- Eixo 3: Frente 2 (LGPD)
- Transversal: Frente 5 (Dívida Técnica)

---

## Estrutura de cada frente

```
+-----------------------------------------------------+
| FRENTE N                                            |
+-----------------------------------------------------+
| Escopo / Não-escopo                                 |
| Prompt-trigger (frase exata pra acionar)            |
| Roteiro de execução (passos)                        |
| Critério de aceitação (frente fechada)              |
| Output esperado (relatório + roteiro deploy)        |
| Branch dedicada                                     |
| Estimativa de tempo                                 |
+-----------------------------------------------------+
```

---

## Frente 1 — Segurança Externa Deep

### Escopo
Vulnerabilidades que **permitem ataque externo** (de fora da CAPUL) e podem dar **pivot pra outras aplicações da empresa**. Foco em superfície WAN.

Cobre dimensões 1, 2, 3 (parcial) e 7 do `PROMPT_AUDITORIA_PLATAFORMA.md`, com profundidade extra:

- Mapeamento da superfície exposta na internet (portas/endpoints publicados via nginx + WAN; o que deveria estar restrito a LAN/VPN)
- Auth Gateway: força de senha, brute force protection, JWT secret entropy/rotação, refresh token revogação
- Headers HTTP completos (CSP, HSTS, X-Frame-Options, X-Content-Type, Referrer-Policy, Permissions-Policy) — revisão profunda da config nginx
- Rate limiting: login, endpoints anônimos, throttler global; comportamento sob brute force simulado
- Input validation: SQL injection (Prisma + raw queries), command injection, path traversal, XSS reflexivo
- SSRF: backend faz fetch de URL controlada por usuário? (Protheus URL via `core.integracoes_api_endpoints` — verificar se vem só de DB confiável)
- Secrets management: `.env` em produção, secret em logs/erros, JWT_SECRET vazando, certificados em volume
- Dependências vulneráveis: `npm audit` + `pip check` nos 3 backends
- Docker hardening: containers como root, bind mounts com permissão fraca, rede interna isolada, capabilities desnecessárias
- Logs sensíveis: senha em log, JWT em log, CPF em log

### Não-escopo
- LGPD (consentimento, anonimização) — **Frente 2**
- Backup/DR — **Frente 3**
- Performance — **Frente 4**
- Refactor de código não-relacionado a segurança — **Frente 5**

### Prompt-trigger
```
Execute Frente 1 do PLAYBOOK_AUDITORIA_v1.md — Segurança Externa Deep.
Profundidade: profunda (não varredura rápida).
Branch: audit/seguranca-externa.
```

### Roteiro de execução
1. Criar branch `audit/seguranca-externa` a partir de `main`
2. Rodar varredura sistemática nos 10 itens listados em "Escopo"
3. Para cada achado: classificar como **Crítico / Alto / Médio / Baixo** seguindo §Plano de correção do `PROMPT_AUDITORIA_PLATAFORMA.md`
4. **Críticos e Altos**: pausar e alinhar com Clenio antes de propor fix
5. **Médios e Baixos**: agrupar em lote pra revisão única
6. Gerar relatório `docs/auditorias/seguranca_externa_<DDMMAAAA>.md`
7. Após aprovação dos fixes, gerar roteiro de deploy próprio em `C:\Arquivos-de-projeto\PlatformCapul_<DDMMAAAA>_Roteiro_Seguranca.md`

### Critério de aceitação
- Todos os 10 itens de escopo cobertos OU justificados como "não verificável"
- Zero **Críticos** abertos
- Zero **Altos** abertos OU plano com data de execução acordada
- **Médios** com plano resumido por achado
- **Baixos** listados (sem plano detalhado obrigatório)
- Roteiro de deploy validado pelo Clenio

### Output esperado
- `docs/auditorias/seguranca_externa_<DDMMAAAA>.md` (relatório no formato §Formato do relatório do `PROMPT_AUDITORIA_PLATAFORMA.md`)
- Branch `audit/seguranca-externa` com commits dos fixes aprovados
- `C:\Arquivos-de-projeto\PlatformCapul_<DDMMAAAA>_Roteiro_Seguranca.md` — roteiro Douglas

### Branch dedicada
`audit/seguranca-externa`

### Estimativa
2-4 sessões focadas (4-12h totais entre auditoria + fixes + roteiro)

---

## Frente 2 — LGPD & Privacidade

### Escopo
Conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018) e boas práticas de privacidade.

- Mapeamento de dados pessoais coletados (CPF, e-mail, telefone, dados fiscais)
- Base legal de tratamento (consentimento, execução de contrato, obrigação legal, etc.)
- Política de retenção por tipo de dado
- Direito ao esquecimento: endpoint de exclusão funcional + cascata correta
- Direito de acesso: endpoint de exportação de dados pessoais do titular
- Anonimização em backups antigos
- Anonimização em logs (CPF mascarado, e-mail parcial)
- Política de privacidade visível e versionada
- Trilha de auditoria de quem acessou/modificou dados pessoais
- Encarregado de Dados (DPO) identificado

### Não-escopo
- Vulnerabilidades técnicas de exfiltração — **Frente 1**
- Backup técnico (script funciona) — **Frente 3**

### Prompt-trigger
```
Execute Frente 2 do PLAYBOOK_AUDITORIA_v1.md — LGPD & Privacidade.
Profundidade: profunda.
Branch: audit/lgpd.
```

### Roteiro de execução
1. Criar branch `audit/lgpd` a partir de `main`
2. Mapear dados pessoais em todas as tabelas (varredura de schemas + greps em models)
3. Verificar `PROMPT_AUDITORIA_PLATAFORMA.md` dimensão 10 (LGPD/compliance)
4. Confrontar com requisitos legais ANPD
5. Gerar relatório com gaps + plano
6. Roteiro de deploy próprio se houver mudanças de schema (soft delete, novos endpoints)

### Critério de aceitação
- Mapa de dados pessoais completo
- Para cada gap: plano com base legal + esforço estimado
- Política de privacidade rascunhada (mesmo que validação jurídica seja externa)

### Output esperado
- `docs/auditorias/lgpd_<DDMMAAAA>.md`
- `docs/POLITICA_PRIVACIDADE_DRAFT.md` se necessário
- Roteiro deploy se houver migrations

### Branch dedicada
`audit/lgpd`

### Estimativa
2-3 sessões (4-8h)

---

## Frente 3 — Backup & DR

### Escopo
Continuidade e recuperação de desastre.

- Validação **end-to-end** do procedimento de backup (não só conferir que rodou — confirmar que dump é restaurável)
- Teste de restore em ambiente isolado (sandbox/scratch)
- Cobertura: PostgreSQL multi-schema + Redis (sessões) + volumes (uploads, certificados)
- Retenção por idade: política definida e respeitada
- Criptografia at-rest do backup (chave segura, não no mesmo host)
- Tempo de recovery (RTO) medido na prática
- Ponto de recovery (RPO) medido — quanto se perde no pior caso
- Documentação clara pra terceiros (Douglas em férias, suplente sabe restaurar?)

### Não-escopo
- Anonimização em backups — **Frente 2**
- Hardening do servidor de backup — **Frente 1**

### Prompt-trigger
```
Execute Frente 3 do PLAYBOOK_AUDITORIA_v1.md — Backup & DR.
Profundidade: profunda — INCLUI teste de restore em sandbox.
Branch: audit/backup-dr.
```

### Roteiro de execução
1. Criar branch `audit/backup-dr` a partir de `main`
2. Ler `docs/AUDITORIA_BACKUP_DR_26042026.md` — partir do que ficou listado como pendente
3. Provisionar sandbox descartável (volume separado, container isolado)
4. Restaurar backup mais recente no sandbox
5. Validar integridade: contagem de linhas, foreign keys, dados sample
6. Medir RTO + RPO empíricos
7. Atualizar `docs/DR_PROCEDIMENTO_COMPLETO.md` se gaps encontrados
8. Roteiro de deploy se mudanças no script de backup

### Critério de aceitação
- Restore real testado e funcional
- RTO e RPO documentados
- Procedimento escrito em linguagem que suplente do Douglas consegue executar
- Backup criptografado (ou plano explícito de quando vai ser)

### Output esperado
- `docs/auditorias/backup_dr_<DDMMAAAA>.md`
- `docs/DR_PROCEDIMENTO_COMPLETO.md` atualizado
- Eventual roteiro deploy se ajustes em scripts

### Branch dedicada
`audit/backup-dr`

### Estimativa
1-2 sessões (3-6h, sandbox toma tempo)

---

## Frente 4 — Performance & Escalabilidade

### Escopo
Latência, throughput, eficiência sob carga real e projetada.

- Slow query log do PostgreSQL: top 20 queries lentas
- Índices ausentes: foreign keys sem índice, filtros frequentes em scans
- N+1 queries: revisão de `include` Prisma e loops com query
- Connection pool: tamanho adequado, esgotamento monitorado
- Redis: hit rate, eviction, fragmentação
- Frontend: bundle size, code splitting, imagens otimizadas, lazy loading
- Backend: paginação em listas grandes, compressão habilitada, timeouts
- BullMQ: lag de fila, jobs travados, retry policy
- Healthchecks: latência típica, projeção de carga futura

Cobre dimensão 5 do `PROMPT_AUDITORIA_PLATAFORMA.md`.

### Não-escopo
- Vulnerabilidades — **Frente 1**
- Refactor não-relacionado a perf — **Frente 5**

### Prompt-trigger
```
Execute Frente 4 do PLAYBOOK_AUDITORIA_v1.md — Performance.
Profundidade: profunda.
Branch: audit/performance.
```

### Roteiro de execução
1. Criar branch `audit/performance`
2. Coletar métricas: slow queries, índices não usados/faltantes, bundle size
3. Profiling em endpoints críticos (login, listagem chamados, consulta NF-e/CT-e)
4. Classificar gaps por impacto vs esforço
5. Quick wins (ex: adicionar índice óbvio) podem ser commitados na própria branch
6. Relatório + roteiro deploy

### Critério de aceitação
- Top 20 slow queries identificadas
- Índices recomendados listados com `CREATE INDEX` pronto
- Bundle frontend dentro de limite acordado (TBD com Clenio)
- Estimativa de capacidade: usuários simultâneos suportados

### Output esperado
- `docs/auditorias/performance_<DDMMAAAA>.md`
- Migrations de novos índices na branch
- Roteiro deploy

### Branch dedicada
`audit/performance`

### Estimativa
2-3 sessões (4-8h)

---

## Frente 5 — Duplicação & Dívida Técnica

### Escopo
Higiene de código que **não cria risco de segurança** mas cobra preço em manutenção.

- Sub-services duplicados entre módulos (ex: helper de auth replicado em 3 lugares)
- Validators copiados (mesma regra de CPF/CNPJ em vários arquivos)
- Dead code: rotas não usadas, componentes órfãos, imports não referenciados
- Funções gigantes que pediriam quebra
- Inconsistências de naming entre módulos
- TypeScript any/unknown sem justificativa
- Pacotes não usados no `package.json`
- Padrões inconsistentes (ex: alguns endpoints usam Zod, outros class-validator)

Cobre dimensão 4 + parte da 8 do `PROMPT_AUDITORIA_PLATAFORMA.md`.

### Não-escopo
- Performance (lentidão) — **Frente 4**
- Robustez (retry/timeout) — **Frente 6**

### Prompt-trigger
```
Execute Frente 5 do PLAYBOOK_AUDITORIA_v1.md — Duplicação & Dívida Técnica.
Branch: audit/divida-tecnica.
```

### Roteiro de execução

A frente é executada em **duas fases sequenciais na mesma branch** — não fechar fase 1 sem fase 2.

**Fase 5.1 — Mapeamento + plano**
1. Criar branch `audit/divida-tecnica`
2. Varredura: ferramentas (`ts-prune`, `depcheck`, `jscpd` se disponível) + grep manual
3. Mapear por categoria (duplicação, dead code, inconsistência, naming)
4. Priorizar por **frequência de manutenção** (algo tocado toda semana com bug repetido > algo intocado há 6 meses)
5. Para cada item priorizado: escrever **plano de refactor concreto** (arquivos afetados, antes/depois, riscos, testes que precisam passar)
6. Apresentar plano consolidado pro Clenio aprovar lotes

**Fase 5.2 — Execução do refactor (obrigatória, na mesma branch)**

Por que obrigatória: mapa sem execução vira documento esquecido. A Frente 5 só fecha quando os itens aprovados foram aplicados — caso contrário a próxima sessão recomeça do zero o mapeamento.

7. Aplicar refactors em **lotes pequenos** agrupados por área (ex: "lote A: deduplicação validators de CPF", "lote B: remover dead code do módulo X")
8. Cada lote: 1 commit + verificação que testes/lint passam + alinhamento com Clenio antes de seguir pro próximo
9. **Refactors grandes ou arriscados** (mexer em service usado por múltiplos módulos, mudar contrato de API interno): **pausar e alinhar antes de aplicar** — não decidir sozinho
10. Quick wins óbvios (deletar arquivo dead, remover import não usado) podem ir num lote único de "limpeza"
11. Se durante o refactor descobrir item novo que não estava no mapa, **adicionar no relatório e seguir o mesmo fluxo de aprovação** — não "aproveitar" silenciosamente

### Critério de aceitação
- Mapa completo de duplicação/dívida priorizado
- Plano de refactor escrito **para cada item priorizado**
- Refactors **aprovados** aplicados na branch (não precisa ser 100% do mapa — pode ficar parte como backlog explícito, mas o que foi aprovado deve estar feito)
- Itens **não aplicados** ficam no relatório como "Backlog priorizado" com justificativa (escopo grande, esperando decisão de produto, etc.) — para que a próxima execução desta frente continue de onde parou
- Testes existentes passando após cada lote
- Roteiro de deploy se houver mudança que afete contrato externo

### Output esperado
- `docs/auditorias/divida_tecnica_<DDMMAAAA>.md` (mapa + plano + status de execução por item)
- Branch `audit/divida-tecnica` com commits dos lotes aplicados
- Roteiro de deploy se mudanças exigirem janela controlada

### Branch dedicada
`audit/divida-tecnica`

### Estimativa
- Fase 5.1 (mapa + plano): 1-2 sessões (2-4h)
- Fase 5.2 (refactor): 2-5 sessões dependendo do volume aprovado (4-15h)
- **Total**: 3-7 sessões (6-19h)

---

## Frente 6 — Robustez & Pontos Únicos de Falha

### Escopo
Comportamento sob falha de dependências externas e cenários de borda.

- Integração Protheus: timeout, retry, backoff, circuit breaker; comportamento se Protheus offline 5 min, 1h, 1 dia
- Integração SEFAZ (NF-e + CT-e): rate limit respeitado, comportamento sob 503/timeout, fallback documentado
- SMTP: alertas de falha não dependem do próprio SMTP (loop de alerta quebrado)
- Banco: comportamento sob `connection refused`, `too many connections`, lock timeout
- Redis: comportamento sob queda (sessões perdidas? ratelimit cai?)
- Idempotência: ações críticas (gravação CT-e, envio email) são idempotentes? duplicação detectada?
- Filas BullMQ: dead-letter, retry com backoff, monitoramento de jobs travados
- Healthcheck: detecta degradação real ou só "processo respira"?

Cobre dimensões 4 (parte) + 6 + 9 do `PROMPT_AUDITORIA_PLATAFORMA.md`.

### Não-escopo
- Performance sob carga normal — **Frente 4**
- Vulnerabilidades — **Frente 1**

### Prompt-trigger
```
Execute Frente 6 do PLAYBOOK_AUDITORIA_v1.md — Robustez.
Profundidade: profunda — INCLUI fault injection em sandbox.
Branch: audit/robustez.
```

### Roteiro de execução
1. Criar branch `audit/robustez`
2. Mapear todas as integrações externas
3. Para cada uma: documentar comportamento esperado em 5 cenários (timeout, 503, indisponível, rate limit, dados inválidos)
4. Comparar com comportamento atual (testes em sandbox)
5. Gaps viram achados
6. Fixes (retry, timeout, circuit breaker) na branch

### Critério de aceitação
- Matriz "integração × cenário de falha × comportamento atual × comportamento esperado" preenchida
- Gaps críticos com fix proposto
- Idempotência validada nas ações críticas

### Output esperado
- `docs/auditorias/robustez_<DDMMAAAA>.md`
- Branch com fixes
- Roteiro deploy

### Branch dedicada
`audit/robustez`

### Estimativa
3-5 sessões (6-15h)

---

## Workflow operacional

### Quando rodar uma frente

1. **Clenio dispara** com o prompt-trigger correspondente
2. **Claude lê** o playbook + dimensões relevantes do `PROMPT_AUDITORIA_PLATAFORMA.md`
3. **Claude cria branch** `audit/<frente>` a partir de `main` (ou da branch atual de auditoria, se houver continuidade)
4. **Claude executa** o roteiro da frente, registrando achados conforme template do `PROMPT_AUDITORIA_PLATAFORMA.md`
5. **Críticos/Altos**: pausa imediata, alinhamento com Clenio antes de qualquer fix
6. **Médios/Baixos**: lote único pra revisão
7. **Relatório** salvo em `docs/auditorias/<frente>_<DDMMAAAA>.md`
8. **Roteiro de deploy próprio** em `C:\Arquivos-de-projeto\` se houver mudanças aplicáveis
9. **Frente fechada**: atualizar §Histórico abaixo

### Convenções de branch

| Tipo | Padrão |
|---|---|
| Auditoria | `audit/<frente>` (ex: `audit/seguranca-externa`) |
| Hotfix HOM | `main` direto ou `hotfix/<descrição>` |
| Feature nova | `feat/<descrição>` |

**Regra**: branches de auditoria ficam **vivas até o deploy próprio sair** — não fazem merge no `main` antes da janela combinada com Douglas.

### Como conviver com hotfixes durante uma frente ativa

Se durante uma frente ativa o usuário dispara um hotfix (ex: bug em HOM):
1. Salvar estado da frente (`git stash` ou commit WIP)
2. Mudar pra `main`
3. Aplicar hotfix
4. Voltar pra branch da frente, rebasear se necessário
5. Continuar

A frente **não bloqueia** outros trabalhos. Mas trabalhos paralelos **não entram na branch da frente** — escopos separados.

### Comportamento esperado durante a execução

Aplicar todas as 10 regras do §Regras para a execução do `PROMPT_AUDITORIA_PLATAFORMA.md`. Adicionalmente:

11. **Cada frente tem branch própria** — não misturar frentes na mesma branch
12. **Pausa antes de Crítico/Alto** — sempre alinhar com Clenio antes de propor fix em achado de severidade alta
13. **Roteiro de deploy é parte da entrega** — frente não está fechada até roteiro estar escrito
14. **Quem aplica em PROD é Douglas** — qualquer frente cujo deploy precise de janela controlada aguarda Douglas voltar de férias se ele estiver fora

---

## Prioridade sugerida (10/05/2026)

Considerando que (a) HOM vai estar disponível amanhã com colaborador em rodízio do Douglas, (b) Douglas em férias, (c) aplicação exposta na internet:

1. **Frente 1 — Segurança Externa Deep** — começa imediatamente em paralelo com HOM (eu trabalho na branch, HOM não é afetado)
2. **Frente 3 — Backup/DR** — quando Douglas voltar (precisa expertise pra restore real)
3. **Frente 6 — Robustez** — depois de Frente 1 (algumas mudanças se sobrepõem)
4. **Frente 4 — Performance** — quando volume HOM permitir baseline
5. **Frente 5 — Dívida Técnica** — em paralelo, conforme fôlego
6. **Frente 2 — LGPD** — formal, com tempo, sem urgência de Eixo 1

---

## Histórico de execução das frentes

| Frente | Data | Modo | Críticos | Status | Relatório |
|---|---|---|---|---|---|
| _(nenhuma frente executada por este playbook ainda)_ | | | | | |

### Auditorias anteriores (pré-playbook)

| Data | Tema | Críticos | Relatório |
|---|---|---|---|
| 25/04/2026 | Varredura geral (10 dimensões) | 2 | [`AUDITORIA_25042026.md`](AUDITORIA_25042026.md) |
| 26/04/2026 | Backup/DR (profunda) | 3 | [`AUDITORIA_BACKUP_DR_26042026.md`](AUDITORIA_BACKUP_DR_26042026.md) |
| 26/04/2026 | Observabilidade (profunda) | 1 | [`AUDITORIA_OBSERVABILIDADE_26042026.md`](AUDITORIA_OBSERVABILIDADE_26042026.md) |

---

## Atualização deste playbook

Mudanças de escopo (adicionar/remover frente, mudar prioridade) requerem alinhamento com Clenio. Se uma frente for adicionada/modificada, **bumpar a versão** (`v1.0` → `v1.1`) no header e registrar abaixo:

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 10/05/2026 | Versão inicial — 6 frentes (Segurança Externa, LGPD, Backup/DR, Performance, Dívida Técnica, Robustez) |
