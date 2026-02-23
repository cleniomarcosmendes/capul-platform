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
    """Lista simplificada de armazéns (código e nome)"""
    query = db.query(Warehouse.code, Warehouse.name)

    # Se store_id fornecido, filtrar por ele
    if store_id:
        query = query.filter(Warehouse.store_id == store_id)
    # Senão, usar store do usuário atual
    elif current_user.store_id:
        query = query.filter(Warehouse.store_id == current_user.store_id)
    
    query = query.filter(Warehouse.is_active == True)
    warehouses = query.order_by(Warehouse.code).all()
    
    return [{"code": w.code, "name": w.name} for w in warehouses]

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