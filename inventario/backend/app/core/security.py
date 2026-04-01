"""
Sistema de Seguranca — Inventario
Suporte dual: JWT da plataforma (Auth Gateway) e JWT local (standalone).
Quando UNIFIED_AUTH=true, usa JWT do Auth Gateway com campos:
  sub, username, filialId, filialCodigo, modulos[{codigo, role}]
"""

import os
import jwt
import logging
from jwt.exceptions import ExpiredSignatureError, DecodeError, InvalidTokenError
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, Any, Union, List, Optional
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

# =================================
# CONFIGURACOES
# =================================

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Flag para usar JWT unificado da plataforma
UNIFIED_AUTH = os.getenv("UNIFIED_AUTH", "false").lower() == "true"

# Context para hash de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()


# =================================
# USER SESSION (substitui dependencia do model User para auth)
# =================================

@dataclass
class UserSession:
    """
    Objeto de sessao do usuario, construido a partir do JWT + core.
    Compativel com o model User existente — endpoints que usam
    current_user.id, current_user.store_id, current_user.role, etc.
    continuam funcionando sem alteracao.
    """
    id: str
    username: str
    full_name: str
    email: str
    role: str              # ADMIN | SUPERVISOR | OPERATOR
    store_id: str          # UUID da filial ativa (core.filiais.id)
    store_code: str        # Codigo da filial ("01")
    is_active: bool = True

    # Campos extras para compatibilidade com model User
    password_hash: str = ""
    last_login: Optional[datetime] = None

    @property
    def store(self):
        """Compatibilidade com user.store (retorna None, lazy load nao disponivel)"""
        return None


# =================================
# FUNCOES DE HASH
# =================================

def hash_password(password: str) -> str:
    """Gera hash da senha"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se senha bate com hash - suporta bcrypt e SHA256"""
    import hashlib

    if hashed_password.startswith('$2b$'):
        return pwd_context.verify(plain_password, hashed_password)

    if len(hashed_password) == 64:
        sha256_hash = hashlib.sha256(plain_password.encode()).hexdigest()
        return sha256_hash == hashed_password

    return pwd_context.verify(plain_password, hashed_password)


# =================================
# FUNCOES JWT
# =================================

def create_access_token(data: Dict[str, Any], expires_delta: Union[timedelta, None] = None) -> str:
    """Cria token JWT de acesso (usado apenas no modo standalone)"""
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
    """Verifica e decodifica token JWT (plataforma ou local)"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # JWT da plataforma nao tem campo "type" — aceitar ambos
        token_type = payload.get("type")
        if token_type and token_type != "access_token":
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
# DEPENDENCIAS DE AUTENTICACAO
# =================================

from typing import TYPE_CHECKING, Generator
if TYPE_CHECKING:
    from app.core.database import get_db as GetDbType
else:
    GetDbType = None

def get_db_dependency() -> Generator:
    """Helper para obter sessao do banco com import tardio"""
    from app.core.database import get_db
    yield from get_db()


def _get_current_user_unified(payload: Dict[str, Any], db: Session) -> UserSession:
    """
    Constroi UserSession a partir do JWT do Auth Gateway.
    JWT payload: {sub, username, email, filialId, filialCodigo, modulos[{codigo, role}]}
    """
    from app.models.core_models import CoreUsuario

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    # Extrair filial do JWT
    filial_id = payload.get("filialId")
    filial_codigo = payload.get("filialCodigo", "")

    if not filial_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem filialId"
        )

    # Extrair role do modulo INVENTARIO
    modulos = payload.get("modulos", [])
    inv_modulo = next((m for m in modulos if m.get("codigo") == "INVENTARIO"), None)
    if not inv_modulo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario sem acesso ao modulo Inventario"
        )
    role = inv_modulo.get("role", "OPERATOR")

    # Buscar dados complementares no core (nome, email)
    usuario = db.query(CoreUsuario).filter(CoreUsuario.id == user_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in core"
        )
    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive"
        )

    return UserSession(
        id=user_id,
        username=payload.get("username", usuario.username),
        full_name=usuario.nome or "",
        email=payload.get("email", usuario.email or ""),
        role=role,
        store_id=filial_id,
        store_code=filial_codigo,
        is_active=True,
    )


def _get_current_user_legacy(payload: Dict[str, Any], db: Session):
    """
    Modo standalone: busca User do schema inventario (comportamento original).
    """
    from app.models.models import User

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive"
        )

    # Sobrescrever store_id com valor do JWT
    jwt_store_id = payload.get("store_id")
    if jwt_store_id:
        user.store_id = jwt_store_id

    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db_dependency)
):
    """
    Obtem usuario atual baseado no token JWT.
    Em modo UNIFIED_AUTH: retorna UserSession construido do JWT da plataforma.
    Em modo standalone: retorna model User do schema inventario.
    Ambos sao compativeis — possuem: id, username, role, store_id, is_active.
    """
    payload = verify_token(credentials.credentials)

    if UNIFIED_AUTH:
        return _get_current_user_unified(payload, db)
    else:
        return _get_current_user_legacy(payload, db)


def get_current_active_user(
    current_user = Depends(get_current_user)
):
    """Wrapper que retorna o usuario ativo atual."""
    return current_user


# =================================
# FUNCOES DE AUTENTICACAO (modo standalone)
# =================================

def authenticate_user(db: Session, username: str, password: str):
    """Autentica usuario com username e senha (modo standalone)"""
    from app.models.models import User

    user = db.query(User).filter(User.username == username).first()
    if not user:
        # Perform dummy hash to prevent timing attack (constant time)
        pwd_context.hash(password)
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user

def create_user_tokens(user) -> Dict[str, str]:
    """Cria tokens de acesso para usuario (modo standalone)"""
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
# FUNCOES DE PERMISSAO
# =================================

def verify_store_access(user, store_id: str) -> bool:
    """Verifica se usuario tem acesso a loja especificada"""
    if user.role == "ADMIN":
        return True
    return str(user.store_id) == store_id

def require_permission(permission: str):
    """Decorator para verificar permissoes especificas"""
    def permission_checker(current_user = Depends(get_current_active_user)):
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
