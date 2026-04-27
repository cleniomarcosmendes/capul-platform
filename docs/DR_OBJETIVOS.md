# Disaster Recovery — Objetivos (RTO / RPO)

**Data da proposta:** 26/04/2026
**Status:** **PROPOSTA — aguardando aprovação Diretor TI + Setor Fiscal**
**Origem:** Auditoria Backup/DR de 26/04/2026 (`AUDITORIA_BACKUP_DR_26042026.md`) Achado #4

---

## Definições

- **RTO (Recovery Time Objective)** — quanto tempo a plataforma pode ficar fora antes de causar dano operacional inaceitável.
- **RPO (Recovery Point Objective)** — quantos dados podemos perder no pior caso (sem voltar atrás).

Esses 2 números são a **base de toda decisão** de DR — frequência de backup, redundância, hot/cold standby, custo de cloud, SLAs.

---

## Proposta inicial (a discutir)

| Métrica | Proposta | Justificativa |
|---|---|---|
| **RTO** | **4 horas** | Equipe TI consegue restaurar de backup off-site + subir aplicação em até 4h. Com staff treinado e procedimento testado (ver `DR_PROCEDIMENTO_COMPLETO.md`), 4h é realista. Cloud DR ativo (hot standby) reduziria pra <1h, mas custa ~3-5x mais. |
| **RPO** | **24 horas** | Backup diário às 02:00 (configurado em `scripts/systemd/capul-backup.timer`) garante que no pior caso perdemos 24h de dados (do último backup até o evento). Para reduzir, precisaria backup contínuo (WAL streaming PostgreSQL) — incremento de complexidade não justificado para o cenário atual. |

---

## Cenários de aplicação

### Cenário A — Falha de hardware do servidor de produção

- **Detecção:** monitoramento (Achado #7 da auditoria — alerta de falha)
- **Ação:** restaurar em VM nova a partir do backup off-site (ver `DR_PROCEDIMENTO_COMPLETO.md`)
- **Tempo esperado:** ~3h (provisão VM + download backup + restore + smoke test)
- **Atende RTO 4h:** ✅ sim, com folga de 1h

### Cenário B — Corrupção de banco lógica (bug em deploy)

- **Detecção:** alertas de aplicação ou usuário reportando
- **Ação:** rollback de deploy + restore parcial do banco (apenas tabelas afetadas)
- **Tempo esperado:** ~1h
- **Atende RTO 4h:** ✅

### Cenário C — Catástrofe completa (incêndio data center primário)

- **Detecção:** indisponibilidade total
- **Ação:** restaurar do off-site (S3) em provedor cloud secundário
- **Tempo esperado:** ~6h (provisão + download grande + restore + ajustes DNS)
- **Atende RTO 4h:** ❌ **excede o RTO em 50%**

→ Implicação do Cenário C: se quisermos garantir RTO 4h também nesse cenário, precisa
**hot standby em cloud secundária** (custo significativo). Aceitar RTO degradado em
catástrofe completa é uma decisão de negócio.

---

## Componentes cobertos pelo backup atual (Sprint 1+2)

| Componente | RPO efetivo | Coberto? |
|---|---|---|
| PostgreSQL (todos schemas) | 24h | ✅ `backup_db` |
| `.env` (JWT_SECRET, FISCAL_MASTER_KEY, etc.) | 24h | ✅ `backup_env` |
| Certificado A1 fiscal | 24h | ✅ `backup_certs` |
| Redis (sessões + BullMQ) | 24h | ✅ `backup_redis` |
| Uploads (anexos chamados/projetos) | 24h | ✅ `backup_uploads` |
| Código fonte (`/opt/capul-platform`) | 24h | ✅ `backup_app` (mas o git-remote já é a fonte canônica) |
| **Logs de aplicação** | **n/a** | ❌ não coberto — fica em `journalctl` do host |

---

## O que **não** está coberto (limitações conhecidas)

1. **Sessões em andamento** — usuários logados precisarão refazer login após restore
2. **Jobs BullMQ em andamento** — restore do Redis preserva fila, mas jobs sendo processados no momento do crash podem rodar 2x
3. **Anexos enviados nas últimas 24h** se a janela de backup foi superada
4. **Operações fiscais SEFAZ no exato momento do crash** — alguma consulta pode ter sido feita mas não persistida → `circuit_breaker_uf` pode ficar inconsistente

---

## Próximos passos

- [ ] **Aprovar** RTO 4h e RPO 24h com Diretor TI
- [ ] **Aprovar** com Setor Fiscal (eles são os mais sensíveis a RPO)
- [ ] Comunicar números **publicamente** dentro da CAPUL — usuários sabem que pode haver até 24h de perda em catástrofe
- [ ] Revisar a cada 6 meses

---

*Última atualização: 26/04/2026*
