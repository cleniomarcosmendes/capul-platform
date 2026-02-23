# 🏭 ANÁLISE - Tabela WAREHOUSES (Armazéns) v1.0

**Data**: 20/10/2025
**Versão**: v1.0
**Status**: 📋 **ANÁLISE - NÃO IMPLEMENTAR**

---

## 📋 RESUMO

### Problema Identificado
A tabela `warehouses` existe no sistema mas está **VAZIA** (0 registros), porém é utilizada no frontend (modal de criação de inventário).

### Origem dos Dados
No Protheus, armazéns são identificados pelo campo **`B2_LOCAL`** (SB2010) e **`B8_LOCAL`** (SB8010), mas provavelmente existe uma tabela mestre de cadastro de armazéns.

---

## 🗂️ ESTRUTURA ATUAL DA TABELA

### Tabela: `inventario.warehouses`

```sql
CREATE TABLE inventario.warehouses (
    id          UUID PRIMARY KEY,
    code        VARCHAR(2)   NOT NULL,      -- Código do armazém (ex: "01", "02")
    name        VARCHAR(100) NOT NULL,      -- Nome do armazém
    description TEXT,                       -- Descrição detalhada
    store_id    UUID         NOT NULL,      -- FK → stores.id (loja)
    is_active   BOOLEAN      NOT NULL,      -- Armazém ativo
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE,

    CONSTRAINT warehouses_store_id_fkey
        FOREIGN KEY (store_id) REFERENCES inventario.stores(id)
);
```

### Campos

| Campo | Tipo | Descrição | Obrigatório | Origem no Protheus |
|-------|------|-----------|-------------|-------------------|
| `id` | UUID | Identificador único | Sim | Auto-gerado |
| `code` | VARCHAR(2) | Código do armazém | Sim | **B2_LOCAL** ou **NNR_CODIGO** |
| `name` | VARCHAR(100) | Nome/Descrição | Sim | **NNR_DESCRI** (se existir) |
| `description` | TEXT | Descrição detalhada | Não | - |
| `store_id` | UUID | Loja proprietária | Sim | Relacionamento interno |
| `is_active` | BOOLEAN | Armazém ativo | Sim | - |

---

## 🔍 TABELAS DO PROTHEUS RELACIONADAS

### Opção 1: NNR010 - Cadastro de Armazéns (Tabela Mestre)

**Se existir no Protheus**, a estrutura típica seria:

```sql
CREATE TABLE inventario.nnr010 (
    nnr_filial  VARCHAR(10) NOT NULL,  -- Filial
    nnr_codigo  VARCHAR(2)  NOT NULL,  -- Código do Armazém (PK)
    nnr_descri  VARCHAR(100),          -- Descrição do Armazém
    nnr_tipo    VARCHAR(1),            -- Tipo (1=Normal, 2=Virtual, etc)
    nnr_msblql  VARCHAR(1),            -- Bloqueado (1=Sim, 2=Não)
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (nnr_filial, nnr_codigo)
);
```

**Campos Importantes**:
- `nnr_codigo`: Código do armazém (ex: "01", "02", "10")
- `nnr_descri`: Descrição (ex: "ESTOQUE GERAL", "ESTOQUE DE MERCADO")
- `nnr_tipo`: Tipo do armazém
- `nnr_msblql`: Se está bloqueado (1) ou liberado (2)

---

### Opção 2: Extrair de SB2010 (Armazéns Distintos)

**Se NNR010 não existir**, podemos obter lista de armazéns a partir dos dados existentes:

```sql
-- Query para extrair armazéns únicos de SB2010
SELECT DISTINCT
    b2_filial,
    b2_local AS warehouse_code,
    COUNT(*) AS total_products
FROM inventario.sb2010
WHERE b2_qatu > 0  -- Apenas armazéns com estoque
GROUP BY b2_filial, b2_local
ORDER BY b2_filial, b2_local;
```

**Problema**: Essa abordagem não fornece o **nome** do armazém, apenas o código.

**Solução Temporária**: Criar nomes genéricos:
- "01" → "ESTOQUE GERAL"
- "02" → "ESTOQUE FILIAL 02"
- "10" → "ESTOQUE ESPECIALIZADO 10"

---

## 📊 MODELO JSON PARA IMPORTAÇÃO

### JSON para NNR010 (Se existir tabela mestre)

```json
{
  "nnr_filial": "01",
  "nnr_codigo": "01",
  "nnr_descri": "ESTOQUE GERAL",
  "nnr_tipo": "1",
  "nnr_msblql": "2"
}
```

**Mapeamento para `warehouses`**:
```python
{
  "code": data["nnr_codigo"],           # "01"
  "name": data["nnr_descri"],           # "ESTOQUE GERAL"
  "store_id": get_store_by_code(data["nnr_filial"]),
  "is_active": data["nnr_msblql"] == "2",  # 2=Não bloqueado
  "description": f"Armazém {data['nnr_codigo']} - {data['nnr_descri']}"
}
```

---

### JSON para SB2010 (Extração de armazéns únicos)

```json
{
  "b2_filial": "01",
  "b2_local": "01",
  "product_count": 1523
}
```

**Mapeamento para `warehouses`**:
```python
{
  "code": data["b2_local"],             # "01"
  "name": f"ARMAZÉM {data['b2_local']}", # Nome genérico
  "store_id": get_store_by_code(data["b2_filial"]),
  "is_active": True,
  "description": f"Armazém extraído de SB2010 - {data['product_count']} produtos"
}
```

---

## 🔄 ESTRATÉGIA DE IMPORTAÇÃO

### Estratégia 1: Importar de NNR010 (RECOMENDADO)

**Se a API do Protheus expor NNR010**:

```
API Protheus
  ↓
GET /api/protheus/nnr010?filial=01
  ↓
{
  "data": [
    {
      "nnr_filial": "01",
      "nnr_codigo": "01",
      "nnr_descri": "ESTOQUE GERAL",
      "nnr_tipo": "1",
      "nnr_msblql": "2"
    },
    {
      "nnr_filial": "01",
      "nnr_codigo": "02",
      "nnr_descri": "ESTOQUE DE MERCADO",
      "nnr_tipo": "1",
      "nnr_msblql": "2"
    }
  ]
}
  ↓
Backend (Importação)
  ↓
INSERT INTO inventario.warehouses
```

**Vantagens**:
- ✅ Nome correto do armazém
- ✅ Informações completas (tipo, bloqueio)
- ✅ Sincronizado com cadastro do Protheus

**Desvantagens**:
- ❌ Depende de NNR010 existir e ser exposto pela API

---

### Estratégia 2: Extrair de SB2010 (FALLBACK)

**Se NNR010 não existir**:

```sql
-- Query de extração
INSERT INTO inventario.warehouses (id, code, name, store_id, is_active)
SELECT
    gen_random_uuid() AS id,
    b2_local AS code,
    CONCAT('ARMAZÉM ', b2_local) AS name,
    s.id AS store_id,
    TRUE AS is_active
FROM (
    SELECT DISTINCT b2_filial, b2_local
    FROM inventario.sb2010
    WHERE b2_qatu > 0
) AS distinct_warehouses
JOIN inventario.stores s ON s.code = distinct_warehouses.b2_filial
ON CONFLICT DO NOTHING;
```

**Vantagens**:
- ✅ Não depende de tabela extra no Protheus
- ✅ Funciona com dados já existentes

**Desvantagens**:
- ❌ Nome genérico (não descritivo)
- ❌ Sem informações extras (tipo, bloqueio)

---

## 📝 EXEMPLO DE SCHEMA PYDANTIC

```python
# backend/app/schemas/protheus.py

from pydantic import BaseModel, Field
from typing import Optional

class NNR010Schema(BaseModel):
    """
    Schema para importação de armazéns (NNR010)
    """
    nnr_filial: str = Field(..., max_length=10, description="Código da filial")
    nnr_codigo: str = Field(..., max_length=2, description="Código do armazém")
    nnr_descri: Optional[str] = Field(None, max_length=100, description="Descrição")
    nnr_tipo: Optional[str] = Field("1", max_length=1, description="Tipo do armazém")
    nnr_msblql: Optional[str] = Field("2", max_length=1, description="Bloqueado?")

    @validator('nnr_codigo')
    def validate_codigo(cls, v):
        if len(v) > 2:
            raise ValueError("Código do armazém deve ter no máximo 2 caracteres")
        return v

    @validator('nnr_msblql')
    def validate_bloqueio(cls, v):
        if v not in ['1', '2']:
            return '2'  # Default: não bloqueado
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "nnr_filial": "01",
                "nnr_codigo": "01",
                "nnr_descri": "ESTOQUE GERAL",
                "nnr_tipo": "1",
                "nnr_msblql": "2"
            }
        }
```

---

## 🎯 CASOS DE USO

### Caso 1: Sistema com NNR010

```json
// API Protheus retorna:
{
  "data": [
    {
      "nnr_filial": "01",
      "nnr_codigo": "01",
      "nnr_descri": "ESTOQUE GERAL",
      "nnr_tipo": "1",
      "nnr_msblql": "2"
    },
    {
      "nnr_filial": "01",
      "nnr_codigo": "02",
      "nnr_descri": "ESTOQUE DE MERCADO",
      "nnr_tipo": "1",
      "nnr_msblql": "2"
    },
    {
      "nnr_filial": "01",
      "nnr_codigo": "10",
      "nnr_descri": "ESTOQUE DE AVARIADOS",
      "nnr_tipo": "1",
      "nnr_msblql": "1"
    }
  ]
}

// Após importação em warehouses:
SELECT id, code, name, is_active FROM warehouses;

id                  | code | name                      | is_active
--------------------+------+---------------------------+-----------
uuid-123            | 01   | ESTOQUE GERAL             | true
uuid-456            | 02   | ESTOQUE DE MERCADO        | true
uuid-789            | 10   | ESTOQUE DE AVARIADOS      | false
```

### Caso 2: Sistema SEM NNR010 (Extração de SB2010)

```sql
-- Armazéns detectados em SB2010:
SELECT DISTINCT b2_local FROM sb2010 WHERE b2_filial='01';

b2_local
---------
01
02
10
99

// Após importação genérica:
SELECT id, code, name FROM warehouses;

id                  | code | name
--------------------+------+-----------------------
uuid-123            | 01   | ARMAZÉM 01
uuid-456            | 02   | ARMAZÉM 02
uuid-789            | 10   | ARMAZÉM 10
uuid-abc            | 99   | ARMAZÉM 99
```

**Observação**: Nomes genéricos podem ser editados manualmente pelo usuário após importação.

---

## 🔗 RELACIONAMENTOS

```
stores (lojas)
    ↓ 1:N
warehouses (armazéns)
    ↓ 1:N
inventory_lists (inventários)
    ↓
    inventory_items → usa warehouse para filtrar produtos
```

**Regra de Negócio**:
- Cada loja pode ter **múltiplos armazéns** (1:N)
- Cada inventário é feito em **1 armazém específico**
- Produtos são filtrados por `SB2010.b2_local = inventory_lists.warehouse`

---

## ⚙️ INCLUSÃO NO PLANO DE IMPORTAÇÃO

### Adicionar como FASE 0 (Pré-requisito)

```
FASE 0: Armazéns (ANTES de tudo)
└─ 0.1 → NNR010 ou extração de SB2010
         ↓
         ✅ Validação: Ao menos 1 armazém por loja ativa

FASE 1: Tabelas Base
├─ 1.1 → SBM010 (Grupos)
├─ 1.2 → SZD010 (Categorias)
...
```

**Justificativa**:
- `warehouses` é usado pelo frontend no modal de criação de inventário
- Sem armazéns cadastrados, usuário não consegue criar inventário

---

## 📊 ENDPOINT DE IMPORTAÇÃO (Exemplo Teórico)

```python
# backend/app/api/v1/endpoints/import_protheus.py

@router.post("/import/nnr010", summary="Importar Armazéns (NNR010)")
async def import_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Importa cadastro de armazéns do Protheus

    **Tentativa 1**: Buscar NNR010 da API
    **Tentativa 2** (fallback): Extrair de SB2010

    **Retorno**:
    ```json
    {
      "success": true,
      "source": "NNR010",  // ou "SB2010"
      "stats": {
        "total": 4,
        "inserted": 4,
        "updated": 0
      }
    }
    ```
    """
    try:
        # Tentar NNR010 primeiro
        response = await fetch_protheus_data("nnr010", current_user.store.code)

        if response.get("total", 0) > 0:
            # Importar de NNR010
            return await import_from_nnr010(db, response, current_user)
        else:
            # Fallback: Extrair de SB2010
            return await extract_from_sb2010(db, current_user)

    except Exception as e:
        logger.error(f"Erro ao importar armazéns: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## ✅ RECOMENDAÇÕES

### Curto Prazo (Imediato)
1. ✅ **Verificar com equipe Protheus**: NNR010 existe e é exposto pela API?
2. ✅ **Testar endpoint**: `GET /api/protheus/nnr010?filial=01`
3. ✅ **Validar estrutura**: Confirmar campos de NNR010

### Médio Prazo (Após Validação)
1. ⏳ **Se NNR010 existir**: Implementar importação padrão
2. ⏳ **Se NNR010 NÃO existir**: Implementar extração de SB2010
3. ⏳ **Adicionar ao planejamento**: Como FASE 0 (pré-requisito)

### Longo Prazo
1. ⏳ **Permitir edição manual**: Interface para usuário ajustar nomes
2. ⏳ **Sincronização**: Atualizar armazéns periodicamente
3. ⏳ **Validação**: Alertar se inventário usa armazém inativo

---

## 🎯 PRÓXIMOS PASSOS

1. **Você deve verificar**: NNR010 existe no Protheus?
2. **Eu preciso saber**: Estrutura de campos de NNR010 (se existir)
3. **Definir estratégia**: NNR010 ou SB2010?
4. **Atualizar planejamento**: Incluir importação de armazéns

---

**Documento criado em**: 20/10/2025
**Versão**: v1.0
**Status**: Aguardando validação
**Decisão pendente**: NNR010 existe no Protheus?
