"""
Endpoint de Comparação de Inventários
Sistema de Inventário Protheus v2.18.0

Funcionalidade: Comparar 2 inventários de armazéns diferentes da mesma filial
e identificar divergências cruzadas para sugestão de transferência LÓGICA (não física).

✅ v2.18.0 - TRANSFERÊNCIA LÓGICA:
- Ajuste contábil entre armazéns (não há movimentação física)
- Minimiza custos com emissão de NFs de ajuste (R$ 850/NF)
- Calcula saldos ajustados e diferenças residuais
- Identifica economia estimada (NFs evitadas)

Autor: Claude Code
Data: 04/11/2025
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import re
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.config import settings

# ✅ SEGURANÇA v2.19.13: Proteção de endpoints de teste
def require_test_endpoints():
    """Dependency que bloqueia endpoints de teste se desabilitados"""
    if not settings.ENABLE_TEST_ENDPOINTS:
        raise HTTPException(status_code=404, detail="Endpoint não disponível")
from app.models.models import (
    InventoryList,
    InventoryItem,
    InventoryItemSnapshot,
    InventoryLotSnapshot,
    Counting,
    SB1010,
    SB2010,
    SBM010,
    SZD010,
    User
)
from app.api.auth import get_current_user

# Configurar logger
logger = logging.getLogger(__name__)

# Criar router
router = APIRouter()


# ========================================
# HELPER FUNCTIONS
# ========================================

def calcular_transferencia_logica(produto_a: Dict[str, Any], produto_b: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calcula transferência lógica entre dois armazéns para um mesmo produto.

    TRANSFERÊNCIA LÓGICA = Ajuste contábil (não física) para minimizar custos com NFs de ajuste.

    Args:
        produto_a: {
            'armazem': str,
            'saldo': float,
            'contado': float,
            'b2_qatu': float,
            'b2_xentpos': float,
            'b2_cm1': float  # ✅ v2.18.1: Custo médio unitário
        }
        produto_b: {
            'armazem': str,
            'saldo': float,
            'contado': float,
            'b2_qatu': float,
            'b2_xentpos': float,
            'b2_cm1': float  # ✅ v2.18.1: Custo médio unitário
        }

    Returns:
        {
            'origem': str,
            'destino': str,
            'quantidade_transferida': float,
            'saldo_origem_antes': float,
            'saldo_origem_depois': float,
            'saldo_destino_antes': float,
            'saldo_destino_depois': float,
            'diferenca_origem_antes': float,
            'diferenca_origem_depois': float,
            'diferenca_destino_antes': float,
            'diferenca_destino_depois': float,
            'economia_estimada': float,
            'nfs_evitadas': int
        }
    """

    # Divergências brutas
    div_a = produto_a['saldo'] - produto_a['contado']  # SOBRA se > 0, FALTA se < 0
    div_b = produto_b['saldo'] - produto_b['contado']  # SOBRA se > 0, FALTA se < 0

    # Inicializar resultado
    resultado = {
        'origem': None,
        'destino': None,
        'quantidade_transferida': 0.0,
        'saldo_origem_antes': produto_a['saldo'],
        'saldo_origem_depois': produto_a['saldo'],
        'saldo_destino_antes': produto_b['saldo'],
        'saldo_destino_depois': produto_b['saldo'],
        'diferenca_origem_antes': div_a,
        'diferenca_origem_depois': div_a,
        'diferenca_destino_antes': div_b,
        'diferenca_destino_depois': div_b,
        'nfs_evitadas': 0,
        'economia_estimada': 0.0
    }

    # Verificar se há transferência possível
    # Caso 1: A tem SOBRA e B tem FALTA
    if div_a > 0 and div_b < 0:
        resultado['origem'] = produto_a['armazem']
        resultado['destino'] = produto_b['armazem']
        resultado['quantidade_transferida'] = min(div_a, abs(div_b))

    # Caso 2: B tem SOBRA e A tem FALTA
    elif div_b > 0 and div_a < 0:
        resultado['origem'] = produto_b['armazem']
        resultado['destino'] = produto_a['armazem']
        resultado['quantidade_transferida'] = min(div_b, abs(div_a))

    # Caso 3: Ambos têm SOBRA ou ambos têm FALTA → SEM transferência
    else:
        return resultado

    # Calcular saldos ajustados
    if resultado['origem'] == produto_a['armazem']:
        # A → B
        saldo_a_ajustado = produto_a['saldo'] - resultado['quantidade_transferida']
        saldo_b_ajustado = produto_b['saldo'] + resultado['quantidade_transferida']

        resultado['saldo_origem_antes'] = produto_a['saldo']
        resultado['saldo_origem_depois'] = saldo_a_ajustado
        resultado['saldo_destino_antes'] = produto_b['saldo']
        resultado['saldo_destino_depois'] = saldo_b_ajustado

        # 🐛 FIX v2.18.3: Corrigir fórmula (contado - saldo, não saldo - contado)
        dif_a_depois = produto_a['contado'] - saldo_a_ajustado
        dif_b_depois = produto_b['contado'] - saldo_b_ajustado

        resultado['diferenca_origem_antes'] = div_a
        resultado['diferenca_origem_depois'] = dif_a_depois
        resultado['diferenca_destino_antes'] = div_b
        resultado['diferenca_destino_depois'] = dif_b_depois

    else:
        # B → A
        saldo_b_ajustado = produto_b['saldo'] - resultado['quantidade_transferida']
        saldo_a_ajustado = produto_a['saldo'] + resultado['quantidade_transferida']

        resultado['saldo_origem_antes'] = produto_b['saldo']
        resultado['saldo_origem_depois'] = saldo_b_ajustado
        resultado['saldo_destino_antes'] = produto_a['saldo']
        resultado['saldo_destino_depois'] = saldo_a_ajustado

        # 🐛 FIX v2.18.3: Corrigir fórmula (contado - saldo, não saldo - contado)
        dif_b_depois = produto_b['contado'] - saldo_b_ajustado
        dif_a_depois = produto_a['contado'] - saldo_a_ajustado

        resultado['diferenca_origem_antes'] = div_b
        resultado['diferenca_origem_depois'] = dif_b_depois
        resultado['diferenca_destino_antes'] = div_a
        resultado['diferenca_destino_depois'] = dif_a_depois

    # ✅ v2.18.1: Calcular economia usando custo médio
    # Economia = Custo Médio × Quantidade Transferida
    custo_medio_a = float(produto_a.get('b2_cm1', 0) or 0)
    custo_medio_b = float(produto_b.get('b2_cm1', 0) or 0)

    # Usar custo médio da origem (de onde sai o produto)
    custo_medio = custo_medio_a if resultado['origem'] == produto_a['armazem'] else custo_medio_b

    # ✅ DEBUG: Verificar custo médio
    logger.info(f"    💰 Custo Médio: A={custo_medio_a:.2f}, B={custo_medio_b:.2f}, Usado={custo_medio:.2f}")

    # Economia = valor do produto que não precisará de NF de ajuste
    economia_estimada = custo_medio * resultado['quantidade_transferida']
    logger.info(f"    💰 Economia Estimada: {custo_medio:.2f} × {resultado['quantidade_transferida']:.2f} = R$ {economia_estimada:.2f}")

    # Contar NFs evitadas (para estatística)
    nfs_evitadas = 0
    if resultado['diferenca_origem_antes'] != 0 and abs(resultado['diferenca_origem_depois']) < 0.01:
        nfs_evitadas += 1
    if resultado['diferenca_destino_antes'] != 0 and abs(resultado['diferenca_destino_depois']) < 0.01:
        nfs_evitadas += 1

    resultado['nfs_evitadas'] = nfs_evitadas
    resultado['economia_estimada'] = economia_estimada

    return resultado


def parse_lot_observation(observation: str) -> Dict[str, float]:
    """
    Parseia o campo observation para extrair quantidades por lote.

    Formato esperado: "Contagem por lotes: LOTE1:QTD1, LOTE2:QTD2 - DATA, HORA"

    Exemplo:
        Input: "Contagem por lotes: 000000000017963:10, 000000000020014:140 - 27/10/2025, 15:27:54"
        Output: {'000000000017963': 10.0, '000000000020014': 140.0}

    Args:
        observation: String com dados concatenados de lotes

    Returns:
        Dicionário com {lot_number: quantity}
    """
    if not observation:
        return {}

    try:
        # Regex para extrair pares LOTE:QUANTIDADE
        # Formato: "000000000017963:10" ou "17963:10.5"
        pattern = r'(\d+):(\d+(?:\.\d+)?)'
        matches = re.findall(pattern, observation)

        result = {}
        for lot_num, qty_str in matches:
            # Normalizar número do lote (pad com zeros à esquerda até 15 dígitos)
            lot_normalized = lot_num.zfill(15)
            result[lot_normalized] = float(qty_str)

        logger.info(f"  🔍 Parseado observation: {len(result)} lotes encontrados")
        for lot, qty in result.items():
            logger.info(f"    → Lote {lot}: {qty}")

        return result

    except Exception as e:
        logger.warning(f"  ⚠️ Erro ao parsear observation: {str(e)}")
        return {}


@router.get("/test", dependencies=[Depends(require_test_endpoints)])
async def test_comparison_router():
    """Endpoint de teste para verificar se o router está registrado (protegido)"""
    return {
        "message": "✅ Router de comparação funcionando!",
        "timestamp": datetime.now().isoformat(),
        "version": "v2.18.0",
        "features": ["Transferência Lógica", "Cálculo de Economia", "Saldos Ajustados"]
    }


@router.post("/compare")
async def compare_inventories(
    inventory_a_id: str = Query(..., description="ID do Inventário A (base)"),
    inventory_b_id: str = Query(..., description="ID do Inventário B (comparação)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Compara 2 inventários de armazéns diferentes da mesma filial.

    **Funcionalidade:**
    - Identifica divergências cruzadas (sobra em A = falta em B)
    - Classifica como MATCH PERFEITO ou ANÁLISE MANUAL
    - Gera sugestões de transferência SEM CUSTO

    **Validações:**
    - Mesma filial/loja
    - Armazéns diferentes
    - Ambos inventários FINALIZADOS

    **Retorno:**
    - matches: Produtos com MATCH PERFEITO
    - manual_review: Produtos para análise manual
    - summary: Resumo estatístico
    """

    try:
        logger.info(f"🔄 Iniciando comparação: {inventory_a_id} vs {inventory_b_id}")

        # ========================================
        # 1. BUSCAR E VALIDAR INVENTÁRIOS
        # ========================================

        inventory_a = db.query(InventoryList).filter(
            InventoryList.id == inventory_a_id
        ).first()

        if not inventory_a:
            raise HTTPException(
                status_code=404,
                detail=f"Inventário A não encontrado: {inventory_a_id}"
            )

        inventory_b = db.query(InventoryList).filter(
            InventoryList.id == inventory_b_id
        ).first()

        if not inventory_b:
            raise HTTPException(
                status_code=404,
                detail=f"Inventário B não encontrado: {inventory_b_id}"
            )

        # ========================================
        # 2. VALIDAÇÕES
        # ========================================

        # Validação 1: Mesma Filial
        if inventory_a.store_id != inventory_b.store_id:
            raise HTTPException(
                status_code=400,
                detail="Os inventários devem ser da mesma filial/loja"
            )

        # Validação 2: Armazéns Diferentes
        if inventory_a.warehouse == inventory_b.warehouse:
            raise HTTPException(
                status_code=400,
                detail=f"Os inventários são do mesmo armazém ({inventory_a.warehouse}). Selecione armazéns diferentes."
            )

        # Validação 3: Ambos ENCERRADOS (status COMPLETED)
        # ✅ CORREÇÃO v2.15.0: Usar inventory.status (COMPLETED) em vez de list_status (FINALIZED)
        if inventory_a.status.value != "COMPLETED":
            raise HTTPException(
                status_code=400,
                detail=f"Inventário A ({inventory_a.name}) não está encerrado. Status: {inventory_a.status.value}"
            )

        if inventory_b.status.value != "COMPLETED":
            raise HTTPException(
                status_code=400,
                detail=f"Inventário B ({inventory_b.name}) não está encerrado. Status: {inventory_b.status.value}"
            )

        logger.info(f"✅ Validações OK: {inventory_a.warehouse} vs {inventory_b.warehouse}")

        # ========================================
        # 3. ANÁLISE CRUZADA DE DIVERGÊNCIAS (COM SUPORTE A LOTES)
        # ========================================

        # ✅ v2.15.1: Nova lógica considerando LOTES
        # Para produtos COM lote (b1_rastro='L'): chave = product_code + lot_number
        # Para produtos SEM lote: chave = product_code apenas

        # ✅ v2.15.1.1: CORREÇÃO - Usar LEFT JOIN para suportar inventários SEM snapshot
        # Buscar todos os itens dos inventários (com ou sem snapshot)
        items_raw = db.query(
            InventoryItem.id,
            InventoryItem.product_code,
            InventoryItem.expected_quantity,
            InventoryItem.count_cycle_1,
            InventoryItem.count_cycle_2,
            InventoryItem.count_cycle_3,
            InventoryItem.inventory_list_id,
            InventoryItemSnapshot.b1_desc,
            InventoryItemSnapshot.b1_rastro,
            InventoryItemSnapshot.b2_qatu,  # ✅ v2.17.0: Saldo em estoque
            InventoryItemSnapshot.b2_xentpos,  # ✅ v2.17.0: Entregas posteriores
            InventoryItemSnapshot.b2_cm1,  # ✅ v2.18.1: Custo médio
            SB1010.b1_desc.label('sb1_desc'),
            SB1010.b1_rastro.label('sb1_rastro')
        ).outerjoin(
            InventoryItemSnapshot,
            InventoryItem.id == InventoryItemSnapshot.inventory_item_id
        ).outerjoin(
            SB1010,
            func.trim(InventoryItem.product_code) == func.trim(SB1010.b1_cod)
        ).filter(
            or_(
                InventoryItem.inventory_list_id == inventory_a_id,
                InventoryItem.inventory_list_id == inventory_b_id
            )
        ).all()

        logger.info(f"🔍 Total de itens retornados: {len(items_raw)}")

        # Organizar dados por produto+lote (chave única)
        # Estrutura: {(product_code, lot_number): {...dados...}}
        products_data = {}

        for item in items_raw:
            code = item.product_code.strip() if item.product_code else ""

            # ✅ v2.15.1.1: FALLBACK - Usar dados do snapshot OU do SB1010
            description = (item.b1_desc.strip() if item.b1_desc else
                          item.sb1_desc.strip() if item.sb1_desc else "")
            tracking = (item.b1_rastro.strip() if item.b1_rastro else
                       item.sb1_rastro.strip() if item.sb1_rastro else "")

            item_id = str(item.id)
            inv_id = str(item.inventory_list_id)

            # ✅ Determinar se é INV_A ou INV_B
            is_inv_a = (inv_id == inventory_a_id)

            logger.info(f"🔍 Processando produto {code} - Tracking: {tracking}, INV: {'A' if is_inv_a else 'B'}")

            # ✅ Caso 1: Produto COM rastreamento de lote (L)
            if tracking == 'L':
                # ✅ v2.15.1.1: Buscar lotes do snapshot (se existir)
                lots_snapshot = db.query(InventoryLotSnapshot).filter(
                    InventoryLotSnapshot.inventory_item_id == item.id
                ).all()

                if lots_snapshot:
                    # Tem snapshot de lotes - usar dados congelados
                    logger.info(f"  📦 Produto {code} [LOTE] - {len(lots_snapshot)} lotes no snapshot")

                    # ✅ v2.15.2: BUSCAR contagens com MULTIPLOS_LOTES e parsear o campo observation
                    # Retornar objeto Counting completo (não só quantidade) para acessar observation
                    multiplos_lotes_records = db.query(Counting).filter(
                        and_(
                            Counting.inventory_item_id == item.id,
                            Counting.lot_number == 'MULTIPLOS_LOTES'
                        )
                    ).order_by(Counting.count_number.desc()).all()

                    # Dicionário para armazenar contagens por lote parseadas do observation
                    # Formato: {lot_number: {cycle_1: qty, cycle_2: qty, cycle_3: qty}}
                    parsed_lot_counts = {}

                    for counting_record in multiplos_lotes_records:
                        cycle_num = counting_record.count_number
                        observation = counting_record.observation

                        # Parsear observation para extrair lotes
                        lot_quantities = parse_lot_observation(observation)

                        for lot_num, qty in lot_quantities.items():
                            if lot_num not in parsed_lot_counts:
                                parsed_lot_counts[lot_num] = {1: 0, 2: 0, 3: 0}
                            parsed_lot_counts[lot_num][cycle_num] = qty

                    logger.info(f"  📋 Parseado MULTIPLOS_LOTES: {len(parsed_lot_counts)} lotes encontrados")

                    multiplos_lotes_total = sum(
                        max(cycles.values()) for cycles in parsed_lot_counts.values()
                    ) if parsed_lot_counts else 0

                    # ✅ v2.15.1.3: CRIAR ENTRADA AGREGADA também (para comparação com inventários sem snapshot)
                    total_expected = 0.0
                    total_counted = 0.0
                    has_individual_lot_counts = False  # Flag para detectar se há contagens por lote

                    for lot in lots_snapshot:
                        lot_number = lot.b8_lotectl.strip() if lot.b8_lotectl else ""
                        lot_supplier = lot.b8_lotefor.strip() if lot.b8_lotefor else ""  # ✅ v2.19.6: Lote fornecedor
                        expected_qty_lot = float(lot.b8_saldo or 0)

                        # ✅ v2.15.2: PRIORIDADE 1 - Buscar em countings com lot_number específico
                        # ✅ v2.19.3: Usar MAX ao invés de SUM para evitar soma de registros duplicados
                        count_cycle_1 = db.query(func.max(Counting.quantity)).filter(
                            and_(
                                Counting.inventory_item_id == item.id,
                                Counting.lot_number == lot_number,
                                Counting.count_number == 1
                            )
                        ).scalar() or 0

                        count_cycle_2 = db.query(func.max(Counting.quantity)).filter(
                            and_(
                                Counting.inventory_item_id == item.id,
                                Counting.lot_number == lot_number,
                                Counting.count_number == 2
                            )
                        ).scalar() or 0

                        count_cycle_3 = db.query(func.max(Counting.quantity)).filter(
                            and_(
                                Counting.inventory_item_id == item.id,
                                Counting.lot_number == lot_number,
                                Counting.count_number == 3
                            )
                        ).scalar() or 0

                        counted_qty_lot = float(count_cycle_3 or count_cycle_2 or count_cycle_1 or 0)

                        # ✅ v2.15.2: PRIORIDADE 2 - Se não encontrou com lot_number específico,
                        # buscar em parsed_lot_counts (dados do campo observation)
                        if counted_qty_lot == 0 and lot_number in parsed_lot_counts:
                            cycles = parsed_lot_counts[lot_number]
                            counted_qty_lot = float(cycles[3] or cycles[2] or cycles[1] or 0)
                            logger.info(f"    → Lote {lot_number} encontrado no observation: {counted_qty_lot}")

                        # ✅ Somar para entrada agregada
                        total_expected += expected_qty_lot

                        # ✅ v2.15.2: Criar linhas de lote quando houver contagem
                        if counted_qty_lot > 0:
                            has_individual_lot_counts = True
                            total_counted += counted_qty_lot

                            # Criar entrada por lote
                            key = (code, lot_number)

                            if key not in products_data:
                                products_data[key] = {
                                    'product_code': code,
                                    'description': description,
                                    'tracking': tracking,
                                    'lot_number': lot_number,
                                    'lot_supplier': lot_supplier,  # ✅ v2.19.6: Lote fornecedor
                                    'expected_a': None,
                                    'counted_a': None,
                                    'expected_b': None,
                                    'counted_b': None,
                                    'b2_qatu_a': None,  # ✅ v2.17.0: Saldo estoque A
                                    'b2_xentpos_a': None,  # ✅ v2.17.0: Entregas post. A
                                    'b2_qatu_b': None,  # ✅ v2.17.0: Saldo estoque B
                                    'b2_xentpos_b': None,  # ✅ v2.17.0: Entregas post. B
                                    'b2_cm1_a': None,  # ✅ v2.18.1: Custo médio A
                                    'b2_cm1_b': None  # ✅ v2.18.1: Custo médio B
                                }

                            # ✅ v2.18.1: Buscar custo médio do produto
                            b2_cm1 = float(item.b2_cm1 or 0)

                            if is_inv_a:
                                products_data[key]['expected_a'] = expected_qty_lot
                                products_data[key]['counted_a'] = counted_qty_lot
                                products_data[key]['b2_cm1_a'] = b2_cm1
                                logger.info(f"    → Lote {lot_number} INV_A: esp={expected_qty_lot}, cont={counted_qty_lot}, cm1={b2_cm1}")
                            else:
                                products_data[key]['expected_b'] = expected_qty_lot
                                products_data[key]['counted_b'] = counted_qty_lot
                                products_data[key]['b2_cm1_b'] = b2_cm1
                                logger.info(f"    → Lote {lot_number} INV_B: esp={expected_qty_lot}, cont={counted_qty_lot}, cm1={b2_cm1}")

                    # ✅ v2.15.2: Se não criou linhas individuais, usar total agregado
                    if not has_individual_lot_counts and multiplos_lotes_total > 0:
                        total_counted = multiplos_lotes_total
                        logger.info(f"    → Usando total agregado MULTIPLOS_LOTES: {multiplos_lotes_total}")

                    # ✅ v2.15.1.3: CRIAR ENTRADA AGREGADA (chave sem lote)
                    key_agregado = (code, None)
                    if key_agregado not in products_data:
                        products_data[key_agregado] = {
                            'product_code': code,
                            'description': description,
                            'tracking': tracking,
                            'lot_number': None,
                            'lot_supplier': None,  # ✅ v2.19.6: Agregado não tem lote
                            'expected_a': None,
                            'counted_a': None,
                            'expected_b': None,
                            'counted_b': None
                        }

                    if is_inv_a:
                        products_data[key_agregado]['expected_a'] = total_expected
                        products_data[key_agregado]['counted_a'] = total_counted
                        logger.info(f"    → TOTAL AGREGADO INV_A: esp={total_expected}, cont={total_counted}")
                    else:
                        products_data[key_agregado]['expected_b'] = total_expected
                        products_data[key_agregado]['counted_b'] = total_counted
                        logger.info(f"    → TOTAL AGREGADO INV_B: esp={total_expected}, cont={total_counted}")
                else:
                    # ✅ v2.15.1.2: SEM snapshot de lotes - tratar como produto agregado
                    # Produtos com lote mas contados como MULTIPLOS_LOTES (sem detalhar cada lote)
                    logger.info(f"  📦 Produto {code} [LOTE] - SEM snapshot, tratando como agregado")

                    # ✅ v2.17.0: Somar b2_qatu + b2_xentpos para total esperado
                    b2_qatu = float(item.b2_qatu or 0)
                    b2_xentpos = float(item.b2_xentpos or 0)
                    expected_qty = b2_qatu + b2_xentpos
                    final_count = item.count_cycle_3 or item.count_cycle_2 or item.count_cycle_1 or 0
                    counted_qty = float(final_count)

                    # ✅ v2.17.0: Armazenar valores separados para exibição
                    if is_inv_a:
                        b2_qatu_a = b2_qatu
                        b2_xentpos_a = b2_xentpos
                        b2_qatu_b = None
                        b2_xentpos_b = None
                    else:
                        b2_qatu_a = None
                        b2_xentpos_a = None
                        b2_qatu_b = b2_qatu
                        b2_xentpos_b = b2_xentpos

                    logger.info(f"  📊 Dados do item: expected={expected_qty}, c1={item.count_cycle_1}, c2={item.count_cycle_2}, c3={item.count_cycle_3}, final={counted_qty}")

                    # Chave única: apenas produto (lote = None, pois não temos detalhamento)
                    key = (code, None)

                    if key not in products_data:
                        products_data[key] = {
                            'product_code': code,
                            'description': description,
                            'tracking': tracking,
                            'lot_number': None,  # Sem detalhamento de lote
                            'lot_supplier': None,  # ✅ v2.19.6: Sem lote
                            'expected_a': None,
                            'counted_a': None,
                            'expected_b': None,
                            'counted_b': None,
                            'b2_qatu_a': None,  # ✅ v2.17.0
                            'b2_xentpos_a': None,  # ✅ v2.17.0
                            'b2_qatu_b': None,  # ✅ v2.17.0
                            'b2_xentpos_b': None,  # ✅ v2.17.0
                            'b2_cm1_a': None,  # ✅ v2.18.1
                            'b2_cm1_b': None  # ✅ v2.18.1
                        }
                        logger.info(f"  ✅ Criada nova chave para produto {code}")
                    else:
                        logger.info(f"  ♻️ Chave já existe para produto {code}, atualizando...")

                    # ✅ v2.18.1: Buscar custo médio do produto
                    b2_cm1 = float(item.b2_cm1 or 0)

                    if is_inv_a:
                        products_data[key]['expected_a'] = expected_qty
                        products_data[key]['counted_a'] = counted_qty
                        products_data[key]['b2_qatu_a'] = b2_qatu_a
                        products_data[key]['b2_xentpos_a'] = b2_xentpos_a
                        products_data[key]['b2_cm1_a'] = b2_cm1
                        logger.info(f"    → Produto {code} INV_A (lote agregado): esp={expected_qty}, cont={counted_qty}, cm1={b2_cm1}")
                    else:
                        products_data[key]['expected_b'] = expected_qty
                        products_data[key]['counted_b'] = counted_qty
                        products_data[key]['b2_qatu_b'] = b2_qatu_b
                        products_data[key]['b2_xentpos_b'] = b2_xentpos_b
                        products_data[key]['b2_cm1_b'] = b2_cm1
                        logger.info(f"    → Produto {code} INV_B (lote agregado): esp={expected_qty}, cont={counted_qty}, cm1={b2_cm1}")

            # ✅ Caso 2: Produto SEM rastreamento de lote
            else:
                # ✅ v2.17.0: Somar b2_qatu + b2_xentpos para total esperado
                b2_qatu = float(item.b2_qatu or 0)
                b2_xentpos = float(item.b2_xentpos or 0)
                expected_qty = b2_qatu + b2_xentpos
                final_count = item.count_cycle_3 or item.count_cycle_2 or item.count_cycle_1 or 0
                counted_qty = float(final_count)

                # ✅ v2.17.0: Armazenar valores separados
                if is_inv_a:
                    b2_qatu_a = b2_qatu
                    b2_xentpos_a = b2_xentpos
                    b2_qatu_b = None
                    b2_xentpos_b = None
                else:
                    b2_qatu_a = None
                    b2_xentpos_a = None
                    b2_qatu_b = b2_qatu
                    b2_xentpos_b = b2_xentpos

                # Chave única: apenas produto (lote = None)
                key = (code, None)

                if key not in products_data:
                    products_data[key] = {
                        'product_code': code,
                        'description': description,  # ✅ v2.15.1.1: Usar fallback
                        'tracking': tracking if tracking else 'N/A',
                        'lot_number': None,
                        'lot_supplier': None,  # ✅ v2.19.6: Sem lote
                        'expected_a': None,
                        'counted_a': None,
                        'expected_b': None,
                        'counted_b': None,
                        'b2_qatu_a': None,  # ✅ v2.17.0
                        'b2_xentpos_a': None,  # ✅ v2.17.0
                        'b2_qatu_b': None,  # ✅ v2.17.0
                        'b2_xentpos_b': None,  # ✅ v2.17.0
                        'b2_cm1_a': None,  # ✅ v2.18.1
                        'b2_cm1_b': None  # ✅ v2.18.1
                    }

                # ✅ v2.18.1: Buscar custo médio do produto
                b2_cm1 = float(item.b2_cm1 or 0)

                if is_inv_a:
                    products_data[key]['expected_a'] = expected_qty
                    products_data[key]['counted_a'] = counted_qty
                    products_data[key]['b2_qatu_a'] = b2_qatu_a
                    products_data[key]['b2_xentpos_a'] = b2_xentpos_a
                    products_data[key]['b2_cm1_a'] = b2_cm1
                    logger.info(f"  → Produto {code} [SEM LOTE] INV_A: esp={expected_qty}, cont={counted_qty}, cm1={b2_cm1}")
                else:
                    products_data[key]['expected_b'] = expected_qty
                    products_data[key]['counted_b'] = counted_qty
                    products_data[key]['b2_qatu_b'] = b2_qatu_b
                    products_data[key]['b2_xentpos_b'] = b2_xentpos_b
                    products_data[key]['b2_cm1_b'] = b2_cm1
                    logger.info(f"  → Produto {code} [SEM LOTE] INV_B: esp={expected_qty}, cont={counted_qty}, cm1={b2_cm1}")

        logger.info(f"📦 Total de linhas únicas processadas (produto+lote): {len(products_data)}")

        # ✅ DEBUG: Mostrar todos os produtos processados
        for key, data in products_data.items():
            code, lot = key
            logger.info(f"  📋 Produto {code} (lote={lot}): exp_a={data['expected_a']}, cnt_a={data['counted_a']}, exp_b={data['expected_b']}, cnt_b={data['counted_b']}")

        # ========================================
        # 4. CLASSIFICAR DIVERGÊNCIAS
        # ========================================

        matches = []
        manual_review = []

        logger.info(f"🔍 Iniciando classificação de {len(products_data)} linhas (produto+lote)")

        # ✅ v2.15.1: Desempacotar chave composta (product_code, lot_number)
        for key, data in products_data.items():
            code, lot_number = key  # Desempacotar tupla

            # ✅ v2.15.2: PULAR linhas que não têm dados completos nos dois lados
            # Linhas de lote só aparecem quando AMBOS os inventários têm contagem detalhada por lote
            if data['counted_a'] is None or data['counted_b'] is None:
                logger.info(f"  ⏭️ Produto {code} lote={lot_number} PULADO: dados incompletos (counted_a={data['counted_a']}, counted_b={data['counted_b']})")
                continue

            counted_a = data['counted_a']
            counted_b = data['counted_b']
            expected_a = data['expected_a'] if data['expected_a'] is not None else 0
            expected_b = data['expected_b'] if data['expected_b'] is not None else 0

            # Calcular divergências
            div_a = counted_a - expected_a
            div_b = counted_b - expected_b

            logger.info(f"  📊 Produto {code}: div_a={div_a:.2f}, div_b={div_b:.2f}, soma={div_a + div_b:.2f}")

            # Pular se não há divergência em nenhum
            if div_a == 0 and div_b == 0:
                logger.info(f"  ⏭️ Produto {code} sem divergências")
                continue

            # ✅ v2.19.48: TRANSFERÊNCIA = divergências com sinais opostos (permite transferência)
            # Inclui Match Perfeito (soma=0) e Transferência Parcial (soma≠0)
            has_opposite_signs = (div_a > 0 and div_b < 0) or (div_a < 0 and div_b > 0)
            is_perfect_match = (div_a + div_b == 0) and div_a != 0

            if has_opposite_signs:
                # ✅ v2.19.48: Transferência LÓGICA de SALDO (não física!)
                # - Se div_a < 0 (falta física em A): saldo de A precisa DIMINUIR → SALDO SAI de A (origem)
                # - Se div_b > 0 (sobra física em B): saldo de B precisa AUMENTAR → SALDO ENTRA em B (destino)
                # Resultado: saldos no sistema ficam iguais às contagens físicas
                warehouse_origin = inventory_a.warehouse if div_a < 0 else inventory_b.warehouse
                warehouse_dest = inventory_b.warehouse if div_a < 0 else inventory_a.warehouse
                qty_transfer = min(abs(div_a), abs(div_b))  # Quantidade que pode ser transferida

                # ✅ v2.18.0: Calcular transferência lógica
                produto_a_data = {
                    'armazem': inventory_a.warehouse,
                    'saldo': expected_a,
                    'contado': counted_a,
                    'b2_qatu': data.get('b2_qatu_a', 0) or 0,
                    'b2_xentpos': data.get('b2_xentpos_a', 0) or 0,
                    'b2_cm1': data.get('b2_cm1_a', 0) or 0  # ✅ v2.18.1
                }
                produto_b_data = {
                    'armazem': inventory_b.warehouse,
                    'saldo': expected_b,
                    'contado': counted_b,
                    'b2_qatu': data.get('b2_qatu_b', 0) or 0,
                    'b2_xentpos': data.get('b2_xentpos_b', 0) or 0,
                    'b2_cm1': data.get('b2_cm1_b', 0) or 0  # ✅ v2.18.1
                }

                transferencia_logica = calcular_transferencia_logica(produto_a_data, produto_b_data)

                # ✅ v2.19.48: Status e log diferenciados
                if is_perfect_match:
                    status = 'MATCH PERFEITO'
                    logger.info(f"  ✅ MATCH PERFEITO: {code} - transferir {qty_transfer:.0f} de {warehouse_origin} → {warehouse_dest}")
                else:
                    status = 'TRANSFERÊNCIA PARCIAL'
                    residual = abs(div_a + div_b)
                    logger.info(f"  🔄 TRANSFERÊNCIA PARCIAL: {code} - transferir {qty_transfer:.0f} de {warehouse_origin} → {warehouse_dest} (residual: {residual:.0f})")

                logger.info(f"      💰 Transferência Lógica: {transferencia_logica['nfs_evitadas']} NFs evitadas = R$ {transferencia_logica['economia_estimada']:.2f}")

                matches.append({
                    'product_code': code,
                    'description': data['description'],
                    'tracking': data['tracking'],
                    'lot_number': lot_number,
                    'lot_supplier': data.get('lot_supplier'),  # ✅ v2.19.6: Lote fornecedor
                    'divergence_a': div_a,
                    'divergence_b': div_b,
                    'status': status,
                    'is_perfect_match': is_perfect_match,  # ✅ v2.19.48: Flag para diferenciar
                    'suggestion': f"Transferir {qty_transfer:.0f} unidades de {warehouse_origin} → {warehouse_dest}",
                    'transfer_from': warehouse_origin,
                    'transfer_to': warehouse_dest,
                    'transfer_qty': qty_transfer,
                    'expected_a': expected_a,
                    'counted_a': counted_a,
                    'expected_b': expected_b,
                    'counted_b': counted_b,
                    'b2_qatu_a': data.get('b2_qatu_a'),  # ✅ v2.17.0
                    'b2_xentpos_a': data.get('b2_xentpos_a'),  # ✅ v2.17.0
                    'b2_qatu_b': data.get('b2_qatu_b'),  # ✅ v2.17.0
                    'b2_xentpos_b': data.get('b2_xentpos_b'),  # ✅ v2.17.0
                    'b2_cm1_a': data.get('b2_cm1_a'),  # ✅ v2.18.1: Custo médio A
                    'b2_cm1_b': data.get('b2_cm1_b'),  # ✅ v2.18.1: Custo médio B
                    # ✅ v2.19.55: Calcular ajustados de forma simples
                    'transferencia_logica': transferencia_logica,
                    'saldo_ajustado_a': expected_a - qty_transfer if transferencia_logica['origem'] == inventory_a.warehouse else expected_a + qty_transfer,
                    'saldo_ajustado_b': expected_b - qty_transfer if transferencia_logica['origem'] == inventory_b.warehouse else expected_b + qty_transfer,
                    'diferenca_final_a': counted_a - (expected_a - qty_transfer) if transferencia_logica['origem'] == inventory_a.warehouse else counted_a - (expected_a + qty_transfer),
                    'diferenca_final_b': counted_b - (expected_b - qty_transfer) if transferencia_logica['origem'] == inventory_b.warehouse else counted_b - (expected_b + qty_transfer),
                })

            # ⚠️ ANÁLISE MANUAL: Outros casos (ambos positivos, ambos negativos, ou apenas um lado com divergência)
            else:
                situation_parts = []

                if div_a > 0:
                    situation_parts.append(f"Sobra de {div_a:.0f} em {inventory_a.warehouse}")
                elif div_a < 0:
                    situation_parts.append(f"Falta de {abs(div_a):.0f} em {inventory_a.warehouse}")

                if div_b > 0:
                    situation_parts.append(f"Sobra de {div_b:.0f} em {inventory_b.warehouse}")
                elif div_b < 0:
                    situation_parts.append(f"Falta de {abs(div_b):.0f} em {inventory_b.warehouse}")

                # ✅ v2.18.0: Calcular transferência lógica (mesmo que parcial)
                produto_a_data = {
                    'armazem': inventory_a.warehouse,
                    'saldo': expected_a,
                    'contado': counted_a,
                    'b2_qatu': data.get('b2_qatu_a', 0) or 0,
                    'b2_xentpos': data.get('b2_xentpos_a', 0) or 0,
                    'b2_cm1': data.get('b2_cm1_a', 0) or 0  # ✅ v2.18.1
                }
                produto_b_data = {
                    'armazem': inventory_b.warehouse,
                    'saldo': expected_b,
                    'contado': counted_b,
                    'b2_qatu': data.get('b2_qatu_b', 0) or 0,
                    'b2_xentpos': data.get('b2_xentpos_b', 0) or 0,
                    'b2_cm1': data.get('b2_cm1_b', 0) or 0  # ✅ v2.18.1
                }

                transferencia_logica = calcular_transferencia_logica(produto_a_data, produto_b_data)

                logger.info(f"  ⚠️ ANÁLISE MANUAL: {code} - {' | '.join(situation_parts)}")
                if transferencia_logica['quantidade_transferida'] > 0:
                    logger.info(f"      💰 Transferência Parcial: {transferencia_logica['quantidade_transferida']:.0f} unidades, {transferencia_logica['nfs_evitadas']} NFs evitadas")

                manual_review.append({
                    'product_code': code,
                    'description': data['description'],
                    'tracking': data['tracking'],
                    'lot_number': lot_number,
                    'lot_supplier': data.get('lot_supplier'),  # ✅ v2.19.6: Lote fornecedor
                    'divergence_a': div_a,
                    'divergence_b': div_b,
                    'status': 'ANALISAR MANUALMENTE',
                    'suggestion': ' | '.join(situation_parts),
                    'expected_a': expected_a,
                    'counted_a': counted_a,
                    'expected_b': expected_b,
                    'counted_b': counted_b,
                    'b2_qatu_a': data.get('b2_qatu_a'),  # ✅ v2.17.0
                    'b2_xentpos_a': data.get('b2_xentpos_a'),  # ✅ v2.17.0
                    'b2_qatu_b': data.get('b2_qatu_b'),  # ✅ v2.17.0
                    'b2_xentpos_b': data.get('b2_xentpos_b'),  # ✅ v2.17.0
                    'b2_cm1_a': data.get('b2_cm1_a'),  # ✅ v2.18.1: Custo médio A
                    'b2_cm1_b': data.get('b2_cm1_b'),  # ✅ v2.18.1: Custo médio B
                    # ✅ v2.19.55: Calcular ajustados de forma simples
                    'transferencia_logica': transferencia_logica,
                    'saldo_ajustado_a': expected_a - transferencia_logica['quantidade_transferida'] if transferencia_logica['origem'] == inventory_a.warehouse else expected_a + transferencia_logica['quantidade_transferida'] if transferencia_logica['origem'] == inventory_b.warehouse else expected_a,
                    'saldo_ajustado_b': expected_b - transferencia_logica['quantidade_transferida'] if transferencia_logica['origem'] == inventory_b.warehouse else expected_b + transferencia_logica['quantidade_transferida'] if transferencia_logica['origem'] == inventory_a.warehouse else expected_b,
                    'diferenca_final_a': counted_a - (expected_a - transferencia_logica['quantidade_transferida']) if transferencia_logica['origem'] == inventory_a.warehouse else counted_a - (expected_a + transferencia_logica['quantidade_transferida']) if transferencia_logica['origem'] == inventory_b.warehouse else div_a,
                    'diferenca_final_b': counted_b - (expected_b - transferencia_logica['quantidade_transferida']) if transferencia_logica['origem'] == inventory_b.warehouse else counted_b - (expected_b + transferencia_logica['quantidade_transferida']) if transferencia_logica['origem'] == inventory_a.warehouse else div_b,
                })

        # ========================================
        # 5. RECALCULAR AGGREGATE COMO SOMA DAS LINHAS DE LOTE (v2.19.5)
        # ========================================
        # ✅ v2.19.5: Para produtos com lote (tracking='L'), a linha AGGREGATE
        # deve ter saldos que são a SOMA das linhas de lote visíveis

        def recalcular_aggregates(items_list):
            """Recalcula valores AGGREGATE como soma das linhas de lote visíveis"""
            # Agrupar por product_code
            by_product = {}
            for item in items_list:
                code = item['product_code']
                if code not in by_product:
                    by_product[code] = {'aggregate': None, 'lot_details': []}

                if item.get('lot_number') is None:
                    by_product[code]['aggregate'] = item
                else:
                    by_product[code]['lot_details'].append(item)

            # Recalcular AGGREGATE para produtos com lotes
            for code, data in by_product.items():
                agg = data['aggregate']
                lot_details = data['lot_details']

                # Só recalcular se tem lotes E tem linha agregada
                if agg and lot_details and agg.get('tracking') == 'L':
                    logger.info(f"  🔄 Recalculando AGGREGATE para {code}: {len(lot_details)} lotes")

                    # ✅ v2.19.5: Somar TODOS os valores diretamente das linhas de lote
                    # Valores básicos
                    sum_expected_a = sum(l.get('expected_a', 0) or 0 for l in lot_details)
                    sum_counted_a = sum(l.get('counted_a', 0) or 0 for l in lot_details)
                    sum_expected_b = sum(l.get('expected_b', 0) or 0 for l in lot_details)
                    sum_counted_b = sum(l.get('counted_b', 0) or 0 for l in lot_details)

                    # ✅ v2.19.5: Somar valores de transferência lógica diretamente dos lotes
                    # (não recalcular, usar os valores já calculados para cada lote)
                    sum_saldo_origem_antes = 0.0
                    sum_saldo_origem_depois = 0.0
                    sum_saldo_destino_antes = 0.0
                    sum_saldo_destino_depois = 0.0
                    sum_qty_transferida = 0.0
                    sum_economia = 0.0
                    total_nfs_evitadas = 0

                    for l in lot_details:
                        transf_lot = l.get('transferencia_logica', {})
                        if transf_lot:
                            sum_saldo_origem_antes += transf_lot.get('saldo_origem_antes', 0) or 0
                            sum_saldo_origem_depois += transf_lot.get('saldo_origem_depois', 0) or 0
                            sum_saldo_destino_antes += transf_lot.get('saldo_destino_antes', 0) or 0
                            sum_saldo_destino_depois += transf_lot.get('saldo_destino_depois', 0) or 0
                            sum_qty_transferida += transf_lot.get('quantidade_transferida', 0) or 0
                            sum_economia += transf_lot.get('economia_estimada', 0) or 0
                            total_nfs_evitadas += transf_lot.get('nfs_evitadas', 0) or 0

                    # Atualizar valores básicos
                    agg['expected_a'] = sum_expected_a
                    agg['counted_a'] = sum_counted_a
                    agg['expected_b'] = sum_expected_b
                    agg['counted_b'] = sum_counted_b

                    # Recalcular divergências
                    agg['divergence_a'] = sum_counted_a - sum_expected_a
                    agg['divergence_b'] = sum_counted_b - sum_expected_b

                    # ✅ v2.19.5: Determinar origem/destino baseado na primeira linha de lote
                    first_lot_transf = lot_details[0].get('transferencia_logica', {})
                    origem = first_lot_transf.get('origem')
                    destino = first_lot_transf.get('destino')

                    # ✅ v2.19.5: Criar objeto transferencia_logica com valores SOMADOS dos lotes
                    transf = {
                        'origem': origem,
                        'destino': destino,
                        'quantidade_transferida': sum_qty_transferida,
                        'saldo_origem_antes': sum_saldo_origem_antes,
                        'saldo_origem_depois': sum_saldo_origem_depois,
                        'saldo_destino_antes': sum_saldo_destino_antes,
                        'saldo_destino_depois': sum_saldo_destino_depois,
                        'diferenca_origem_antes': sum_counted_a - sum_expected_a if origem == inventory_a.warehouse else sum_counted_b - sum_expected_b,
                        'diferenca_origem_depois': sum_counted_a - sum_saldo_origem_depois if origem == inventory_a.warehouse else sum_counted_b - sum_saldo_origem_depois,
                        'diferenca_destino_antes': sum_counted_b - sum_expected_b if origem == inventory_a.warehouse else sum_counted_a - sum_expected_a,
                        'diferenca_destino_depois': sum_counted_b - sum_saldo_destino_depois if origem == inventory_a.warehouse else sum_counted_a - sum_saldo_destino_depois,
                        'nfs_evitadas': total_nfs_evitadas,
                        'economia_estimada': sum_economia
                    }

                    # Atualizar campos de transferência
                    agg['transferencia_logica'] = transf

                    # ✅ v2.19.55: Calcular ajustados de forma simples e correta
                    # Ajustado = Expected +/- quantidade transferida
                    qty_t = sum_qty_transferida
                    if origem == inventory_a.warehouse:
                        # Transferência sai de A, entra em B
                        agg['saldo_ajustado_a'] = sum_expected_a - qty_t
                        agg['saldo_ajustado_b'] = sum_expected_b + qty_t
                    elif origem == inventory_b.warehouse:
                        # Transferência sai de B, entra em A
                        agg['saldo_ajustado_a'] = sum_expected_a + qty_t
                        agg['saldo_ajustado_b'] = sum_expected_b - qty_t
                    else:
                        agg['saldo_ajustado_a'] = sum_expected_a
                        agg['saldo_ajustado_b'] = sum_expected_b

                    agg['diferenca_final_a'] = sum_counted_a - agg['saldo_ajustado_a']
                    agg['diferenca_final_b'] = sum_counted_b - agg['saldo_ajustado_b']

                    logger.info(f"    → AGGREGATE recalculado: exp_a={sum_expected_a}, cnt_a={sum_counted_a}, exp_b={sum_expected_b}, cnt_b={sum_counted_b}")
                    logger.info(f"    → origem={origem}, inv_a_wh={inventory_a.warehouse}, inv_b_wh={inventory_b.warehouse}")
                    logger.info(f"    → qty_t={qty_t}, ajust_a={agg['saldo_ajustado_a']}, ajust_b={agg['saldo_ajustado_b']}")
                    logger.info(f"    → dif_final_a={agg['diferenca_final_a']}, dif_final_b={agg['diferenca_final_b']}")
                    logger.info(f"    → Transferência: {sum_qty_transferida} unidades, Economia: R$ {sum_economia:.2f}")

        # Aplicar recálculo em matches e manual_review
        recalcular_aggregates(matches)
        recalcular_aggregates(manual_review)

        # ========================================
        # 6. ORDENAR RESULTADOS
        # ========================================
        # ✅ v2.15.1.5: Ordenação igual ao modal "Análise de Inventário"
        # 1. Por código do produto (crescente)
        # 2. Linha agregada (lot_number=None) PRIMEIRO
        # 3. Depois linhas detalhadas por número de lote (crescente)

        def sort_key(item):
            code = item['product_code']
            lot = item['lot_number']
            # lot=None recebe "" para aparecer primeiro (ordem alfabética)
            # Lotes com número recebem o próprio número
            return (code, "" if lot is None else lot)

        matches = sorted(matches, key=sort_key)
        manual_review = sorted(manual_review, key=sort_key)

        logger.info(f"📋 Linhas ordenadas: {len(matches)} matches, {len(manual_review)} manuais")

        # ========================================
        # 7. CALCULAR TRANSFERÊNCIAS VIÁVEIS E ECONOMIA ESTIMADA
        # ========================================

        # Contar transferências viáveis
        total_transfers = 0

        # Contar matches com transferência válida
        for m in matches:
            if m.get('transfer_qty') and m['transfer_qty'] > 0:
                # ✅ Filtrar: Produtos COM lote (tracking='L') E linha agregada (lot_number=None) → NÃO conta
                if m.get('tracking') == 'L' and m.get('lot_number') is None:
                    logger.info(f"  🚫 REMOVIDO: {m['product_code']} (linha agregada de produto com lote)")
                    continue
                total_transfers += 1
                logger.info(f"  ✅ Transferência: {m['product_code']} (lote={m.get('lot_number')}) = {m['transfer_qty']:.0f} unidades")

        # Contar análises manuais com transferência parcial viável
        for m in manual_review:
            div_a = m.get('divergence_a', 0)
            div_b = m.get('divergence_b', 0)

            # Verificar se há transferência viável (sobra em um lado, falta no outro)
            transfer_qty = min(abs(div_a), abs(div_b))
            has_transfer = (div_a > 0 and div_b < 0) or (div_b > 0 and div_a < 0)

            if has_transfer and transfer_qty > 0:
                # ✅ Filtrar: Produtos COM lote (tracking='L') E linha agregada (lot_number=None) → NÃO conta
                if m.get('tracking') == 'L' and m.get('lot_number') is None:
                    logger.info(f"  🚫 REMOVIDO: {m['product_code']} (linha agregada de produto com lote)")
                    continue
                total_transfers += 1
                logger.info(f"  ✅ Transferência parcial: {m['product_code']} (lote={m.get('lot_number')}) = {transfer_qty:.0f} unidades")

        # ✅ v2.18.3: Calcular economia REAL somando economias de cada produto (com B2_CM1)
        estimated_savings = 0.0
        for item in matches:
            transf = item.get('transferencia_logica', {})
            economia = transf.get('economia_estimada', 0) if transf else 0
            estimated_savings += economia

        for item in manual_review:
            transf = item.get('transferencia_logica', {})
            economia = transf.get('economia_estimada', 0) if transf else 0
            estimated_savings += economia

        logger.info(f"💰 Total de transferências viáveis: {total_transfers}")
        logger.info(f"💰 Economia estimada (soma de economias reais com B2_CM1): R$ {estimated_savings:.2f}")

        # ========================================
        # 8. CRIAR ARRAY DE TRANSFERÊNCIAS
        # ========================================
        # ✅ v2.18.1: Montar lista unificada de transferências para o relatório
        transfers = []

        # Adicionar matches com transferência
        for item in matches:
            transf = item.get('transferencia_logica', {})
            if transf.get('quantidade_transferida', 0) > 0:
                transfers.append({
                    'product_code': item['product_code'],
                    'description': item['description'],
                    'tracking': item.get('tracking'),
                    'lot_number': item.get('lot_number'),
                    'lot_supplier': item.get('lot_supplier'),  # ✅ v2.19.6: Lote fornecedor
                    'expected_a': item.get('expected_a'),  # ✅ v2.18.1: Campos para frontend
                    'counted_a': item.get('counted_a'),
                    'expected_b': item.get('expected_b'),
                    'counted_b': item.get('counted_b'),
                    'source_warehouse': transf.get('origem'),
                    'target_warehouse': transf.get('destino'),
                    'transfer_qty': transf.get('quantidade_transferida'),
                    'transferencia_logica': transf  # ✅ Incluir objeto completo
                })

        # Adicionar manual_review com transferência
        for item in manual_review:
            transf = item.get('transferencia_logica', {})
            if transf.get('quantidade_transferida', 0) > 0:
                transfers.append({
                    'product_code': item['product_code'],
                    'description': item['description'],
                    'tracking': item.get('tracking'),
                    'lot_number': item.get('lot_number'),
                    'lot_supplier': item.get('lot_supplier'),  # ✅ v2.19.6: Lote fornecedor
                    'expected_a': item.get('expected_a'),  # ✅ v2.18.1: Campos para frontend
                    'counted_a': item.get('counted_a'),
                    'expected_b': item.get('expected_b'),
                    'counted_b': item.get('counted_b'),
                    'source_warehouse': transf.get('origem'),
                    'target_warehouse': transf.get('destino'),
                    'transfer_qty': transf.get('quantidade_transferida'),
                    'transferencia_logica': transf  # ✅ Incluir objeto completo
                })

        # Ordenar transfers pela mesma lógica (código + lote)
        transfers = sorted(transfers, key=lambda x: (x['product_code'], "" if x.get('lot_number') is None else x.get('lot_number')))

        logger.info(f"📦 Array de transferências criado: {len(transfers)} itens")

        # ========================================
        # 9. MONTAR RESPOSTA
        # ========================================

        response = {
            'inventory_a': {
                'id': str(inventory_a.id),
                'name': inventory_a.name,
                'warehouse': inventory_a.warehouse,
                'closed_at': inventory_a.closed_at.isoformat() if inventory_a.closed_at else None
            },
            'inventory_b': {
                'id': str(inventory_b.id),
                'name': inventory_b.name,
                'warehouse': inventory_b.warehouse,
                'closed_at': inventory_b.closed_at.isoformat() if inventory_b.closed_at else None
            },
            'matches': matches,
            'manual_review': manual_review,
            'transfers': transfers,  # ✅ v2.18.1: Lista unificada de transferências
            'summary': {
                'total_matches': len(matches),
                'total_manual': len(manual_review),
                'total_transfers': total_transfers,
                'total_analyzed': len(matches) + len(manual_review),
                'estimated_savings': estimated_savings,
                'comparison_date': datetime.now().isoformat()
            }
        }

        logger.info(f"✅ Comparação concluída: {len(matches)} matches, {len(manual_review)} manuais, {len(transfers)} transferências")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro na comparação: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao comparar inventários")
        )


@router.get("/available-for-comparison/{inventory_id}")
async def get_available_inventories_for_comparison(
    inventory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista inventários disponíveis para comparação com o inventário informado.

    **Critérios:**
    - Mesma filial/loja
    - Armazém diferente
    - Status FINALIZADO
    - Excluir o próprio inventário
    """

    try:
        # Buscar inventário base
        base_inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_id
        ).first()

        if not base_inventory:
            raise HTTPException(
                status_code=404,
                detail=f"Inventário não encontrado: {inventory_id}"
            )

        # Buscar inventários compatíveis
        # ✅ CORREÇÃO v2.15.0: Usar status COMPLETED em vez de list_status FINALIZED
        from app.models.models import InventoryStatus
        available = db.query(InventoryList).filter(
            and_(
                InventoryList.store_id == base_inventory.store_id,  # Mesma filial
                InventoryList.warehouse != base_inventory.warehouse,  # Armazém diferente
                InventoryList.status == InventoryStatus.COMPLETED,  # Encerrado
                InventoryList.id != inventory_id  # Não incluir o próprio
            )
        ).order_by(InventoryList.closed_at.desc()).all()

        # Formatar resposta
        result = []
        for inv in available:
            result.append({
                'id': str(inv.id),
                'name': inv.name,
                'warehouse': inv.warehouse,
                'closed_at': inv.closed_at.isoformat() if inv.closed_at else None,
                'created_at': inv.created_at.isoformat() if inv.created_at else None
            })

        return {
            'base_inventory': {
                'id': str(base_inventory.id),
                'name': base_inventory.name,
                'warehouse': base_inventory.warehouse
            },
            'available_inventories': result,
            'total': len(result)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar inventários: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao buscar inventários disponíveis")
        )
