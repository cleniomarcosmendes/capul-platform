"""
API de Armazéns/Locais
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.models import Warehouse, Store
from app.schemas.warehouse import (
    WarehouseCreate, 
    WarehouseUpdate, 
    WarehouseResponse,
    WarehouseSimple
)
from app.api.auth import get_current_user

import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/warehouses", tags=["warehouses"])

@router.get("/", response_model=List[WarehouseResponse])
def list_warehouses(
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Lista todos os armazéns de uma loja"""
    query = db.query(Warehouse)
    
    # Se store_id fornecido, filtrar por ele
    if store_id:
        query = query.filter(Warehouse.store_id == store_id)
    # Senão, usar store do usuário atual
    elif current_user.store_id:
        query = query.filter(Warehouse.store_id == current_user.store_id)

    query = query.filter(Warehouse.is_active == True)
    warehouses = query.order_by(Warehouse.code).all()

    return warehouses

@router.get("/simple", response_model=List[WarehouseSimple])
def list_warehouses_simple(
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista simplificada de armazéns (código e nome). Alimenta o seletor de
    armazém em Importar Produtos, Criar Inventário e a listagem.

    ⚠️ DUAS FONTES, por ordem de preferência (07/08/2026):

      1. `inventario.warehouses` — a tabela própria do módulo, com loja e
         `is_active`. É o comportamento histórico e continua sendo o primeiro.
      2. `inventario.szb010` — o espelho do Protheus, quando (1) está vazia.

    **Por que o fallback existe:** a tela de Importar Produtos diz, quando a
    lista vem vazia, *"Sincronize a hierarquia primeiro"*. Só que sincronizar a
    hierarquia popula a **szb010**, e nada liga a szb010 na `warehouses` — quem
    faz isso é outro endpoint (`POST /import/szb010`), que ainda depende de
    `inventario.stores` estar preenchida. Resultado: o usuário seguia a
    instrução da tela e a lista continuava vazia.

    Há ainda uma costura do UNIFIED_AUTH por baixo: `Warehouse.store_id` aponta
    para `inventario.stores`, mas o `store_id` do usuário logado vem de
    `core.filiais`. Por isso o fallback casa por **CÓDIGO da filial**
    (`store_code`, ex. "01"), que é o que a szb010 guarda em `zb_filial` — e não
    por UUID.

    Preferir (1) mantém intacto quem já tem a tabela populada; o fallback só
    entra onde hoje não apareceria nada.
    """
    query = db.query(Warehouse.code, Warehouse.name)

    # Se store_id fornecido, filtrar por ele
    if store_id:
        query = query.filter(Warehouse.store_id == store_id)
    # Senão, usar store do usuário atual
    elif current_user.store_id:
        query = query.filter(Warehouse.store_id == current_user.store_id)

    query = query.filter(Warehouse.is_active == True)
    warehouses = query.order_by(Warehouse.code).all()

    if warehouses:
        return [{"code": w.code, "name": w.name} for w in warehouses]

    # --- Fallback: espelho do Protheus (szb010) ---
    from sqlalchemy import text

    filial = getattr(current_user, "store_code", None)
    sql = """
        SELECT zb_xlocal AS code, zb_xdesc AS name
        FROM inventario.szb010
        {filtro}
        ORDER BY zb_xlocal
    """.format(filtro="WHERE zb_filial = :filial" if filial else "")

    linhas = db.execute(text(sql), {"filial": filial} if filial else {}).fetchall()
    if linhas:
        logger.info(
            f"/warehouses/simple: `warehouses` vazia — usando szb010 "
            f"(filial={filial or 'todas'}, {len(linhas)} armazéns)."
        )
    return [{"code": (r[0] or "").strip(), "name": (r[1] or "").strip()} for r in linhas]

@router.post("/", response_model=WarehouseResponse)
def create_warehouse(
    warehouse: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Cria um novo armazém"""
    # Verificar se usuário é admin
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem criar armazéns"
        )
    
    # Verificar se store existe
    store = db.query(Store).filter(Store.id == warehouse.store_id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loja não encontrada"
        )
    
    # Verificar se código já existe para a loja
    existing = db.query(Warehouse).filter(
        Warehouse.code == warehouse.code,
        Warehouse.store_id == warehouse.store_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Armazém com código {warehouse.code} já existe para esta loja"
        )
    
    # Criar novo armazém
    db_warehouse = Warehouse(**warehouse.dict())
    db.add(db_warehouse)
    db.commit()
    db.refresh(db_warehouse)
    
    return db_warehouse

@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(
    warehouse_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Obtém detalhes de um armazém"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Armazém não encontrado"
        )
    
    return warehouse

@router.put("/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(
    warehouse_id: UUID,
    warehouse_update: WarehouseUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza um armazém"""
    # Verificar se usuário é admin
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem atualizar armazéns"
        )
    
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Armazém não encontrado"
        )
    
    # Atualizar campos
    update_data = warehouse_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(warehouse, field, value)
    
    db.commit()
    db.refresh(warehouse)
    
    return warehouse

@router.delete("/{warehouse_id}")
def delete_warehouse(
    warehouse_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Desativa um armazém (soft delete)"""
    # Verificar se usuário é admin
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem deletar armazéns"
        )
    
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Armazém não encontrado"
        )
    
    warehouse.is_active = False
    db.commit()
    
    return {"message": "Armazém desativado com sucesso"}