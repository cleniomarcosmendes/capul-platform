# 🔍 DETALHAMENTO PROFUNDO - Tabelas Críticas do Protheus v1.0

**Data**: 20/10/2025
**Versão**: v1.0
**Status**: 📋 **DOCUMENTAÇÃO**

---

## 📋 TABELAS ANALISADAS

Este documento detalha **profundamente** as 3 tabelas mais críticas do sistema:

1. **SB1010** - Cadastro de Produtos (Tabela Mestre)
2. **SB2010** - Saldo em Estoque por Armazém (Dados Agregados)
3. **SB8010** - Saldo por Armazém e Lote (Dados Detalhados)

---

## 1️⃣ SB1010 - CADASTRO DE PRODUTOS

### 📊 Visão Geral

**Função**: Tabela mestre de produtos (equivalente à SB1 do Protheus)
**Importância**: 🔴 **CRÍTICA** - Base de todo o sistema
**Relacionamentos**: Hub central - conecta com TODAS as outras tabelas
**Volume Estimado**: 1.000 - 50.000 produtos (dependendo do cliente)

---

### 🗂️ Estrutura Completa da Tabela

```sql
CREATE TABLE inventario.sb1010 (
    -- Chave Primária Composta
    b1_filial  VARCHAR(10)  NOT NULL,  -- Código da Filial
    b1_cod     VARCHAR(50)  NOT NULL,  -- Código do Produto

    -- Identificação
    b1_codbar  VARCHAR(50),            -- Código de Barras Principal
    b1_desc    VARCHAR(100),           -- Descrição Curta

    -- Classificação
    b1_tipo    VARCHAR(2),             -- Tipo do Produto
    b1_um      VARCHAR(2),             -- Unidade de Medida
    b1_locpad  VARCHAR(10),            -- Armazém Padrão

    -- Hierarquia de Classificação
    b1_grupo   VARCHAR(10),            -- FK → SBM010.bm_grupo
    b1_xcatgor VARCHAR(10),            -- FK → SZD010.zd_xcod (Categoria)
    b1_xsubcat VARCHAR(10),            -- FK → SZE010.ze_xcod (Subcategoria)
    b1_xsegmen VARCHAR(10),            -- FK → SZF010.zf_xcod (Segmento)
    b1_xgrinve VARCHAR(10),            -- Grupo de Inventário (customizado)

    -- Controles
    b1_rastro  VARCHAR(1)  NOT NULL DEFAULT 'N',  -- Rastreabilidade

    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    PRIMARY KEY (b1_filial, b1_cod),
    CONSTRAINT fk_sb1_grupo FOREIGN KEY (b1_grupo)
        REFERENCES inventario.sbm010(bm_grupo)
);
```

---

### 📝 Detalhamento dos Campos

#### **b1_filial** - Código da Filial
- **Tipo**: VARCHAR(10)
- **Obrigatório**: Sim
- **Formato**: Numérico com zeros à esquerda ("01", "02", "10")
- **Exemplo**: "01" (Matriz), "02" (Filial Mercado)
- **Validação**: Deve existir na tabela `stores.code`
- **Uso**: Segregação multi-loja (cada filial tem seus próprios produtos)

**Regra de Negócio**:
```
Se b1_filial = "01" → Produto da Matriz
Se b1_filial = "02" → Produto do Mercado
```

---

#### **b1_cod** - Código do Produto
- **Tipo**: VARCHAR(50)
- **Obrigatório**: Sim
- **Formato**: Numérico com zeros à esquerda (8 dígitos típico)
- **Exemplo**: "00010001", "00010037", "00015210"
- **Validação**:
  - Único por filial (PK composta)
  - Mínimo 6 caracteres
  - Apenas alfanuméricos
- **Uso**: Identificador único do produto no sistema

**Exemplos Reais**:
```
"00010001" → Primeiro produto da linha 001
"00010037" → COLOSSO PULV.OF 25ML (produto real do sistema)
"00015210" → Produto da linha 152
```

---

#### **b1_codbar** - Código de Barras Principal
- **Tipo**: VARCHAR(50)
- **Obrigatório**: Não (produtos sem código de barras existem)
- **Formato**: EAN-13 (13 dígitos) ou EAN-8 (8 dígitos)
- **Exemplo**: "7891234567890"
- **Validação**:
  - Se preenchido, deve ter 8-50 caracteres
  - Deve ser único por filial (ou NULL)
  - Validação de checksum EAN (opcional)
- **Uso**: Leitura por scanner de código de barras

**Observação Importante**:
- Um produto pode ter **múltiplos** códigos de barras (tabela SLK010)
- Este campo é apenas o código de barras **principal**
- Códigos adicionais ficam em `SLK010.slk_codbar`

**Exemplo de Produto com Múltiplos Códigos**:
```
SB1010:
  b1_cod = "00010001"
  b1_codbar = "7891234567890"  ← Principal

SLK010:
  slk_produto = "00010001", slk_codbar = "7891234567891"  ← Adicional 1
  slk_produto = "00010001", slk_codbar = "7891234567892"  ← Adicional 2
```

---

#### **b1_desc** - Descrição do Produto
- **Tipo**: VARCHAR(100)
- **Obrigatório**: Não (mas recomendado)
- **Formato**: Texto livre, uppercase
- **Exemplo**: "COLOSSO PULV.OF 25ML"
- **Validação**:
  - Máximo 100 caracteres
  - Sem caracteres especiais (apenas A-Z, 0-9, espaços)
- **Uso**: Exibição em telas, relatórios, etiquetas

**Padrões Observados**:
```
"PRODUTO TESTE 1KG"
"OLEO DE SOJA 900ML PET"
"SABAO EM PO AZUL 1KG"
"COLOSSO PULV.OF 25ML"  ← Formato típico do Protheus
```

---

#### **b1_tipo** - Tipo do Produto
- **Tipo**: VARCHAR(2)
- **Obrigatório**: Não
- **Formato**: Código de 2 caracteres
- **Valores Possíveis**:
  - `"PA"` - Produto Acabado (mais comum)
  - `"MP"` - Matéria Prima
  - `"MC"` - Material de Consumo
  - `"PI"` - Produto Intermediário
  - `"ME"` - Mercadoria para Revenda
  - `"BN"` - Bem do Ativo
  - `"AI"` - Ativo Imobilizado
  - `"SV"` - Serviço
- **Uso**: Classificação contábil e fiscal

**Exemplo de Uso**:
```
Supermercado → Maioria "ME" (Mercadoria para Revenda)
Indústria    → Mix de "PA" (Produto Final) e "MP" (Insumos)
Posto Saúde  → "MC" (Material de Consumo) + "ME" (Medicamentos)
```

---

#### **b1_um** - Unidade de Medida
- **Tipo**: VARCHAR(2)
- **Obrigatório**: Não
- **Formato**: Código de 2 caracteres
- **Valores Possíveis**:
  - `"UN"` - Unidade (mais comum)
  - `"KG"` - Quilograma
  - `"LT"` - Litro
  - `"MT"` - Metro
  - `"M2"` - Metro Quadrado
  - `"CX"` - Caixa
  - `"PC"` - Peça
  - `"SC"` - Saco
  - `"FD"` - Fardo
  - `"PT"` - Pacote
- **Uso**: Controle de estoque e vendas

**Exemplo de Conversões**:
```
Produto: "ARROZ BRANCO"
  b1_um = "SC" (Saco de 5kg)
  Um. Secundária = "KG" (para fracionamento)

Produto: "REFRIGERANTE"
  b1_um = "UN" (Unidade)
  Embalagem = "CX" (12 unidades)
```

---

#### **b1_locpad** - Armazém Padrão
- **Tipo**: VARCHAR(10)
- **Obrigatório**: Não
- **Formato**: Código numérico com zeros ("01", "02", "10")
- **Exemplo**: "01"
- **Validação**: Deve existir como armazém válido
- **Uso**: Define onde o produto é estocado por padrão

**Armazéns Típicos**:
```
"01" → Estoque Geral
"02" → Estoque de Mercado
"03" → Estoque de Promoção
"10" → Estoque de Avariados
"99" → Estoque Virtual (não físico)
```

---

#### **b1_grupo** - Grupo do Produto
- **Tipo**: VARCHAR(10)
- **Obrigatório**: Não
- **Formato**: Código numérico com zeros
- **Exemplo**: "0001"
- **Validação**: FK → `SBM010.bm_grupo` (deve existir)
- **Uso**: Agrupamento de produtos para relatórios

**Hierarquia**:
```
SBM010 (Grupos)
  ↓
  0001 - ALIMENTOS
  0002 - BEBIDAS
  0003 - LIMPEZA
  0004 - HIGIENE
```

**Exemplo de Produto**:
```json
{
  "b1_cod": "00010001",
  "b1_desc": "ARROZ BRANCO 5KG",
  "b1_grupo": "0001"  ← Grupo ALIMENTOS
}
```

---

#### **b1_xcatgor, b1_xsubcat, b1_xsegmen** - Classificação Customizada
- **Tipo**: VARCHAR(10) cada
- **Obrigatório**: Não
- **Formato**: Código customizado pela empresa
- **Uso**: Classificação hierárquica em 3 níveis

**Hierarquia de Classificação**:
```
GRUPO (b1_grupo)
  ├── CATEGORIA (b1_xcatgor) ← SZD010
  │     ├── SUBCATEGORIA (b1_xsubcat) ← SZE010
  │     │     └── SEGMENTO (b1_xsegmen) ← SZF010
```

**Exemplo Prático**:
```
Produto: "REFRIGERANTE COLA 2L"

b1_grupo    = "0002"     (BEBIDAS)
b1_xcatgor  = "CAT001"   (REFRIGERANTES)
b1_xsubcat  = "SUB001"   (COM GÁS)
b1_xsegmen  = "SEG001"   (COLA)

Produto: "SUCO DE LARANJA 1L"

b1_grupo    = "0002"     (BEBIDAS)
b1_xcatgor  = "CAT002"   (SUCOS)
b1_xsubcat  = "SUB002"   (SEM GÁS)
b1_xsegmen  = "SEG002"   (CÍTRICOS)
```

---

#### **b1_xgrinve** - Grupo de Inventário
- **Tipo**: VARCHAR(10)
- **Obrigatório**: Não
- **Formato**: Código customizado
- **Exemplo**: "GRINV01"
- **Uso**: Agrupar produtos para inventário cíclico

**Estratégias de Inventário**:
```
"GRINV01" → Alta Rotação (inventário mensal)
"GRINV02" → Média Rotação (inventário trimestral)
"GRINV03" → Baixa Rotação (inventário semestral)
"GRINV99" → Não inventariáveis (serviços, virtuais)
```

---

#### **b1_rastro** - Controle de Rastreabilidade ⭐ CAMPO CRÍTICO
- **Tipo**: VARCHAR(1)
- **Obrigatório**: Sim (default 'N')
- **Valores Possíveis**:
  - `"L"` - Controle por LOTE (mais comum)
  - `"S"` - Controle por SÉRIE
  - `"N"` - SEM controle
- **Uso**: Define se produto precisa rastreamento

**Regras de Negócio CRÍTICAS**:

**Se b1_rastro = 'L' (Lote)**:
- ✅ Produto DEVE ter registros em `SB8010` (saldos por lote)
- ✅ Saldo REAL = `SUM(SB8010.b8_saldo)` (NÃO usar SB2010.b2_qatu)
- ✅ Contagem no inventário OBRIGA informar lote
- ✅ Modal de lotes deve ser exibido na interface

**Se b1_rastro = 'S' (Série)**:
- ✅ Cada item tem número de série único
- ✅ Controle individual (ex: celulares, notebooks)
- ⚠️ Não implementado no sistema atual

**Se b1_rastro = 'N' (Sem Rastreamento)**:
- ✅ Produto genérico sem controle especial
- ✅ Saldo = `SB2010.b2_qatu` (direto)
- ✅ Contagem simples sem informar lote

**Exemplo Prático**:
```json
// Produto COM lote (alimento com validade)
{
  "b1_cod": "00010037",
  "b1_desc": "COLOSSO PULV.OF 25ML",
  "b1_rastro": "L"  ← OBRIGA controle de lote
}

// SB8010 (deve ter registros):
[
  {
    "b8_produto": "00010037",
    "b8_lotectl": "LOTE2024001",
    "b8_saldo": 144.00,
    "b8_dtvalid": "2025-12-31"
  },
  {
    "b8_produto": "00010037",
    "b8_lotectl": "LOTE2024002",
    "b8_saldo": 144.00,
    "b8_dtvalid": "2026-03-15"
  }
]

// Saldo total CORRETO = 288.00 (soma dos lotes)
// SB2010.b2_qatu pode estar ERRADO (99999.00)!
```

---

### 🔗 Relacionamentos da SB1010

```
SB1010 (Produtos)
    ├─→ SBM010 (b1_grupo → bm_grupo)         [N:1] Grupo do Produto
    ├─→ SZD010 (b1_xcatgor → zd_xcod)        [N:1] Categoria
    ├─→ SZE010 (b1_xsubcat → ze_xcod)        [N:1] Subcategoria
    ├─→ SZF010 (b1_xsegmen → zf_xcod)        [N:1] Segmento
    ├─→ SBZ010 (b1_cod → bz_cod)             [1:N] Indicadores/Localizações
    ├─→ SB2010 (b1_cod → b2_cod)             [1:N] Saldos por Armazém
    ├─→ SB8010 (b1_cod → b8_produto)         [1:N] Saldos por Lote
    ├─→ SLK010 (b1_cod → slk_produto)        [1:N] Códigos de Barras
    └─→ DA1010 (b1_cod → da1_codpro)         [1:N] Preços
```

---

### 🎯 Casos de Uso - SB1010

#### Caso 1: Produto Simples (Sem Lote)
```json
{
  "b1_filial": "01",
  "b1_cod": "00010001",
  "b1_codbar": "7891234567890",
  "b1_desc": "CADERNO UNIVERSITARIO 100FL",
  "b1_tipo": "ME",
  "b1_um": "UN",
  "b1_locpad": "01",
  "b1_grupo": "0003",
  "b1_rastro": "N"  ← SEM rastreamento
}

// Saldo em SB2010:
{
  "b2_cod": "00010001",
  "b2_local": "01",
  "b2_qatu": 150.0000  ← ESTE É O SALDO CORRETO
}

// SB8010: NÃO TEM registros (rastro='N')
```

#### Caso 2: Produto com Lote (Alimento)
```json
{
  "b1_filial": "01",
  "b1_cod": "00010037",
  "b1_desc": "COLOSSO PULV.OF 25ML",
  "b1_tipo": "PA",
  "b1_um": "UN",
  "b1_locpad": "01",
  "b1_grupo": "0001",
  "b1_rastro": "L"  ← COM rastreamento por LOTE
}

// Saldo em SB2010:
{
  "b2_cod": "00010037",
  "b2_local": "01",
  "b2_qatu": 99999.0000  ← PODE ESTAR ERRADO! (BUG CONHECIDO)
}

// Saldo CORRETO em SB8010:
[
  {
    "b8_produto": "00010037",
    "b8_lotectl": "LOTE2024001",
    "b8_saldo": 144.0000,
    "b8_dtvalid": "2025-12-31"
  },
  {
    "b8_produto": "00010037",
    "b8_lotectl": "LOTE2024002",
    "b8_saldo": 144.0000,
    "b8_dtvalid": "2026-03-15"
  }
]

// Saldo REAL = SUM(b8_saldo) = 288.0000 ✅
```

#### Caso 3: Produto com Múltiplos Códigos de Barras
```json
// SB1010:
{
  "b1_cod": "00010050",
  "b1_codbar": "7891234567890",  ← Principal
  "b1_desc": "CHOCOLATE 200G",
  "b1_rastro": "N"
}

// SLK010 (códigos adicionais):
[
  {
    "slk_produto": "00010050",
    "slk_codbar": "7891234567891"  ← Embalagem individual
  },
  {
    "slk_produto": "00010050",
    "slk_codbar": "7891234567892"  ← Caixa com 12 unidades
  }
]

// Sistema deve buscar produto por QUALQUER código de barras!
```

---

### ⚠️ ARMADILHAS COMUNS - SB1010

#### ❌ Armadilha 1: Ignorar b1_rastro
```python
# ERRADO:
saldo = produto.sb2010.b2_qatu

# CORRETO:
if produto.b1_rastro == 'L':
    saldo = sum([lote.b8_saldo for lote in produto.sb8010])
else:
    saldo = produto.sb2010.b2_qatu
```

#### ❌ Armadilha 2: Não validar FK antes de inserir
```python
# ERRADO:
novo_produto = SB1010(
    b1_grupo="0999"  # Grupo não existe em SBM010!
)

# CORRETO:
grupo = db.query(SBM010).filter_by(bm_grupo=data['b1_grupo']).first()
if not grupo:
    raise ValueError(f"Grupo {data['b1_grupo']} não existe")
```

#### ❌ Armadilha 3: Buscar produto sem considerar filial
```python
# ERRADO:
produto = db.query(SB1010).filter_by(b1_cod="00010001").first()
# Pode retornar produto de OUTRA filial!

# CORRETO:
produto = db.query(SB1010).filter_by(
    b1_filial=user.store.code,
    b1_cod="00010001"
).first()
```

---

## 2️⃣ SB2010 - SALDO EM ESTOQUE POR ARMAZÉM

### 📊 Visão Geral

**Função**: Saldos agregados de estoque por produto e armazém (SEM detalhamento de lote)
**Importância**: 🔴 **CRÍTICA** - Base para consultas de estoque
**Relacionamentos**: Filho de SB1010
**Volume Estimado**: 10.000 - 500.000 registros

---

### 🗂️ Estrutura Completa da Tabela

```sql
CREATE TABLE inventario.sb2010 (
    -- Chave Primária Composta
    b2_filial  VARCHAR(10)   NOT NULL,  -- Código da Filial
    b2_cod     VARCHAR(50)   NOT NULL,  -- FK → SB1010.b1_cod
    b2_local   VARCHAR(10)   NOT NULL,  -- Código do Armazém

    -- Quantidades
    b2_qatu    NUMERIC(15,4),           -- Quantidade Atual
    b2_qemp    NUMERIC(15,4),           -- Quantidade Empenhada
    b2_reserva NUMERIC(15,4),           -- Quantidade Reservada

    -- Valores
    b2_vatu1   NUMERIC(15,2),           -- Valor Total do Estoque
    b2_cm1     NUMERIC(15,4),           -- Custo Médio Unitário

    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    PRIMARY KEY (b2_filial, b2_cod, b2_local)
);
```

---

### 📝 Detalhamento dos Campos

#### **b2_qatu** - Quantidade Atual ⭐ CAMPO MAIS USADO
- **Tipo**: NUMERIC(15,4)
- **Descrição**: Quantidade total em estoque (teórica)
- **Exemplo**: 150.0000
- **Uso**: Consulta rápida de estoque

**⚠️ ATENÇÃO - ARMADILHA CRÍTICA**:
```
Para produtos com b1_rastro='L':
  b2_qatu pode estar INCONSISTENTE!

Saldo CORRETO = SUM(SB8010.b8_saldo)
NÃO usar b2_qatu nesses casos!

Exemplo REAL do sistema:
  SB2010.b2_qatu = 99999.0000 ❌ ERRADO
  SUM(SB8010.b8_saldo) = 288.0000 ✅ CORRETO
```

#### **b2_qemp** - Quantidade Empenhada
- **Tipo**: NUMERIC(15,4)
- **Descrição**: Quantidade reservada para pedidos de venda
- **Exemplo**: 10.0000
- **Uso**: Calcular estoque disponível

#### **b2_reserva** - Quantidade Reservada
- **Tipo**: NUMERIC(15,4)
- **Descrição**: Quantidade reservada para ordens de produção
- **Exemplo**: 5.0000
- **Uso**: Calcular estoque disponível

**Fórmula de Estoque Disponível**:
```
estoque_disponivel = b2_qatu - b2_qemp - b2_reserva

Exemplo:
  b2_qatu = 150
  b2_qemp = 10 (vendido mas não faturado)
  b2_reserva = 5 (em produção)

  Disponível = 150 - 10 - 5 = 135 unidades
```

#### **b2_cm1** - Custo Médio Unitário
- **Tipo**: NUMERIC(15,4)
- **Descrição**: Custo médio ponderado do produto
- **Exemplo**: 30.5000
- **Uso**: Cálculo de valores de inventário

**Fórmula**:
```
b2_cm1 = b2_vatu1 / b2_qatu

Exemplo:
  b2_vatu1 = 4.575,00 (valor total)
  b2_qatu = 150 unidades

  b2_cm1 = 4.575 / 150 = 30,50 por unidade
```

---

### 🎯 Casos de Uso - SB2010

#### Caso 1: Produto em Múltiplos Armazéns
```json
// Um produto pode estar em vários armazéns
[
  {
    "b2_cod": "00010001",
    "b2_local": "01",  // Estoque Geral
    "b2_qatu": 100.0000
  },
  {
    "b2_cod": "00010001",
    "b2_local": "02",  // Estoque de Mercado
    "b2_qatu": 50.0000
  },
  {
    "b2_cod": "00010001",
    "b2_local": "10",  // Estoque de Avariados
    "b2_qatu": 5.0000
  }
]

// Saldo total = SUM(b2_qatu) = 155 unidades
```

---

## 3️⃣ SB8010 - SALDO POR ARMAZÉM E LOTE

### 📊 Visão Geral

**Função**: Saldos detalhados por lote (para produtos rastreáveis)
**Importância**: 🔴 **CRÍTICA** - Rastreabilidade e validade
**Relacionamentos**: Filho de SB1010 + SB2010
**Volume Estimado**: 5.000 - 1.000.000 registros (produtos × armazéns × lotes)

---

### 🗂️ Estrutura Completa da Tabela

```sql
CREATE TABLE inventario.sb8010 (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Chave de Negócio
    b8_filial  VARCHAR(10)   NOT NULL,
    b8_produto VARCHAR(50)   NOT NULL,  -- FK → SB1010.b1_cod
    b8_local   VARCHAR(10)   NOT NULL,
    b8_lotectl VARCHAR(50)   NOT NULL,  -- Número do Lote

    -- Dados do Lote
    b8_saldo   NUMERIC(15,4),           -- Saldo do Lote
    b8_dtvalid DATE,                    -- Data de Validade
    b8_numlote VARCHAR(20),             -- Número Sequencial

    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
```

---

### 📝 Detalhamento dos Campos

#### **b8_lotectl** - Número do Lote
- **Tipo**: VARCHAR(50)
- **Descrição**: Identificação do lote
- **Exemplo**: "LOTE2024001", "20241015A"
- **Formato**: Livre (definido pelo cliente)

#### **b8_saldo** - Saldo do Lote
- **Tipo**: NUMERIC(15,4)
- **Descrição**: Quantidade disponível no lote específico
- **Exemplo**: 144.0000

#### **b8_dtvalid** - Data de Validade
- **Tipo**: DATE
- **Descrição**: Quando o lote vence
- **Exemplo**: "2025-12-31"
- **Uso**: FIFO/FEFO (First Expired First Out)

---

### 🎯 Caso de Uso Completo - Produto com Lote

```json
// SB1010:
{
  "b1_cod": "00010037",
  "b1_desc": "COLOSSO PULV.OF 25ML",
  "b1_rastro": "L"  ← OBRIGA lotes
}

// SB2010 (agregado - pode estar errado):
{
  "b2_cod": "00010037",
  "b2_local": "01",
  "b2_qatu": 99999.0000  ❌ INCONSISTENTE
}

// SB8010 (detalhado - fonte da verdade):
[
  {
    "b8_produto": "00010037",
    "b8_local": "01",
    "b8_lotectl": "LOTE2024001",
    "b8_saldo": 144.0000,
    "b8_dtvalid": "2025-12-31"
  },
  {
    "b8_produto": "00010037",
    "b8_local": "01",
    "b8_lotectl": "LOTE2024002",
    "b8_saldo": 144.0000,
    "b8_dtvalid": "2026-03-15"
  }
]

// Saldo CORRETO:
SELECT SUM(b8_saldo)
FROM sb8010
WHERE b8_produto='00010037' AND b8_local='01'
-- Resultado: 288.0000 ✅
```

---

## 🔗 DIAGRAMA DE RELACIONAMENTOS (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│                  TABELAS DE CADASTRO                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │ SBM010   │   │ SZD010   │   │ SZE010   │   │ SZF010   ││
│  │ Grupos   │   │Categorias│   │Subcat    │   │Segmentos ││
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘│
│       │              │              │              │       │
└───────┼──────────────┼──────────────┼──────────────┼───────┘
        │              │              │              │
        │  b1_grupo    │  b1_xcatgor  │  b1_xsubcat  │  b1_xsegmen
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                             ↓
        ┌────────────────────────────────────────────────┐
        │            ⭐ SB1010 (HUB CENTRAL)            │
        │         Cadastro de Produtos                  │
        │  PK: (b1_filial, b1_cod)                     │
        │  b1_rastro: 'L'/'S'/'N'                      │
        └─────┬──────────────────┬──────────────┬───────┘
              │                  │              │
    ┌─────────┴────────┐  ┌──────┴──────┐  ┌───┴────────┐
    │                  │  │             │  │            │
┌───▼────┐      ┌──────▼──┐  ┌─────────▼──┐  ┌─────────▼──┐
│SBZ010  │      │SLK010   │  │DA1010      │  │SB2010      │
│Indicad.│      │Códigos  │  │Preços      │  │Saldos/Armaz│
│1:N     │      │Barras   │  │1:N         │  │1:N         │
└────────┘      │1:N      │  └────────────┘  └──────┬─────┘
                └─────────┘                         │
                                           ┌────────┴────────┐
                                           │                 │
                                     ┌─────▼──────┐   (Se b1_rastro='L')
                                     │  SB8010    │         │
                                     │Saldos/Lote │◄────────┘
                                     │1:N         │
                                     └────────────┘
```

---

**Documento criado em**: 20/10/2025
**Versão**: v1.0
**Status**: Documentação Técnica
**Próxima atualização**: Conforme necessário
