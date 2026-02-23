# Resumo Executivo: Segurança para Inventário Mobile (BYOD)

**Data:** 25/12/2024 | **Projeto:** Sistema de Inventário Protheus v2.19.18

---

## Contexto

O Sistema de Inventário utiliza **celulares pessoais** para contagem de estoque, eliminando coletores dedicados (economia de R$ 3.000-8.000/unidade). Esses dispositivos precisam acessar a rede corporativa de forma **segura e controlada**.

---

## Solução Proposta: Rede Isolada

```
    REDE CORPORATIVA                    REDE INVENTÁRIO (Isolada)
  ┌─────────────────┐                 ┌─────────────────────────┐
  │ Servidores      │                 │  WiFi: "INVENTARIO"     │
  │ ERP Protheus    │◄── BLOQUEADO ──►│  📱 📱 📱 Celulares     │
  │ Estações        │                 │         │               │
  └─────────────────┘                 │         ▼               │
                                      │  ┌─────────────────┐    │
                                      │  │ Servidor API    │    │
                                      │  │ (porta 443)     │    │
                                      │  └─────────────────┘    │
                                      └─────────────────────────┘
```

**Princípio:** Celulares acessam **APENAS** o servidor de inventário. Bloqueado acesso a qualquer outro recurso.

---

## O Que Precisamos da TI

| Item | Descrição | Prioridade |
|------|-----------|------------|
| **VLAN isolada** | Criar VLAN dedicada (ex: VLAN 100) | Obrigatório |
| **SSID dedicado** | Criar WiFi "INVENTARIO" nos APs | Obrigatório |
| **Regra de Firewall** | VLAN → Servidor (porta 443) apenas | Obrigatório |
| **Client Isolation** | Celulares não se comunicam entre si | Recomendado |

---

## Custo e Prazo

| Cenário | Custo | Prazo | Segurança |
|---------|-------|-------|-----------|
| **Mínimo (recomendado)** | R$ 0 | 3-5 dias | Alta |
| Intermediário (c/ RADIUS) | R$ 2.000-10.000 | 1-2 semanas | Muito Alta |
| Enterprise (NAC/MDM) | R$ 20.000+ | 3-4 semanas | Máxima |

**Recomendação:** Cenário mínimo atende 95% das necessidades com custo zero.

---

## Segurança Já Implementada no Sistema

- HTTPS obrigatório (criptografia)
- Autenticação JWT com expiração
- Controle de acesso por perfil (RBAC)
- Proteção contra SQL Injection
- Logs de auditoria completos

---

## Próximos Passos

1. **Reunião TI + Desenvolvimento** - Validar viabilidade técnica
2. **Definir VLAN/SSID** - Range de IPs e nome da rede
3. **Implementar e testar** - Ambiente de homologação
4. **Liberar produção** - Comunicar operadores

---

## Contato

| Área | Responsável |
|------|-------------|
| Sistema de Inventário | [A definir] |
| Infraestrutura/Rede | [A definir] |

---

*Documento técnico completo disponível em: `docs/REQUISITOS_INFRAESTRUTURA_BYOD.md`*
