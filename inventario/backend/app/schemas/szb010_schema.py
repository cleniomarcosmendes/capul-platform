"""
Schemas Pydantic para SZB010 (Armazéns/Locais do Protheus)
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime


# ========================================
# Schema de Entrada - Importação de SZB010
# ========================================

class SZB010ImportItem(BaseModel):
    """Schema para importação de um item SZB010 do Protheus"""
    zb_filial: str = Field(..., min_length=2, max_length=2, description="Código da filial (2 caracteres)")
    zb_xlocal: str = Field(..., min_length=1, max_length=2, description="Código do armazém (até 2 caracteres)")
    zb_xdesc: str = Field(..., min_length=1, max_length=30, description="Descrição do armazém (até 30 caracteres)")

    @validator('zb_filial', 'zb_xlocal')
    def validate_uppercase(cls, v):
        """Converte para maiúsculas"""
        return v.upper().strip()

    @validator('zb_xdesc')
    def validate_description(cls, v):
        """Remove espaços extras"""
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "zb_filial": "01",
                "zb_xlocal": "01",
                "zb_xdesc": "ESTOQUE GERAL"
            }
        }


class SZB010ImportRequest(BaseModel):
    """Schema para requisição de importação em lote"""
    data: List[SZB010ImportItem] = Field(..., min_items=1, description="Lista de armazéns a importar")

    class Config:
        json_schema_extra = {
            "example": {
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
                    }
                ]
            }
        }


# ========================================
# Schema de Saída - Resposta
# ========================================

class SZB010Response(BaseModel):
    """Schema de resposta de um armazém SZB010"""
    zb_filial: str
    zb_xlocal: str
    zb_xdesc: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Substitui orm_mode no Pydantic v2


class SZB010ImportResponse(BaseModel):
    """Schema de resposta da importação"""
    success: bool
    message: str
    total_received: int
    total_inserted: int
    total_updated: int
    total_errors: int
    warehouses_created: int = 0  # Quantos warehouses foram criados
    errors: Optional[List[str]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Importação concluída com sucesso",
                "total_received": 5,
                "total_inserted": 3,
                "total_updated": 2,
                "total_errors": 0,
                "warehouses_created": 5,
                "errors": None
            }
        }


# ========================================
# Schema de Listagem
# ========================================

class SZB010ListResponse(BaseModel):
    """Schema para listagem de armazéns"""
    total: int
    data: List[SZB010Response]

    class Config:
        json_schema_extra = {
            "example": {
                "total": 2,
                "data": [
                    {
                        "zb_filial": "01",
                        "zb_xlocal": "01",
                        "zb_xdesc": "ESTOQUE GERAL",
                        "created_at": "2025-10-20T18:00:00Z",
                        "updated_at": None
                    }
                ]
            }
        }
