"""
Endpoints para Gestão de Lojas/Filiais
ATUALIZADO: Todos os endpoints de stores movidos do main.py
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
import logging
import uuid
from datetime import datetime
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import APIResponse
from app.models.models import Store, User

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", summary="Listar lojas")
async def list_stores(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Página"),
    size: int = Query(50, ge=1, le=200, description="Itens por página")
):
    """
    Listar lojas com paginação baseado no role do usuário

    **Regras de Acesso:**
    - ADMIN: Vê todas as lojas
    - SUPERVISOR/OPERATOR: Vê apenas sua loja
    """
    try:
        # LÓGICA DE PERMISSÃO POR ROLE:
        # ADMIN: Vê todas as lojas
        # SUPERVISOR/OPERATOR: Vê apenas sua loja

        if current_user.role == "ADMIN":
            # Admin vê todas as lojas ativas
            query = db.query(Store).filter(Store.is_active == True)
        else:
            # Supervisor/Operator vê apenas sua loja
            query = db.query(Store).filter(
                Store.id == current_user.store_id,
                Store.is_active == True
            )

        # ✅ OTIMIZAÇÃO v2.19.14: Adicionar paginação
        total = query.count()

        # Ordenar por nome
        query = query.order_by(Store.name)

        # Aplicar paginação
        offset = (page - 1) * size
        stores = query.offset(offset).limit(size).all()

        pages = (total + size - 1) // size

        return {
            "success": True,
            "message": f"Encontradas {total} lojas",
            "data": [
                {
                    "id": str(store.id),
                    "code": store.code,
                    "name": store.name,
                    "description": store.description,
                    "address": store.address,
                    "phone": store.phone,
                    "email": store.email,
                    "is_active": store.is_active
                }
                for store in stores
            ],
            "pagination": {
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }
        }
    except Exception as e:
        logger.error(f"❌ Erro ao listar lojas: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@router.get("/{store_id}", summary="Obter loja por ID")
async def get_store_info(
    store_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter informações de uma loja específica"""
    try:
        # Buscar loja
        store = db.query(Store).filter(Store.id == store_id).first()
        
        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Store not found"
            )
        
        # Verificar se o usuário pode acessar esta loja
        if current_user.role != "ADMIN" and current_user.store_id != store.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this store"
            )
        
        return {
            "id": str(store.id),
            "code": store.code,
            "name": store.name,
            "description": store.description,
            "address": store.address,
            "phone": store.phone,
            "email": store.email,
            "is_active": store.is_active
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar loja: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching store")
        )

@router.post("/", summary="Criar nova loja")
async def create_store(
    store_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Criar nova loja (apenas ADMIN)"""
    try:
        # Verificar se usuário é admin
        if current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem criar lojas"
            )
        
        # Verificar se código da loja já existe
        existing_store = db.query(Store).filter(Store.code == store_data.get('code')).first()
        if existing_store:
            if existing_store.is_active:
                raise HTTPException(status_code=400, detail="Código da loja já existe e está ativo")
            else:
                # Reativar loja existente inativa
                existing_store.is_active = True
                existing_store.name = store_data.get('name')
                existing_store.description = store_data.get('description')
                existing_store.address = store_data.get('address')
                existing_store.phone = store_data.get('phone')
                existing_store.email = store_data.get('email')
                existing_store.updated_at = datetime.now()
                
                db.commit()
                db.refresh(existing_store)
                
                logger.info(f"✅ Loja reativada: {existing_store.code}")
                
                return {
                    "id": str(existing_store.id),
                    "code": existing_store.code,
                    "name": existing_store.name,
                    "description": existing_store.description,
                    "address": existing_store.address,
                    "phone": existing_store.phone,
                    "email": existing_store.email,
                    "is_active": existing_store.is_active,
                    "created_at": existing_store.created_at.isoformat() if existing_store.created_at else None,
                    "updated_at": existing_store.updated_at.isoformat() if existing_store.updated_at else None,
                    "message": "Loja reativada com sucesso! (Código já existia como inativo)"
                }
        
        # Criar nova loja
        new_store = Store(
            id=uuid.uuid4(),
            code=store_data.get('code'),
            name=store_data.get('name'),
            description=store_data.get('description'),
            address=store_data.get('address'),
            phone=store_data.get('phone'),
            email=store_data.get('email'),
            is_active=store_data.get('is_active', True),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(new_store)
        db.commit()
        db.refresh(new_store)
        
        logger.info(f"✅ Loja {new_store.name} criada com sucesso")
        
        return {
            "success": True,
            "message": f"Loja {new_store.name} criada com sucesso",
            "data": {
                "id": str(new_store.id),
                "code": new_store.code,
                "name": new_store.name,
                "description": new_store.description,
                "address": new_store.address,
                "phone": new_store.phone,
                "email": new_store.email,
                "is_active": new_store.is_active
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao criar loja: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@router.put("/{store_id}", summary="Atualizar loja")
async def update_store(
    store_id: str,
    store_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualizar loja existente (apenas ADMIN)"""
    try:
        logger.info(f"🔄 Atualizando loja {store_id} com dados: {store_data}")
        
        # Verificar se usuário é admin
        if current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem atualizar lojas"
            )
        
        # Buscar loja
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise HTTPException(status_code=404, detail="Loja não encontrada")
        
        # Verificar se código da loja já existe em outra loja
        if 'code' in store_data and store_data['code'] != store.code:
            existing_store = db.query(Store).filter(
                Store.code == store_data['code'],
                Store.id != uuid.UUID(store_id)
            ).first()
            if existing_store:
                raise HTTPException(status_code=400, detail="Código da loja já existe")
        
        # Atualizar campos
        if 'code' in store_data:
            store.code = store_data['code']
        if 'name' in store_data:
            store.name = store_data['name']
        if 'description' in store_data:
            store.description = store_data['description']
        if 'address' in store_data:
            store.address = store_data['address']
        if 'phone' in store_data:
            store.phone = store_data['phone']
        if 'email' in store_data:
            store.email = store_data['email']
        if 'is_active' in store_data:
            store.is_active = store_data['is_active']
            
        store.updated_at = datetime.now()
        
        db.commit()
        db.refresh(store)
        
        logger.info(f"✅ Loja {store.name} atualizada com sucesso")
        
        return {
            "success": True,
            "message": f"Loja {store.name} atualizada com sucesso",
            "data": {
                "id": str(store.id),
                "code": store.code,
                "name": store.name,
                "description": store.description,
                "address": store.address,
                "phone": store.phone,
                "email": store.email,
                "is_active": store.is_active
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao atualizar loja: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@router.delete("/{store_id}", summary="Excluir loja")
async def delete_store(
    store_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Excluir loja (soft delete - apenas desativa)"""
    try:
        logger.info(f"🗑️ Excluindo (desativando) loja {store_id}")
        
        # Verificar se usuário é admin
        if current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem excluir lojas"
            )
        
        # Buscar loja
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise HTTPException(status_code=404, detail="Loja não encontrada")
        
        # Soft delete - apenas desativar
        store.is_active = False
        store.updated_at = datetime.now()
        
        db.commit()
        
        logger.info(f"✅ Loja desativada: {store.code}")
        
        return {
            "success": True,
            "message": f"Loja {store.code} foi desativada com sucesso",
            "detail": "A loja pode ser reativada criando uma nova loja com o mesmo código"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao excluir loja: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao excluir loja"))