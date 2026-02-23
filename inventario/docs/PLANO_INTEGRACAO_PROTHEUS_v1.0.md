# PLANO DE INTEGRAÇÃO PROTHEUS v1.0

**Data:** 24/11/2025
**Status:** AGUARDANDO APROVAÇÃO
**Autor:** Claude Code + Analista Clenio

---

## 1. RESUMO EXECUTIVO

Este plano descreve a integração bidirecional entre o **Sistema de Inventário** (aplicação auxiliar) e o **ERP Protheus** (sistema principal), com foco em:

1. **Gravar histórico completo** dos inventários no Protheus (tabela customizada ZIV)
2. **Gerar movimentações** de ajuste de estoque (SB7 - Inventário)
3. **Gerar transferências** entre armazéns (SD3 - Movimentação Interna)

---

## 2. ANÁLISE DAS TABELAS PROTHEUS

### 2.1 SB7 - Inventário Físico

| Campo | Descrição | Tipo | Tam | Obrig | Uso na Integração |
|-------|-----------|------|-----|-------|-------------------|
| **B7_FILIAL** | Filial do Sistema | C | 2 | ✅ | `store.code` |
| **B7_COD** | Código do Produto | C | 15 | ✅ | `product_code` |
| **B7_LOCAL** | Código do Armazém | C | 2 | ✅ | `warehouse` |
| **B7_DOC** | Número do documento | C | 9 | ✅ | Nome inventário (truncado) |
| **B7_DATA** | Data do inventário | D | 8 | ✅ | `closed_at` |
| **B7_QUANT** | Quantidade inventariada | N | 15,4 | | `counted_qty` (final) |
| **B7_DESC** | Descrição do produto | C | 50 | ✅ | `description` |
| **B7_TIPO** | Tipo do material | C | 2 | ✅ | Obtido do SB1 |
| **B7_LOTECTL** | Lote | C | 40 | | `lot_number` |
| **B7_NUMLOTE** | Sub-Lote | C | 6 | ✅ | "" (vazio) |
| **B7_DTVALID** | Data Validade Lote | D | 8 | ✅ | Obtido do SB8 |
| **B7_LOCALIZ** | Endereço | C | 15 | ✅ | "" (vazio) |
| **B7_NUMSERI** | Num de Serie | C | 20 | ✅ | "" (vazio) |
| B7_QTSEGUM | Qtde 2ª unidade | N | 15,4 | | 0 |
| B7_CONTAGE | Contagem (001, 002, 003) | C | 3 | | Ciclo atual |
| B7_STATUS | Status processamento | C | 1 | ✅ | "1" = Processado |
| B7_ORIGEM | Origem do Inventário | C | 15 | ✅ | "CAPUL_INV" |

### 2.2 SD3 - Movimentação Interna (Transferência)

| Campo | Descrição | Tipo | Tam | Obrig | Uso na Integração |
|-------|-----------|------|-----|-------|-------------------|
| **D3_FILIAL** | Filial do Sistema | C | 2 | ✅ | `store.code` |
| **D3_COD** | Código do Produto | C | 15 | ✅ | `product_code` |
| **D3_LOCAL** | Armazém Origem | C | 2 | ✅ | `source_warehouse` |
| **D3_TM** | Tipo de movimento | C | 3 | ✅ | "RE3" (saída) / "RE4" (entrada) |
| **D3_DOC** | Número do Documento | C | 9 | ✅ | Gerado sequencial |
| **D3_EMISSAO** | Data de Emissão | D | 8 | ✅ | Data atual |
| **D3_QUANT** | Quantidade | N | 15,4 | ✅ | `quantity` |
| **D3_UM** | Unidade de Medida | C | 2 | ✅ | Obtido do SB1 |
| D3_LOTECTL | Lote | C | 40 | ✅ | `lot_number` |
| D3_NUMLOTE | Sub-Lote | C | 6 | ✅ | "" (vazio) |
| D3_DTVALID | Validade Lote | D | 8 | ✅ | Obtido do SB8 |
| D3_LOCALIZ | Endereço | C | 15 | ✅ | "" (vazio) |
| D3_CF | Tipo Requisição | C | 3 | ✅ | "RE3"/"RE4" |
| D3_CONTA | Conta Contábil | C | 20 | ✅ | Obtido do SB1 |
| D3_CC | Centro de Custo | C | 9 | ✅ | "" ou padrão |
| D3_TIPO | Tipo material | C | 2 | ✅ | Obtido do SB1 |
| D3_GRUPO | Grupo do Produto | C | 4 | ✅ | Obtido do SB1 |
| D3_CUSTO1 | Custo | N | 14,2 | ✅ | `b2_cm1` |
| D3_USUARIO | Usuário | C | 25 | ✅ | `current_user.username` |
| D3_DESCRI | Descrição | C | 50 | ✅ | `description` |
| D3_OBS | Observação | C | 20 | ✅ | "INV:[nome]" |

---

## 3. TABELA CUSTOMIZADA ZIV010 - Histórico de Inventário

### 3.1 Justificativa

O Protheus é o ERP principal da empresa. Manter um histórico completo dos inventários dentro do Protheus permite:

- **Auditoria**: Rastrear todas as contagens realizadas
- **Relatórios**: Gerar relatórios integrados com outros módulos
- **Compliance**: Atender requisitos fiscais e de auditoria
- **Backup**: Dados protegidos pelo backup do ERP

### 3.2 Estrutura Proposta

```
Tabela: ZIV010 (Z + Inventário = ZIV)
Alias: ZIV
Descrição: Histórico de Inventários - Sistema Auxiliar
```

| Campo | Descrição | Tipo | Tam | Dec | Obrig | Browse |
|-------|-----------|------|-----|-----|-------|--------|
| **ZIV_FILIAL** | Filial | C | 2 | 0 | ✅ | Não |
| **ZIV_INVNOM** | Nome do Inventário | C | 50 | 0 | ✅ | Sim |
| **ZIV_INVDAT** | Data do Inventário | D | 8 | 0 | ✅ | Sim |
| **ZIV_ARMAZE** | Armazém Principal | C | 2 | 0 | ✅ | Sim |
| **ZIV_ARMCOM** | Armazém Comparativo | C | 2 | 0 | | Sim |
| **ZIV_TIPO** | Tipo (S=Simple/C=Comparativo) | C | 1 | 0 | ✅ | Sim |
| **ZIV_CODIGO** | Código do Produto | C | 15 | 0 | ✅ | Sim |
| **ZIV_DESCRI** | Descrição do Produto | C | 50 | 0 | | Sim |
| **ZIV_LOTECT** | Número do Lote | C | 40 | 0 | | Sim |
| **ZIV_LOTEFO** | Lote do Fornecedor | C | 40 | 0 | | |
| **ZIV_SALDO** | Saldo Sistema (Esperado) | N | 14 | 4 | | Sim |
| **ZIV_ENTPOS** | Entrega Posterior | N | 14 | 4 | | |
| **ZIV_CONT1** | 1ª Contagem | N | 14 | 4 | | Sim |
| **ZIV_CONT2** | 2ª Contagem | N | 14 | 4 | | |
| **ZIV_CONT3** | 3ª Contagem | N | 14 | 4 | | |
| **ZIV_USRC1** | Usuário 1ª Contagem | C | 30 | 0 | | |
| **ZIV_USRC2** | Usuário 2ª Contagem | C | 30 | 0 | | |
| **ZIV_USRC3** | Usuário 3ª Contagem | C | 30 | 0 | | |
| **ZIV_DATC1** | Data 1ª Contagem | D | 8 | 0 | | |
| **ZIV_DATC2** | Data 2ª Contagem | D | 8 | 0 | | |
| **ZIV_DATC3** | Data 3ª Contagem | D | 8 | 0 | | |
| **ZIV_HORAC1** | Hora 1ª Contagem | C | 8 | 0 | | |
| **ZIV_HORAC2** | Hora 2ª Contagem | C | 8 | 0 | | |
| **ZIV_HORAC3** | Hora 3ª Contagem | C | 8 | 0 | | |
| **ZIV_QTFINA** | Quantidade Final | N | 14 | 4 | | Sim |
| **ZIV_DIFERE** | Diferença (Contado - Saldo) | N | 14 | 4 | | Sim |
| **ZIV_VLRDIF** | Valor da Diferença (R$) | N | 14 | 2 | | Sim |
| **ZIV_CUSTOM** | Custo Médio Unitário | N | 14 | 4 | | |
| **ZIV_STATUS** | Status (C/P/D/Z) | C | 1 | 0 | | Sim |
| **ZIV_QTRANS** | Quantidade Transferida | N | 14 | 4 | | |
| **ZIV_ARMTRA** | Armazém Transferência | C | 2 | 0 | | |
| **ZIV_TIPTR** | Tipo Transf (E=Entrada/S=Saída) | C | 1 | 0 | | |
| **ZIV_ECONOM** | Economia Gerada (R$) | N | 14 | 2 | | |
| **ZIV_OBSERV** | Observações | C | 100 | 0 | | |
| **ZIV_USRINC** | Usuário Inclusão | C | 30 | 0 | | |
| **ZIV_DATINC** | Data Inclusão | D | 8 | 0 | | |
| **ZIV_HORINC** | Hora Inclusão | C | 8 | 0 | | |
| **ZIV_ORIGIN** | Sistema Origem | C | 20 | 0 | ✅ | |

**Total: 38 campos**

### 3.3 Índices

| Índice | Campos | Descrição |
|--------|--------|-----------|
| 1 (PK) | ZIV_FILIAL + ZIV_INVNOM + ZIV_CODIGO + ZIV_LOTECT + ZIV_ARMAZE | Chave única |
| 2 | ZIV_FILIAL + ZIV_INVDAT + ZIV_ARMAZE | Por data/armazém |
| 3 | ZIV_FILIAL + ZIV_CODIGO | Por produto |
| 4 | ZIV_FILIAL + ZIV_STATUS | Por status |

### 3.4 Valores do Campo ZIV_STATUS

| Valor | Descrição |
|-------|-----------|
| C | Conferido (sem divergência) |
| P | Pendente (não contado) |
| D | Divergente (diferença encontrada) |
| Z | Zero Confirmado (esperado=0, contado=0) |

---

## 4. FLUXO DE INTEGRAÇÃO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO DE INTEGRAÇÃO PROTHEUS                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ Sistema         │                                                        │
│  │ Inventário      │                                                        │
│  │ (PostgreSQL)    │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │ 1. GERAR JSON   │────►│ 2. VALIDAR      │────►│ 3. ENVIAR p/    │       │
│  │    Integração   │     │    Campos       │     │    PROTHEUS     │       │
│  └─────────────────┘     └─────────────────┘     └────────┬────────┘       │
│                                                           │                 │
│                          PROTHEUS                         ▼                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌─────────────────┐     ┌─────────────────┐     ┌────────────────┐ │  │
│  │  │ 4. GRAVAR       │────►│ 5. PROCESSAR    │────►│ 6. ATUALIZAR   │ │  │
│  │  │    ZIV010       │     │    SB7/SD3      │     │    ESTOQUE     │ │  │
│  │  │    (Histórico)  │     │    (Movimentos) │     │    (SB2)       │ │  │
│  │  └─────────────────┘     └─────────────────┘     └────────────────┘ │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ 7. RETORNAR     │                                                        │
│  │    Status       │                                                        │
│  │    (Docs gerados)│                                                       │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. MAPEAMENTO DE DADOS

### 5.1 Sistema Inventário → ZIV010 (Histórico)

| Campo Sistema | Campo ZIV | Observação |
|---------------|-----------|------------|
| `inventory_list.name` | ZIV_INVNOM | Nome do inventário |
| `inventory_list.closed_at` | ZIV_INVDAT | Data encerramento |
| `inventory_list.warehouse` | ZIV_ARMAZE | Armazém principal |
| `inventory_b.warehouse` | ZIV_ARMCOM | Armazém comparativo (se houver) |
| "S" ou "C" | ZIV_TIPO | Simple ou Comparativo |
| `inventory_item.product_code` | ZIV_CODIGO | Código produto |
| `snapshot.b1_desc` | ZIV_DESCRI | Descrição |
| `lot_snapshot.b8_lotectl` | ZIV_LOTECT | Lote |
| `lot_snapshot.b8_lotefor` | ZIV_LOTEFO | Lote fornecedor |
| `inventory_item.expected_quantity` | ZIV_SALDO | Saldo esperado |
| `snapshot.b2_xentpos` | ZIV_ENTPOS | Entrega posterior |
| `inventory_item.count_cycle_1` | ZIV_CONT1 | 1ª contagem |
| `inventory_item.count_cycle_2` | ZIV_CONT2 | 2ª contagem |
| `inventory_item.count_cycle_3` | ZIV_CONT3 | 3ª contagem |
| `counting.user (cycle=1)` | ZIV_USRC1 | Usuário 1ª contagem |
| `counting.user (cycle=2)` | ZIV_USRC2 | Usuário 2ª contagem |
| `counting.user (cycle=3)` | ZIV_USRC3 | Usuário 3ª contagem |
| `counting.created_at (cycle=1)` | ZIV_DATC1, ZIV_HORAC1 | Data/hora 1ª contagem |
| `counting.created_at (cycle=2)` | ZIV_DATC2, ZIV_HORAC2 | Data/hora 2ª contagem |
| `counting.created_at (cycle=3)` | ZIV_DATC3, ZIV_HORAC3 | Data/hora 3ª contagem |
| COALESCE(cycle_3, cycle_2, cycle_1, 0) | ZIV_QTFINA | Quantidade final |
| counted - expected | ZIV_DIFERE | Diferença |
| diff * b2_cm1 | ZIV_VLRDIF | Valor da diferença |
| `snapshot.b2_cm1` | ZIV_CUSTOM | Custo médio |
| Calculado | ZIV_STATUS | C/P/D/Z |
| `transfer_qty` | ZIV_QTRANS | Qtd transferida |
| `transfer_warehouse` | ZIV_ARMTRA | Armazém transferência |
| `transfer_type` | ZIV_TIPTR | E=Entrada, S=Saída |
| `economia` | ZIV_ECONOM | Economia gerada |
| `current_user.username` | ZIV_USRINC | Usuário inclusão |
| NOW() | ZIV_DATINC, ZIV_HORINC | Data/hora inclusão |
| "CAPUL_INV" | ZIV_ORIGIN | Sistema origem |

### 5.2 Sistema Inventário → SB7 (Inventário Físico)

| Campo Sistema | Campo SB7 | Observação |
|---------------|-----------|------------|
| `store.code` | B7_FILIAL | Filial |
| `product_code` | B7_COD | Código produto |
| `warehouse` | B7_LOCAL | Armazém |
| `inventory_list.name` (9 chars) | B7_DOC | Documento |
| `closed_at` | B7_DATA | Data inventário |
| Final counted qty | B7_QUANT | Quantidade contada |
| `description` | B7_DESC | Descrição |
| SB1.B1_TIPO | B7_TIPO | Tipo material |
| `lot_number` | B7_LOTECTL | Lote |
| "" | B7_NUMLOTE | Sub-lote (vazio) |
| SB8.B8_DTVALID | B7_DTVALID | Validade lote |
| "" | B7_LOCALIZ | Endereço (vazio) |
| "" | B7_NUMSERI | Num série (vazio) |
| current_cycle | B7_CONTAGE | "001", "002", "003" |
| "1" | B7_STATUS | Processado |
| "CAPUL_INV" | B7_ORIGEM | Origem |

### 5.3 Sistema Inventário → SD3 (Transferência)

| Campo Sistema | Campo SD3 | Observação |
|---------------|-----------|------------|
| `store.code` | D3_FILIAL | Filial |
| `product_code` | D3_COD | Código produto |
| `source_warehouse` | D3_LOCAL | Armazém origem |
| "RE3" (saída) / "RE4" (entrada) | D3_TM | Tipo movimento |
| `transfer_doc` (gerado) | D3_DOC | Documento |
| NOW() | D3_EMISSAO | Data emissão |
| `quantity` | D3_QUANT | Quantidade |
| SB1.B1_UM | D3_UM | Unidade medida |
| `lot_number` | D3_LOTECTL | Lote |
| "" | D3_NUMLOTE | Sub-lote |
| SB8.B8_DTVALID | D3_DTVALID | Validade |
| "" | D3_LOCALIZ | Endereço |
| SB1.B1_CONTA | D3_CONTA | Conta contábil |
| "" | D3_CC | Centro custo |
| SB1.B1_TIPO | D3_TIPO | Tipo material |
| SB1.B1_GRUPO | D3_GRUPO | Grupo |
| `b2_cm1` | D3_CUSTO1 | Custo médio |
| `current_user` | D3_USUARIO | Usuário |
| `description` | D3_DESCRI | Descrição |
| "INV:" + nome | D3_OBS | Observação |

---

## 6. REGRAS DE NEGÓCIO

### 6.1 Geração de Inventário (SB7)

1. **Apenas divergências**: Só gerar SB7 para produtos com diferença (contado ≠ esperado)
2. **Lotes**: Se produto tem rastreio de lote (B1_RASTRO = "L"), gerar uma linha por lote
3. **Ciclo**: Usar o último ciclo válido (3 > 2 > 1) como quantidade final
4. **Documento**: Usar primeiros 9 caracteres do nome do inventário
5. **Contagem**: Informar qual ciclo está sendo processado (001/002/003)

### 6.2 Geração de Transferência (SD3)

1. **Apenas modo comparativo**: Só gerar SD3 quando houver transferência lógica entre armazéns
2. **Par de lançamentos**: Sempre gerar 2 registros (saída origem + entrada destino)
3. **TM = RE3**: Saída do armazém origem
4. **TM = RE4**: Entrada no armazém destino
5. **Mesmo documento**: Usar mesmo D3_DOC para os dois lançamentos
6. **Lotes**: Se produto tem rastreio, gerar transferência por lote

### 6.3 Histórico (ZIV010)

1. **Sempre gravar**: Gravar TODOS os produtos do inventário, não apenas divergentes
2. **Por lote**: Se produto tem lote, gerar uma linha por lote
3. **Contagens**: Preservar histórico de todas as 3 contagens (se houver)
4. **Usuários**: Identificar quem contou cada ciclo
5. **Data/Hora**: Registrar data e hora exatas de cada contagem
6. **Chave única**: FILIAL + INVNOM + CODIGO + LOTECT + ARMAZE

---

## 7. API DE INTEGRAÇÃO

### 7.1 Endpoint Proposto (Sistema Inventário)

```
POST /api/v1/integration/protheus/send
```

**Request Body:**
```json
{
  "inventory_id": "uuid",
  "inventory_b_id": "uuid (opcional)",
  "integration_type": "SIMPLE" | "COMPARATIVE",
  "generate_sb7": true,
  "generate_sd3": true,
  "generate_ziv": true
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-11-24T10:00:00",
  "protheus": {
    "ziv_records": 150,
    "sb7_doc": "INV001234",
    "sb7_records": 45,
    "sd3_doc": "TRF001234",
    "sd3_records": 20
  },
  "summary": {
    "total_products": 150,
    "with_divergence": 45,
    "with_transfer": 10
  }
}
```

### 7.2 API Protheus (A ser desenvolvida)

Opção A: **WebService REST** (recomendado)
```
POST https://apiportal.capul.com.br/rest/api/INVENTARIO/integrar
```

Opção B: **Insert direto via DB-Link ou conexão Oracle**

---

## 8. CRONOGRAMA DE IMPLEMENTAÇÃO

| Fase | Descrição | Dependências |
|------|-----------|--------------|
| **1** | Criar tabela ZIV010 no Protheus (SX3, SX2, SIX) | Analista Protheus |
| **2** | Criar API REST no Protheus para receber dados | Analista Protheus |
| **3** | Implementar endpoint de envio no Sistema Inventário | Desenvolvedor |
| **4** | Testes em ambiente de homologação (CAPULHLG) | QA |
| **5** | Validação com usuários | Usuários chave |
| **6** | Deploy em produção (CAPULBI) | Aprovação gestão |

---

## 9. PONTOS DE DECISÃO

### 9.1 Decisões Pendentes

| # | Decisão | Opções | Recomendação |
|---|---------|--------|--------------|
| 1 | Nome da tabela customizada | ZIV, ZIN, ZW1 | **ZIV** (mais intuitivo) |
| 2 | Método de integração | API REST vs DB-Link | **API REST** (mais seguro) |
| 3 | Momento da integração | Manual vs Automático | **Manual** (usuário controla) |
| 4 | Geração de SB7/SD3 | Automática vs Revisão | **Revisão** (preview antes) |
| 5 | Armazenar JSON original? | Sim/Não | **Sim** (campo MEMO ZIV_JSON) |

### 9.2 Próximos Passos

1. **Você aprova** este plano?
2. **Qual nome** prefere para a tabela? (ZIV, ZIN, outro?)
3. **Há campos adicionais** que devem ser incluídos na ZIV010?
4. **A API REST** já existe ou precisamos criá-la no Protheus?
5. **Quem será o analista Protheus** responsável pela criação da tabela?

---

## 10. ANEXOS

### 10.1 Script de Criação da ZIV010 (Exemplo para SX3)

```sql
-- Este script é apenas exemplo. A criação real deve ser feita via SIGACFG.
-- Incluído para referência dos campos e tipos.

-- Verificar se a tabela ZIV já existe
SELECT COUNT(*) FROM SX2010 WHERE X2_CHAVE = 'ZIV';

-- Se não existir, criar via SIGACFG > Dicionário > Tabelas
-- Alias: ZIV
-- Descrição: Histórico Inventário Sistema Auxiliar
-- Path: \DATA\
```

### 10.2 Dados do Ambiente

| Ambiente | Banco | Host | Service |
|----------|-------|------|---------|
| Homologação | CAPULHLG | 192.168.7.92:1521 | capulhlg |
| Produção | CAPULBI | 192.168.7.92:1521 | capulbi |
| Migração | CAPULMIG | 192.168.7.92:1521 | capulmig |

---

**Documento gerado em:** 24/11/2025
**Versão:** 1.0
**Status:** AGUARDANDO APROVAÇÃO

---

## APROVAÇÃO

| Nome | Função | Data | Assinatura |
|------|--------|------|------------|
| | Analista de Sistemas | | |
| | Analista Protheus | | |
| | Gestor TI | | |
