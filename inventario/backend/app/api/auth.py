"""
Rotas de Autenticação
Sistema de Inventário Protheus
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import authenticate_user, create_user_tokens, get_current_user
from app.core.config import settings
from app.models.models import User

# ✅ SEGURANÇA v2.19.13: Dependência para verificar se endpoints de teste estão habilitados
def require_test_endpoints():
    """Dependência que bloqueia endpoints de teste em produção"""
    if not settings.ENABLE_TEST_ENDPOINTS:
        raise HTTPException(
            status_code=403,
            detail="Endpoints de teste desabilitados neste ambiente"
        )
    return True

# =================================
# SCHEMAS PYDANTIC
# =================================

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    email: str
    role: str
    store_id: str
    is_active: bool
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# =================================
# ROUTER
# =================================

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticação"])

# =================================
# ENDPOINTS
# =================================

@router.post("/login", response_model=Token, summary="Login do usuário")
async def login(
    user_credentials: UserLogin,
    db: Session = Depends(get_db)
) -> Token:
    """
    Realiza login do usuário no sistema
    
    **Credenciais padrão para teste:**
    - Username: admin
    - Password: admin123
    """
    
    # Autenticar usuário
    user = authenticate_user(
        db=db,
        username=user_credentials.username,
        password=user_credentials.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username or password incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Atualizar último login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Criar tokens
    tokens = create_user_tokens(user)
    
    return Token(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"]
    )

@router.get("/test-user", response_model=UserResponse, summary="Buscar usuário admin para teste", dependencies=[Depends(require_test_endpoints)])
async def get_test_user(db: Session = Depends(get_db)) -> UserResponse:
    """
    Busca o usuário admin padrão para teste
    
    **Útil para verificar se o usuário foi criado corretamente**
    """
    
    user = db.query(User).filter(User.username == "admin").first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user not found"
        )
    
    return UserResponse(
        id=str(user.id),
        username=user.username,
        full_name=user.full_name,
        email=user.email or "",
        role=user.role,
        store_id=str(user.store_id) if user.store_id else "",
        is_active=user.is_active,
        last_login=user.last_login
    )

@router.get("/me", summary="Obter dados do usuário atual")
async def get_current_user_info(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter dados do usuário atual"""
    from app.models.models import Store
    
    # Buscar informações da loja se o usuário tem store_id
    store_name = None
    store_code = None
    if current_user.store_id:
        try:
            store = db.query(Store).filter(Store.id == current_user.store_id).first()
            if store:
                store_name = store.name
                store_code = store.code
        except Exception as e:
            logger.warning(f"Erro ao buscar loja do usuário: {e}")

    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "store_id": current_user.store_id,
        "store_name": store_name,
        "store_code": store_code,
        "is_active": current_user.is_active
    }

@router.get("/test-assignments", summary="Teste assignments no auth", dependencies=[Depends(require_test_endpoints)])
async def test_assignments_in_auth():
    """Teste se o endpoint funciona no auth"""
    from datetime import datetime
    return {"message": "Assignments endpoint working in auth", "timestamp": datetime.utcnow().isoformat()}

# =================================
# ENDPOINTS MULTI-FILIAL v2.12.0
# =================================

@router.post("/validate-credentials", summary="Validar credenciais (Etapa 1 do login)")
async def validate_credentials(
    credentials: dict,
    db: Session = Depends(get_db)
):
    """
    Valida credenciais e retorna lojas disponíveis para o usuário.
    NÃO gera token ainda, apenas valida username/password.

    **v2.12.0**: Primeiro passo do login multi-filial

    **Payload:**
    ```json
    {
        "username": "operador1",
        "password": "123456"
    }
    ```

    **Response:**
    ```json
    {
        "success": true,
        "user_id": "uuid-do-usuario",
        "username": "operador1",
        "full_name": "Operador 1",
        "role": "OPERATOR",
        "stores": [
            {"id": "uuid1", "code": "01", "name": "Matriz", "is_default": true},
            {"id": "uuid2", "code": "02", "name": "Filial 1", "is_default": false}
        ]
    }
    ```
    """
    try:
        from app.models.models import Store, UserStore
        import logging

        logger = logging.getLogger(__name__)

        username = credentials.get("username")
        password = credentials.get("password")

        if not username or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username e password são obrigatórios"
            )

        # Autenticar usuário
        user = authenticate_user(db, username, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciais inválidas"
            )

        # Buscar lojas do usuário
        stores = []

        if user.role.value == "ADMIN":
            # ✅ v2.19.37: Admin recebe TODAS as lojas para seleção
            all_stores = db.query(Store).filter(Store.is_active == True).order_by(Store.code).all()
            for store in all_stores:
                stores.append({
                    "id": str(store.id),
                    "code": store.code,
                    "name": store.name,
                    "is_default": False  # Admin não tem loja padrão
                })
            logger.info(f"✅ Usuário {username} é ADMIN - acesso a {len(stores)} lojas")
        else:
            # Buscar lojas atribuídas ao usuário
            user_stores = db.query(UserStore).filter(UserStore.user_id == user.id).all()

            for us in user_stores:
                store = db.query(Store).filter(Store.id == us.store_id).first()
                if store:
                    stores.append({
                        "id": str(store.id),
                        "code": store.code,
                        "name": store.name,
                        "is_default": us.is_default
                    })

            logger.info(f"✅ Usuário {username} tem acesso a {len(stores)} lojas")

        return {
            "success": True,
            "user_id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
            "stores": stores
        }

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"❌ Erro ao validar credenciais: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login-with-store", summary="Login com filial selecionada (Etapa 2)")
async def login_with_store(
    login_data: dict,
    db: Session = Depends(get_db)
):
    """
    Gera token JWT com filial selecionada pelo usuário.

    **v2.12.0**: Segundo passo do login multi-filial

    **Payload:**
    ```json
    {
        "user_id": "uuid-do-usuario",
        "store_id": "uuid-da-loja-selecionada"  // Opcional para ADMIN
    }
    ```

    **Response:**
    ```json
    {
        "access_token": "jwt-token-here",
        "token_type": "bearer",
        "user": {
            "id": "uuid",
            "username": "operador1",
            "full_name": "Operador 1",
            "role": "OPERATOR"
        },
        "store": {
            "id": "uuid",
            "code": "01",
            "name": "Matriz"
        }
    }
    ```
    """
    try:
        from app.models.models import Store, UserStore
        from app.core.security import create_access_token
        import logging

        logger = logging.getLogger(__name__)

        user_id = login_data.get("user_id")
        store_id = login_data.get("store_id")

        logger.info(f"📥 Payload recebido: user_id={user_id}, store_id={store_id}")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id é obrigatório"
            )

        # Buscar usuário
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário inválido ou inativo"
            )

        # Validar que usuário tem acesso à loja selecionada
        if user.role.value != "ADMIN" and store_id:
            user_store = db.query(UserStore).filter(
                UserStore.user_id == user_id,
                UserStore.store_id == store_id
            ).first()

            if not user_store:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Usuário não tem acesso a esta loja"
                )

        # Buscar dados da loja
        store = None
        if store_id:
            store = db.query(Store).filter(Store.id == store_id).first()
            if not store:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Loja não encontrada"
                )
            logger.info(f"🏪 Loja encontrada: ID={store.id}, Código={store.code}, Nome={store.name}")

        # Gerar token JWT com store_id selecionada
        token_data = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role.value,
            "store_id": str(store_id) if store_id else None  # ✅ Store vem da SELEÇÃO do usuário!
        }

        logger.info(f"🔐 Token JWT será gerado com store_id={token_data['store_id']}")

        access_token = create_access_token(token_data)

        # Atualizar last_login
        user.last_login = datetime.utcnow()
        db.commit()

        logger.info(f"✅ Login completo: {user.username} → Loja {store.code if store else 'N/A'}")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role.value,
                "store_id": str(store.id) if store else None  # ✅ v2.19.11: Incluir store_id no user
            },
            "store": {
                "id": str(store.id),
                "code": store.code,
                "name": store.name
            } if store else None
        }

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"❌ Erro ao completar login: {e}")
        raise HTTPException(status_code=500, detail=str(e))