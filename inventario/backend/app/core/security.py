# backend/app/core/security.py - Correção para o erro de import
"""
Sistema de Segurança - Correção Rápida
Adiciona a função get_current_active_user que estava faltando
"""

import os
import jwt
from jwt.exceptions import ExpiredSignatureError, DecodeError, InvalidTokenError
from datetime import datetime, timedelta
from typing import Dict, Any, Union
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

# =================================
# CONFIGURAÇÕES
# =================================
# ✅ SEGURANÇA v2.19.13: Usar configurações centralizadas do config.py
from app.core.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
# ✅ v2.19.8: Aumentado de 60 para 480 minutos (8 horas) para evitar expiração durante uso
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Context para hash de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()

# =================================
# FUNÇÕES DE HASH
# =================================

def hash_password(password: str) -> str:
    """Gera hash da senha"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se senha bate com hash - suporta bcrypt e SHA256"""
    import hashlib
    
    # Se o hash começa com $2b$, é bcrypt
    if hashed_password.startswith('$2b$'):
        return pwd_context.verify(plain_password, hashed_password)
    
    # Caso contrário, assume SHA256 (64 caracteres hex)
    if len(hashed_password) == 64:
        sha256_hash = hashlib.sha256(plain_password.encode()).hexdigest()
        return sha256_hash == hashed_password
    
    # Fallback para bcrypt
    return pwd_context.verify(plain_password, hashed_password)

# =================================
# FUNÇÕES JWT
# =================================

def create_access_token(data: Dict[str, Any], expires_delta: Union[timedelta, None] = None) -> str:
    """Cria token JWT de acesso"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access_token"
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Dict[str, Any]:
    """Verifica e decodifica token JWT"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if payload.get("type") != "access_token":
            raise InvalidTokenError("Invalid token type")

        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except (DecodeError, InvalidTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# =================================
# DEPENDÊNCIAS DE AUTENTICAÇÃO
# =================================

# Import tardio no nível de módulo para evitar circular import
from typing import TYPE_CHECKING, Generator
if TYPE_CHECKING:
    from app.core.database import get_db as GetDbType
else:
    GetDbType = None

def get_db_dependency() -> Generator:
    """
    Helper para obter sessão do banco com import tardio
    Evita circular import ao importar apenas quando necessário
    """
    from app.core.database import get_db
    yield from get_db()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db_dependency)  # ✅ CORREÇÃO v2.10.0.4: Usar Depends para auto-gerenciar sessão
):
    """
    Obtém usuário atual baseado no token JWT
    Dependency para uso em endpoints protegidos

    ✅ CORREÇÃO v2.10.0.4: Sessão do banco agora é gerenciada pelo FastAPI via Depends
    Isso garante que a sessão seja fechada automaticamente após a requisição
    """
    # Import tardio para evitar import circular
    from app.models.models import User

    # Verificar token
    payload = verify_token(credentials.credentials)

    # Extrair dados do usuário
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    # Buscar usuário no banco
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Verificar se usuário está ativo
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive"
        )

    # ✅ CORREÇÃO v2.15.1: SOBRESCREVER store_id com o valor do TOKEN JWT
    # O store_id do JWT vem da filial selecionada no login (sistema multi-filial)
    # Isso garante que o usuário só veja dados da filial que selecionou
    jwt_store_id = payload.get("store_id")
    if jwt_store_id:
        user.store_id = jwt_store_id  # Sobrescrever com store_id do token
        print(f"✅ [JWT] store_id do token aplicado: {jwt_store_id}")
    else:
        print(f"⚠️ [JWT] Token sem store_id, usando store_id do banco: {user.store_id}")

    return user

# FUNÇÃO QUE ESTAVA FALTANDO!
def get_current_active_user(
    current_user: "User" = Depends(get_current_user)  # ✅ Type hint explícito com string
):
    """
    Obtém usuário ativo atual
    Esta é a função que estava faltando e causando o erro!

    ✅ CORREÇÃO DEFINITIVA: Type hint com string para evitar circular import
    FastAPI precisa do type hint para documentação e validação
    """
    return current_user

# =================================
# FUNÇÕES DE AUTENTICAÇÃO
# =================================

def authenticate_user(db: Session, username: str, password: str):
    """Autentica usuário com username e senha"""
    from app.models.models import User
    
    user = db.query(User).filter(User.username == username).first()
    
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    if not user.is_active:
        return None
    
    return user

def create_user_tokens(user) -> Dict[str, str]:
    """Cria tokens de acesso para usuário"""
    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "store_id": str(user.store_id) if user.store_id else None
    }
    
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

# =================================
# FUNÇÕES DE PERMISSÃO (Para o sistema de inventário)
# =================================

def verify_store_access(user, store_id: str) -> bool:
    """Verifica se usuário tem acesso à loja especificada"""
    # Se usuário é ADMIN, tem acesso a todas as lojas
    if user.role == "ADMIN":
        return True
    
    # Caso contrário, só pode acessar sua própria loja
    return str(user.store_id) == store_id

def require_permission(permission: str):
    """Decorator para verificar permissões específicas"""
    def permission_checker(current_user = Depends(get_current_active_user)):
        # Mapear permissões por role
        permissions_by_role = {
            "ADMIN": ["create_inventory", "edit_inventory", "delete_inventory", "view_all_inventories"],
            "SUPERVISOR": ["create_inventory", "edit_inventory", "view_store_inventories"],
            "OPERATOR": ["view_store_inventories", "count_items"]
        }
        
        user_permissions = permissions_by_role.get(current_user.role, [])
        
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        
        return current_user
    
    return permission_checker