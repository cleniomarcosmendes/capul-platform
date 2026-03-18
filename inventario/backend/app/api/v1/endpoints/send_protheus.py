"""
Envio de Dados para Protheus via REST API
Versao: 1.0.0
Data: 06/03/2026

Envia dados de integracao (transferencias, digitacao, historico) para 3 endpoints
do ERP Protheus. Registra logs detalhados de cada chamada.

Endpoints Protheus:
  POST /inventario/transferencia  - Transferencias entre armazens
  POST /inventario/digitacao      - Digitacao de balanco (ajustes)
  POST /INVENTARIO/historico      - Historico de contagem por item
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import os
import json
import time
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.exceptions import safe_error_response

logger = logging.getLogger(__name__)

router = APIRouter()

# =====================================================
# CONFIGURACAO
# =====================================================

PROTHEUS_INVENTARIO_URL = os.getenv(
    "PROTHEUS_INVENTARIO_URL",
    "https://192.168.7.63:8115/rest/api/INFOCLIENTES"
)
PROTHEUS_INVENTARIO_AUTH = os.getenv(
    "PROTHEUS_INVENTARIO_AUTH",
    "Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="
)
PROTHEUS_INVENTARIO_TIMEOUT = int(os.getenv("PROTHEUS_INVENTARIO_TIMEOUT", "60"))
PROTHEUS_INVENTARIO_VERIFY_SSL = os.getenv("PROTHEUS_INVENTARIO_VERIFY_SSL", "false").lower() == "true"


# =====================================================
# INICIALIZACAO DA TABELA DE LOGS
# =====================================================

_logs_table_created = False


def ensure_logs_table(db: Session):
    """Cria a tabela de logs de envio se nao existir."""
    global _logs_table_created
    if _logs_table_created:
        return

    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS inventario.protheus_send_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                integration_id UUID NOT NULL REFERENCES inventario.protheus_integrations(id),
                endpoint TEXT NOT NULL,
                item_type TEXT NOT NULL,
                product_code TEXT,
                request_payload JSONB,
                response_payload JSONB,
                status TEXT NOT NULL DEFAULT 'PENDING',
                error_message TEXT,
                duration_ms INTEGER,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_send_logs_integration
                ON inventario.protheus_send_logs(integration_id);
        """))
        db.commit()
        _logs_table_created = True
        logger.info("Tabela protheus_send_logs verificada/criada")
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao criar tabela protheus_send_logs: {e}")
        raise


# =====================================================
# CLIENTE HTTP
# =====================================================

async def call_protheus(endpoint: str, payload: dict, method: str = "POST") -> dict:
    """
    Faz chamada HTTP ao Protheus com retry em 5xx.

    Args:
        endpoint: Caminho relativo (ex: /inventario/transferencia)
        payload: Corpo JSON da requisicao
        method: Metodo HTTP (default POST)

    Returns:
        dict com a resposta parseada do Protheus

    Raises:
        Exception com detalhes do erro
    """
    url = f"{PROTHEUS_INVENTARIO_URL.rstrip('/')}{endpoint}"
    headers = {
        "Authorization": PROTHEUS_INVENTARIO_AUTH,
        "Content-Type": "application/json"
    }
    timeout = httpx.Timeout(float(PROTHEUS_INVENTARIO_TIMEOUT))

    max_attempts = 2  # 1 tentativa + 1 retry em 5xx
    last_error = None

    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(
                verify=PROTHEUS_INVENTARIO_VERIFY_SSL,
                timeout=timeout
            ) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=payload
                )

                # Se 5xx e ainda tem retry, tenta novamente
                if response.status_code >= 500 and attempt < max_attempts - 1:
                    last_error = f"HTTP {response.status_code}: {response.text[:500]}"
                    logger.warning(
                        f"Protheus retornou {response.status_code}, tentando retry... "
                        f"(attempt {attempt + 1}/{max_attempts})"
                    )
                    continue

                # Erros 4xx ou 5xx final
                if response.status_code >= 400:
                    error_text = response.text[:1000]
                    raise Exception(
                        f"Protheus retornou HTTP {response.status_code}: {error_text}"
                    )

                # Sucesso
                try:
                    return response.json()
                except Exception:
                    return {"raw_response": response.text[:2000]}

        except httpx.TimeoutException:
            last_error = f"Timeout apos {PROTHEUS_INVENTARIO_TIMEOUT}s"
            if attempt < max_attempts - 1:
                logger.warning(f"Timeout na chamada Protheus, tentando retry...")
                continue
            raise Exception(last_error)

        except httpx.HTTPError as e:
            last_error = str(e)
            if attempt < max_attempts - 1:
                logger.warning(f"Erro HTTP: {e}, tentando retry...")
                continue
            raise Exception(f"Erro de conexao com Protheus: {last_error}")

    raise Exception(f"Falha apos {max_attempts} tentativas: {last_error}")


def _get_next_batch(db: Session, integration_id: str) -> int:
    """Retorna o próximo número de batch para uma integração."""
    result = db.execute(text("""
        SELECT COALESCE(MAX(send_batch), 0) + 1 FROM inventario.protheus_send_logs
        WHERE integration_id = :id
    """), {"id": integration_id}).scalar()
    return result or 1

# Variável de módulo para manter batch da rodada atual
_current_batch: Dict[str, int] = {}

def log_send(
    db: Session,
    integration_id: str,
    endpoint: str,
    item_type: str,
    product_code: Optional[str],
    request_payload: dict,
    response_payload: Optional[dict],
    status: str,
    error_message: Optional[str],
    duration_ms: int
):
    """Registra log de envio na tabela protheus_send_logs."""
    try:
        batch = _current_batch.get(integration_id, 1)
        db.execute(text("""
            INSERT INTO inventario.protheus_send_logs (
                integration_id, endpoint, item_type, product_code,
                request_payload, response_payload, status,
                error_message, duration_ms, send_batch
            ) VALUES (
                :integration_id, :endpoint, :item_type, :product_code,
                :request_payload, :response_payload, :status,
                :error_message, :duration_ms, :send_batch
            )
        """), {
            "integration_id": integration_id,
            "endpoint": endpoint,
            "item_type": item_type,
            "product_code": product_code,
            "request_payload": json.dumps(request_payload, default=str),
            "response_payload": json.dumps(response_payload, default=str) if response_payload else None,
            "status": status,
            "error_message": error_message,
            "duration_ms": duration_ms,
            "send_batch": batch
        })
    except Exception as e:
        logger.error(f"Erro ao gravar log de envio: {e}")


# =====================================================
# FUNCOES AUXILIARES
# =====================================================

# ✅ v2.19.55: Timezone GMT-3 (BRT) para envio ao Protheus
BRT = timezone(timedelta(hours=-3))


def format_date_protheus(dt: Optional[datetime]) -> str:
    """Formata datetime para YYYYMMDD (formato Protheus) em GMT-3."""
    if not dt:
        return ""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return dt[:10].replace("-", "") if len(dt) >= 10 else ""
    # Converter para BRT (GMT-3)
    if dt.tzinfo is not None:
        dt = dt.astimezone(BRT)
    return dt.strftime("%Y%m%d")


def format_time_protheus(dt: Optional[datetime]) -> str:
    """Formata datetime para HH:MM:SS (formato Protheus) em GMT-3."""
    if not dt:
        return ""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            parts = dt.split(" ")
            return parts[1] if len(parts) > 1 else ""
    # Converter para BRT (GMT-3)
    if dt.tzinfo is not None:
        dt = dt.astimezone(BRT)
    return dt.strftime("%H:%M:%S")


def get_integration_or_404(db: Session, integration_id: UUID) -> dict:
    """Busca integracao e valida existencia."""
    query = text("""
        SELECT
            pi.id, pi.status, pi.integration_type,
            pi.inventory_a_id, pi.inventory_b_id,
            pi.integration_data, pi.store_id,
            ila.name as inventory_a_name,
            ila.warehouse as warehouse_a,
            ila.reference_date as reference_date_a,
            s.code as store_code
        FROM inventario.protheus_integrations pi
        JOIN inventario.inventory_lists ila ON ila.id = pi.inventory_a_id
        JOIN inventario.stores s ON s.id = pi.store_id
        WHERE pi.id = :id
    """)
    result = db.execute(query, {"id": str(integration_id)}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Integracao nao encontrada")

    return dict(result._mapping)


# =====================================================
# ENDPOINT: ENVIAR TRANSFERENCIAS
# =====================================================

@router.post("/send/{integration_id}/transferencias")
async def send_transferencias(
    integration_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Envia transferencias para o Protheus.

    Le itens TRANSFER de protheus_integration_items, agrupa por filial
    e chama POST /inventario/transferencia para cada grupo.
    """
    ensure_logs_table(db)

    integration = get_integration_or_404(db, integration_id)

    if integration["status"] not in ("DRAFT", "ERROR", "PARTIAL"):
        raise HTTPException(
            status_code=400,
            detail=f"Integracao nao pode ser enviada. Status atual: {integration['status']}"
        )

    # Buscar itens de transferencia (excluir já enviados com sucesso)
    items_query = text("""
        SELECT id, product_code, product_description, lot_number,
               source_warehouse, target_warehouse, quantity,
               unit_cost, total_value, item_status
        FROM inventario.protheus_integration_items
        WHERE integration_id = :id AND item_type = 'TRANSFER'
          AND COALESCE(item_status, '') != 'SENT'
        ORDER BY product_code
    """)
    items = db.execute(items_query, {"id": str(integration_id)}).fetchall()

    if not items:
        return {
            "success": True,
            "message": "Nenhuma transferencia para enviar",
            "total": 0, "enviados": 0, "erros": 0
        }

    filial = integration["store_code"]
    raw_name = integration.get("inventory_a_name", "INV001")
    doc_name = f"INVENT_{raw_name}"[:20]

    # Montar payload — filtrar linhas AGGREGATE sem lote e qty=0
    itens_payload = []
    for item in items:
        row = dict(item._mapping)
        qty = float(row["quantity"])
        lot = (row.get("lot_number") or "").strip()

        # ✅ v2.19.55: Pular linhas AGGREGATE (sem lote) e qty=0
        if not lot:
            logger.info(f"  ⏭️ TRANSFER skip AGGREGATE sem lote: {row['product_code']} qty={qty}")
            continue
        if qty <= 0:
            logger.info(f"  ⏭️ TRANSFER skip qty=0: {row['product_code']} lote={lot}")
            continue

        itens_payload.append({
            "produto": row["product_code"],
            "armazemOrigem": row["source_warehouse"],
            "armazemDestino": row["target_warehouse"],
            "quantidade": qty,
            "loteOrigem": lot,
            "loteDestino": lot
        })

    if not itens_payload:
        return {
            "success": True,
            "message": "Nenhuma transferencia valida para enviar (apenas aggregates filtrados)",
            "total": 0, "enviados": 0, "erros": 0
        }

    payload = {
        "filial": filial,
        "documento": doc_name,
        "itens": itens_payload
    }

    # Enviar para Protheus
    start_time = time.time()
    try:
        response = await call_protheus("/inventario/transferencia", payload)
        duration_ms = int((time.time() - start_time) * 1000)

        # Processar resposta usando detalhes do Protheus
        detalhes = response.get("detalhes", [])
        gravados = response.get("gravados", 0)
        erros_protheus = response.get("erros", 0)

        # ✅ v2.19.55: Classificar status baseado na resposta real do Protheus
        enviados = 0
        erros = 0
        for detalhe in detalhes:
            if isinstance(detalhe, dict):
                if detalhe.get("status", "").upper() == "OK":
                    enviados += 1
                else:
                    erros += 1

        # Atualizar status dos items na DB baseado nos detalhes
        for i, item in enumerate(items):
            row = dict(item._mapping)
            lot = (row.get("lot_number") or "").strip()
            qty = float(row["quantity"])

            # ✅ v2.19.56: Marcar linhas AGGREGATE/sem lote como SENT (enviado por lote individual)
            if not lot:
                db.execute(text("""
                    UPDATE inventario.protheus_integration_items
                    SET item_status = 'SENT', error_detail = 'Linha agregada - enviado por lote individual'
                    WHERE id = :id AND item_status != 'SENT'
                """), {"id": str(row["id"])})
                continue
            if qty <= 0:
                db.execute(text("""
                    UPDATE inventario.protheus_integration_items
                    SET item_status = 'SENT', error_detail = 'Quantidade zero - nao aplicavel'
                    WHERE id = :id AND item_status != 'SENT'
                """), {"id": str(row["id"])})
                continue

            # Buscar detalhe correspondente pelo código + lote
            item_ok = False
            item_error = None
            for detalhe in detalhes:
                if isinstance(detalhe, dict) and detalhe.get("codigo") == row["product_code"]:
                    if detalhe.get("lote") == lot or (not detalhe.get("lote") and not lot):
                        item_ok = detalhe.get("status", "").upper() == "OK"
                        if not item_ok:
                            item_error = detalhe.get("mensagem", "Erro no item")
                        break

            db.execute(text("""
                UPDATE inventario.protheus_integration_items
                SET item_status = :status, error_detail = :error
                WHERE id = :id
            """), {
                "status": "SENT" if item_ok else "ERROR",
                "error": item_error,
                "id": str(row["id"])
            })

        log_status = "OK" if erros == 0 else "PARTIAL"
        log_send(
            db, str(integration_id), "/inventario/transferencia", "TRANSFER",
            None, payload, response, log_status,
            None, duration_ms
        )

        db.commit()

        return {
            "success": True,
            "message": f"Transferencias enviadas: {enviados} OK, {erros} erros",
            "total": len(items),
            "enviados": enviados,
            "erros": erros,
            "protheus_response": response
        }

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        error_msg = str(e)

        # Marcar todos como erro
        for item in items:
            row = dict(item._mapping)
            db.execute(text("""
                UPDATE inventario.protheus_integration_items
                SET item_status = 'ERROR', error_detail = :error
                WHERE id = :id
            """), {"status": "ERROR", "error": error_msg[:500], "id": str(row["id"])})

        log_send(
            db, str(integration_id), "/inventario/transferencia", "TRANSFER",
            None, payload, None, "ERROR", error_msg[:1000], duration_ms
        )

        db.commit()
        logger.error(f"Erro ao enviar transferencias: {error_msg}")

        return {
            "success": False,
            "message": f"Erro ao enviar transferencias: {error_msg}",
            "total": len(items),
            "enviados": 0,
            "erros": len(items)
        }


# =====================================================
# ENDPOINT: ENVIAR DIGITACAO (BALANCO)
# =====================================================

@router.post("/send/{integration_id}/digitacao")
async def send_digitacao(
    integration_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Envia digitacao de balanco para o Protheus.

    Le itens ADJUSTMENT de protheus_integration_items, agrupa por filial+armazem
    e chama POST /inventario/digitacao para cada grupo.
    """
    ensure_logs_table(db)

    integration = get_integration_or_404(db, integration_id)

    if integration["status"] not in ("DRAFT", "ERROR", "PARTIAL"):
        raise HTTPException(
            status_code=400,
            detail=f"Integracao nao pode ser enviada. Status atual: {integration['status']}"
        )

    # Buscar itens de ajuste (excluir já enviados com sucesso)
    items_query = text("""
        SELECT id, product_code, product_description, lot_number,
               target_warehouse, quantity, adjustment_type,
               expected_qty, counted_qty, adjusted_qty,
               unit_cost, total_value, item_status
        FROM inventario.protheus_integration_items
        WHERE integration_id = :id AND item_type = 'ADJUSTMENT'
          AND COALESCE(item_status, '') != 'SENT'
        ORDER BY target_warehouse, product_code
    """)
    items = db.execute(items_query, {"id": str(integration_id)}).fetchall()

    if not items:
        return {
            "success": True,
            "message": "Nenhum ajuste para enviar",
            "total": 0, "enviados": 0, "erros": 0
        }

    filial = integration["store_code"]
    raw_name = integration.get("inventory_a_name", "INV001")
    inventory_name = f"INVENT_{raw_name}"
    ref_date = format_date_protheus(integration.get("reference_date_a")) or datetime.now(BRT).strftime("%Y%m%d")

    # Agrupar itens por armazem
    groups: Dict[str, List[dict]] = {}
    items_list = [dict(item._mapping) for item in items]
    for row in items_list:
        wh = row.get("target_warehouse") or "01"
        if wh not in groups:
            groups[wh] = []
        groups[wh].append(row)

    total_enviados = 0
    total_erros = 0
    responses = []

    for armazem, group_items in groups.items():
        # Montar payload — filtrar AGGREGATE sem lote para produtos com lote
        # e itens com qty=0
        itens_payload = []
        # Detectar quais produtos têm linhas com lote (são rastreáveis)
        produtos_com_lote = set()
        for row in group_items:
            if (row.get("lot_number") or "").strip():
                produtos_com_lote.add(row["product_code"])

        for row in group_items:
            qty = float(row.get("counted_qty") or row.get("quantity") or 0)
            lot = (row.get("lot_number") or "").strip()
            code = row["product_code"]

            # ✅ v2.19.55: Pular AGGREGATE (sem lote) se produto tem linhas de lote
            if not lot and code in produtos_com_lote:
                logger.info(f"  ⏭️ DIGITACAO skip AGGREGATE sem lote: {code} arm={armazem} qty={qty}")
                continue

            # ✅ v2.19.56: Produto com rastro sem lote valido — nao pode ser enviado
            # (precisa corrigir na origem/Protheus primeiro)
            if not lot and code not in produtos_com_lote:
                # Produto SEM rastro: qty=0 é valido (zerar estoque)
                pass

            # Pular qty=0 APENAS para produtos com rastro (sem lote pra apontar)
            if qty == 0 and code in produtos_com_lote:
                logger.info(f"  ⏭️ DIGITACAO skip qty=0 produto com rastro: {code} arm={armazem}")
                continue

            item_payload: Dict[str, Any] = {
                "codigo": code,
                "quantidade": qty
            }
            if lot:
                item_payload["lote"] = lot
            itens_payload.append(item_payload)

        payload = {
            "filial": filial,
            "armazem": armazem,
            "documento": inventory_name[:20],
            "data": ref_date,
            "itens": itens_payload
        }

        start_time = time.time()
        try:
            response = await call_protheus("/inventario/digitacao", payload)
            duration_ms = int((time.time() - start_time) * 1000)

            detalhes = response.get("detalhes", [])

            # ✅ v2.19.55: Classificar baseado na resposta real do Protheus
            arm_enviados = 0
            arm_erros = 0
            for detalhe in detalhes:
                if isinstance(detalhe, dict):
                    if detalhe.get("status", "").upper() == "OK":
                        arm_enviados += 1
                    else:
                        arm_erros += 1
            total_enviados += arm_enviados
            total_erros += arm_erros

            # Atualizar items na DB — match por código + lote
            for row in group_items:
                lot = (row.get("lot_number") or "").strip()
                code = row["product_code"]
                qty = float(row.get("counted_qty") or row.get("quantity") or 0)

                # ✅ v2.19.56: AGGREGATE sem lote de produto rastreavel — marcar como SENT (nao precisa enviar)
                if not lot and code in produtos_com_lote:
                    db.execute(text("""
                        UPDATE inventario.protheus_integration_items
                        SET item_status = 'SENT', error_detail = 'Linha agregada - enviado por lote individual'
                        WHERE id = :id AND item_status != 'SENT'
                    """), {"id": str(row["id"])})
                    continue

                # Produto com rastro qty=0 — marcar como SENT (sem lote para apontar)
                if qty == 0 and code in produtos_com_lote:
                    db.execute(text("""
                        UPDATE inventario.protheus_integration_items
                        SET item_status = 'SENT', error_detail = 'Produto rastreavel sem lote - nao aplicavel'
                        WHERE id = :id AND item_status != 'SENT'
                    """), {"id": str(row["id"])})
                    continue

                item_ok = False
                item_error = None
                for detalhe in detalhes:
                    if isinstance(detalhe, dict) and detalhe.get("codigo") == code:
                        d_lote = (detalhe.get("lote") or "").strip()
                        if d_lote == lot or (not d_lote and not lot):
                            item_ok = detalhe.get("status", "").upper() == "OK"
                            if not item_ok:
                                item_error = detalhe.get("mensagem", "Erro no item")
                            break

                db.execute(text("""
                    UPDATE inventario.protheus_integration_items
                    SET item_status = :status, error_detail = :error
                    WHERE id = :id
                """), {
                    "status": "SENT" if item_ok else "ERROR",
                    "error": item_error,
                    "id": str(row["id"])
                })

            log_send(
                db, str(integration_id), "/inventario/digitacao", "ADJUSTMENT",
                None, payload, response,
                "OK" if arm_erros == 0 else "PARTIAL",
                None, duration_ms
            )
            responses.append({"armazem": armazem, "response": response})

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)

            for row in group_items:
                total_erros += 1
                db.execute(text("""
                    UPDATE inventario.protheus_integration_items
                    SET item_status = 'ERROR', error_detail = :error
                    WHERE id = :id
                """), {"error": error_msg[:500], "id": str(row["id"])})

            log_send(
                db, str(integration_id), "/inventario/digitacao", "ADJUSTMENT",
                None, payload, None, "ERROR", error_msg[:1000], duration_ms
            )
            responses.append({"armazem": armazem, "error": error_msg})
            logger.error(f"Erro digitacao armazem {armazem}: {error_msg}")

    db.commit()

    return {
        "success": total_erros == 0,
        "message": f"Digitacao enviada: {total_enviados} OK, {total_erros} erros",
        "total": len(items_list),
        "enviados": total_enviados,
        "erros": total_erros,
        "grupos": len(groups),
        "detalhes": responses
    }


# =====================================================
# ENDPOINT: ENVIAR HISTORICO DE CONTAGEM
# =====================================================

@router.post("/send/{integration_id}/historico")
async def send_historico(
    integration_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Envia historico de contagem para o Protheus.

    Para cada item da integracao, busca dados de contagem (ciclos 1/2/3)
    e envia individualmente para POST /INVENTARIO/historico.
    """
    ensure_logs_table(db)

    integration = get_integration_or_404(db, integration_id)

    if integration["status"] not in ("DRAFT", "ERROR", "PARTIAL", "SENT"):
        raise HTTPException(
            status_code=400,
            detail=f"Integracao nao pode ser enviada. Status atual: {integration['status']}"
        )

    filial = integration["store_code"]
    raw_name = integration.get("inventory_a_name", "INVENTARIO")
    inventory_name = f"INVENT_{raw_name}"
    inv_date = format_date_protheus(integration.get("reference_date_a")) or datetime.now(BRT).strftime("%Y%m%d")
    inventory_a_id = str(integration["inventory_a_id"])
    inventory_b_id = str(integration["inventory_b_id"]) if integration.get("inventory_b_id") else None

    # Buscar itens da integracao (excluir já enviados com sucesso no histórico)
    items_query = text("""
        SELECT id, item_type, product_code, product_description,
               lot_number, source_warehouse, target_warehouse,
               quantity, expected_qty, counted_qty, adjusted_qty,
               adjustment_type, unit_cost, total_value, item_status
        FROM inventario.protheus_integration_items
        WHERE integration_id = :id
        ORDER BY product_code
    """)
    items = db.execute(items_query, {"id": str(integration_id)}).fetchall()

    if not items:
        return {
            "success": True,
            "message": "Nenhum item para enviar historico",
            "total": 0, "enviados": 0, "erros": 0
        }

    total_enviados = 0
    total_erros = 0
    total_skipped = 0

    # ✅ v2.19.55: Pré-carregar lotes fornecedor para enriquecer ZIV_LOTEFO
    lot_supplier_map = {}
    try:
        lot_rows = db.execute(text("""
            SELECT TRIM(b8_produto) as produto, b8_lotectl, b8_lotefor
            FROM inventario.sb8010
            WHERE b8_lotefor IS NOT NULL AND b8_lotefor != ''
        """)).fetchall()
        for lr in lot_rows:
            lot_supplier_map[(lr.produto, lr.b8_lotectl)] = (lr.b8_lotefor or "").strip()
    except Exception:
        pass

    # Detectar quais produtos têm linhas com lote (são rastreáveis)
    items_list = [dict(item._mapping) for item in items]
    produtos_com_lote = set()
    for row in items_list:
        if (row.get("lot_number") or "").strip():
            produtos_com_lote.add(row["product_code"])

    for row in items_list:
        product_code = row["product_code"]
        lot_number = (row.get("lot_number") or "").strip()

        # ✅ v2.19.55: Pular itens já enviados com sucesso (evita duplicação no reenvio)
        if row.get("item_status") == "SENT":
            logger.info(f"  ⏭️ HISTORICO skip já SENT: {product_code} lote={lot_number}")
            total_skipped += 1
            continue

        # ✅ v2.19.55: Pular AGGREGATE (sem lote) se produto tem linhas de lote
        if not lot_number and product_code in produtos_com_lote:
            logger.info(f"  ⏭️ HISTORICO skip AGGREGATE sem lote: {product_code}")
            total_skipped += 1
            continue

        # Determinar armazem de origem e destino
        if row["item_type"] == "TRANSFER":
            armazem_origem = row.get("source_warehouse") or ""
            armazem_destino = row.get("target_warehouse") or ""
            tipo = "T"  # Transferencia
            qtrans = float(row.get("quantity") or 0)
            arm_tra = armazem_destino
            tip_tr = "T"
        else:
            armazem_origem = row.get("target_warehouse") or ""
            armazem_destino = ""
            tipo = "C"  # Contagem/Ajuste
            qtrans = 0
            arm_tra = ""
            tip_tr = ""

        # Buscar dados de contagem do inventory_items
        counting_data = _get_counting_data(
            db, product_code, lot_number, inventory_a_id, inventory_b_id
        )

        # Montar payload ZIV
        saldo = float(row.get("expected_qty") or 0)
        contagem_final = float(row.get("counted_qty") or 0)
        diferenca = contagem_final - saldo
        custo = float(row.get("unit_cost") or 0)
        valor_diferenca = diferenca * custo

        payload = {
            "ZIV_FILIAL": filial,
            "ZIV_INVNOM": inventory_name[:40],
            "ZIV_INVDAT": inv_date,
            "ZIV_ARMAZE": armazem_origem,
            "ZIV_ARMCOM": armazem_destino if row["item_type"] == "TRANSFER" else armazem_origem,
            "ZIV_TIPO": tipo,
            "ZIV_CODIGO": product_code,
            "ZIV_DESCRI": (row.get("product_description") or "")[:60],
            "ZIV_LOTECT": lot_number,
            "ZIV_LOTEFO": lot_supplier_map.get((product_code.strip(), lot_number), ""),
            "ZIV_SALDO": saldo,
            "ZIV_ENTPOS": 0,
            "ZIV_CONT1": counting_data.get("count1", 0),
            "ZIV_CONT2": counting_data.get("count2", 0),
            "ZIV_CONT3": counting_data.get("count3", 0),
            "ZIV_USRC1": counting_data.get("user1", ""),
            "ZIV_USRC2": counting_data.get("user2", ""),
            "ZIV_USRC3": counting_data.get("user3", ""),
            "ZIV_DATC1": counting_data.get("date1", ""),
            "ZIV_DATC2": counting_data.get("date2", ""),
            "ZIV_DATC3": counting_data.get("date3", ""),
            "ZIV_HORAC1": counting_data.get("time1", ""),
            "ZIV_HORAC2": counting_data.get("time2", ""),
            "ZIV_HORAC3": counting_data.get("time3", ""),
            "ZIV_QTFINA": contagem_final,
            "ZIV_DIFERE": diferenca,
            "ZIV_VLRDIF": valor_diferenca,
            "ZIV_CUSTOM": custo,
            "ZIV_STATUS": "C",
            "ZIV_QTRANS": qtrans,
            "ZIV_ARMTRA": arm_tra,
            "ZIV_TIPTR": tip_tr,
            "ZIV_ECONOM": 0,
            "ZIV_OBSERV": "Contagem inventario",
            "ZIV_USRINC": current_user.username if hasattr(current_user, 'username') else "sistema",
            "ZIV_DATINC": datetime.now(BRT).strftime("%Y%m%d"),
            "ZIV_HORINC": datetime.now(BRT).strftime("%H:%M:%S"),
            "ZIV_ORIGIN": "INVENTARIO.SISTEMA"
        }

        start_time = time.time()
        try:
            response = await call_protheus("/INVENTARIO/historico", payload)
            duration_ms = int((time.time() - start_time) * 1000)

            gravacao = response.get("gravacao", False)

            if gravacao:
                total_enviados += 1
                new_status = "SENT"
                error_detail = None
            else:
                total_erros += 1
                new_status = "ERROR"
                error_detail = response.get("mensagem", "gravacao=false")

            log_send(
                db, str(integration_id), "/INVENTARIO/historico",
                row["item_type"], product_code,
                payload, response, new_status, error_detail, duration_ms
            )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            total_erros += 1
            new_status = "ERROR"
            error_detail = error_msg[:500]

            log_send(
                db, str(integration_id), "/INVENTARIO/historico",
                row["item_type"], product_code,
                payload, None, "ERROR", error_msg[:1000], duration_ms
            )
            logger.error(f"Erro historico produto {product_code}: {error_msg}")

        # Atualizar status do item (nao sobrescrever se ja foi SENT por outro endpoint)
        db.execute(text("""
            UPDATE inventario.protheus_integration_items
            SET item_status = CASE
                    WHEN item_status = 'SENT' THEN 'SENT'
                    ELSE :status
                END,
                error_detail = CASE
                    WHEN item_status = 'SENT' THEN error_detail
                    ELSE :error
                END
            WHERE id = :id
        """), {
            "status": new_status,
            "error": error_detail,
            "id": str(row["id"])
        })

    db.commit()

    return {
        "success": total_erros == 0,
        "message": f"Historico enviado: {total_enviados} OK, {total_erros} erros",
        "total": len(items),
        "enviados": total_enviados,
        "erros": total_erros
    }


def _get_counting_data(
    db: Session,
    product_code: str,
    lot_number: str,
    inventory_a_id: str,
    inventory_b_id: Optional[str]
) -> dict:
    """
    Busca dados de contagem (ciclos 1/2/3) do inventory_items + countings.

    Retorna dict com count1/2/3, user1/2/3, date1/2/3, time1/2/3.
    """
    result = {
        "count1": 0, "count2": 0, "count3": 0,
        "user1": "", "user2": "", "user3": "",
        "date1": "", "date2": "", "date3": "",
        "time1": "", "time2": "", "time3": "",
    }

    # Buscar inventory_item com ciclos de contagem
    inv_ids = [inventory_a_id]
    if inventory_b_id:
        inv_ids.append(inventory_b_id)

    # inventory_items tem count_cycle_1/2/3 mas NAO counter_cycle_*
    if inventory_b_id:
        query = text("""
            SELECT
                ii.count_cycle_1, ii.count_cycle_2, ii.count_cycle_3,
                ii.expected_quantity, ii.id as item_id
            FROM inventario.inventory_items ii
            WHERE ii.inventory_list_id IN (:inv_a, :inv_b)
              AND ii.product_code = :product_code
            LIMIT 1
        """)
        params = {"inv_a": inventory_a_id, "inv_b": inventory_b_id, "product_code": product_code}
    else:
        query = text("""
            SELECT
                ii.count_cycle_1, ii.count_cycle_2, ii.count_cycle_3,
                ii.expected_quantity, ii.id as item_id
            FROM inventario.inventory_items ii
            WHERE ii.inventory_list_id = :inv_a
              AND ii.product_code = :product_code
            LIMIT 1
        """)
        params = {"inv_a": inventory_a_id, "product_code": product_code}
    row = db.execute(query, params).fetchone()

    if not row:
        return result

    row_data = dict(row._mapping)
    item_id = str(row_data["item_id"])

    # Preencher contagens dos ciclos
    for cycle in [1, 2, 3]:
        count_val = row_data.get(f"count_cycle_{cycle}")
        if count_val is not None:
            result[f"count{cycle}"] = float(count_val)

    # Buscar contadores, datas/horas das contagens na tabela countings
    countings_query = text("""
        SELECT c.count_number, c.counted_by, c.created_at,
               u.username
        FROM inventario.countings c
        LEFT JOIN inventario.users u ON u.id = c.counted_by
        WHERE c.inventory_item_id = :item_id
        ORDER BY c.count_number ASC
    """)
    countings = db.execute(countings_query, {"item_id": item_id}).fetchall()

    for counting in countings:
        c_data = dict(counting._mapping)
        cycle_num = c_data.get("count_number", 0)
        if cycle_num in (1, 2, 3):
            if c_data.get("username"):
                result[f"user{cycle_num}"] = c_data["username"]
            created_at = c_data.get("created_at")
            if created_at:
                result[f"date{cycle_num}"] = format_date_protheus(created_at)
                result[f"time{cycle_num}"] = format_time_protheus(created_at)

    return result


# =====================================================
# ENDPOINT: ENVIAR TUDO (ORQUESTRADOR)
# =====================================================

@router.post("/send/{integration_id}/enviar-tudo")
async def send_all(
    integration_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Orquestra o envio completo para Protheus:
    1. Se COMPARATIVE, envia transferencias
    2. Envia digitacao
    3. Envia historico

    Atualiza status da integracao e dos inventarios ao final.
    """
    ensure_logs_table(db)

    integration = get_integration_or_404(db, integration_id)

    if integration["status"] not in ("DRAFT", "ERROR", "PARTIAL"):
        raise HTTPException(
            status_code=400,
            detail=f"Integracao nao pode ser enviada. Status atual: {integration['status']}"
        )

    # ✅ v2.19.55: Inicializar batch para esta rodada de envio
    next_batch = _get_next_batch(db, str(integration_id))
    _current_batch[str(integration_id)] = next_batch
    logger.info(f"📦 [SEND ALL] Rodada de envio #{next_batch} para integração {integration_id}")

    results = {}
    total_enviados = 0
    total_erros = 0

    # 1. Transferencias (apenas COMPARATIVE)
    if integration["integration_type"] == "COMPARATIVE":
        try:
            result_transf = await send_transferencias(integration_id, db, current_user)
            results["transferencias"] = result_transf
            total_enviados += result_transf.get("enviados", 0)
            total_erros += result_transf.get("erros", 0)
        except Exception as e:
            db.rollback()
            results["transferencias"] = {"success": False, "error": str(e)}
            logger.error(f"Erro nas transferencias: {e}")

    # 2. Digitacao
    try:
        result_digit = await send_digitacao(integration_id, db, current_user)
        results["digitacao"] = result_digit
        total_enviados += result_digit.get("enviados", 0)
        total_erros += result_digit.get("erros", 0)
    except Exception as e:
        db.rollback()
        results["digitacao"] = {"success": False, "error": str(e)}
        logger.error(f"Erro na digitacao: {e}")

    # 3. Historico
    try:
        result_hist = await send_historico(integration_id, db, current_user)
        results["historico"] = result_hist
        total_enviados += result_hist.get("enviados", 0)
        total_erros += result_hist.get("erros", 0)
    except Exception as e:
        db.rollback()
        results["historico"] = {"success": False, "error": str(e)}
        logger.error(f"Erro no historico: {e}")

    # Determinar status final
    if total_erros == 0 and total_enviados > 0:
        final_status = "SENT"
    elif total_enviados > 0 and total_erros > 0:
        final_status = "PARTIAL"
    elif total_enviados == 0 and total_erros > 0:
        final_status = "ERROR"
    else:
        final_status = "SENT"

    # Atualizar status da integracao
    protheus_response = {
        "envio_completo": True,
        "timestamp": datetime.now().isoformat(),
        "total_enviados": total_enviados,
        "total_erros": total_erros,
        "detalhes": results
    }

    try:
        db.execute(text("""
            UPDATE inventario.protheus_integrations
            SET status = :status,
                sent_at = NOW(),
                protheus_response = :response,
                updated_at = NOW()
            WHERE id = :id
        """), {
            "status": final_status,
            "response": json.dumps(protheus_response, default=str),
            "id": str(integration_id)
        })

        # Se tudo OK, fechar inventarios
        if final_status == "SENT":
            inventory_a_id = str(integration["inventory_a_id"])
            db.execute(text("""
                UPDATE inventario.inventory_lists
                SET status = 'CLOSED',
                    list_status = 'EFETIVADA',
                    updated_at = NOW()
                WHERE id = :inv_id AND status = 'COMPLETED'
            """), {"inv_id": inventory_a_id})

            if integration.get("inventory_b_id"):
                db.execute(text("""
                    UPDATE inventario.inventory_lists
                    SET status = 'CLOSED',
                        list_status = 'EFETIVADA',
                        updated_at = NOW()
                    WHERE id = :inv_id AND status = 'COMPLETED'
                """), {"inv_id": str(integration["inventory_b_id"])})

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao atualizar status da integracao: {e}")

    return {
        "success": final_status == "SENT",
        "status": final_status,
        "integration_id": str(integration_id),
        "total_enviados": total_enviados,
        "total_erros": total_erros,
        "resultados": results,
        "message": (
            "Envio completo com sucesso" if final_status == "SENT"
            else f"Envio com erros: {total_erros} falhas" if final_status == "PARTIAL"
            else "Falha no envio"
        )
    }


# =====================================================
# ENDPOINT: CONSULTAR LOGS DE ENVIO
# =====================================================

@router.get("/send/{integration_id}/logs")
async def get_send_logs(
    integration_id: UUID,
    endpoint: Optional[str] = Query(None, description="Filtrar por endpoint"),
    status: Optional[str] = Query(None, description="Filtrar por status (OK, ERROR, PARTIAL, PENDING)"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Retorna logs de envio para uma integracao.
    Permite filtrar por endpoint e status.
    """
    ensure_logs_table(db)

    # Verificar se integracao existe
    check = db.execute(text("""
        SELECT id FROM inventario.protheus_integrations WHERE id = :id
    """), {"id": str(integration_id)}).fetchone()

    if not check:
        raise HTTPException(status_code=404, detail="Integracao nao encontrada")

    # Montar query com filtros
    conditions = ["integration_id = :id"]
    params: Dict[str, Any] = {"id": str(integration_id)}

    if endpoint:
        conditions.append("endpoint = :endpoint")
        params["endpoint"] = endpoint

    if status:
        conditions.append("status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions)

    query = text(f"""
        SELECT id, endpoint, item_type, product_code,
               request_payload, response_payload,
               status, error_message, duration_ms, created_at,
               COALESCE(send_batch, 1) as send_batch
        FROM inventario.protheus_send_logs
        WHERE {where_clause}
        ORDER BY send_batch DESC, created_at DESC
    """)

    rows = db.execute(query, params).fetchall()

    # ✅ v2.19.55: Buscar lotes fornecedor (b8_lotefor) para enriquecer detalhes
    lot_supplier_map = {}
    try:
        lot_rows = db.execute(text("""
            SELECT TRIM(b8_produto) as produto, b8_lotectl, b8_lotefor
            FROM inventario.sb8010
            WHERE b8_lotefor IS NOT NULL AND b8_lotefor != ''
        """)).fetchall()
        for lr in lot_rows:
            lot_supplier_map[(lr.produto, lr.b8_lotectl)] = lr.b8_lotefor.strip() if lr.b8_lotefor else ''
    except Exception:
        pass

    logs = []
    for row in rows:
        log_data = dict(row._mapping)
        log_data["id"] = str(log_data["id"])
        if log_data.get("created_at"):
            log_data["created_at"] = log_data["created_at"].isoformat()

        # Enriquecer detalhes da resposta com lote_fornecedor
        resp = log_data.get("response_payload")
        if resp and isinstance(resp, dict) and resp.get("detalhes"):
            for detalhe in resp["detalhes"]:
                codigo = (detalhe.get("codigo") or "").strip()
                lote = (detalhe.get("lote") or "").strip()
                if lote and codigo:
                    detalhe["lote_fornecedor"] = lot_supplier_map.get((codigo, lote), "")
                else:
                    detalhe["lote_fornecedor"] = ""

        logs.append(log_data)

    # Resumo
    total = len(logs)
    ok_count = sum(1 for l in logs if l.get("status") in ("OK", "SUCCESS", "SENT"))
    partial_count = sum(1 for l in logs if l.get("status") == "PARTIAL")
    error_count = sum(1 for l in logs if l.get("status") == "ERROR")

    return {
        "integration_id": str(integration_id),
        "total": total,
        "ok": ok_count,
        "partial": partial_count,
        "errors": error_count,
        "logs": logs
    }
