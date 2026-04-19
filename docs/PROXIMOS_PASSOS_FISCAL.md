# Módulo Fiscal — Próximos passos

**Última atualização**: 18/04/2026 (fim do dia)
**Status atual**: Onda 1 do Plano v2.0 **100% completa e funcional**. Aguardando publicação de `/eventosNfe` e `/grvXML` no Protheus HOM para iniciar Onda 2.

---

## 🎯 Situação atual em 1 minuto

| Frente | Status |
|---|---|
| **Plano Mestre v2.0** | ✅ `docs/PLANO_MODULO_FISCAL_v2.0.md` (17/04) |
| **Pendências Protheus** | ✅ `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` — enviar à equipe |
| **Contrato `/cadastroFiscal`** | ✅ **Publicado em HOM**, integração real funcionando |
| **Contrato `/eventosNfe`** | ❌ Retorna 404 no HOM — aguardando publicação |
| **Contrato `/grvXML`** | ❌ Retorna 404 no HOM — aguardando publicação |
| **Onda 1 (cadastro + limites + menu)** | ✅ **100% completa** (passos 1.1–1.10) |
| **Onda 2 (NF-e/CT-e via Protheus)** | ⏸️ Depende dos 2 endpoints acima |
| **Backend fiscal** | ✅ Rodando com resolver dinâmico, 2 crons scheduler, limite diário ativo |
| **Frontend fiscal** | ✅ 5 páginas `/operacao/*` + `/divergencias`; menu reorganizado |
| **Certificado A1** | ⚠️ Vence **25/04/2026 (7 dias)** — renovar esta semana |
| **Deploy dev** | ✅ 12 containers rodando |
| **Git** | ⚠️ Trabalho de 18/04 uncommitted (~35 arquivos novos/modificados) |

---

## 🔴 Bloqueadores de go-live

### 1. Certificado A1 vence em 7 dias (25/04/2026)
**Ação**: agendar renovação com AC esta semana. Upload em `/configurador/certificado-fiscal` (UI do Configurador). `SefazAgentService` invalida cache automaticamente ao trocar o cert.

### 2. Publicação dos endpoints Onda 2
- `POST /rest/api/INFOCLIENTES/FISCAL/grvXML` — hoje 404
- `GET /rest/api/INFOCLIENTES/FISCAL/eventosNfe` — hoje 404

Ambos dependem da equipe Protheus. **Documento formal de pendências**: `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` (3 bloqueadores, 8 esclarecimentos, 4 observações).

---

## 🎬 Próxima sessão — por onde começar?

### Opção A — Commitar Onda 1
~35 arquivos novos/modificados uncommitted. Organizar em 7 commits lógicos (ver memória `project_fiscal_onda1_completa_18abr`).

### Opção B — Validar no navegador
Subir `https://localhost/fiscal/` e testar:
- Navegação do menu (OPERACAO com 5 itens)
- `/operacao/limites` (widget de consumo + política visível)
- `/divergencias` (tabela vazia por enquanto)
- `/cadastro` com CNPJ real → vínculo Protheus aparece

### Opção C — Cleanup
Remover métodos órfãos `assertBootstrapConcluido` / `marcarBootstrapConcluido` em `ambiente.service.ts` (descontinuados pelo Plano v2.0, mas ainda no código).

### Opção D — Aguardar Protheus
Quando `/eventosNfe` e `/grvXML` subirem, executar Onda 2:
1. Cadastrar endpoints atualizados no Configurador (se URLs mudarem)
2. Refatorar `NfeService.consultarPorChave` e `CteService.consultarPorChave` para fluxo SZR → SPED156 → SEFAZ via Protheus
3. Plugar `EventosTimelineProtheus` no `NfeConsultaPage`
4. Remover chamadas diretas a SEFAZ em NfeDistribuicaoClient/NfeConsultaProtocolo/CteConsultaProtocolo (CCC permanece direto)

---

## 🟡 Bloqueadores de produção (pós-críticos)

### Cobertura cadastral
CCC + Receita cobrem ~95%. Pendências: Situação CPF + IE Produtor Rural + histórico cadastral. Decisão: contratar Serpro paga ou aceitar 95%?

### Flags produção
```bash
FISCAL_SEFAZ_CA_AUTO_REFRESH=true
FISCAL_SEFAZ_TLS_STRICT=true
FISCAL_PROTHEUS_MOCK=false    # já pode ser false em dev (cadastroFiscal publicado)
CORS_ORIGINS=https://fiscal.capul.com.br
```

### Atualizar `docs/ROTEIRO_MIGRACAO_PRODUCAO.md`
Incluir: schema fiscal com migration onda1, tabela `limite_diario` seedada, novas env vars, cadastro de endpoints PROTHEUS no Configurador.

---

## 🔵 Backlog técnico (sem urgência)

### Alto valor
- **Testes E2E** do fluxo crítico (consulta cadastral ponta-a-ponta com Protheus real)
- **Métricas SEFAZ por UF** (latência, taxa de erro, timeouts)
- **Alertas por e-mail** nos thresholds 80%/90% do limite diário (hoje só grava flag)

### Médio valor
- **JWT httpOnly cookies** em vez de localStorage
- **DV módulo 11** no validateChave frontend
- **Persistir XML** no `fiscal.documento_consulta`

### Cleanup
- Remover `assertBootstrapConcluido` e `marcarBootstrapConcluido` (descontinuados no Plano v2.0)
- Header da `watchdog.service.ts` (texto ainda menciona SEMANAL/DIARIA)

---

## 🗂️ Documentos de referência

| Documento | Propósito |
|---|---|
| **`docs/PLANO_MODULO_FISCAL_v2.0.md`** | ⭐ Plano mestre ativo |
| **`docs/PENDENCIAS_PROTHEUS_18ABR2026.md`** | Pendências formais para Protheus |
| `API – Integração Protheus – Leitura de Cadastros Fiscais.md` | Contrato /cadastroFiscal (17/04) |
| `/mnt/c/Arquivos-de-projeto/szr010-szq010.txt` | Contrato /grvXML (18/04, aguarda publicação) |
| `/mnt/c/Arquivos-de-projeto/Eventos_nfe.txt` | Contrato /eventosNfe (18/04, aguarda publicação) |
| `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` | Especificação técnica completa |
| `docs/FLUXO_CONSULTA_NFE.md` / `FLUXO_CONSULTA_CTE.md` | Atualizar na Onda 2 |
| `docs/ROTEIRO_MIGRACAO_PRODUCAO.md` | ⚠️ Atualizar com passos Fiscal + migration onda1 |

---

## 🎬 Como retomar amanhã

```
# 1. Ver onde parou
"Leia docs/PROXIMOS_PASSOS_FISCAL.md e me diga quais opções (A/B/C/D) fazem sentido"

# 2. Commitar o trabalho
"Execute os 7 commits propostos na memória project_fiscal_onda1_completa_18abr"

# 3. Validar no navegador
"Subir fiscal e listar o que posso testar na UI agora (Onda 1 completa)"

# 4. Iniciar Onda 2 (quando Protheus publicar)
"Protheus publicou /eventosNfe e /grvXML em HOM. Iniciar Onda 2."
```

---

**Boa noite! 😴**
