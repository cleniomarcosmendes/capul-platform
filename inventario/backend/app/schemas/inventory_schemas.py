# backend/app/schemas/inventory_schemas.py

# ✅ CORREÇÃO DEFINITIVA: Não usar __future__.annotations com FastAPI
# FastAPI precisa avaliar annotations em runtime, não como strings
from pydantic import BaseModel, Field
from typing import List, Union, Optional
from datetime import datetime
from enum import Enum

# =================================
# ENUMS
# =================================

class InventoryStatus(str, Enum):
    """Status do inventário"""
    DRAFT = "DRAFT"               # Rascunho
    IN_PROGRESS = "IN_PROGRESS"   # Em progresso
    COMPLETED = "COMPLETED"       # Concluído
    CLOSED = "CLOSED"             # Fechado

class CountingStatus(str, Enum):
    """Status da contagem"""
    PENDING = "PENDING"           # Pendente
    COUNTED = "COUNTED"           # Contado
    REVIEWED = "REVIEWED"         # Revisado
    APPROVED = "APPROVED"         # Aprovado
    # DIVERGENT removido - não existe no enum do banco
    # ✅ CORREÇÃO: Usar apenas status válidos do enum do banco
    # Status válidos: PENDING, COUNTED, REVIEWED, APPROVED
    # Removidos: AWAITING_COUNT, ZERO_CONFIRMED, RECOUNT, FINAL_COUNT

# =================================
# SCHEMAS DE LISTA DE INVENTÁRIO
# =================================

class InventoryListCreate(BaseModel):
    """Schema para criar lista de inventário"""
    name: str = Field(..., min_length=3, max_length=100, description="Nome da lista")
    description: str = Field("", max_length=500, description="Descrição da lista")
    warehouse: str = Field(..., min_length=2, max_length=2, description="Código do armazém a ser inventariado")
    reference_date: Union[datetime, None] = Field(None, description="Data de referência")
    count_deadline: Union[datetime, None] = Field(None, description="Prazo para contagem")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Inventário Janeiro 2025",
                "description": "Inventário mensal dos produtos da loja",
                "warehouse": "01",
                "reference_date": "2025-01-15T08:00:00",
                "count_deadline": "2025-01-20T18:00:00"
            }
        }

class InventoryListUpdate(BaseModel):
    """Schema para atualizar lista de inventário"""
    name: Union[str, None] = Field(None, min_length=3, max_length=100)
    description: Union[str, None] = Field(None, max_length=500)
    status: Union[InventoryStatus, None] = None
    list_status: Union[str, None] = Field(None, max_length=20)  # ABERTA, EM_CONTAGEM, ENCERRADA
    reference_date: Union[datetime, None] = None
    count_deadline: Union[datetime, None] = None

class InventoryListResponse(BaseModel):
    """Schema de resposta para lista de inventário"""
    id: str  # UUID como string
    name: str
    description: str
    warehouse: str
    status: str
    list_status: str = "ABERTA"  # ✅ CORREÇÃO: Lista sempre inicia ABERTA
    current_cycle: int = 1  # ✅ CORREÇÃO: Adicionar campo current_cycle
    reference_date: Union[datetime, None] = None
    count_deadline: Union[datetime, None] = None
    store_id: str  # UUID como string
    created_by: str  # UUID como string
    created_at: datetime
    updated_at: Union[datetime, None] = None
    
    # Campos computados
    created_by_name: str = ""
    store_name: str = ""
    
    # Estatísticas calculadas
    total_items: int = 0
    counted_items: int = 0
    pending_items: int = 0
    progress_percentage: float = 0.0
    
    class Config:
        from_attributes = True

class InventoryListSummary(BaseModel):
    """Schema resumido para listagem"""
    id: int
    name: str
    status: str
    created_at: datetime
    total_items: int
    counted_items: int
    progress_percentage: float

class InventoryListPaginated(BaseModel):
    """Schema para lista paginada de inventários"""
    items: List[InventoryListSummary]
    total: int
    page: int
    size: int
    pages: int

# =================================
# SCHEMAS DE ITEM DE INVENTÁRIO
# =================================

class InventoryItemCreate(BaseModel):
    """Schema para criar item de inventário"""
    product_id: int = Field(..., description="ID do produto")
    expected_quantity: float = Field(0.0, ge=0, description="Quantidade esperada")
    sequence: Union[int, None] = Field(None, ge=1, description="Sequência do item")

class InventoryItemResponse(BaseModel):
    """Schema de resposta para item de inventário"""
    id: int
    inventory_list_id: int
    product_id: int
    sequence: int
    expected_quantity: float
    status: str
    last_counted_at: Union[datetime, None] = None
    last_counted_by: Union[int, None] = None
    created_at: datetime
    
    # Dados do produto relacionado
    product_code: str = ""
    product_name: str = ""
    product_unit: str = "UN"
    
    # Dados de contagem
    counted_quantity: float = 0.0
    variance: float = 0.0
    variance_percentage: float = 0.0
    count_rounds: int = 0
    
    class Config:
        from_attributes = True

class InventoryItemPaginated(BaseModel):
    """Schema para lista paginada de itens"""
    items: List[InventoryItemResponse]
    total: int
    page: int
    size: int
    pages: int

# =================================
# SCHEMAS DE CONTAGEM
# =================================

class CountingCreate(BaseModel):
    """Schema para registrar contagem"""
    quantity: float = Field(..., ge=0, description="Quantidade contada")
    lot_number: str = Field("", max_length=50, description="Número do lote")
    serial_number: str = Field("", max_length=50, description="Número de série")
    observation: str = Field("", max_length=500, description="Observações")
    location: str = Field("", max_length=100, description="Localização da contagem")
    
    class Config:
        json_schema_extra = {
            "example": {
                "quantity": 25.0,
                "lot_number": "L20250115",
                "serial_number": "",
                "observation": "Produto encontrado na prateleira A1",
                "location": "SETOR A - PRATELEIRA 1"
            }
        }

class CountingResponse(BaseModel):
    """Schema de resposta para contagem"""
    id: int
    inventory_item_id: int
    quantity: float
    lot_number: str
    serial_number: str
    observation: str
    location: str
    counted_by: int
    count_number: int
    created_at: datetime
    
    # Dados do contador
    counter_name: str = ""
    
    # Cálculos de diferença
    expected_quantity: float = 0.0
    variance: float = 0.0
    variance_percentage: float = 0.0
    
    class Config:
        from_attributes = True

class CountingHistory(BaseModel):
    """Schema para histórico de contagens"""
    inventory_item_id: int
    product_code: str
    product_name: str
    expected_quantity: float
    countings: List[CountingResponse]
    total_counted: float
    final_variance: float
    status: str

# =================================
# SCHEMAS DE RELATÓRIO
# =================================

class InventoryReport(BaseModel):
    """Schema para relatório de inventário"""
    inventory_list: InventoryListResponse
    summary: dict
    items_by_status: dict
    discrepancies: List[dict]
    top_variances: List[dict]
    
    class Config:
        json_schema_extra = {
            "example": {
                "inventory_list": {"id": 1, "name": "Inventário Jan 2025"},
                "summary": {
                    "total_items": 150,
                    "counted_items": 145,
                    "pending_items": 5,
                    "progress_percentage": 96.7,
                    "total_variance_value": -1250.50
                },
                "items_by_status": {
                    "PENDING": 5,
                    "COUNTED": 130,
                    "REVIEWED": 15
                },
                "discrepancies": [
                    {"product": "PROD001", "expected": 100, "counted": 95, "variance": -5}
                ],
                "top_variances": [
                    {"product": "PROD002", "variance_value": -500.00}
                ]
            }
        }

# =================================
# SCHEMAS DE OPERAÇÕES EM LOTE
# =================================

class BulkAddProducts(BaseModel):
    """Schema para adicionar produtos em lote"""
    product_ids: List[int] = Field(..., min_items=1, description="Lista de IDs dos produtos")
    auto_sequence: bool = Field(True, description="Sequência automática")
    start_sequence: int = Field(1, ge=1, description="Sequência inicial")
    include_zero_stock: bool = Field(True, description="Incluir produtos sem estoque")
    
    class Config:
        json_schema_extra = {
            "example": {
                "product_ids": [1, 2, 3, 4, 5],
                "auto_sequence": True,
                "start_sequence": 1,
                "include_zero_stock": True
            }
        }

class BulkAddResult(BaseModel):
    """Schema para resultado de adição em lote"""
    success: bool
    message: str
    items_added: int
    items_skipped: int
    skipped_products: List[dict]
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "5 produtos adicionados com sucesso ao inventário",
                "items_added": 5,
                "items_skipped": 0,
                "skipped_products": []
            }
        }

# =================================
# SCHEMAS DE BUSCA E FILTROS
# =================================

class InventoryListFilter(BaseModel):
    """Schema para filtros de busca de inventários"""
    status: Union[InventoryStatus, None] = None
    date_from: Union[datetime, None] = None
    date_to: Union[datetime, None] = None
    created_by: Union[int, None] = None
    search: str = Field("", description="Busca por nome ou descrição")

class InventoryItemFilter(BaseModel):
    """Schema para filtros de itens de inventário"""
    status: Union[CountingStatus, None] = None
    product_code: str = Field("", description="Código do produto")
    has_variance: Union[bool, None] = None
    counted_by: Union[int, None] = None
    search: str = Field("", description="Busca por código ou nome do produto")

# =================================
# SCHEMAS DE VALIDAÇÃO
# =================================

class InventoryValidation(BaseModel):
    """Schema para validação de inventário"""
    can_start: bool
    can_complete: bool
    can_close: bool
    issues: List[str]
    warnings: List[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "can_start": True,
                "can_complete": False,
                "can_close": False,
                "issues": ["5 itens ainda não foram contados"],
                "warnings": ["2 itens têm divergências significativas"]
            }
        }