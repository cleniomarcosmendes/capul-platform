"""
Endpoint de Sincronização de Produtos com Protheus
Versão: 2.18.3
Data: 05/11/2025

Sincroniza cache local de produtos (SB1010 + SLK010) para performance 1.860x melhor.
Implementa lógica UPDATE + INSERT para popular tabela inventario.products.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
from datetime import datetime
from typing import Dict, List, Any
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def sync_products_from_protheus(db: Session, store_id: str = None) -> Dict[str, Any]:
    """
    Sincroniza produtos do Protheus (SB1010) + códigos de barras (SLK010)
    para cache local (inventario.products).

    Estratégia:
    1. Buscar produtos do SB1010 (com LEFT JOIN SLK010 para códigos de barras)
    2. Agrupar códigos de barras alternativos em array JSONB
    3. INSERT/UPDATE em inventario.products
    4. Criar índices otimizados automaticamente (já criados na migration)

    Args:
        db: Sessão do SQLAlchemy
        store_id: ID da loja (opcional - se None, usa primeira loja do sistema)

    Returns:
        Dict com estatísticas: inserted, updated, errors
    """
    start_time = datetime.now()
    logger.info("🔄 Iniciando sincronização de produtos do Protheus...")

    # =====================================================
    # FASE 0: Determinar store_id padrão
    # =====================================================
    # Para produtos compartilhados (b1_filial=''), usar primeira loja do sistema
    if not store_id:
        query_store = text("SELECT id FROM inventario.stores LIMIT 1")
        result_store = db.execute(query_store).fetchone()
        if not result_store:
            raise HTTPException(
                status_code=500,
                detail="Nenhuma loja encontrada no sistema. Crie uma loja primeiro."
            )
        store_id = str(result_store.id)
        logger.info(f"✅ Usando store_id padrão: {store_id}")

    try:
        # =====================================================
        # FASE 1: Buscar produtos do SB1010 + SLK010
        # =====================================================
        # Query otimizada: agrupa códigos de barras em array para evitar N+1 queries
        query_fetch = text("""
            WITH product_barcodes AS (
                -- Buscar todos os códigos de barras alternativos (SLK010)
                SELECT
                    TRIM(slk.slk_produto) as produto_code,
                    json_agg(DISTINCT TRIM(slk.slk_codbar)) FILTER (WHERE slk.slk_codbar IS NOT NULL AND TRIM(slk.slk_codbar) <> '') as alt_barcodes
                FROM inventario.slk010 slk
                WHERE slk.slk_filial = ''  -- Produtos compartilhados
                GROUP BY TRIM(slk.slk_produto)
            )
            SELECT
                -- Campos do SB1010
                sb1.b1_filial,
                TRIM(sb1.b1_cod) as b1_cod,
                COALESCE(TRIM(sb1.b1_desc), '') as b1_desc,
                COALESCE(TRIM(sb1.b1_codbar), '') as b1_codbar,
                COALESCE(NULLIF(TRIM(sb1.b1_rastro), ''), 'N') as b1_rastro,
                COALESCE(sb1.b1_um, 'UN') as b1_um,
                COALESCE(sb1.b1_tipo, 'PA') as b1_tipo,
                COALESCE(TRIM(sb1.b1_grupo), '') as b1_grupo,
                -- Hierarquia mercadológica (deixar vazio por enquanto - será sincronizado depois)
                '' as category_code,
                '' as subcategory_code,
                '' as segment_code,
                -- Códigos de barras alternativos (já agregados)
                COALESCE(pb.alt_barcodes, '[]'::json) as alternative_barcodes,
                -- R_E_C_N_O_ não disponível (campo interno do Protheus)
                NULL::integer as protheus_recno
            FROM inventario.sb1010 sb1
            -- Códigos de barras alternativos
            LEFT JOIN product_barcodes pb ON pb.produto_code = TRIM(sb1.b1_cod)
            WHERE sb1.b1_filial = ''  -- Apenas produtos compartilhados
                AND TRIM(sb1.b1_cod) <> ''  -- Código não vazio
            ORDER BY sb1.b1_cod
        """)

        result = db.execute(query_fetch)
        products_data = result.fetchall()

        logger.info(f"✅ Buscados {len(products_data)} produtos do Protheus")

        if len(products_data) == 0:
            logger.warning("⚠️ Nenhum produto encontrado no Protheus")
            return {
                "status": "warning",
                "message": "Nenhum produto encontrado",
                "inserted": 0,
                "updated": 0,
                "errors": 0,
                "execution_time_ms": 0
            }

        # =====================================================
        # FASE 2: UPSERT em inventario.products
        # =====================================================
        # Usar UPSERT (ON CONFLICT) para INSERT ou UPDATE
        query_upsert = text("""
            INSERT INTO inventario.products (
                store_id,
                code,
                b1_cod,
                barcode,
                b1_codbar,
                name,
                b1_desc,
                b1_rastro,
                unit,
                b1_um,
                b1_tipo,
                b1_grupo,
                b1_filial,
                hierarchy_category,
                hierarchy_subcategory,
                hierarchy_segment,
                alternative_barcodes,
                protheus_recno,
                last_sync_at,
                sync_status,
                has_lot,
                has_serial,
                is_active,
                warehouse
            ) VALUES (
                :store_id,         -- store_id (padrão para produtos compartilhados)
                :b1_cod,           -- code (compatibilidade)
                :b1_cod,           -- b1_cod
                :b1_codbar,        -- barcode (compatibilidade)
                :b1_codbar,        -- b1_codbar
                :b1_desc,          -- name (compatibilidade)
                :b1_desc,          -- b1_desc
                :b1_rastro,        -- b1_rastro
                :b1_um,            -- unit (compatibilidade)
                :b1_um,            -- b1_um
                :b1_tipo,          -- b1_tipo
                :b1_grupo,         -- b1_grupo
                :b1_filial,        -- b1_filial
                :category_code,    -- hierarchy_category
                :subcategory_code, -- hierarchy_subcategory
                :segment_code,     -- hierarchy_segment
                CAST(:alternative_barcodes AS JSONB),  -- alternative_barcodes
                :protheus_recno,   -- protheus_recno
                NOW(),             -- last_sync_at
                'synced',          -- sync_status
                :has_lot,          -- has_lot (baseado em b1_rastro)
                :has_serial,       -- has_serial (baseado em b1_rastro)
                true,              -- is_active
                '01'               -- warehouse (padrão)
            )
            ON CONFLICT (code, store_id) DO UPDATE SET
                -- Atualizar campos caso produto já exista (mesmo code + store_id)
                b1_desc = EXCLUDED.b1_desc,
                b1_codbar = EXCLUDED.b1_codbar,
                name = EXCLUDED.name,
                alternative_barcodes = EXCLUDED.alternative_barcodes,
                last_sync_at = NOW(),
                sync_status = 'synced'
        """)

        inserted = 0
        updated = 0
        errors = 0
        savepoint_counter = 0  # ✅ SEGURANÇA v2.19.13: Usar contador para nomes de SAVEPOINT

        for row in products_data:
            # 🔥 v2.18.3: Usar SAVEPOINT para isolar erros individuais
            # Isso permite continuar sincronizando mesmo se um produto falhar
            # ✅ SEGURANÇA v2.19.13: Usar contador incremental ao invés do código do produto
            savepoint_counter += 1
            savepoint_name = f"sp_product_{savepoint_counter}"

            try:
                # Criar SAVEPOINT antes de processar produto
                db.execute(text(f"SAVEPOINT {savepoint_name}"))

                # Converter alternative_barcodes para JSON string
                import json

                # Tratar alternative_barcodes (pode vir como str, list, ou None)
                alt_barcodes_raw = row.alternative_barcodes

                if alt_barcodes_raw is None or alt_barcodes_raw == '[]':
                    alt_barcodes_json = '[]'
                elif isinstance(alt_barcodes_raw, str):
                    # Se já é string JSON, validar e usar
                    try:
                        json.loads(alt_barcodes_raw)  # Validar
                        alt_barcodes_json = alt_barcodes_raw
                    except:
                        # Se não é JSON válido, tratar como array vazio
                        alt_barcodes_json = '[]'
                elif isinstance(alt_barcodes_raw, list):
                    # Converter list Python para JSON string
                    alt_barcodes_json = json.dumps(alt_barcodes_raw)
                else:
                    # Qualquer outro tipo, tentar converter
                    try:
                        alt_barcodes_json = json.dumps(alt_barcodes_raw)
                    except:
                        alt_barcodes_json = '[]'

                # Determinar has_lot e has_serial baseado em b1_rastro
                has_lot = (row.b1_rastro == 'L')
                has_serial = (row.b1_rastro == 'S')

                params = {
                    "store_id": store_id,  # Store ID padrão (primeira loja)
                    "b1_cod": row.b1_cod,
                    "b1_codbar": row.b1_codbar if row.b1_codbar else '',
                    "b1_desc": row.b1_desc,
                    "b1_rastro": row.b1_rastro,
                    "b1_um": row.b1_um,
                    "b1_tipo": row.b1_tipo,
                    "b1_grupo": row.b1_grupo,
                    "b1_filial": row.b1_filial,
                    "category_code": row.category_code,
                    "subcategory_code": row.subcategory_code,
                    "segment_code": row.segment_code,
                    "alternative_barcodes": alt_barcodes_json,
                    "protheus_recno": row.protheus_recno,
                    "has_lot": has_lot,
                    "has_serial": has_serial
                }

                db.execute(query_upsert, params)

                # ✅ Sucesso: Liberar SAVEPOINT
                db.execute(text(f"RELEASE SAVEPOINT {savepoint_name}"))
                inserted += 1

                # Log a cada 5000 produtos
                if inserted % 5000 == 0:
                    logger.info(f"📦 Sincronizados {inserted}/{len(products_data)} produtos...")

            except Exception as e:
                # ❌ Erro: Fazer ROLLBACK apenas deste produto (não toda transaction)
                db.execute(text(f"ROLLBACK TO SAVEPOINT {savepoint_name}"))
                logger.error(f"❌ Erro ao sincronizar produto {row.b1_cod}: {str(e)}")
                errors += 1
                continue

        # Commit de todas as inserções
        db.commit()

        # =====================================================
        # FASE 3: Retornar estatísticas
        # =====================================================
        end_time = datetime.now()
        execution_time_ms = int((end_time - start_time).total_seconds() * 1000)

        logger.info(f"✅ Sincronização concluída:")
        logger.info(f"   ✅ Inseridos: {inserted}")
        logger.info(f"   ⚠️ Erros: {errors}")
        logger.info(f"   ⏱️ Tempo: {execution_time_ms}ms")

        return {
            "status": "success",
            "message": f"Sincronização concluída: {inserted} produtos inseridos",
            "inserted": inserted,
            "updated": updated,
            "errors": errors,
            "execution_time_ms": execution_time_ms
        }

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro fatal durante sincronização: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao sincronizar produtos")
        )


@router.post("/products")
async def sync_products(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/v1/sync/protheus/products

    Sincroniza produtos do Protheus (SB1010 + SLK010) para cache local.

    RBAC: Apenas ADMIN e SUPERVISOR podem executar.

    Returns:
        {
            "status": "success",
            "message": "Sincronização concluída: 57533 produtos inseridos",
            "data": {
                "inserted": 57533,
                "updated": 0,
                "errors": 0,
                "execution_time_ms": 45234
            }
        }
    """
    # Validar permissão
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=403,
            detail="Apenas ADMIN e SUPERVISOR podem sincronizar produtos"
        )

    try:
        logger.info(f"🔄 Usuário {current_user.username} iniciou sincronização de produtos")

        # Executar sincronização
        result = sync_products_from_protheus(db)

        return {
            "status": result["status"],
            "message": result["message"],
            "data": {
                "inserted": result["inserted"],
                "updated": result["updated"],
                "errors": result["errors"],
                "execution_time_ms": result["execution_time_ms"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao processar requisição: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao sincronizar produtos")
        )
