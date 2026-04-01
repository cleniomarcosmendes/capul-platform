"""
Schemas Pydantic - Validação de Dados
Sistema multi-loja para inventário físico integrado ao ERP Protheus
"""

# ✅ CORREÇÃO DEFINITIVA: Não usar __future__.annotations com FastAPI
# FastAPI precisa avaliar annotations em runtime, não como strings
from datetime import datetime
from typing import Union, List, Dict, Any, Optional
from pydantic import BaseModel, validator, Field
from enum import Enum

# =================================
# ENUMS
# =================================

class UserRole(str, Enum):
    """Roles de usuário"""
    ADMIN = "ADMIN"
    SUPERVISOR = "SUPERVISOR"
    OPERATOR = "OPERATOR"


class InventoryStatus(str, Enum):
    """Status do inventário"""
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"


class CountingStatus(str, Enum):
    """Status da contagem"""
    PENDING = "PENDING"
    COUNTED = "COUNTED"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"
    # DIVERGENT removido - não existe no enum do banco
    # ✅ CORREÇÃO: Usar apenas status válidos do enum do banco
    # Status válidos: PENDING, COUNTED, REVIEWED, APPROVED
    # Removidos: PENDING, AWAITING_COUNT, ZERO_CONFIRMED, RECOUNT, FINAL_COUNT

# =================================
# BASE SCHEMAS
# =================================

class BaseSchema(BaseModel):
    """Schema base com configurações comuns"""
    
    class Config:
        from_attributes = True
        validate_assignment = True
        use_enum_values = True

# =================================
# SCHEMAS DE AUTENTICAÇÃO
# =================================

class UserLogin(BaseModel):
    """Schema para login de usuário"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class Token(BaseModel):
    """Schema para resposta de token"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class TokenData(BaseModel):
    """Schema para dados do token"""
    username: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[str] = None
    store_id: Optional[str] = None

# =================================
# SCHEMAS DE LOJA
# =================================

class StoreBase(BaseSchema):
    """Schema base para loja"""
    code: str = Field(..., min_length=2, max_length=10)
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class StoreCreate(StoreBase):
    """Schema para criar loja"""
    pass


class StoreUpdate(BaseModel):
    """Schema para atualizar loja"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class Store(StoreBase):
    """Schema de loja completo"""
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# =================================
# SCHEMAS DE USUÁRIO
# =================================

class UserBase(BaseSchema):
    """Schema base para usuário"""
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=3, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    role: UserRole
    store_id: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    """Schema para criar usuário"""
    password: str = Field(..., min_length=8, max_length=50)

    @validator('password')
    def validate_password(cls, v):
        """Validar força da senha"""
        if len(v) < 8:
            raise ValueError('Senha deve ter pelo menos 8 caracteres')
        if not any(c.isupper() for c in v):
            raise ValueError('Senha deve conter pelo menos uma letra maiuscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('Senha deve conter pelo menos um numero')
        return v


class UserUpdate(BaseModel):
    """Schema para atualizar usuário"""
    full_name: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    store_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=50)


class User(UserBase):
    """Schema de usuário completo"""
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    store: Optional[Store] = None

# =================================
# SCHEMAS DE PRODUTO
# =================================

# =================================
# NOTA: Schemas de Produto movidos para product_schemas.py
# Para evitar duplicação e melhor organização
# =================================

# =================================
# SCHEMAS DE INVENTÁRIO
# =================================

# =================================
# NOTA: Schemas de Inventário movidos para inventory_schemas.py
# Para evitar duplicação e melhor organização
# =================================

# =================================
# SCHEMAS DE CONTAGEM
# =================================

class CountingBase(BaseSchema):
    """Schema base para contagem"""
    quantity: float = Field(..., ge=0)
    lot_number: Optional[str] = Field(None, max_length=50)
    serial_number: Optional[str] = Field(None, max_length=50)
    observation: Optional[str] = Field(None, max_length=500)


class CountingCreate(CountingBase):
    """Schema para criar contagem"""
    inventory_item_id: str


class CountingUpdate(BaseModel):
    """Schema para atualizar contagem"""
    quantity: Optional[float] = Field(None, ge=0)
    lot_number: Optional[str] = Field(None, max_length=50)
    serial_number: Optional[str] = Field(None, max_length=50)
    observation: Optional[str] = Field(None, max_length=500)


class Counting(CountingBase):
    """Schema de contagem completo"""
    id: str
    inventory_item_id: str
    counted_by: str
    count_number: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # item: Optional["InventoryItem"] = None  # ✅ Removido: causa erro Pydantic (InventoryItem não importado)
    counter: Optional[User] = None

# =================================
# SCHEMAS DE DIVERGÊNCIA
# =================================

class DiscrepancyBase(BaseSchema):
    """Schema base para divergência"""
    variance_quantity: float
    variance_percentage: float
    tolerance_exceeded: bool = False
    status: str = "PENDING"
    observation: Optional[str] = Field(None, max_length=500)


class DiscrepancyCreate(DiscrepancyBase):
    """Schema para criar divergência"""
    inventory_item_id: str


class DiscrepancyUpdate(BaseModel):
    """Schema para atualizar divergência"""
    status: Optional[str] = None
    observation: Optional[str] = Field(None, max_length=500)
    resolution: Optional[str] = Field(None, max_length=500)


class Discrepancy(DiscrepancyBase):
    """Schema de divergência completo"""
    id: str
    inventory_item_id: str
    created_by: str
    resolved_by: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    # item: Optional["InventoryItem"] = None  # ✅ Removido: causa erro Pydantic (InventoryItem não importado)
    creator: Optional[User] = None
    resolver: Optional[User] = None

# =================================
# SCHEMAS DE BUSCA E FILTROS
# =================================

class ProductSearch(BaseModel):
    """Schema para busca de produtos"""
    query: Optional[str] = None
    code: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    store_id: Optional[str] = None
    is_active: Union[bool] = True
    page: int = Field(1, ge=1)
    size: int = Field(50, ge=1, le=100)


class InventorySearch(BaseModel):
    """Schema para busca de inventários"""
    store_id: Optional[str] = None
    status: Optional[InventoryStatus] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)

# =================================
# SCHEMAS DE RELATÓRIOS
# =================================

class InventoryReport(BaseModel):
    """Schema para relatório de inventário"""
    inventory_list: Any  # ✅ Mudado de "InventoryList" para Any (InventoryList não importado)
    total_items: int
    counted_items: int
    pending_items: int
    discrepancies: int
    total_variance_value: float
    summary_by_category: List[Dict[str, Any]]


class StoreStatistics(BaseModel):
    """Schema para estatísticas da loja"""
    store: Store
    total_products: int
    active_inventories: int
    total_discrepancies: int
    last_inventory_date: Optional[datetime] = None


class UserStatistics(BaseModel):
    """Schema para estatísticas do usuário"""
    user: User
    items_counted_today: int
    items_counted_total: int
    accuracy_percentage: float
    last_activity: Optional[datetime] = None

# =================================
# SCHEMAS DE RESPOSTA DA API
# =================================

class APIResponse(BaseModel):
    """Schema padrão de resposta da API"""
    success: bool = True
    message: str = "Operation successful"
    data: Optional[Any] = None
    errors: Optional[List[str]] = None


class PaginatedResponse(BaseModel):
    """Schema para respostas paginadas"""
    success: bool = True
    data: List[Any]
    total: int
    page: int
    size: int
    pages: int

# =================================
# SCHEMAS DE INTEGRAÇÃO PROTHEUS
# =================================

class ProtheusProduct(BaseModel):
    """Schema para produto do Protheus"""
    codigo: str
    descricao: str
    tipo: str
    unidade: str
    categoria: str
    preco_custo: Optional[float] = None
    preco_venda: Optional[float] = None
    saldo_atual: Union[float] = 0.0
    ativo: bool = True


class ProtheusInventoryImport(BaseModel):
    """Schema para importação de lista de inventário do Protheus"""
    loja_codigo: str = Field(..., description="Código da loja no Protheus")
    produtos: List[ProtheusProduct] = Field(..., description="Lista de produtos com saldo")
    data_referencia: Optional[datetime] = Field(None, description="Data de referência do inventário")
    filtros_aplicados: Union[Dict[str, Any]] = Field(None, description="Filtros usados na extração")


class ProtheusSync(BaseModel):
    """Schema para sincronização com Protheus"""
    operation: str  # 'IMPORT_PRODUCTS', 'EXPORT_INVENTORY', etc.
    store_code: str
    filters: Optional[Dict[str, Any]] = None
    force_update: bool = False


class ProtheusResponse(BaseModel):
    """Schema para resposta do Protheus"""
    success: bool
    message: str
    records_processed: int
    errors: Optional[List[str]] = None
    data: Optional[Any] = None


# =================================
# SCHEMAS PARA CONTAGENS MÚLTIPLAS
# =================================

class CountingAssignment(BaseModel):
    """Schema para atribuição de contador"""
    item_id: str
    assigned_to: str
    count_number: int = Field(..., ge=1, le=3, description="Número da contagem (1-3)")
    reason: Optional[str] = Field(None, description="Motivo da atribuição")
    deadline: Optional[datetime] = Field(None, description="Prazo para contagem")


class CountingAssignmentBatch(BaseModel):
    """Schema para atribuição em lote"""
    inventory_list_id: str
    assignments: List[CountingAssignment]
    apply_to: str = Field("divergent_only", description="all_items, divergent_only, pending_only")


class RecountRequest(BaseModel):
    """Schema para solicitação de recontagem"""
    item_ids: List[str]
    reason: str
    assigned_to: Optional[str] = None
    max_count_number: int = Field(3, ge=1, le=3, description="Número máximo de contagens")


class DiscrepancyAnalysis(BaseModel):
    """Schema para análise de divergências"""
    inventory_list_id: str
    tolerance_percentage: float = Field(5.0, ge=0, le=100, description="Percentual de tolerância")
    minimum_value: float = Field(0.0, ge=0, description="Valor mínimo para considerar divergência")


class CountingStats(BaseModel):
    """Schema para estatísticas de contagem"""
    total_items: int
    first_count_completed: int
    second_count_completed: int
    third_count_completed: int
    items_with_discrepancy: int
    items_pending_recount: int
    accuracy_percentage: float