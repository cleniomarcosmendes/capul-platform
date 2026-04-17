# Módulo Fiscal — Próximos passos

**Última atualização**: 12/04/2026 (fim do dia)
**Status atual**: Dev/homologação 100% operacional. Bloqueado para produção em 2 itens críticos.

---

## 🎯 Situação atual em 1 minuto

| Frente | Status |
|---|---|
| Backend (NestJS + Prisma) | ✅ Operacional, 0 erros TSC, 13 fixes de auditoria aplicados |
| Frontend (React + Vite) | ✅ Operacional, 11 páginas, Toast/Confirm/OrigemBadge |
| SEFAZ (NF-e/CT-e/CCC) | ✅ Schema XML corrigido, consultas reais funcionando |
| Receita Federal | ✅ BrasilAPI + ReceitaWS fallback, cobertura ~95% |
| Cadeia TLS ICP-Brasil | ✅ 5 certs + Mozilla roots, visibilidade total (Header/Dashboard/Admin) |
| Protheus | ⚠️ Mock ativo — aguardando reunião 14/04 |
| Certificado A1 | ⚠️ Vence 25/04/2026 (13 dias) — renovar |

---

## 🔴 Bloqueadores de go-live

### 1. Certificado A1 vence em 13 dias (25/04/2026)
**Ação**: agendar renovação com a AC.
**Depois da renovação**:
1. Upload do novo .pfx em `https://localhost/configurador/certificado-fiscal`
2. Ativar o novo cert
3. Forçar rebuild do agent: o `SefazAgentService` invalida o cache automaticamente quando o cert é trocado
4. Testar consulta NF-e para confirmar funcionamento

### 2. Reunião equipe Protheus — **segunda 14/04**
**Objetivo**: destravar a troca de `FISCAL_PROTHEUS_MOCK=true` → `false`.
**Documento de apoio**: `docs/REUNIAO_PROTHEUS_14ABR2026.md` (roteiro completo)
**O que levar**:
- Especificação: `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md`
- Demo rodando em `https://localhost/fiscal/`
- Roteiro da reunião (impresso ou aberto no notebook)

---

## 🟡 Bloqueadores de produção (depois dos críticos)

### 3. Validação do setor Fiscal — cobertura dos campos
O setor Fiscal precisa validar se a cobertura atual atende o dia-a-dia:

**Cobertura CCC + Receita (~95%)**
- ✅ Razão social, CNPJ, IE, UF, situação cadastral
- ✅ CNAE (SEFAZ) + CNAE fiscal (Receita)
- ✅ Endereço completo (SEFAZ) + endereço Receita
- ✅ Porte, natureza jurídica, capital social, data de abertura
- ✅ Regime de apuração, IE destinatário (NF-e e CT-e)
- ❌ **Situação CPF** (não disponível em APIs públicas — só via Serpro paga)
- ❌ **Tipo IE "Produtor Rural"** (só no portal Sintegra, não no CCC)
- ❌ **Histórico cadastral** (só no portal Sintegra)

**Decisão pendente**: contratar API Serpro para cobrir os 5% faltantes, ou aceitar a cobertura atual?

### 4. Ativar flags de produção
No deploy real, setar no `.env` de produção:
```bash
FISCAL_SEFAZ_CA_AUTO_REFRESH=true    # auto-atualização diária da cadeia TLS
FISCAL_SEFAZ_TLS_STRICT=true          # abortar boot se cadeia ausente
FISCAL_PROTHEUS_MOCK=false            # após reunião Protheus
CORS_ORIGINS=https://fiscal.capul.com.br   # ajustar ao domínio real
```

### 5. Atualizar `docs/ROTEIRO_MIGRACAO_PRODUCAO.md`
Incluir:
- Passo para aplicar schema `fiscal` no banco de produção
- Variáveis de ambiente novas (lista acima)
- Upload inicial do certificado A1 de produção
- Primeiro refresh da cadeia ICP-Brasil (via botão Admin ou automático no boot)

---

## 🟢 Próxima sessão (amanhã)

Em ordem de prioridade:

### 1. Commitar o trabalho de hoje
- Revisar a proposta dos **7 commits** do roteiro de finalização (no histórico da conversa)
- Executar: `"Execute os 7 commits propostos pelo roteiro"`
- Validar com `git log -10` que ficaram organizados por escopo

### 2. Preparar materiais da reunião de segunda (14/04)
- Imprimir ou deixar aberto `docs/REUNIAO_PROTHEUS_14ABR2026.md`
- Validar que o demo em `https://localhost/fiscal/` roda sem erros
- Checar que o certificado A1 atual ainda está válido

### 3. (Opcional) Limpeza Docker
- Build cache em 21GB reclamáveis
- Comando: `docker builder prune -f --filter "until=168h"`
- NÃO rodei hoje porque precisa aprovação — rodar amanhã se quiser liberar espaço

### 4. (Opcional) Ativar auto-refresh da cadeia TLS em dev
- Editar `docker-compose.yml` para incluir `FISCAL_SEFAZ_CA_AUTO_REFRESH=true` no fiscal-backend
- Restart do container
- Na próxima inicialização, se a cadeia tiver >30d, vai atualizar automaticamente
- Esse modo já é o recomendado para produção

---

## 🔵 Backlog técnico (sem urgência)

Listado por ordem de valor × esforço:

### Alto valor
- **Testes E2E** do fluxo crítico (consulta NF-e → parser → DANFE → gravação)
  - Esforço: ~3-5 dias
  - Valor: protege contra regressões em refactors
- **Métricas SEFAZ por UF** (latência, taxa de erro, timeouts)
  - Esforço: ~2 dias (integrar com Prometheus ou só expor endpoint agregador)
  - Valor: detectar instabilidade antes do usuário reclamar

### Médio valor
- **JWT httpOnly cookies** em vez de localStorage
  - Esforço: ~1 semana (mudança no auth-gateway)
  - Valor: proteção contra XSS
  - Depende de: decisão arquitetural com time auth
- **DV módulo 11** no validateChave do frontend
  - Esforço: ~1h
  - Valor: evita round-trip SEFAZ para chaves digitadas erradas
- **Persistir XML no `fiscal.documento_consulta`**
  - Esforço: ~4h (coluna nova + migration + adaptação do retry)
  - Valor: retry do Protheus sem re-consulta SEFAZ

### Baixo valor / experimental
- **Scraping Playwright do Sintegra** para os campos que não temos
  - Descartado (risco jurídico + fragilidade)
- **Cadastro centralizado de endpoints SEFAZ** no Configurador
  - Hoje endpoints são hardcoded em `sefaz-endpoints.map.ts`
  - Valor pequeno: SEFAZ raramente muda URLs

---

## 📊 Métricas do que foi entregue hoje

| Métrica | Valor |
|---|---|
| Arquivos backend novos | 84 |
| Arquivos frontend novos | 32 |
| Arquivos modificados (plataforma) | 11 |
| TSC errors (backend + frontend) | 0 |
| Containers rodando | 12/12 |
| Certificados TLS carregados | 149 (5 ICP-Brasil + 144 Mozilla) |
| Vulnerabilidades `npm audit` | 0 |
| Fixes de auditoria aplicados | 13 (4 críticos + 7 importantes + 2 nice-to-have) |
| Pontos de visibilidade TLS | 5 (header, dashboard, admin, email, health) |
| NF-es reais validadas end-to-end | 2 (+1 erro esperado cStat=641, +1 fora de prazo cStat=632) |
| CPFs/CNPJs reais validados no CCC | 2 (CLENIO produtor rural + CAPUL) |

---

## 🗂️ Documentos de referência

| Documento | Propósito |
|---|---|
| `docs/REUNIAO_PROTHEUS_14ABR2026.md` | Roteiro da reunião de segunda (**USAR NA REUNIÃO**) |
| `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` | Contrato técnico completo (levar à reunião) |
| `docs/PLANO_MODULO_FISCAL_v1.5_ADDENDUM.md` | Plano original do módulo |
| `docs/ROTEIRO_FINALIZACAO.md` | Procedimento de finalização pós-desenvolvimento |
| `docs/ROTEIRO_MIGRACAO_PRODUCAO.md` | ⚠️ Precisa atualizar com passos Fiscal |
| `fiscal/backend/certs/icp-brasil/README.md` | Como popular a cadeia ICP-Brasil |

---

## 🎬 Como retomar amanhã

Prompts sugeridos para abrir o Claude Code amanhã:

```
# Ver onde parou
"Leia docs/PROXIMOS_PASSOS_FISCAL.md e me resuma os próximos passos"

# Commitar
"Execute os 7 commits propostos pelo roteiro de finalização de ontem"

# Preparar reunião
"Revise comigo o documento docs/REUNIAO_PROTHEUS_14ABR2026.md e me ajude a preparar"

# Smoke test do dia
"Subir o fiscal-backend e validar que todas as consultas continuam funcionando
 (NF-e, CT-e, CCC, cadeia TLS)"
```

---

**Boa noite e até amanhã! 😴**
