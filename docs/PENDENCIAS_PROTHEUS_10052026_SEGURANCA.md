# Pendências Protheus — Segurança — 10/05/2026

**Origem:** Frente 1 do `PLAYBOOK_AUDITORIA_v1.md` — Segurança Externa Deep
**Documento de auditoria fonte:** [`docs/auditorias/seguranca_externa_10052026.md`](auditorias/seguranca_externa_10052026.md)
**Solicitante:** Capul Platform (Clenio)
**Destinatário:** Equipe Protheus + Douglas (Infra)
**Janela alvo:** assim que Douglas retornar das férias e equipe Protheus puder coordenar

---

## Contexto

A auditoria de segurança externa identificou 2 itens que **dependem de ação coordenada do lado Protheus** para resolução definitiva. A Capul Platform já tem plano de mitigação paliativa do seu lado, mas a correção real requer cooperação Protheus.

Este documento concentra **o que precisamos do Protheus** para fechar os achados.

---

## Pendência #1 — Rotação da credencial `APICAPUL`

### Achado correlato
**#C1 (Crítico)** — credencial Protheus PROD `Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=` (Base64 de `APICAPUL:Ap1C4pu1PRD`) hardcoded em 12+ arquivos do repositório Capul Platform desde o **first commit**.

A credencial está no git history pra sempre. Mesmo após remoção dos fallbacks no código (paliativo nosso), quem clonou o repositório em qualquer momento da história tem acesso à credencial.

### O que precisamos do Protheus

#### 1.1 — Criar novo usuário API
- **Nome sugerido:** `APICAPUL_2026` (ou nome similar que indique rotação)
- **Senha:** **forte e aleatória**, gerada com:
  ```bash
  openssl rand -base64 24
  ```
  (resulta em ~32 chars aleatórios; **não usar leetspeak ou variações reconhecíveis**)
- **Permissões:** equivalentes ao `APICAPUL` atual — confirmar quais endpoints/objetos cada módulo Capul Platform usa
- **Expiração da senha:** se Protheus suportar, configurar política de expiração (ex: 365 dias) para forçar rotações futuras

#### 1.2 — Confirmar quais sistemas usam o `APICAPUL` antigo
Para entender o blast radius da revogação, precisamos saber:
- **Apenas a Capul Platform** consome essas credenciais? Ou outros sistemas (mobile, BI, Excel macros, scripts internos)?
- Se outros sistemas usam, eles também precisam migrar pro `APICAPUL_2026` antes do D+2 da revogação
- Idealmente equipe Protheus tem auditoria de uso (logs de chamadas) pra mapear consumidores

#### 1.3 — Janela de cutover
- Janela sugerida: **1 hora** durante horário de baixo uso (ex: 22h-23h em dia útil ou madrugada de sábado)
- Durante a janela:
  - Capul Platform substitui `.env` em DEV/HOM/PROD com nova credencial
  - Sistemas Capul Platform reiniciam (downtime ~5min cada, total ~15min)
  - Validação: `curl` de teste em endpoint Protheus a partir de cada módulo
- **Após janela:** manter `APICAPUL` antigo ATIVO por **48h** para rollback
- **Após D+2:** desabilitar (não deletar) `APICAPUL` antigo

#### 1.4 — Plano de rollback
Se algo quebrar após cutover:
- Reverter `.env` da Capul Platform pra credencial antiga
- Reiniciar serviços
- `APICAPUL_2026` continua válido em paralelo durante D+2 (defesa em profundidade)

### Esforço estimado (lado Protheus)
- Criação usuário + permissões: 30min
- Auditoria de consumidores: 1-2h
- Janela de cutover: 1h
- Stand-by D+2: passivo

### Esforço estimado (lado Capul Platform — depende deste pré-requisito)
- Limpeza de git history (`git filter-repo` + force push): 1-2h
- Comunicação a colaboradores que têm clone local: passivo
- Total: 2-3h ativo, distribuído em 1-2 dias

---

## Pendência #2 — Certificado SSL do Protheus

### Achado correlato
**#M3 (Médio — Frente 6, escalado)** — `PROTHEUS_INVENTARIO_VERIFY_SSL: false` no `docker-compose.yml`. SSL verification desabilitada para conexão Inventário→Protheus.

> **Escalação:** este achado foi movido para Frente 6 (Robustez) por ser risco operacional (rede interna) e não superfície externa. Mas ainda exige ação do lado Protheus.

### Por que está como `false` hoje
Hipóteses (a equipe Protheus pode confirmar):
- Certificado do Protheus é self-signed
- Certificado expirado e ninguém renovou
- Cadeia de certificados incompleta
- CN do certificado não bate com o hostname acessado

### O que precisamos do Protheus

#### 2.1 — Diagnóstico do certificado atual
Equipe Protheus pode rodar:
```bash
openssl s_client -connect apiportal.capul.com.br:8104 -showcerts < /dev/null 2>&1 | head -50
```
e compartilhar saída pra entender o estado atual (issuer, validity, CN, SAN).

#### 2.2 — Cenários possíveis e ações

| Cenário | Ação Protheus | Ação Capul Platform |
|---|---|---|
| **A.** Cert válido + CA pública | nenhuma | habilitar `verify=true` |
| **B.** Cert self-signed válido | exportar cert da CA Protheus para arquivo | montar cert no container + `verify=/path/to/ca.pem` |
| **C.** Cert expirado | renovar (Let's Encrypt ou CA interna) | habilitar `verify=true` após renovação |
| **D.** Decisão consciente: manter `verify=false` | documentar razão técnica | comentar no `docker-compose.yml` referenciando este doc |

### Janela
- Não-bloqueante. Pode ser feito em paralelo com qualquer outra mudança.
- Cenário A/B: zero downtime
- Cenário C: depende renovação (Let's Encrypt = 5min; CA interna = pode levar dias dependendo do processo)

### Esforço estimado (lado Protheus)
- Diagnóstico: 15min
- Cenário A: zero
- Cenário B: 30min (export cert)
- Cenário C: 1h-vários dias (depende fluxo de aprovação CA)
- Cenário D: 0min (só decisão)

---

## Como interagir com este documento

1. **Equipe Protheus** revisa este documento e devolve:
   - Pendência #1.2: lista de consumidores do `APICAPUL`
   - Pendência #1.3: janela disponível
   - Pendência #2.1: saída do `openssl s_client`
   - Pendência #2.2: cenário aplicável (A/B/C/D)

2. **Clenio + Douglas** alinham janela do cutover (#1.3) com Capul Platform

3. **Após pendências respondidas:** Capul Platform executa:
   - Lote final de fix #C1 (limpeza git history + force push)
   - Lote de Frente 6 que cobre #M3 (config verify_ssl)

---

## Anexos

### Anexo A — Como gerar senha forte
```bash
openssl rand -base64 24
# Saída exemplo: kI7+hQ2yMxC5vN9pL8uDgF6tWzRq3aBe (32 chars Base64)
```

### Anexo B — Locais onde a credencial atual aparece (para referência)
```
docker-compose.yml:208, :211 (fallback nos modulos Inventario e Fiscal)
auth-gateway/prisma/seed.ts:320
inventario/backend/test_api_protheus.py:10
inventario/backend/app/core/config.py:59, :136
inventario/backend/app/core/protheus_config.py:118
inventario/docs/PLANO_CONTINUIDADE_INTEGRACAO_PROTHEUS.md:253
inventario/docs/historico/IMPLEMENTACAO_SYNC_PROTHEUS_v2.14.0.md:50, :256
inventario/docs/historico/PLANO_SINCRONIZACAO_API_PROTHEUS_v2.14.0.md:39, :142, :277, :589, :599
```

### Anexo C — Referência ao relatório completo de segurança
[`docs/auditorias/seguranca_externa_10052026.md`](auditorias/seguranca_externa_10052026.md)

---

*Documento criado em 10/05/2026. Atualizar `Status` abaixo conforme avança.*

## Status (atualizar conforme andamento)

- [ ] Documento entregue à equipe Protheus
- [ ] Pendência #1.2 respondida (lista de consumidores)
- [ ] Pendência #2.1 respondida (diagnóstico cert)
- [ ] Janela #1.3 acordada
- [ ] Pendência #1 executada (rotação)
- [ ] Pendência #2 executada (cert)
- [ ] Limpeza git history aplicada
- [ ] Achados #C1 e #M3 fechados na auditoria de origem
