"""
API de Importação - SZB010 (Armazéns/Locais do Protheus)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
import uuid
from datetime import datetime
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.models.models import SZB010, Warehouse, Store
from app.schemas.szb010_schema import (
    SZB010ImportRequest,
    SZB010ImportResponse,
    SZB010ListResponse,
    SZB010Response
)
from app.api.auth import get_current_user

router = APIRouter(prefix="/import", tags=["Importação"])


@router.post("/szb010", response_model=SZB010ImportResponse)
async def import_szb010(
    request: SZB010ImportRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Importa dados da tabela SZB010 (Armazéns) do Protheus

    - Valida dados recebidos
    - Insere/Atualiza na tabela szb010
    - Cria/Atualiza registros em warehouses
    - Filtra por filial do usuário logado
    """

    # Verificar se usuário é ADMIN
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem importar armazéns"
        )

    total_received = len(request.data)
    total_inserted = 0
    total_updated = 0
    total_errors = 0
    warehouses_created = 0
    errors = []

    try:
        for item in request.data:
            try:
                # ========================================
                # 1. INSERIR/ATUALIZAR SZB010
                # ========================================
                existing_szb = db.query(SZB010).filter(
                    and_(
                        SZB010.zb_filial == item.zb_filial,
                        SZB010.zb_xlocal == item.zb_xlocal
                    )
                ).first()

                if existing_szb:
                    # Atualizar registro existente
                    existing_szb.zb_xdesc = item.zb_xdesc
                    existing_szb.updated_at = datetime.now()
                    total_updated += 1
                else:
                    # Inserir novo registro
                    new_szb = SZB010(
                        zb_filial=item.zb_filial,
                        zb_xlocal=item.zb_xlocal,
                        zb_xdesc=item.zb_xdesc
                    )
                    db.add(new_szb)
                    total_inserted += 1

                # ========================================
                # 2. BUSCAR STORE_ID POR ZB_FILIAL
                # ========================================
                store = db.query(Store).filter(
                    Store.code == item.zb_filial
                ).first()

                if not store:
                    errors.append(f"Loja não encontrada para filial {item.zb_filial}")
                    total_errors += 1
                    continue

                # ========================================
                # 3. CRIAR/ATUALIZAR WAREHOUSE
                # ========================================
                existing_warehouse = db.query(Warehouse).filter(
                    and_(
                        Warehouse.code == item.zb_xlocal,
                        Warehouse.store_id == store.id
                    )
                ).first()

                if existing_warehouse:
                    # Atualizar warehouse existente
                    existing_warehouse.name = item.zb_xdesc
                    existing_warehouse.description = f"Importado de SZB010 - {item.zb_xdesc}"
                else:
                    # Criar novo warehouse
                    new_warehouse = Warehouse(
                        id=uuid.uuid4(),
                        code=item.zb_xlocal,
                        name=item.zb_xdesc,
                        description=f"Importado de SZB010 - {item.zb_xdesc}",
                        store_id=store.id,
                        is_active=True
                    )
                    db.add(new_warehouse)
                    warehouses_created += 1

            except Exception as e:
                total_errors += 1
                errors.append(f"Erro ao processar {item.zb_filial}/{item.zb_xlocal}: {str(e)}")
                continue

        # Commit todas as alterações
        db.commit()

        return SZB010ImportResponse(
            success=True if total_errors == 0 else False,
            message=f"Importação concluída: {total_inserted} inseridos, {total_updated} atualizados, {total_errors} erros",
            total_received=total_received,
            total_inserted=total_inserted,
            total_updated=total_updated,
            total_errors=total_errors,
            warehouses_created=warehouses_created,
            errors=errors if errors else None
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao importar SZB010")
        )


@router.get("/szb010", response_model=SZB010ListResponse)
async def list_szb010(
    filial: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista armazéns da tabela SZB010

    - Se filial informada: filtra por ela
    - Senão: usa filial da loja do usuário logado
    """

    query = db.query(SZB010)

    # Filtrar por filial
    if filial:
        query = query.filter(SZB010.zb_filial == filial)
    elif current_user.store_id:
        # Buscar código da loja do usuário
        store = db.query(Store).filter(Store.id == current_user.store_id).first()
        if store:
            query = query.filter(SZB010.zb_filial == store.code)

    warehouses = query.order_by(SZB010.zb_filial, SZB010.zb_xlocal).all()

    return SZB010ListResponse(
        total=len(warehouses),
        data=warehouses
    )
