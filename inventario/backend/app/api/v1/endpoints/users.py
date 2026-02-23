"""
Router simplificado para testes - sem schemas problemáticos
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func
import logging
from app.core.exceptions import safe_error_response

from app.core.database import get_db
# from app.core.security import get_current_active_user
from app.models.models import User as UserModel, Store
from app.core.security import hash_password
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/users")
async def list_users_simple(
    db: Session = Depends(get_db),
    include_inactive: bool = False,
    page: int = Query(1, ge=1, description="Página"),
    size: int = Query(50, ge=1, le=200, description="Itens por página")
):
    """Lista usuários com paginação (por padrão retorna apenas ativos)"""
    try:
        # ✅ OTIMIZAÇÃO v2.19.13: Usar LEFT JOIN ao invés de N+1 queries
        # Query com JOIN para buscar usuários e lojas em uma única query
        query = db.query(
            UserModel,
            Store.name.label('store_name')
        ).outerjoin(
            Store, UserModel.store_id == Store.id
        )

        # Por padrão, retorna apenas usuários ativos
        if not include_inactive:
            query = query.filter(UserModel.is_active == True)

        # ✅ OTIMIZAÇÃO v2.19.14: Adicionar paginação
        # Contar total antes de paginar
        total = query.count()

        # Ordenar por nome
        query = query.order_by(UserModel.full_name)

        # Aplicar paginação
        offset = (page - 1) * size
        results = query.offset(offset).limit(size).all()

        # Montar resposta
        users_data = [
            {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "store_id": str(user.store_id) if user.store_id else None,
                "store_name": store_name,
                "is_active": user.is_active
            }
            for user, store_name in results
        ]

        pages = (total + size - 1) // size

        return {
            "success": True,
            "message": f"Encontrados {total} usuários",
            "data": users_data,
            "pagination": {
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }
        }
    except Exception as e:
        logger.error(f"Erro ao listar usuários: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@router.post("/users")
async def create_user_simple(
    user_data: dict,
    db: Session = Depends(get_db)
):
    """Cria usuário - versão simplificada"""
    try:
        logger.info(f"🔨 Criando usuário: {user_data}")
        
        # Verificar se usuário já existe
        existing_user = db.query(UserModel).filter(UserModel.username == user_data['username']).first()
        if existing_user:
            if existing_user.is_active:
                raise HTTPException(status_code=400, detail="Usuário já existe e está ativo")
            else:
                # Reativar usuário existente inativo
                existing_user.is_active = True
                existing_user.full_name = user_data.get('full_name', existing_user.full_name)
                existing_user.email = user_data.get('email', existing_user.email)
                existing_user.role = user_data.get('role', existing_user.role)
                
                # Atualizar senha se fornecida
                if user_data.get('password'):
                    existing_user.hashed_password = hashlib.sha256(user_data['password'].encode()).hexdigest()
                
                # Atualizar loja se aplicável
                if existing_user.role != 'ADMIN':
                    existing_user.store_id = user_data.get('store_id')
                else:
                    existing_user.store_id = None
                    
                existing_user.updated_at = datetime.now()
                
                db.commit()
                db.refresh(existing_user)
                
                logger.info(f"✅ Usuário reativado: {existing_user.username}")
                
                return {
                    "id": str(existing_user.id),
                    "username": existing_user.username,
                    "full_name": existing_user.full_name,
                    "email": existing_user.email,
                    "role": existing_user.role,
                    "store_id": str(existing_user.store_id) if existing_user.store_id else None,
                    "is_active": existing_user.is_active,
                    "message": "Usuário reativado com sucesso! (Username já existia como inativo)"
                }
        
        # Validar loja obrigatória para usuários não-admin
        user_role = user_data.get('role', 'OPERATOR')
        store = None
        
        # Admin não deve ter loja
        if user_role == 'ADMIN':
            user_data['store_id'] = None
        else:
            # Outros roles precisam de loja
            if not user_data.get('store_id'):
                raise HTTPException(status_code=400, detail="Loja é obrigatória para usuários não-administradores")
            
            store = db.query(Store).filter(Store.id == user_data['store_id']).first()
            if not store:
                raise HTTPException(status_code=400, detail="Loja não encontrada")
        
        # Criar usuário
        new_user = UserModel(
            id=uuid.uuid4(),
            username=user_data['username'],
            full_name=user_data.get('full_name', ''),
            email=user_data.get('email', ''),
            password_hash=hash_password(user_data['password']),
            role=user_data.get('role', 'OPERATOR'),
            store_id=user_data.get('store_id'),
            is_active=user_data.get('is_active', True),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(new_user)
        db.flush()  # Flush para obter o ID do usuário

        # Criar registros na tabela user_stores para multi-filial
        if user_role != 'ADMIN':
            store_ids = user_data.get('store_ids', [user_data.get('store_id')])
            default_store_id = user_data.get('default_store_id', user_data.get('store_id'))

            logger.info(f"📦 Salvando lojas para usuário {new_user.username}: {store_ids}, padrão: {default_store_id}")

            for store_id in store_ids:
                user_store = db.execute(
                    text("""
                        INSERT INTO inventario.user_stores (id, user_id, store_id, is_default, created_at, created_by)
                        VALUES (:id, :user_id, :store_id, :is_default, CURRENT_TIMESTAMP, :created_by)
                        ON CONFLICT (user_id, store_id) DO UPDATE
                        SET is_default = EXCLUDED.is_default
                        RETURNING id
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "user_id": str(new_user.id),
                        "store_id": store_id,
                        "is_default": (store_id == default_store_id),
                        "created_by": str(new_user.id)
                    }
                )

            logger.info(f"✅ {len(store_ids)} loja(s) atribuída(s) ao usuário {new_user.username}")

        db.commit()
        db.refresh(new_user)

        logger.info(f"✅ Usuário {new_user.username} criado com sucesso")

        return {
            "success": True,
            "message": f"Usuário {new_user.username} criado com sucesso",
            "data": {
                "id": str(new_user.id),
                "username": new_user.username,
                "full_name": new_user.full_name,
                "email": new_user.email,
                "role": new_user.role,
                "store_id": str(new_user.store_id) if new_user.store_id else None,
                "store_name": store.name if store else None,
                "is_active": new_user.is_active
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao criar usuário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@router.put("/users/{user_id}")
async def update_user_simple(
    user_id: str,
    user_data: dict,
    db: Session = Depends(get_db)
):
    """Atualiza usuário - versão simplificada"""
    try:
        # Verificar permissão - removido para teste
            
        # Buscar usuário
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Validar role e loja
        if 'role' in user_data:
            new_role = user_data['role']
            
            if new_role == 'ADMIN':
                # Admin não deve ter loja
                user_data['store_id'] = None
            else:
                # Outros roles precisam de loja
                new_store_id = user_data.get('store_id') if 'store_id' in user_data else user.store_id
                
                if not new_store_id:
                    raise HTTPException(status_code=400, detail="Loja é obrigatória para usuários não-administradores")
                
                # Verificar se loja existe
                if 'store_id' in user_data and user_data['store_id']:
                    store = db.query(Store).filter(Store.id == user_data['store_id']).first()
                    if not store:
                        raise HTTPException(status_code=400, detail="Loja não encontrada")
        elif 'store_id' in user_data and user_data['store_id']:
            # Se não está mudando role mas está mudando loja, verificar se existe
            store = db.query(Store).filter(Store.id == user_data['store_id']).first()
            if not store:
                raise HTTPException(status_code=400, detail="Loja não encontrada")
        
        # Atualizar campos
        if 'full_name' in user_data:
            user.full_name = user_data['full_name']
        if 'email' in user_data:
            user.email = user_data['email']
        if 'role' in user_data:
            user.role = user_data['role']
        if 'store_id' in user_data:
            user.store_id = user_data['store_id']
        if 'is_active' in user_data:
            user.is_active = user_data['is_active']
        if 'password' in user_data and user_data['password']:
            # Atualizar senha se fornecida
            user.password_hash = hash_password(user_data['password'])

        # Atualizar lojas do usuário (multi-filial)
        if 'store_ids' in user_data and user_data['role'] != 'ADMIN':
            store_ids = user_data['store_ids']
            default_store_id = user_data.get('default_store_id', user_data.get('store_id'))

            logger.info(f"📦 Atualizando lojas do usuário {user.username}: {store_ids}, padrão: {default_store_id}")

            # Remover lojas antigas
            db.execute(
                text("DELETE FROM inventario.user_stores WHERE user_id = :user_id"),
                {"user_id": str(user_id)}
            )

            # Adicionar novas lojas
            for store_id in store_ids:
                db.execute(
                    text("""
                        INSERT INTO inventario.user_stores (id, user_id, store_id, is_default, created_at, created_by)
                        VALUES (:id, :user_id, :store_id, :is_default, CURRENT_TIMESTAMP, :created_by)
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "user_id": str(user_id),
                        "store_id": store_id,
                        "is_default": (store_id == default_store_id),
                        "created_by": str(user_id)
                    }
                )

            # Atualizar store_id do usuário (compatibilidade)
            user.store_id = default_store_id

            logger.info(f"✅ {len(store_ids)} loja(s) atualizada(s) para o usuário {user.username}")

        db.commit()
        db.refresh(user)
        
        # Buscar informações da loja para retorno
        store = None
        if user.store_id:
            store = db.query(Store).filter(Store.id == user.store_id).first()
        
        return {
            "success": True,
            "message": f"Usuário {user.username} atualizado",
            "data": {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "store_id": str(user.store_id) if user.store_id else None,
                "store_name": store.name if store else None,
                "is_active": user.is_active
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao atualizar usuário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@router.delete("/users/{user_id}")
async def delete_user_simple(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Exclui usuário (soft delete) - versão simplificada"""
    try:
        logger.info(f"🗑️ Tentando excluir usuário: {user_id}")
        
        # Buscar usuário
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Verificar se é o próprio usuário admin (proteção básica)
        if user.username == 'admin' and user.role == 'ADMIN':
            raise HTTPException(status_code=400, detail="Não é possível excluir o usuário administrador principal")
        
        # Soft delete - apenas marcar como inativo (não remove do banco)
        user.is_active = False
        user.updated_at = datetime.now()

        db.commit()
        db.refresh(user)

        logger.info(f"✅ Usuário {user.username} excluído com sucesso (soft delete - marcado como inativo)")
        
        # Buscar informações da loja para retorno
        store = None
        if user.store_id:
            store = db.query(Store).filter(Store.id == user.store_id).first()
        
        return {
            "success": True,
            "message": f"Usuário {user.username} foi excluído com sucesso",
            "data": {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "store_id": str(user.store_id) if user.store_id else None,
                "store_name": store.name if store else None,
                "is_active": user.is_active
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao excluir usuário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

# =================================
# ENDPOINTS MULTI-FILIAL v2.12.0
# =================================

@router.get("/users/{user_id}/stores")
async def get_user_stores(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    Retorna todas as lojas que o usuário tem permissão de acessar

    **v2.12.0**: Sistema multi-filial - um usuário pode ter múltiplas lojas

    **Response:**
    ```json
    {
        "success": true,
        "data": [
            {
                "id": "uuid",
                "code": "01",
                "name": "Matriz",
                "is_default": true
            }
        ]
    }
    ```
    """
    try:
        # Import tardio para evitar circular import
        from app.models.models import User as UserModel, UserStore

        # Buscar usuário
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        # Buscar lojas do usuário
        user_stores = db.query(UserStore).filter(
            UserStore.user_id == user_id
        ).all()

        stores = []
        for us in user_stores:
            store = db.query(Store).filter(Store.id == us.store_id).first()
            if store:
                stores.append({
                    "id": str(store.id),
                    "code": store.code,
                    "name": store.name,
                    "is_default": us.is_default
                })

        logger.info(f"✅ Encontradas {len(stores)} lojas para usuário {user.username}")

        return {
            "success": True,
            "data": stores
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar lojas do usuário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))


@router.put("/users/{user_id}/stores")
async def update_user_stores(
    user_id: str,
    stores_data: dict,
    db: Session = Depends(get_db)
):
    """
    Atualiza as lojas que o usuário tem acesso

    **v2.12.0**: Sistema multi-filial - permite atribuir múltiplas lojas a um usuário

    **Payload:**
    ```json
    {
        "store_ids": ["uuid1", "uuid2", "uuid3"],
        "default_store_id": "uuid1"  // Opcional
    }
    ```

    **Regras:**
    - Usuários ADMIN não devem ter lojas atribuídas
    - Ao menos uma loja deve ser selecionada para não-ADMINs
    - Loja padrão deve estar na lista de lojas
    """
    try:
        # Import tardio para evitar circular import
        from app.models.models import User as UserModel, UserStore

        # Buscar usuário
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        # Se usuário é ADMIN, não deve ter lojas
        if user.role.value == "ADMIN":
            raise HTTPException(status_code=400, detail="Usuários ADMIN não devem ter lojas atribuídas")

        store_ids = stores_data.get("store_ids", [])
        default_store_id = stores_data.get("default_store_id")

        # Validar que ao menos uma loja foi selecionada
        if not store_ids:
            raise HTTPException(status_code=400, detail="Selecione ao menos uma loja")

        # Validar que lojas existem
        stores = db.query(Store).filter(Store.id.in_(store_ids)).all()
        if len(stores) != len(store_ids):
            raise HTTPException(status_code=400, detail="Uma ou mais lojas não encontradas")

        # Validar loja padrão
        if default_store_id and default_store_id not in store_ids:
            raise HTTPException(status_code=400, detail="Loja padrão deve estar na lista de lojas")

        # Remover lojas antigas
        db.query(UserStore).filter(UserStore.user_id == user_id).delete()

        # Adicionar novas lojas
        for store_id in store_ids:
            user_store = UserStore(
                user_id=user_id,
                store_id=store_id,
                is_default=(store_id == default_store_id) if default_store_id else (store_id == store_ids[0])
            )
            db.add(user_store)

        # Atualizar store_id do usuário (manter compatibilidade)
        user.store_id = default_store_id if default_store_id else store_ids[0]
        user.updated_at = datetime.now()

        db.commit()

        logger.info(f"✅ {len(store_ids)} lojas atribuídas ao usuário {user.username}")

        return {
            "success": True,
            "message": f"{len(store_ids)} lojas atribuídas ao usuário"
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao atualizar lojas do usuário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))