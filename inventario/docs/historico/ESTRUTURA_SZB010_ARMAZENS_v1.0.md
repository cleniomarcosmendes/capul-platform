# 🏭 ESTRUTURA - SZB010 (Armazéns/Locais) v1.0

**Data**: 20/10/2025
**Versão**: v1.0
**Status**: 📋 **DOCUMENTAÇÃO - NÃO IMPLEMENTAR**

---

## 📋 RESUMO

### Tabela Identificada
**SZB010** - Cadastro de Armazéns/Locais (Tabela Customizada do Protheus)

### Finalidade
Cadastro de armazéns/locais de estoque que serão usados nos inventários.

### Mapeamento
`SZB010` (Protheus) → `warehouses` (Sistema de Inventário)

---

## 🗂️ ESTRUTURA DA TABELA PROTHEUS

### Tabela: SZB010

```sql
CREATE TABLE inventario.szb010 (
    -- Chave Primária Composta
    zb_filial  VARCHAR(2)  NOT NULL,  -- Código da Filial
    zb_xlocal  VARCHAR(2)  NOT NULL,  -- Código do Local/Armazém

    -- Dados
    zb_xdesc   VARCHAR(30) NOT NULL,  -- Descrição do Armazém

    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    PRIMARY KEY (zb_filial, zb_xlocal)
);

-- Índices
CREATE INDEX idx_szb010_filial ON inventario.szb010(zb_filial);
CREATE INDEX idx_szb010_xlocal ON inventario.szb010(zb_xlocal);

-- Comentários
COMMENT ON TABLE inventario.szb010 IS 'Cadastro de Armazéns/Locais (Protheus)';
COMMENT ON COLUMN inventario.szb010.zb_filial IS 'Código da Filial (2 caracteres)';
COMMENT ON COLUMN inventario.szb010.zb_xlocal IS 'Código do Local/Armazém (2 caracteres)';
COMMENT ON COLUMN inventario.szb010.zb_xdesc IS 'Descrição do Armazém (30 caracteres)';
```

---

## 📝 DETALHAMENTO DOS CAMPOS

### **zb_filial** - Código da Filial
- **Tipo**: VARCHAR(2)
- **Obrigatório**: Sim
- **Formato**: Numérico com zeros à esquerda
- **Exemplo**: "01", "02", "10"
- **Validação**: Deve existir em `stores.code`
- **Uso**: Identificar a qual loja o armazém pertence

---

### **zb_xlocal** - Código do Local/Armazém
- **Tipo**: VARCHAR(2)
- **Obrigatório**: Sim
- **Formato**: Numérico ou alfanumérico (2 caracteres)
- **Exemplos**: "01", "02", "10", "99"
- **Uso**: Identificador único do armazém dentro da filial
- **Observação**: Mesmo código pode existir em filiais diferentes

**Exemplos de Códigos Típicos**:
```
"01" → Estoque Geral/Principal
"02" → Estoque Secundário
"03" → Estoque de Promoção
"10" → Estoque de Avariados
"99" → Estoque Virtual/Terceiros
```

---

### **zb_xdesc** - Descrição do Armazém
- **Tipo**: VARCHAR(30)
- **Obrigatório**: Sim
- **Formato**: Texto livre (máximo 30 caracteres)
- **Exemplos**:
  - "ESTOQUE GERAL"
  - "ESTOQUE DE MERCADO"
  - "ESTOQUE PROMOCIONAL"
  - "ESTOQUE AVARIADOS"
- **Uso**: Nome descritivo para exibição em telas

**Limitação**: Máximo 30 caracteres (curto!)
```
✅ "ESTOQUE GERAL"           (14 chars)
✅ "EST. MERCADO"             (12 chars)
⚠️ "ESTOQUE DE PRODUTOS PROMOCIONAIS" (35 chars - será truncado!)
```

---

## 📊 MODELO JSON PARA IMPORTAÇÃO

### JSON Básico

```json
{
  "zb_filial": "01",
  "zb_xlocal": "01",
  "zb_xdesc": "ESTOQUE GERAL"
}
```

### JSON com Múltiplos Armazéns

```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "zb_filial": "01",
      "zb_xlocal": "01",
      "zb_xdesc": "ESTOQUE GERAL"
    },
    {
      "zb_filial": "01",
      "zb_xlocal": "02",
      "zb_xdesc": "ESTOQUE DE MERCADO"
    },
    {
      "zb_filial": "01",
      "zb_xlocal": "03",
      "zb_xdesc": "ESTOQUE PROMOCIONAL"
    },
    {
      "zb_filial": "01",
      "zb_xlocal": "10",
      "zb_xdesc": "ESTOQUE AVARIADOS"
    },
    {
      "zb_filial": "01",
      "zb_xlocal": "99",
      "zb_xdesc": "ESTOQUE VIRTUAL"
    }
  ]
}
```

---

## 🔄 MAPEAMENTO PARA `warehouses`

### Relacionamento Direto

```
SZB010 (Protheus)                warehouses (Sistema)
─────────────────                ────────────────────
zb_filial     "01"        →      store_id (via lookup)
zb_xlocal     "01"        →      code
zb_xdesc      "ESTOQUE GERAL" →  name
(auto)                     →      description (opcional)
(auto)                     →      is_active = TRUE
(auto)                     →      created_at
```

### Exemplo de Transformação

**Entrada (SZB010)**:
```json
{
  "zb_filial": "01",
  "zb_xlocal": "02",
  "zb_xdesc": "ESTOQUE DE MERCADO"
}
```

**Saída (warehouses)**:
```json
{
  "id": "uuid-gerado",
  "code": "02",
  "name": "ESTOQUE DE MERCADO",
  "description": "Armazém 02 - ESTOQUE DE MERCADO",
  "store_id": "uuid-da-loja-01",
  "is_active": true,
  "created_at": "2025-10-20T16:00:00Z"
}
```

---

## 🔄 MAPEAMENTO INVERSO (SB2/SB8 → SZB)

### Relacionamento com Saldos

```
SZB010 (Cadastro de Armazéns)
    ↓ zb_xlocal
SB2010.b2_local (Saldos por Armazém)
    ↓ b2_local
SB8010.b8_local (Saldos por Lote)
```

**Validação Importante**:
```sql
-- Verificar se todos os armazéns em SB2 estão cadastrados em SZB
SELECT DISTINCT b2_local
FROM sb2010
WHERE b2_local NOT IN (SELECT zb_xlocal FROM szb010 WHERE zb_filial = '01')
  AND b2_filial = '01';

-- Resultado esperado: 0 linhas (todos armazéns cadastrados)
```

---

## 🎯 CASOS DE USO

### Caso 1: Armazéns de uma Filial

```sql
-- Listar todos os armazéns da filial 01
SELECT
    zb_xlocal AS codigo,
    zb_xdesc AS descricao,
    COUNT(sb2.b2_cod) AS total_produtos
FROM szb010
LEFT JOIN sb2010 sb2
    ON sb2.b2_local = szb010.zb_xlocal
    AND sb2.b2_filial = szb010.zb_filial
WHERE zb_filial = '01'
GROUP BY zb_xlocal, zb_xdesc
ORDER BY zb_xlocal;
```

**Resultado Esperado**:
```
codigo | descricao              | total_produtos
-------+------------------------+---------------
01     | ESTOQUE GERAL          | 4
02     | ESTOQUE DE MERCADO     | 994
03     | ESTOQUE PROMOCIONAL    | 282
10     | ESTOQUE AVARIADOS      | 10
```

### Caso 2: Armazém Sem Produtos

```sql
-- Armazéns cadastrados mas sem estoque
SELECT
    zb_xlocal,
    zb_xdesc
FROM szb010
WHERE zb_filial = '01'
  AND NOT EXISTS (
      SELECT 1 FROM sb2010
      WHERE b2_local = szb010.zb_xlocal
        AND b2_filial = szb010.zb_filial
        AND b2_qatu > 0
  );
```

**Uso**: Identificar armazéns inativos ou em desuso

---

## 📋 SCHEMA PYDANTIC

```python
# backend/app/schemas/protheus.py

from pydantic import BaseModel, Field, validator
from typing import Optional

class SZB010Schema(BaseModel):
    """
    Schema de validação para armazéns/locais (SZB010)
    """

    # Chave primária
    zb_filial: str = Field(..., max_length=2, description="Código da filial")
    zb_xlocal: str = Field(..., max_length=2, description="Código do local/armazém")

    # Dados
    zb_xdesc: str = Field(..., max_length=30, description="Descrição do armazém")

    @validator('zb_filial')
    def validate_filial(cls, v):
        """Valida código da filial"""
        if not v or len(v) > 2:
            raise ValueError("zb_filial deve ter no máximo 2 caracteres")
        return v.zfill(2)  # Preenche com zeros à esquerda

    @validator('zb_xlocal')
    def validate_xlocal(cls, v):
        """Valida código do armazém"""
        if not v or len(v) > 2:
            raise ValueError("zb_xlocal deve ter no máximo 2 caracteres")
        return v.zfill(2)

    @validator('zb_xdesc')
    def validate_xdesc(cls, v):
        """Valida descrição"""
        if not v or not v.strip():
            raise ValueError("zb_xdesc é obrigatório")
        if len(v) > 30:
            # Truncar se exceder limite
            return v[:30]
        return v.strip().upper()  # Normalizar uppercase

    class Config:
        json_schema_extra = {
            "example": {
                "zb_filial": "01",
                "zb_xlocal": "02",
                "zb_xdesc": "ESTOQUE DE MERCADO"
            }
        }
```

---

## 🔄 CÓDIGO DE IMPORTAÇÃO (Exemplo Teórico)

```python
# backend/app/services/warehouse_importer.py

from app.models.models import Warehouse, Store, SZB010
from app.schemas.protheus import SZB010Schema
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

class WarehouseImporter:
    """
    Importador de armazéns (SZB010 → warehouses)
    """

    def __init__(self, db: Session):
        self.db = db

    async def import_warehouses(self, data: list[dict]) -> dict:
        """
        Importa armazéns do Protheus

        Args:
            data: Lista de dicts com dados de SZB010

        Returns:
            Dict com estatísticas da importação
        """
        stats = {"total": 0, "inserted": 0, "updated": 0, "errors": 0}
        errors = []

        for record in data:
            try:
                # Validar com Pydantic
                validated = SZB010Schema(**record)

                # Buscar loja
                store = self.db.query(Store).filter_by(
                    code=validated.zb_filial
                ).first()

                if not store:
                    raise ValueError(f"Loja {validated.zb_filial} não encontrada")

                # Verificar se armazém já existe
                existing = self.db.query(Warehouse).filter_by(
                    code=validated.zb_xlocal,
                    store_id=store.id
                ).first()

                if existing:
                    # Atualizar
                    existing.name = validated.zb_xdesc
                    existing.description = f"Armazém {validated.zb_xlocal} - {validated.zb_xdesc}"
                    existing.updated_at = datetime.utcnow()
                    stats["updated"] += 1
                else:
                    # Inserir
                    new_warehouse = Warehouse(
                        id=uuid.uuid4(),
                        code=validated.zb_xlocal,
                        name=validated.zb_xdesc,
                        description=f"Armazém {validated.zb_xlocal} - {validated.zb_xdesc}",
                        store_id=store.id,
                        is_active=True,
                        created_at=datetime.utcnow()
                    )
                    self.db.add(new_warehouse)
                    stats["inserted"] += 1

                stats["total"] += 1

                # Commit a cada 10 registros
                if stats["total"] % 10 == 0:
                    self.db.commit()

            except Exception as e:
                stats["errors"] += 1
                errors.append({
                    "record": f"{record.get('zb_filial')}-{record.get('zb_xlocal')}",
                    "error": str(e)
                })
                logger.error(f"Erro ao importar armazém: {e}")

        # Commit final
        self.db.commit()

        return {
            "success": stats["errors"] == 0,
            "stats": stats,
            "errors": errors
        }
```

---

## 🔗 ENDPOINT DA API (Exemplo Teórico)

```python
# backend/app/api/v1/endpoints/import_protheus.py

@router.post("/import/szb010", summary="Importar Armazéns (SZB010)")
async def import_warehouses_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Importa cadastro de armazéns/locais (SZB010) da API do Protheus

    **Acesso**: Apenas ADMIN

    **Processo**:
    1. Busca dados de SZB010 da API externa
    2. Valida schema (filial, local, descrição)
    3. Faz UPSERT em warehouses
    4. Retorna estatísticas

    **Retorno**:
    ```json
    {
      "success": true,
      "stats": {
        "total": 5,
        "inserted": 3,
        "updated": 2,
        "errors": 0
      }
    }
    ```
    """

    try:
        # Buscar dados da API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.PROTHEUS_API_URL}/api/protheus/szb010",
                params={"filial": current_user.store.code},
                headers={"Authorization": f"Bearer {settings.PROTHEUS_API_KEY}"}
            )
            response.raise_for_status()
            data = response.json()

        # Importar
        importer = WarehouseImporter(db)
        result = await importer.import_warehouses(data.get("data", []))

        return result

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Erro ao conectar com API do Protheus: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao importar armazéns: {str(e)}"
        )
```

---

## 📊 INTEGRAÇÃO COM PLANO DE IMPORTAÇÃO

### Adicionar como FASE 0 (Pré-requisito)

```
FASE 0: Armazéns (PRIMEIRO) ⭐ CRÍTICO
└─ 0.1 → SZB010 (Cadastro de Armazéns)
         ↓
         ✅ Validação: Ao menos 1 armazém por loja ativa
         ✅ Validação: Todos códigos em SB2/SB8 existem em SZB

FASE 1: Tabelas Base
├─ 1.1 → SBM010 (Grupos)
├─ 1.2 → SZD010 (Categorias)
├─ 1.3 → SZE010 (Subcategorias)
└─ 1.4 → SZF010 (Segmentos)

FASE 2: Produtos
└─ 2.1 → SB1010 (Produtos)

FASE 3: Complementares
├─ 3.1 → SBZ010 (Indicadores)
├─ 3.2 → SLK010 (Códigos de Barras)
├─ 3.3 → DA1010 (Preços)
└─ 3.4 → SB2010 (Saldos por Armazém) ← Depende de SZB!

FASE 4: Especializada
└─ 4.1 → SB8010 (Saldos por Lote) ← Depende de SZB!
```

**Justificativa**:
- SZB010 deve ser importada **ANTES** de SB2010 e SB8010
- Frontend usa `warehouses` no modal de criação de inventário
- Validação: Todos `b2_local` e `b8_local` devem existir em SZB010

---

## ✅ VALIDAÇÕES CRÍTICAS

### Validação 1: Armazéns Órfãos em SB2

```sql
-- Verificar se há armazéns em SB2 sem cadastro em SZB
SELECT DISTINCT
    sb2.b2_filial,
    sb2.b2_local,
    COUNT(*) as qtd_produtos
FROM inventario.sb2010 sb2
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.szb010 szb
    WHERE szb.zb_filial = sb2.b2_filial
      AND szb.zb_xlocal = sb2.b2_local
)
GROUP BY sb2.b2_filial, sb2.b2_local
ORDER BY sb2.b2_filial, sb2.b2_local;

-- Resultado esperado: 0 linhas
```

### Validação 2: Armazéns Órfãos em SB8

```sql
-- Verificar se há armazéns em SB8 sem cadastro em SZB
SELECT DISTINCT
    sb8.b8_filial,
    sb8.b8_local,
    COUNT(*) as qtd_lotes
FROM inventario.sb8010 sb8
WHERE NOT EXISTS (
    SELECT 1 FROM inventario.szb010 szb
    WHERE szb.zb_filial = sb8.b8_filial
      AND szb.zb_xlocal = sb8.b8_local
)
GROUP BY sb8.b8_filial, sb8.b8_local
ORDER BY sb8.b8_filial, sb8.b8_local;

-- Resultado esperado: 0 linhas
```

### Validação 3: Armazéns em warehouses vs SZB

```sql
-- Verificar sincronização warehouses ↔ SZB010
SELECT
    w.code,
    w.name,
    szb.zb_xlocal,
    szb.zb_xdesc,
    CASE
        WHEN szb.zb_xlocal IS NULL THEN '❌ Não existe em SZB'
        WHEN w.name != szb.zb_xdesc THEN '⚠️ Nome divergente'
        ELSE '✅ OK'
    END AS status
FROM inventario.warehouses w
LEFT JOIN inventario.szb010 szb
    ON szb.zb_xlocal = w.code
    AND szb.zb_filial = (SELECT code FROM stores WHERE id = w.store_id)
ORDER BY w.code;
```

---

## 🎯 ORDEM DE EXECUÇÃO RECOMENDADA

### 1️⃣ **Importar SZB010 PRIMEIRO**
```bash
POST /api/v1/import/szb010
```

### 2️⃣ **Validar Importação**
```sql
SELECT COUNT(*) FROM warehouses;  -- Deve ser > 0
SELECT COUNT(*) FROM szb010;      -- Deve ser > 0
```

### 3️⃣ **Verificar Órfãos**
```sql
-- Executar queries de validação acima
```

### 4️⃣ **Só DEPOIS importar SB2/SB8**
```bash
POST /api/v1/import/sb2010
POST /api/v1/import/sb8010
```

---

## 📝 RESUMO

### Estrutura SZB010
```
zb_filial  VARCHAR(2)  PK  -- Filial
zb_xlocal  VARCHAR(2)  PK  -- Código do Armazém
zb_xdesc   VARCHAR(30)     -- Descrição
```

### Mapeamento
```
SZB010.zb_xlocal → warehouses.code
SZB010.zb_xdesc  → warehouses.name
```

### Prioridade
**FASE 0** - ANTES de tudo (pré-requisito para SB2/SB8)

---

**Documento criado em**: 20/10/2025
**Versão**: v1.0
**Status**: Pronto para implementação
**Tabela**: SZB010 ✅ IDENTIFICADA CORRETAMENTE
