"""
Endpoint de Sincronização com API Protheus
Versão: 2.14.0
Data: 24/10/2025

Sincroniza hierarquia mercadológica (SBM010, SZD010, SZE010, SZF010) com dados do ERP Protheus.
Implementa lógica UPDATE + INSERT + DELETE (soft) para manter dados consistentes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import requests
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Any
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.constants import VALID_SYNC_TABLES

router = APIRouter()
logger = logging.getLogger(__name__)

# Configurações da API Protheus
PROTHEUS_API_URL = getattr(settings, 'PROTHEUS_API_URL',
    "https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES/hierarquiaMercadologica")
PROTHEUS_API_AUTH = getattr(settings, 'PROTHEUS_API_AUTH',
    "Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=")
PROTHEUS_API_TIMEOUT = getattr(settings, 'PROTHEUS_API_TIMEOUT', 30)


def fetch_protheus_hierarchy() -> Dict[str, List[Dict]]:
    """
    Busca dados da API Protheus (hierarquia mercadológica + armazéns).

    Returns:
        Dict com:
        - grupos: Lista de grupos com categorias/subcategorias/segmentos aninhados
        - armazens: Lista de armazéns (SZB010) - v2.18.4

    Raises:
        requests.exceptions.Timeout: Timeout ao conectar
        requests.exceptions.HTTPError: Erro HTTP (401, 403, 500, etc)
        requests.exceptions.RequestException: Outros erros de conexão
    """
    logger.info(f"🔄 Buscando dados da API Protheus: {PROTHEUS_API_URL}")

    try:
        response = requests.get(
            PROTHEUS_API_URL,
            headers={"Authorization": PROTHEUS_API_AUTH},
            timeout=PROTHEUS_API_TIMEOUT,
            verify=True  # Validar certificado SSL
        )
        response.raise_for_status()

        data = response.json()

        # v2.18.4: Suporta nova estrutura da API (grupos + armazens) e legada (resultado)
        grupos = data.get("grupos", data.get("resultado", []))
        armazens = data.get("armazens", [])

        logger.info(f"✅ API retornou {len(grupos)} grupos e {len(armazens)} armazéns")
        return {"grupos": grupos, "armazens": armazens}

    except requests.exceptions.Timeout:
        logger.error("❌ Timeout ao conectar com API Protheus")
        raise
    except requests.exceptions.HTTPError as e:
        logger.error(f"❌ Erro HTTP ao buscar dados: {e.response.status_code}")
        raise
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Erro de conexão com API Protheus: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"❌ Erro inesperado ao buscar dados: {str(e)}")
        raise


def flatten_hierarchy(data: List[Dict]) -> Tuple[List[Dict], List[Dict], List[Dict], List[Dict]]:
    """
    Achata estrutura hierárquica JSON em 4 listas planas (uma por tabela).

    Estrutura de entrada:
    [
      {
        "bm_grupo": "0001",
        "bm_desc": "MEDICAMENTOS",
        "categoria": [
          {
            "zd_xcod": "0001",
            "zd_xdesc": "AGENER",
            "subcategoria": [
              {
                "ze_xcod": "0005",
                "ze_xdesc": "EQUINOS",
                "segmento": [
                  {"zf_xcod": "580068", "zf_xdesc": "ANESTESICO"}
                ]
              }
            ]
          }
        ]
      }
    ]

    Args:
        data: Lista de grupos (JSON da API Protheus)

    Returns:
        Tuple com 4 listas: (grupos, categorias, subcategorias, segmentos)
    """
    logger.info("🔄 Achatando hierarquia JSON...")

    grupos = []
    categorias = []
    subcategorias = []
    segmentos = []

    for grupo in data:
        # Extrair grupo
        grupos.append({
            "bm_grupo": grupo.get("bm_grupo"),
            "bm_desc": grupo.get("bm_desc")
        })

        # Extrair categorias
        for cat in grupo.get("categoria", []):
            categorias.append({
                "zd_xcod": cat.get("zd_xcod"),
                "zd_xdesc": cat.get("zd_xdesc")
            })

            # Extrair subcategorias
            for sub in cat.get("subcategoria", []):
                subcategorias.append({
                    "ze_xcod": sub.get("ze_xcod"),
                    "ze_xdesc": sub.get("ze_xdesc")
                })

                # Extrair segmentos
                for seg in sub.get("segmento", []):
                    segmentos.append({
                        "zf_xcod": seg.get("zf_xcod"),
                        "zf_xdesc": seg.get("zf_xdesc")
                    })

    logger.info(f"✅ Achatamento concluído:")
    logger.info(f"   - Grupos: {len(grupos)}")
    logger.info(f"   - Categorias: {len(categorias)}")
    logger.info(f"   - Subcategorias: {len(subcategorias)}")
    logger.info(f"   - Segmentos: {len(segmentos)}")

    return grupos, categorias, subcategorias, segmentos


def sync_table(
    db: Session,
    table_name: str,
    api_records: List[Dict],
    code_field: str,
    desc_field: str
) -> Dict[str, int]:
    """
    Sincroniza uma tabela com dados da API (UPDATE + INSERT + DELETE soft).

    Lógica:
    1. INSERT: Registros novos na API mas não no banco
    2. UPDATE: Registros existentes com descrição diferente
    3. DELETE (soft): Registros no banco mas não na API (is_active=false)
    4. UNCHANGED: Registros iguais em ambos

    Args:
        db: Sessão do SQLAlchemy
        table_name: Nome da tabela (ex: "sbm010")
        api_records: Lista de registros da API
        code_field: Nome do campo código (ex: "bm_grupo")
        desc_field: Nome do campo descrição (ex: "bm_desc")

    Returns:
        Dict com estatísticas: {inserted, updated, deleted, unchanged, total_api, total_db_after}
    """
    # ✅ SEGURANÇA v2.19.13: Validar tabela e campos para prevenir SQL Injection
    if table_name not in VALID_SYNC_TABLES:
        raise ValueError(f"Tabela inválida para sincronização: {table_name}")

    valid_table = VALID_SYNC_TABLES[table_name]
    if code_field != valid_table["code_field"]:
        raise ValueError(f"Campo código inválido para tabela {table_name}: {code_field}")
    if desc_field != valid_table["desc_field"]:
        raise ValueError(f"Campo descrição inválido para tabela {table_name}: {desc_field}")

    filial_field = f"{valid_table['filial_prefix']}_filial"

    logger.info(f"🔄 Sincronizando tabela inventario.{table_name}...")

    stats = {
        "inserted": 0,
        "updated": 0,
        "deleted": 0,
        "unchanged": 0,
        "total_api": len(api_records),
        "total_db_after": 0
    }

    try:
        # 1. Buscar registros existentes no banco
        # ✅ SEGURANÇA: Usando valores validados do dicionário de tabelas válidas
        query = text(f"""
            SELECT {code_field}, {desc_field}, is_active
            FROM inventario.{table_name}
        """)
        existing = db.execute(query).fetchall()

        # Criar dicionários para comparação rápida
        existing_dict = {row[0]: {"desc": row[1], "is_active": row[2]} for row in existing}
        api_dict = {rec[code_field]: rec[desc_field] for rec in api_records}

        logger.info(f"   - Registros no banco: {len(existing_dict)}")
        logger.info(f"   - Registros na API: {len(api_dict)}")

        # 2. INSERT: Novos na API mas não no banco
        new_codes = set(api_dict.keys()) - set(existing_dict.keys())
        for code in new_codes:
            # ✅ SEGURANÇA v2.19.13: Usar filial_field validado
            insert_query = text(f"""
                INSERT INTO inventario.{table_name}
                ({code_field}, {desc_field}, {filial_field}, is_active, created_at)
                VALUES (:code, :desc, '', true, NOW())
            """)
            db.execute(insert_query, {"code": code, "desc": api_dict[code]})
            stats["inserted"] += 1

        # 3. UPDATE: Existem em ambos (atualizar descrição se mudou ou reativar se inativo)
        common_codes = set(existing_dict.keys()) & set(api_dict.keys())
        for code in common_codes:
            old_desc = existing_dict[code]["desc"]
            new_desc = api_dict[code]
            is_active = existing_dict[code]["is_active"]

            # Atualizar se descrição mudou OU se estava inativo
            if old_desc != new_desc or not is_active:
                update_query = text(f"""
                    UPDATE inventario.{table_name}
                    SET {desc_field} = :desc, is_active = true, updated_at = NOW()
                    WHERE {code_field} = :code
                """)
                db.execute(update_query, {"code": code, "desc": new_desc})
                stats["updated"] += 1
            else:
                stats["unchanged"] += 1

        # 4. DELETE (soft): Existem no banco mas não na API
        orphan_codes = set(existing_dict.keys()) - set(api_dict.keys())
        for code in orphan_codes:
            # Apenas marcar como inativo se ainda estiver ativo
            if existing_dict[code]["is_active"]:
                delete_query = text(f"""
                    UPDATE inventario.{table_name}
                    SET is_active = false, updated_at = NOW()
                    WHERE {code_field} = :code
                """)
                db.execute(delete_query, {"code": code})
                stats["deleted"] += 1

        # Commit transação
        db.commit()

        # Calcular total no banco após sincronização
        stats["total_db_after"] = stats["inserted"] + stats["updated"] + stats["unchanged"]

        logger.info(f"✅ Tabela {table_name} sincronizada:")
        logger.info(f"   - Inseridos: {stats['inserted']}")
        logger.info(f"   - Atualizados: {stats['updated']}")
        logger.info(f"   - Removidos: {stats['deleted']}")
        logger.info(f"   - Inalterados: {stats['unchanged']}")

        return stats

    except Exception as e:
        logger.error(f"❌ Erro ao sincronizar tabela {table_name}: {str(e)}")
        db.rollback()
        raise


def sync_szb010(db: Session, armazens: List[Dict]) -> Dict[str, int]:
    """
    Sincroniza tabela SZB010 (Armazéns) com chave composta (zb_filial + zb_xlocal).

    v2.18.4: Nova função para sincronizar armazéns da API Protheus.

    Args:
        db: Sessão do SQLAlchemy
        armazens: Lista de armazéns da API [{zb_filial, zb_xlocal, zb_xdesc}, ...]

    Returns:
        Dict com estatísticas: {inserted, updated, deleted, unchanged, total_api, total_db_after}
    """
    logger.info(f"🔄 Sincronizando tabela inventario.szb010 (Armazéns)...")

    stats = {
        "inserted": 0,
        "updated": 0,
        "deleted": 0,
        "unchanged": 0,
        "total_api": len(armazens),
        "total_db_after": 0
    }

    try:
        # 1. Buscar registros existentes no banco (chave composta)
        query = text("""
            SELECT zb_filial, zb_xlocal, zb_xdesc
            FROM inventario.szb010
        """)
        existing = db.execute(query).fetchall()

        # Criar dicionários para comparação (chave = filial|local)
        existing_dict = {f"{row[0]}|{row[1]}": row[2] for row in existing}
        api_dict = {f"{rec['zb_filial']}|{rec['zb_xlocal']}": rec['zb_xdesc'] for rec in armazens}

        logger.info(f"   - Registros no banco: {len(existing_dict)}")
        logger.info(f"   - Registros na API: {len(api_dict)}")

        # 2. INSERT: Novos na API mas não no banco
        new_keys = set(api_dict.keys()) - set(existing_dict.keys())
        for key in new_keys:
            filial, local = key.split("|")
            insert_query = text("""
                INSERT INTO inventario.szb010 (zb_filial, zb_xlocal, zb_xdesc)
                VALUES (:filial, :local, :desc)
                ON CONFLICT (zb_filial, zb_xlocal) DO NOTHING
            """)
            db.execute(insert_query, {"filial": filial, "local": local, "desc": api_dict[key]})
            stats["inserted"] += 1

        # 3. UPDATE: Existem em ambos (atualizar descrição se mudou)
        common_keys = set(existing_dict.keys()) & set(api_dict.keys())
        for key in common_keys:
            old_desc = existing_dict[key]
            new_desc = api_dict[key]

            if old_desc != new_desc:
                filial, local = key.split("|")
                update_query = text("""
                    UPDATE inventario.szb010
                    SET zb_xdesc = :desc
                    WHERE zb_filial = :filial AND zb_xlocal = :local
                """)
                db.execute(update_query, {"filial": filial, "local": local, "desc": new_desc})
                stats["updated"] += 1
            else:
                stats["unchanged"] += 1

        # 4. DELETE: Registros no banco mas não na API (remover fisicamente ou manter?)
        # Por segurança, apenas contamos os órfãos mas não deletamos
        orphan_keys = set(existing_dict.keys()) - set(api_dict.keys())
        stats["deleted"] = len(orphan_keys)
        if orphan_keys:
            logger.warning(f"   ⚠️ {len(orphan_keys)} armazéns órfãos encontrados (não deletados)")

        # Commit transação
        db.commit()

        stats["total_db_after"] = stats["inserted"] + stats["updated"] + stats["unchanged"]

        logger.info(f"✅ Tabela szb010 sincronizada:")
        logger.info(f"   - Inseridos: {stats['inserted']}")
        logger.info(f"   - Atualizados: {stats['updated']}")
        logger.info(f"   - Órfãos: {stats['deleted']}")
        logger.info(f"   - Inalterados: {stats['unchanged']}")

        return stats

    except Exception as e:
        logger.error(f"❌ Erro ao sincronizar tabela szb010: {str(e)}")
        db.rollback()
        raise


@router.post("/hierarchy")
async def sync_protheus_hierarchy(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Sincroniza hierarquia mercadológica completa com API Protheus.

    Operações:
    1. Busca dados da API Protheus
    2. Achata estrutura hierárquica
    3. Sincroniza 4 tabelas (SBM010, SZD010, SZE010, SZF010)
    4. Retorna estatísticas detalhadas

    Permissões:
    - Apenas ADMIN e SUPERVISOR podem executar

    Returns:
        {
          "success": true,
          "timestamp": "2025-10-24T...",
          "duration_seconds": 3.5,
          "tables": {
            "SBM010": {inserted, updated, deleted, unchanged, total_api, total_db_after},
            ...
          },
          "totals": {inserted, updated, deleted, unchanged}
        }
    """
    # ✅ RBAC: Apenas ADMIN e SUPERVISOR
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        logger.warning(f"⚠️ Usuário {current_user.username} (role: {current_user.role}) tentou executar sincronização")
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas ADMIN e SUPERVISOR podem executar sincronização."
        )

    logger.info(f"🔄 Sincronização iniciada por {current_user.username} (role: {current_user.role})")
    start_time = datetime.now()

    try:
        # 1. Buscar dados da API Protheus (grupos + armazéns)
        protheus_data = fetch_protheus_hierarchy()
        grupos_data = protheus_data.get("grupos", [])
        armazens_data = protheus_data.get("armazens", [])

        # 2. Achatar hierarquia mercadológica
        grupos, categorias, subcategorias, segmentos = flatten_hierarchy(grupos_data)

        # 3. Sincronizar cada tabela (hierarquia + armazéns)
        logger.info("🔄 Iniciando sincronização das 5 tabelas...")

        sbm_stats = sync_table(db, "sbm010", grupos, "bm_grupo", "bm_desc")
        szd_stats = sync_table(db, "szd010", categorias, "zd_xcod", "zd_xdesc")
        sze_stats = sync_table(db, "sze010", subcategorias, "ze_xcod", "ze_xdesc")
        szf_stats = sync_table(db, "szf010", segmentos, "zf_xcod", "zf_xdesc")

        # v2.18.4: Sincronizar armazéns (SZB010)
        szb_stats = sync_szb010(db, armazens_data) if armazens_data else {
            "inserted": 0, "updated": 0, "deleted": 0, "unchanged": 0,
            "total_api": 0, "total_db_after": 0
        }

        # 4. Calcular totais
        totals = {
            "inserted": sbm_stats["inserted"] + szd_stats["inserted"] +
                       sze_stats["inserted"] + szf_stats["inserted"] + szb_stats["inserted"],
            "updated": sbm_stats["updated"] + szd_stats["updated"] +
                      sze_stats["updated"] + szf_stats["updated"] + szb_stats["updated"],
            "deleted": sbm_stats["deleted"] + szd_stats["deleted"] +
                      sze_stats["deleted"] + szf_stats["deleted"] + szb_stats["deleted"],
            "unchanged": sbm_stats["unchanged"] + szd_stats["unchanged"] +
                        sze_stats["unchanged"] + szf_stats["unchanged"] + szb_stats["unchanged"]
        }

        duration = (datetime.now() - start_time).total_seconds()

        logger.info(f"✅ Sincronização concluída em {duration:.2f}s")
        logger.info(f"   📊 Totais: {totals}")

        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": round(duration, 2),
            "tables": {
                "SBM010": sbm_stats,
                "SZD010": szd_stats,
                "SZE010": sze_stats,
                "SZF010": szf_stats,
                "SZB010": szb_stats  # v2.18.4: Armazéns
            },
            "totals": totals,
            "user": {
                "username": current_user.username,
                "role": current_user.role
            }
        }

    except requests.exceptions.Timeout:
        logger.error("❌ Timeout ao conectar com API Protheus")
        raise HTTPException(
            status_code=504,
            detail="Timeout ao conectar com API Protheus. Tente novamente em alguns instantes."
        )
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if hasattr(e, 'response') else 502
        logger.error(f"❌ Erro HTTP {status_code} ao buscar dados da API")
        raise HTTPException(
            status_code=status_code,
            detail=f"Erro ao buscar dados do Protheus (HTTP {status_code})"
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Erro de conexão: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail=safe_error_response(e, "ao conectar com API Protheus")
        )
    except Exception as e:
        logger.error(f"❌ Erro inesperado na sincronização: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "interno ao sincronizar dados")
        )
