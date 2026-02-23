"""
Schemas Pydantic para Armazéns
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class WarehouseBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=2, description="Código do armazém (2 caracteres)")
    name: str = Field(..., max_length=100, description="Nome do armazém")
    description: Optional[str] = Field(None, description="Descrição do armazém")
    is_active: bool = Field(default=True, description="Status do armazém")

class WarehouseCreate(WarehouseBase):
    store_id: UUID = Field(..., description="ID da loja")

class WarehouseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None

class WarehouseResponse(WarehouseBase):
    id: UUID
    store_id: UUID
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class WarehouseSimple(BaseModel):
    code: str
    name: str

    class Config:
        from_attributes = True