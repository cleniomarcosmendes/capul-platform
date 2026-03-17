"""
Endpoint de Integração com ERP Protheus
Versão: 2.19.0
Data: 21/11/2025

Gera dados de integração para:
- Modo SIMPLES: Apenas ajustes de inventário (SB7)
- Modo COMPARATIVO: Transferências (SD3) + Inventário ajustado (SB7)

Reutiliza 100% da lógica de análise comparativa já validada.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID
import json
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_user


# =====================================================
# FUNÇÃO AUXILIAR PARA PARSEAR OBSERVATION (LOTES)
# =====================================================

def parse_lot_observation(observation: str) -> Dict[str, float]:
    """
    Parseia o campo observation para extrair quantidades por lote.

    Formato esperado: "Contagem por lotes: LOTE1:QTD1, LOTE2:QTD2 - DATA, HORA"

    Exemplo:
        Input: "Contagem por lotes: 000000000017963:10, 000000000020014:140 - 27/10/2025, 15:27:54"
        Output: {'000000000017963': 10.0, '000000000020014': 140.0}
    """
    if not observation:
        return {}

    try:
        # Regex para extrair pares LOTE:QUANTIDADE
        pattern = r'(\d+):(\d+(?:\.\d+)?)'
        matches = re.findall(pattern, observation)

        result = {}
        for lot_num, qty_str in matches:
            # Normalizar número do lote (pad com zeros à esquerda até 15 dígitos)
            lot_normalized = lot_num.zfill(15)
            result[lot_normalized] = float(qty_str)

        return result

    except Exception as e:
        logger.warning(f"Erro ao parsear observation: {str(e)}")
        return {}

router = APIRouter()
logger = logging.getLogger(__name__)


# =====================================================
# FUNÇÕES AUXILIARES
# =====================================================

def get_inventory_details(db: Session, inventory_id: UUID) -> Optional[Dict]:
    """Busca detalhes de um inventário."""
    query = text("""
        SELECT
            il.id,
            il.name,
            il.warehouse,
            il.store_id,
            il.list_status,
            il.closed_at,
            il.current_cycle,
            s.code as store_code,
            s.name as store_name
        FROM inventario.inventory_lists il
        JOIN inventario.stores s ON s.id = il.store_id
        WHERE il.id = :inventory_id
    """)
    result = db.execute(query, {"inventory_id": str(inventory_id)}).fetchone()

    if not result:
        return None

    return {
        "id": str(result[0]),
        "name": result[1],
        "warehouse": result[2],
        "store_id": str(result[3]),
        "list_status": result[4],
        "closed_at": result[5].isoformat() if result[5] else None,
        "current_cycle": result[6],
        "store_code": result[7],
        "store_name": result[8]
    }


def get_inventory_items_with_counts(db: Session, inventory_id: UUID) -> List[Dict]:
    """
    Busca itens do inventário com contagens e dados do snapshot.
    Retorna dados agregados (sem lote) e por lote quando aplicável.

    ✅ v2.19.1: Usa mesma lógica do inventory_comparison.py
    - Busca contagens com MULTIPLOS_LOTES e parseia o campo observation
    - Prioridade: contagem específica por lote > dados do observation
    """
    # Query principal para itens
    items_query = text("""
        SELECT
            ii.id,
            ii.product_code,
            ii.warehouse,
            ii.expected_quantity,
            COALESCE(ii.count_cycle_3, ii.count_cycle_2, ii.count_cycle_1, 0) as counted_qty,
            snap.b1_desc as description,
            snap.b1_rastro as tracking,
            snap.b2_qatu,
            snap.b2_cm1,
            snap.b2_xentpos
        FROM inventario.inventory_items ii
        LEFT JOIN inventario.inventory_items_snapshot snap ON snap.inventory_item_id = ii.id
        WHERE ii.inventory_list_id = :inventory_id
        ORDER BY ii.product_code
    """)

    item_results = db.execute(items_query, {"inventory_id": str(inventory_id)}).fetchall()

    items = []
    for row in item_results:
        item_id = str(row[0])
        product_code = row[1]
        tracking = (row[6] or "N").strip()

        item = {
            "id": item_id,
            "product_code": product_code,
            "warehouse": row[2],
            "expected_qty": float(row[3] or 0),
            "counted_qty": float(row[4] or 0),
            "description": row[5] or "",
            "tracking": tracking,
            "b2_qatu": float(row[7] or 0),
            "b2_cm1": float(row[8] or 0),
            "b2_xentpos": float(row[9] or 0),
            "lots": []
        }

        # Se produto tem rastreio de lote, buscar dados por lote
        if tracking == "L":
            # Buscar lotes do snapshot
            lots_query = text("""
                SELECT
                    ls.b8_lotectl,
                    ls.b8_lotefor,
                    ls.b8_saldo
                FROM inventario.inventory_lots_snapshot ls
                WHERE ls.inventory_item_id = :item_id
                ORDER BY ls.b8_lotectl
            """)
            lots_results = db.execute(lots_query, {"item_id": item_id}).fetchall()

            # Buscar contagens MULTIPLOS_LOTES para parsear observation
            multiplos_query = text("""
                SELECT c.count_number, c.observation
                FROM inventario.countings c
                WHERE c.inventory_item_id = :item_id
                AND c.lot_number = 'MULTIPLOS_LOTES'
                ORDER BY c.count_number DESC
            """)
            multiplos_results = db.execute(multiplos_query, {"item_id": item_id}).fetchall()

            # Parsear observation para extrair quantidades por lote
            # Formato: {lot_number: {cycle_1: qty, cycle_2: qty, cycle_3: qty}}
            parsed_lot_counts = {}
            for count_number, observation in multiplos_results:
                lot_quantities = parse_lot_observation(observation)
                for lot_num, qty in lot_quantities.items():
                    if lot_num not in parsed_lot_counts:
                        parsed_lot_counts[lot_num] = {1: 0, 2: 0, 3: 0}
                    parsed_lot_counts[lot_num][count_number] = qty

            # Processar cada lote do snapshot
            lots_data = []
            for lot_row in lots_results:
                lot_number = (lot_row[0] or "").strip()
                lot_supplier = (lot_row[1] or "").strip()
                lot_balance = float(lot_row[2] or 0)

                # PRIORIDADE 1: Buscar contagem com lot_number específico
                # ✅ v2.19.3: Usar MAX ao invés de SUM para evitar soma de registros duplicados
                specific_count_query = text("""
                    SELECT COALESCE(
                        (SELECT MAX(quantity) FROM inventario.countings
                         WHERE inventory_item_id = :item_id AND lot_number = :lot_num AND count_number = 3),
                        (SELECT MAX(quantity) FROM inventario.countings
                         WHERE inventory_item_id = :item_id AND lot_number = :lot_num AND count_number = 2),
                        (SELECT MAX(quantity) FROM inventario.countings
                         WHERE inventory_item_id = :item_id AND lot_number = :lot_num AND count_number = 1),
                        0
                    ) as counted
                """)
                specific_result = db.execute(specific_count_query, {
                    "item_id": item_id,
                    "lot_num": lot_number
                }).fetchone()
                lot_counted = float(specific_result[0] or 0) if specific_result else 0

                # PRIORIDADE 2: Se não encontrou, buscar no observation parseado
                if lot_counted == 0 and lot_number in parsed_lot_counts:
                    cycles = parsed_lot_counts[lot_number]
                    lot_counted = float(cycles.get(3, 0) or cycles.get(2, 0) or cycles.get(1, 0))

                lots_data.append({
                    "lot_number": lot_number,
                    "lot_supplier": lot_supplier,
                    "lot_balance": lot_balance,
                    "lot_counted": lot_counted
                })

            item["lots"] = lots_data

        items.append(item)

    return items


def calculate_simple_adjustments(inventory: Dict, items: List[Dict]) -> List[Dict]:
    """
    Calcula ajustes simples de inventário (modo SIMPLE).
    Retorna lista de ajustes para SB7.
    Inclui linha agregada (total) + linhas por lote quando aplicável.

    🔧 v2.19.19: Inclui TODOS os produtos (com e sem divergência)
    para envio completo ao Protheus.

    🔧 v2.19.55: Para integração Protheus, usa saldo do sistema (b2_qatu)
    SEM somar entrega posterior, e subtrai b2_xentpos da contagem.
    Isso evita gerar entrada de estoque de produto já faturado.
    """
    adjustments = []

    for item in items:
        b2_xentpos = item.get("b2_xentpos", 0) or 0

        # ✅ v2.19.55: Para Protheus, expected = saldo sistema (sem entrega posterior)
        # e counted = contagem física - entrega posterior
        expected = item["b2_qatu"]
        counted = item["counted_qty"] - b2_xentpos
        diff = counted - expected

        # 🔧 v2.19.19: Removido filtro - mostrar TODOS os produtos
        # O Protheus é o sistema oficial e precisa receber todos os resultados

        # Determinar tipo de ajuste
        if diff > 0.0001:
            adj_type = "INCREASE"
        elif diff < -0.0001:
            adj_type = "DECREASE"
        else:
            adj_type = "NO_CHANGE"

        # Ajuste agregado (linha principal)
        adjustment = {
            "item_type": "ADJUSTMENT",
            "product_code": item["product_code"],
            "product_description": item["description"],
            "lot_number": None,  # Agregado
            "lot_supplier": None,
            "warehouse": item["warehouse"],
            "expected_qty": expected,
            "counted_qty": counted,
            "adjustment_qty": diff,
            "adjustment_type": adj_type,
            "unit_cost": item["b2_cm1"],
            "total_value": abs(diff) * item["b2_cm1"],
            "tracking": item["tracking"],
            "b2_xentpos": b2_xentpos
        }

        adjustments.append(adjustment)

        # Se tem lotes, criar ajustes por lote também
        if item["tracking"] == "L" and item["lots"]:
            for lot in item["lots"]:
                if lot:
                    lot_expected = float(lot.get("lot_balance", 0))
                    lot_counted = float(lot.get("lot_counted", 0))
                    lot_diff = lot_counted - lot_expected

                    # Determinar tipo de ajuste do lote
                    if lot_diff > 0:
                        lot_adj_type = "INCREASE"
                    elif lot_diff < 0:
                        lot_adj_type = "DECREASE"
                    else:
                        lot_adj_type = "NO_CHANGE"

                    lot_adj = {
                        "item_type": "ADJUSTMENT",
                        "product_code": item["product_code"],
                        "product_description": item["description"],
                        "lot_number": lot.get("lot_number"),
                        "lot_supplier": lot.get("lot_supplier"),
                        "warehouse": item["warehouse"],
                        "expected_qty": lot_expected,
                        "counted_qty": lot_counted,
                        "adjustment_qty": lot_diff,
                        "adjustment_type": lot_adj_type,
                        "unit_cost": item["b2_cm1"],
                        "total_value": abs(lot_diff) * item["b2_cm1"],
                        "tracking": item["tracking"]
                    }
                    adjustments.append(lot_adj)

    return adjustments


def calculate_comparative_integration(
    db: Session,
    inventory_a: Dict,
    inventory_b: Dict,
    items_a: List[Dict],
    items_b: List[Dict]
) -> Dict:
    """
    Calcula integração comparativa (modo COMPARATIVE).
    Reutiliza a lógica de análise comparativa existente.

    Retorna:
    - transfers: Lista de transferências (SD3)
    - adjustments_a: Ajustes do inventário A (SB7)
    - adjustments_b: Ajustes do inventário B (SB7)
    """
    transfers = []
    adjustments_a = []
    adjustments_b = []

    # Criar dicionários para lookup rápido
    items_a_dict = {item["product_code"]: item for item in items_a}
    items_b_dict = {item["product_code"]: item for item in items_b}

    # Todos os produtos (união)
    all_products = set(items_a_dict.keys()) | set(items_b_dict.keys())

    for product_code in all_products:
        item_a = items_a_dict.get(product_code)
        item_b = items_b_dict.get(product_code)

        # ✅ v2.19.55: Para Protheus, expected = b2_qatu (sem entrega posterior)
        # e counted = contagem física - b2_xentpos
        b2_xentpos_a = (item_a.get("b2_xentpos", 0) or 0) if item_a else 0
        b2_xentpos_b = (item_b.get("b2_xentpos", 0) or 0) if item_b else 0

        expected_a = item_a["b2_qatu"] if item_a else 0
        counted_a = (item_a["counted_qty"] - b2_xentpos_a) if item_a else 0
        expected_b = item_b["b2_qatu"] if item_b else 0
        counted_b = (item_b["counted_qty"] - b2_xentpos_b) if item_b else 0

        # Divergências
        div_a = counted_a - expected_a  # Positivo = SOBRA, Negativo = FALTA
        div_b = counted_b - expected_b

        # Dados do produto
        ref_item = item_a or item_b
        description = ref_item["description"]
        unit_cost = ref_item["b2_cm1"]
        tracking = ref_item["tracking"]

        # =====================================================
        # LÓGICA DE TRANSFERÊNCIA (mesma do endpoint /compare)
        # =====================================================
        transfer_qty = 0
        source_wh = None
        target_wh = None
        saldo_a_ajustado = expected_a
        saldo_b_ajustado = expected_b

        # Caso 1: A tem SOBRA (contou mais), B tem FALTA (contou menos)
        # Transferir SALDO de B (FALTA) para A (SOBRA)
        # Isso REDUZ o saldo de B e AUMENTA o saldo de A
        if div_a > 0 and div_b < 0:
            transfer_qty = min(div_a, abs(div_b))
            source_wh = inventory_b["warehouse"]  # B é origem (tem FALTA - saldo sai)
            target_wh = inventory_a["warehouse"]  # A é destino (tem SOBRA - saldo entra)
            saldo_b_ajustado = expected_b - transfer_qty  # Saldo de B diminui
            saldo_a_ajustado = expected_a + transfer_qty  # Saldo de A aumenta

        # Caso 2: B tem SOBRA (contou mais), A tem FALTA (contou menos)
        # Transferir SALDO de A (FALTA) para B (SOBRA)
        # Isso REDUZ o saldo de A e AUMENTA o saldo de B
        elif div_b > 0 and div_a < 0:
            transfer_qty = min(div_b, abs(div_a))
            source_wh = inventory_a["warehouse"]  # A é origem (tem FALTA - saldo sai)
            target_wh = inventory_b["warehouse"]  # B é destino (tem SOBRA - saldo entra)
            saldo_a_ajustado = expected_a - transfer_qty  # Saldo de A diminui
            saldo_b_ajustado = expected_b + transfer_qty  # Saldo de B aumenta

        # Criar transferência se houver
        if transfer_qty > 0:
            # Calcular saldos antes e depois da transferência
            if source_wh == inventory_a["warehouse"]:
                source_before = expected_a
                source_after = saldo_a_ajustado
                target_before = expected_b
                target_after = saldo_b_ajustado
                source_item = item_a
                target_item = item_b
            else:
                source_before = expected_b
                source_after = saldo_b_ajustado
                target_before = expected_a
                target_after = saldo_a_ajustado
                source_item = item_b
                target_item = item_a

            # ✅ v2.19.5: Para produtos COM lote, calcular linhas de lote e
            # usar valores agregados originais (ANTES) e calculados (DEPOIS = ANTES ± transfer)
            if tracking and tracking.strip() == "L":
                source_lots = source_item.get("lots", []) if source_item else []
                target_lots = target_item.get("lots", []) if target_item else []

                # Criar dicionários de lotes para busca rápida
                source_lots_dict = {lot.get("lot_number"): lot for lot in source_lots if lot}
                target_lots_dict = {lot.get("lot_number"): lot for lot in target_lots if lot}

                # Calcular soma dos saldos de TODOS os lotes (para ANTES)
                total_source_before = sum(float(lot.get("lot_balance", 0)) for lot in source_lots if lot)
                total_target_before = sum(float(lot.get("lot_balance", 0)) for lot in target_lots if lot)

                # Acumuladores para transferências por lote
                total_lot_transfer = 0
                lot_details = []

                # Unir todos os números de lotes (origem + destino)
                all_lot_numbers = set(source_lots_dict.keys()) | set(target_lots_dict.keys())

                for lot_number in all_lot_numbers:
                    source_lot = source_lots_dict.get(lot_number, {})
                    target_lot = target_lots_dict.get(lot_number, {})

                    # Saldos e contagens da ORIGEM
                    source_lot_balance = float(source_lot.get("lot_balance", 0)) if source_lot else 0
                    source_lot_counted = float(source_lot.get("lot_counted", 0)) if source_lot else 0
                    lot_supplier = source_lot.get("lot_supplier", "") if source_lot else target_lot.get("lot_supplier", "")

                    # Saldos e contagens do DESTINO
                    target_lot_balance = float(target_lot.get("lot_balance", 0)) if target_lot else 0
                    target_lot_counted = float(target_lot.get("lot_counted", 0)) if target_lot else 0

                    # Divergências por lote (counted - expected, igual à análise)
                    source_lot_div = source_lot_counted - source_lot_balance
                    target_lot_div = target_lot_counted - target_lot_balance

                    # Calcular transferência deste lote
                    lot_transfer_qty = 0
                    if source_lot_div < 0 and target_lot_div > 0:
                        lot_transfer_qty = min(abs(source_lot_div), target_lot_div)
                        total_lot_transfer += lot_transfer_qty

                    # Só adicionar linha de lote se houver transferência (qty > 0)
                    if lot_transfer_qty > 0:
                        lot_details.append({
                            "item_type": "TRANSFER",
                            "row_type": "LOT_DETAIL",
                            "product_code": product_code,
                            "product_description": description,
                            "lot_number": lot_number,
                            "lot_supplier": lot_supplier,
                            "source_warehouse": source_wh,
                            "target_warehouse": target_wh,
                            "quantity": lot_transfer_qty,
                            "unit_cost": unit_cost,
                            "total_value": lot_transfer_qty * unit_cost,
                            "tracking": tracking,
                            "source_balance_before": source_lot_balance,
                            "source_balance_after": source_lot_balance - lot_transfer_qty,
                            "source_counted": source_lot_counted,  # ✅ v2.19.49: Qtde contada origem
                            "target_balance_before": target_lot_balance,
                            "target_balance_after": target_lot_balance + lot_transfer_qty,
                            "target_counted": target_lot_counted,  # ✅ v2.19.49: Qtde contada destino
                            "divergence_source": source_lot_div,
                            "divergence_target": target_lot_div
                        })

                # ✅ v2.19.5: AGREGADO = SOMA das linhas de lote visíveis
                # Calcular soma dos ANTES e DEPOIS apenas dos lotes que aparecem (com transferência)
                agg_source_before = sum(l["source_balance_before"] for l in lot_details)
                agg_source_after = sum(l["source_balance_after"] for l in lot_details)
                agg_target_before = sum(l["target_balance_before"] for l in lot_details)
                agg_target_after = sum(l["target_balance_after"] for l in lot_details)
                agg_qty = sum(l["quantity"] for l in lot_details)
                # ✅ v2.19.49: Soma das quantidades contadas
                agg_source_counted = sum(l.get("source_counted", 0) for l in lot_details)
                agg_target_counted = sum(l.get("target_counted", 0) for l in lot_details)

                transfers.append({
                    "item_type": "TRANSFER",
                    "row_type": "AGGREGATE",
                    "product_code": product_code,
                    "product_description": description,
                    "lot_number": None,
                    "lot_supplier": None,
                    "source_warehouse": source_wh,
                    "target_warehouse": target_wh,
                    "quantity": agg_qty,  # Soma das transferências por lote
                    "unit_cost": unit_cost,
                    "total_value": agg_qty * unit_cost,
                    "tracking": tracking,
                    # ANTES e DEPOIS = soma das linhas de lote
                    "source_balance_before": agg_source_before,
                    "source_balance_after": agg_source_after,
                    "source_counted": agg_source_counted,  # ✅ v2.19.49: Qtde contada origem
                    "target_balance_before": agg_target_before,
                    "target_balance_after": agg_target_after,
                    "target_counted": agg_target_counted,  # ✅ v2.19.49: Qtde contada destino
                    "divergence_source": div_a if source_wh == inventory_a["warehouse"] else div_b,
                    "divergence_target": div_b if target_wh == inventory_b["warehouse"] else div_a
                })

                # Adicionar linhas de lote após a linha agregada
                transfers.extend(lot_details)

                # ✅ v2.19.55: Recalcular saldo_ajustado com transferência REAL por lote
                # (transfer_qty é teórica no nível produto, agg_qty é a real por lote)
                if agg_qty != transfer_qty:
                    logger.info(f"  🔄 Recalculando ajustado para {product_code}: transfer_teorica={transfer_qty} → real_lotes={agg_qty}")
                    transfer_qty = agg_qty
                    saldo_a_ajustado = expected_a
                    saldo_b_ajustado = expected_b
                    if source_wh == inventory_a["warehouse"]:
                        saldo_a_ajustado = expected_a - transfer_qty
                        saldo_b_ajustado = expected_b + transfer_qty
                    elif source_wh == inventory_b["warehouse"]:
                        saldo_b_ajustado = expected_b - transfer_qty
                        saldo_a_ajustado = expected_a + transfer_qty

            else:
                # Produto SEM lote - manter lógica original
                # ✅ v2.19.49: Qtde contada baseada em qual armazém é origem/destino
                source_cnt = counted_a if source_wh == inventory_a["warehouse"] else counted_b
                target_cnt = counted_b if target_wh == inventory_b["warehouse"] else counted_a

                transfers.append({
                    "item_type": "TRANSFER",
                    "row_type": "AGGREGATE",
                    "product_code": product_code,
                    "product_description": description,
                    "lot_number": None,
                    "lot_supplier": None,
                    "source_warehouse": source_wh,
                    "target_warehouse": target_wh,
                    "quantity": transfer_qty,
                    "unit_cost": unit_cost,
                    "total_value": transfer_qty * unit_cost,
                    "tracking": tracking,
                    "source_balance_before": source_before,
                    "source_balance_after": source_after,
                    "source_counted": source_cnt,  # ✅ v2.19.49: Qtde contada origem
                    "target_balance_before": target_before,
                    "target_balance_after": target_after,
                    "target_counted": target_cnt,  # ✅ v2.19.49: Qtde contada destino
                    "divergence_source": div_a if source_wh == inventory_a["warehouse"] else div_b,
                    "divergence_target": div_b if target_wh == inventory_b["warehouse"] else div_a
                })

        # =====================================================
        # AJUSTES APÓS TRANSFERÊNCIA
        # =====================================================

        # Calcular transferência LÓGICA aplicada a cada inventário
        # CONCEITO: A transferência FÍSICA já aconteceu no passado, mas não foi registrada
        # Agora estamos fazendo a transferência LÓGICA para regularizar
        #
        # Interpretação:
        # - ARM com FALTA: produtos SAÍRAM fisicamente (mas sistema não sabe)
        #   → TRANSF NEGATIVO (reduz o esperado para bater com contado)
        # - ARM com SOBRA: produtos CHEGARAM fisicamente (mas sistema não sabe)
        #   → TRANSF POSITIVO (aumenta o esperado para bater com contado)
        #
        # Fórmula: ESTOQUE AJUST = SALDO + TRANSF → deve se aproximar do CONTADO
        transfer_qty_a = 0
        transfer_qty_b = 0
        if transfer_qty > 0:
            if div_a < 0:
                # A tem FALTA → produtos SAÍRAM de A no passado
                # Para regularizar: diminuir esperado de A
                transfer_qty_a = -transfer_qty  # Negativo: saiu de A
                transfer_qty_b = transfer_qty   # Positivo: entrou em B
            else:
                # A tem SOBRA → produtos CHEGARAM em A no passado
                # Para regularizar: aumentar esperado de A
                transfer_qty_a = transfer_qty   # Positivo: entrou em A
                transfer_qty_b = -transfer_qty  # Negativo: saiu de B

        # Diferença final A (após transferência)
        diff_a_final = counted_a - saldo_a_ajustado
        if item_a:  # Incluir mesmo se diff=0, para mostrar na tabela
            adj_type_a = "INCREASE" if diff_a_final > 0 else ("DECREASE" if diff_a_final < 0 else "NO_CHANGE")
            # Linha agregada (cabeçalho do produto)
            adjustments_a.append({
                "item_type": "ADJUSTMENT",
                "row_type": "AGGREGATE",  # Linha agregada
                "product_code": product_code,
                "product_description": description,
                "lot_number": None,
                "warehouse": inventory_a["warehouse"],
                "expected_qty": expected_a,
                "adjusted_qty": saldo_a_ajustado,
                "counted_qty": counted_a,
                "adjustment_qty": diff_a_final,
                "adjustment_type": adj_type_a,
                "unit_cost": unit_cost,
                "total_value": abs(diff_a_final) * unit_cost,
                "tracking": tracking,
                "transfer_qty": transfer_qty_a,
                "transfer_applied": abs(transfer_qty_a),
                "b2_xentpos": b2_xentpos_a
            })

            # Linhas por lote (se produto tem rastreio de lote)
            # Calcular transferência POR LOTE para ajustes
            if tracking and tracking.strip() == "L" and item_a.get("lots"):
                lots_a = item_a.get("lots", [])
                total_lot_transfer_a = 0

                for lot in lots_a:
                    if lot:
                        lot_number = lot.get("lot_number")
                        lot_supplier = lot.get("lot_supplier")
                        lot_expected = float(lot.get("lot_balance", 0))
                        lot_counted = float(lot.get("lot_counted", 0))

                        # Divergência bruta do lote (saldo - contado)
                        # Positivo = saldo > contado = FALTA física (sistema diz ter mais do que tem)
                        # Negativo = contado > saldo = SOBRA física (tem mais do que sistema diz)
                        lot_divergence = lot_expected - lot_counted

                        # Calcular transferência deste lote
                        lot_transfer = 0
                        if transfer_qty_a < 0 and lot_divergence > 0:
                            # A está ENVIANDO saldo (transfer_qty_a < 0) porque tem FALTA geral
                            # Este lote tem FALTA (saldo > contado), então reduzimos seu saldo
                            lot_transfer = -min(lot_divergence, abs(transfer_qty_a) - total_lot_transfer_a)
                            total_lot_transfer_a += abs(lot_transfer)
                        elif transfer_qty_a > 0 and lot_divergence < 0:
                            # A está RECEBENDO saldo (transfer_qty_a > 0) porque tem SOBRA geral
                            # Este lote tem SOBRA (contado > saldo), então aumentamos seu saldo
                            lot_transfer = min(abs(lot_divergence), transfer_qty_a - total_lot_transfer_a)
                            total_lot_transfer_a += lot_transfer

                        # Saldo ajustado do lote
                        lot_adjusted = lot_expected + lot_transfer
                        lot_diff_final = lot_counted - lot_adjusted
                        lot_adj_type = "INCREASE" if lot_diff_final > 0 else ("DECREASE" if lot_diff_final < 0 else "NO_CHANGE")

                        adjustments_a.append({
                            "item_type": "ADJUSTMENT",
                            "row_type": "LOT_DETAIL",
                            "product_code": product_code,
                            "product_description": description,
                            "lot_number": lot_number,
                            "lot_supplier": lot_supplier,
                            "warehouse": inventory_a["warehouse"],
                            "expected_qty": lot_expected,
                            "adjusted_qty": lot_adjusted,
                            "counted_qty": lot_counted,
                            "adjustment_qty": lot_diff_final,
                            "adjustment_type": lot_adj_type,
                            "unit_cost": unit_cost,
                            "total_value": abs(lot_diff_final) * unit_cost,
                            "tracking": tracking,
                            "transfer_qty": lot_transfer,
                            "transfer_applied": abs(lot_transfer)
                        })

        # Diferença final B (após transferência)
        diff_b_final = counted_b - saldo_b_ajustado
        if item_b:  # Incluir mesmo se diff=0, para mostrar na tabela
            adj_type_b = "INCREASE" if diff_b_final > 0 else ("DECREASE" if diff_b_final < 0 else "NO_CHANGE")
            # Linha agregada (cabeçalho do produto)
            adjustments_b.append({
                "item_type": "ADJUSTMENT",
                "row_type": "AGGREGATE",  # Linha agregada
                "product_code": product_code,
                "product_description": description,
                "lot_number": None,
                "warehouse": inventory_b["warehouse"],
                "expected_qty": expected_b,
                "adjusted_qty": saldo_b_ajustado,
                "counted_qty": counted_b,
                "adjustment_qty": diff_b_final,
                "adjustment_type": adj_type_b,
                "unit_cost": unit_cost,
                "total_value": abs(diff_b_final) * unit_cost,
                "tracking": tracking,
                "transfer_qty": transfer_qty_b,
                "transfer_applied": abs(transfer_qty_b),
                "b2_xentpos": b2_xentpos_b
            })

            # Linhas por lote (se produto tem rastreio de lote)
            # Calcular transferência POR LOTE para ajustes (mesma lógica de adjustments_a)
            if tracking and tracking.strip() == "L" and item_b.get("lots"):
                lots_b = item_b.get("lots", [])
                total_lot_transfer_b = 0

                for lot in lots_b:
                    if lot:
                        lot_number = lot.get("lot_number")
                        lot_supplier = lot.get("lot_supplier")
                        lot_expected = float(lot.get("lot_balance", 0))
                        lot_counted = float(lot.get("lot_counted", 0))

                        # Divergência bruta do lote (saldo - contado)
                        # Positivo = saldo > contado = FALTA física (sistema diz ter mais do que tem)
                        # Negativo = contado > saldo = SOBRA física (tem mais do que sistema diz)
                        lot_divergence = lot_expected - lot_counted

                        # Calcular transferência deste lote
                        lot_transfer = 0
                        if transfer_qty_b < 0 and lot_divergence > 0:
                            # B está ENVIANDO saldo (transfer_qty_b < 0) porque tem FALTA geral
                            # Este lote tem FALTA (saldo > contado), então reduzimos seu saldo
                            lot_transfer = -min(lot_divergence, abs(transfer_qty_b) - total_lot_transfer_b)
                            total_lot_transfer_b += abs(lot_transfer)
                        elif transfer_qty_b > 0 and lot_divergence < 0:
                            # B está RECEBENDO saldo (transfer_qty_b > 0) porque tem SOBRA geral
                            # Este lote tem SOBRA (contado > saldo), então aumentamos seu saldo
                            lot_transfer = min(abs(lot_divergence), transfer_qty_b - total_lot_transfer_b)
                            total_lot_transfer_b += lot_transfer

                        # Saldo ajustado do lote
                        lot_adjusted = lot_expected + lot_transfer
                        lot_diff_final = lot_counted - lot_adjusted
                        lot_adj_type = "INCREASE" if lot_diff_final > 0 else ("DECREASE" if lot_diff_final < 0 else "NO_CHANGE")

                        adjustments_b.append({
                            "item_type": "ADJUSTMENT",
                            "row_type": "LOT_DETAIL",  # Linha de detalhe por lote
                            "product_code": product_code,
                            "product_description": description,
                            "lot_number": lot_number,
                            "lot_supplier": lot_supplier,
                            "warehouse": inventory_b["warehouse"],
                            "expected_qty": lot_expected,
                            "adjusted_qty": lot_adjusted,
                            "counted_qty": lot_counted,
                            "adjustment_qty": lot_diff_final,
                            "adjustment_type": lot_adj_type,
                            "unit_cost": unit_cost,
                            "total_value": abs(lot_diff_final) * unit_cost,
                            "tracking": tracking,
                            "transfer_qty": lot_transfer,
                            "transfer_applied": abs(lot_transfer)
                        })

    return {
        "transfers": transfers,
        "adjustments_a": adjustments_a,
        "adjustments_b": adjustments_b
    }


def get_existing_integration(db: Session, inventory_a_id: UUID, inventory_b_id: Optional[UUID]) -> Optional[Dict]:
    """Verifica se já existe integração para esses inventários."""
    if inventory_b_id:
        query = text("""
            SELECT id, status, version, created_at, sent_at, confirmed_at,
                   protheus_doc_transfers, protheus_doc_inventory
            FROM inventario.protheus_integrations
            WHERE inventory_a_id = :inv_a AND inventory_b_id = :inv_b
        """)
        result = db.execute(query, {"inv_a": str(inventory_a_id), "inv_b": str(inventory_b_id)}).fetchone()
    else:
        query = text("""
            SELECT id, status, version, created_at, sent_at, confirmed_at,
                   protheus_doc_transfers, protheus_doc_inventory
            FROM inventario.protheus_integrations
            WHERE inventory_a_id = :inv_a AND inventory_b_id IS NULL
        """)
        result = db.execute(query, {"inv_a": str(inventory_a_id)}).fetchone()

    if not result:
        return None

    return {
        "id": str(result[0]),
        "status": result[1],
        "version": result[2],
        "created_at": result[3].isoformat() if result[3] else None,
        "sent_at": result[4].isoformat() if result[4] else None,
        "confirmed_at": result[5].isoformat() if result[5] else None,
        "protheus_doc_transfers": result[6],
        "protheus_doc_inventory": result[7]
    }


def check_inventory_already_integrated(db: Session, inventory_id: UUID) -> Optional[Dict]:
    """
    Verifica se um inventário já foi integrado com Protheus (como A ou B).

    ✅ REGRA DE NEGÓCIO:
    Um inventário que já foi integrado (status SENT, CONFIRMED, PROCESSING)
    NÃO pode ser usado em outra integração comparativa.

    Retorna:
        None se inventário está disponível
        Dict com dados da integração existente se já foi integrado
    """
    query = text("""
        SELECT
            pi.id,
            pi.status,
            pi.integration_type,
            pi.created_at,
            pi.sent_at,
            pi.confirmed_at,
            CASE
                WHEN pi.inventory_a_id = :inv_id THEN 'A'
                ELSE 'B'
            END as used_as,
            CASE
                WHEN pi.inventory_a_id = :inv_id THEN ila.name
                ELSE ilb.name
            END as partner_inventory_name,
            CASE
                WHEN pi.inventory_a_id = :inv_id THEN ilb.warehouse
                ELSE ila.warehouse
            END as partner_warehouse
        FROM inventario.protheus_integrations pi
        JOIN inventario.inventory_lists ila ON ila.id = pi.inventory_a_id
        LEFT JOIN inventario.inventory_lists ilb ON ilb.id = pi.inventory_b_id
        WHERE (pi.inventory_a_id = :inv_id OR pi.inventory_b_id = :inv_id)
        AND pi.status IN ('SENT', 'CONFIRMED', 'PROCESSING')
        ORDER BY pi.created_at DESC
        LIMIT 1
    """)

    result = db.execute(query, {"inv_id": str(inventory_id)}).fetchone()

    if not result:
        return None

    return {
        "integration_id": str(result[0]),
        "status": result[1],
        "integration_type": result[2],
        "created_at": result[3].isoformat() if result[3] else None,
        "sent_at": result[4].isoformat() if result[4] else None,
        "confirmed_at": result[5].isoformat() if result[5] else None,
        "used_as": result[6],
        "partner_inventory_name": result[7],
        "partner_warehouse": result[8]
    }


def get_inventories_already_integrated(db: Session, store_id: str) -> List[str]:
    """
    Retorna lista de IDs de inventários que já foram integrados com Protheus.
    Usada para filtrar inventários disponíveis para nova integração.
    """
    query = text("""
        SELECT DISTINCT unnest(ARRAY[
            pi.inventory_a_id::text,
            pi.inventory_b_id::text
        ]) as inventory_id
        FROM inventario.protheus_integrations pi
        WHERE pi.store_id = :store_id
        AND pi.status IN ('SENT', 'CONFIRMED', 'PROCESSING')
        AND (pi.inventory_a_id IS NOT NULL OR pi.inventory_b_id IS NOT NULL)
    """)

    results = db.execute(query, {"store_id": store_id}).fetchall()

    # Filtrar NULLs (inventory_b pode ser NULL em integrações SIMPLE)
    return [r[0] for r in results if r[0] is not None]


# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/compatible-inventories/{inventory_id}")
async def get_compatible_inventories(
    inventory_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lista inventários compatíveis para análise comparativa.

    Critérios:
    - Mesma loja (store_id)
    - Armazém DIFERENTE
    - Status ENCERRADO
    - NÃO estar já integrado com Protheus (status SENT/CONFIRMED/PROCESSING)
    """
    # Buscar inventário de referência
    ref_inv = get_inventory_details(db, inventory_id)
    if not ref_inv:
        raise HTTPException(status_code=404, detail="Inventário não encontrado")

    # ✅ VALIDAÇÃO: Verificar se inventário de referência já foi integrado
    ref_already_integrated = check_inventory_already_integrated(db, inventory_id)
    if ref_already_integrated:
        return {
            "reference_inventory": ref_inv,
            "compatible_inventories": [],
            "total": 0,
            "blocked": True,
            "blocked_reason": f"Inventário já integrado com Protheus (status: {ref_already_integrated['status']})",
            "existing_integration": ref_already_integrated
        }

    # Buscar inventários já integrados para excluí-los
    already_integrated_ids = get_inventories_already_integrated(db, ref_inv["store_id"])

    # Buscar inventários compatíveis
    query = text("""
        SELECT
            il.id,
            il.name,
            il.warehouse,
            il.list_status,
            il.closed_at
        FROM inventario.inventory_lists il
        WHERE il.store_id = :store_id
        AND il.warehouse != :warehouse
        AND il.list_status = 'ENCERRADA'
        AND il.id != :inventory_id
        ORDER BY il.closed_at DESC
    """)

    results = db.execute(query, {
        "store_id": ref_inv["store_id"],
        "warehouse": ref_inv["warehouse"],
        "inventory_id": str(inventory_id)
    }).fetchall()

    compatible = []
    for row in results:
        inv_id = str(row[0])
        # ✅ FILTRO: Excluir inventários já integrados
        is_already_integrated = inv_id in already_integrated_ids
        compatible.append({
            "id": inv_id,
            "name": row[1],
            "warehouse": row[2],
            "list_status": row[3],
            "closed_at": row[4].isoformat() if row[4] else None,
            "already_integrated": is_already_integrated
        })

    # Filtrar apenas não integrados para lista principal
    available = [c for c in compatible if not c.get("already_integrated", False)]
    blocked = [c for c in compatible if c.get("already_integrated", False)]

    return {
        "reference_inventory": ref_inv,
        "compatible_inventories": available,
        "blocked_inventories": blocked,
        "total": len(available),
        "total_blocked": len(blocked)
    }


@router.get("/existing-integration/{inventory_id}")
async def get_existing_integration_for_inventory(
    inventory_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Verifica se um inventário já possui integração existente.

    Retorna:
    - has_integration: bool
    - integration_info: dados da integração (se existir)
    - partner_inventory: dados do inventário parceiro (se existir)
    - used_as: 'A' ou 'B' (posição do inventário na integração original)

    ✅ v2.19.48: Usado para auto-preenchimento e troca automática no frontend
    """
    # Buscar inventário de referência
    ref_inv = get_inventory_details(db, inventory_id)
    if not ref_inv:
        raise HTTPException(status_code=404, detail="Inventário não encontrado")

    # Buscar integração existente onde este inventário participa (como A ou B)
    query = text("""
        SELECT
            pi.id,
            pi.status,
            pi.integration_type,
            pi.created_at,
            pi.sent_at,
            pi.confirmed_at,
            pi.inventory_a_id,
            pi.inventory_b_id,
            ila.id as inv_a_id,
            ila.name as inv_a_name,
            ila.warehouse as inv_a_warehouse,
            ila.list_status as inv_a_status,
            ila.closed_at as inv_a_closed_at,
            ilb.id as inv_b_id,
            ilb.name as inv_b_name,
            ilb.warehouse as inv_b_warehouse,
            ilb.list_status as inv_b_status,
            ilb.closed_at as inv_b_closed_at
        FROM inventario.protheus_integrations pi
        JOIN inventario.inventory_lists ila ON ila.id = pi.inventory_a_id
        LEFT JOIN inventario.inventory_lists ilb ON ilb.id = pi.inventory_b_id
        WHERE (pi.inventory_a_id = :inv_id OR pi.inventory_b_id = :inv_id)
        ORDER BY pi.created_at DESC
        LIMIT 1
    """)

    result = db.execute(query, {"inv_id": str(inventory_id)}).fetchone()

    if not result:
        return {
            "has_integration": False,
            "reference_inventory": ref_inv,
            "integration_info": None,
            "partner_inventory": None,
            "used_as": None
        }

    # Determinar posição do inventário selecionado (A ou B)
    is_inventory_a = str(result[6]) == str(inventory_id)
    used_as = "A" if is_inventory_a else "B"

    # Dados do inventário parceiro
    if is_inventory_a and result[13]:  # Selecionado é A, parceiro é B
        partner = {
            "id": str(result[13]),
            "name": result[14],
            "warehouse": result[15],
            "list_status": result[16],
            "closed_at": result[17].isoformat() if result[17] else None
        }
    elif not is_inventory_a:  # Selecionado é B, parceiro é A
        partner = {
            "id": str(result[8]),
            "name": result[9],
            "warehouse": result[10],
            "list_status": result[11],
            "closed_at": result[12].isoformat() if result[12] else None
        }
    else:
        partner = None  # Integração SIMPLE (sem parceiro)

    return {
        "has_integration": True,
        "reference_inventory": ref_inv,
        "integration_info": {
            "id": str(result[0]),
            "status": result[1],
            "integration_type": result[2],
            "created_at": result[3].isoformat() if result[3] else None,
            "sent_at": result[4].isoformat() if result[4] else None,
            "confirmed_at": result[5].isoformat() if result[5] else None
        },
        "partner_inventory": partner,
        "used_as": used_as,
        "original_inventory_a": {
            "id": str(result[8]),
            "name": result[9],
            "warehouse": result[10]
        },
        "original_inventory_b": {
            "id": str(result[13]),
            "name": result[14],
            "warehouse": result[15]
        } if result[13] else None
    }


@router.post("/preview")
async def preview_integration(
    inventory_a_id: UUID = Query(..., description="ID do inventário principal"),
    inventory_b_id: Optional[UUID] = Query(None, description="ID do inventário B (opcional, para modo comparativo)"),
    view_only: bool = Query(False, description="Se True, permite visualizar integrações já enviadas"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Gera preview da integração sem salvar.

    Modos:
    - SIMPLE: Apenas inventory_a_id → Ajustes SB7
    - COMPARATIVE: inventory_a_id + inventory_b_id → Transferências SD3 + Ajustes SB7

    ✅ v2.19.48: Parâmetro view_only permite visualizar integrações já enviadas
    """
    logger.info(f"Preview de integração: inv_a={inventory_a_id}, inv_b={inventory_b_id}, view_only={view_only}")

    # Validar inventário A
    inv_a = get_inventory_details(db, inventory_a_id)
    if not inv_a:
        raise HTTPException(status_code=404, detail="Inventário A não encontrado")

    if inv_a["list_status"] != "ENCERRADA":
        raise HTTPException(
            status_code=400,
            detail=f"Inventário A deve estar ENCERRADO. Status atual: {inv_a['list_status']}"
        )

    # ✅ v2.19.48: Só bloqueia se NÃO for view_only
    inv_a_integrated = check_inventory_already_integrated(db, inventory_a_id)
    if inv_a_integrated and not view_only:
        raise HTTPException(
            status_code=400,
            detail=f"Inventário A já foi integrado com Protheus (status: {inv_a_integrated['status']}, "
                   f"usado como: {inv_a_integrated['used_as']}, "
                   f"parceiro: {inv_a_integrated['partner_inventory_name']} ARM.{inv_a_integrated['partner_warehouse']})"
        )

    # Determinar modo
    integration_type = "SIMPLE"
    inv_b = None

    if inventory_b_id:
        inv_b = get_inventory_details(db, inventory_b_id)
        if not inv_b:
            raise HTTPException(status_code=404, detail="Inventário B não encontrado")

        if inv_b["list_status"] != "ENCERRADA":
            raise HTTPException(
                status_code=400,
                detail=f"Inventário B deve estar ENCERRADO. Status atual: {inv_b['list_status']}"
            )

        if inv_a["store_id"] != inv_b["store_id"]:
            raise HTTPException(
                status_code=400,
                detail="Inventários devem ser da mesma loja"
            )

        if inv_a["warehouse"] == inv_b["warehouse"]:
            raise HTTPException(
                status_code=400,
                detail="Inventários devem ser de armazéns diferentes"
            )

        # ✅ v2.19.48: Só bloqueia se NÃO for view_only
        inv_b_integrated = check_inventory_already_integrated(db, inventory_b_id)
        if inv_b_integrated and not view_only:
            raise HTTPException(
                status_code=400,
                detail=f"Inventário B já foi integrado com Protheus (status: {inv_b_integrated['status']}, "
                       f"usado como: {inv_b_integrated['used_as']}, "
                       f"parceiro: {inv_b_integrated['partner_inventory_name']} ARM.{inv_b_integrated['partner_warehouse']})"
            )

        integration_type = "COMPARATIVE"

    # Buscar itens
    items_a = get_inventory_items_with_counts(db, inventory_a_id)
    items_b = get_inventory_items_with_counts(db, inventory_b_id) if inventory_b_id else []

    # Verificar se já existe integração
    existing = get_existing_integration(db, inventory_a_id, inventory_b_id)

    # Calcular integração
    if integration_type == "SIMPLE":
        adjustments_a = calculate_simple_adjustments(inv_a, items_a)

        result = {
            "integration_type": "SIMPLE",
            "inventory_a": inv_a,
            "inventory_b": None,
            "transfers": [],
            "adjustments_a": adjustments_a,  # Inventário A separado
            "adjustments_b": [],              # Vazio no modo simples
            "adjustments": adjustments_a,     # Compatibilidade
            "summary": {
                "total_transfers": 0,
                "total_adjustments": len(adjustments_a),
                "total_transfer_value": 0,
                "total_adjustment_value": sum(a["total_value"] for a in adjustments_a),
                "warehouses": [inv_a["warehouse"]]
            },
            "existing_integration": existing
        }
    else:
        calc_result = calculate_comparative_integration(db, inv_a, inv_b, items_a, items_b)

        all_adjustments = calc_result["adjustments_a"] + calc_result["adjustments_b"]

        result = {
            "integration_type": "COMPARATIVE",
            "inventory_a": inv_a,
            "inventory_b": inv_b,
            "transfers": calc_result["transfers"],
            "adjustments_a": calc_result["adjustments_a"],
            "adjustments_b": calc_result["adjustments_b"],
            "adjustments": all_adjustments,
            "summary": {
                "total_transfers": len(calc_result["transfers"]),
                "total_adjustments": len(all_adjustments),
                "total_transfer_value": sum(t["total_value"] for t in calc_result["transfers"]),
                "total_adjustment_value": sum(a["total_value"] for a in all_adjustments),
                "warehouses": [inv_a["warehouse"], inv_b["warehouse"]]
            },
            "existing_integration": existing
        }

    logger.info(f"Preview gerado: {result['summary']}")
    return result


@router.post("/save")
async def save_integration(
    inventory_a_id: UUID = Query(...),
    inventory_b_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Salva/atualiza a integração no banco (status DRAFT).
    Não envia para o Protheus ainda.
    """
    # Bloquear se inventário já está efetivado (CLOSED)
    inv_a_check = db.execute(text("""
        SELECT status FROM inventario.inventory_lists WHERE id = :id
    """), {"id": str(inventory_a_id)}).fetchone()
    if inv_a_check and inv_a_check[0] == 'CLOSED':
        raise HTTPException(
            status_code=400,
            detail="Inventário já efetivado. Não é possível criar nova integração."
        )

    # Gerar preview primeiro
    # ✅ v2.19.49: Corrigir chamada com parâmetro view_only
    preview = await preview_integration(
        inventory_a_id=inventory_a_id,
        inventory_b_id=inventory_b_id,
        view_only=False,
        db=db,
        current_user=current_user
    )

    existing = preview.get("existing_integration")

    try:
        if existing:
            # UPDATE - incrementar versão
            query = text("""
                UPDATE inventario.protheus_integrations
                SET integration_data = :data,
                    summary = :summary,
                    status = 'DRAFT',
                    version = version + 1,
                    updated_at = NOW()
                WHERE id = :id
                RETURNING id, version
            """)
            result = db.execute(query, {
                "id": existing["id"],
                "data": json.dumps(preview, default=str),
                "summary": json.dumps(preview["summary"])
            }).fetchone()

            integration_id = result[0]
            version = result[1]
            action = "UPDATED"
        else:
            # INSERT
            inv_a = preview["inventory_a"]
            query = text("""
                INSERT INTO inventario.protheus_integrations (
                    inventory_a_id, inventory_b_id, store_id, integration_type,
                    status, integration_data, summary, created_by
                ) VALUES (
                    :inv_a, :inv_b, :store_id, :type,
                    'DRAFT', :data, :summary, :user_id
                )
                RETURNING id, version
            """)
            result = db.execute(query, {
                "inv_a": str(inventory_a_id),
                "inv_b": str(inventory_b_id) if inventory_b_id else None,
                "store_id": inv_a["store_id"],
                "type": preview["integration_type"],
                "data": json.dumps(preview, default=str),
                "summary": json.dumps(preview["summary"]),
                "user_id": str(current_user.id)
            }).fetchone()

            integration_id = result[0]
            version = result[1]
            action = "CREATED"

        # Salvar itens detalhados
        # Primeiro limpar itens antigos
        db.execute(text("""
            DELETE FROM inventario.protheus_integration_items
            WHERE integration_id = :id
        """), {"id": str(integration_id)})

        # Inserir transferências
        for transfer in preview.get("transfers", []):
            # Para transferências, expected_qty = saldo origem, counted_qty = contagem origem
            src_balance = transfer.get("source_balance_before", 0)
            src_counted = transfer.get("source_counted", 0)
            db.execute(text("""
                INSERT INTO inventario.protheus_integration_items (
                    integration_id, item_type, product_code, product_description,
                    lot_number, source_warehouse, target_warehouse, quantity,
                    expected_qty, counted_qty,
                    unit_cost, total_value
                ) VALUES (
                    :int_id, 'TRANSFER', :code, :desc,
                    :lot, :source, :target, :qty,
                    :expected, :counted,
                    :cost, :value
                )
            """), {
                "int_id": str(integration_id),
                "code": transfer["product_code"],
                "desc": transfer["product_description"],
                "lot": transfer.get("lot_number"),
                "source": transfer["source_warehouse"],
                "target": transfer["target_warehouse"],
                "qty": transfer["quantity"],
                "expected": src_balance,
                "counted": src_counted,
                "cost": transfer["unit_cost"],
                "value": transfer["total_value"]
            })

        # Inserir ajustes
        for adj in preview.get("adjustments", []):
            db.execute(text("""
                INSERT INTO inventario.protheus_integration_items (
                    integration_id, item_type, product_code, product_description,
                    lot_number, target_warehouse, quantity, expected_qty,
                    counted_qty, adjusted_qty, adjustment_type, unit_cost, total_value
                ) VALUES (
                    :int_id, 'ADJUSTMENT', :code, :desc,
                    :lot, :wh, :qty, :expected,
                    :counted, :adjusted, :adj_type, :cost, :value
                )
            """), {
                "int_id": str(integration_id),
                "code": adj["product_code"],
                "desc": adj["product_description"],
                "lot": adj.get("lot_number"),
                "wh": adj["warehouse"],
                "qty": adj["adjustment_qty"],
                "expected": adj["expected_qty"],
                "counted": adj["counted_qty"],
                "adjusted": adj.get("adjusted_qty", adj["expected_qty"]),
                "adj_type": adj["adjustment_type"],
                "cost": adj["unit_cost"],
                "value": adj["total_value"]
            })

        db.commit()

        logger.info(f"Integração {action}: id={integration_id}, version={version}")

        return {
            "success": True,
            "action": action,
            "integration_id": str(integration_id),
            "version": version,
            "status": "DRAFT",
            "summary": preview["summary"]
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao salvar integração: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao salvar integração"))


@router.post("/send/{integration_id}")
async def send_to_protheus(
    integration_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Envia integração para o Protheus.

    Por enquanto, apenas atualiza o status para SENT.
    A integração real com API Protheus será implementada posteriormente.
    """
    # Buscar integração com IDs dos inventários
    query = text("""
        SELECT id, status, integration_data, integration_type,
               inventory_a_id, inventory_b_id
        FROM inventario.protheus_integrations
        WHERE id = :id
    """)
    result = db.execute(query, {"id": str(integration_id)}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Integração não encontrada")

    current_status = result[1]
    inventory_a_id = result[4]
    inventory_b_id = result[5]

    if current_status not in ["DRAFT", "ERROR"]:
        raise HTTPException(
            status_code=400,
            detail=f"Integração não pode ser enviada. Status atual: {current_status}"
        )

    try:
        # TODO: Aqui será implementada a chamada real para API Protheus
        # Por enquanto, apenas simulamos o envio

        # Simular resposta do Protheus
        protheus_response = {
            "status": "RECEIVED",
            "message": "Dados recebidos com sucesso. Aguardando processamento.",
            "timestamp": datetime.now().isoformat(),
            "note": "SIMULACAO - Integração real será implementada após definição com analista Protheus"
        }

        # Atualizar status da integração
        db.execute(text("""
            UPDATE inventario.protheus_integrations
            SET status = 'SENT',
                sent_at = NOW(),
                protheus_response = :response,
                updated_at = NOW()
            WHERE id = :id
        """), {
            "id": str(integration_id),
            "response": json.dumps(protheus_response)
        })

        # EFETIVAR: Transicionar inventário(s) para CLOSED
        db.execute(text("""
            UPDATE inventario.inventory_lists
            SET status = 'CLOSED',
                list_status = 'EFETIVADA',
                updated_at = NOW()
            WHERE id = :inv_id
              AND status = 'COMPLETED'
        """), {"inv_id": str(inventory_a_id)})

        if inventory_b_id:
            db.execute(text("""
                UPDATE inventario.inventory_lists
                SET status = 'CLOSED',
                    list_status = 'EFETIVADA',
                    updated_at = NOW()
                WHERE id = :inv_id
                  AND status = 'COMPLETED'
            """), {"inv_id": str(inventory_b_id)})

        db.commit()

        logger.info(f"Integração enviada e inventário(s) efetivado(s): id={integration_id}")

        return {
            "success": True,
            "integration_id": str(integration_id),
            "status": "SENT",
            "protheus_response": protheus_response,
            "message": "Integração enviada e inventário(s) efetivado(s) com sucesso"
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao enviar integração: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao enviar"))


@router.get("/history")
async def get_integration_history(
    store_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Lista histórico de integrações."""

    conditions = []
    params = {"limit": limit}

    if store_id:
        conditions.append("pi.store_id = :store_id")
        params["store_id"] = str(store_id)

    if status:
        conditions.append("pi.status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    query = text(f"""
        SELECT
            pi.id,
            pi.integration_type,
            pi.status,
            pi.version,
            pi.summary,
            pi.created_at,
            pi.sent_at,
            pi.confirmed_at,
            pi.protheus_doc_transfers,
            pi.protheus_doc_inventory,
            ila.name as inventory_a_name,
            ila.warehouse as warehouse_a,
            ilb.name as inventory_b_name,
            ilb.warehouse as warehouse_b,
            u.username as created_by_name
        FROM inventario.protheus_integrations pi
        JOIN inventario.inventory_lists ila ON ila.id = pi.inventory_a_id
        LEFT JOIN inventario.inventory_lists ilb ON ilb.id = pi.inventory_b_id
        JOIN inventario.users u ON u.id = pi.created_by
        WHERE {where_clause}
        ORDER BY pi.created_at DESC
        LIMIT :limit
    """)

    results = db.execute(query, params).fetchall()

    history = []
    for row in results:
        history.append({
            "id": str(row[0]),
            "integration_type": row[1],
            "status": row[2],
            "version": row[3],
            "summary": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
            "sent_at": row[6].isoformat() if row[6] else None,
            "confirmed_at": row[7].isoformat() if row[7] else None,
            "protheus_doc_transfers": row[8],
            "protheus_doc_inventory": row[9],
            "inventory_a_name": row[10],
            "warehouse_a": row[11],
            "inventory_b_name": row[12],
            "warehouse_b": row[13],
            "created_by_name": row[14]
        })

    return {
        "history": history,
        "total": len(history)
    }


@router.get("/{integration_id}")
async def get_integration_details(
    integration_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Retorna detalhes completos de uma integração."""

    # Buscar integração
    query = text("""
        SELECT
            pi.*,
            ila.name as inventory_a_name,
            ilb.name as inventory_b_name,
            u.username as created_by_name
        FROM inventario.protheus_integrations pi
        JOIN inventario.inventory_lists ila ON ila.id = pi.inventory_a_id
        LEFT JOIN inventario.inventory_lists ilb ON ilb.id = pi.inventory_b_id
        JOIN inventario.users u ON u.id = pi.created_by
        WHERE pi.id = :id
    """)
    result = db.execute(query, {"id": str(integration_id)}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Integração não encontrada")

    # Buscar itens
    items_query = text("""
        SELECT *
        FROM inventario.protheus_integration_items
        WHERE integration_id = :id
        ORDER BY item_type, product_code
    """)
    items = db.execute(items_query, {"id": str(integration_id)}).fetchall()

    return {
        "integration": dict(result._mapping),
        "items": [dict(item._mapping) for item in items]
    }


@router.patch("/{integration_id}/cancel")
async def cancel_integration(
    integration_id: UUID,
    reason: str = Query(..., min_length=5, description="Motivo do cancelamento"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Cancela uma integração."""

    # Verificar status atual
    query = text("""
        SELECT status FROM inventario.protheus_integrations WHERE id = :id
    """)
    result = db.execute(query, {"id": str(integration_id)}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Integração não encontrada")

    if result[0] in ["CONFIRMED", "CANCELLED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Integração não pode ser cancelada. Status: {result[0]}"
        )

    try:
        db.execute(text("""
            UPDATE inventario.protheus_integrations
            SET status = 'CANCELLED',
                cancelled_at = NOW(),
                cancelled_by = :user_id,
                cancellation_reason = :reason,
                updated_at = NOW()
            WHERE id = :id
        """), {
            "id": str(integration_id),
            "user_id": str(current_user.id),
            "reason": reason
        })

        db.commit()

        return {
            "success": True,
            "integration_id": str(integration_id),
            "status": "CANCELLED",
            "reason": reason
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao cancelar"))
