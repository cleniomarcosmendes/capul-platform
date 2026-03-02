"""
Endpoints de Monitoramento e Alertas
Sistema de Inventário Protheus v2.16.0

Fornece APIs para monitoramento de saúde do sistema,
detecção de anomalias e alertas em tempo real.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, UserRole
from app.core.exceptions import safe_error_response
from app.services.anomaly_detector import (
    detect_all_anomalies,
    detect_cycle_desync,
    detect_orphan_products,
    detect_stuck_lists,
    detect_stuck_inventories,
    detect_extreme_discrepancies,
    get_anomaly_summary,
    Anomaly
)
from app.services.audit_service import get_recent_anomalies as get_recent_audit_anomalies
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


# =================================
# SCHEMAS
# =================================

class AnomalyResponse(BaseModel):
    """Schema de resposta para uma anomalia"""
    severity: str
    anomaly_type: str
    title: str
    description: str
    inventory_id: Optional[str] = None
    inventory_name: Optional[str] = None
    counting_list_id: Optional[str] = None
    counting_list_code: Optional[str] = None
    affected_products: int
    detected_at: str
    extra_metadata: dict

    class Config:
        from_attributes = True


class AnomalySummaryResponse(BaseModel):
    """Schema de resposta para resumo de anomalias"""
    total_anomalies: int
    detected_at: str
    by_severity: dict
    by_type: dict
    affected_inventories: int
    affected_lists: int
    total_affected_products: int
    critical_alerts: List[dict]
    estimated_financial_risk: int

    class Config:
        from_attributes = True


class AnomalyDetectionResponse(BaseModel):
    """Schema de resposta completa da detecção"""
    success: bool
    summary: AnomalySummaryResponse
    anomalies: List[AnomalyResponse]

    class Config:
        from_attributes = True


# =================================
# ENDPOINTS
# =================================

@router.get("/anomalies", response_model=AnomalyDetectionResponse)
async def detect_anomalies(
    detector: Optional[str] = Query(
        None,
        description="Detector específico (cycle_desync, orphan_products, stuck_lists, stuck_inventories, extreme_discrepancies)"
    ),
    log_to_audit: bool = Query(
        True,
        description="Se True, registra anomalias na tabela de auditoria"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    **Detecta anomalias no sistema de inventário.**

    Executa detectores de anomalias e retorna lista consolidada com alertas.

    **Permissões**: ADMIN, SUPERVISOR

    **Detectores disponíveis**:
    - `cycle_desync`: Dessincronização de ciclos (CRÍTICO)
    - `orphan_products`: Produtos sem contagem há >24h
    - `stuck_lists`: Listas abertas há >7 dias
    - `stuck_inventories`: Inventários sem progresso há >3 dias
    - `extreme_discrepancies`: Divergências >50%

    **Retorna**:
    - Resumo estatístico
    - Lista completa de anomalias
    - Risco financeiro estimado

    **Exemplo**:
    ```
    GET /api/v1/monitoring/anomalies?detector=cycle_desync
    ```
    """
    # Validar permissão
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=403,
            detail="Apenas ADMIN e SUPERVISOR podem acessar monitoramento"
        )

    try:
        anomalies = []

        # Executar detector específico ou todos
        if detector:
            if detector == "cycle_desync":
                anomalies = detect_cycle_desync(db)
            elif detector == "orphan_products":
                anomalies = detect_orphan_products(db, hours_threshold=24)
            elif detector == "stuck_lists":
                anomalies = detect_stuck_lists(db, days_threshold=7)
            elif detector == "stuck_inventories":
                anomalies = detect_stuck_inventories(db, days_threshold=3)
            elif detector == "extreme_discrepancies":
                anomalies = detect_extreme_discrepancies(db, threshold_pct=50.0)
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Detector inválido: {detector}"
                )
        else:
            # Executar todos os detectores
            anomalies = detect_all_anomalies(
                db=db,
                log_to_audit=log_to_audit,
                system_user_id=current_user.id if log_to_audit else None
            )

        # Gerar resumo
        summary = get_anomaly_summary(anomalies)

        # Converter anomalias para response
        anomaly_responses = [
            AnomalyResponse(**anomaly.to_dict())
            for anomaly in anomalies
        ]

        return AnomalyDetectionResponse(
            success=True,
            summary=AnomalySummaryResponse(**summary),
            anomalies=anomaly_responses
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao detectar anomalias")
        )


@router.get("/anomalies/audit-history")
async def get_audit_anomaly_history(
    hours: int = Query(24, description="Últimas N horas"),
    limit: int = Query(50, description="Quantidade máxima de resultados"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    **Busca histórico de anomalias registradas no audit log.**

    Retorna anomalias detectadas e registradas na tabela `cycle_audit_log`.

    **Permissões**: ADMIN, SUPERVISOR

    **Parâmetros**:
    - `hours`: Últimas N horas (padrão: 24)
    - `limit`: Quantidade máxima (padrão: 50)

    **Retorna**:
    - Lista de logs de auditoria com action='ANOMALY_DETECTED'
    """
    # Validar permissão
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=403,
            detail="Apenas ADMIN e SUPERVISOR podem acessar histórico"
        )

    try:
        audit_logs = get_recent_audit_anomalies(db, hours=hours, limit=limit)

        return {
            "success": True,
            "total": len(audit_logs),
            "hours": hours,
            "anomalies": [
                {
                    "id": str(log.id),
                    "inventory_list_id": str(log.inventory_list_id),
                    "counting_list_id": str(log.counting_list_id) if log.counting_list_id else None,
                    "user_id": str(log.user_id),
                    "action": log.action.value,
                    "timestamp": log.timestamp.isoformat(),
                    "extra_metadata": log.extra_metadata
                }
                for log in audit_logs
            ]
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao buscar histórico")
        )


@router.get("/health")
async def health_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    **Health check do sistema de inventário.**

    Verifica integridade básica do sistema.

    **Permissões**: Qualquer usuário autenticado

    **Retorna**:
    - Status do banco de dados
    - Status do sistema de ciclos
    - Quantidade de inventários ativos
    """
    try:
        from app.models.models import InventoryList, CountingList, InventoryStatus

        # Total de inventários
        total_inventories = db.query(InventoryList).count()

        # Em andamento (DRAFT + IN_PROGRESS)
        active_inventories = db.query(InventoryList).filter(
            InventoryList.status.in_([InventoryStatus.DRAFT, InventoryStatus.IN_PROGRESS])
        ).count()

        # Concluídos (COMPLETED + CLOSED)
        completed_inventories = db.query(InventoryList).filter(
            InventoryList.status.in_([InventoryStatus.COMPLETED, InventoryStatus.CLOSED])
        ).count()

        active_lists = db.query(CountingList).filter(
            CountingList.list_status.in_(["ABERTA", "EM_CONTAGEM"])
        ).count()

        # Executar detector crítico (cycle_desync)
        critical_anomalies = detect_cycle_desync(db)

        return {
            "status": "healthy" if len(critical_anomalies) == 0 else "warning",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "total_inventories": total_inventories,
            "active_inventories": active_inventories,
            "completed_inventories": completed_inventories,
            "active_lists": active_lists,
            "critical_anomalies": len(critical_anomalies),
            "message": "Sistema operacional" if len(critical_anomalies) == 0 else f"⚠️ {len(critical_anomalies)} anomalias críticas detectadas"
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "error",
            "error": str(e)
        }


@router.get("/statistics")
async def get_system_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    **Estatísticas gerais do sistema.**

    Fornece métricas consolidadas para dashboards.

    **Permissões**: ADMIN, SUPERVISOR

    **Retorna**:
    - Total de inventários (por status)
    - Total de listas de contagem
    - Total de produtos inventariados
    - Métricas de ciclos
    """
    # Validar permissão
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=403,
            detail="Apenas ADMIN e SUPERVISOR podem acessar estatísticas"
        )

    try:
        from app.models.models import InventoryList, CountingList, InventoryItem, InventoryStatus

        # Inventários por status
        inventories_by_status = {}
        for status in InventoryStatus:
            count = db.query(InventoryList).filter(
                InventoryList.status == status
            ).count()
            inventories_by_status[status.value] = count

        # Listas de contagem por status
        lists_by_status = {}
        for status in ["ABERTA", "FECHADA", "ENCERRADA"]:
            count = db.query(CountingList).filter(
                CountingList.list_status == status
            ).count()
            lists_by_status[status] = count

        # Total de produtos
        total_products = db.query(InventoryItem).count()

        # Inventários por ciclo
        inventories_by_cycle = {}
        for cycle in [1, 2, 3]:
            count = db.query(InventoryList).filter(
                InventoryList.current_cycle == cycle,
                InventoryList.status == InventoryStatus.IN_PROGRESS
            ).count()
            inventories_by_cycle[f"cycle_{cycle}"] = count

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "inventories": {
                "total": sum(inventories_by_status.values()),
                "by_status": inventories_by_status,
                "by_cycle": inventories_by_cycle
            },
            "counting_lists": {
                "total": sum(lists_by_status.values()),
                "by_status": lists_by_status
            },
            "products": {
                "total": total_products
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao buscar estatísticas")
        )
