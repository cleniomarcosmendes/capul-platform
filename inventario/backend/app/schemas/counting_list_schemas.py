"""
Schemas Pydantic para listas de contagem múltiplas
"""

# ✅ CORREÇÃO DEFINITIVA: Não usar __future__.annotations com FastAPI
# FastAPI precisa avaliar annotations em runtime, não como strings
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class ListStatus(str, Enum):
    PREPARACAO = "PREPARACAO"
    ABERTA = "ABERTA"
    LIBERADA = "LIBERADA"
    EM_CONTAGEM = "EM_CONTAGEM"
    ENCERRADA = "ENCERRADA"


class CountingStatus(str, Enum):
    PENDING = "PENDING"
    COUNTED = "COUNTED"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"


# =================================
# COUNTING LIST SCHEMAS
# =================================

class CountingListBase(BaseModel):
    list_name: str = Field(..., description="Nome da lista (ex: Lista 1, Lista Setor A)")
    description: Optional[str] = Field(None, description="Descrição da lista")
    counter_cycle_1: Optional[UUID] = Field(None, description="Contador responsável pelo 1º ciclo")
    counter_cycle_2: Optional[UUID] = Field(None, description="Contador responsável pelo 2º ciclo")
    counter_cycle_3: Optional[UUID] = Field(None, description="Contador responsável pelo 3º ciclo")


class CountingListCreate(CountingListBase):
    """Schema para criar uma nova lista de contagem"""
    pass


class CountingListUpdate(BaseModel):
    """Schema para atualizar uma lista de contagem"""
    list_name: Optional[str] = None
    description: Optional[str] = None
    counter_cycle_1: Optional[UUID] = None
    counter_cycle_2: Optional[UUID] = None
    counter_cycle_3: Optional[UUID] = None
    list_status: Optional[ListStatus] = None


class CountingListResponse(CountingListBase):
    """Schema de resposta para lista de contagem"""
    id: UUID
    inventory_id: UUID
    current_cycle: int = Field(default=1, ge=1, le=3)
    list_status: ListStatus = Field(default=ListStatus.PREPARACAO)
    released_at: Optional[datetime] = None
    released_by: Optional[UUID] = None
    closed_at: Optional[datetime] = None
    closed_by: Optional[UUID] = None
    created_at: datetime
    created_by: UUID
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# =================================
# COUNTING LIST ITEM SCHEMAS
# =================================

class CountingListItemBase(BaseModel):
    """Base schema para itens de lista de contagem"""
    inventory_item_id: UUID = Field(..., description="ID do item do inventário")


class CountingListItemCreate(CountingListItemBase):
    """Schema para adicionar item a uma lista"""
    pass


class CountingListItemUpdate(BaseModel):
    """Schema para atualizar contagem de um item"""
    count_value: float = Field(..., ge=0, description="Valor da contagem")
    cycle_number: int = Field(..., ge=1, le=3, description="Número do ciclo")


class CountingListItemResponse(BaseModel):
    """Schema de resposta para item de lista"""
    id: UUID
    counting_list_id: UUID
    inventory_item_id: UUID
    needs_count_cycle_1: bool = True
    needs_count_cycle_2: bool = False
    needs_count_cycle_3: bool = False
    count_cycle_1: Optional[float] = None
    count_cycle_2: Optional[float] = None
    count_cycle_3: Optional[float] = None
    status: CountingStatus
    last_counted_at: Optional[datetime] = None
    last_counted_by: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# =================================
# COMPOSITE SCHEMAS
# =================================

class CountingListWithItems(CountingListResponse):
    """Lista de contagem com seus itens"""
    items: List[CountingListItemResponse] = []
    total_items: int = 0
    counted_items: int = 0
    pending_items: int = 0


class CountingListAssignment(BaseModel):
    """Schema para atribuição de produtos a listas"""
    list_id: UUID
    item_ids: List[UUID] = Field(..., min_items=1, description="IDs dos itens a atribuir")


class CountingListSummary(BaseModel):
    """Resumo de uma lista de contagem"""
    id: UUID
    list_name: str
    inventory_name: str
    current_cycle: int
    list_status: ListStatus
    total_items: int
    counted_items: int
    pending_items: int
    counter_name: Optional[str] = None
    progress_percentage: float = Field(default=0.0, ge=0, le=100)

    class Config:
        orm_mode = True


class InventoryWithLists(BaseModel):
    """Inventário com suas listas de contagem"""
    id: UUID
    name: str
    description: Optional[str]
    warehouse: str
    use_multiple_lists: bool = False
    total_lists: int = 0
    counting_lists: List[CountingListSummary] = []
    created_at: datetime
    status: str

    class Config:
        orm_mode = True


class BulkCountingListCreate(BaseModel):
    """Schema para criar múltiplas listas de uma vez"""
    inventory_id: UUID
    lists: List[CountingListCreate] = Field(..., min_items=1, description="Listas a criar")
    auto_distribute_items: bool = Field(
        default=False,
        description="Se True, distribui automaticamente os itens entre as listas"
    )


class CountingProgress(BaseModel):
    """Schema para progresso de contagem"""
    list_id: UUID
    list_name: str
    current_cycle: int
    total_cycles: int = 3
    items_progress: dict = Field(
        default={},
        description="Progresso por ciclo: {cycle_1: {total: X, counted: Y}, ...}"
    )
    overall_progress: float = Field(default=0.0, ge=0, le=100)
    status: ListStatus
    estimated_completion: Optional[datetime] = None