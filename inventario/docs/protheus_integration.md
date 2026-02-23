# Integração com Tabelas Protheus

## Conceito de Inventário

**IMPORTANTE**: Um inventário físico é realizado em um **LOCAL/ARMAZÉM específico**. 
- Uma filial pode ter múltiplos locais/armazéns
- O mesmo produto pode ter saldo em diferentes locais
- A contagem física é feita por LOCAL

## Tabelas de Saldo

### SB2010 - Saldos Físicos por Local
**Usado para:** Produtos SEM controle de lote
- **B2_FILIAL**: Código da filial
- **B2_COD**: Código do produto
- **B2_LOCAL**: Armazém/Local de estoque ⚠️ **CHAVE IMPORTANTE**
- **B2_QATU**: Quantidade atual em estoque **neste local**
- **B2_RESERVA**: Quantidade reservada
- **B2_QEMP**: Quantidade empenhada

### SB8010 - Saldos por Lote e Local
**Usado para:** Produtos COM controle de lote
- **B8_FILIAL**: Código da filial
- **B8_PRODUTO**: Código do produto
- **B8_LOCAL**: Armazém/Local de estoque ⚠️ **CHAVE IMPORTANTE**
- **B8_LOTECTL**: Número do lote
- **B8_NUMLOTE**: Sequência do lote
- **B8_SALDO**: Saldo do lote **neste local**
- **B8_DTVALID**: Data de validade do lote

## Fluxo de Inventário

### 1. Criar Inventário
- Definir **FILIAL** e **LOCAL** do inventário
- Exemplo: Inventário do Armazém "01" da Filial "01"

### 2. Produtos SEM Controle de Lote
```sql
-- Buscar quantidade esperada para o LOCAL do inventário
SELECT B2_QATU 
FROM SB2010 
WHERE B2_FILIAL = :filial 
  AND B2_COD = :produto 
  AND B2_LOCAL = :local_inventario  -- LOCAL específico do inventário
  AND D_E_L_E_T_ = ' '
```

### 3. Produtos COM Controle de Lote
```sql
-- Buscar saldos por lote para o LOCAL do inventário
SELECT B8_LOTECTL, B8_SALDO, B8_DTVALID
FROM SB8010
WHERE B8_FILIAL = :filial
  AND B8_PRODUTO = :produto
  AND B8_LOCAL = :local_inventario  -- LOCAL específico do inventário
  AND B8_SALDO > 0
  AND D_E_L_E_T_ = ' '
ORDER BY B8_DTVALID
```

## Observações Importantes

1. **Quantidade Esperada (expected_quantity)**:
   - Para produtos SEM lote: usar B2_QATU da SB2010
   - Para produtos COM lote: somar B8_SALDO de todos os lotes ativos da SB8010

2. **Contagem de Produtos com Lote**:
   - Deve permitir contar múltiplos lotes do mesmo produto
   - Cada lote deve ser contado separadamente
   - A soma dos lotes contados será comparada com a soma dos saldos esperados

3. **Campos de Controle**:
   - Sempre filtrar por `D_E_L_E_T_ = ' '` (registros não deletados)
   - Considerar o campo B2_LOCAL/B8_LOCAL para inventários por armazém

## Status de Implementação

- ✅ Sistema preparado para receber `expected_quantity`
- ✅ Validação de lote obrigatório quando produto tem controle
- ⏳ Contagem de múltiplos lotes por produto (pendente)
- ⏳ Integração direta com tabelas Protheus via API (pendente)