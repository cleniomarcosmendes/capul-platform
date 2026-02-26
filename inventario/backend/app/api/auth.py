"""
Rotas de Autenticacao — Inventario
No modo UNIFIED_AUTH, login e gerenciado pelo Auth Gateway da plataforma.
Endpoints de login local ficam desativados (retornam 410 Gone).
Endpoint /me adaptado para funcionar com ambos os modos.
"""
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    authenticate_user, create_user_tokens, get_current_user,
    UNIFIED_AUTH, UserSession
)
from app.core.config import settings

logger = logging.getLogger(__name__)

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

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticacao"])

# =================================
# HELPER: Resposta 410 Gone para endpoints desativados
# =================================

def _gone_response():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Endpoint desativado. Login gerenciado pela plataforma (Auth Gateway)."
    )

# =================================
# ENDPOINTS
# =================================

@router.post("/login", summary="Login do usuario")
async def login(db: Session = Depends(get_db)):
    """
    Login local do inventario.
    Desativado quando UNIFIED_AUTH=true — use o Hub da plataforma.
    """
    if UNIFIED_AUTH:
        _gone_response()

    # Modo standalone — manter compatibilidade
    from fastapi import Request
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Use POST com body {username, password}"
    )


@router.post("/validate-credentials", summary="Validar credenciais (multi-filial)")
async def validate_credentials(db: Session = Depends(get_db)):
    """Desativado no modo plataforma — login via Hub."""
    if UNIFIED_AUTH:
        _gone_response()
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Standalone mode only")


@router.post("/login-with-store", summary="Login com filial selecionada")
async def login_with_store(db: Session = Depends(get_db)):
    """Desativado no modo plataforma — login via Hub."""
    if UNIFIED_AUTH:
        _gone_response()
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Standalone mode only")


@router.get("/me", summary="Obter dados do usuario atual")
async def get_current_user_info(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obter dados do usuario atual.
    Funciona com JWT da plataforma (UserSession) e JWT local (User model).
    """
    # Se UNIFIED_AUTH, current_user e UserSession (tem store_code direto)
    if isinstance(current_user, UserSession):
        return {
            "id": current_user.id,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "store_id": current_user.store_id,
            "store_code": current_user.store_code,
            "store_name": None,  # Pode ser buscado se necessario
            "is_active": current_user.is_active,
            "auth_mode": "platform"
        }

    # Modo standalone — buscar store info
    store_name = None
    store_code = None
    if current_user.store_id:
        try:
            from app.models.models import Store
            store = db.query(Store).filter(Store.id == current_user.store_id).first()
            if store:
                store_name = store.name
                store_code = store.code
        except Exception as e:
            logger.warning(f"Erro ao buscar loja do usuario: {e}")

    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email or "",
        "role": current_user.role if isinstance(current_user.role, str) else current_user.role.value,
        "store_id": str(current_user.store_id) if current_user.store_id else None,
        "store_code": store_code,
        "store_name": store_name,
        "is_active": current_user.is_active,
        "auth_mode": "standalone"
    }
