"""
Schemas Pydantic para Sistema de Auditoria de Ciclos
Sistema de Inventário Protheus v2.16.0
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from app.models.models import CycleAuditActionEnum


# =================================
# AUDIT LOG SCHEMAS
# =================================

class CycleAuditLogBase(BaseModel):
    """Schema base para logs de auditoria"""
    inventory_list_id: UUID
    counting_list_id: Optional[UUID] = None
    user_id: UUID
    action: CycleAuditActionEnum
    old_cycle: Optional[int] = None
    new_cycle: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CycleAuditLogCreate(CycleAuditLogBase):
    """Schema para criar novo log de auditoria"""
    pass


class CycleAuditLogResponse(CycleAuditLogBase):
    """Schema de resposta para log de auditoria"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    timestamp: datetime

    # Dados adicionais (podem ser populados via joins)
    inventory_name: Optional[str] = None
    counting_list_code: Optional[str] = None
    user_name: Optional[str] = None


class CycleAuditLogListResponse(BaseModel):
    """Schema de resposta para lista de logs"""
    items: list[CycleAuditLogResponse]
    total: int
    page: int = 1
    size: int = 50


# =================================
# AUDIT QUERY SCHEMAS
# =================================

class CycleAuditQuery(BaseModel):
    """Schema para filtros de busca de auditoria"""
    inventory_list_id: Optional[UUID] = None
    counting_list_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    action: Optional[CycleAuditActionEnum] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    size: int = Field(default=50, ge=1, le=100)


# =================================
# AUDIT STATISTICS SCHEMAS
# =================================

class CycleAuditStatistics(BaseModel):
    """Estatísticas de auditoria"""
    total_logs: int
    actions_by_type: Dict[str, int]
    most_active_users: list[Dict[str, Any]]
    recent_anomalies: int
    sync_operations_count: int
    manual_adjustments_count: int
