"""
Sistema de Detecção de Anomalias
Sistema de Inventário Protheus v2.16.0

Este serviço detecta anomalias críticas que podem causar prejuízos financeiros
e gera alertas para intervenção imediata.

Tipos de anomalias detectadas:
1. Dessincronização de ciclos (inventory_lists vs counting_lists)
2. Produtos órfãos (sem contagem em nenhum ciclo após 24h)
3. Listas de contagem abertas há muito tempo (>7 dias)
4. Inventários travados (sem progresso há >3 dias)
5. Divergências extremas (>50% de diferença entre esperado e contado)
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.models.models import (
    InventoryList,
    CountingList,
    CountingListItem,
    InventoryItem,
    InventoryStatus
)
from app.services.audit_service import log_anomaly

logger = logging.getLogger(__name__)


# =================================
# CLASSES DE ANOMALIA
# =================================

class Anomaly:
    """Classe base para representar uma anomalia"""

    def __init__(
        self,
        severity: str,  # CRITICAL, HIGH, MEDIUM, LOW
        anomaly_type: str,
        title: str,
        description: str,
        inventory_id: Optional[UUID] = None,
        inventory_name: Optional[str] = None,
        counting_list_id: Optional[UUID] = None,
        counting_list_code: Optional[str] = None,
        affected_products: int = 0,
        detected_at: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.severity = severity
        self.anomaly_type = anomaly_type
        self.title = title
        self.description = description
        self.inventory_id = inventory_id
        self.inventory_name = inventory_name
        self.counting_list_id = counting_list_id
        self.counting_list_code = counting_list_code
        self.affected_products = affected_products
        self.detected_at = detected_at or datetime.utcnow()
        self.extra_metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        """Converte anomalia para dicionário"""
        return {
            "severity": self.severity,
            "anomaly_type": self.anomaly_type,
            "title": self.title,
            "description": self.description,
            "inventory_id": str(self.inventory_id) if self.inventory_id else None,
            "inventory_name": self.inventory_name,
            "counting_list_id": str(self.counting_list_id) if self.counting_list_id else None,
            "counting_list_code": self.counting_list_code,
            "affected_products": self.affected_products,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "extra_metadata": self.extra_metadata
        }


# =================================
# DETECTORES DE ANOMALIAS
# =================================

def detect_cycle_desync(db: Session) -> List[Anomaly]:
    """
    Detecta dessincronização entre inventory_lists.current_cycle e counting_lists.current_cycle.

    Quando há APENAS 1 lista de contagem, os ciclos DEVEM ser iguais.
    Essa anomalia foi a causa do bug crítico v2.15.5 (R$ 850/produto).

    Args:
        db: Sessão do banco de dados

    Returns:
        Lista de anomalias detectadas
    """
    anomalies = []

    try:
        # Buscar inventários com status IN_PROGRESS
        inventories = db.query(InventoryList).filter(
            InventoryList.status == InventoryStatus.IN_PROGRESS
        ).all()

        for inventory in inventories:
            # Contar listas de contagem ativas
            counting_lists = db.query(CountingList).filter(
                CountingList.inventory_id == inventory.id,
                CountingList.list_status != "ENCERRADA"
            ).all()

            total_lists = len(counting_lists)

            # Se há apenas 1 lista, verificar sincronização
            if total_lists == 1:
                counting_list = counting_lists[0]

                if inventory.current_cycle != counting_list.current_cycle:
                    anomaly = Anomaly(
                        severity="CRITICAL",
                        anomaly_type="CYCLE_DESYNC",
                        title="🚨 Dessincronização de Ciclos",
                        description=(
                            f"Inventário '{inventory.name}' tem ciclo {inventory.current_cycle} "
                            f"mas sua única lista de contagem '{counting_list.code}' está no ciclo {counting_list.current_cycle}. "
                            f"Esse bug causa produtos não contados NÃO aparecerem para recontagem!"
                        ),
                        inventory_id=inventory.id,
                        inventory_name=inventory.name,
                        counting_list_id=counting_list.id,
                        counting_list_code=counting_list.code,
                        metadata={
                            "inventory_cycle": inventory.current_cycle,
                            "counting_list_cycle": counting_list.current_cycle,
                            "total_lists": total_lists,
                            "financial_risk_per_product": 850
                        }
                    )
                    anomalies.append(anomaly)

                    logger.critical(
                        f"🚨 [ANOMALY] CYCLE_DESYNC | Inventory: {inventory.name} "
                        f"(cycle={inventory.current_cycle}) | List: {counting_list.code} "
                        f"(cycle={counting_list.current_cycle})"
                    )

        return anomalies

    except Exception as e:
        logger.error(f"❌ [ANOMALY] Erro ao detectar cycle_desync: {str(e)}")
        return []


def detect_orphan_products(db: Session, hours_threshold: int = 24) -> List[Anomaly]:
    """
    Detecta produtos órfãos: itens que estão há mais de N horas sem contagem em NENHUM ciclo.

    Args:
        db: Sessão do banco de dados
        hours_threshold: Limite de horas sem contagem

    Returns:
        Lista de anomalias detectadas
    """
    anomalies = []

    try:
        cutoff = datetime.utcnow() - timedelta(hours=hours_threshold)

        # Buscar listas de contagem ativas criadas há mais de N horas
        counting_lists = db.query(CountingList).filter(
            CountingList.list_status == "ABERTA",
            CountingList.created_at < cutoff
        ).all()

        for counting_list in counting_lists:
            # Buscar itens sem nenhuma contagem
            orphan_items = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == counting_list.id,
                CountingListItem.count_cycle_1.is_(None),
                CountingListItem.count_cycle_2.is_(None),
                CountingListItem.count_cycle_3.is_(None)
            ).count()

            if orphan_items > 0:
                inventory = db.query(InventoryList).filter(
                    InventoryList.id == counting_list.inventory_id
                ).first()

                hours_open = (datetime.utcnow() - counting_list.created_at).total_seconds() / 3600

                anomaly = Anomaly(
                    severity="HIGH",
                    anomaly_type="ORPHAN_PRODUCTS",
                    title="⚠️ Produtos Órfãos Detectados",
                    description=(
                        f"Lista '{counting_list.code}' tem {orphan_items} produtos "
                        f"SEM CONTAGEM em nenhum ciclo há {int(hours_open)} horas. "
                        f"Possível abandono de contagem."
                    ),
                    inventory_id=inventory.id if inventory else None,
                    inventory_name=inventory.name if inventory else None,
                    counting_list_id=counting_list.id,
                    counting_list_code=counting_list.code,
                    affected_products=orphan_items,
                    metadata={
                        "hours_open": int(hours_open),
                        "threshold_hours": hours_threshold,
                        "created_at": counting_list.created_at.isoformat()
                    }
                )
                anomalies.append(anomaly)

                logger.warning(
                    f"⚠️ [ANOMALY] ORPHAN_PRODUCTS | List: {counting_list.code} | "
                    f"Orphans: {orphan_items} | Hours: {int(hours_open)}"
                )

        return anomalies

    except Exception as e:
        logger.error(f"❌ [ANOMALY] Erro ao detectar orphan_products: {str(e)}")
        return []


def detect_stuck_lists(db: Session, days_threshold: int = 7) -> List[Anomaly]:
    """
    Detecta listas de contagem abertas há muito tempo (>N dias).

    Args:
        db: Sessão do banco de dados
        days_threshold: Limite de dias aberta

    Returns:
        Lista de anomalias detectadas
    """
    anomalies = []

    try:
        cutoff = datetime.utcnow() - timedelta(days=days_threshold)

        stuck_lists = db.query(CountingList).filter(
            CountingList.list_status == "ABERTA",
            CountingList.created_at < cutoff
        ).all()

        for counting_list in stuck_lists:
            inventory = db.query(InventoryList).filter(
                InventoryList.id == counting_list.inventory_id
            ).first()

            days_open = (datetime.utcnow() - counting_list.created_at).days

            # Contar produtos contados vs total
            total_items = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == counting_list.id
            ).count()

            counted_items = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == counting_list.id,
                or_(
                    CountingListItem.count_cycle_1.isnot(None),
                    CountingListItem.count_cycle_2.isnot(None),
                    CountingListItem.count_cycle_3.isnot(None)
                )
            ).count()

            progress_pct = (counted_items / total_items * 100) if total_items > 0 else 0

            anomaly = Anomaly(
                severity="MEDIUM",
                anomaly_type="STUCK_LIST",
                title="📋 Lista de Contagem Travada",
                description=(
                    f"Lista '{counting_list.code}' está ABERTA há {days_open} dias "
                    f"com apenas {progress_pct:.1f}% de progresso ({counted_items}/{total_items} produtos). "
                    f"Possível abandono ou bloqueio operacional."
                ),
                inventory_id=inventory.id if inventory else None,
                inventory_name=inventory.name if inventory else None,
                counting_list_id=counting_list.id,
                counting_list_code=counting_list.code,
                affected_products=total_items - counted_items,
                metadata={
                    "days_open": days_open,
                    "threshold_days": days_threshold,
                    "total_items": total_items,
                    "counted_items": counted_items,
                    "progress_pct": round(progress_pct, 2),
                    "created_at": counting_list.created_at.isoformat()
                }
            )
            anomalies.append(anomaly)

            logger.warning(
                f"⚠️ [ANOMALY] STUCK_LIST | List: {counting_list.code} | "
                f"Days: {days_open} | Progress: {progress_pct:.1f}%"
            )

        return anomalies

    except Exception as e:
        logger.error(f"❌ [ANOMALY] Erro ao detectar stuck_lists: {str(e)}")
        return []


def detect_stuck_inventories(db: Session, days_threshold: int = 3) -> List[Anomaly]:
    """
    Detecta inventários travados: status IN_PROGRESS mas sem movimentação há >N dias.

    Args:
        db: Sessão do banco de dados
        days_threshold: Limite de dias sem movimentação

    Returns:
        Lista de anomalias detectadas
    """
    anomalies = []

    try:
        cutoff = datetime.utcnow() - timedelta(days=days_threshold)

        # Buscar inventários IN_PROGRESS atualizados há muito tempo
        stuck_inventories = db.query(InventoryList).filter(
            InventoryList.status == InventoryStatus.IN_PROGRESS,
            InventoryList.updated_at < cutoff
        ).all()

        for inventory in stuck_inventories:
            days_idle = (datetime.utcnow() - inventory.updated_at).days

            # Verificar se há listas de contagem ativas
            active_lists = db.query(CountingList).filter(
                CountingList.inventory_id == inventory.id,
                CountingList.list_status != "ENCERRADA"
            ).count()

            anomaly = Anomaly(
                severity="MEDIUM",
                anomaly_type="STUCK_INVENTORY",
                title="📦 Inventário Travado",
                description=(
                    f"Inventário '{inventory.name}' está IN_PROGRESS há {days_idle} dias "
                    f"sem nenhuma atualização. Listas ativas: {active_lists}. "
                    f"Possível abandono ou erro operacional."
                ),
                inventory_id=inventory.id,
                inventory_name=inventory.name,
                affected_products=0,
                metadata={
                    "days_idle": days_idle,
                    "threshold_days": days_threshold,
                    "current_cycle": inventory.current_cycle,
                    "active_lists": active_lists,
                    "updated_at": inventory.updated_at.isoformat()
                }
            )
            anomalies.append(anomaly)

            logger.warning(
                f"⚠️ [ANOMALY] STUCK_INVENTORY | Inventory: {inventory.name} | "
                f"Days idle: {days_idle} | Active lists: {active_lists}"
            )

        return anomalies

    except Exception as e:
        logger.error(f"❌ [ANOMALY] Erro ao detectar stuck_inventories: {str(e)}")
        return []


def detect_extreme_discrepancies(
    db: Session,
    threshold_pct: float = 50.0,
    min_expected_qty: float = 10.0
) -> List[Anomaly]:
    """
    Detecta divergências extremas: diferença >N% entre esperado e contado.

    Args:
        db: Sessão do banco de dados
        threshold_pct: Limite percentual de divergência
        min_expected_qty: Quantidade mínima esperada para considerar (evita falsos positivos)

    Returns:
        Lista de anomalias detectadas
    """
    anomalies = []

    try:
        # Buscar listas de contagem ativas
        counting_lists = db.query(CountingList).filter(
            CountingList.list_status == "ABERTA"
        ).all()

        for counting_list in counting_lists:
            # Buscar itens com divergências extremas
            items_with_discrepancy = db.query(CountingListItem).join(
                InventoryItem,
                CountingListItem.inventory_item_id == InventoryItem.id
            ).filter(
                CountingListItem.counting_list_id == counting_list.id,
                InventoryItem.expected_quantity >= min_expected_qty,
                or_(
                    # Divergência no ciclo 1
                    and_(
                        CountingListItem.count_cycle_1.isnot(None),
                        func.abs(
                            (CountingListItem.count_cycle_1 - InventoryItem.expected_quantity) /
                            InventoryItem.expected_quantity * 100
                        ) > threshold_pct
                    ),
                    # Divergência no ciclo 2
                    and_(
                        CountingListItem.count_cycle_2.isnot(None),
                        func.abs(
                            (CountingListItem.count_cycle_2 - InventoryItem.expected_quantity) /
                            InventoryItem.expected_quantity * 100
                        ) > threshold_pct
                    ),
                    # Divergência no ciclo 3
                    and_(
                        CountingListItem.count_cycle_3.isnot(None),
                        func.abs(
                            (CountingListItem.count_cycle_3 - InventoryItem.expected_quantity) /
                            InventoryItem.expected_quantity * 100
                        ) > threshold_pct
                    )
                )
            ).count()

            if items_with_discrepancy > 0:
                inventory = db.query(InventoryList).filter(
                    InventoryList.id == counting_list.inventory_id
                ).first()

                anomaly = Anomaly(
                    severity="HIGH",
                    anomaly_type="EXTREME_DISCREPANCY",
                    title="📊 Divergências Extremas",
                    description=(
                        f"Lista '{counting_list.code}' tem {items_with_discrepancy} produtos "
                        f"com divergência >{threshold_pct}%. Possível erro de contagem ou "
                        f"movimentação não sincronizada com Protheus."
                    ),
                    inventory_id=inventory.id if inventory else None,
                    inventory_name=inventory.name if inventory else None,
                    counting_list_id=counting_list.id,
                    counting_list_code=counting_list.code,
                    affected_products=items_with_discrepancy,
                    metadata={
                        "threshold_pct": threshold_pct,
                        "min_expected_qty": min_expected_qty,
                        "financial_risk_per_product": 850
                    }
                )
                anomalies.append(anomaly)

                logger.warning(
                    f"⚠️ [ANOMALY] EXTREME_DISCREPANCY | List: {counting_list.code} | "
                    f"Items: {items_with_discrepancy} | Threshold: {threshold_pct}%"
                )

        return anomalies

    except Exception as e:
        logger.error(f"❌ [ANOMALY] Erro ao detectar extreme_discrepancies: {str(e)}")
        return []


# =================================
# FUNÇÕES PRINCIPAIS
# =================================

def detect_all_anomalies(
    db: Session,
    log_to_audit: bool = True,
    system_user_id: Optional[UUID] = None
) -> List[Anomaly]:
    """
    Executa todos os detectores de anomalias e retorna lista consolidada.

    Args:
        db: Sessão do banco de dados
        log_to_audit: Se True, registra anomalias na tabela de auditoria
        system_user_id: ID do usuário do sistema (para logs de auditoria)

    Returns:
        Lista de todas as anomalias detectadas
    """
    all_anomalies = []

    logger.info("🔍 [ANOMALY] Iniciando detecção de anomalias...")

    # Executar todos os detectores
    all_anomalies.extend(detect_cycle_desync(db))
    all_anomalies.extend(detect_orphan_products(db, hours_threshold=24))
    all_anomalies.extend(detect_stuck_lists(db, days_threshold=7))
    all_anomalies.extend(detect_stuck_inventories(db, days_threshold=3))
    all_anomalies.extend(detect_extreme_discrepancies(db, threshold_pct=50.0))

    # Logar no audit log se solicitado
    if log_to_audit and system_user_id:
        for anomaly in all_anomalies:
            try:
                log_anomaly(
                    db=db,
                    inventory_list_id=anomaly.inventory_id,
                    user_id=system_user_id,
                    anomaly_type=anomaly.anomaly_type,
                    anomaly_details=anomaly.to_dict(),
                    counting_list_id=anomaly.counting_list_id
                )
            except Exception as e:
                logger.error(f"❌ [ANOMALY] Erro ao registrar log: {str(e)}")

    # Estatísticas
    stats = {
        "total": len(all_anomalies),
        "by_severity": {
            "CRITICAL": len([a for a in all_anomalies if a.severity == "CRITICAL"]),
            "HIGH": len([a for a in all_anomalies if a.severity == "HIGH"]),
            "MEDIUM": len([a for a in all_anomalies if a.severity == "MEDIUM"]),
            "LOW": len([a for a in all_anomalies if a.severity == "LOW"])
        },
        "by_type": {}
    }

    for anomaly in all_anomalies:
        stats["by_type"][anomaly.anomaly_type] = stats["by_type"].get(anomaly.anomaly_type, 0) + 1

    logger.info(
        f"✅ [ANOMALY] Detecção concluída | Total: {stats['total']} | "
        f"CRITICAL: {stats['by_severity']['CRITICAL']} | "
        f"HIGH: {stats['by_severity']['HIGH']} | "
        f"MEDIUM: {stats['by_severity']['MEDIUM']}"
    )

    return all_anomalies


def get_anomaly_summary(anomalies: List[Anomaly]) -> Dict[str, Any]:
    """
    Gera resumo estatístico das anomalias detectadas.

    Args:
        anomalies: Lista de anomalias

    Returns:
        Dicionário com estatísticas
    """
    summary = {
        "total_anomalies": len(anomalies),
        "detected_at": datetime.utcnow().isoformat(),
        "by_severity": {
            "CRITICAL": len([a for a in anomalies if a.severity == "CRITICAL"]),
            "HIGH": len([a for a in anomalies if a.severity == "HIGH"]),
            "MEDIUM": len([a for a in anomalies if a.severity == "MEDIUM"]),
            "LOW": len([a for a in anomalies if a.severity == "LOW"])
        },
        "by_type": {},
        "affected_inventories": len(set([a.inventory_id for a in anomalies if a.inventory_id])),
        "affected_lists": len(set([a.counting_list_id for a in anomalies if a.counting_list_id])),
        "total_affected_products": sum([a.affected_products for a in anomalies]),
        "critical_alerts": [],
        "estimated_financial_risk": 0
    }

    # Contar por tipo
    for anomaly in anomalies:
        summary["by_type"][anomaly.anomaly_type] = summary["by_type"].get(anomaly.anomaly_type, 0) + 1

    # Alertas críticos
    critical_anomalies = [a for a in anomalies if a.severity == "CRITICAL"]
    for anomaly in critical_anomalies:
        summary["critical_alerts"].append({
            "title": anomaly.title,
            "description": anomaly.description,
            "inventory": anomaly.inventory_name,
            "detected_at": anomaly.detected_at.isoformat()
        })

    # Estimar risco financeiro (R$ 850/produto para produtos órfãos e dessincrónicos)
    for anomaly in anomalies:
        if anomaly.anomaly_type in ["CYCLE_DESYNC", "ORPHAN_PRODUCTS", "EXTREME_DISCREPANCY"]:
            summary["estimated_financial_risk"] += anomaly.affected_products * 850

    return summary
