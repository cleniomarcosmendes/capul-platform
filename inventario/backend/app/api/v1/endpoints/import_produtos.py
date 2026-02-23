"""
Endpoint para importação de produtos via API Protheus

Importa produtos de uma filial e armazém específicos,
atualizando as tabelas: SB1010, SB2010, SB8010, SBZ010, SLK010, SZB010
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
import httpx
import logging
from datetime import datetime
import base64
import json
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter()
logger = logging.getLogger(__name__)

# Configurações da API Protheus
# ✅ v2.19.47: Atualizado endpoint para porta 8104
PROTHEUS_API_URL = "https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES/produtosInventario"
PROTHEUS_AUTH = "QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="  # Basic Auth: APICAPUL:Ap1C4pu1PRD


@router.post("/import-produtos")
async def import_produtos_protheus(
    filial: str = Query(..., description="Código da filial (ex: 01)"),
    armazem: List[str] = Query(..., description="Códigos dos armazéns (ex: ['01', '02'])"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Importa produtos de uma filial e múltiplos armazéns via API Protheus

    ✅ v2.19.7: Processa armazéns SEQUENCIALMENTE (um de cada vez)
    - Evita timeout da API Protheus quando múltiplos armazéns são selecionados
    - Cada armazém é processado individualmente
    - Resultados são acumulados e consolidados no final

    Atualiza as seguintes tabelas:
    - SB1010: Cadastro de produtos
    - SB2010: Saldos por local (armazéns)
    - SB8010: Saldos por lote
    - SBZ010: Indicadores por filial
    - SLK010: Códigos de barras
    - SZB010: Armazéns (se necessário)
    """

    try:
        import time
        start_time = time.time()

        armazens_str = ", ".join(armazem)
        logger.info(f"🚀 [IMPORT PRODUTOS] Usuário: {current_user.username} | Filial: {filial} | Armazéns: {armazens_str}")
        logger.info(f"📋 [SEQUENCIAL] Processando {len(armazem)} armazém(ns) um de cada vez...")

        # ========================================
        # 1. CHAMAR API PROTHEUS SEQUENCIALMENTE (UM ARMAZÉM DE CADA VEZ)
        # ========================================
        headers = {
            "Authorization": f"Basic {PROTHEUS_AUTH}",
            "Content-Type": "application/json"
        }

        todos_produtos = []
        armazens_processados = []
        armazens_com_erro = []

        # ✅ v2.19.7: Processar cada armazém SEQUENCIALMENTE
        async with httpx.AsyncClient(verify=False, timeout=900.0) as client:
            for idx, arm in enumerate(armazem, 1):
                logger.info(f"📡 [API {idx}/{len(armazem)}] Processando armazém {arm}...")

                try:
                    # Payload com apenas 1 armazém
                    payload = {
                        "filial": filial,
                        "armazem": [{"codigo": arm}]
                    }

                    logger.info(f"📦 [PAYLOAD {idx}] {json.dumps(payload)}")

                    api_start = time.time()
                    response = await client.post(PROTHEUS_API_URL, json=payload, headers=headers)
                    api_duration = time.time() - api_start
                    response.raise_for_status()

                    logger.info(f"⏱️ [API {idx}] Tempo de resposta armazém {arm}: {api_duration:.2f}s")

                    # Tentar decodificar com diferentes encodings
                    try:
                        text_content = response.content.decode('utf-8')
                        data = json.loads(text_content)
                    except UnicodeDecodeError:
                        logger.warning(f"⚠️ [API {idx}] Erro UTF-8, tentando ISO-8859-1...")
                        text_content = response.content.decode('iso-8859-1')
                        data = json.loads(text_content)

                    produtos_armazem = data.get("produtos", [])
                    logger.info(f"✅ [API {idx}] Armazém {arm}: {len(produtos_armazem)} produtos recebidos")

                    if len(produtos_armazem) == 0:
                        logger.warning(f"⚠️ [API {idx}] Armazém {arm} retornou 0 produtos")
                        logger.warning(f"⚠️ [API {idx}] Resposta: {str(data)[:500]}")

                    # Acumular produtos
                    todos_produtos.extend(produtos_armazem)
                    armazens_processados.append(arm)

                except httpx.HTTPError as e:
                    logger.error(f"❌ [API {idx}] Erro HTTP no armazém {arm}: {str(e)}")
                    if hasattr(e, 'response') and e.response is not None:
                        logger.error(f"❌ [API {idx}] Status: {e.response.status_code}, Body: {e.response.text[:500]}")
                    armazens_com_erro.append(arm)

                except json.JSONDecodeError as e:
                    logger.error(f"❌ [API {idx}] Erro JSON no armazém {arm}: {str(e)}")
                    armazens_com_erro.append(arm)

                except Exception as e:
                    logger.error(f"❌ [API {idx}] Erro inesperado no armazém {arm}: {str(e)}")
                    armazens_com_erro.append(arm)

        total_produtos = len(todos_produtos)
        logger.info(f"📊 [RESUMO API] Total de {total_produtos} produtos de {len(armazens_processados)} armazéns (erros: {len(armazens_com_erro)})")

        if total_produtos == 0:
            mensagem_erro = "Nenhum produto encontrado"
            if armazens_com_erro:
                mensagem_erro += f". Armazéns com erro: {', '.join(armazens_com_erro)}"

            return {
                "success": False,
                "message": mensagem_erro,
                "armazens_processados": armazens_processados,
                "armazens_com_erro": armazens_com_erro,
                "stats": {
                    "total_produtos": 0,
                    "sb1_inserted": 0,
                    "sb1_updated": 0,
                    "sb2_inserted": 0,
                    "sb2_updated": 0,
                    "sb8_inserted": 0,
                    "sb8_updated": 0,
                    "sbz_inserted": 0,
                    "sbz_updated": 0,
                    "slk_inserted": 0,
                    "slk_updated": 0,
                    "errors": []
                }
            }

        # ========================================
        # 2. PROCESSAR DADOS E ATUALIZAR TABELAS (BATCH OPTIMIZED)
        # ========================================
        logger.info("🚀 [BATCH] Preparando dados em lotes para inserção rápida...")

        stats = {
            "total_produtos": total_produtos,
            "sb1_inserted": 0,
            "sb1_updated": 0,
            "sb2_inserted": 0,
            "sb2_updated": 0,
            "sb8_inserted": 0,
            "sb8_updated": 0,
            "sbz_inserted": 0,
            "sbz_updated": 0,
            "slk_inserted": 0,
            "slk_updated": 0,
            "errors": []
        }

        # Preparar lotes de dados em memória
        sb1_batch = []
        sb2_batch = []
        sb8_batch = []
        sbz_batch = []
        slk_batch = []

        for idx, produto in enumerate(todos_produtos, 1):
            try:
                # Log progresso a cada 1000 produtos
                if idx % 1000 == 0:
                    logger.info(f"📦 [PREP] Preparando lote {idx}/{total_produtos}")

                # Preparar dados SB1010
                sb1_batch.append(_prepare_sb1010(produto))

                # ✅ v2.15.3: Preparar dados SB2010 (tabela EXCLUSIVA - passa código da filial)
                for armazem_data in produto.get("armazens", []):
                    sb2_batch.append(_prepare_sb2010(produto, armazem_data, filial))

                # ✅ v2.15.3: Preparar dados SB8010 (tabela EXCLUSIVA - passa código da filial)
                for lote_data in produto.get("lotes", []):
                    sb8_batch.append(_prepare_sb8010(produto, lote_data, filial))

                # ✅ v2.15.3: Preparar dados SBZ010 (tabela EXCLUSIVA - passa código da filial)
                for indicador_data in produto.get("indicadores", []):
                    sbz_batch.append(_prepare_sbz010(produto, indicador_data, filial))

                # Preparar dados SLK010
                for codigo_barras_data in produto.get("codigosBarras", []):
                    slk_batch.append(_prepare_slk010(produto, codigo_barras_data))

            except Exception as e:
                error_msg = f"Erro ao preparar produto {produto.get('b1_cod', 'UNKNOWN')}: {str(e)}"
                logger.error(f"❌ {error_msg}")
                stats["errors"].append(error_msg)

        # ========================================
        # 3. LIMPEZA DE PRODUTOS DESCONTINUADOS (v2.17.1)
        # ========================================
        # 🔥 CRÍTICO: Remover produtos da filial+armazém que NÃO vieram na importação
        # Isso evita "produtos fantasmas" que geram divergências falsas

        # Extrair lista de códigos de produtos importados
        produtos_importados = list(set([p.get("b1_cod", "").strip() for p in todos_produtos]))
        stats["sb2_deleted"] = 0
        stats["sb8_deleted"] = 0

        if produtos_importados:
            logger.info(f"🧹 [CLEANUP] Removendo produtos descontinuados da filial {filial}, armazéns {armazens_str}...")

            # DELETE SB2010: Produtos descontinuados (saldo fantasma)
            delete_sb2_query = text("""
                DELETE FROM inventario.sb2010
                WHERE b2_filial = :filial
                  AND b2_local = ANY(:armazens)
                  AND b2_cod NOT IN :produtos_importados
            """)
            result_sb2 = db.execute(delete_sb2_query, {
                "filial": filial,
                "armazens": armazem,
                "produtos_importados": tuple(produtos_importados)
            })
            stats["sb2_deleted"] = result_sb2.rowcount
            logger.info(f"🗑️ [SB2010] {stats['sb2_deleted']} produtos descontinuados removidos")

            # DELETE SB8010: Lotes de produtos descontinuados
            delete_sb8_query = text("""
                DELETE FROM inventario.sb8010
                WHERE b8_filial = :filial
                  AND b8_local = ANY(:armazens)
                  AND b8_produto NOT IN :produtos_importados
            """)
            result_sb8 = db.execute(delete_sb8_query, {
                "filial": filial,
                "armazens": armazem,
                "produtos_importados": tuple(produtos_importados)
            })
            stats["sb8_deleted"] = result_sb8.rowcount
            logger.info(f"🗑️ [SB8010] {stats['sb8_deleted']} lotes descontinuados removidos")

        # ========================================
        # 4. INSERÇÃO EM LOTE (MUITO MAIS RÁPIDA!)
        # ========================================
        logger.info(f"💾 [BATCH INSERT] Inserindo {len(sb1_batch)} produtos SB1010...")
        stats["sb1_inserted"] = await _batch_upsert(db, "sb1010", sb1_batch)

        logger.info(f"💾 [BATCH UPSERT] Processando {len(sb2_batch)} saldos SB2010...")
        stats["sb2_inserted"] = await _batch_upsert(db, "sb2010", sb2_batch)

        logger.info(f"💾 [BATCH UPSERT] Processando {len(sb8_batch)} lotes SB8010...")
        stats["sb8_inserted"] = await _batch_upsert(db, "sb8010", sb8_batch)

        logger.info(f"💾 [BATCH INSERT] Inserindo {len(sbz_batch)} indicadores SBZ010...")
        stats["sbz_inserted"] = await _batch_upsert(db, "sbz010", sbz_batch)

        logger.info(f"💾 [BATCH INSERT] Inserindo {len(slk_batch)} códigos SLK010...")
        stats["slk_inserted"] = await _batch_upsert(db, "slk010", slk_batch)

        # Commit final
        db.commit()
        logger.info("✅ [BATCH] Commit realizado com sucesso!")

        total_duration = time.time() - start_time
        logger.info(f"⏱️ [TOTAL] Tempo total de importação: {total_duration:.2f}s ({total_duration/60:.2f} minutos)")

        logger.info(f"""
        ✅ [IMPORT CONCLUÍDO]
        - Armazéns processados: {len(armazens_processados)} ({', '.join(armazens_processados)})
        - Armazéns com erro: {len(armazens_com_erro)} ({', '.join(armazens_com_erro) if armazens_com_erro else 'nenhum'})
        - Produtos processados: {total_produtos}
        - 🧹 LIMPEZA (v2.17.1):
          * SB2010: {stats['sb2_deleted']} produtos descontinuados removidos
          * SB8010: {stats['sb8_deleted']} lotes descontinuados removidos
        - SB1010: {stats['sb1_inserted']} inseridos/atualizados
        - SB2010: {stats['sb2_inserted']} inseridos/atualizados
        - SB8010: {stats['sb8_inserted']} inseridos/atualizados
        - SBZ010: {stats['sbz_inserted']} inseridos/atualizados
        - SLK010: {stats['slk_inserted']} inseridos/atualizados
        - Erros: {len(stats['errors'])}
        """)

        mensagem = f"Importação concluída! {total_produtos} produtos de {len(armazens_processados)} armazéns processados."
        if stats['sb2_deleted'] > 0 or stats['sb8_deleted'] > 0:
            mensagem += f" 🧹 Limpeza: {stats['sb2_deleted']} produtos e {stats['sb8_deleted']} lotes descontinuados removidos."
        if armazens_com_erro:
            mensagem += f" ⚠️ Atenção: {len(armazens_com_erro)} armazéns com erro."

        return {
            "success": True,
            "message": mensagem,
            "armazens_processados": armazens_processados,
            "armazens_com_erro": armazens_com_erro,
            "stats": stats
        }

    except httpx.HTTPError as e:
        logger.error(f"❌ [API ERROR] Erro ao chamar API Protheus: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail=safe_error_response(e, "ao conectar com API Protheus")
        )

    except Exception as e:
        logger.error(f"❌ [IMPORT ERROR] Erro na importação: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao importar produtos")
        )


# ========================================
# FUNÇÕES AUXILIARES DE UPSERT
# ========================================

async def _upsert_sb1010(db: Session, produto: Dict[str, Any]) -> Dict[str, bool]:
    """Insere ou atualiza produto na tabela SB1010"""

    b1_cod = produto.get("b1_cod", "").strip()
    b1_filial = produto.get("b1_filial", "").strip()

    # Extrair dados de hierarquia de forma segura (verificando se arrays não estão vazios)
    hierarquia_list = produto.get("hierarquiaMercadologica", [])
    hierarquia = hierarquia_list[0] if hierarquia_list else {}

    categoria_list = hierarquia.get("categoria", [])
    categoria = categoria_list[0] if categoria_list else {}

    subcategoria_list = categoria.get("subcategoria", [])
    subcategoria = subcategoria_list[0] if subcategoria_list else {}

    segmento_list = subcategoria.get("segmento", [])
    segmento = segmento_list[0] if segmento_list else {}

    query = text("""
        INSERT INTO inventario.sb1010 (
            b1_cod, b1_filial, b1_codbar, b1_desc, b1_tipo, b1_um,
            b1_locpad, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen,
            b1_xgrinve, b1_rastro,
            created_at, updated_at
        ) VALUES (
            :b1_cod, :b1_filial, :b1_codbar, :b1_desc, :b1_tipo, :b1_um,
            :b1_locpad, :b1_grupo, :b1_xcatgor, :b1_xsubcat, :b1_xsegmen,
            :b1_xgrinve, :b1_rastro,
            NOW(), NOW()
        )
        ON CONFLICT (b1_filial, b1_cod)
        DO UPDATE SET
            b1_codbar = EXCLUDED.b1_codbar,
            b1_desc = EXCLUDED.b1_desc,
            b1_tipo = EXCLUDED.b1_tipo,
            b1_um = EXCLUDED.b1_um,
            b1_locpad = EXCLUDED.b1_locpad,
            b1_grupo = EXCLUDED.b1_grupo,
            b1_xcatgor = EXCLUDED.b1_xcatgor,
            b1_xsubcat = EXCLUDED.b1_xsubcat,
            b1_xsegmen = EXCLUDED.b1_xsegmen,
            b1_xgrinve = EXCLUDED.b1_xgrinve,
            b1_rastro = EXCLUDED.b1_rastro,
            updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
    """)

    result = db.execute(query, {
        "b1_cod": b1_cod,
        "b1_filial": b1_filial or "  ",
        "b1_codbar": produto.get("b1_codbar", ""),
        "b1_desc": produto.get("b1_desc", ""),
        "b1_tipo": produto.get("b1_tipo", ""),
        "b1_um": produto.get("b1_um", ""),
        "b1_locpad": produto.get("b1_locpad", ""),
        "b1_grupo": hierarquia.get("bm_grupo", ""),
        "b1_xcatgor": categoria.get("zd_xcod", ""),
        "b1_xsubcat": subcategoria.get("ze_xcod", ""),
        "b1_xsegmen": segmento.get("zf_xcod", ""),
        "b1_xgrinve": produto.get("b1_xgrinve", ""),
        "b1_rastro": produto.get("b1_rastro", "N")
    })

    row = result.fetchone()
    return {"inserted": row[0] if row else True}


async def _upsert_sb2010(db: Session, produto: Dict[str, Any], armazem_data: Dict[str, Any]) -> Dict[str, bool]:
    """Insere ou atualiza saldo por armazém na tabela SB2010"""

    query = text("""
        INSERT INTO inventario.sb2010 (
            b2_cod, b2_filial, b2_local, b2_qatu, b2_qemp, b2_reserva,
            b2_cm1, b2_vatu1, created_at, updated_at
        ) VALUES (
            :b2_cod, :b2_filial, :b2_local, :b2_qatu, :b2_qemp, :b2_reserva,
            :b2_cm1, :b2_vatu1, NOW(), NOW()
        )
        ON CONFLICT (b2_filial, b2_cod, b2_local)
        DO UPDATE SET
            b2_qatu = EXCLUDED.b2_qatu,
            b2_qemp = EXCLUDED.b2_qemp,
            b2_reserva = EXCLUDED.b2_reserva,
            b2_cm1 = EXCLUDED.b2_cm1,
            b2_vatu1 = EXCLUDED.b2_vatu1,
            updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
    """)

    result = db.execute(query, {
        "b2_cod": produto.get("b1_cod", "").strip(),
        "b2_filial": armazem_data.get("b2_filial", "").strip(),
        "b2_local": armazem_data.get("b2_local", "").strip(),
        "b2_qatu": armazem_data.get("b2_qatu", 0),
        "b2_qemp": armazem_data.get("b2_qemp", 0),
        "b2_reserva": armazem_data.get("b2_reserva", 0),
        "b2_cm1": armazem_data.get("b2_cm1", 0),
        "b2_vatu1": armazem_data.get("b2_vatu1", 0)
    })

    row = result.fetchone()
    return {"inserted": row[0] if row else True}


async def _upsert_sb8010(db: Session, produto: Dict[str, Any], lote_data: Dict[str, Any]) -> Dict[str, bool]:
    """Insere ou atualiza saldo por lote na tabela SB8010"""

    query = text("""
        INSERT INTO inventario.sb8010 (
            id, b8_produto, b8_filial, b8_local, b8_lotectl, b8_numlote,
            b8_dtvalid, b8_saldo, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), :b8_produto, :b8_filial, :b8_local, :b8_lotectl, :b8_numlote,
            :b8_dtvalid, :b8_saldo, NOW(), NOW()
        )
        ON CONFLICT (b8_filial, b8_produto, b8_local, b8_lotectl)
        DO UPDATE SET
            b8_numlote = EXCLUDED.b8_numlote,
            b8_dtvalid = EXCLUDED.b8_dtvalid,
            b8_saldo = EXCLUDED.b8_saldo,
            updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
    """)

    result = db.execute(query, {
        "b8_produto": produto.get("b1_cod", "").strip(),
        "b8_filial": lote_data.get("b8_filial", "").strip(),
        "b8_local": lote_data.get("b8_local", "").strip(),
        "b8_lotectl": lote_data.get("b8_lotectl", "").strip(),
        "b8_numlote": lote_data.get("b8_numlote", "").strip(),
        "b8_dtvalid": lote_data.get("b8_dtvalid"),
        "b8_saldo": lote_data.get("b8_saldo", 0)
    })

    row = result.fetchone()
    return {"inserted": row[0] if row else True}


async def _upsert_sbz010(db: Session, produto: Dict[str, Any], indicador_data: Dict[str, Any]) -> Dict[str, bool]:
    """Insere ou atualiza indicadores por filial na tabela SBZ010"""

    query = text("""
        INSERT INTO inventario.sbz010 (
            bz_cod, bz_filial, bz_local, bz_xlocal1, bz_xlocal2, bz_xlocal3,
            is_active, created_at, updated_at
        ) VALUES (
            :bz_cod, :bz_filial, :bz_local, :bz_xlocal1, :bz_xlocal2, :bz_xlocal3,
            true, NOW(), NOW()
        )
        ON CONFLICT (bz_filial, bz_cod)
        DO UPDATE SET
            bz_local = EXCLUDED.bz_local,
            bz_xlocal1 = EXCLUDED.bz_xlocal1,
            bz_xlocal2 = EXCLUDED.bz_xlocal2,
            bz_xlocal3 = EXCLUDED.bz_xlocal3,
            updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
    """)

    result = db.execute(query, {
        "bz_cod": produto.get("b1_cod", "").strip(),
        "bz_filial": indicador_data.get("bz_filial", "").strip(),
        "bz_local": indicador_data.get("bz_local", ""),
        "bz_xlocal1": indicador_data.get("bz_xlocal1", ""),
        "bz_xlocal2": indicador_data.get("bz_xlocal2", ""),
        "bz_xlocal3": indicador_data.get("bz_xlocal3", "")
    })

    row = result.fetchone()
    return {"inserted": row[0] if row else True}


async def _upsert_slk010(db: Session, produto: Dict[str, Any], codigo_barras_data: Dict[str, Any]) -> Dict[str, bool]:
    """Insere ou atualiza código de barras na tabela SLK010"""

    slk_filial = codigo_barras_data.get("lk_filial", "").strip()
    slk_codbar = codigo_barras_data.get("lk_codbar", "").strip()
    slk_produto = produto.get("b1_cod", "").strip()

    # Verificar se já existe
    check_query = text("""
        SELECT id FROM inventario.slk010
        WHERE slk_filial = :slk_filial
          AND slk_codbar = :slk_codbar
          AND slk_produto = :slk_produto
    """)

    existing = db.execute(check_query, {
        "slk_filial": slk_filial,
        "slk_codbar": slk_codbar,
        "slk_produto": slk_produto
    }).fetchone()

    if existing:
        # Atualizar
        update_query = text("""
            UPDATE inventario.slk010
            SET updated_at = NOW()
            WHERE id = :id
        """)
        db.execute(update_query, {"id": existing[0]})
        return {"inserted": False}
    else:
        # Inserir novo
        insert_query = text("""
            INSERT INTO inventario.slk010 (
                id, slk_filial, slk_codbar, slk_produto, is_active, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), :slk_filial, :slk_codbar, :slk_produto, true, NOW(), NOW()
            )
        """)
        db.execute(insert_query, {
            "slk_filial": slk_filial,
            "slk_codbar": slk_codbar,
            "slk_produto": slk_produto
        })
        return {"inserted": True}


# ========================================
# FUNÇÕES OTIMIZADAS PARA BATCH INSERT
# ========================================

def _prepare_sb1010(produto: Dict[str, Any]) -> Dict[str, Any]:
    """Prepara dados do produto para batch insert em SB1010"""
    hierarquia_list = produto.get("hierarquiaMercadologica", [])
    hierarquia = hierarquia_list[0] if hierarquia_list else {}

    categoria_list = hierarquia.get("categoria", [])
    categoria = categoria_list[0] if categoria_list else {}

    subcategoria_list = categoria.get("subcategoria", [])
    subcategoria = subcategoria_list[0] if subcategoria_list else {}

    segmento_list = subcategoria.get("segmento", [])
    segmento = segmento_list[0] if segmento_list else {}

    return {
        "b1_cod": produto.get("b1_cod", "").strip(),
        "b1_filial": produto.get("b1_filial", "").strip(),
        "b1_codbar": produto.get("b1_codbar", "").strip(),
        "b1_desc": produto.get("b1_desc", "").strip(),
        "b1_tipo": produto.get("b1_tipo", "").strip(),
        "b1_um": produto.get("b1_um", "").strip(),
        "b1_locpad": produto.get("b1_locpad", "").strip(),
        "b1_grupo": hierarquia.get("bm_grupo", "").strip(),
        "b1_xcatgor": categoria.get("zd_xcod", "").strip(),
        "b1_xsubcat": subcategoria.get("ze_xcod", "").strip(),
        "b1_xsegmen": segmento.get("zf_xcod", "").strip(),
        "b1_xgrinve": produto.get("b1_xgrinve", "").strip(),
        "b1_rastro": produto.get("b1_rastro", "").strip()
    }


def _prepare_sb2010(produto: Dict[str, Any], armazem_data: Dict[str, Any], filial: str) -> Dict[str, Any]:
    """
    Prepara dados de saldo por armazém para batch insert em SB2010

    ✅ v2.15.3: SB2010 é EXCLUSIVA - b2_filial deve ter o código da filial!
    ✅ v2.17.0: Adiciona campo b2_xentpos (Entregas Posteriores)
    """
    return {
        "b2_cod": produto.get("b1_cod", "").strip(),
        "b2_filial": filial.strip(),  # ✅ v2.15.3: Usar filial do parâmetro (tabela EXCLUSIVA)
        "b2_local": armazem_data.get("b2_local", "").strip(),
        "b2_qatu": float(armazem_data.get("b2_qatu", 0)),
        "b2_vatu1": float(armazem_data.get("b2_vatu1", 0)),
        "b2_cm1": float(armazem_data.get("b2_cm1", 0)),
        "b2_xentpos": float(armazem_data.get("b2_xentpos", 0))  # ✅ v2.17.0: Entregas Posteriores
    }


def _prepare_sb8010(produto: Dict[str, Any], lote_data: Dict[str, Any], filial: str) -> Dict[str, Any]:
    """
    Prepara dados de lote para batch insert em SB8010

    ✅ v2.15.3: SB8010 é EXCLUSIVA - b8_filial deve ter o código da filial!
    """
    return {
        "b8_produto": produto.get("b1_cod", "").strip(),
        "b8_filial": filial.strip(),  # ✅ v2.15.3: Usar filial do parâmetro (tabela EXCLUSIVA)
        "b8_local": lote_data.get("b8_local", "").strip(),
        "b8_lotectl": lote_data.get("b8_lotectl", "").strip(),
        "b8_lotefor": lote_data.get("b8_lotefor", "").strip(),  # ✅ v2.17.1: Lote do fornecedor
        "b8_numlote": lote_data.get("b8_numlote", "").strip() or "0",  # Default para "0" se vazio
        "b8_dtvalid": lote_data.get("b8_dtvalid", "").strip() or None,
        "b8_saldo": float(lote_data.get("b8_saldo", 0))
    }


def _prepare_sbz010(produto: Dict[str, Any], indicador_data: Dict[str, Any], filial: str) -> Dict[str, Any]:
    """
    Prepara dados de indicador para batch insert em SBZ010

    ✅ v2.15.3: SBZ010 é EXCLUSIVA - bz_filial deve ter o código da filial!
    """
    return {
        "bz_cod": produto.get("b1_cod", "").strip(),
        "bz_filial": filial.strip(),  # ✅ v2.15.3: Usar filial do parâmetro (tabela EXCLUSIVA)
        "bz_local": indicador_data.get("bz_local", "").strip(),
        "bz_xlocal1": indicador_data.get("bz_xlocal1", "").strip(),
        "bz_xlocal2": indicador_data.get("bz_xlocal2", "").strip(),
        "bz_xlocal3": indicador_data.get("bz_xlocal3", "").strip()
    }


def _prepare_slk010(produto: Dict[str, Any], codigo_barras_data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepara dados de código de barras para batch insert em SLK010"""
    return {
        "slk_filial": codigo_barras_data.get("lk_filial", "").strip(),
        "slk_codbar": codigo_barras_data.get("lk_codbar", "").strip(),
        "slk_produto": produto.get("b1_cod", "").strip()
    }


async def _batch_upsert(db: Session, table_name: str, data_batch: list) -> int:
    """
    Faz batch upsert usando SQL bruto para máxima performance
    Retorna quantidade de registros ÚNICOS inseridos/atualizados (remove duplicatas do batch)
    """
    if not data_batch:
        return 0

    # ✅ CORREÇÃO: Remover duplicatas do batch antes de processar
    # Para cada tabela, identificar a chave única e deduplicate
    unique_keys = {
        "sb1010": ("b1_filial", "b1_cod"),
        "sb2010": ("b2_filial", "b2_cod", "b2_local"),
        "sb8010": ("b8_filial", "b8_produto", "b8_local", "b8_lotectl"),
        "sbz010": ("bz_filial", "bz_cod"),
        "slk010": ("slk_filial", "slk_codbar", "slk_produto")
    }

    # Deduplicate: Manter apenas o último registro de cada chave única
    if table_name in unique_keys:
        keys = unique_keys[table_name]
        seen = {}
        unique_batch = []

        for record in data_batch:
            # Criar tupla com valores das chaves
            key_values = tuple(record.get(k, "") for k in keys)
            # Manter apenas o último (sobrescreve duplicatas)
            seen[key_values] = record

        unique_batch = list(seen.values())

        # Log se houver duplicatas
        duplicates_count = len(data_batch) - len(unique_batch)
        if duplicates_count > 0:
            logger.warning(f"⚠️ [{table_name.upper()}] {duplicates_count} duplicatas removidas do batch ({len(data_batch)} → {len(unique_batch)})")
    else:
        unique_batch = data_batch

    # Mapear nome da tabela para query SQL
    queries = {
        "sb1010": """
            INSERT INTO inventario.sb1010 (
                b1_cod, b1_filial, b1_codbar, b1_desc, b1_tipo, b1_um,
                b1_locpad, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen,
                b1_xgrinve, b1_rastro, created_at, updated_at
            ) VALUES (
                :b1_cod, :b1_filial, :b1_codbar, :b1_desc, :b1_tipo, :b1_um,
                :b1_locpad, :b1_grupo, :b1_xcatgor, :b1_xsubcat, :b1_xsegmen,
                :b1_xgrinve, :b1_rastro, NOW(), NOW()
            )
            ON CONFLICT (b1_filial, b1_cod) DO UPDATE SET
                b1_codbar = EXCLUDED.b1_codbar,
                b1_desc = EXCLUDED.b1_desc,
                b1_tipo = EXCLUDED.b1_tipo,
                b1_um = EXCLUDED.b1_um,
                b1_locpad = EXCLUDED.b1_locpad,
                b1_grupo = EXCLUDED.b1_grupo,
                b1_xcatgor = EXCLUDED.b1_xcatgor,
                b1_xsubcat = EXCLUDED.b1_xsubcat,
                b1_xsegmen = EXCLUDED.b1_xsegmen,
                b1_xgrinve = EXCLUDED.b1_xgrinve,
                b1_rastro = EXCLUDED.b1_rastro,
                updated_at = NOW()
        """,
        "sb2010": """
            INSERT INTO inventario.sb2010 (
                b2_cod, b2_filial, b2_local, b2_qatu, b2_vatu1, b2_cm1, b2_xentpos,
                created_at, updated_at
            ) VALUES (
                :b2_cod, :b2_filial, :b2_local, :b2_qatu, :b2_vatu1, :b2_cm1, :b2_xentpos,
                NOW(), NOW()
            )
            ON CONFLICT (b2_filial, b2_cod, b2_local) DO UPDATE SET
                b2_qatu = EXCLUDED.b2_qatu,
                b2_vatu1 = EXCLUDED.b2_vatu1,
                b2_cm1 = EXCLUDED.b2_cm1,
                b2_xentpos = EXCLUDED.b2_xentpos,
                updated_at = NOW()
        """,
        "sb8010": """
            INSERT INTO inventario.sb8010 (
                id, b8_produto, b8_filial, b8_local, b8_lotectl, b8_lotefor, b8_numlote, b8_dtvalid, b8_saldo,
                created_at, updated_at
            ) VALUES (
                gen_random_uuid(), :b8_produto, :b8_filial, :b8_local, :b8_lotectl, :b8_lotefor, :b8_numlote, :b8_dtvalid, :b8_saldo,
                NOW(), NOW()
            )
            ON CONFLICT (b8_filial, b8_produto, b8_local, b8_lotectl) DO UPDATE SET
                b8_lotefor = EXCLUDED.b8_lotefor,
                b8_numlote = EXCLUDED.b8_numlote,
                b8_dtvalid = EXCLUDED.b8_dtvalid,
                b8_saldo = EXCLUDED.b8_saldo,
                updated_at = NOW()
        """,
        "sbz010": """
            INSERT INTO inventario.sbz010 (
                bz_cod, bz_filial, bz_local, bz_xlocal1, bz_xlocal2, bz_xlocal3,
                is_active, created_at, updated_at
            ) VALUES (
                :bz_cod, :bz_filial, :bz_local, :bz_xlocal1, :bz_xlocal2, :bz_xlocal3,
                true, NOW(), NOW()
            )
            ON CONFLICT (bz_filial, bz_cod) DO UPDATE SET
                bz_local = EXCLUDED.bz_local,
                bz_xlocal1 = EXCLUDED.bz_xlocal1,
                bz_xlocal2 = EXCLUDED.bz_xlocal2,
                bz_xlocal3 = EXCLUDED.bz_xlocal3,
                updated_at = NOW()
        """,
        "slk010": """
            INSERT INTO inventario.slk010 (
                id, slk_filial, slk_codbar, slk_produto,
                is_active, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), :slk_filial, :slk_codbar, :slk_produto,
                true, NOW(), NOW()
            )
            ON CONFLICT (slk_filial, slk_codbar, slk_produto) DO NOTHING
        """
    }

    query_sql = queries.get(table_name)
    if not query_sql:
        raise ValueError(f"Tabela {table_name} não suportada")

    # Executar batch insert usando executemany (muito mais rápido!)
    db.execute(text(query_sql), unique_batch)

    # ✅ Retornar quantidade REAL de registros únicos processados
    return len(unique_batch)
