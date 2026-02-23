# 🔧 CORREÇÃO CRÍTICA: Códigos de Filial em Tabelas Exclusivas (v2.15.3)

**Data**: 28/10/2025
**Versão**: 2.15.3
**Tipo**: Bug Fix Crítico
**Impacto**: Alto - Sistema multi-filial não funcionava corretamente

---

## 📋 Resumo Executivo

O endpoint de importação de produtos (`/api/v1/import-produtos`) estava preenchendo **incorretamente** os códigos de filial nas tabelas exclusivas do Protheus, causando falha na listagem de produtos no modal "Adicionar Produtos".

**Problema**: Tabelas exclusivas (SB2010, SB8010, SBZ010) estavam com `filial = ''` (vazio) ao invés do código correto da filial.

**Solução**: Corrigir as funções de preparação de dados para usar o parâmetro `filial` recebido na requisição, respeitando a arquitetura de tabelas compartilhadas vs exclusivas do Protheus.

---

## 🏗️ Arquitetura do Protheus (Tabelas Compartilhadas vs Exclusivas)

### Tabelas COMPARTILHADAS
Todas as filiais veem os mesmos dados. O campo de filial **sempre fica vazio**.

| Tabela | Descrição | Campo Filial | Valor Correto |
|--------|-----------|--------------|---------------|
| **SB1010** | Cadastro de Produtos | `b1_filial` | `''` (vazio) |
| **SLK010** | Códigos de Barras | `slk_filial` | `''` (vazio) |

### Tabelas EXCLUSIVAS
Cada filial tem seus próprios dados. O campo de filial **deve conter o código da filial**.

| Tabela | Descrição | Campo Filial | Valor Correto |
|--------|-----------|--------------|---------------|
| **SB2010** | Saldo em Estoque | `b2_filial` | `'01'`, `'02'`, `'03'`... |
| **SB8010** | Saldo por Lote | `b8_filial` | `'01'`, `'02'`, `'03'`... |
| **SBZ010** | Indicadores de Produto | `bz_filial` | `'01'`, `'02'`, `'03'`... |

---

## 🔴 Problema Identificado

### Sintomas
1. Modal "Adicionar Produtos" retornava **0 produtos** após importação
2. Query SQL filtrava por `b2_filial = '02'` mas todos os registros tinham `b2_filial = ''`
3. INNER JOIN não encontrava correspondências

### Causa Raiz

O endpoint `/api/v1/import-produtos` estava usando **`produto.get("b1_filial")`** (campo vazio de tabela compartilhada) para preencher as tabelas exclusivas:

```python
# ❌ ANTES (ERRADO)
def _prepare_sb2010(produto: Dict[str, Any], armazem_data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "b2_cod": produto.get("b1_cod", "").strip(),
        "b2_filial": produto.get("b1_filial", "").strip(),  # ❌ Sempre vazio!
        "b2_local": armazem_data.get("b2_local", "").strip(),
        ...
    }
```

### Impacto nos Dados

Após importação, os dados ficavam assim:

```sql
-- SB2010 (Exclusiva) - ERRADO ❌
SELECT DISTINCT b2_filial, COUNT(*) FROM sb2010 GROUP BY b2_filial;
-- Resultado: '' (vazio) = 71.509 registros

-- SB8010 (Exclusiva) - ERRADO ❌
SELECT DISTINCT b8_filial, COUNT(*) FROM sb8010 GROUP BY b8_filial;
-- Resultado: '' (vazio) = 8 registros

-- SBZ010 (Exclusiva) - ERRADO ❌
SELECT DISTINCT bz_filial, COUNT(*) FROM sbz010 GROUP BY bz_filial;
-- Resultado: '' (vazio) = 58.405 registros
```

---

## ✅ Solução Implementada

### Arquivos Modificados

**1. `/backend/app/api/v1/endpoints/import_produtos.py`**

#### Alterações nas Funções de Preparação

**Função `_prepare_sb2010()`** (Linha 507-520):
```python
# ✅ DEPOIS (CORRETO)
def _prepare_sb2010(produto: Dict[str, Any], armazem_data: Dict[str, Any], filial: str) -> Dict[str, Any]:
    """
    Prepara dados de saldo por armazém para batch insert em SB2010

    ✅ v2.15.3: SB2010 é EXCLUSIVA - b2_filial deve ter o código da filial!
    """
    return {
        "b2_cod": produto.get("b1_cod", "").strip(),
        "b2_filial": filial.strip(),  # ✅ Usa o parâmetro da requisição
        "b2_local": armazem_data.get("b2_local", "").strip(),
        "b2_qatu": float(armazem_data.get("b2_qatu", 0)),
        "b2_vatu1": float(armazem_data.get("b2_vatu1", 0)),
        "b2_cm1": float(armazem_data.get("b2_cm1", 0))
    }
```

**Função `_prepare_sb8010()`** (Linha 523-537):
```python
def _prepare_sb8010(produto: Dict[str, Any], lote_data: Dict[str, Any], filial: str) -> Dict[str, Any]:
    """
    Prepara dados de lote para batch insert em SB8010

    ✅ v2.15.3: SB8010 é EXCLUSIVA - b8_filial deve ter o código da filial!
    """
    return {
        "b8_produto": produto.get("b1_cod", "").strip(),
        "b8_filial": filial.strip(),  # ✅ Usa o parâmetro da requisição
        "b8_local": lote_data.get("b8_local", "").strip(),
        "b8_lotectl": lote_data.get("b8_lotectl", "").strip(),
        "b8_numlote": lote_data.get("b8_numlote", "").strip() or "0",
        "b8_dtvalid": lote_data.get("b8_dtvalid", "").strip() or None,
        "b8_saldo": float(lote_data.get("b8_saldo", 0))
    }
```

**Função `_prepare_sbz010()`** (Linha 540-553):
```python
def _prepare_sbz010(produto: Dict[str, Any], indicador_data: Dict[str, Any], filial: str) -> Dict[str, Any]:
    """
    Prepara dados de indicador para batch insert em SBZ010

    ✅ v2.15.3: SBZ010 é EXCLUSIVA - bz_filial deve ter o código da filial!
    """
    return {
        "bz_cod": produto.get("b1_cod", "").strip(),
        "bz_filial": filial.strip(),  # ✅ Usa o parâmetro da requisição
        "bz_local": indicador_data.get("bz_local", "").strip(),
        "bz_xlocal1": indicador_data.get("bz_xlocal1", "").strip(),
        "bz_xlocal2": indicador_data.get("bz_xlocal2", "").strip(),
        "bz_xlocal3": indicador_data.get("bz_xlocal3", "").strip()
    }
```

#### Alterações nas Chamadas das Funções (Linhas 164-174)

```python
# ✅ v2.15.3: Preparar dados SB2010 (tabela EXCLUSIVA - passa código da filial)
for armazem_data in produto.get("armazens", []):
    sb2_batch.append(_prepare_sb2010(produto, armazem_data, filial))

# ✅ v2.15.3: Preparar dados SB8010 (tabela EXCLUSIVA - passa código da filial)
for lote_data in produto.get("lotes", []):
    sb8_batch.append(_prepare_sb8010(produto, lote_data, filial))

# ✅ v2.15.3: Preparar dados SBZ010 (tabela EXCLUSIVA - passa código da filial)
for indicador_data in produto.get("indicadores", []):
    sbz_batch.append(_prepare_sbz010(produto, indicador_data, filial))
```

**2. `/backend/app/main.py`** (Linhas 1557-1576)

Também foi necessário atualizar o endpoint `filter-products` para aceitar filial vazia **temporariamente** durante a migração:

```python
).outerjoin(
    SBZ010, and_(
        SB1010.b1_cod == SBZ010.bz_cod,
        or_(
            SBZ010.bz_filial == store_code_suffix,  # ✅ Filial correta
            SBZ010.bz_filial == '',                 # ✅ v2.15.2: Aceitar filial vazia (dados importados)
            SBZ010.bz_filial.is_(None)              # ✅ v2.15.2: Aceitar NULL
        )
    )
).join(  # INNER JOIN para garantir que apenas produtos com estoque no armazém apareçam
    SB2010, and_(
        func.trim(SB1010.b1_cod) == func.trim(SB2010.b2_cod),
        SB2010.b2_local == target_warehouse,
        or_(
            SB2010.b2_filial == store_code_suffix,  # ✅ Filial correta
            SB2010.b2_filial == '',                 # ✅ v2.15.2: Aceitar filial vazia (dados importados)
            SB2010.b2_filial.is_(None)              # ✅ v2.15.2: Aceitar NULL
        )
    )
)
```

---

## 🧪 Testes e Validação

### Procedimento de Teste

1. **Limpeza de Dados** (Script SQL executado):
```sql
BEGIN;
TRUNCATE TABLE inventario.sb1010 CASCADE;
TRUNCATE TABLE inventario.sb2010 CASCADE;
TRUNCATE TABLE inventario.sb8010 CASCADE;
TRUNCATE TABLE inventario.sbz010 CASCADE;
TRUNCATE TABLE inventario.slk010 CASCADE;
COMMIT;
```

2. **Reimportação**:
   - Filial: `02`
   - Armazém: `01`
   - Produtos importados: 42.877

3. **Validação dos Dados**:
```sql
SELECT
    'SB1010' as tabela, 'Compartilhada' as tipo, b1_filial, COUNT(*)
FROM inventario.sb1010
GROUP BY b1_filial
UNION ALL
SELECT
    'SB2010', 'Exclusiva', b2_filial, COUNT(*)
FROM inventario.sb2010
GROUP BY b2_filial
UNION ALL
SELECT
    'SB8010', 'Exclusiva', b8_filial, COUNT(*)
FROM inventario.sb8010
GROUP BY b8_filial
UNION ALL
SELECT
    'SBZ010', 'Exclusiva', bz_filial, COUNT(*)
FROM inventario.sbz010
GROUP BY bz_filial
UNION ALL
SELECT
    'SLK010', 'Compartilhada', slk_filial, COUNT(*)
FROM inventario.slk010
GROUP BY slk_filial
ORDER BY tabela;
```

### Resultado da Validação ✅

| Tabela | Tipo | Filial '02' | Filial '01' | Vazia (Compartilhada) | Status |
|--------|------|-------------|-------------|-----------------------|--------|
| **SB1010** | Compartilhada | - | - | 57.215 | ✅ CORRETO |
| **SB2010** | Exclusiva | 42.877 | 14.850 | - | ✅ CORRETO |
| **SB8010** | Exclusiva | 3 | 10.301 | - | ✅ CORRETO |
| **SBZ010** | Exclusiva | 42.877 | 14.850 | - | ✅ CORRETO |
| **SLK010** | Compartilhada | - | - | 166.870 | ✅ CORRETO |

### Teste Funcional

1. ✅ Modal "Adicionar Produtos" lista 42.877 produtos corretamente
2. ✅ Filtro por filial funciona corretamente
3. ✅ Sistema multi-filial isolando dados corretamente

---

## 📊 Comparação Antes vs Depois

### ANTES da Correção ❌

```
Filial 02, Armazém 01
├── SB1010 (Compartilhada): 57.215 produtos com b1_filial = '' ✅
├── SB2010 (Exclusiva): 71.509 produtos com b2_filial = '' ❌ ERRADO!
├── SB8010 (Exclusiva): 8 lotes com b8_filial = '' ❌ ERRADO!
├── SBZ010 (Exclusiva): 58.405 indicadores com bz_filial = '' ❌ ERRADO!
└── Modal "Adicionar Produtos": 0 produtos encontrados ❌
```

### DEPOIS da Correção ✅

```
Filial 02, Armazém 01
├── SB1010 (Compartilhada): 57.215 produtos com b1_filial = '' ✅
├── SB2010 (Exclusiva): 42.877 produtos com b2_filial = '02' ✅
├── SB8010 (Exclusiva): 3 lotes com b8_filial = '02' ✅
├── SBZ010 (Exclusiva): 42.877 indicadores com bz_filial = '02' ✅
└── Modal "Adicionar Produtos": 42.877 produtos encontrados ✅
```

---

## 🎯 Impacto e Benefícios

### Problemas Resolvidos
1. ✅ Modal "Adicionar Produtos" agora lista produtos corretamente
2. ✅ Sistema multi-filial funciona corretamente (isolamento de dados)
3. ✅ Cada filial vê apenas seus próprios estoques
4. ✅ Conformidade com arquitetura Protheus (compartilhadas vs exclusivas)

### Performance
- Nenhum impacto negativo de performance
- Queries continuam usando índices corretamente
- Batch insert mantém velocidade (2-3 minutos para 42.000 produtos)

---

## 🚀 Instruções de Deploy

### 1. Atualizar Código

```bash
# Backend já está atualizado com as correções
docker-compose restart backend
```

### 2. Limpar Dados Antigos (SE NECESSÁRIO)

⚠️ **ATENÇÃO**: Isso apaga todos os produtos! Use apenas se os dados estiverem incorretos.

```sql
BEGIN;
TRUNCATE TABLE inventario.sb1010 CASCADE;
TRUNCATE TABLE inventario.sb2010 CASCADE;
TRUNCATE TABLE inventario.sb8010 CASCADE;
TRUNCATE TABLE inventario.sbz010 CASCADE;
TRUNCATE TABLE inventario.slk010 CASCADE;
COMMIT;
```

### 3. Reimportar Produtos

Acesse `http://localhost/import.html` e importe novamente para cada filial.

---

## 📝 Notas Técnicas

### Por que não corrigir os dados existentes com UPDATE?

**Resposta**: Porque não sabemos qual código de filial era o correto para cada produto. A única fonte confiável de verdade é a API do Protheus, portanto reimportar é a solução mais segura.

### E se houver inventários em andamento?

**Resposta**: Os inventários usam **snapshot** (tabela `inventory_items_snapshot`), portanto os dados já capturados não serão afetados. Apenas novos inventários usarão os dados corrigidos.

### Posso remover o filtro `OR b2_filial = ''` do main.py?

**Resposta**: Sim, após confirmar que TODAS as filiais foram reimportadas corretamente, esse filtro pode ser removido para maior segurança.

---

## 🔗 Referências

- **Ticket**: Modal "Adicionar Produtos" não lista produtos para filial 02
- **Versão Anterior**: v2.15.2 (fix temporário com OR b2_filial = '')
- **Versão Atual**: v2.15.3 (fix definitivo no endpoint de importação)
- **Documentação Relacionada**:
  - [CLAUDE.md](CLAUDE.md) - Seção "Últimas Atualizações"
  - [import_produtos.py](backend/app/api/v1/endpoints/import_produtos.py) - Endpoint de importação

---

**Status**: ✅ RESOLVIDO
**Data de Resolução**: 28/10/2025
**Autor**: Claude Code
**Validado Por**: Usuário (teste funcional completo)
