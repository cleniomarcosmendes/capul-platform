"""
Serviço de Auditoria de Ciclos
Sistema de Inventário Protheus v2.16.0

Este serviço fornece funções helper para registrar logs de
auditoria de operações críticas de ciclos de inventário.

Criado em resposta ao bug crítico v2.15.5 para garantir
rastreabilidade completa e proteção financeira.
"""

import logging
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.models.models import CycleAuditLog, CycleAuditActionEnum
from app.schemas.audit_schemas import CycleAuditLogCreate, CycleAuditLogResponse

logger = logging.getLogger(__name__)


# =================================
# FUNÇÕES HELPER DE AUDITORIA
# =================================

def log_audit(
    db: Session,
    inventory_list_id: UUID,
    user_id: UUID,
    action: CycleAuditActionEnum,
    counting_list_id: Optional[UUID] = None,
    old_cycle: Optional[int] = None,
    new_cycle: Optional[int] = None,
    extra_data: Optional[Dict[str, Any]] = None
) -> CycleAuditLog:
    """
    Registra um log de auditoria.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: ID do inventário
        user_id: ID do usuário que executou a ação
        action: Tipo de ação executada
        counting_list_id: ID da lista de contagem (opcional)
        old_cycle: Ciclo anterior (opcional)
        new_cycle: Novo ciclo (opcional)
        extra_data: Dados adicionais em formato dict (opcional)

    Returns:
        CycleAuditLog: Objeto do log criado

    Example:
        >>> log = log_audit(
        ...     db=db,
        ...     inventory_list_id=inventory.id,
        ...     user_id=current_user.id,
        ...     action=CycleAuditActionEnum.END_CYCLE,
        ...     counting_list_id=counting_list.id,
        ...     old_cycle=1,
        ...     new_cycle=2,
        ...     extra_data={"products_counted": 100, "divergences": 5}
        ... )
    """
    try:
        audit_log = CycleAuditLog(
            inventory_list_id=inventory_list_id,
            counting_list_id=counting_list_id,
            user_id=user_id,
            action=action,
            old_cycle=old_cycle,
            new_cycle=new_cycle,
            extra_metadata=extra_data or {}
        )

        db.add(audit_log)
        db.flush()  # Gera ID sem commitar

        logger.info(
            f"✅ [AUDIT] {action.value} | "
            f"Inventory: {inventory_list_id} | "
            f"User: {user_id} | "
            f"Cycle: {old_cycle}→{new_cycle}"
        )

        return audit_log

    except Exception as e:
        logger.error(f"❌ [AUDIT] Erro ao registrar log: {str(e)}")
        # Não propaga erro para não quebrar operação principal
        return None


def log_cycle_start(
    db: Session,
    inventory_list_id: UUID,
    counting_list_id: UUID,
    user_id: UUID,
    cycle: int,
    products_count: int = 0
) -> CycleAuditLog:
    """
    Registra início de um ciclo de contagem.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: ID do inventário
        counting_list_id: ID da lista de contagem
        user_id: ID do usuário
        cycle: Número do ciclo (1, 2 ou 3)
        products_count: Quantidade de produtos neste ciclo
    """
    return log_audit(
        db=db,
        inventory_list_id=inventory_list_id,
        counting_list_id=counting_list_id,
        user_id=user_id,
        action=CycleAuditActionEnum.START_CYCLE,
        new_cycle=cycle,
        extra_data={
            "products_count": products_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def log_cycle_end(
    db: Session,
    inventory_list_id: UUID,
    counting_list_id: UUID,
    user_id: UUID,
    old_cycle: int,
    new_cycle: int,
    products_counted: int = 0,
    products_pending: int = 0,
    divergences: int = 0
) -> CycleAuditLog:
    """
    Registra encerramento de um ciclo.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: ID do inventário
        counting_list_id: ID da lista de contagem
        user_id: ID do usuário
        old_cycle: Ciclo que está sendo encerrado
        new_cycle: Próximo ciclo
        products_counted: Produtos contados neste ciclo
        products_pending: Produtos não contados (precisam ir para próximo ciclo)
        divergences: Produtos com divergência
    """
    return log_audit(
        db=db,
        inventory_list_id=inventory_list_id,
        counting_list_id=counting_list_id,
        user_id=user_id,
        action=CycleAuditActionEnum.END_CYCLE,
        old_cycle=old_cycle,
        new_cycle=new_cycle,
        extra_data={
            "products_counted": products_counted,
            "products_pending": products_pending,
            "divergences": divergences,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def log_cycle_sync(
    db: Session,
    inventory_list_id: UUID,
    counting_list_id: UUID,
    user_id: UUID,
    old_cycle: int,
    new_cycle: int,
    reason: str = "Sincronização automática"
) -> CycleAuditLog:
    """
    Registra sincronização de ciclos entre inventory_lists e counting_lists.

    Esta função foi criada especificamente para o fix do bug v2.15.5.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: ID do inventário
        counting_list_id: ID da lista de contagem
        user_id: ID do usuário
        old_cycle: Ciclo anterior
        new_cycle: Novo ciclo sincronizado
        reason: Motivo da sincronização
    """
    return log_audit(
        db=db,
        inventory_list_id=inventory_list_id,
        counting_list_id=counting_list_id,
        user_id=user_id,
        action=CycleAuditActionEnum.SYNC_CYCLES,
        old_cycle=old_cycle,
        new_cycle=new_cycle,
        extra_data={
            "reason": reason,
            "fix_version": "v2.15.5",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def log_finalize_inventory(
    db: Session,
    inventory_list_id: UUID,
    user_id: UUID,
    final_cycle: int,
    total_products: int = 0,
    total_divergences: int = 0
) -> CycleAuditLog:
    """
    Registra finalização de um inventário.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: ID do inventário
        user_id: ID do usuário
        final_cycle: Ciclo final atingido
        total_products: Total de produtos inventariados
        total_divergences: Total de divergências finais
    """
    return log_audit(
        db=db,
        inventory_list_id=inventory_list_id,
        user_id=user_id,
        action=CycleAuditActionEnum.FINALIZE_INVENTORY,
        new_cycle=final_cycle,
        extra_data={
            "total_products": total_products,
            "total_divergences": total_divergences,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def log_recalculate_discrepancies(
    db: Session,
    inventory_list_id: UUID,
    user_id: UUID,
    current_cycle: int,
    products_recalculated: int = 0,
    new_divergences: int = 0
) -> CycleAuditLog:
    """
    Registra recálculo de divergências.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: ID do inventário
        user_id: ID do usuário
        current_cycle: Ciclo atual
        products_recalculated: Produtos recalculados
        new_divergences: Novas divergências encontradas
    """
    return log_audit(
        db=db,
        inventory_list_id=inventory_list_id,
        user_id=user_id,
        action=CycleAuditActionEnum.RECALCULATE_DISCREPANCIES,
        new_cycle=current_cycle,
        extra_data={
            "products_recalculated": products_recalculated,
            "new_divergences": new_divergences,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def log_anomaly(
    db: Session,
    inventory_list_id: UUID,
    user_id: UUID,
    anomaly_type: str,
    anomaly_details: Dict[str, Any],
    counting_list_id: Optional[UUID] = None
) -> CycleAuditLog:
    """
    Registra detecção de anomalia.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: ID do inventário
        user_id: ID do usuário (pode ser sistema)
        anomaly_type: Tipo da anomalia detectada
        anomaly_details: Detalhes da anomalia
        counting_list_id: ID da lista de contagem (opcional)
    """
    return log_audit(
        db=db,
        inventory_list_id=inventory_list_id,
        counting_list_id=counting_list_id,
        user_id=user_id,
        action=CycleAuditActionEnum.ANOMALY_DETECTED,
        extra_data={
            "anomaly_type": anomaly_type,
            "details": anomaly_details,
            "severity": "CRITICAL" if "desync" in anomaly_type else "WARNING",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# =================================
# FUNÇÕES DE CONSULTA
# =================================

def get_audit_logs(
    db: Session,
    inventory_list_id: Optional[UUID] = None,
    counting_list_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    action: Optional[CycleAuditActionEnum] = None,
    limit: int = 100,
    offset: int = 0
) -> list[CycleAuditLog]:
    """
    Busca logs de auditoria com filtros opcionais.

    Args:
        db: Sessão do banco de dados
        inventory_list_id: Filtrar por inventário
        counting_list_id: Filtrar por lista de contagem
        user_id: Filtrar por usuário
        action: Filtrar por tipo de ação
        limit: Quantidade máxima de resultados
        offset: Offset para paginação

    Returns:
        Lista de logs de auditoria
    """
    query = db.query(CycleAuditLog)

    if inventory_list_id:
        query = query.filter(CycleAuditLog.inventory_list_id == inventory_list_id)

    if counting_list_id:
        query = query.filter(CycleAuditLog.counting_list_id == counting_list_id)

    if user_id:
        query = query.filter(CycleAuditLog.user_id == user_id)

    if action:
        query = query.filter(CycleAuditLog.action == action)

    query = query.order_by(CycleAuditLog.timestamp.desc())
    query = query.limit(limit).offset(offset)

    return query.all()


def get_recent_anomalies(db: Session, hours: int = 24, limit: int = 50) -> list[CycleAuditLog]:
    """
    Busca anomalias recentes.

    Args:
        db: Sessão do banco de dados
        hours: Últimas N horas
        limit: Quantidade máxima de resultados

    Returns:
        Lista de logs de anomalias
    """
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    return db.query(CycleAuditLog).filter(
        CycleAuditLog.action == CycleAuditActionEnum.ANOMALY_DETECTED,
        CycleAuditLog.timestamp >= cutoff
    ).order_by(CycleAuditLog.timestamp.desc()).limit(limit).all()
