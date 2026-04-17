# backend/app/main.py
"""
Sistema de Inventário Protheus - FastAPI Principal
Versão SIMPLIFICADA para funcionar
"""

from fastapi import FastAPI, Depends, HTTPException, status, Query, Request
from sqlalchemy import and_, text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List, Dict, Any
import logging
import os

# Importar constantes
from app.core.constants import (
    HTTP_UNAUTHORIZED, HTTP_NOT_FOUND, HTTP_INTERNAL_ERROR,
    HTTP_BAD_REQUEST, HTTP_FORBIDDEN, CORS_ORIGINS_DEV,
    ERROR_USER_NOT_FOUND, ERROR_INVALID_CREDENTIALS, ERROR_TOKEN_EXPIRED,
    VALID_CYCLE_COLUMNS, VALID_NEEDS_CYCLE_COLUMNS, MAX_COUNT_ROUNDS
)

# ✅ v2.19.16: Importar tratamento seguro de erros
from app.core.exceptions import safe_error_response

# Importar autenticação do módulo correto
from app.core.security import get_current_user as get_current_user_from_security

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =================================
# HELPER FUNCTIONS FOR ACCESS CONTROL
# =================================
def add_store_filter(query, model_class, current_user):
    """
    Adiciona filtro de loja apenas para usuários não-ADMIN.
    ADMIN tem acesso irrestrito a todas as lojas.
    """
    if current_user.role != 'ADMIN':
        return query.filter(model_class.store_id == current_user.store_id)
    return query

def check_inventory_access(db, inventory_id, current_user):
    """
    Verifica se o usuário tem acesso ao inventário.
    ADMIN: acesso a todos os inventários
    Outros: apenas inventários da sua loja
    """
    from app.models.models import InventoryList
    if current_user.role == 'ADMIN':
        return db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
    else:
        return db.query(InventoryList).filter(
            InventoryList.id == inventory_id,
            InventoryList.store_id == current_user.store_id
        ).first()


def check_inventory_not_closed(inventory):
    """
    Verifica se o inventário NÃO está efetivado (CLOSED).
    Inventários efetivados são somente leitura.
    Lança HTTPException 400 se estiver CLOSED.
    """
    from app.models.models import InventoryStatus
    if inventory and inventory.status in [InventoryStatus.CLOSED, "CLOSED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventário efetivado. Não é possível realizar alterações após a integração com o Protheus."
        )

# =================================
# IMPORTS SEGUROS
# =================================

try:
    from app.core.database import get_db, engine
    from app.models.models import Base, User, Store, Product, Counting
    from app.core.security import hash_password, verify_password
    from app.api.v1.endpoints.import_data import router as import_router
    # ✅ LIMPEZA: Removidos imports de endpoints não existentes (sb1010, sbm010, szd010, sze010)
    # inventory_router será importado mais tarde (lazy import)
    logger.info("✅ Imports básicos funcionando")
except Exception as e:
    logger.error(f"❌ Erro nos imports: {e}")

# ✅ NOVO v2.14.0: Import do router de sincronização Protheus (separado)
try:
    from app.api.v1.endpoints.sync_protheus import router as sync_protheus_router
    logger.info("✅ Router de sincronização Protheus importado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de sincronização Protheus: {e}")
    sync_protheus_router = None

# ✅ NOVO v2.18.3: Import do router de sincronização de produtos (cache)
try:
    from app.api.v1.endpoints.sync_products import router as sync_products_router
    logger.info("✅ Router de sincronização de produtos importado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de sincronização de produtos: {e}")
    sync_products_router = None

# ✅ NOVO v2.19.0: Import do router de integração com Protheus
try:
    from app.api.v1.endpoints.integration_protheus import router as integration_protheus_router
    logger.info("✅ Router de integração Protheus importado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de integração Protheus: {e}")
    integration_protheus_router = None

# ✅ NOVO: Import do router de envio para Protheus (transferencia, digitacao, historico)
try:
    from app.api.v1.endpoints.send_protheus import router as send_protheus_router
    logger.info("✅ Router de envio Protheus importado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de envio Protheus: {e}")
    send_protheus_router = None

# ✅ NOVO v2.16.0: Import do serviço de auditoria de ciclos
try:
    from app.services import audit_service
    logger.info("✅ Serviço de auditoria de ciclos importado")
except Exception as e:
    logger.error(f"❌ Erro ao importar serviço de auditoria: {e}")
    audit_service = None

# ✅ NOVO v2.16.0: Import do router de monitoramento e alertas
try:
    from app.api.v1.endpoints.monitoring import router as monitoring_router
    logger.info("✅ Router de monitoramento e alertas importado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de monitoramento: {e}")
    monitoring_router = None

# ✅ NOVO v2.16.0: Import do router de validação cruzada
try:
    from app.api.v1.endpoints.validation import router as validation_router
    logger.info("✅ Router de validação cruzada importado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de validação: {e}")
    validation_router = None

# Import do router de autenticação
try:
    from app.api.auth import router as auth_router
except Exception as e:
    logger.error(f"❌ Erro ao importar router de autenticação: {e}")
    auth_router = None

# Import do router de usuários separado
try:
    from app.api.v1.endpoints.users import router as users_router
except Exception as e:
    logger.error(f"❌ Erro ao importar router de usuários: {e}")
    users_router = None

# ✅ LIMPEZA: Removido import de counting_simple (endpoint não existe)

# Import do router de assignments (atribuições)
try:
    from app.api.v1.endpoints.assignments import router as assignments_router
except Exception as e:
    logger.error(f"❌ Erro ao importar router de assignments: {e}")
    assignments_router = None

# Import do router de cycle_control (nova estrutura de ciclos)
try:
    from app.api.v1.endpoints.cycle_control import router as cycle_control_router
    logger.info("✅ Módulo cycle_control_simple carregado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de cycle_control: {e}")
    cycle_control_router = None

# Router de counting_test removido - endpoint de teste não necessário em produção
counting_test_router = None

# Import do router de stores
try:
    from app.api.v1.endpoints.stores import router as stores_router
except Exception as e:
    logger.error(f"❌ Erro ao importar router de lojas: {e}")
    stores_router = None

# Import do router de lot_draft (rascunhos de lotes)
try:
    from app.api.v1.endpoints.lot_draft import router as lot_draft_router
    logger.info("✅ Módulo lot_draft carregado")
except Exception as e:
    logger.error(f"❌ Erro ao importar router de lot_draft: {e}")
    lot_draft_router = None

# =================================
# CRIAR TABELAS
# =================================

try:
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Tabelas criadas/verificadas")
except Exception as e:
    logger.error(f"❌ Erro ao criar tabelas: {e}")

# =================================
# CONFIGURAÇÃO DO FASTAPI
# =================================

app = FastAPI(
    title="Sistema de Inventário",
    description="Sistema de controle de inventário físico",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Rate Limiting — protecao contra forca bruta e abuso
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
# ✅ SEGURANÇA v2.19.13: CORS configurável via config.py
from app.core.config import settings as app_settings

# ✅ PERFORMANCE v2.19.13: Sistema de cache Redis
try:
    from app.core.cache import cache_response, CacheTTL, get_cache_stats, clear_all_cache
    logger.info("✅ Sistema de cache carregado")
except Exception as e:
    logger.warning(f"⚠️ Cache não disponível: {e}")
    cache_response = None
    CacheTTL = None

# ✅ v2.19.55: CORS com suporte a IPs de rede local para acesso mobile
cors_origins = app_settings.CORS_ORIGINS
if cors_origins == ["*"]:
    # Quando "*" é usado, desabilitar credentials para compatibilidade
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    )

# 🔒 Middleware de headers de seguranca
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# 🔒 Middleware para redirecionar HTTP → HTTPS
@app.middleware("http")
async def redirect_http_to_https(request: Request, call_next):
    """
    Redireciona automaticamente requisições HTTP para HTTPS
    Apenas se SSL estiver habilitado
    """
    # Verificar se SSL está habilitado
    ssl_enabled = os.getenv("SSL_CERT_FILE") and os.getenv("SSL_KEY_FILE")

    # Se SSL habilitado E requisição é HTTP (não HTTPS)
    if ssl_enabled and request.url.scheme == "http":
        # Ignorar APIs, health checks e docs (permitir HTTP para compatibilidade)
        if not request.url.path.startswith("/api/") and request.url.path not in ["/health", "/docs", "/redoc", "/openapi.json"]:
            # Construir URL HTTPS na porta 8443
            url = request.url.replace(scheme="https", port=8443)
            logger.info(f"🔒 Redirecionando HTTP → HTTPS: {request.url} → {url}")
            return RedirectResponse(url=str(url), status_code=301)

    # Processar requisição normalmente
    response = await call_next(request)
    return response

# =================================
# ARQUIVOS ESTÁTICOS (FRONTEND)
# =================================

import os

# Configurar diretório do frontend
frontend_path = "/app/frontend"
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")
    logger.info(f"✅ Arquivos estáticos configurados: {frontend_path}")
else:
    logger.warning(f"⚠️ Diretório frontend não encontrado: {frontend_path}")

# =================================
# MODELOS PYDANTIC SIMPLES
# =================================

from pydantic import BaseModel
# typing já importado no topo do arquivo (linha 14)
import uuid
# datetime já importado no topo do arquivo (linha 13)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    full_name: Optional[str] = None
    role: str
    store_id: Optional[uuid.UUID] = None
    store_name: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True  # Para Pydantic v2

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class LotCount(BaseModel):
    lot_number: str
    quantity: float
    expiry_date: Optional[str] = None

class RegisterCountRequest(BaseModel):
    inventory_item_id: str
    quantity: float
    lot_number: Optional[str] = None
    location: Optional[str] = None
    observation: Optional[str] = None
    # Novo campo para produtos com múltiplos lotes
    lot_counts: Optional[List[LotCount]] = None

# =================================
# FUNÇÕES DE SEGURANÇA SIMPLES
# =================================

# Funções de hash movidas para security.py

def create_access_token(username: str) -> str:
    """Criar token simples (para teste)"""
    from app.core.constants import TOKEN_PREFIX
    return f"{TOKEN_PREFIX}{username}_{datetime.now().timestamp()}"

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

# ✅ CORREÇÃO: Usar função get_current_user do módulo security.py
# Esta função duplicada foi removida e substituída por alias
get_current_user = get_current_user_from_security

# # 🚫 FUNÇÃO DUPLICADA COMENTADA - NÃO USAR
# def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
#     """Obter usuário atual usando Bearer token"""
#     # Esta função estava duplicada e causava problemas de autenticação
#     # A função correta está em app.core.security.get_current_user
#     pass

# =================================
# ROTAS DE SAÚDE
# =================================

# @app.get("/", tags=["Health"])
# async def root():
#     """Rota raiz - COMENTADO para permitir StaticFiles servir index.html"""
#     return {
#         "status": "🟢 Online",
#         "service": "Sistema de Inventário",
#         "version": "2.0.0",
#         "docs": "/docs",
#         "timestamp": datetime.now().isoformat()
#     }

@app.delete("/clear/{table_name}")
async def clear_table_simple(table_name: str, db: Session = Depends(get_db)):
    """Limpa dados de uma tabela específica - ENDPOINT SIMPLIFICADO"""
    try:
        from sqlalchemy import text
        if table_name.upper() == 'SB1010':
            # Limpar tabela SB1010
            result = db.execute(text("DELETE FROM inventario.sb1010"))
            count = result.rowcount
            db.commit()
            return {
                "message": f"✅ Tabela {table_name} limpa com sucesso",
                "deleted_records": count,
                "table": table_name
            }
        elif table_name.upper() == 'SB2010':
            # Limpar tabela SB2010
            result = db.execute(text("DELETE FROM inventario.sb2010"))
            count = result.rowcount
            db.commit()
            return {
                "message": f"✅ Tabela {table_name} limpa com sucesso",
                "deleted_records": count,
                "table": table_name
            }
        elif table_name.upper() == 'SB8010':
            # Limpar tabela SB8010
            result = db.execute(text("DELETE FROM inventario.sb8010"))
            count = result.rowcount
            db.commit()
            return {
                "message": f"✅ Tabela {table_name} limpa com sucesso",
                "deleted_records": count,
                "table": table_name
            }
        elif table_name.upper() == 'SLK010':
            # Limpar tabela SLK010
            result = db.execute(text("DELETE FROM inventario.slk010"))
            count = result.rowcount
            db.commit()
            return {
                "message": f"✅ Tabela {table_name} limpa com sucesso",
                "deleted_records": count,
                "table": table_name
            }
        elif table_name.upper() == 'SBZ010':
            # Limpar tabela SBZ010
            result = db.execute(text("DELETE FROM inventario.sbz010"))
            count = result.rowcount
            db.commit()
            return {
                "message": f"✅ Tabela {table_name} limpa com sucesso",
                "deleted_records": count,
                "table": table_name
            }
        else:
            raise HTTPException(status_code=400, detail=f"Tabela {table_name} não suportada")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao limpar tabela"))

@app.delete("/api/v1/clear/{table_name}")
async def clear_table(table_name: str, db: Session = Depends(get_db)):
    """Limpa dados de uma tabela específica"""
    try:
        from sqlalchemy import text
        if table_name.upper() == 'SB2010':
            # Limpar tabela SB2010
            result = db.execute(text("DELETE FROM inventario.sb2010"))
            count = result.rowcount
            db.commit()
            return {
                "message": f"✅ Tabela {table_name} limpa com sucesso",
                "deleted_records": count,
                "table": table_name
            }
        else:
            raise HTTPException(status_code=400, detail=f"Tabela {table_name} não suportada")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao limpar tabela"))

@app.post("/api/v1/import/bulk")
async def import_bulk_basic(request: dict, db: Session = Depends(get_db)):
    """Importação básica para SB2010"""
    try:
        from sqlalchemy import text
        table_name = request.get("table_name", "")
        records = request.get("records", [])
        
        if table_name not in ["SB1010", "SB2010", "SLK010", "SB8010", "SBZ010"]:
            raise HTTPException(status_code=400, detail=f"Tabela {table_name} não suportada")
        
        success_count = 0
        error_count = 0
        errors = []
        
        for record in records:
            try:
                data = record.get("data", {})
                
                # Limpeza básica - remover aspas duplas
                cleaned_data = {}
                for key, value in data.items():
                    if isinstance(value, str) and value.startswith('"') and value.endswith('"'):
                        cleaned_data[key.lower()] = value[1:-1]
                    else:
                        cleaned_data[key.lower()] = value
                
                # Inserir dados baseado na tabela
                if table_name == "SB1010":
                    # Filosofia: Importação flexível do Protheus - preencher campos faltantes
                    mapped_data = {
                        'b1_filial': cleaned_data.get('b1_filial', ''),
                        'b1_cod': cleaned_data.get('b1_cod', ''),
                        'b1_codbar': cleaned_data.get('b1_codbar', ''),
                        'b1_desc': cleaned_data.get('b1_desc', ''),
                        'b1_tipo': cleaned_data.get('b1_tipo', 'PA'),
                        'b1_um': cleaned_data.get('b1_um', 'UN'),
                        'b1_locpad': cleaned_data.get('b1_locpad', ''),
                        'b1_grupo': cleaned_data.get('b1_grupo', ''),
                        'b1_xcatgor': cleaned_data.get('b1_xcatgor', ''),
                        'b1_xsubcat': cleaned_data.get('b1_xsubcat', ''),
                        'b1_xsegmen': cleaned_data.get('b1_xsegmen', ''),
                        'b1_rastro': cleaned_data.get('b1_rastro', 'N'),
                        'b1_xgrinve': cleaned_data.get('b1_xgrinve', '')
                    }
                    
                    sql = text("""
                        INSERT INTO inventario.sb1010 (b1_filial, b1_cod, b1_codbar, b1_desc, b1_tipo, b1_um, b1_locpad, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen, b1_rastro, b1_xgrinve)
                        VALUES (:b1_filial, :b1_cod, :b1_codbar, :b1_desc, :b1_tipo, :b1_um, :b1_locpad, :b1_grupo, :b1_xcatgor, :b1_xsubcat, :b1_xsegmen, :b1_rastro, :b1_xgrinve)
                        ON CONFLICT (b1_filial, b1_cod) 
                        DO UPDATE SET 
                            b1_codbar = EXCLUDED.b1_codbar,
                            b1_desc = EXCLUDED.b1_desc,
                            b1_tipo = EXCLUDED.b1_tipo,
                            b1_um = EXCLUDED.b1_um,
                            b1_locpad = EXCLUDED.b1_locpad,
                            b1_grupo = EXCLUDED.b1_grupo,
                            b1_xcatgor = EXCLUDED.b1_xcatgor,
                            b1_xsubcat = EXCLUDED.b1_xsubcat,
                            b1_xsegmen = EXCLUDED.b1_xsegmen,
                            b1_rastro = EXCLUDED.b1_rastro,
                            b1_xgrinve = EXCLUDED.b1_xgrinve,
                            updated_at = CURRENT_TIMESTAMP
                    """)
                    
                    # Usar dados mapeados para este caso
                    db.execute(sql, mapped_data)
                    success_count += 1
                    continue  # Pular o db.execute(sql, cleaned_data) no final
                
                elif table_name.upper() == "SB2010":
                    sql = text("""
                        INSERT INTO inventario.sb2010 (b2_filial, b2_cod, b2_local, b2_qatu, b2_vatu1, b2_cm1, b2_qemp, b2_reserva)
                        VALUES (:b2_filial, :b2_cod, :b2_local, :b2_qatu, :b2_vatu1, :b2_cm1, :b2_qemp, :b2_reserva)
                        ON CONFLICT (b2_filial, b2_local, b2_cod) 
                        DO UPDATE SET 
                            b2_qatu = EXCLUDED.b2_qatu,
                            b2_vatu1 = EXCLUDED.b2_vatu1,
                            b2_cm1 = EXCLUDED.b2_cm1,
                            b2_qemp = EXCLUDED.b2_qemp,
                            b2_reserva = EXCLUDED.b2_reserva,
                            updated_at = CURRENT_TIMESTAMP
                    """)
                    
                    def clean_numeric(value, default=0):
                        try:
                            return float(str(value).strip().strip('"') or default)
                        except:
                            return default
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'b2_filial': clean_field(record_data.get('B2_FILIAL')),
                        'b2_cod': clean_field(record_data.get('B2_COD')),
                        'b2_local': clean_field(record_data.get('B2_LOCAL')),
                        'b2_qatu': clean_numeric(record_data.get('B2_QATU')),
                        'b2_vatu1': clean_numeric(record_data.get('B2_VATU1')),
                        'b2_cm1': clean_numeric(record_data.get('B2_CM1')),
                        'b2_qemp': clean_numeric(record_data.get('b2_qemp', 0)),
                        'b2_reserva': clean_numeric(record_data.get('b2_reserva', 0))
                    })
                    savepoint.commit()
                    success_count += 1
                
                elif table_name.upper() == "SLK010":
                    # Mapear campos do CSV para os campos da tabela
                    mapped_data = {
                        'slk_filial': cleaned_data.get('SLK_FILIAL', ''),
                        'slk_codbar': cleaned_data.get('SLK_CODBAR', ''),
                        'slk_produto': cleaned_data.get('SLK_PRODUTO', '')
                    }
                    
                    sql = text("""
                        INSERT INTO inventario.slk010 (slk_filial, slk_codbar, slk_produto)
                        VALUES (:slk_filial, :slk_codbar, :slk_produto)
                    """)
                    
                    # Usar dados mapeados para este caso
                    db.execute(sql, mapped_data)
                    success_count += 1
                    continue  # Pular o db.execute(sql, cleaned_data) no final
                
                elif table_name.upper() == "SB8010":
                    sql = text("""
                        INSERT INTO inventario.sb8010 (b8_filial, b8_produto, b8_local, b8_lotectl, b8_numlote, b8_saldo, b8_dtvalid)
                        VALUES (:b8_filial, :b8_produto, :b8_local, :b8_lotectl, :b8_numlote, :b8_saldo, :b8_dtvalid)
                        ON CONFLICT (b8_filial, b8_produto, b8_local, b8_lotectl, b8_numlote) 
                        DO UPDATE SET 
                            b8_saldo = EXCLUDED.b8_saldo,
                            b8_dtvalid = EXCLUDED.b8_dtvalid,
                            updated_at = CURRENT_TIMESTAMP
                    """)
                    
                    def clean_numeric(value, default=0):
                        try:
                            return float(str(value).strip().strip('"') or default)
                        except:
                            return default
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'b8_filial': clean_field(record_data.get('b8_filial')),
                        'b8_produto': clean_field(record_data.get('b8_produto')),
                        'b8_local': clean_field(record_data.get('b8_local')),
                        'b8_lotectl': clean_field(record_data.get('b8_lotectl')),
                        'b8_numlote': clean_field(record_data.get('b8_numlote')),
                        'b8_saldo': clean_numeric(record_data.get('b8_saldo')),
                        'b8_dtvalid': clean_field(record_data.get('b8_dtvalid'))
                    })
                    savepoint.commit()
                    success_count += 1
                
                elif table_name.upper() == "SBZ010":
                    # Mapear campos do CSV para os campos da tabela (CSV tem BZ_LOCPAD, banco tem bz_local)
                    mapped_data = {
                        'bz_filial': cleaned_data.get('bz_filial', ''),
                        'bz_cod': cleaned_data.get('bz_cod', ''),
                        'bz_local': cleaned_data.get('bz_locpad', cleaned_data.get('bz_local', '')),  # CSV usa LOCPAD, banco usa LOCAL
                        'bz_xlocal1': cleaned_data.get('bz_xlocal1', ''),
                        'bz_xlocal2': cleaned_data.get('bz_xlocal2', ''),
                        'bz_xlocal3': cleaned_data.get('bz_xlocal3', '')
                    }
                    
                    sql = text("""
                        INSERT INTO inventario.sbz010 (bz_filial, bz_cod, bz_local, bz_xlocal1, bz_xlocal2, bz_xlocal3)
                        VALUES (:bz_filial, :bz_cod, :bz_local, :bz_xlocal1, :bz_xlocal2, :bz_xlocal3)
                        ON CONFLICT (bz_filial, bz_cod) 
                        DO UPDATE SET 
                            bz_local = EXCLUDED.bz_local,
                            bz_xlocal1 = EXCLUDED.bz_xlocal1,
                            bz_xlocal2 = EXCLUDED.bz_xlocal2,
                            bz_xlocal3 = EXCLUDED.bz_xlocal3,
                            updated_at = CURRENT_TIMESTAMP
                    """)
                    
                    # Usar dados mapeados para este caso
                    db.execute(sql, mapped_data)
                    success_count += 1
                    continue  # Pular o db.execute(sql, cleaned_data) no final
                
                db.execute(sql, cleaned_data)
                success_count += 1
                
            except Exception as e:
                error_count += 1
                errors.append({
                    "line": record.get("line_number", 0),
                    "error": str(e)
                })
        
        db.commit()
        
        return {
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors,
            "total_processed": len(records)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "na importação"))

@app.get("/health", tags=["Health"])
async def health_check(db: Session = Depends(get_db)):
    """Health check com verificação do banco"""
    try:
        # Testar conexão com banco
        user_count = db.query(User).count()
        store_count = db.query(Store).count()
        
        return {
            "status": "🟢 Healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "✅ Connected",
            "counts": {
                "users": user_count,
                "stores": store_count
            }
        }
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "🔴 Unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )

# =================================
# ENDPOINTS DE CACHE (v2.19.13)
# =================================

@app.get("/api/v1/cache/stats", tags=["Cache"])
async def cache_statistics(current_user=Depends(get_current_user)):
    """
    Retorna estatísticas do cache Redis.

    **Permissão**: ADMIN apenas
    """
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Apenas administradores podem ver estatísticas de cache")

    if get_cache_stats is None:
        return {"status": "unavailable", "message": "Sistema de cache não configurado"}

    return get_cache_stats()


@app.delete("/api/v1/cache", tags=["Cache"])
async def clear_cache(current_user=Depends(get_current_user)):
    """
    Limpa todo o cache da aplicação.

    **Permissão**: ADMIN apenas
    """
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Apenas administradores podem limpar o cache")

    if clear_all_cache is None:
        return {"success": False, "message": "Sistema de cache não configurado"}

    deleted = clear_all_cache()
    return {"success": True, "message": f"Cache limpo com sucesso", "keys_deleted": deleted}


# =================================
# NOTA: Endpoints de autenticação movidos para app.api.auth
# Router incluído na seção de routers abaixo
# TEMPORÁRIO: Endpoint /me adicionado aqui devido a problema com auth router
# =================================

@app.get("/api/v1/auth/me", tags=["Authentication"])
async def get_current_user_info_temp(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Obter dados do usuário atual - TEMPORÁRIO"""
    # Buscar informações da loja se o usuário tem store_id
    store_name = None
    if current_user.store_id:
        try:
            store = db.query(Store).filter(Store.id == current_user.store_id).first()
            if store:
                store_name = store.name
        except Exception as e:
            logger.warning(f"Erro ao buscar loja do usuário: {e}")
    
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "store_id": current_user.store_id,
        "store_name": store_name,
        "is_active": current_user.is_active
    }

def _resolve_location(sbz, szb):
    """Resolve localização dinâmica baseada em szb010.zb_xsbzlcz"""
    if not sbz:
        return ""
    campo = szb.zb_xsbzlcz.strip() if szb and hasattr(szb, 'zb_xsbzlcz') and szb.zb_xsbzlcz else '1'
    if campo == '2' and sbz.bz_xlocal2:
        return sbz.bz_xlocal2.strip()
    if campo == '3' and sbz.bz_xlocal3:
        return sbz.bz_xlocal3.strip()
    return sbz.bz_xlocal1.strip() if sbz.bz_xlocal1 else ""


# LOGIN REMOVIDO - Usar app.api.auth.py

@app.get("/api/v1/inventory/lists/{inventory_id}/items", tags=["Inventory"])
async def get_inventory_items(
    inventory_id: str,
    status_filter: str = None,  # 🎯 NOVO: Filtro por status para sistema de 3 ciclos
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter itens de um inventário com suas atribuições
    
    Args:
        status_filter: Filtrar por status específico para contagem por ciclo:
                      - 'PENDING': Aguardando contagem (1º ciclo)
                      - 'RECONTAGEM': Liberado para 2ª contagem
                      - 'CONTAGEM_FINAL': Liberado para 3ª contagem
                      - 'DIVERGENCIA': Itens com divergência
    """
    try:
        from app.models.models import InventoryItem, InventoryList, CountingAssignment
        
        # Verificar se o inventário existe e o usuário tem acesso
        if current_user.role == 'ADMIN':
            # ADMIN pode acessar inventários de qualquer loja
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_id
            ).first()
        else:
            # Outros usuários só podem acessar inventários da sua loja
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_id,
                InventoryList.store_id == current_user.store_id
            ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found or access denied"
            )
        
        # Buscar itens com atribuições do usuário E dados do produto
        from app.models.models import SB1010, SB2010, SBZ010, SZB010, Store
        from sqlalchemy import func
        
        # ✅ NOVA ABORDAGEM: Buscar itens únicos primeiro, depois buscar dados adicionais
        unique_items = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory_id
        ).all()

        # 🔧 SINCRONIZAÇÃO: Buscar current_cycle da counting_lists se disponível
        from app.models.models import CountingList
        counting_list = db.query(CountingList).filter(
            CountingList.inventory_id == inventory_id
        ).first()

        # Usar current_cycle da counting_list se disponível, senão usar do inventory
        if counting_list and counting_list.current_cycle:
            current_cycle = counting_list.current_cycle
            print(f"🔄 [SYNC] Usando current_cycle={current_cycle} da counting_lists para inventory/items")
        else:
            current_cycle = getattr(inventory, 'current_cycle', 1)
            print(f"🔄 [SYNC] Usando current_cycle={current_cycle} da inventory_lists para inventory/items")

        # Batch fetch SB2010 (saldos) e SBZ010 (localizações) para evitar N+1
        product_codes_stripped = list(set([
            item.product_code.strip() for item in unique_items if item.product_code
        ]))

        sb2_lookup = {}
        sbz_lookup = {}
        if product_codes_stripped:
            sb2_rows = db.query(SB2010).filter(
                func.trim(SB2010.b2_cod).in_(product_codes_stripped)
            ).all()
            for sb2 in sb2_rows:
                key = (sb2.b2_cod.strip(), sb2.b2_local.strip() if sb2.b2_local else '')
                sb2_lookup[key] = sb2

            sbz_rows = db.query(SBZ010).filter(
                func.trim(SBZ010.bz_cod).in_(product_codes_stripped)
            ).all()
            for sbz in sbz_rows:
                sbz_lookup[sbz.bz_cod.strip()] = sbz

        # Batch fetch SZB010 (config de localização por armazém)
        store = db.query(Store).filter(Store.id == inventory.store_id).first()
        filial_code = store.code.strip() if store and store.code else '01'
        szb_lookup = {}
        szb_rows = db.query(SZB010).filter(SZB010.zb_filial == filial_code).all()
        for szb in szb_rows:
            szb_lookup[szb.zb_xlocal.strip()] = szb

        items_with_assignments = []
        for item in unique_items:
            # Buscar atribuição do usuário para este item
            assignment = db.query(CountingAssignment).filter(
                CountingAssignment.inventory_item_id == item.id,
                CountingAssignment.assigned_to == current_user.id
            ).first()

            # Buscar dados do produto
            product = db.query(SB1010).filter(
                func.trim(SB1010.b1_cod) == func.trim(item.product_code)
            ).first()

            items_with_assignments.append((item, assignment, product))
        
        # 🎯 SISTEMA DE 3 CICLOS - Aplicar filtro de status se especificado
        if status_filter:
            items_with_assignments = [(item, assignment, product) for item, assignment, product in items_with_assignments 
                                    if item.status == status_filter]
            logger.info(f"🔍 Aplicando filtro de status: {status_filter}")
        
        items_data = []
        for item, assignment, product in items_with_assignments:
            # Usar descrição real do produto ou fallback
            product_name = product.b1_desc.strip() if product and product.b1_desc else f"Produto {item.product_code.strip()}"

            # Lookup SB2/SBZ dos batches
            pc = item.product_code.strip() if item.product_code else ''
            wh = item.warehouse.strip() if item.warehouse else ''
            sb2 = sb2_lookup.get((pc, wh))
            sbz = sbz_lookup.get(pc)

            item_data = {
                "id": str(item.id),
                "product_code": item.product_code.strip() if item.product_code else "",
                "product_name": product_name,
                "product_unit": product.b1_um.strip() if product and product.b1_um else "UN",
                "product_grupo": product.b1_grupo.strip() if product and product.b1_grupo else "",
                "product_categoria": product.b1_xcatgor.strip() if product and product.b1_xcatgor else "",
                "product_subcategoria": product.b1_xsubcat.strip() if product and product.b1_xsubcat else "",
                "product_segmento": product.b1_xsegmen.strip() if product and product.b1_xsegmen else "",
                "product_grupo_inv": product.b1_xgrinve.strip() if product and product.b1_xgrinve else "",
                "product_lote": product.b1_rastro.strip() if product and product.b1_rastro else "N",
                "product_estoque": float(sb2.b2_qatu) if sb2 and sb2.b2_qatu else 0.0,
                "product_entregas_post": float(sb2.b2_xentpos) if sb2 and sb2.b2_xentpos else 0.0,
                "product_local1": sbz.bz_xlocal1.strip() if sbz and sbz.bz_xlocal1 else "",
                "product_local2": sbz.bz_xlocal2.strip() if sbz and sbz.bz_xlocal2 else "",
                "product_local3": sbz.bz_xlocal3.strip() if sbz and sbz.bz_xlocal3 else "",
                "product_location": _resolve_location(sbz, szb_lookup.get(wh)),
                "sequence": item.sequence,
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0.0,
                "warehouse": item.warehouse,
                "status": item.status,
                # ✅ ADICIONAR DADOS DAS CONTAGENS POR CICLO
                "count_cycle_1": float(item.count_cycle_1) if item.count_cycle_1 is not None else None,
                "count_cycle_2": float(item.count_cycle_2) if item.count_cycle_2 is not None else None,
                "count_cycle_3": float(item.count_cycle_3) if item.count_cycle_3 is not None else None,
                # ✅ ADICIONAR CAMPOS DE CONTROLE DE RECONTAGEM
                "needs_recount_cycle_1": item.needs_recount_cycle_1,
                "needs_recount_cycle_2": item.needs_recount_cycle_2,
                "needs_recount_cycle_3": item.needs_recount_cycle_3,
                "assignment": {
                    "id": str(assignment.id) if assignment else None,
                    "count_number": current_cycle,  # Usar ciclo atual da lista
                    "status": assignment.status if assignment else "NOT_ASSIGNED",
                    "assigned": assignment is not None
                } if assignment else None
            }
            items_data.append(item_data)
        
        return {
            "success": True,
            "message": f"Found {len(items_data)} items",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "cycle_number": current_cycle,  # 🔧 Usar o current_cycle sincronizado
                "list_status": inventory.list_status if hasattr(inventory, 'list_status') else 'ABERTA',
                "total_items": len(items_data),
                "items": items_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar itens do inventário: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching inventory items")
        )

# =================================
# ENDPOINTS DE STORES - TEMPORÁRIO
# =================================

@app.get("/api/v1/stores", tags=["Stores"])
async def list_stores(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar lojas - ADMIN vê todas, outros veem apenas sua loja"""
    try:
        # ADMIN vê TODAS as lojas sem restrição
        if current_user.role == "ADMIN":
            stores = db.query(Store).filter(Store.is_active == True).order_by(Store.code).all()
            logger.info(f"✅ Admin {current_user.username} listando todas as {len(stores)} lojas")
        else:
            # Outros usuários veem apenas sua loja
            stores = db.query(Store).filter(
                Store.id == current_user.store_id,
                Store.is_active == True
            ).order_by(Store.code).all()
            logger.info(f"👤 Usuário {current_user.username} listando sua loja")
        
        return {
            "success": True,
            "message": f"Encontradas {len(stores)} lojas",
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
            ]
        }
    except Exception as e:
        logger.error(f"❌ Erro ao listar lojas: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@app.get("/api/v1/stores/{store_id}", tags=["Stores"])
async def get_store_info(
    store_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter informações de uma loja específica"""
    try:
        store = db.query(Store).filter(Store.id == store_id).first()
        
        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Store not found"
            )
        
        # ADMIN pode ver qualquer loja
        # ✅ v2.19.11: Comparar como strings para evitar problemas UUID vs str
        if current_user.role != "ADMIN" and str(current_user.store_id) != str(store.id):
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

@app.post("/api/v1/stores", tags=["Stores"])
async def create_store(
    store_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Criar nova loja (apenas ADMIN)"""
    try:
        # Apenas ADMIN pode criar lojas
        if current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem criar lojas"
            )
        
        import uuid
        from datetime import datetime
        
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
                    "success": True,
                    "message": f"Loja {existing_store.name} reativada com sucesso",
                    "data": {
                        "id": str(existing_store.id),
                        "code": existing_store.code,
                        "name": existing_store.name,
                        "description": existing_store.description,
                        "address": existing_store.address,
                        "phone": existing_store.phone,
                        "email": existing_store.email,
                        "is_active": existing_store.is_active
                    }
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

@app.put("/api/v1/stores/{store_id}", tags=["Stores"])
async def update_store(
    store_id: str,
    store_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualizar loja existente (apenas ADMIN)"""
    try:
        # Apenas ADMIN pode atualizar lojas
        if current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem atualizar lojas"
            )
        
        import uuid
        from datetime import datetime
        
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

@app.delete("/api/v1/stores/{store_id}", tags=["Stores"])
async def delete_store(
    store_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Excluir loja (soft delete - apenas desativa)"""
    try:
        # Apenas ADMIN pode excluir lojas
        if current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem excluir lojas"
            )
        
        from datetime import datetime
        
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

# =================================
# ROTAS DE TESTE
# =================================

# ✅ SEGURANÇA v2.19.13: Dependência para verificar se endpoints de teste estão habilitados
# Nota: app_settings já importado na linha 196

def require_test_endpoints():
    """Dependência que bloqueia endpoints de teste em produção"""
    if not app_settings.ENABLE_TEST_ENDPOINTS:
        raise HTTPException(
            status_code=403,
            detail="Endpoints de teste desabilitados neste ambiente"
        )
    return True

@app.get("/test/database", tags=["Testing"], dependencies=[Depends(require_test_endpoints)])
async def test_database(db: Session = Depends(get_db)):
    """Testar conexão com banco"""
    try:
        user_count = db.query(User).count()
        store_count = db.query(Store).count()
        product_count = db.query(Product).count()
        
        return {
            "status": "✅ Banco conectado",
            "counts": {
                "users": user_count,
                "stores": store_count,
                "products": product_count
            }
        }
    except Exception as e:
        return {"status": "❌ Erro no banco", "error": str(e)}

@app.post("/test/import-simple/{table_name}", tags=["Testing"], dependencies=[Depends(require_test_endpoints)])
async def import_simple_data(table_name: str, data: dict, db: Session = Depends(get_db)):
    """Endpoint simples para importação de dados - contorna problemas da API principal"""
    try:
        from sqlalchemy import text
        
        success_count = 0
        error_count = 0
        errors = []
        
        records = data.get('records', [])
        
        for record in records:
            try:
                # Aceitar tanto formato {data: {}} quanto {campo: valor} direto
                if 'data' in record:
                    record_data = record.get('data', {})
                else:
                    record_data = record
                
                # Criar savepoint para cada registro
                savepoint = db.begin_nested()
                
                if table_name.upper() == 'SBM010':
                    # Importação direta para SBM010
                    sql = text("""
                        INSERT INTO inventario.sbm010 (bm_filial, bm_grupo, bm_desc, is_active) 
                        VALUES (:bm_filial, :bm_grupo, :bm_desc, :is_active)
                        ON CONFLICT (bm_filial, bm_grupo) 
                        DO UPDATE SET
                            bm_desc = EXCLUDED.bm_desc,
                            updated_at = CURRENT_TIMESTAMP
                    """)
                    
                    # Limpar aspas duplas e espaços dos dados
                    bm_filial = str(record_data.get('bm_filial', '')).strip().strip('"').strip()
                    bm_grupo = str(record_data.get('bm_grupo', '')).strip().strip('"').strip()
                    bm_desc = str(record_data.get('bm_desc', '')).strip().strip('"').strip()
                    
                    db.execute(sql, {
                        'bm_filial': bm_filial,
                        'bm_grupo': bm_grupo,
                        'bm_desc': bm_desc,
                        'is_active': True
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SB1010':
                    # Importação direta para SB1010
                    sql = text("""
                        INSERT INTO inventario.sb1010 (
                            b1_filial, b1_cod, b1_codbar, b1_desc, b1_tipo, b1_um, 
                            b1_locpad, b1_grupo, b1_xcatgor, b1_xsubcat, b1_xsegmen, 
                            b1_rastro, b1_xgrinve
                        ) 
                        VALUES (
                            :b1_filial, :b1_cod, :b1_codbar, :b1_desc, :b1_tipo, :b1_um,
                            :b1_locpad, :b1_grupo, :b1_xcatgor, :b1_xsubcat, :b1_xsegmen,
                            :b1_rastro, :b1_xgrinve
                        )
                        ON CONFLICT (b1_filial, b1_cod) 
                        DO UPDATE SET
                            b1_desc = EXCLUDED.b1_desc,
                            b1_codbar = EXCLUDED.b1_codbar,
                            updated_at = CURRENT_TIMESTAMP
                    """)
                    
                    # Limpar aspas duplas e espaços dos dados SB1010
                    def clean_field(value, default=''):
                        return str(value if value else default).strip().strip('"').strip()
                    
                    db.execute(sql, {
                        'b1_filial': clean_field(record_data.get('b1_filial')),
                        'b1_cod': clean_field(record_data.get('b1_cod')),
                        'b1_codbar': clean_field(record_data.get('b1_codbar')),
                        'b1_desc': clean_field(record_data.get('b1_desc'), 'PRODUTO SEM DESCRIÇÃO'),
                        'b1_tipo': clean_field(record_data.get('b1_tipo'), 'PA'),
                        'b1_um': clean_field(record_data.get('b1_um'), 'UN'),
                        'b1_locpad': clean_field(record_data.get('b1_locpad'), '01'),
                        'b1_grupo': clean_field(record_data.get('b1_grupo')),
                        'b1_xcatgor': clean_field(record_data.get('b1_xcatgor')),
                        'b1_xsubcat': clean_field(record_data.get('b1_xsubcat')),
                        'b1_xsegmen': clean_field(record_data.get('b1_xsegmen')),
                        'b1_rastro': clean_field(record_data.get('b1_rastro'), 'N'),
                        'b1_xgrinve': clean_field(record_data.get('b1_xgrinve'))
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SB2010':
                    # Importação direta para SB2010 (Saldos por Local) - FILIAL EXCLUSIVO
                    sql = text("""
                        INSERT INTO inventario.sb2010 (b2_filial, b2_cod, b2_local, b2_qatu, b2_vatu1, b2_cm1, b2_qemp, b2_reserva)
                        VALUES (:b2_filial, :b2_cod, :b2_local, :b2_qatu, :b2_vatu1, :b2_cm1, :b2_qemp, :b2_reserva)
                        ON CONFLICT (b2_filial, b2_local, b2_cod) DO NOTHING
                    """)
                    
                    def clean_numeric(value, default=0):
                        try:
                            return float(str(value).strip().strip('"') or default)
                        except:
                            return default
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'b2_filial': clean_field(record_data.get('B2_FILIAL')),
                        'b2_cod': clean_field(record_data.get('B2_COD')),
                        'b2_local': clean_field(record_data.get('B2_LOCAL')),
                        'b2_qatu': clean_numeric(record_data.get('B2_QATU')),
                        'b2_vatu1': clean_numeric(record_data.get('B2_VATU1')),
                        'b2_cm1': clean_numeric(record_data.get('B2_CM1')),
                        'b2_qemp': clean_numeric(record_data.get('b2_qemp', 0)),
                        'b2_reserva': clean_numeric(record_data.get('b2_reserva', 0))
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SB8010':
                    # Importação direta para SB8010 (Saldos por Lote)
                    sql = text("""
                        INSERT INTO inventario.sb8010 (id, b8_filial, b8_produto, b8_local, b8_lotectl, b8_numlote, b8_saldo, b8_dtvalid)
                        VALUES (gen_random_uuid(), :b8_filial, :b8_produto, :b8_local, :b8_lotectl, :b8_numlote, :b8_saldo, :b8_dtvalid)
                    """)
                    
                    def clean_numeric(value, default=0):
                        try:
                            return float(str(value).strip().strip('"') or default)
                        except:
                            return default
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'b8_filial': clean_field(record_data.get('b8_filial')),
                        'b8_produto': clean_field(record_data.get('b8_produto')),
                        'b8_local': clean_field(record_data.get('b8_local')),
                        'b8_lotectl': clean_field(record_data.get('b8_lotectl')),
                        'b8_numlote': clean_field(record_data.get('b8_numlote')),
                        'b8_saldo': clean_numeric(record_data.get('b8_saldo')),
                        'b8_dtvalid': clean_field(record_data.get('b8_dtvalid'))
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SZD010':
                    # Importação direta para SZD010 (Categorias) - FILIAL COMPARTILHADO
                    sql = text("""
                        INSERT INTO inventario.szd010 (zd_filial, zd_xcod, zd_xdesc, is_active) 
                        VALUES (:zd_filial, :zd_xcod, :zd_xdesc, :is_active)
                        ON CONFLICT (zd_filial, zd_xcod) DO NOTHING
                    """)
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'zd_filial': clean_field(record_data.get('zd_filial')),
                        'zd_xcod': clean_field(record_data.get('zd_codigo')),
                        'zd_xdesc': clean_field(record_data.get('zd_desc')),
                        'is_active': True
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SZE010':
                    # Importação direta para SZE010 (Subcategorias) - FILIAL COMPARTILHADO
                    sql = text("""
                        INSERT INTO inventario.sze010 (ze_filial, ze_xcod, ze_xdesc, is_active) 
                        VALUES (:ze_filial, :ze_xcod, :ze_xdesc, :is_active)
                        ON CONFLICT (ze_filial, ze_xcod) DO NOTHING
                    """)
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'ze_filial': clean_field(record_data.get('ze_filial')),
                        'ze_xcod': clean_field(record_data.get('ze_codigo')),
                        'ze_xdesc': clean_field(record_data.get('ze_desc')),
                        'is_active': True
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SZF010':
                    # Importação direta para SZF010 (Segmentos) - FILIAL COMPARTILHADO
                    sql = text("""
                        INSERT INTO inventario.szf010 (zf_filial, zf_xcod, zf_xdesc, is_active) 
                        VALUES (:zf_filial, :zf_xcod, :zf_xdesc, :is_active)
                        ON CONFLICT (zf_filial, zf_xcod) DO NOTHING
                    """)
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'zf_filial': clean_field(record_data.get('zf_filial')),
                        'zf_xcod': clean_field(record_data.get('zf_codigo')),
                        'zf_xdesc': clean_field(record_data.get('zf_desc')),
                        'is_active': True
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SBZ010':
                    # Importação direta para SBZ010 (Produtos Complemento) - FILIAL EXCLUSIVO
                    sql = text("""
                        INSERT INTO inventario.sbz010 (bz_filial, bz_cod, bz_local, bz_xlocal1, bz_xlocal2, bz_xlocal3, is_active)
                        VALUES (:bz_filial, :bz_cod, :bz_local, :bz_xlocal1, :bz_xlocal2, :bz_xlocal3, :is_active)
                        ON CONFLICT (bz_filial, bz_cod) 
                        DO UPDATE SET
                            bz_local = EXCLUDED.bz_local,
                            bz_xlocal1 = EXCLUDED.bz_xlocal1,
                            bz_xlocal2 = EXCLUDED.bz_xlocal2,
                            bz_xlocal3 = EXCLUDED.bz_xlocal3,
                            is_active = EXCLUDED.is_active,
                            updated_at = CURRENT_TIMESTAMP
                    """)
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'bz_filial': clean_field(record_data.get('bz_filial')),
                        'bz_cod': clean_field(record_data.get('bz_cod')),
                        'bz_local': clean_field(record_data.get('bz_local')),
                        'bz_xlocal1': clean_field(record_data.get('bz_xlocal1')),
                        'bz_xlocal2': clean_field(record_data.get('bz_xlocal2')),
                        'bz_xlocal3': clean_field(record_data.get('bz_xlocal3')),
                        'is_active': True
                    })
                    savepoint.commit()
                    success_count += 1
                    
                elif table_name.upper() == 'SLK010':
                    # Importação direta para SLK010 (Códigos de Barras) - FILIAL COMPARTILHADO
                    # Códigos de barras são compartilhados com todas as filiais
                    sql = text("""
                        INSERT INTO inventario.slk010 (id, slk_filial, slk_codbar, slk_produto, is_active)
                        VALUES (gen_random_uuid(), :slk_filial, :slk_codbar, :slk_produto, :is_active)
                    """)
                    
                    def clean_field(value, default=''):
                        return str(value or default).strip().strip('"').strip()[:50]
                    
                    db.execute(sql, {
                        'slk_filial': clean_field(record_data.get('SLK_FILIAL')),
                        'slk_codbar': clean_field(record_data.get('SLK_CODBAR')),
                        'slk_produto': clean_field(record_data.get('SLK_PRODUTO')),
                        'is_active': True
                    })
                    savepoint.commit()
                    success_count += 1
                    
                else:
                    errors.append({
                        "line": record.get('line_number', 0),
                        "error": f"Tabela {table_name} não suportada neste endpoint"
                    })
                    error_count += 1
                    
            except Exception as e:
                try:
                    savepoint.rollback()
                except:
                    pass
                error_count += 1
                errors.append({
                    "line": record.get('line_number', 0),
                    "error": str(e)
                })
        
        if success_count > 0:
            db.commit()
            
        return {
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors,
            "total_processed": len(records)
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro na importação simples: {str(e)}")
        return {"success_count": 0, "error_count": len(data.get('records', [])), "errors": [{"error": str(e)}]}

@app.post("/test/advance-cycle/{inventory_id}", tags=["Testing"], dependencies=[Depends(require_test_endpoints)])
async def test_advance_cycle(inventory_id: str, cycle: int = 1, db: Session = Depends(get_db)):
    """Testar avanço de ciclo - simulando encerramento de rodada"""
    try:
        from app.models.models import InventoryList, InventoryItem, User
        import uuid

        # Buscar inventário
        inventory = db.query(InventoryList).filter(InventoryList.id == uuid.UUID(inventory_id)).first()
        if not inventory:
            return {"success": False, "message": "Inventário não encontrado"}

        print(f"🎯 [TESTE] Antes: Ciclo {inventory.current_cycle}, Status: {inventory.list_status}")

        # Buscar primeiro usuário para simular encerramento
        user = db.query(User).filter(User.username == "clenio").first()
        if not user:
            return {"success": False, "message": "Usuário clenio não encontrado"}

        # Simular encerramento de rodada
        count_round = f"{user.id}_1"  # Formato: user_id_round

        # Chamar endpoint de encerramento
        result = await close_counting_round(inventory_id, count_round, user, db)

        # Refresh para pegar valores atualizados
        db.refresh(inventory)

        print(f"🎯 [TESTE] Depois: Ciclo {inventory.current_cycle}, Status: {inventory.list_status}")

        return {
            "success": result.get("success", False),
            "message": f"Teste de avanço de ciclo executado",
            "before": {"cycle": cycle, "status": "EM_CONTAGEM"},
            "after": {"cycle": inventory.current_cycle, "status": inventory.list_status},
            "close_result": result
        }

    except Exception as e:
        return {"success": False, "message": f"Erro: {str(e)}"}

@app.post("/test/create-admin", tags=["Testing"], dependencies=[Depends(require_test_endpoints)])
async def create_admin_user(db: Session = Depends(get_db)):
    """Criar usuário admin para teste"""
    try:
        # Verificar se admin já existe
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            return {"message": "Admin já existe"}
        
        # Criar loja padrão se não existir
        store = db.query(Store).filter(Store.code == "001").first()
        if not store:
            store = Store(
                code="001",
                name="Loja Matriz",
                is_active=True
            )
            db.add(store)
            db.commit()
            db.refresh(store)
        
        # Criar admin
        admin_user = User(
            username="admin",
            password_hash=hash_password("admin123"),
            full_name="Administrador do Sistema",
            email="admin@sistema.com",
            role="ADMIN",
            store_id=store.id,
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        
        return {
            "message": "✅ Admin criado com sucesso",
            "username": "admin",
            "password": "admin123"
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao criar admin: {e}")
        return {"status": "❌ Erro", "error": str(e)}

# =================================
# ENDPOINTS DE PRODUTOS PARA INVENTÁRIO 
# =================================

@app.get("/api/v1/inventory/product-filters", tags=["Inventory"])
async def get_product_filter_options(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter opções para filtros de produtos"""
    try:
        from app.models.models import SB1010
        from sqlalchemy import func, distinct
        
        # Buscar valores únicos para os filtros
        grupos = db.query(distinct(SB1010.b1_grupo)).filter(SB1010.b1_grupo.isnot(None)).order_by(SB1010.b1_grupo).all()
        categorias = db.query(distinct(SB1010.b1_xcatgor)).filter(SB1010.b1_xcatgor.isnot(None)).order_by(SB1010.b1_xcatgor).all()
        subcategorias = db.query(distinct(SB1010.b1_xsubcat)).filter(SB1010.b1_xsubcat.isnot(None)).order_by(SB1010.b1_xsubcat).all()
        segmentos = db.query(distinct(SB1010.b1_xsegmen)).filter(SB1010.b1_xsegmen.isnot(None)).order_by(SB1010.b1_xsegmen).all()
        grupos_inv = db.query(distinct(SB1010.b1_xgrinve)).filter(SB1010.b1_xgrinve.isnot(None)).order_by(SB1010.b1_xgrinve).all()
        
        return {
            "grupos": [g[0] for g in grupos if g[0]],
            "categorias": [c[0] for c in categorias if c[0]], 
            "subcategorias": [s[0] for s in subcategorias if s[0]],
            "segmentos": [seg[0] for seg in segmentos if seg[0]],
            "grupos_inventario": [gi[0] for gi in grupos_inv if gi[0]]
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar opções de filtros: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar filtros"))

@app.post("/api/v1/inventory/filter-products", tags=["Inventory"])
async def filter_products_for_inventory(
    filters: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Filtrar produtos para adicionar ao inventário com informações de status"""
    
    # 🔍 DEBUG FORÇADO: Log todos os filtros recebidos
    logger.info(f"🔍🔍🔍 FILTROS RECEBIDOS NO INÍCIO: {filters}")
    logger.info(f"🔍🔍🔍 TIPO DOS FILTROS: {type(filters)}")
    logger.info(f"🔍🔍🔍 CHAVES DOS FILTROS: {list(filters.keys()) if filters else 'Nenhuma'}")
    
    try:
        from app.models.models import SB1010, SB2010, SB8010, SBZ010, InventoryItem, InventoryList, Store
        from sqlalchemy import and_, or_, func, case, text

        # ✅ CORREÇÃO: Buscar store_code ANTES de usar na query (evita lazy load error)
        store_code_suffix = '01'  # Default
        if current_user.store_id:
            store = db.query(Store).filter(Store.id == current_user.store_id).first()
            if store and store.code:
                store_code_suffix = store.code[-2:].zfill(2)

        logger.info(f"🏪 Store code suffix: {store_code_suffix}")

        # 🏭 CONCEITO DO ARMAZÉM: Incluir JOIN com SB2010 para trazer estoque
        # Determinar o armazém a filtrar (vem do inventário ou do filtro)
        target_warehouse = filters.get("local", "02")  # Default para armazém 02
        current_inventory_id = filters.get("inventory_id")  # ID do inventário atual
        
        # Query base com LEFT JOIN para incluir localizações, ESTOQUE e STATUS de inventário
        # Criar subqueries para diferentes status de inventário
        from sqlalchemy.orm import aliased
        
        # Alias para diferentes relações de inventário
        InventoryItemOther = aliased(InventoryItem)
        InventoryListOther = aliased(InventoryList)
        InventoryItemCurrent = aliased(InventoryItem)
        
        # ✅ CORREÇÃO: Usar DISTINCT para evitar duplicações
        query = db.query(
            SB1010, 
            SB2010, 
            SBZ010,
            # Status em outros inventários ativos
            case(
                (InventoryItemOther.id.isnot(None), "IN_OTHER_INVENTORY"),
                (InventoryItemCurrent.id.isnot(None), "IN_CURRENT_INVENTORY"),
                else_="AVAILABLE"
            ).label("inventory_status"),
            # 🔧 CORREÇÃO: Só mostrar nome quando realmente é outro inventário
            case(
                (InventoryItemOther.id.isnot(None), InventoryListOther.name),
                else_=None
            ).label("other_inventory_name")
        ).distinct().outerjoin(
            SBZ010, and_(
                SB1010.b1_cod == SBZ010.bz_cod,
                or_(
                    SBZ010.bz_filial == store_code_suffix,  # ✅ Filial correta
                    SBZ010.bz_filial == '',                 # ✅ v2.15.2: Aceitar filial vazia (dados importados)
                    SBZ010.bz_filial.is_(None)              # ✅ v2.15.2: Aceitar NULL
                )
            )
        ).join(  # ✅ v2.15.2: INNER JOIN para garantir que apenas produtos com estoque no armazém apareçam
            SB2010, and_(
                func.trim(SB1010.b1_cod) == func.trim(SB2010.b2_cod),
                SB2010.b2_local == target_warehouse,  # Filtrar pelo armazém específico
                or_(
                    SB2010.b2_filial == store_code_suffix,  # ✅ Filial correta
                    SB2010.b2_filial == '',                 # ✅ v2.15.2: Aceitar filial vazia (dados importados)
                    SB2010.b2_filial.is_(None)              # ✅ v2.15.2: Aceitar NULL
                )
            )
        ).outerjoin(
            InventoryListOther, and_(
                # 🎯 LÓGICA CORRETA: Inventários ATIVOS (não finalizados) bloqueiam produtos
                # DRAFT = Em preparação (bloqueia - inventário ativo)
                # IN_PROGRESS = Em andamento (bloqueia - inventário ativo)
                # COMPLETED = Finalizado (NÃO bloqueia)
                # CLOSED = Encerrado (NÃO bloqueia)
                InventoryListOther.status.in_(["DRAFT", "IN_PROGRESS"]),        # Apenas inventários ativos bloqueiam
                InventoryListOther.store_id == current_user.store_id,           # Mesma loja
                InventoryListOther.id != current_inventory_id,                  # Não o inventário atual
                InventoryListOther.warehouse == target_warehouse                # ✅ NOVO v2.15.0: Mesmo armazém (produto + armazém)
            )
        ).outerjoin(
            InventoryItemOther, and_(
                func.trim(SB1010.b1_cod) == func.trim(InventoryItemOther.product_code),
                InventoryItemOther.inventory_list_id == InventoryListOther.id  # DEPOIS: Produtos apenas dos inventários ativos
            )
        ).outerjoin(
            InventoryItemCurrent, and_(
                func.trim(SB1010.b1_cod) == func.trim(InventoryItemCurrent.product_code),
                InventoryItemCurrent.inventory_list_id == current_inventory_id  # Inventário atual
            )
        )
        
        # 🆕 NOVOS FILTROS DE PRODUTO E DESCRIÇÃO
        logger.info(f"⚠️ CHEGOU NO CÓDIGO DE FILTRO! Verificando produto_from e produto_to...")
        logger.info(f"⚠️ produto_from = {filters.get('produto_from')}, produto_to = {filters.get('produto_to')}")
        logger.info(f"⚠️ Condição AND = {filters.get('produto_from') and filters.get('produto_to')}")

        if filters.get("produto_from") and filters.get("produto_to"):
            # TRIM para lidar com códigos com espaços em branco
            logger.info(f"🔍 FILTRO PRODUTO APLICADO: De '{filters['produto_from']}' Até '{filters['produto_to']}'")
            query = query.filter(and_(
                func.trim(SB1010.b1_cod) >= filters["produto_from"].strip(),
                func.trim(SB1010.b1_cod) <= filters["produto_to"].strip()
            ))
        elif filters.get("produto_from"):
            logger.info(f"🔍 FILTRO PRODUTO (APENAS DE): '{filters['produto_from']}'")
            query = query.filter(func.trim(SB1010.b1_cod) >= filters["produto_from"].strip())
        elif filters.get("produto_to"):
            query = query.filter(func.trim(SB1010.b1_cod) <= filters["produto_to"].strip())

        if filters.get("descricao"):
            termo = filters["descricao"].strip()
            # Buscar por código OU descrição
            query = query.filter(or_(
                func.trim(SB1010.b1_cod).ilike(f"%{termo}%"),
                SB1010.b1_desc.ilike(f"%{termo}%")
            ))

        # Aplicar filtros conforme documentação
        if filters.get("grupo_de") and filters.get("grupo_ate"):
            query = query.filter(and_(
                SB1010.b1_grupo >= filters["grupo_de"],
                SB1010.b1_grupo <= filters["grupo_ate"]
            ))
        elif filters.get("grupo_de"):
            query = query.filter(SB1010.b1_grupo >= filters["grupo_de"])
        elif filters.get("grupo_ate"):
            query = query.filter(SB1010.b1_grupo <= filters["grupo_ate"])
            
        if filters.get("categoria_de") and filters.get("categoria_ate"):
            query = query.filter(and_(
                SB1010.b1_xcatgor >= filters["categoria_de"],
                SB1010.b1_xcatgor <= filters["categoria_ate"]
            ))
        elif filters.get("categoria_de"):
            query = query.filter(SB1010.b1_xcatgor >= filters["categoria_de"])
        elif filters.get("categoria_ate"):
            query = query.filter(SB1010.b1_xcatgor <= filters["categoria_ate"])
            
        if filters.get("subcategoria_de") and filters.get("subcategoria_ate"):
            query = query.filter(and_(
                SB1010.b1_xsubcat >= filters["subcategoria_de"],
                SB1010.b1_xsubcat <= filters["subcategoria_ate"]
            ))
            
        if filters.get("segmento_de") and filters.get("segmento_ate"):
            query = query.filter(and_(
                SB1010.b1_xsegmen >= filters["segmento_de"],
                SB1010.b1_xsegmen <= filters["segmento_ate"]
            ))
            
        if filters.get("grupo_inv_de") and filters.get("grupo_inv_ate"):
            query = query.filter(and_(
                SB1010.b1_xgrinve >= filters["grupo_inv_de"],
                SB1010.b1_xgrinve <= filters["grupo_inv_ate"]
            ))
            
        # 🎯 NOVO: Filtros de localização (SBZ010) - FILIAL JÁ ESTÁ NO JOIN
        if filters.get("local1_from") and filters.get("local1_to"):
            query = query.filter(and_(
                SBZ010.bz_xlocal1 >= filters["local1_from"],
                SBZ010.bz_xlocal1 <= filters["local1_to"]
            ))
        elif filters.get("local1_from"):
            query = query.filter(SBZ010.bz_xlocal1 >= filters["local1_from"])
        elif filters.get("local1_to"):
            query = query.filter(SBZ010.bz_xlocal1 <= filters["local1_to"])
            
        if filters.get("local2_from") and filters.get("local2_to"):
            query = query.filter(and_(
                SBZ010.bz_xlocal2 >= filters["local2_from"],
                SBZ010.bz_xlocal2 <= filters["local2_to"]
            ))
        elif filters.get("local2_from"):
            query = query.filter(SBZ010.bz_xlocal2 >= filters["local2_from"])
        elif filters.get("local2_to"):
            query = query.filter(SBZ010.bz_xlocal2 <= filters["local2_to"])
            
        if filters.get("local3_from") and filters.get("local3_to"):
            query = query.filter(and_(
                SBZ010.bz_xlocal3 >= filters["local3_from"],
                SBZ010.bz_xlocal3 <= filters["local3_to"]
            ))
        elif filters.get("local3_from"):
            query = query.filter(SBZ010.bz_xlocal3 >= filters["local3_from"])
        elif filters.get("local3_to"):
            query = query.filter(SBZ010.bz_xlocal3 <= filters["local3_to"])
        
        # 📄 IMPLEMENTAR PAGINAÇÃO
        page = filters.get("page", 1)
        size = filters.get("size", 50)
        offset = (page - 1) * size
        
        # 🔍 DEBUG: Mostrar SQL gerado para análise
        from sqlalchemy.dialects import postgresql
        compiled_query = query.statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
        logger.info(f"🔍 SQL GERADO PARA FILTROS:")
        logger.info(f"{compiled_query}")
        logger.info(f"🔍 FILTROS RECEBIDOS: {filters}")
        
        # Contar total de produtos (APÓS todos os filtros)
        total_count = query.count()
        logger.info(f"🔍 TOTAL DE PRODUTOS ENCONTRADOS APÓS FILTROS: {total_count}")
        
        # 🔧 CORREÇÃO: Buscar TODOS os produtos primeiro (sem paginação para processar únicos)
        resultados = query.order_by(SB1010.b1_cod).all()
        
        # Converter para formato da API incluindo ESTOQUE (SB2010), localizações (SBZ010) e STATUS
        produtos_filtrados = []
        # ✅ CORREÇÃO: Usar dicionário para rastrear produtos únicos
        produtos_unicos = {}

        for sb1_produto, sb2_estoque, sbz_localizacao, inventory_status, other_inventory_name in resultados:
            produto_codigo = sb1_produto.b1_cod.strip()

            # Se produto já existe e tem status "IN_OTHER_INVENTORY", manter esse status
            if produto_codigo in produtos_unicos:
                if inventory_status == "IN_OTHER_INVENTORY":
                    produtos_unicos[produto_codigo]["inventory_status"] = "IN_OTHER_INVENTORY"
                    produtos_unicos[produto_codigo]["other_inventory_name"] = other_inventory_name
                    produtos_unicos[produto_codigo]["is_in_other_inventory"] = True
                continue
            # ✅ v2.19.55 - CORREÇÃO: Sempre usar B2_QATU como saldo de referência (é o saldo oficial do ERP Protheus)
            # Para produtos com lote, SUM(B8_SALDO) pode divergir de B2_QATU por ajustes pendentes no ERP
            calculated_quantity = float(sb2_estoque.b2_qatu) if sb2_estoque and sb2_estoque.b2_qatu else 0.0

            produto_data = {
                # Dados do produto (SB1010)
                "b1_cod": sb1_produto.b1_cod,
                "b1_desc": sb1_produto.b1_desc,
                "b1_grupo": sb1_produto.b1_grupo,
                "b1_xcatgor": sb1_produto.b1_xcatgor,
                "b1_xsubcat": sb1_produto.b1_xsubcat,
                "b1_xsegmen": sb1_produto.b1_xsegmen,
                "b1_xgrinve": sb1_produto.b1_xgrinve,
                "b1_rastro": sb1_produto.b1_rastro,
                "b1_um": sb1_produto.b1_um,

                # 🏭 CONCEITO DO ARMAZÉM: Dados de estoque (SB2010 ou SUM de SB8010)
                "b2_local": sb2_estoque.b2_local if sb2_estoque else target_warehouse,
                "b2_qatu": calculated_quantity,  # ✅ CORRIGIDO: Usa soma de lotes se necessário
                "b2_xentpos": float(sb2_estoque.b2_xentpos) if sb2_estoque and sb2_estoque.b2_xentpos else 0.0,  # ✅ v2.17.0
                "warehouse_code": sb2_estoque.b2_local if sb2_estoque else target_warehouse,
                "current_quantity": calculated_quantity,  # ✅ CORRIGIDO: Usa soma de lotes se necessário
                
                # 🆕 LOCALIZAÇÕES da SBZ010
                "local1": sbz_localizacao.bz_xlocal1.strip() if sbz_localizacao and sbz_localizacao.bz_xlocal1 else "",
                "local2": sbz_localizacao.bz_xlocal2.strip() if sbz_localizacao and sbz_localizacao.bz_xlocal2 else "",
                "local3": sbz_localizacao.bz_xlocal3.strip() if sbz_localizacao and sbz_localizacao.bz_xlocal3 else "",
                
                # 📊 STATUS DO PRODUTO EM INVENTÁRIOS
                "inventory_status": inventory_status,
                "other_inventory_name": other_inventory_name,
                "is_in_other_inventory": inventory_status == "IN_OTHER_INVENTORY",
                "is_in_current_inventory": inventory_status == "IN_CURRENT_INVENTORY"
            }
            
            produtos_unicos[produto_codigo] = produto_data
        
        
        # Converter dicionário para lista - TODOS os produtos únicos
        todos_produtos_unicos = list(produtos_unicos.values())

        # 🔍 DEBUG: Mostrar códigos dos produtos retornados
        codigos_retornados = [p['b1_cod'] for p in todos_produtos_unicos]
        logger.info(f"🔍 CÓDIGOS DOS PRODUTOS RETORNADOS: {codigos_retornados[:10]}... (total: {len(codigos_retornados)})")

        # 📄 APLICAR PAGINAÇÃO DEPOIS DO PROCESSAMENTO ÚNICO
        filtered_total_count = len(todos_produtos_unicos)
        
        # Aplicar paginação na lista processada
        produtos_filtrados = todos_produtos_unicos[offset:offset + size]
        
        # Calcular informações de paginação baseado no total REAL
        total_pages = (filtered_total_count + size - 1) // size if filtered_total_count > 0 else 1
        
        logger.info(f"✅ Filtrados {filtered_total_count} produtos (página {page}/{total_pages}, total original: {total_count})")
        
        return {
            "produtos": produtos_filtrados,
            "total": len(produtos_filtrados),       # Produtos na página atual
            "total_count": filtered_total_count,    # 🔧 CORREÇÃO: Total de produtos FILTRADOS
            "page": page,                           # Página atual
            "total_pages": total_pages,             # Total de páginas baseado no filtrado
            "size": size,                           # Itens por página
            "has_next": page < total_pages,         # Tem próxima página
            "has_prev": page > 1,                   # Tem página anterior
            "filtros_aplicados": filters,
            "total_original": total_count           # Total sem filtros (para debug)
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao filtrar produtos: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao filtrar produtos"))

@app.post("/api/v1/inventory/filter-products/codes", tags=["Inventory"])
async def filter_products_codes_only(
    filters: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retorna apenas os códigos de produto que correspondem ao filtro.
    Endpoint leve para funcionalidade 'Adicionar todos do filtro'.
    """
    try:
        from app.models.models import SB1010, SB2010, SBZ010, InventoryItem, InventoryList, Store
        from sqlalchemy import and_, or_, func, case

        store_code_suffix = '01'
        if current_user.store_id:
            store = db.query(Store).filter(Store.id == current_user.store_id).first()
            if store and store.code:
                store_code_suffix = store.code[-2:].zfill(2)

        target_warehouse = filters.get("local", "02")
        current_inventory_id = filters.get("inventory_id")

        # Query leve: apenas códigos distintos de produtos no armazém
        query = db.query(
            func.trim(SB1010.b1_cod).label("code")
        ).distinct().join(
            SB2010, and_(
                func.trim(SB1010.b1_cod) == func.trim(SB2010.b2_cod),
                SB2010.b2_local == target_warehouse,
                or_(
                    SB2010.b2_filial == store_code_suffix,
                    SB2010.b2_filial == '',
                    SB2010.b2_filial.is_(None)
                )
            )
        )

        # Excluir produtos já no inventário atual
        if current_inventory_id:
            query = query.filter(
                ~SB1010.b1_cod.in_(
                    db.query(func.trim(InventoryItem.product_code)).filter(
                        InventoryItem.inventory_list_id == current_inventory_id
                    )
                )
            )

        # Aplicar mesmos filtros de range
        if filters.get("produto_from") and filters.get("produto_to"):
            query = query.filter(and_(func.trim(SB1010.b1_cod) >= filters["produto_from"].strip(), func.trim(SB1010.b1_cod) <= filters["produto_to"].strip()))
        elif filters.get("produto_from"):
            query = query.filter(func.trim(SB1010.b1_cod) >= filters["produto_from"].strip())
        elif filters.get("produto_to"):
            query = query.filter(func.trim(SB1010.b1_cod) <= filters["produto_to"].strip())

        if filters.get("descricao"):
            termo = filters["descricao"].strip()
            query = query.filter(or_(
                func.trim(SB1010.b1_cod).ilike(f"%{termo}%"),
                SB1010.b1_desc.ilike(f"%{termo}%")
            ))

        if filters.get("grupo_de"):
            query = query.filter(SB1010.b1_grupo >= filters["grupo_de"])
        if filters.get("grupo_ate"):
            query = query.filter(SB1010.b1_grupo <= filters["grupo_ate"])
        if filters.get("categoria_de"):
            query = query.filter(SB1010.b1_xcatgor >= filters["categoria_de"])
        if filters.get("categoria_ate"):
            query = query.filter(SB1010.b1_xcatgor <= filters["categoria_ate"])
        if filters.get("subcategoria_de"):
            query = query.filter(SB1010.b1_xsubcat >= filters["subcategoria_de"])
        if filters.get("subcategoria_ate"):
            query = query.filter(SB1010.b1_xsubcat <= filters["subcategoria_ate"])
        if filters.get("segmento_de"):
            query = query.filter(SB1010.b1_xsegmen >= filters["segmento_de"])
        if filters.get("segmento_ate"):
            query = query.filter(SB1010.b1_xsegmen <= filters["segmento_ate"])
        if filters.get("grupo_inv_de"):
            query = query.filter(SB1010.b1_xgrinve >= filters["grupo_inv_de"])
        if filters.get("grupo_inv_ate"):
            query = query.filter(SB1010.b1_xgrinve <= filters["grupo_inv_ate"])

        # Localização (requer JOIN com SBZ010)
        needs_sbz = any(filters.get(k) for k in ['local1_from', 'local1_to', 'local2_from', 'local2_to', 'local3_from', 'local3_to'])
        if needs_sbz:
            query = query.outerjoin(SBZ010, and_(SB1010.b1_cod == SBZ010.bz_cod, or_(SBZ010.bz_filial == store_code_suffix, SBZ010.bz_filial == '', SBZ010.bz_filial.is_(None))))
            if filters.get("local1_from"): query = query.filter(SBZ010.bz_xlocal1 >= filters["local1_from"])
            if filters.get("local1_to"): query = query.filter(SBZ010.bz_xlocal1 <= filters["local1_to"])
            if filters.get("local2_from"): query = query.filter(SBZ010.bz_xlocal2 >= filters["local2_from"])
            if filters.get("local2_to"): query = query.filter(SBZ010.bz_xlocal2 <= filters["local2_to"])
            if filters.get("local3_from"): query = query.filter(SBZ010.bz_xlocal3 >= filters["local3_from"])
            if filters.get("local3_to"): query = query.filter(SBZ010.bz_xlocal3 <= filters["local3_to"])

        results = query.order_by(func.trim(SB1010.b1_cod)).all()
        codes = [row.code.strip() for row in results]

        logger.info(f"✅ filter-products/codes: {len(codes)} códigos retornados")
        return {"codes": codes, "total": len(codes)}

    except Exception as e:
        logger.error(f"❌ Erro ao buscar códigos de produtos: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar códigos de produtos"))


@app.get("/api/v1/inventories/{inventory_id}/items-for-assignment/ids", tags=["Counting Lists"])
async def get_items_for_assignment_ids(
    inventory_id: str,
    list_id: str = Query(None),
    search: str = Query(None),
    assignment_status: str = Query("AVAILABLE"),
    grupo_de: str = Query(None), grupo_ate: str = Query(None),
    categoria_de: str = Query(None), categoria_ate: str = Query(None),
    subcategoria_de: str = Query(None), subcategoria_ate: str = Query(None),
    segmento_de: str = Query(None), segmento_ate: str = Query(None),
    grupo_inv_de: str = Query(None), grupo_inv_ate: str = Query(None),
    local1_from: str = Query(None), local1_to: str = Query(None),
    local2_from: str = Query(None), local2_to: str = Query(None),
    local3_from: str = Query(None), local3_to: str = Query(None),
    db: Session = Depends(get_db),
):
    """
    Retorna apenas os IDs de itens que correspondem ao filtro.
    Endpoint leve para funcionalidade 'Adicionar todos do filtro'.
    """
    try:
        from app.models.models import InventoryList, InventoryItem, InventoryItemSnapshot, CountingList, CountingListItem
        import uuid

        inventory_uuid = uuid.UUID(inventory_id)
        list_uuid = uuid.UUID(list_id) if list_id else None

        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_uuid).first()
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # Subquery de atribuição
        cli_subq = db.query(
            CountingListItem.inventory_item_id,
            CountingListItem.counting_list_id,
        ).join(
            CountingList, CountingList.id == CountingListItem.counting_list_id
        ).filter(
            CountingList.inventory_id == inventory_uuid
        ).subquery()

        # Query: apenas IDs
        query = db.query(
            InventoryItem.id
        ).outerjoin(
            InventoryItemSnapshot, InventoryItemSnapshot.inventory_item_id == InventoryItem.id
        ).outerjoin(
            cli_subq, cli_subq.c.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        )

        # Filtro de busca
        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter((InventoryItem.product_code.ilike(search_term)) | (InventoryItemSnapshot.b1_desc.ilike(search_term)))

        # Filtros range
        def apply_range(col, val_de, val_ate):
            nonlocal query
            if val_de: query = query.filter(col >= val_de.strip())
            if val_ate: query = query.filter(col <= val_ate.strip())

        apply_range(InventoryItemSnapshot.b1_grupo, grupo_de, grupo_ate)
        apply_range(InventoryItemSnapshot.b1_xcatgor, categoria_de, categoria_ate)
        apply_range(InventoryItemSnapshot.b1_xsubcat, subcategoria_de, subcategoria_ate)
        apply_range(InventoryItemSnapshot.b1_xsegmen, segmento_de, segmento_ate)
        apply_range(InventoryItemSnapshot.b1_xgrinve, grupo_inv_de, grupo_inv_ate)
        apply_range(InventoryItemSnapshot.bz_xlocal1, local1_from, local1_to)
        apply_range(InventoryItemSnapshot.bz_xlocal2, local2_from, local2_to)
        apply_range(InventoryItemSnapshot.bz_xlocal3, local3_from, local3_to)

        # Filtro assignment_status no SQL
        if assignment_status == "AVAILABLE":
            query = query.filter(cli_subq.c.counting_list_id == None)
        elif assignment_status == "IN_LIST" and list_uuid:
            query = query.filter(cli_subq.c.counting_list_id == list_uuid)
        elif assignment_status == "IN_OTHER_LIST":
            if list_uuid:
                query = query.filter(cli_subq.c.counting_list_id != None, cli_subq.c.counting_list_id != list_uuid)
            else:
                query = query.filter(cli_subq.c.counting_list_id != None)

        results = query.order_by(InventoryItem.sequence).all()
        ids = [str(row.id) for row in results]

        logger.info(f"✅ items-for-assignment/ids: {len(ids)} IDs retornados")
        return {"ids": ids, "total": len(ids)}

    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar IDs de itens: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@app.post("/api/v1/inventory/lists/{inventory_id}/add-products", tags=["Inventory"])
async def add_products_to_inventory(
    inventory_id: str,
    request: dict,  # {"product_codes": ["001", "002", "003"], "warehouse_location": "01"}
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ✅ ENDPOINT ROBUSTO - Adicionar produtos selecionados ao inventário
    
    Proteções implementadas:
    1. Validação robusta de dados
    2. Fallback para errors
    3. Transações seguras
    4. Zero foreign keys
    5. Graceful degradation
    """
    from app.core.robust_framework import RobustValidator, safe_query, safe_json_response, resilient_db_session
    import traceback
    try:
        from app.models.models import InventoryList, InventoryItem, SB1010, SB2010, Store
        import uuid
        
        # ✅ VALIDAÇÃO ROBUSTA - Nunca falha
        validator = RobustValidator()
        
        # Validar UUID de forma segura
        try:
            inventory_uuid = uuid.UUID(validator.safe_string(inventory_id))
        except (ValueError, TypeError):
            return safe_json_response({
                "message": "❌ ID de inventário inválido",
                "success": False
            }, success=False)
        
        # Buscar inventário de forma resiliente
        inventory_for_check = check_inventory_access(db, inventory_uuid, current_user)
        check_inventory_not_closed(inventory_for_check)

        inventory = safe_query(
            db,
            lambda: inventory_for_check,
            fallback=None,
            log_prefix=f"check_inventory_{inventory_id}"
        )
        
        if not inventory:
            return safe_json_response({
                "message": "❌ Inventário não encontrado ou sem acesso",
                "success": False
            }, success=False)
        
        # Validar lista de produtos de forma robusta
        raw_product_codes = request.get("product_codes", [])
        if not isinstance(raw_product_codes, list):
            raw_product_codes = [raw_product_codes] if raw_product_codes else []
        
        # Limpar e validar códigos de produtos
        product_codes = [
            validator.safe_string(code).upper() 
            for code in raw_product_codes 
            if validator.safe_string(code).strip()
        ]
        
        if not product_codes:
            return safe_json_response({
                "message": "⚠️ Nenhum produto válido selecionado", 
                "success": False
            }, success=False)
        
        # ✅ USAR o armazém já definido no inventário
        warehouse_location = inventory.warehouse or "01"
        logger.info(f"✅ Usando armazém {warehouse_location} do inventário {inventory_id}")
        
        added_count = 0
        skipped_count = 0
        errors = []
        duplicates = []
        
        # 🔍 PRÉ-VERIFICAÇÃO: Identificar produtos já existentes no inventário
        existing_products = db.query(InventoryItem.product_code).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).all()
        existing_codes = {item[0] for item in existing_products}
        
        logger.info(f"🔍 DEBUG: Produtos já existentes no inventário: {existing_codes}")
        logger.info(f"🔍 DEBUG: Produtos selecionados para adicionar: {product_codes}")
        
        # ✅ BUSCAR PRÓXIMA SEQUÊNCIA DISPONÍVEL
        from sqlalchemy import func
        max_sequence = db.query(func.coalesce(func.max(InventoryItem.sequence), 0)).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).scalar() or 0
        next_sequence = max_sequence + 1
        logger.info(f"🔢 Próxima sequência disponível: {next_sequence}")
        
        # ✅ PROCESSAMENTO ROBUSTO - Nunca quebra o sistema
        with resilient_db_session(db):
            for i, product_code in enumerate(product_codes):
                try:
                    # ✅ BUSCAR PRODUTO DE FORMA RESILIENTE
                    logger.info(f"🔍 Buscando produto {product_code} na SB1010...")
                    from sqlalchemy import func
                    
                    product_sb1010 = safe_query(
                        db,
                        lambda: db.query(SB1010).filter(
                            func.trim(SB1010.b1_cod) == validator.safe_string(product_code).strip()
                        ).first(),
                        fallback=None,
                        log_prefix=f"find_product_{product_code}"
                    )
                    
                    if not product_sb1010:
                        error_msg = f"Produto {product_code} não encontrado na SB1010"
                        logger.warning(f"⚠️ {error_msg}")
                        errors.append(error_msg)
                        continue
                    
                    product_name = validator.safe_string(product_sb1010.b1_desc, f"Produto {product_code}")
                    logger.info(f"✅ Produto {product_code} encontrado: {product_name}")

                    # ✅ VERIFICAÇÃO OTIMIZADA: Usar set para verificação rápida
                    if product_code in existing_codes:
                        duplicates.append({
                            "code": product_code,
                            "name": product_name
                        })
                        skipped_count += 1
                        continue

                    # ✅ v2.19.55 - CORREÇÃO: Sempre usar B2_QATU como saldo esperado (é o saldo oficial do ERP Protheus)
                    # Para produtos com lote, SUM(B8_SALDO) pode divergir de B2_QATU por ajustes pendentes no ERP
                    # Os snapshots de lotes continuam sendo criados para detalhe na contagem

                    # Buscar filial
                    store = db.query(Store).filter(Store.id == inventory.store_id).first()
                    filial = store.code if store else '01'

                    from sqlalchemy import text
                    balance_query = text("""
                        SELECT COALESCE(b2_qatu, 0) as b2_qatu
                        FROM inventario.sb2010
                        WHERE TRIM(b2_cod) = :product_code
                          AND b2_filial = :filial
                          AND b2_local = :warehouse
                        LIMIT 1
                    """)

                    balance_result = safe_query(
                        db,
                        lambda: db.execute(balance_query, {
                            'product_code': validator.safe_string(product_code).strip(),
                            'filial': filial,
                            'warehouse': validator.safe_string(warehouse_location)
                        }).fetchone(),
                        fallback=None,
                        log_prefix=f"get_balance_{product_code}_{warehouse_location}"
                    )

                    expected_qty = validator.safe_number(
                        balance_result.b2_qatu if balance_result else 0.0,
                        default=0.0
                    )

                    logger.info(f"📊 Produto {product_code}: B2_QATU={expected_qty} (filial={filial}, armazém={warehouse_location}, rastro={product_sb1010.b1_rastro})")
                
                    # ✅ CRIAR ITEM NO INVENTÁRIO - TOTALMENTE DESACOPLADO E ROBUSTO
                    # Usar apenas product_code (chave natural), sem foreign keys
                    inventory_item = InventoryItem(
                        inventory_list_id=inventory_uuid,
                        # ✅ REMOVIDO product_id - SEM FOREIGN KEY!
                        product_code=validator.safe_string(product_code),  # Chave natural validada
                        sequence=next_sequence + i,  # ✅ SEQUÊNCIA CORRETA
                        expected_quantity=expected_qty,  # ✅ SALDO VALIDADO
                        b2_qatu=expected_qty,  # ✅ GRAVAR SALDO DO MOMENTO DA INCLUSÃO
                        warehouse=validator.safe_string(warehouse_location),  # ✅ ARMAZÉM VALIDADO
                        status="PENDING",
                        is_available_for_assignment=True  # ✅ MARCAR COMO DISPONÍVEL
                    )
                    
                    db.add(inventory_item)
                    db.flush()  # Obter ID do item antes de criar snapshot
                    added_count += 1

                    logger.info(f"✅ Produto {product_code} adicionado com saldo {expected_qty} do armazém {warehouse_location}")

                    # 📸 v2.10.0: CRIAR SNAPSHOT DE DADOS CONGELADOS
                    try:
                        from app.services.snapshot_service import SnapshotService

                        logger.info(f"📸 Criando snapshot para produto {product_code}")

                        # Buscar informações da store para obter o filial
                        store = db.query(Store).filter(Store.id == inventory.store_id).first()
                        filial = store.code if store else '01'  # Fallback para '01' se store não encontrada

                        # Criar snapshot do item (SB1+SB2+SBZ)
                        item_snapshot = SnapshotService.create_item_snapshot(
                            db=db,
                            inventory_item_id=inventory_item.id,
                            product_code=product_code,
                            filial=filial,
                            warehouse=warehouse_location,
                            created_by=current_user.id
                        )

                        if item_snapshot:
                            logger.info(f"✅ Snapshot de item criado: {inventory_item.id}")

                            # Se produto tem rastreamento de lote (b1_rastro='L'), criar snapshots de lotes
                            if item_snapshot.b1_rastro == 'L':
                                lot_snapshots = SnapshotService.create_lots_snapshots(
                                    db=db,
                                    inventory_item_id=inventory_item.id,
                                    product_code=product_code,
                                    filial=filial,
                                    warehouse=warehouse_location,
                                    created_by=current_user.id
                                )
                                logger.info(f"✅ {len(lot_snapshots)} snapshot(s) de lotes criados para {product_code}")
                        else:
                            logger.warning(f"⚠️ Não foi possível criar snapshot para produto {product_code} (não encontrado em SB2)")

                    except Exception as snapshot_error:
                        logger.warning(f"⚠️ Erro ao criar snapshot para {product_code}: {snapshot_error}")
                        # Não falha a adição do produto se snapshot falhar (snapshot é opcional)
                    
                except Exception as e:
                    # ✅ TRATAMENTO ROBUSTO DE ERRO - Não quebra o processo
                    error_msg = f"Erro no produto {product_code}: {str(e)[:100]}"
                    logger.warning(f"⚠️ {error_msg}")  # Warning ao invés de error
                    errors.append(error_msg)
                    # Continue processando outros produtos
        
            # ✅ COMMIT RESILIENTE - Com rollback automático em caso de erro
            # O commit já é feito pelo resilient_db_session
            
            logger.info(f"✅ Processamento concluído: {added_count} produtos adicionados ao inventário {inventory_id}")
            
            # 📊 MENSAGEM INTELIGENTE E ROBUSTA baseada no resultado
            logger.info(f"📊 Resultado final: added={added_count}, skipped={skipped_count}, errors={len(errors)}, duplicates={len(duplicates)}")
            
            # ✅ LÓGICA DE MENSAGEM ROBUSTA - Nunca falha
            if added_count > 0 and len(duplicates) == 0 and len(errors) == 0:
                message = f"✅ {added_count} produtos adicionados com sucesso!"
                success = True
            elif added_count > 0 and (len(duplicates) > 0 or len(errors) > 0):
                message = f"✅ {added_count} produtos adicionados. {skipped_count} já existiam no inventário."
                success = True
            elif added_count == 0 and len(duplicates) > 0 and len(errors) == 0:
                message = f"⚠️ Nenhum produto foi adicionado. Todos os {len(duplicates)} produtos selecionados já estão no inventário."
                success = False
            elif added_count == 0 and len(errors) > 0 and len(duplicates) == 0:
                message = f"❌ Nenhum produto foi adicionado devido a erros."
                success = False
            elif added_count == 0 and len(errors) > 0 and len(duplicates) > 0:
                message = f"⚠️ Nenhum produto adicionado: {len(duplicates)} já existiam, {len(errors)} com erro."
                success = False
            else:
                # Caso de fallback robusto
                message = f"ℹ️ Processamento concluído. {added_count} produtos processados."
                success = added_count > 0
            
            # ✅ RESPOSTA ROBUSTA - Sempre retorna JSON válido
            return safe_json_response({
                "success": success,
                "message": message,
                "summary": {
                    "added_count": added_count,
                    "skipped_duplicates": skipped_count,
                    "total_selected": len(product_codes),
                    "error_count": len(errors)
                },
                "details": {
                    "duplicates": duplicates,
                    "errors": errors
                },
                "metadata": {
                    "inventory_id": inventory_id,
                    "warehouse": warehouse_location,
                    "robust_processing": True,
                    "zero_foreign_keys": True
                }
            })
        
    except HTTPException:
        # Repassar HTTPExceptions sem modificar
        raise
    except Exception as e:
        # ✅ TRATAMENTO ROBUSTO DE ERRO FINAL - Nunca falha
        logger.error(f"❌ Erro crítico ao adicionar produtos ao inventário: {str(e)[:200]}")
        logger.debug(f"📋 Stack trace completo: {traceback.format_exc()}")
        
        # Rollback já é feito pelo resilient_db_session
        
        # ✅ RESPOSTA ROBUSTA MESMO EM ERRO CRÍTICO
        return safe_json_response({
            "success": False,
            "message": "❌ Erro interno do sistema. Tente novamente.",
            "summary": {
                "added_count": 0,
                "skipped_duplicates": 0,
                "total_selected": len(product_codes) if 'product_codes' in locals() else 0,
                "error_count": 1
            },
            "details": {
                "duplicates": [],
                "errors": [f"Erro interno: {str(e)[:100]}"]
            },
            "metadata": {
                "inventory_id": inventory_id,
                "robust_processing": True,
                "critical_error_handled": True
            }
        }, success=False)

@app.get("/api/v1/inventory/lists/{inventory_id}/products", tags=["Inventory"])
async def list_inventory_products(
    inventory_id: str,
    counting_round: int = Query(None, description="Filtrar por rodada de contagem (1, 2, 3)"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar produtos de um inventário"""
    try:
        from app.models.models import InventoryList, InventoryItem, SB1010, SBZ010
        import uuid
        
        # Verificar se inventário existe e usuário tem acesso
        inventory_uuid = uuid.UUID(inventory_id)
        inventory = check_inventory_access(db, inventory_uuid, current_user)
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Buscar itens do inventário com dados do produto, localização e saldo
        from app.models.models import SB2010
        from sqlalchemy import text
        
        # Buscar todos os itens do inventário primeiro
        items_query = db.query(InventoryItem, SB1010, SBZ010).join(
            SB1010, InventoryItem.product_code == SB1010.b1_cod
        ).outerjoin(
            SBZ010, SB1010.b1_cod == SBZ010.bz_cod
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).order_by(InventoryItem.sequence)
        
        all_items = items_query.all()
        
        # FILTRAR POR RODADA DE CONTAGEM SE ESPECIFICADO
        if counting_round:
            from app.models.models import Counting
            from sqlalchemy import and_
            
            logger.info(f"🔍 Filtrando produtos para {counting_round}ª contagem")
            
            if counting_round == 1:
                # 1ª contagem: Todos os produtos que ainda não foram contados
                items = [(item, produto, localizacao) for item, produto, localizacao in all_items 
                        if item.last_counted_by is None]
                logger.info(f"1ª Contagem: {len(items)} produtos não contados")
                
            elif counting_round == 2:
                # 2ª contagem: Produtos que já foram contados na 1ª (com divergências)
                items_with_first_count = []
                for item, produto, localizacao in all_items:
                    # Verificar se tem contagem da 1ª rodada
                    first_count = db.query(Counting).filter(
                        and_(
                            Counting.inventory_item_id == item.id,
                            Counting.count_number == 1
                        )
                    ).first()
                    
                    if first_count:
                        items_with_first_count.append((item, produto, localizacao))
                
                items = items_with_first_count
                logger.info(f"2ª Contagem: {len(items)} produtos com 1ª contagem")
                
            elif counting_round == 3:
                # 3ª contagem: Produtos que já foram contados na 2ª (com divergências)
                items_with_second_count = []
                for item, produto, localizacao in all_items:
                    # Verificar se tem contagem da 2ª rodada
                    second_count = db.query(Counting).filter(
                        and_(
                            Counting.inventory_item_id == item.id,
                            Counting.count_number == 2
                        )
                    ).first()
                    
                    if second_count:
                        items_with_second_count.append((item, produto, localizacao))
                
                items = items_with_second_count
                logger.info(f"3ª Contagem: {len(items)} produtos com 2ª contagem")
            else:
                items = all_items
        else:
            # MOSTRAR TODOS OS PRODUTOS (incluindo os já contados para permitir múltiplas contagens)
            items = all_items
        
        # Converter para formato da API
        produtos = []
        for item, produto, localizacao in items:
            # Determinar número do lote se controla lote
            lot_number = ""
            if produto.b1_rastro == 'L':
                # Se controla lote, buscar lote atual ou usar padrão
                lot_number = item.lot_number if hasattr(item, 'lot_number') and item.lot_number else "001"
            
            # Buscar saldo real da SB2010 para este produto
            # CORREÇÃO: Sistema MULTI-ARMAZÉM - usar EXATAMENTE o armazém do inventário
            if not inventory.warehouse:
                raise HTTPException(status_code=400, detail="Inventário sem armazém definido")
            local_inventario = inventory.warehouse  # NUNCA usar B1_LOCPAD
            
            # Usar TRIM no SQL para garantir que espaços sejam removidos
            from sqlalchemy import func
            saldo_query = db.query(SB2010).filter(
                func.trim(SB2010.b2_cod) == item.product_code.strip(),
                SB2010.b2_local == local_inventario
            ).first()
            
            saldo_sistema = float(saldo_query.b2_qatu) if saldo_query else 0.0
            
            # BUSCAR TODAS AS CONTAGENS PARA ESTE ITEM (por ciclo)
            from app.models.models import Counting, CountingAssignment, User
            
            # Buscar contagens por ciclo
            countings_query = db.query(
                Counting.count_number,
                Counting.quantity,
                Counting.lot_number,
                Counting.serial_number,
                Counting.created_at,
                Counting.observation,
                Counting.counted_by,
                User.full_name.label('counter_name')
            ).outerjoin(
                User, Counting.counted_by == User.id
            ).filter(
                Counting.inventory_item_id == item.id
            ).order_by(Counting.count_number.asc()).all()
            
            # Organizar por ciclo E criar array de countings
            count_1_qty = None
            count_2_qty = None
            count_3_qty = None
            last_counter_name = None
            last_counting_date = None
            countings_list = []  # ✅ NOVO: Array completo de countings

            for counting in countings_query:
                if counting.count_number == 1:
                    count_1_qty = float(counting.quantity)
                elif counting.count_number == 2:
                    count_2_qty = float(counting.quantity)
                elif counting.count_number == 3:
                    count_3_qty = float(counting.quantity)

                # Dados da última contagem
                last_counter_name = counting.counter_name
                last_counting_date = counting.created_at

                # ✅ NOVO: Adicionar ao array de countings
                countings_list.append({
                    "count_number": counting.count_number,
                    "quantity": float(counting.quantity),
                    "lot_number": counting.lot_number,
                    "serial_number": counting.serial_number,
                    "observation": counting.observation,
                    "counted_by": counting.counter_name,
                    "counted_at": counting.created_at.isoformat() if counting.created_at else None
                })
            
            # CORREÇÃO CRÍTICA: Calcular diferença baseada no CICLO ATUAL do inventário
            current_cycle = getattr(inventory, 'cycle_number', 1)
            
            # Usar quantidade do ciclo atual específico, não "última disponível"
            current_cycle_qty = None
            if current_cycle == 1:
                current_cycle_qty = count_1_qty
            elif current_cycle == 2:
                current_cycle_qty = count_2_qty  
            elif current_cycle == 3:
                current_cycle_qty = count_3_qty
            
            # Se não há contagem no ciclo atual, considerar como 0 (quantidade padrão)
            final_counted_qty = current_cycle_qty if current_cycle_qty is not None else 0.0
            
            # Calcular diferença sempre (mesmo se for 0 - 0 = 0)
            difference = final_counted_qty - saldo_sistema
            
            # Para compatibilidade: manter last_counted_qty para outros usos
            last_counted_qty = count_3_qty if count_3_qty is not None else (
                count_2_qty if count_2_qty is not None else count_1_qty
            )
            
            # Buscar atribuição atual (para obter contador responsável)
            assignment = db.query(CountingAssignment, User).join(
                User, CountingAssignment.assigned_to == User.id
            ).filter(
                CountingAssignment.inventory_item_id == item.id
            ).order_by(CountingAssignment.created_at.desc()).first()
            
            current_counter = assignment[1].full_name if assignment else "Não atribuído"
            
            produtos.append({
                "item_id": str(item.id),
                "sequence": item.sequence,
                "product_code": item.product_code,
                "product_name": produto.b1_desc,
                "unit": produto.b1_um,
                "group": produto.b1_grupo,
                "category": produto.b1_xcatgor,
                "subcategory": produto.b1_xsubcat,
                "segment": produto.b1_xsegmen,
                "inv_group": produto.b1_xgrinve,
                "warehouse_location": local_inventario,  # Armazém/Local do inventário
                "local1": localizacao.bz_xlocal1 if localizacao else "",
                "local2": localizacao.bz_xlocal2 if localizacao else "",
                "local3": localizacao.bz_xlocal3 if localizacao else "",
                "lot_number": lot_number,
                "has_lot": produto.b1_rastro == 'L',
                "expected_quantity": saldo_sistema,  # Quantidade esperada
                # ✅ INCLUIR QUANTIDADES POR CICLO
                "count_1": count_1_qty,
                "count_2": count_2_qty,
                "count_3": count_3_qty,
                # ✅ INCLUIR DIFERENÇA CALCULADA CORRETAMENTE
                "current_cycle_quantity": final_counted_qty,  # Quantidade do ciclo atual
                "last_counted_quantity": last_counted_qty,    # Para compatibilidade
                "difference": difference,                     # Baseada no ciclo atual
                # ✅ INCLUIR INFORMAÇÕES DE CONTADOR
                "current_counter": current_counter,
                "last_counter_name": last_counter_name,
                "last_counted_at": last_counting_date.isoformat() if last_counting_date else None,
                # ✅ STATUS
                "status": item.status.value,
                "has_counting": last_counted_qty is not None,
                "total_countings": len(countings_query),
                # ✅ NOVO: Array completo de countings com detalhes de lotes
                "countings": countings_list
            })
        
        logger.info(f"✅ Listados {len(produtos)} produtos do inventário {inventory_id}")
        
        return {
            "inventory_id": inventory_id,
            "inventory_name": inventory.name,
            "produtos": produtos,
            "total": len(produtos)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao listar produtos do inventário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao listar produtos"))

# =================================
# ENDPOINTS DE DESIGNAÇÃO DE CONTADORES (FASE 2C)
# =================================

@app.get("/api/v1/inventory/lists/{inventory_id}/user-counting-status", tags=["Inventory"])
async def get_user_counting_status(
    inventory_id: str,
    user_id: str = None,  # Se não fornecido, usa o usuário atual
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Detectar em que rodada de contagem específica um usuário está para este inventário"""
    try:
        from app.models.models import InventoryList, CountingAssignment, ClosedCountingRound, User
        import uuid
        
        # Validar inventory_id como UUID
        try:
            inventory_uuid = uuid.UUID(inventory_id)
        except ValueError:
            return {"success": False, "message": "ID de inventário inválido"}
            
        # Usar usuário atual se não especificado
        target_user_id = user_id if user_id else str(current_user.id)
        try:
            target_user_uuid = uuid.UUID(target_user_id)
        except ValueError:
            return {"success": False, "message": "ID de usuário inválido"}
        
        # Buscar inventário
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid,
            InventoryList.store_id == current_user.store_id
        ).first()
        
        if not inventory:
            return {"success": False, "message": "Inventário não encontrado"}
            
        # Detectar próxima rodada baseado em rodadas encerradas
        closed_rounds = db.query(ClosedCountingRound.round_number).filter(
            ClosedCountingRound.inventory_list_id == inventory_uuid,
            ClosedCountingRound.user_id == target_user_uuid
        ).order_by(ClosedCountingRound.round_number.desc()).all()
        
        # Determinar rodada atual
        if not closed_rounds:
            # Nenhuma rodada encerrada = 1ª contagem
            current_round = 1
            round_status = "PRIMEIRA_CONTAGEM"
        else:
            # Próxima rodada após a última encerrada
            last_closed_round = closed_rounds[0].round_number
            if last_closed_round == 1:
                current_round = 2
                round_status = "SEGUNDA_CONTAGEM"
            elif last_closed_round == 2:
                current_round = 3
                round_status = "TERCEIRA_CONTAGEM"
            else:
                # Usuário já finalizou todas as rodadas
                current_round = None
                round_status = "TODAS_RODADAS_CONCLUIDAS"
                
        # Buscar atribuições pendentes para esta rodada
        pending_assignments = 0
        if current_round:
            pending_assignments = db.query(CountingAssignment).join(
                InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
            ).filter(
                InventoryItem.inventory_list_id == inventory_uuid,
                CountingAssignment.assigned_to == target_user_uuid,
                CountingAssignment.count_number == current_round,
                CountingAssignment.status.in_(['PENDING', 'IN_PROGRESS'])
            ).count()
            
        return {
            "success": True,
            "data": {
                "inventory_id": str(inventory_uuid),
                "user_id": str(target_user_uuid),
                "current_round": current_round,
                "round_status": round_status,
                "pending_assignments": pending_assignments,
                "closed_rounds": [r.round_number for r in closed_rounds],
                "can_proceed": current_round is not None and pending_assignments > 0
            }
        }
        
    except Exception as e:
        print(f"Erro ao detectar status de contagem: {e}")
        return {"success": False, "message": f"Erro interno: {str(e)}"}

@app.get("/api/v1/inventory/lists/{inventory_id}/active-counting-rounds", tags=["Inventory"])
async def get_active_counting_rounds(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar todas as rodadas ativas por usuário (VERSÃO INDEPENDENTE POR USUÁRIO/LISTA)"""
    try:
        from app.models.models import InventoryList, CountingAssignment, ClosedCountingRound, User
        import uuid
        
        # Validar inventory_id como UUID
        try:
            inventory_uuid = uuid.UUID(inventory_id)
        except ValueError:
            return {"success": False, "message": "ID de inventário inválido"}
        
        # Buscar inventário
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid,
            InventoryList.store_id == current_user.store_id
        ).first()
        
        if not inventory:
            return {"success": False, "message": "Inventário não encontrado"}
        
        # Buscar todos os usuários que têm atribuições neste inventário
        users_with_assignments = db.query(
            CountingAssignment.assigned_to,
            User.full_name
        ).join(
            InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
        ).join(
            User, CountingAssignment.assigned_to == User.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).distinct().all()
        
        rounds_data = []
        
        # Para cada usuário, determinar sua rodada atual independentemente
        for user_assignment in users_with_assignments:
            user_id = user_assignment.assigned_to
            user_name = user_assignment.full_name
            
            # Detectar rodadas encerradas para este usuário
            closed_rounds = db.query(ClosedCountingRound.round_number).filter(
                ClosedCountingRound.inventory_list_id == inventory_uuid,
                ClosedCountingRound.user_id == user_id
            ).order_by(ClosedCountingRound.round_number.desc()).all()
            
            # Determinar rodada atual
            if not closed_rounds:
                current_round = 1
                round_status = "1ª Contagem"
            else:
                last_closed_round = closed_rounds[0].round_number
                if last_closed_round == 1:
                    current_round = 2
                    round_status = "2ª Contagem"
                elif last_closed_round == 2:
                    current_round = 3
                    round_status = "3ª Contagem"
                else:
                    continue  # Usuário já finalizou todas as rodadas
                    
            # Contar atribuições pendentes para esta rodada
            pending_count = db.query(CountingAssignment).join(
                InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
            ).filter(
                InventoryItem.inventory_list_id == inventory_uuid,
                CountingAssignment.assigned_to == user_id,
                CountingAssignment.count_number == current_round,
                CountingAssignment.status.in_(['PENDING', 'IN_PROGRESS'])
            ).count()
            
            if pending_count > 0:  # Só incluir se há itens pendentes
                rounds_data.append({
                    "user_id": str(user_id),
                    "user_name": user_name,
                    "round_key": f"{user_id}_{current_round}_{inventory_uuid}",
                    "round": current_round,
                    "round_status": round_status,
                    "total_items": pending_count,
                    "closed_rounds": [r.round_number for r in closed_rounds]
                })
                
        return {
            "success": True,
            "active_rounds": rounds_data,
            "total_active_rounds": len(rounds_data)
        }
        
    except Exception as e:
        print(f"Erro ao buscar rodadas ativas: {e}")
        return {"success": False, "message": f"Erro interno: {str(e)}"}

async def create_discrepancy_for_item(db, inventory_item_id, user_id, round_number):
    """Criar divergência para um item específico se houver diferença"""
    try:
        from app.models.models import InventoryItem, Counting, Discrepancy, SB1010, SB2010, SB8010
        from decimal import Decimal
        import uuid
        
        print(f"🔍 DEBUG: Criando divergência para item {inventory_item_id}, usuário {user_id}, rodada {round_number}")
        
        # Buscar item do inventário
        item = db.query(InventoryItem).filter(InventoryItem.id == inventory_item_id).first()
        if not item:
            print(f"❌ DEBUG: Item não encontrado: {inventory_item_id}")
            return False
            
        print(f"✅ DEBUG: Item encontrado - Seq: {item.sequence}, Esperado: {item.expected_quantity}")
            
        # Simplificar - não precisamos do produto para calcular divergência básica
        print(f"✅ DEBUG: Processando item {item.id}")
            
        # Buscar contagem mais recente do usuário para este item
        # ✅ CORREÇÃO v3.6: Ordenar por created_at para evitar "Multiple rows" error
        user_counting = db.query(Counting).filter(
            Counting.inventory_item_id == inventory_item_id,
            Counting.counted_by == user_id,
            Counting.count_number == round_number
        ).order_by(Counting.created_at.desc()).first()
        
        if not user_counting:
            print(f"❌ DEBUG: Contagem não encontrada para usuário {user_id}, rodada {round_number}")
            return False
            
        print(f"✅ DEBUG: Contagem encontrada - Quantidade: {user_counting.quantity}")
            
        # Usar quantidade esperada do item
        expected_quantity = item.expected_quantity or Decimal('0')
        
        print(f"📊 DEBUG: Quantidade esperada final: {expected_quantity}")
        
        # Calcular divergência
        counted_quantity = Decimal(str(user_counting.quantity))
        variance = counted_quantity - expected_quantity
        
        print(f"🧮 DEBUG: Contado: {counted_quantity}, Esperado: {expected_quantity}, Variação: {variance}")
        
        # Só criar divergência se houver diferença
        if variance == 0:
            print(f"✅ DEBUG: Sem divergência - Quantidades iguais")
            return False
            
        # Calcular percentual
        if expected_quantity != 0:
            variance_percentage = (variance / expected_quantity) * 100
        else:
            variance_percentage = Decimal('100') if variance != 0 else Decimal('0')
            
        print(f"📈 DEBUG: Variação percentual: {variance_percentage}%")
            
        # Verificar se divergência já existe para este item
        existing_discrepancy = db.query(Discrepancy).filter(
            Discrepancy.inventory_item_id == inventory_item_id
        ).first()
        
        if existing_discrepancy:
            print(f"🔄 DEBUG: Atualizando divergência existente: {existing_discrepancy.id}")
            # Atualizar divergência existente
            existing_discrepancy.variance_quantity = float(variance)
            existing_discrepancy.variance_percentage = float(variance_percentage)
            # 🔥 CORREÇÃO: QUALQUER DIFERENÇA ≠ 0 É DIVERGÊNCIA
            existing_discrepancy.tolerance_exceeded = abs(variance) > 0.0
        else:
            print(f"➕ DEBUG: Criando nova divergência")
            # Criar nova divergência
            discrepancy = Discrepancy(
                id=uuid.uuid4(),
                inventory_item_id=inventory_item_id,
                variance_quantity=float(variance),
                variance_percentage=float(variance_percentage),
                # 🔥 CORREÇÃO: QUALQUER DIFERENÇA ≠ 0 É DIVERGÊNCIA
                tolerance_exceeded=abs(variance) > 0.0,
                status='PENDING',
                created_by=user_id
            )
            db.add(discrepancy)
            print(f"✅ DEBUG: Divergência criada com ID: {discrepancy.id}")
            
        print(f"💾 DEBUG: Retornando True - Divergência processada")
        return True
        
    except Exception as e:
        print(f"Erro ao criar divergência: {e}")
        return False

async def check_and_advance_inventory_round(db: Session, inventory_id: str, current_round: int):
    """
    🔄 CORREÇÃO: Registra encerramento E atualiza campos needs_recount_cycle_X automaticamente
    """
    try:
        from app.models.models import InventoryList, Discrepancy, InventoryItem
        from sqlalchemy import text
        
        # Buscar inventário
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
        if not inventory:
            return False
            
        # Calcular estatísticas de divergências para log
        discrepancies_count = db.query(Discrepancy).join(
            InventoryItem, Discrepancy.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_id,
            Discrepancy.status == 'PENDING'
        ).count()
        
        print(f"📊 Inventário {inventory.name}: {discrepancies_count} divergências pendentes após encerramento da {current_round}ª contagem")
        
        # ✅ IMPORTANTE: Após encerrar rodada, voltar status para ABERTA (permite reatribuição)
        inventory.list_status = "ABERTA"
        
        # ✅ NOVA LÓGICA: Atualizar campos needs_recount_cycle_X baseado em divergências
        if current_round == 1:
            # Após 1º ciclo, verificar divergências para determinar 2º ciclo
            db.execute(
                text("""
                    UPDATE inventario.inventory_items 
                    SET needs_recount_cycle_2 = CASE 
                        WHEN count_cycle_1 IS NOT NULL AND abs(count_cycle_1 - expected_quantity) >= 0.01 THEN true
                        ELSE false
                    END
                    WHERE inventory_list_id = CAST(:inventory_id AS uuid)
                """),
                {"inventory_id": inventory_id}
            )
            print(f"✅ Campos needs_recount_cycle_2 atualizados baseado em divergências do 1º ciclo")

            # 🔧 CORREÇÃO AUTOMÁTICA: Criar assignments para produtos que precisam de ciclo 2
            from app.models.models import CountingAssignment as CountingAssignmentModel

            # Buscar usuário responsável pelo inventário (usar o mesmo do ciclo 1)
            first_assignment = db.query(CountingAssignmentModel).join(
                InventoryItem, CountingAssignmentModel.inventory_item_id == InventoryItem.id
            ).filter(
                InventoryItem.inventory_list_id == inventory_id,
                CountingAssignmentModel.count_number == 1
            ).first()

            if first_assignment:
                assigned_user_id = first_assignment.assigned_to

                # Criar assignments para produtos que precisam de ciclo 2
                db.execute(
                    text("""
                        INSERT INTO inventario.counting_assignments (
                            inventory_item_id, assigned_to, assigned_by,
                            count_number, cycle_number, status, created_at
                        )
                        SELECT
                            ii.id,
                            :assigned_user_id,
                            :assigned_user_id,
                            2,
                            2,
                            'PENDING',
                            NOW()
                        FROM inventario.inventory_items ii
                        WHERE ii.inventory_list_id = CAST(:inventory_id AS uuid)
                          AND ii.needs_recount_cycle_2 = true
                          AND NOT EXISTS (
                            SELECT 1 FROM inventario.counting_assignments ca
                            WHERE ca.inventory_item_id = ii.id
                              AND ca.count_number = 2
                          )
                    """),
                    {
                        "inventory_id": inventory_id,
                        "assigned_user_id": assigned_user_id
                    }
                )
                print(f"🔧 Assignments criados automaticamente para ciclo 2")

            # ✅ INCREMENTAR CICLO: Após encerrar 1ª rodada, avançar para ciclo 2
            # 🔧 SOLUÇÃO DEFINITIVA: Usar função de sincronização
            sync_cycle_between_tables(db, inventory_id, 2)
            print(f"✅ Inventário avançado para ciclo 2 (SINCRONIZADO)")

        elif current_round == 2:
            # Após 2º ciclo, verificar se precisa 3º ciclo  
            # ✅ CORREÇÃO DEFINITIVA: Usar OR ao invés de AND para detectar divergências
            # 🔧 CORREÇÃO v2.19.42: Tratar count_cycle_2 NULL como 0 quando item precisava de recontagem
            # Regra: Se needs_recount_cycle_2=true mas count_cycle_2=NULL, operador não encontrou = 0
            db.execute(
                text("""
                    UPDATE inventario.inventory_items
                    SET needs_recount_cycle_3 = CASE
                        -- REGRA ESPECIAL: Produtos com qty esperada = 0
                        WHEN expected_quantity = 0 THEN
                            CASE
                                -- 🔧 v2.19.42: NULL no ciclo 2 = 0 (não encontrado)
                                -- Se precisava recontar e não contou, tratamos como 0
                                -- Se c2(efetivo)=0 == expected=0 → Zero Confirmado, não precisa ciclo 3
                                WHEN count_cycle_2 IS NULL AND needs_recount_cycle_2 = true THEN false
                                -- Se 2ª contagem = 0 = esperado → NÃO precisa de 3ª contagem (Zero Confirmado)
                                WHEN count_cycle_2 = 0 THEN false
                                -- Se 1ª = 2ª (ambas != 0) → NÃO precisa de 3ª contagem (Divergência confirmada)
                                WHEN count_cycle_1 IS NOT NULL AND count_cycle_2 IS NOT NULL
                                     AND abs(count_cycle_1 - count_cycle_2) < 0.01 THEN false
                                -- Se 1ª != 2ª → SIM precisa de 3ª contagem (desempate)
                                WHEN count_cycle_1 IS NOT NULL AND count_cycle_2 IS NOT NULL
                                     AND abs(count_cycle_1 - count_cycle_2) >= 0.01 THEN true
                                ELSE false
                            END
                        -- REGRA GERAL: Produtos com qty esperada != 0
                        -- 🔧 v2.19.42: Usar COALESCE para tratar NULL como 0
                        WHEN count_cycle_1 IS NOT NULL
                             AND (count_cycle_2 IS NOT NULL OR needs_recount_cycle_2 = true)
                             AND (
                                -- Divergência significativa entre ciclo 1 e 2 (> 5%)
                                abs(count_cycle_1 - COALESCE(count_cycle_2, 0)) > GREATEST(count_cycle_1, COALESCE(count_cycle_2, 0), 1) * 0.05
                                OR
                                -- Divergência com quantidade esperada (> 5%)
                                abs(count_cycle_1 - expected_quantity) > GREATEST(expected_quantity, 1) * 0.05
                                OR
                                abs(COALESCE(count_cycle_2, 0) - expected_quantity) > GREATEST(expected_quantity, 1) * 0.05
                             ) THEN true
                        ELSE false
                    END,
                    -- 🔧 v2.19.42: Também atualizar count_cycle_2 para 0 quando NULL e precisava recontar
                    count_cycle_2 = CASE
                        WHEN count_cycle_2 IS NULL AND needs_recount_cycle_2 = true THEN 0
                        ELSE count_cycle_2
                    END
                    WHERE inventory_list_id = CAST(:inventory_id AS uuid)
                """),
                {"inventory_id": inventory_id}
            )
            print(f"✅ Campos needs_recount_cycle_3 atualizados baseado em divergências do 2º ciclo (v2.19.42: NULL=0)")

            # 🔧 CORREÇÃO AUTOMÁTICA: Criar assignments para produtos que precisam de ciclo 3
            # Buscar usuário responsável pelo inventário (usar o mesmo dos ciclos anteriores)
            second_assignment = db.query(CountingAssignmentModel).join(
                InventoryItem, CountingAssignmentModel.inventory_item_id == InventoryItem.id
            ).filter(
                InventoryItem.inventory_list_id == inventory_id,
                CountingAssignmentModel.count_number == 2
            ).first()

            if second_assignment:
                assigned_user_id = second_assignment.assigned_to

                # Criar assignments para produtos que precisam de ciclo 3
                db.execute(
                    text("""
                        INSERT INTO inventario.counting_assignments (
                            inventory_item_id, assigned_to, assigned_by,
                            count_number, cycle_number, status, created_at
                        )
                        SELECT
                            ii.id,
                            :assigned_user_id,
                            :assigned_user_id,
                            3,
                            3,
                            'PENDING',
                            NOW()
                        FROM inventario.inventory_items ii
                        WHERE ii.inventory_list_id = CAST(:inventory_id AS uuid)
                          AND ii.needs_recount_cycle_3 = true
                          AND NOT EXISTS (
                            SELECT 1 FROM inventario.counting_assignments ca
                            WHERE ca.inventory_item_id = ii.id
                              AND ca.count_number = 3
                          )
                    """),
                    {
                        "inventory_id": inventory_id,
                        "assigned_user_id": assigned_user_id
                    }
                )
                print(f"🔧 Assignments criados automaticamente para ciclo 3")

            # ✅ INCREMENTAR CICLO: Após encerrar 2ª rodada, avançar para ciclo 3
            # 🔧 SOLUÇÃO DEFINITIVA: Usar função de sincronização
            sync_cycle_between_tables(db, inventory_id, 3)
            print(f"✅ Inventário avançado para ciclo 3 (SINCRONIZADO)")

        elif current_round == 3:
            # 🔧 CORREÇÃO v2.19.42: Após encerrar 3º ciclo, tratar count_cycle_3 NULL como 0
            # Regra: Se needs_recount_cycle_3=true mas count_cycle_3=NULL, operador não encontrou = 0
            db.execute(
                text("""
                    UPDATE inventario.inventory_items
                    SET
                        -- 🔧 v2.19.42: Atualizar count_cycle_3 para 0 quando NULL e precisava recontar
                        count_cycle_3 = CASE
                            WHEN count_cycle_3 IS NULL AND needs_recount_cycle_3 = true THEN 0
                            ELSE count_cycle_3
                        END,
                        -- Resetar flag após encerramento
                        needs_recount_cycle_3 = false
                    WHERE inventory_list_id = CAST(:inventory_id AS uuid)
                      AND needs_recount_cycle_3 = true
                """),
                {"inventory_id": inventory_id}
            )
            print(f"✅ Campos count_cycle_3 atualizados (v2.19.42: NULL=0 para ciclo 3 encerrado)")

        # Commit das alterações
        db.commit()
        return True
        
    except Exception as e:
        print(f"❌ Erro ao processar estatísticas e atualizar needs_recount: {e}")
        db.rollback()
        return False

from pydantic import BaseModel
from typing import Optional

class InventoryFinalizationRequest(BaseModel):
    closure_notes: Optional[str] = None
    finalize_type: Optional[str] = "COMPLETE_INVENTORY"
    finalization_type: Optional[str] = "automatic"  # automatic, manual, forced

@app.post("/api/v1/inventory/lists/{inventory_id}/finalize-inventory", tags=["Inventory"])
async def finalize_inventory(
    inventory_id: str,
    request: InventoryFinalizationRequest = InventoryFinalizationRequest(),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    🏁 ENCERRAR INVENTÁRIO: Finaliza definitivamente o inventário
    Pega a última contagem de cada produto (independente da rodada) e finaliza
    """
    try:
        from app.models.models import InventoryList, InventoryItem, Counting
        from sqlalchemy import func
        import uuid
        
        # Validar inventory_id como UUID
        try:
            inventory_uuid = uuid.UUID(inventory_id)
        except ValueError:
            return {"success": False, "message": "ID de inventário inválido"}
        
        # Buscar inventário (admin pode acessar qualquer inventário)
        if current_user.role == 'ADMIN':
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_uuid
            ).first()
        else:
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_uuid,
                InventoryList.store_id == current_user.store_id
            ).first()
        
        if not inventory:
            return {"success": False, "message": "Inventário não encontrado"}

        # Bloquear inventário efetivado
        check_inventory_not_closed(inventory)

        # 🔧 FIX v2.19.19: Verificar list_status (campo correto), não status
        if inventory.list_status == 'ENCERRADA':
            return {"success": False, "message": "Inventário já foi finalizado"}
        
        # Buscar todos os itens do inventário
        inventory_items = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).all()
        
        finalized_items = 0
        total_discrepancies = 0
        
        for item in inventory_items:
            # Buscar a ÚLTIMA contagem de cada item (maior count_number)
            latest_counting = db.query(Counting).filter(
                Counting.inventory_item_id == item.id
            ).order_by(Counting.count_number.desc(), Counting.created_at.desc()).first()
            
            if latest_counting:
                # Usar a última contagem como contagem final
                final_quantity = latest_counting.quantity
                final_count_number = latest_counting.count_number
                
                # Calcular divergência final
                expected = float(item.expected_quantity or 0)
                counted = float(final_quantity)
                variance = counted - expected
                
                if abs(variance) > 0.01:  # Considerar divergência > 1 centavo
                    total_discrepancies += 1
                
                # Atualizar status do item
                item.status = 'REVIEWED'  # Status final
                finalized_items += 1
                
                print(f"📊 Item {item.sequence}: {expected} → {counted} (rodada {final_count_number})")
            else:
                # Item sem contagem - manter quantidade esperada
                print(f"⚠️ Item {item.sequence}: Sem contagem registrada")
        
        # Finalizar inventário
        # 🔧 FIX v2.19.19: Usar list_status = 'ENCERRADA' (campo correto para integração Protheus)
        from datetime import datetime, timezone
        inventory.list_status = 'ENCERRADA'
        inventory.closed_at = datetime.now(timezone.utc)

        # 🎯 SALVAR TIPO DE FINALIZAÇÃO (automatic, manual, forced)
        inventory.finalization_type = request.finalization_type or 'automatic'

        # 🎯 CORREÇÃO DEFINITIVA: APENAS finalizar atribuições pendentes
        # NÃO mexer no status dos inventory_items - eles mantêm seus status individuais
        from app.models.models import CountingAssignment
        
        # Buscar e finalizar APENAS atribuições pendentes
        pending_assignments = db.query(CountingAssignment).join(
            InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid,
            CountingAssignment.status != 'COMPLETED'
        ).all()
        
        finalized_assignments_count = 0
        for assignment in pending_assignments:
            assignment.status = 'COMPLETED'
            assignment.completed_at = datetime.now(timezone.utc)
            finalized_assignments_count += 1
        
        # 🚫 NÃO ALTERAR inventory_items.status - eles mantêm status individual
        # Os itens mantêm seus status: COUNTED, DIVERGENCIA, PENDING, etc.
        
        print(f"✅ Inventário finalizado: {finalized_items} itens, {finalized_assignments_count} atribuições")
        print(f"📋 Status dos itens preservados individualmente para consulta histórica")

        db.commit()

        # ✅ v2.16.0: AUDIT LOG - Registrar finalização de inventário
        if audit_service:
            try:
                audit_service.log_finalize_inventory(
                    db=db,
                    inventory_list_id=inventory_uuid,
                    user_id=current_user.id,
                    final_cycle=inventory.current_cycle,
                    total_products=finalized_items,
                    total_divergences=total_discrepancies
                )
                db.commit()  # Commit do log de auditoria
            except Exception as audit_error:
                logger.warning(f"⚠️ [AUDIT] Erro ao registrar log de finalização: {audit_error}")
                # Não propaga erro - auditoria não deve bloquear operação

        return {
            "success": True,
            "message": f"Inventário finalizado com sucesso! {finalized_items} itens processados.",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "finalized_items": finalized_items,
                "total_discrepancies": total_discrepancies,
                "finalized_at": "now",
                "finalized_by": current_user.full_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Erro ao finalizar inventário: {e}")
        return {"success": False, "message": f"Erro interno: {str(e)}"}

@app.post("/api/v1/lists/{list_id}/update-status", tags=["Inventory"])
async def update_list_individual_status(
    list_id: str,
    request: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza o status individual de uma lista de contagem"""
    try:
        # Limpar qualquer transação pendente
        try:
            db.rollback()
        except:
            pass

        from app.models.models import CountingAssignment, InventoryList, InventoryItem
        import uuid

        new_status = request.get("new_status", "ABERTA")
        action = request.get("action")
        advance_cycle = request.get("advance_cycle", False)
        user_name = request.get("user_name", "")

        print(f"🔄 [UPDATE STATUS] Lista: {list_id}, Status: {new_status}, Action: {action}, Advance: {advance_cycle}")

        # Validar status
        if new_status not in ['ABERTA', 'EM_CONTAGEM', 'ENCERRADA']:
            return {"success": False, "message": "Status inválido"}

        # list_id tem formato "user_{user_id}"
        if not list_id.startswith("user_"):
            return {"success": False, "message": "ID de lista inválido"}

        user_id = uuid.UUID(list_id.replace("user_", ""))

        # ✅ LÓGICA ESPECIAL PARA ENCERRAR RODADA COM AVANÇO DE CICLO
        if action == "end_round" and advance_cycle:
            print(f"🎯 [END_ROUND] Processando encerramento com avanço de ciclo para usuário: {user_name}")

            # Buscar o inventário atual através das atribuições
            # Não filtrar por status, pois queremos processar mesmo que já tenha mudado
            assignment = db.query(CountingAssignment).join(
                InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
            ).join(
                InventoryList, InventoryItem.inventory_list_id == InventoryList.id
            ).filter(
                CountingAssignment.assigned_to == user_id
            ).first()

            if assignment:
                inventory_id = assignment.inventory_item.inventory_list_id
                inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
                print(f"📋 [ASSIGNMENT] Encontrado: {assignment.id}, Inventário: {inventory_id}")

                if inventory:
                    current_cycle = inventory.current_cycle
                    print(f"📊 [CICLO] Inventário {inventory.name} - Ciclo atual: {current_cycle}")

                    # ✅ AVANÇAR CICLO: Usar função SQL nativa para garantir consistência
                    from sqlalchemy import text

                    try:
                        # Criar nova sessão para executar função sem interferência
                        from app.core.database import SessionLocal
                        new_db = SessionLocal()

                        try:
                            # CONCEITO CORRETO: Avançar ciclo E copiar usuário para próximo ciclo
                            next_cycle = min(current_cycle + 1, 3)

                            # Atualizar ciclo E definir contador para próximo ciclo
                            update_cycle_query = text("""
                                UPDATE inventario.inventory_lists
                                SET current_cycle = :next_cycle,
                                    counter_cycle_2 = CASE WHEN :next_cycle = 2 THEN CAST(:user_id AS uuid) ELSE counter_cycle_2 END,
                                    counter_cycle_3 = CASE WHEN :next_cycle = 3 THEN CAST(:user_id AS uuid) ELSE counter_cycle_3 END,
                                    updated_at = NOW()
                                WHERE id = CAST(:inventory_id AS uuid)
                                RETURNING current_cycle
                            """)

                            result = new_db.execute(
                                update_cycle_query,
                                {
                                    "inventory_id": str(inventory_id),
                                    "next_cycle": next_cycle,
                                    "user_id": str(user_id)
                                }
                            ).fetchone()

                            # Marcar itens para recontagem no próximo ciclo (simplificado)
                            if next_cycle == 2:
                                # Marcar todos os itens para 2º ciclo
                                mark_recount_query = text("""
                                    UPDATE inventario.inventory_items
                                    SET needs_recount_cycle_2 = true
                                    WHERE inventory_list_id = CAST(:inventory_id AS uuid)
                                """)
                            elif next_cycle == 3:
                                # Marcar todos os itens para 3º ciclo
                                mark_recount_query = text("""
                                    UPDATE inventario.inventory_items
                                    SET needs_recount_cycle_3 = true
                                    WHERE inventory_list_id = CAST(:inventory_id AS uuid)
                                """)

                            if next_cycle in [2, 3]:
                                new_db.execute(mark_recount_query, {"inventory_id": str(inventory_id)})

                            new_db.commit()

                            # Simular resultado da função original
                            if result:
                                result = (0, next_cycle)  # items_needing_recount, next_cycle
                        finally:
                            new_db.close()

                        if result:
                            items_needing_recount = result[0]
                            next_cycle = result[1]
                            print(f"✅ [CICLO AVANÇADO] Próximo ciclo: {next_cycle}, Itens para recontagem: {items_needing_recount}")

                            # Atualizar status da lista para ABERTA (permite nova atribuição)
                            updated = db.query(CountingAssignment).filter(
                                CountingAssignment.assigned_to == user_id
                            ).update(
                                {"list_status": "ABERTA"},
                                synchronize_session=False
                            )

                            db.commit()

                            # Recarregar inventário para pegar ciclo atualizado
                            inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
                            actual_cycle = inventory.current_cycle if inventory else next_cycle

                            return {
                                "success": True,
                                "message": f"Rodada encerrada! Inventário avançou para {actual_cycle}º ciclo.",
                                "data": {
                                    "previous_cycle": current_cycle,
                                    "current_cycle": actual_cycle,
                                    "items_needing_recount": items_needing_recount,
                                    "updated_assignments": updated,
                                    "user_name": user_name,
                                    "inventory_name": inventory.name if inventory else "N/A"
                                }
                            }
                        else:
                            print("❌ [ERRO] Função advance_cycle retornou resultado vazio")

                    except Exception as cycle_error:
                        print(f"❌ [ERRO CICLO] Erro ao avançar ciclo: {cycle_error}")
                        # Se falhar o avanço de ciclo, continuar com atualização simples
                        pass
            else:
                print(f"⚠️ [NO ASSIGNMENT] Nenhuma atribuição encontrada para user_id: {user_id}")

            print("⚠️ [FALLBACK] Não foi possível avançar ciclo, executando atualização simples")

        # ✅ ATUALIZAÇÃO PADRÃO DE STATUS (FALLBACK OU AÇÃO NORMAL)
        updated = db.query(CountingAssignment).filter(
            CountingAssignment.assigned_to == user_id
        ).update(
            {"list_status": new_status},
            synchronize_session=False
        )

        db.commit()

        print(f"✅ Status da lista {list_id} atualizado para {new_status}")

        return {
            "success": True,
            "message": f"Status atualizado para {new_status}",
            "updated_assignments": updated
        }

    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar status: {e}")
        return {"success": False, "message": str(e)}

@app.post("/api/v1/inventory/lists/{inventory_id}/close-counting-round", tags=["Inventory"])
async def close_counting_round(
    inventory_id: str,
    count_round: str = Query(..., description="Formato: user_id_round (ex: uuid_1)"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Encerrar rodada específica de contagem por usuário"""
    try:
        from app.models.models import InventoryList, CountingAssignment, InventoryItem
        from sqlalchemy import func, and_
        import uuid
        
        # Validar inventory_id como UUID
        try:
            inventory_uuid = uuid.UUID(inventory_id)
        except ValueError:
            return {"success": False, "message": "ID de inventário inválido"}
        
        # Buscar inventário
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid,
            InventoryList.store_id == current_user.store_id
        ).first()

        if not inventory:
            return {"success": False, "message": "Inventário não encontrado"}

        # Bloquear inventário efetivado
        check_inventory_not_closed(inventory)

        # Extrair user_id e round do parâmetro count_round (formato: user_id_round)
        try:
            # O formato é algo como: 0f3ed81e-2098-47b9-b60a-4a4e46fdcd6e_1
            # Dividir pelo último underscore
            last_underscore = count_round.rfind('_')
            if last_underscore == -1:
                raise ValueError("Formato inválido - sem underscore")
            
            user_id_str = count_round[:last_underscore]  # Parte antes do último _
            round_number = int(count_round[last_underscore + 1:])  # Parte após o último _
            
            # Converter user_id para UUID
            user_uuid = uuid.UUID(user_id_str)
            
        except (ValueError, IndexError) as e:
            return {"success": False, "message": f"Formato de rodada inválido: {count_round} - {str(e)}"}
        
        # Buscar atribuições da rodada específica (se existirem)
        assignments = db.query(CountingAssignment).join(
            InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid,
            CountingAssignment.assigned_to == user_uuid,
            CountingAssignment.count_number == round_number,
            CountingAssignment.status.in_(['PENDING', 'IN_PROGRESS'])
        ).all()
        
        # Se não há atribuições formais, verificar se há contagens diretas
        from app.models.models import Counting
        direct_countings = []
        
        if not assignments:
            # Buscar contagens diretas (sem atribuição formal)
            direct_countings = db.query(Counting).join(
                InventoryItem, Counting.inventory_item_id == InventoryItem.id
            ).outerjoin(
                CountingAssignment,
                and_(
                    CountingAssignment.inventory_item_id == InventoryItem.id,
                    CountingAssignment.assigned_to == user_uuid,
                    CountingAssignment.count_number == round_number
                )
            ).filter(
                InventoryItem.inventory_list_id == inventory_uuid,
                Counting.counted_by == user_uuid,
                Counting.count_number == round_number,
                CountingAssignment.id.is_(None)  # Sem atribuição formal
            ).all()
            
            if not direct_countings:
                return {"success": False, "message": "Nenhuma contagem encontrada para esta rodada"}
        
        # Processar atribuições formais ou contagens diretas
        items_closed = 0
        discrepancies_created = 0
        
        if assignments:
            # Processar atribuições formais
            for assignment in assignments:
                assignment.status = 'COMPLETED'
                assignment.completed_at = func.now()
                items_closed += 1
                
                # Criar divergência se houver diferença
                discrepancy_created = await create_discrepancy_for_item(
                    db, assignment.inventory_item_id, user_uuid, round_number
                )
                if discrepancy_created:
                    discrepancies_created += 1
        else:
            # Processar contagens diretas
            for counting in direct_countings:
                items_closed += 1
                
                # Criar divergência se houver diferença
                discrepancy_created = await create_discrepancy_for_item(
                    db, counting.inventory_item_id, user_uuid, round_number
                )
                if discrepancy_created:
                    discrepancies_created += 1
        
        # Marcar rodada como encerrada usando a nova tabela (apenas uma vez por inventário/usuário/rodada)
        from app.models.models import ClosedCountingRound
        
        # Verificar se já existe registro de fechamento
        existing_closure = db.query(ClosedCountingRound).filter(
            ClosedCountingRound.inventory_list_id == inventory_uuid,
            ClosedCountingRound.user_id == user_uuid,
            ClosedCountingRound.round_number == round_number
        ).first()
        
        if not existing_closure:
            # Criar registro de fechamento
            closure_record = ClosedCountingRound(
                inventory_list_id=inventory_uuid,
                user_id=user_uuid,
                round_number=round_number,
                notes=f"Rodada {round_number} encerrada - {items_closed} itens processados"
            )
            db.add(closure_record)
        
        db.commit()
        
        # 🔄 LÓGICA AUTOMÁTICA: Verificar se inventário deve avançar para próxima rodada
        await check_and_advance_inventory_round(db, inventory_uuid, round_number)
        
        return {
            "success": True,
            "message": f"Rodada {round_number}ª encerrada com sucesso. {discrepancies_created} divergências identificadas.",
            "data": {
                "inventory_id": inventory_id,
                "user_id": str(user_uuid),
                "round_number": round_number,
                "items_closed": items_closed,
                "discrepancies_created": discrepancies_created,
                "closed_at": func.now().desc
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Erro ao encerrar rodada: {e}")
        return {"success": False, "message": f"Erro interno: {str(e)}"}

@app.get("/api/v1/inventory/lists/{inventory_id}/available-counters", tags=["Inventory"])
async def get_available_counters(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar usuários disponíveis para designar como contadores"""
    try:
        from app.models.models import InventoryList
        from app.core.security import UNIFIED_AUTH
        import uuid

        inventory_uuid = uuid.UUID(inventory_id)

        # Verificar se inventário existe
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid
        ).first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        available_counters = []

        if UNIFIED_AUTH:
            # ✅ Modo plataforma unificada: buscar usuários do schema core
            from app.models.core_models import (
                CoreUsuario, CoreUsuarioFilial, CorePermissaoModulo,
                CoreModuloSistema, CoreRoleModulo
            )
            from sqlalchemy import and_

            # Buscar usuarios ativos que:
            # 1. Tem permissao no modulo INVENTARIO
            # 2. Tem acesso a filial do inventario (via usuario_filiais)
            users = db.query(
                CoreUsuario.id,
                CoreUsuario.username,
                CoreUsuario.nome,
                CoreRoleModulo.codigo.label('role_codigo'),
            ).join(
                CorePermissaoModulo, CorePermissaoModulo.usuario_id == CoreUsuario.id
            ).join(
                CoreModuloSistema, CoreModuloSistema.id == CorePermissaoModulo.modulo_id
            ).join(
                CoreRoleModulo, CoreRoleModulo.id == CorePermissaoModulo.role_modulo_id
            ).join(
                CoreUsuarioFilial, CoreUsuarioFilial.usuario_id == CoreUsuario.id
            ).filter(
                and_(
                    CoreModuloSistema.codigo == 'INVENTARIO',
                    CorePermissaoModulo.status == 'ATIVO',
                    CoreUsuario.status == 'ATIVO',
                    CoreUsuarioFilial.filial_id == str(inventory.store_id),
                )
            ).order_by(CoreUsuario.nome).all()

            # ✅ Auto-sync: garantir que esses usuários existam em inventario.users
            # para que FKs em counting_lists.counter_cycle_* funcionem
            from app.models.models import UserStore, UserRole
            for user in users:
                user_uuid = uuid.UUID(str(user.id))
                existing = db.query(User).filter(User.id == user_uuid).first()
                if not existing:
                    role_map = {'ADMIN': UserRole.ADMIN, 'SUPERVISOR': UserRole.SUPERVISOR, 'OPERATOR': UserRole.OPERATOR}
                    new_user = User(
                        id=user_uuid,
                        username=user.username,
                        full_name=user.nome or user.username,
                        password_hash='synced_from_core',
                        role=role_map.get(user.role_codigo, UserRole.OPERATOR),
                        store_id=inventory.store_id,
                        is_active=True,
                    )
                    db.add(new_user)
                    # Vincular à filial do inventário
                    new_us = UserStore(user_id=user_uuid, store_id=inventory.store_id)
                    db.add(new_us)
                    logger.info(f"✅ Auto-sync: usuario '{user.username}' criado em inventario.users")
                else:
                    # Atualizar nome e role se mudou
                    role_map = {'ADMIN': UserRole.ADMIN, 'SUPERVISOR': UserRole.SUPERVISOR, 'OPERATOR': UserRole.OPERATOR}
                    existing.full_name = user.nome or user.username
                    existing.role = role_map.get(user.role_codigo, existing.role)
                    existing.is_active = True

            db.commit()

            for user in users:
                available_counters.append({
                    "user_id": str(user.id),
                    "username": user.username,
                    "full_name": user.nome or user.username,
                    "role": user.role_codigo or "OPERATOR",
                    "is_current_user": str(user.id) == str(current_user.id)
                })
        else:
            # Modo standalone: buscar do schema inventario (legado)
            from app.models.models import UserStore
            from sqlalchemy import and_

            users = db.query(User).join(
                UserStore, UserStore.user_id == User.id
            ).filter(
                and_(
                    UserStore.store_id == inventory.store_id,
                    User.is_active == True,
                )
            ).order_by(User.full_name).all()

            for user in users:
                role_val = user.role.value if hasattr(user.role, 'value') else str(user.role)
                available_counters.append({
                    "user_id": str(user.id),
                    "username": user.username,
                    "full_name": user.full_name,
                    "role": role_val,
                    "is_current_user": user.id == current_user.id
                })

        logger.info(f"✅ Listados {len(available_counters)} contadores disponíveis (UNIFIED_AUTH={UNIFIED_AUTH})")

        return {
            "inventory_id": inventory_id,
            "inventory_name": inventory.name,
            "available_counters": available_counters,
            "total": len(available_counters)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao listar contadores disponíveis: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao listar contadores"))

@app.post("/api/v1/inventory/lists/{inventory_id}/assign-counters", tags=["Inventory"])
async def assign_counters_to_products(
    inventory_id: str,
    request: dict,  # {"assignments": [{"item_id": "uuid", "counter_user_id": "uuid"}, ...], "counting_round": 1}
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Nova arquitetura: Criar atribuições inteligentes usando counting_assignments"""
    try:
        from app.models.models import InventoryList, InventoryItem, CountingAssignment, User, SB1010
        from sqlalchemy import func
        
        # Verificar se inventário existe
        from uuid import UUID
        try:
            inventory_id_uuid = UUID(inventory_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de inventário inválido")
            
        # Admin tem acesso a todas as lojas, outros usuários apenas à sua loja
        if current_user.role == "ADMIN":
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_id_uuid
            ).first()
        else:
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_id_uuid,
                InventoryList.store_id == current_user.store_id
            ).first()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        assignments = request.get("assignments", [])
        counting_round = request.get("counting_round", 1)
        
        if not assignments:
            raise HTTPException(status_code=400, detail="Nenhuma atribuição fornecida")
        
        # Agrupar atribuições por usuário
        user_assignments = {}
        for assignment in assignments:
            try:
                counter_user_id = UUID(assignment["counter_user_id"])
            except ValueError:
                raise HTTPException(status_code=400, detail=f"ID de usuário inválido: {assignment['counter_user_id']}")
            if counter_user_id not in user_assignments:
                user_assignments[counter_user_id] = []
            user_assignments[counter_user_id].append(assignment)
        
        created_assignments = []
        success_count = 0
        errors = []
        
        # Criar uma counting_assignment para cada usuário
        for counter_user_id, user_items in user_assignments.items():
            try:
                # Verificar se o usuário contador existe
                # Admin pode atribuir qualquer usuário, outros apenas da mesma loja
                if current_user.role == "ADMIN":
                    counter_user = db.query(User).filter(
                        User.id == counter_user_id,
                        User.is_active == True
                    ).first()
                else:
                    counter_user = db.query(User).filter(
                        User.id == counter_user_id,
                        User.store_id == current_user.store_id,
                        User.is_active == True
                    ).first()
                
                if not counter_user:
                    errors.append(f"Contador ID {counter_user_id} não encontrado ou inativo")
                    continue
                
                # Pular verificação de atribuição duplicada por usuário - será verificado por item
                
                # Criar atribuições individuais para cada item
                for assignment in user_items:
                    try:
                        item_id = UUID(assignment["item_id"])
                        
                        # Verificar se já existe atribuição para este item nesta rodada
                        existing_assignment = db.query(CountingAssignment).filter(
                            CountingAssignment.inventory_item_id == item_id,
                            CountingAssignment.count_number == counting_round
                        ).first()
                        
                        if existing_assignment:
                            errors.append(f"Item {item_id} já possui atribuição na {counting_round}ª rodada")
                            continue
                        
                        # Buscar dados do produto
                        item_data = db.query(InventoryItem, SB1010).join(
                            SB1010, InventoryItem.product_code == SB1010.b1_cod
                        ).filter(
                            InventoryItem.id == item_id,
                            InventoryItem.inventory_list_id == inventory_id_uuid
                        ).first()
                        
                        if not item_data:
                            errors.append(f"Item ID {item_id} não encontrado no inventário")
                            continue
                        
                        item, product = item_data
                        
                        # Criar atribuição individual para este item
                        counting_assignment = CountingAssignment(
                            inventory_item_id=item_id,
                            assigned_to=counter_user_id,
                            assigned_by=current_user.id,
                            count_number=counting_round,
                            cycle_number=counting_round,
                            reason=f"Atribuição manual - {counting_round}ª contagem",
                            status="PENDING"
                        )
                        
                        db.add(counting_assignment)
                        success_count += 1
                        created_assignments.append({
                            "assignment_id": str(counting_assignment.id),
                            "item_id": str(item_id),
                            "product_code": item.product_code.strip(),
                            "product_name": product.b1_desc.strip() if product.b1_desc else "Produto sem descrição",
                            "assigned_to": counter_user.full_name,
                            "counting_round": counting_round
                        })
                        
                    except ValueError as e:
                        errors.append(f"ID inválido no item: {str(e)}")
                        continue
                    except Exception as e:
                        errors.append(f"Erro ao processar item {assignment.get('item_id', 'desconhecido')}: {str(e)}")
                        continue
                
            except Exception as e:
                errors.append(f"Erro ao processar usuário {counter_user_id}: {str(e)}")
        
        # Commit todas as atribuições
        db.commit()
        
        logger.info(f"✅ Criadas {len(created_assignments)} atribuições para inventário {inventory_id}")
        
        return {
            "message": f"Atribuições criadas com sucesso usando nova arquitetura",
            "created_assignments": created_assignments,
            "assigned_products_count": success_count,
            "total_assignments": len(assignments),
            "errors": errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao criar atribuições: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao criar atribuições"))

@app.get("/api/v1/my-assignments", tags=["Counting"])
async def get_my_assignments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Nova arquitetura: Buscar atribuições do usuário usando counting_assignments

    ✅ v2.9.3: Query diferenciada por role:
    - OPERATOR: Requer counting_assignments (segurança estrita)
    - SUPERVISOR/ADMIN: Pode acessar inventários da loja (flexível para Via 2)
    """
    try:
        from app.models.models import CountingAssignment, InventoryList, InventoryItem, Product

        logger.info(f"🔍 [my-assignments] Usuário: {current_user.username}, Role: {current_user.role}")

        # OPERATOR: Query estrita (requer counting_assignments)
        if current_user.role == 'OPERATOR':
            assignments = db.query(CountingAssignment, InventoryItem, InventoryList, Product).join(
                InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
            ).join(
                InventoryList, InventoryItem.inventory_list_id == InventoryList.id
            ).outerjoin(
                Product, InventoryItem.product_id == Product.id
            ).filter(
                CountingAssignment.assigned_to == current_user.id,  # ✅ Filtro estrito
                CountingAssignment.status.in_(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'RELEASED']),
                InventoryList.store_id == current_user.store_id,  # ✅ Isolamento por loja
                InventoryList.list_status.in_(['ABERTA', 'RELEASED', 'EM_CONTAGEM'])  # ✅ v2.9.3: OPERATOR vê ABERTA se tiver atribuição
            ).order_by(
                CountingAssignment.count_number,
                CountingAssignment.created_at
            ).all()

        # SUPERVISOR/ADMIN: Query flexível (Via 2 - Gerenciar Lista)
        else:
            # Buscar inventory_items da loja do usuário (sem exigir counting_assignments)
            assignments = db.query(None, InventoryItem, InventoryList, Product).join(
                InventoryList, InventoryItem.inventory_list_id == InventoryList.id
            ).outerjoin(
                Product, InventoryItem.product_id == Product.id
            ).filter(
                InventoryList.store_id == current_user.store_id,  # ✅ Isolamento por loja (SEGURANÇA)
                InventoryList.list_status.in_(['ABERTA', 'RELEASED', 'EM_CONTAGEM'])  # ✅ v2.9.3: SUPERVISOR pode ver ABERTA (Via 2)
            ).order_by(
                InventoryItem.created_at
            ).all()

        logger.info(f"🎯 [my-assignments] Encontradas {len(assignments)} atribuições")

        if not assignments:
            return {
                "message": "Nenhuma atribuição encontrada para o usuário",
                "inventories": []
            }
        
        # Formatear resposta para compatibilidade com frontend existente
        inventories = {}
        
        for assignment, item, inventory, product in assignments:
            inventory_id = str(inventory.id)

            if inventory_id not in inventories:
                inventories[inventory_id] = {
                    "inventory_id": inventory_id,
                    "inventory_name": inventory.name,
                    "inventory_description": inventory.description or "Sem descrição",
                    "inventory_status": inventory.status,
                    "assigned_lists": []
                }

            # Usar código do produto real se disponível, senão o codigo do item
            product_code = product.code if product else (item.product_code or "SEM_CODIGO")
            product_name = product.name if product else f"Produto {product_code}"

            # ✅ v2.9.3: Ajustar para SUPERVISOR/ADMIN (assignment pode ser None)
            if assignment:
                # OPERATOR com counting_assignment
                assigned_list = {
                    "list_id": f"assignment_{assignment.id}",
                    "assignment_id": str(assignment.id),
                    "item_id": str(item.id),
                    "product_code": product_code,
                    "product_name": product_name,
                    "expected_quantity": item.expected_quantity,
                    "requires_lot": product.has_lot if product else False,
                    "count_number": assignment.count_number if hasattr(assignment, 'count_number') else 1,
                    "status": assignment.status,
                    "reason": assignment.reason or "Atribuição de contagem",
                    "deadline": assignment.deadline.isoformat() if assignment.deadline else None,
                    "created_at": assignment.created_at.isoformat() if assignment.created_at else None
                }
            else:
                # SUPERVISOR/ADMIN sem counting_assignment (Via 2)
                assigned_list = {
                    "list_id": f"item_{item.id}",
                    "assignment_id": None,
                    "item_id": str(item.id),
                    "product_code": product_code,
                    "product_name": product_name,
                    "expected_quantity": item.expected_quantity,
                    "requires_lot": product.has_lot if product else False,
                    "count_number": 1,
                    "status": inventory.list_status if hasattr(inventory, 'list_status') else "RELEASED",  # ✅ Usar status da lista
                    "reason": "Acesso via gerenciar lista",
                    "deadline": None,
                    "created_at": item.created_at.isoformat() if hasattr(item, 'created_at') and item.created_at else None
                }

            inventories[inventory_id]["assigned_lists"].append(assigned_list)
        
        logger.info(f"✅ Encontradas {len(assignments)} atribuições para usuário {current_user.username}")
        
        return {
            "message": f"Encontradas {len(assignments)} atribuições",
            "inventories": list(inventories.values())
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar atribuições do usuário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar atribuições"))



@app.post("/api/v1/inventory/lists/{inventory_id}/assign-counter-bulk", tags=["Inventory"])
async def assign_counter_to_all_products(
    inventory_id: str,
    request: dict,  # {"counter_user_id": "uuid"}
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Designar um contador para TODOS os produtos do inventário"""
    try:
        from app.models.models import InventoryList, InventoryItem
        import uuid
        
        # Verificar se inventário existe
        inventory_uuid = uuid.UUID(inventory_id)
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid,
            InventoryList.store_id == current_user.store_id
        ).first()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        counter_user_id = uuid.UUID(request.get("counter_user_id"))
        
        # Verificar se o usuário contador existe
        counter_user = db.query(User).filter(
            User.id == counter_user_id,
            User.store_id == current_user.store_id,
            User.is_active == True
        ).first()
        
        if not counter_user:
            raise HTTPException(status_code=404, detail="Contador não encontrado ou inativo")
        
        # Buscar todos os itens do inventário
        inventory_items = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).all()
        
        # Criar atribuições para cada item
        from app.models.models import CountingAssignment
        assignments_created = 0
        
        for item in inventory_items:
            # Verificar se já existe atribuição para este item
            existing_assignment = db.query(CountingAssignment).filter(
                CountingAssignment.inventory_item_id == item.id,
                CountingAssignment.count_number == 1,
                CountingAssignment.status == 'PENDING'
            ).first()
            
            if not existing_assignment:
                # Criar nova atribuição
                assignment = CountingAssignment(
                    inventory_item_id=item.id,
                    assigned_to=counter_user_id,
                    assigned_by=current_user.id,
                    count_number=1,
                    status='PENDING',
                    deadline=datetime.utcnow() + timedelta(days=7),  # 7 dias para contar
                    reason=f"Atribuição em lote para inventário {inventory.name}"
                )
                db.add(assignment)
                assignments_created += 1
            
            # Atualizar item para indicar que foi atribuído
            item.last_counted_by = counter_user_id
        
        db.commit()
        
        logger.info(f"✅ Contador {counter_user.full_name} atribuído a {assignments_created} itens")
        
        return {
            "message": f"Contador {counter_user.full_name} atribuído a {assignments_created} produtos",
            "counter_name": counter_user.full_name,
            "assigned_count": assignments_created
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao atribuir contador em lote: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao atribuir contador"))

@app.get("/api/v1/inventory/lists/{inventory_id}/counter-assignments", tags=["Inventory"])
async def get_counter_assignments(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Visualizar as atribuições de contadores por produto"""
    try:
        from app.models.models import InventoryList, InventoryItem, SB1010
        import uuid
        
        # Verificar se inventário existe
        inventory_uuid = uuid.UUID(inventory_id)
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid,
            InventoryList.store_id == current_user.store_id
        ).first()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Buscar itens com seus contadores e dados do produto
        items_query = db.query(InventoryItem, SB1010, User).join(
            SB1010, InventoryItem.product_code == SB1010.b1_cod
        ).outerjoin(
            User, InventoryItem.last_counted_by == User.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).order_by(InventoryItem.sequence)
        
        items = items_query.all()
        
        # Converter para formato da API
        assignments = []
        for item, produto, contador in items:
            assignments.append({
                "item_id": str(item.id),
                "sequence": item.sequence,
                "product_code": item.product_code,
                "product_name": produto.b1_desc,
                "counter_assigned": {
                    "user_id": str(contador.id) if contador else None,
                    "username": contador.username if contador else None,
                    "full_name": contador.full_name if contador else None,
                    "role": contador.role.value if contador else None
                } if contador else None,
                "status": item.status.value
            })
        
        # Estatísticas
        total_items = len(assignments)
        assigned_items = len([a for a in assignments if a["counter_assigned"]])
        unassigned_items = total_items - assigned_items
        
        logger.info(f"✅ Consultadas atribuições: {assigned_items}/{total_items} itens com contador")
        
        return {
            "inventory_id": inventory_id,
            "inventory_name": inventory.name,
            "assignments": assignments,
            "statistics": {
                "total_items": total_items,
                "assigned_items": assigned_items,
                "unassigned_items": unassigned_items,
                "assignment_percentage": round((assigned_items / total_items * 100), 2) if total_items > 0 else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao consultar atribuições: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao consultar atribuições"))

@app.post("/api/v1/inventory/{inventory_id}/release-cycle-2", tags=["Inventory"])
async def release_cycle_2(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liberar ciclo 2 automaticamente baseado nas divergências do ciclo 1"""
    from app.models.models import InventoryList, InventoryItem, CountingAssignment, Counting, User
    import uuid
    
    try:
        logger.info(f"🔄 Liberando ciclo 2 para inventário: {inventory_id}")
        logger.info(f"🔍 Usuário: {current_user.username} (role: {current_user.role})")
        
        # Verificar se inventário existe
        inventory_uuid = uuid.UUID(inventory_id)
        if current_user.role == 'ADMIN':
            # Admin pode acessar inventários de qualquer loja
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_uuid
            ).first()
        else:
            # Outros usuários apenas da sua loja
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_uuid,
                InventoryList.store_id == current_user.store_id
            ).first()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Buscar itens com contagens do ciclo 1 que têm divergências
        items_with_divergences = db.query(InventoryItem, Counting).join(
            Counting, InventoryItem.id == Counting.inventory_item_id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid,
            Counting.count_number == 1
        ).all()
        
        logger.info(f"📊 Encontradas {len(items_with_divergences)} contagens do ciclo 1")
        
        if not items_with_divergences:
            return {
                "success": False,
                "message": "Não há contagens do ciclo 1 para liberar ciclo 2"
            }
        
        # Verificar se já existem atribuições do ciclo 2
        existing_cycle_2 = db.query(CountingAssignment).join(
            InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid,
            CountingAssignment.cycle_number == 2
        ).first()
        
        if existing_cycle_2:
            return {
                "success": False,
                "message": "Ciclo 2 já foi liberado para este inventário"
            }
        
        # Buscar usuários disponíveis para atribuição
        available_users = db.query(User).filter(
            User.store_id == current_user.store_id,
            User.is_active == True,
            User.role.in_(['ADMIN', 'SUPERVISOR', 'OPERATOR'])
        ).all()
        
        if not available_users:
            raise HTTPException(status_code=400, detail="Não há usuários disponíveis para atribuição")
        
        created_assignments = 0
        tolerance = 0.01  # 1% de tolerância
        
        # Para cada item com contagem do ciclo 1, verificar se há divergência
        for item, counting_1 in items_with_divergences:
            expected_qty = float(item.expected_quantity or 0)
            counted_qty = float(counting_1.quantity)
            
            # Como todas as quantidades esperadas são 0, qualquer contagem > 0 é divergência
            if counted_qty != expected_qty:
                logger.info(f"📊 Divergência encontrada no produto {item.product_code}: Esperado={expected_qty}, Contado={counted_qty}")
                
                # Usar admin como contador do ciclo 2 (pode ser customizado)
                assigned_user = current_user
                
                # Criar atribuição do ciclo 2
                assignment = CountingAssignment(
                    inventory_item_id=item.id,
                    assigned_to=assigned_user.id,
                    assigned_by=current_user.id,
                    count_number=2,
                    cycle_number=2,
                    status='PENDING',
                    reason=f'Divergência no ciclo 1: Esperado={expected_qty}, Contado={counted_qty}',
                    notes='Atribuição automática do ciclo 2 devido à divergência detectada'
                )
                
                db.add(assignment)
                created_assignments += 1
                
                logger.info(f"✅ Atribuição ciclo 2 criada: produto {item.product_code} → usuário {assigned_user.username}")
        
        if created_assignments > 0:
            db.commit()
            logger.info(f"🎯 Ciclo 2 liberado com sucesso: {created_assignments} atribuições criadas")
            
            return {
                "success": True,
                "message": f"Ciclo 2 liberado com sucesso! {created_assignments} produtos com divergências atribuídos para recontagem.",
                "assignments_created": created_assignments
            }
        else:
            return {
                "success": False,
                "message": "Nenhuma divergência encontrada. Ciclo 2 não necessário."
            }
            
    except Exception as e:
        import traceback
        error_detail = f"Erro ao liberar ciclo 2: {str(e)}"
        logger.error(f"❌ {error_detail}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=error_detail)

# =================================
# ENDPOINTS DE INVENTÁRIO (INLINE)
# =================================

@app.get("/api/v1/inventory/lists", tags=["Inventory"])
async def list_inventories(
    page: int = 1,
    size: int = 20,
    search: str = "",
    status: str = "",
    date_from: str = "",  # ✅ v2.19.52: Filtro de data inicial
    date_to: str = "",    # ✅ v2.19.52: Filtro de data final
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista inventários com lógica inteligente: Um usuário = Um inventário ativo"""
    try:
        from app.models.models import InventoryList, Store, InventoryItem, CountingAssignment, ClosedCountingRound, CountingList
        from sqlalchemy import or_, func, and_
        
        logger.info(f"🎯 LÓGICA INTELIGENTE: Buscando inventários para usuário {current_user.username} (role: {current_user.role})")
        
        # LÓGICA BASEADA EM PAPEL:
        # ADMIN/SUPERVISOR: Vê todos os inventários da loja (para fazer atribuições)
        # OPERATOR: Vê apenas seus inventários ativos (um usuário = um inventário)
        
        if current_user.role in ['ADMIN', 'SUPERVISOR']:
            if current_user.role == 'ADMIN':
                logger.info(f"👑 ADMIN - Mostrando todos os inventários de todas as lojas")
                # ADMIN vê todos os inventários de todas as lojas (incluindo encerrados)
                query = db.query(InventoryList).filter(
                    InventoryList.status.in_(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'])
                )
            else:
                logger.info(f"👑 SUPERVISOR - Mostrando todos os inventários da loja")
                # SUPERVISOR vê inventários da sua loja (incluindo encerrados)
                query = db.query(InventoryList).filter(
                    and_(
                        InventoryList.store_id == current_user.store_id,
                        InventoryList.status.in_(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'])
                    )
                )
            
        else:  # OPERATOR
            logger.info(f"👤 OPERATOR - Aplicando lógica: Um usuário = Um inventário ativo")

            # Subconsulta para inventários já encerrados por este usuário
            closed_inventories = db.query(ClosedCountingRound.inventory_list_id).filter(
                ClosedCountingRound.user_id == current_user.id
            ).subquery()

            active_inventory_ids = []

            # 1. Buscar inventários via counting_lists onde o user é counter para o ciclo atual
            counter_list_query = db.query(InventoryList.id).join(
                CountingList, InventoryList.id == CountingList.inventory_id
            ).filter(
                and_(
                    InventoryList.store_id == current_user.store_id,
                    InventoryList.status.in_(['DRAFT', 'IN_PROGRESS']),
                    CountingList.list_status.in_(['EM_CONTAGEM', 'LIBERADA', 'ABERTA']),
                    ~InventoryList.id.in_(closed_inventories),
                    or_(
                        and_(CountingList.current_cycle == 1, CountingList.counter_cycle_1 == current_user.id),
                        and_(CountingList.current_cycle == 2, CountingList.counter_cycle_2 == current_user.id),
                        and_(CountingList.current_cycle == 3, CountingList.counter_cycle_3 == current_user.id),
                    )
                )
            ).distinct()

            active_inventory_ids = [inv.id for inv in counter_list_query.all()]

            # 2. Se não encontrou via counting_lists, buscar via counting_assignments
            if not active_inventory_ids:
                logger.info(f"🔍 Sem listas de contagem atribuídas, buscando counting_assignments")
                active_assignments_query = db.query(InventoryList.id).join(
                    InventoryItem, InventoryList.id == InventoryItem.inventory_list_id
                ).join(
                    CountingAssignment, InventoryItem.id == CountingAssignment.inventory_item_id
                ).filter(
                    and_(
                        CountingAssignment.assigned_to == current_user.id,
                        CountingAssignment.status.in_(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
                        InventoryList.store_id == current_user.store_id,
                        InventoryList.status.in_(['DRAFT', 'IN_PROGRESS']),
                        ~InventoryList.id.in_(closed_inventories)
                    )
                ).distinct()
                active_inventory_ids = [inv.id for inv in active_assignments_query.all()]

            # 3. Se não encontrou via assignments, buscar por contagens diretas
            if not active_inventory_ids:
                logger.info(f"🔍 Sem atribuições formais, buscando contagens diretas do usuário")
                from app.models.models import Counting

                direct_countings_query = db.query(InventoryList.id).join(
                    InventoryItem, InventoryList.id == InventoryItem.inventory_list_id
                ).join(
                    Counting, InventoryItem.id == Counting.inventory_item_id
                ).filter(
                    and_(
                        Counting.counted_by == current_user.id,
                        InventoryList.store_id == current_user.store_id,
                        InventoryList.status.in_(['DRAFT', 'IN_PROGRESS']),
                        ~InventoryList.id.in_(closed_inventories)
                    )
                ).distinct()

                active_inventory_ids = [inv.id for inv in direct_countings_query.all()]

            logger.info(f"🎯 Inventários ativos encontrados para usuário: {len(active_inventory_ids)}")

            if not active_inventory_ids:
                logger.info(f"⚠️ Sem inventários ativos, buscando inventários encerrados do usuário")
                from app.models.models import Counting

                participated_inventories = db.query(InventoryList.id).join(
                    InventoryItem, InventoryList.id == InventoryItem.inventory_list_id
                ).join(
                    Counting, InventoryItem.id == Counting.inventory_item_id
                ).filter(
                    and_(
                        Counting.counted_by == current_user.id,
                        InventoryList.store_id == current_user.store_id
                    )
                ).distinct().all()

                if participated_inventories:
                    target_inventory_id = participated_inventories[0].id
                    logger.info(f"🎯 Mostrando inventário encerrado para demonstração: {target_inventory_id}")

                    query = db.query(InventoryList).filter(
                        InventoryList.id == target_inventory_id
                    )
                else:
                    logger.info(f"⚠️ Nenhum inventário encontrado para usuário {current_user.username}")
                    return {
                        "items": [],
                        "total": 0,
                        "page": page,
                        "size": size,
                        "message": "Nenhum inventário encontrado para este usuário"
                    }
            else:
                query = db.query(InventoryList).filter(
                    InventoryList.id.in_(active_inventory_ids)
                )
        
        # Aplicar filtros
        if search:
            query = query.filter(or_(
                InventoryList.name.ilike(f"%{search}%"),
                InventoryList.description.ilike(f"%{search}%")
            ))

        if status:
            query = query.filter(InventoryList.status == status)

        # ✅ v2.19.52: Filtros de data
        if date_from:
            try:
                from datetime import datetime
                date_from_parsed = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                query = query.filter(InventoryList.created_at >= date_from_parsed)
                logger.info(f"📅 [FILTRO] Aplicando date_from >= {date_from_parsed}")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao parsear date_from '{date_from}': {e}")

        if date_to:
            try:
                from datetime import datetime
                date_to_parsed = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                query = query.filter(InventoryList.created_at <= date_to_parsed)
                logger.info(f"📅 [FILTRO] Aplicando date_to <= {date_to_parsed}")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao parsear date_to '{date_to}': {e}")

        # Buscar loja do usuário para logs
        store = db.query(Store).filter(Store.id == current_user.store_id).first()
        
        # Contar total
        total = query.count()
        logger.info(f"🔍 Total de inventários da loja {store.name if store else 'N/A'}: {total}")
        
        # Aplicar paginação
        inventories = query.order_by(InventoryList.created_at.desc()).offset((page - 1) * size).limit(size).all()
        logger.info(f"🔍 Inventários encontrados na query: {len(inventories)}")
        
        # Converter para formato da API
        items = []
        for inv in inventories:
            logger.info(f"🔍 Processando inventário: {inv.name} (ID: {inv.id})")
            
            # Buscar usuário criador
            creator = db.query(User).filter(User.id == inv.created_by).first()
            
            # Calcular estatísticas reais do inventário
            total_items = db.query(InventoryItem).filter(
                InventoryItem.inventory_list_id == inv.id
            ).count()
            
            counted_items = db.query(InventoryItem).filter(
                InventoryItem.inventory_list_id == inv.id,
                InventoryItem.status == "COUNTED"
            ).count()
            
            progress_percentage = (counted_items / total_items * 100) if total_items > 0 else 0
            
            # SEGUNDA VALIDAÇÃO: Detectar qual contagem está ativa para este usuário
            from app.models.models import Counting, Discrepancy
            
            # Buscar contagens deste usuário neste inventário
            user_countings = db.query(Counting).join(
                InventoryItem, Counting.inventory_item_id == InventoryItem.id
            ).filter(
                and_(
                    InventoryItem.inventory_list_id == inv.id,
                    Counting.counted_by == current_user.id
                )
            ).order_by(Counting.count_number.desc()).all()
            
            # Determinar contagem ativa
            active_count_info = {
                "current_count_round": 1,
                "count_status": "primeira_contagem",
                "description": "1ª Contagem - Contagem inicial"
            }
            
            if user_countings:
                # Pegar a última contagem do usuário
                last_count = max(user_countings, key=lambda c: c.count_number)
                last_count_number = last_count.count_number
                
                # Verificar se há divergências pendentes criadas por este usuário
                user_discrepancies = db.query(Discrepancy).join(
                    InventoryItem, Discrepancy.inventory_item_id == InventoryItem.id
                ).filter(
                    and_(
                        InventoryItem.inventory_list_id == inv.id,
                        Discrepancy.created_by == current_user.id,
                        Discrepancy.status == "PENDING"
                    )
                ).count()
                
                if last_count_number == 1:
                    # Usuário fez 1ª contagem - sempre pode fazer 2ª independente de divergências
                    active_count_info = {
                        "current_count_round": 2,
                        "count_status": "segunda_contagem",
                        "description": f"2ª Contagem - Recontagem de divergências ({user_discrepancies} divergências)"
                    }
                elif last_count_number == 2 and user_discrepancies > 0:
                    # Usuário fez 2ª contagem e ainda há divergências - pode fazer 3ª (só ADMIN)
                    if current_user.role == 'ADMIN':
                        active_count_info = {
                            "current_count_round": 3,
                            "count_status": "terceira_contagem",
                            "description": f"3ª Contagem - Decisão final para {user_discrepancies} divergências"
                        }
                    else:
                        active_count_info = {
                            "current_count_round": 2,
                            "count_status": "aguardando_admin",
                            "description": "Aguardando ADMIN para 3ª contagem"
                        }
                else:
                    # Sem divergências ou contagem concluída
                    active_count_info = {
                        "current_count_round": last_count_number,
                        "count_status": "concluida",
                        "description": f"Contagem concluída - {last_count_number}ª rodada"
                    }
            
            logger.info(f"🎯 Contagem ativa detectada: {active_count_info['description']}")
            
            items.append({
                "id": str(inv.id),
                "name": inv.name,
                "description": inv.description or "",
                "reference_date": inv.reference_date.isoformat() if inv.reference_date else None,
                "count_deadline": inv.count_deadline.isoformat() if inv.count_deadline else None,
                "warehouse": inv.warehouse,  # ✅ CORREÇÃO v2.15.0: Adicionar warehouse na resposta
                "status": inv.status.value,
                "created_at": inv.created_at.isoformat(),
                "updated_at": inv.updated_at.isoformat() if inv.updated_at else inv.created_at.isoformat(),
                "created_by_name": creator.full_name if creator else "Sistema",
                "store_name": store.name if store else "Loja",
                "total_items": total_items,
                "counted_items": counted_items,
                "progress_percentage": round(progress_percentage, 1),
                # ✅ CORREÇÃO: Adicionar current_cycle para badges na interface
                "current_cycle": inv.current_cycle,
                "list_status": inv.list_status,
                # INFORMAÇÕES DA CONTAGEM ATIVA
                "active_count": active_count_info
            })
        
        logger.info(f"✅ Retornando {len(items)} inventários para usuário {current_user.username}")
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao listar inventários: {e}")
        import traceback
        logger.error(f"❌ Stacktrace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao listar inventários"))

async def create_default_counting_lists(db: Session, inventory_id: str, created_by_user_id: str, store_id: str):
    """
    Cria listas de contagem automáticas para um inventário
    Busca usuários operadores da loja e cria uma lista para cada um
    """
    try:
        from app.models.models import User, CountingList
        import uuid

        # Buscar usuários operadores da mesma loja
        operators = db.query(User).filter(
            User.store_id == store_id,
            User.role.in_(['OPERATOR', 'SUPERVISOR']),
            User.is_active == True
        ).limit(5).all()  # Máximo 5 listas por inventário

        logger.info(f"🔍 Encontrados {len(operators)} operadores para criar listas automáticas")

        if not operators:
            logger.warning("⚠️ Nenhum operador encontrado na loja. Criando lista padrão.")
            # Se não há operadores, criar uma lista padrão
            operators = [type('obj', (object,), {
                'id': created_by_user_id,
                'username': 'admin',
                'full_name': 'Lista Principal'
            })]

        # Criar uma lista para cada operador
        for i, operator in enumerate(operators):
            list_name = f"Lista {operator.full_name or operator.username}"
            description = f"Lista de contagem do(a) {operator.full_name or operator.username}"

            # Se houver múltiplos operadores, dividir por setor/área
            if len(operators) > 1:
                sectors = ['Setor A', 'Setor B', 'Setor C', 'Setor D', 'Setor E']
                list_name += f" - {sectors[i]}"
                description += f" - {sectors[i]}"

            new_counting_list = CountingList(
                id=str(uuid.uuid4()),
                inventory_id=inventory_id,
                list_name=list_name,
                description=description,
                current_cycle=1,
                list_status='PREPARACAO',
                counter_cycle_1=str(operator.id),
                created_by=created_by_user_id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )

            db.add(new_counting_list)
            logger.info(f"✅ Lista criada: {list_name} para operador {operator.username}")

        # Marcar inventário como usando múltiplas listas
        from app.models.models import InventoryList
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
        if inventory:
            inventory.use_multiple_lists = True
            inventory.total_lists = len(operators)

        db.commit()
        logger.info(f"✅ {len(operators)} listas de contagem criadas automaticamente para inventário {inventory_id}")

        # 🔄 DISTRIBUIR PRODUTOS AUTOMATICAMENTE ENTRE AS LISTAS
        logger.info(f"🔄 Iniciando distribuição automática de produtos para inventário {inventory_id}")
        try:
            await distribute_products_to_counting_lists(db, inventory_id)
            logger.info(f"✅ Distribuição automática concluída para inventário {inventory_id}")
        except Exception as dist_error:
            logger.error(f"❌ Erro na distribuição automática: {dist_error}")
            import traceback
            logger.error(f"❌ Stacktrace distribuição: {traceback.format_exc()}")
            # Continua sem falhar a criação das listas

    except Exception as e:
        logger.error(f"❌ Erro ao criar listas automáticas: {e}")
        db.rollback()


async def distribute_products_to_counting_lists(db: Session, inventory_id: str):
    """
    Distribui automaticamente os produtos do inventário entre as listas de contagem
    """
    try:
        from app.models.models import InventoryItem, CountingList, CountingListItem
        import uuid

        # Buscar produtos do inventário
        products = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory_id
        ).all()

        if not products:
            logger.warning(f"⚠️ Nenhum produto encontrado no inventário {inventory_id}")
            return

        # Buscar listas de contagem
        counting_lists = db.query(CountingList).filter(
            CountingList.inventory_id == inventory_id
        ).all()

        if not counting_lists:
            logger.warning(f"⚠️ Nenhuma lista de contagem encontrada para inventário {inventory_id}")
            return

        logger.info(f"🔄 Distribuindo {len(products)} produtos entre {len(counting_lists)} listas")

        # Distribuir produtos de forma equilibrada
        products_per_list = len(products) // len(counting_lists)
        remaining_products = len(products) % len(counting_lists)

        product_index = 0

        for list_index, counting_list in enumerate(counting_lists):
            # Calcular quantos produtos esta lista deve receber
            products_for_this_list = products_per_list
            if list_index < remaining_products:
                products_for_this_list += 1

            logger.info(f"📦 Lista {counting_list.list_name}: {products_for_this_list} produtos")

            # Atribuir produtos a esta lista
            for i in range(products_for_this_list):
                if product_index < len(products):
                    product = products[product_index]

                    counting_list_item = CountingListItem(
                        id=str(uuid.uuid4()),
                        counting_list_id=counting_list.id,
                        inventory_item_id=product.id,
                        needs_count_cycle_1=True,
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )

                    db.add(counting_list_item)
                    product_index += 1

        db.commit()
        logger.info(f"✅ Produtos distribuídos com sucesso entre as listas de contagem")

    except Exception as e:
        logger.error(f"❌ Erro ao distribuir produtos: {e}")
        db.rollback()


@app.post("/api/v1/inventory/{inventory_id}/create-counting-lists", tags=["Inventory"])
async def create_counting_lists_for_inventory(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cria listas de contagem automáticas para um inventário existente
    """
    try:
        from app.models.models import InventoryList

        logger.info(f"🚀 Iniciando criação de listas para inventário {inventory_id}")

        # Verificar se o inventário existe
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
        if not inventory:
            logger.error(f"❌ Inventário {inventory_id} não encontrado")
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        logger.info(f"✅ Inventário encontrado: {inventory.name} (store: {inventory.store_id})")

        # Criar listas automáticas
        await create_default_counting_lists(db, inventory_id, current_user.id, inventory.store_id)

        logger.info(f"✅ Processo de criação de listas finalizado para inventário {inventory_id}")
        return {"success": True, "message": "Listas de contagem criadas com sucesso"}

    except Exception as e:
        logger.error(f"❌ Erro ao criar listas de contagem: {e}")
        import traceback
        logger.error(f"❌ Stacktrace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno"))


@app.post("/api/v1/inventory/{inventory_id}/distribute-products", tags=["Inventory"])
async def distribute_products_for_inventory(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Distribui produtos do inventário entre as listas de contagem existentes
    """
    try:
        from app.models.models import InventoryList

        # Verificar se o inventário existe
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # Distribuir produtos
        await distribute_products_to_counting_lists(db, inventory_id)

        return {"success": True, "message": "Produtos distribuídos com sucesso entre as listas"}

    except Exception as e:
        logger.error(f"❌ Erro ao distribuir produtos: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno"))


@app.post("/api/v1/inventory/lists", tags=["Inventory"])
async def create_inventory(
    inventory_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cria inventário real no banco de dados"""
    try:
        from app.models.models import InventoryList, InventoryStatus, Store
        from datetime import datetime
        
        # Determinar store_id: se ADMIN pode especificar, senão usa a loja do usuário
        if current_user.role == 'ADMIN' and inventory_data.get("store_id"):
            # ADMIN pode especificar qualquer loja
            store_id = inventory_data["store_id"]
            print(f"🏪 ADMIN especificou loja: {store_id}")
        else:
            # Usuários normais usam sua loja
            store_id = current_user.store_id
            print(f"👤 Usando loja do usuário: {store_id}")
        
        # Buscar loja especificada/do usuário
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise HTTPException(status_code=400, detail="Loja não encontrada ou inválida")
        
        # Processar data de referência
        reference_date = None
        if inventory_data.get("reference_date"):
            try:
                reference_date = datetime.fromisoformat(inventory_data["reference_date"])
            except:
                reference_date = datetime.now()
        else:
            reference_date = datetime.now()
        
        # Processar prazo de contagem
        count_deadline = None
        if inventory_data.get("count_deadline"):
            try:
                count_deadline = datetime.fromisoformat(inventory_data["count_deadline"])
            except:
                pass

        # ✅ VALIDAÇÃO: Verificar se já existe inventário com o mesmo nome na mesma loja
        inventory_name = inventory_data.get("name", "Novo Inventário").strip()
        existing_inventory = db.query(InventoryList).filter(
            InventoryList.name == inventory_name,
            InventoryList.store_id == store_id
        ).first()

        if existing_inventory:
            raise HTTPException(
                status_code=400,
                detail=f"Já existe um inventário com o nome '{inventory_name}' nesta loja. Por favor, escolha outro nome."
            )

        # Criar inventário no banco
        new_inventory = InventoryList(
            name=inventory_data.get("name", "Novo Inventário"),
            description=inventory_data.get("description", ""),
            reference_date=reference_date,
            count_deadline=count_deadline,
            warehouse=inventory_data.get("warehouse", "01"),  # Armazém do inventário (B2_LOCAL)
            status=InventoryStatus.DRAFT,  # ✅ STATUS DO INVENTÁRIO: DRAFT (Em Preparação)
            list_status="ABERTA",  # ✅ STATUS DA LISTA: ABERTA (Pronta para contagem)
            store_id=store_id,
            created_by=current_user.id
        )
        
        db.add(new_inventory)
        db.commit()
        db.refresh(new_inventory)
        
        logger.info(f"✅ Inventário criado com sucesso: {new_inventory.id} por {current_user.username}")

        # 🚀 CRIAR LISTAS DE CONTAGEM AUTOMÁTICAS SEMPRE
        # DESABILITADO: Criação automática de listas vazias - usuário deve criar manualmente
        # try:
        #     await create_default_counting_lists(db, new_inventory.id, current_user.id, store_id)
        #     logger.info(f"✅ Listas automáticas criadas para inventário {new_inventory.id}")
        # except Exception as e:
        #     logger.error(f"⚠️ Erro ao criar listas automáticas (não crítico): {e}")
            # Não falha a criação do inventário se houver erro nas listas

        return {
            "id": str(new_inventory.id),
            "name": new_inventory.name,
            "description": new_inventory.description,
            "reference_date": new_inventory.reference_date.isoformat() if new_inventory.reference_date else None,
            "count_deadline": new_inventory.count_deadline.isoformat() if new_inventory.count_deadline else None,
            "status": new_inventory.status.value,  # ✅ STATUS DO INVENTÁRIO: DRAFT (Em Preparação)
            "list_status": new_inventory.list_status,  # ✅ STATUS DA LISTA: ABERTA (Pronta para contagem)
            "current_cycle": new_inventory.current_cycle or 1,  # ✅ CICLO ATUAL
            "created_at": new_inventory.created_at.isoformat(),
            "updated_at": new_inventory.updated_at.isoformat() if new_inventory.updated_at else new_inventory.created_at.isoformat(),
            "created_by_name": current_user.full_name or current_user.username,
            "store_name": store.name,
            "total_items": 0,
            "counted_items": 0,
            "progress_percentage": 0.0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao criar inventário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao criar inventário"))

@app.get("/api/v1/inventory/lists/{inventory_id}/state", tags=["Inventory"])
async def get_inventory_state(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    🎯 ENDPOINT CENTRAL PARA ESTADO DO INVENTÁRIO
    
    Este endpoint usa a máquina de estados centralizada para:
    1. Determinar o estado atual da lista
    2. Identificar ações disponíveis
    3. Fornecer dados consistentes para o frontend
    4. Garantir fonte única de verdade
    """
    try:
        from app.core.inventory_state_machine import InventoryStateMachine
        from datetime import datetime
        
        # Criar instância da máquina de estados
        state_machine = InventoryStateMachine(db)
        
        # Obter estado atual e contexto
        current_state, context = state_machine.get_current_state(inventory_id)
        
        # Converter para dados de UI
        ui_state = state_machine.get_ui_state(current_state, context)
        
        # Obter ações disponíveis
        available_actions = state_machine.get_available_actions(current_state)
        
        return {
            "success": True,
            "data": {
                "inventory_id": inventory_id,
                "current_state": current_state.value,
                "ui_state": ui_state,
                "available_actions": [action.value for action in available_actions],
                "context": context,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=safe_error_response(e, ""))
    except Exception as e:
        logger.error(f"❌ Erro ao obter estado do inventário {inventory_id}: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno"))

@app.get("/api/v1/inventory/lists/{inventory_id}", tags=["Inventory"])
async def get_inventory(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtém inventário específico do banco de dados"""
    try:
        from app.models.models import InventoryList, Store
        import uuid
        
        # Converter string para UUID
        try:
            inventory_uuid = uuid.UUID(inventory_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de inventário inválido")
        
        # Buscar inventário
        if current_user.role == 'ADMIN':
            # ADMIN pode acessar inventários de qualquer loja
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_uuid
            ).first()
        else:
            # Outros usuários só podem acessar inventários da sua loja
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_uuid,
                InventoryList.store_id == current_user.store_id
            ).first()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Buscar dados relacionados
        store = db.query(Store).filter(Store.id == inventory.store_id).first()
        creator = db.query(User).filter(User.id == inventory.created_by).first()
        
        # Calcular estatísticas reais do inventário
        from app.models.models import InventoryItem
        
        total_items = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory.id
        ).count()
        
        counted_items = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory.id,
            InventoryItem.status == "COUNTED"
        ).count()
        
        progress_percentage = (counted_items / total_items * 100) if total_items > 0 else 0
        
        logger.info(f"✅ Inventário {inventory_id} consultado por {current_user.username} - {counted_items}/{total_items} itens contados ({progress_percentage:.1f}%)")
        
        return {
            "id": str(inventory.id),
            "name": inventory.name,
            "description": inventory.description or "",
            "warehouse": inventory.warehouse,  # CAMPO CRÍTICO PARA MULTI-ARMAZÉM
            "reference_date": inventory.reference_date.isoformat() if inventory.reference_date else None,
            "count_deadline": inventory.count_deadline.isoformat() if inventory.count_deadline else None,
            "status": inventory.status.value,
            "list_status": inventory.list_status if hasattr(inventory, 'list_status') and inventory.list_status else "ABERTA",  # ✅ CORREÇÃO: Adicionar list_status
            "current_cycle": inventory.current_cycle if hasattr(inventory, 'current_cycle') and inventory.current_cycle else 1,  # ✅ CORREÇÃO: Adicionar current_cycle
            "created_at": inventory.created_at.isoformat(),
            "updated_at": inventory.updated_at.isoformat() if inventory.updated_at else inventory.created_at.isoformat(),
            "created_by_name": creator.full_name if creator else "Sistema",
            "store_name": store.name if store else "Loja",
            "total_items": total_items,
            "counted_items": counted_items,
            "progress_percentage": round(progress_percentage, 1)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar inventário {inventory_id}: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar inventário"))

@app.get("/api/v1/inventory/lists/{inventory_list_id}/pending-zero-expected", tags=["Inventory"])
async def get_pending_zero_expected(
    inventory_list_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Busca produtos com expected_quantity = 0 que ainda não foram confirmados"""
    try:
        from app.models.models import InventoryItem, SB1010
        from sqlalchemy import func
        
        # Validar UUID
        try:
            inventory_uuid = uuid.UUID(inventory_list_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de inventário inválido")
        
        # Buscar produtos com expected_quantity = 0 que não estão ZERO_CONFIRMED
        # Usar a mesma estrutura do endpoint /items
        pending_items = db.query(InventoryItem, SB1010).outerjoin(
            SB1010,
            func.trim(SB1010.b1_cod) == func.trim(InventoryItem.product_code)
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid,
            InventoryItem.expected_quantity == 0,
            InventoryItem.status != "COUNTED"
        ).all()
        
        result = []
        for item, product in pending_items:
            # Usar descrição real do produto ou fallback
            product_name = product.b1_desc.strip() if product and product.b1_desc else f"Produto {item.product_code.strip()}"
            
            result.append({
                "id": str(item.id),
                "product_code": item.product_code.strip() if item.product_code else "",
                "product_name": product_name,
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0.0,
                "status": item.status
            })
        
        logger.info(f"✅ Verificação de zeros pendentes - {len(result)} produtos encontrados")
        
        return {
            "success": True,
            "message": f"Found {len(result)} pending zero expected products",
            "data": {
                "inventory_id": inventory_list_id,
                "pending_count": len(result),
                "pending_products": result
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar zeros pendentes: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar zeros pendentes"))

@app.put("/api/v1/inventory/lists/{inventory_id}", tags=["Inventory"])
async def update_inventory(
    inventory_id: str,
    inventory_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza inventário - incluindo list_status"""
    from app.models.models import InventoryList
    from datetime import datetime
    
    try:
        # Buscar inventário existente
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # ✅ VALIDAÇÃO: Verificar nome duplicado ao editar
        if "name" in inventory_data:
            new_name = inventory_data["name"].strip()

            # Verificar se já existe outro inventário com o mesmo nome na mesma loja
            existing_inventory = db.query(InventoryList).filter(
                InventoryList.name == new_name,
                InventoryList.store_id == inventory.store_id,
                InventoryList.id != inventory_id  # Excluir o inventário atual
            ).first()

            if existing_inventory:
                raise HTTPException(
                    status_code=400,
                    detail=f"Já existe um inventário com o nome '{new_name}' nesta loja. Por favor, escolha outro nome."
                )

        # Atualizar campos permitidos
        if "name" in inventory_data:
            inventory.name = inventory_data["name"]
        if "description" in inventory_data:
            inventory.description = inventory_data["description"]
        if "warehouse" in inventory_data:
            # ✅ CORREÇÃO v2.15.0: Permitir atualização do warehouse
            inventory.warehouse = inventory_data["warehouse"]
            logger.info(f"✅ Atualizando warehouse de {inventory_id} para {inventory_data['warehouse']}")
        if "list_status" in inventory_data:
            # ✅ CORREÇÃO: Permitir atualização do list_status
            inventory.list_status = inventory_data["list_status"]
            logger.info(f"✅ Atualizando list_status de {inventory_id} para {inventory_data['list_status']}")
        if "status" in inventory_data:
            new_status = inventory_data["status"]
            # ✅ v2.19.55 - Validação: Não permitir COMPLETED/CLOSED sem contagens
            if new_status in ('COMPLETED', 'CLOSED'):
                from app.models.models import InventoryItem
                total_items = db.query(InventoryItem).filter(
                    InventoryItem.inventory_list_id == inventory.id
                ).count()
                counted_items = db.query(InventoryItem).filter(
                    InventoryItem.inventory_list_id == inventory.id,
                    InventoryItem.count_cycle_1.isnot(None)
                ).count()
                if total_items > 0 and counted_items == 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Nao e possivel finalizar/encerrar o inventario sem nenhuma contagem realizada. "
                               f"Total de itens: {total_items}, Contados: 0."
                    )
            inventory.status = new_status
        if "reference_date" in inventory_data:
            inventory.reference_date = datetime.fromisoformat(inventory_data["reference_date"])
        if "count_deadline" in inventory_data:
            inventory.count_deadline = datetime.fromisoformat(inventory_data["count_deadline"])

        inventory.updated_at = datetime.now()
        
        db.commit()
        db.refresh(inventory)
        
        # Retornar dados atualizados
        return {
            "id": str(inventory.id),
            "name": inventory.name,
            "description": inventory.description or "",
            "reference_date": inventory.reference_date.isoformat() if inventory.reference_date else None,
            "count_deadline": inventory.count_deadline.isoformat() if inventory.count_deadline else None,
            "status": inventory.status.value if hasattr(inventory.status, 'value') else inventory.status,
            "list_status": inventory.list_status,
            "current_cycle": inventory.current_cycle or 1,
            "created_at": inventory.created_at.isoformat() if inventory.created_at else None,
            "updated_at": inventory.updated_at.isoformat() if inventory.updated_at else None,
            "created_by_name": current_user.full_name or current_user.username,
            "store_name": "Loja Matriz",  # TODO: buscar nome real da loja
            "total_items": 0,  # TODO: calcular itens reais
            "counted_items": 0,  # TODO: calcular itens contados
            "progress_percentage": 0.0  # TODO: calcular progresso real
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao atualizar inventário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao atualizar inventário"))

@app.delete("/api/v1/inventory/lists/{inventory_id}", tags=["Inventory"])
async def delete_inventory_temp(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Excluir inventário e todas as dependências.
    - Apenas ADMIN ou SUPERVISOR
    - Apenas inventários em DRAFT (Em Preparação)
    - Exclui listas de contagem vinculadas
    """
    from app.models.models import (
        InventoryList as InventoryListModel, InventoryItem as InventoryItemModel,
        InventoryStatus, CountingList, CountingListItem
    )

    # Verificar permissão (ADMIN ou SUPERVISOR)
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN ou SUPERVISOR podem excluir inventários"
        )

    # Buscar inventário
    inventory = db.query(InventoryListModel).filter(
        InventoryListModel.id == inventory_id
    ).first()

    if not inventory:
        raise HTTPException(status_code=404, detail="Inventário não encontrado")

    # Validar se pode ser excluído (apenas DRAFT)
    if inventory.status not in [InventoryStatus.DRAFT, "DRAFT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Apenas inventários em preparação (DRAFT) podem ser excluídos. Status atual: '{inventory.status}'"
        )

    try:
        # Excluir listas de contagem vinculadas (CASCADE deleta CountingListItems)
        counting_lists = db.query(CountingList).filter(
            CountingList.inventory_id == inventory_id
        ).all()
        lists_deleted = len(counting_lists)
        for cl in counting_lists:
            db.delete(cl)

        # Excluir itens do inventário (CASCADE deleta snapshots, countings, discrepancies)
        items_deleted = db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).delete(synchronize_session=False)

        # Excluir o inventário
        db.delete(inventory)
        db.commit()

        logger.info(f"✅ Inventário '{inventory.name}' excluído por {current_user.username}: {items_deleted} itens, {lists_deleted} listas")

        return {
            "success": True,
            "message": f"Inventário '{inventory.name}' excluído com sucesso",
            "data": {
                "inventory_id": str(inventory_id),
                "items_deleted": items_deleted,
                "lists_deleted": lists_deleted
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao excluir inventário"))

@app.get("/api/v1/inventory/stats", tags=["Inventory"])
async def get_inventory_stats(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Estatísticas de inventário com dados reais"""
    try:
        from app.models.models import InventoryList, InventoryItem, Counting
        from sqlalchemy import func, and_
        
        # Definir filtro baseado no papel do usuário
        if current_user.role == 'ADMIN':
            # Admin vê todos os inventários
            inventory_filter = True
        else:
            # Outros papéis veem apenas da sua loja
            inventory_filter = InventoryList.store_id == current_user.store_id
            
        # Contar inventários por status
        total_inventories = db.query(func.count(InventoryList.id)).filter(inventory_filter).scalar() or 0
        
        completed_inventories = db.query(func.count(InventoryList.id)).filter(
            and_(inventory_filter, InventoryList.status == 'COMPLETED')
        ).scalar() or 0
        
        active_inventories = db.query(func.count(InventoryList.id)).filter(
            and_(inventory_filter, InventoryList.status.in_(['DRAFT', 'IN_PROGRESS']))
        ).scalar() or 0
        
        # Contar itens totais e contados
        total_items_query = db.query(func.count(InventoryItem.id)).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).filter(inventory_filter)
        total_items = total_items_query.scalar() or 0
        
        # Itens já contados (com pelo menos uma contagem)
        counted_items = db.query(func.count(func.distinct(InventoryItem.id))).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).join(
            Counting, InventoryItem.id == Counting.inventory_item_id
        ).filter(inventory_filter).scalar() or 0
        
        pending_items = total_items - counted_items
        
        # Calcular progresso médio
        if total_items > 0:
            average_progress = round((counted_items / total_items) * 100, 1)
        else:
            average_progress = 0
            
        logger.info(f"\ud83d\udcca Stats calculadas: Total={total_inventories}, Ativos={active_inventories}, Encerrados={completed_inventories}")
        
        return {
            "total_inventories": total_inventories,
            "active_inventories": active_inventories,
            "completed_inventories": completed_inventories,
            "total_items_counted": counted_items,
            "pending_items": pending_items,
            "discrepancies": 0,  # Funcionalidade futura
            "average_progress": average_progress
        }
        
    except Exception as e:
        logger.error(f"\u274c Erro ao calcular estatísticas: {str(e)}")
        return {
            "total_inventories": 0,
            "active_inventories": 0,
            "completed_inventories": 0,
            "total_items_counted": 0,
            "pending_items": 0,
            "discrepancies": 0,
            "average_progress": 0
        }

# =================================
# ENDPOINT DASHBOARD v2.19.20
# =================================

@app.get("/api/v1/dashboard/stats", tags=["Dashboard"])
async def get_dashboard_stats(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Estatisticas completas para o Dashboard - v2.19.20"""
    try:
        from app.models.models import InventoryList, InventoryItem, Counting, Product
        from sqlalchemy import func, and_, cast, Date
        from datetime import datetime, timedelta

        today = datetime.now().date()
        yesterday = today - timedelta(days=1)

        # Filtro baseado no papel do usuario
        if current_user.role == 'ADMIN':
            inventory_filter = True
            product_filter = True
        else:
            inventory_filter = InventoryList.store_id == current_user.store_id
            product_filter = Product.store_id == current_user.store_id

        # === PRODUTOS ===
        total_products = db.query(func.count(Product.id)).filter(product_filter).scalar() or 0

        # === INVENTARIOS ===
        total_inventories = db.query(func.count(InventoryList.id)).filter(inventory_filter).scalar() or 0

        completed_inventories = db.query(func.count(InventoryList.id)).filter(
            and_(inventory_filter, InventoryList.status.in_(['COMPLETED', 'ENCERRADA']))
        ).scalar() or 0

        active_inventories = db.query(func.count(InventoryList.id)).filter(
            and_(inventory_filter, InventoryList.status.in_(['DRAFT', 'IN_PROGRESS', 'EM_CONTAGEM', 'ABERTA']))
        ).scalar() or 0

        in_progress = db.query(func.count(InventoryList.id)).filter(
            and_(inventory_filter, InventoryList.status == 'EM_CONTAGEM')
        ).scalar() or 0

        # === ITENS ===
        total_items = db.query(func.count(InventoryItem.id)).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).filter(inventory_filter).scalar() or 0

        counted_items = db.query(func.count(func.distinct(InventoryItem.id))).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).join(
            Counting, InventoryItem.id == Counting.inventory_item_id
        ).filter(inventory_filter).scalar() or 0

        # === CONTAGENS HOJE ===
        countings_today = db.query(func.count(Counting.id)).join(
            InventoryItem, Counting.inventory_item_id == InventoryItem.id
        ).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).filter(
            and_(inventory_filter, cast(Counting.counted_at, Date) == today)
        ).scalar() or 0

        countings_yesterday = db.query(func.count(Counting.id)).join(
            InventoryItem, Counting.inventory_item_id == InventoryItem.id
        ).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).filter(
            and_(inventory_filter, cast(Counting.counted_at, Date) == yesterday)
        ).scalar() or 0

        # === DIVERGENCIAS ===
        divergences = db.query(func.count(InventoryItem.id)).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).filter(
            and_(
                inventory_filter,
                InventoryList.status.in_(['EM_CONTAGEM', 'IN_PROGRESS']),
                InventoryItem.count_cycle_1 != None,
                InventoryItem.count_cycle_1 != InventoryItem.expected_quantity
            )
        ).scalar() or 0

        # === HISTORICO 7 DIAS ===
        history = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            count = db.query(func.count(Counting.id)).join(
                InventoryItem, Counting.inventory_item_id == InventoryItem.id
            ).join(
                InventoryList, InventoryItem.inventory_list_id == InventoryList.id
            ).filter(
                and_(inventory_filter, cast(Counting.counted_at, Date) == day)
            ).scalar() or 0
            history.append({"date": day.strftime("%d/%m"), "count": count})

        progress = round((counted_items / total_items) * 100, 1) if total_items > 0 else 0

        return {
            "total_products": total_products,
            "total_inventories": total_inventories,
            "active_inventories": active_inventories,
            "in_progress": in_progress,
            "completed_inventories": completed_inventories,
            "counted_items": counted_items,
            "pending_items": total_items - counted_items,
            "countings_today": countings_today,
            "countings_yesterday": countings_yesterday,
            "divergences": divergences,
            "progress": progress,
            "history": history
        }

    except Exception as e:
        logger.error(f"Erro dashboard stats: {str(e)}")
        return {
            "total_products": 0, "total_inventories": 0, "active_inventories": 0,
            "in_progress": 0, "completed_inventories": 0, "counted_items": 0,
            "pending_items": 0, "countings_today": 0, "countings_yesterday": 0,
            "divergences": 0, "progress": 0, "history": []
        }

# =================================
# ENDPOINTS DE LIMPEZA DE DADOS DE TESTE
# =================================

@app.delete("/api/v1/cleanup/test-data", tags=["Cleanup"], dependencies=[Depends(require_test_endpoints)])
async def cleanup_all_test_data(
    confirm_cleanup: bool = False,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Limpa TODOS os dados de teste do sistema (protegido)
    CUIDADO: Esta operação é irreversível!
    """
    if not confirm_cleanup:
        return {
            "message": "Para confirmar a limpeza, envie confirm_cleanup=true",
            "warning": "Esta operação irá remover TODOS os dados de teste do sistema!",
            "affected_tables": [
                "SB1010 (produtos de teste: BATCH*, NEW_PRODUCT*, *TESTE*)",
                "Inventários (todos os registros)",
                "Contagens (todos os registros)",
                "localStorage do frontend"
            ]
        }
    
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem limpar dados de teste"
        )
    
    try:
        from app.models.models import SB1010
        
        # Contar dados antes da limpeza
        test_products = db.query(SB1010).filter(
            (SB1010.b1_cod.like('BATCH%')) |
            (SB1010.b1_cod.like('NEW_%')) |
            (SB1010.b1_desc.ilike('%teste%')) |
            (SB1010.b1_desc.ilike('%test%')) |
            (SB1010.b1_desc.ilike('%demo%'))
        ).count()
        
        # Remover produtos de teste
        deleted_products = db.query(SB1010).filter(
            (SB1010.b1_cod.like('BATCH%')) |
            (SB1010.b1_cod.like('NEW_%')) |
            (SB1010.b1_desc.ilike('%teste%')) |
            (SB1010.b1_desc.ilike('%test%')) |
            (SB1010.b1_desc.ilike('%demo%'))
        ).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "message": "✅ Dados de teste removidos com sucesso!",
            "cleaned_data": {
                "test_products_removed": deleted_products,
                "test_products_found": test_products
            },
            "next_steps": [
                "Limpe o localStorage do navegador (F12 > Application > Local Storage)",
                "Recarregue as páginas do frontend",
                "Agora você pode trabalhar apenas com dados reais"
            ]
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao limpar dados de teste")
        )

@app.get("/api/v1/cleanup/test-data-info", tags=["Cleanup"], dependencies=[Depends(require_test_endpoints)])
async def get_test_data_info(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mostra informações sobre dados de teste no sistema (protegido)"""
    try:
        from app.models.models import SB1010
        
        # Contar produtos de teste
        test_products = db.query(SB1010).filter(
            (SB1010.b1_cod.like('BATCH%')) |
            (SB1010.b1_cod.like('NEW_%')) |
            (SB1010.b1_desc.ilike('%teste%')) |
            (SB1010.b1_desc.ilike('%test%')) |
            (SB1010.b1_desc.ilike('%demo%'))
        ).count()
        
        # Listar alguns produtos de teste
        sample_test_products = db.query(SB1010.b1_cod, SB1010.b1_desc).filter(
            (SB1010.b1_cod.like('BATCH%')) |
            (SB1010.b1_cod.like('NEW_%')) |
            (SB1010.b1_desc.ilike('%teste%')) |
            (SB1010.b1_desc.ilike('%test%')) |
            (SB1010.b1_desc.ilike('%demo%'))
        ).limit(10).all()
        
        total_products = db.query(SB1010).count()
        
        return {
            "total_products": total_products,
            "test_products_count": test_products,
            "percentage_test": round((test_products / total_products * 100), 2) if total_products > 0 else 0,
            "sample_test_products": [
                {"code": p.b1_cod, "description": p.b1_desc}
                for p in sample_test_products
            ],
            "cleanup_endpoint": "DELETE /api/v1/cleanup/test-data?confirm_cleanup=true"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao obter informações")
        )

# =================================
# STARTUP EVENT
# =================================

# =================================
# ENDPOINTS DE CONTAGEM (FASE 2D)
# =================================

class ProductSearchRequest(BaseModel):
    search_term: str  # Código do produto ou código de barras

class CountingRequest(BaseModel):
    inventory_item_id: str
    quantity: float
    lot_number: Optional[str] = None
    serial_number: Optional[str] = None
    observation: Optional[str] = None

@app.post("/api/v1/counting/search-product", tags=["Counting"])
async def search_product_for_counting(
    request: ProductSearchRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Buscar produto por código ou código de barras para contagem"""
    try:
        from app.models.models import SB1010, SLK010, InventoryList, InventoryItem
        
        search_term = request.search_term.strip()
        
        if not search_term:
            raise HTTPException(status_code=400, detail="Termo de busca é obrigatório")
        
        # Buscar produto em SB1010 (código ou código de barras)
        product = None
        search_field = None
        
        # 1. Buscar por B1_CODIGO (código do produto) - usando TRIM
        from sqlalchemy import func
        product = db.query(SB1010).filter(
            func.trim(SB1010.b1_cod) == search_term.strip()
        ).first()
        
        if product:
            search_field = "B1_CODIGO"
        else:
            # 2. Buscar por B1_CODBAR (código de barras na SB1010) - usando TRIM  
            product = db.query(SB1010).filter(
                func.trim(SB1010.b1_codbar) == search_term.strip()
            ).first()
            
            if product:
                search_field = "B1_CODBAR"
            else:
                # 3. Buscar em SLK010 (tabela de códigos de barras)
                slk_record = db.query(SLK010).filter(
                    SLK010.slk_codbar == search_term
                ).first()
                
                if slk_record:
                    # Buscar produto pelo código encontrado na SLK010 - usando TRIM
                    product = db.query(SB1010).filter(
                        func.trim(SB1010.b1_cod) == slk_record.slk_produto.strip()
                    ).first()
                    
                    if product:
                        search_field = "LK_CODBAR"
        
        if not product:
            return {
                "found": False,
                "message": f"Produto não encontrado para '{search_term}'"
            }
        
        # Buscar em quais inventários ativos este produto está
        active_inventories = db.query(InventoryList, InventoryItem).join(
            InventoryItem, InventoryList.id == InventoryItem.inventory_list_id
        ).filter(
            InventoryList.store_id == current_user.store_id,
            InventoryList.status.in_(["DRAFT", "IN_PROGRESS"]),
            InventoryItem.product_code == product.b1_cod
        ).all()
        
        if not active_inventories:
            return {
                "found": True,
                "product": {
                    "code": product.b1_cod,
                    "name": product.b1_desc,
                    "unit": product.b1_um,
                    "has_lot": product.b1_rastro == 'L'
                },
                "search_field": search_field,
                "message": "Produto encontrado, mas não está em nenhum inventário ativo"
            }
        
        # Retornar dados do produto e inventários
        inventory_items = []
        for inventory, item in active_inventories:
            inventory_items.append({
                "inventory_id": str(inventory.id),
                "inventory_name": inventory.name,
                "item_id": str(item.id),
                "sequence": item.sequence,
                "status": item.status.value,
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0,
                "last_counted_at": item.last_counted_at.isoformat() if item.last_counted_at else None,
                "assigned_to_user": item.last_counted_by == current_user.id
            })
        
        # Buscar lotes se produto controla lote
        lots = []
        if product.b1_rastro == 'L':
            from app.models.models import SB8010
            lots_query = db.query(SB8010).filter(
                SB8010.b8_produto == product.b1_cod
            ).all()
            
            lots = [{
                "lot_number": lot.b8_lotectl,
                "b8_lotectl": lot.b8_lotectl,  # ✅ v2.17.1: Lote cliente
                "b8_lotefor": lot.b8_lotefor if lot.b8_lotefor else "",  # ✅ v2.17.1: Lote fornecedor
                "balance": float(lot.b8_saldo) if lot.b8_saldo else 0,
                "expiry_date": lot.b8_dtvalid.isoformat() if lot.b8_dtvalid else None
            } for lot in lots_query]
        
        return {
            "found": True,
            "product": {
                "code": product.b1_cod,
                "name": product.b1_desc,
                "unit": product.b1_um,
                "group": product.b1_grupo,
                "category": product.b1_xcatgor,
                "has_lot": product.b1_rastro == 'L'
            },
            "search_field": search_field,
            "inventory_items": inventory_items,
            "lots": lots if product.b1_rastro == 'L' else []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar produto para contagem: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar produto"))

@app.post("/api/v1/counting/record-count", tags=["Counting"])
async def record_product_count(
    request: CountingRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Registrar contagem de um produto"""
    try:
        from app.models.models import InventoryItem, Counting, SB1010
        import uuid
        from datetime import datetime
        
        # Verificar se o item do inventário existe
        item_uuid = uuid.UUID(request.inventory_item_id)
        inventory_item = db.query(InventoryItem).filter(
            InventoryItem.id == item_uuid
        ).first()
        
        if not inventory_item:
            raise HTTPException(status_code=404, detail="Item do inventário não encontrado")
        
        # Verificar se o inventário foi encerrado por este usuário
        from app.models.models import ClosedCountingRound
        closed_round = db.query(ClosedCountingRound).filter(
            ClosedCountingRound.inventory_list_id == inventory_item.inventory_list_id,
            ClosedCountingRound.user_id == current_user.id
        ).first()
        
        if closed_round:
            raise HTTPException(
                status_code=403, 
                detail="Não é possível registrar contagem. Esta rodada de inventário já foi encerrada."
            )
        
        # Validação de permissões será feita mais adiante baseada em CountingAssignment
        
        # Import dos modelos necessários para compatibilidade
        from app.models.models import InventoryItem as InventoryItemModel, InventoryList as InventoryListModel
        
        # Buscar produto para verificar se controla lote (usando TRIM para remover espaços)
        from sqlalchemy import func, and_
        product = db.query(SB1010).filter(
            and_(
                func.trim(SB1010.b1_cod) == inventory_item.product_code.strip(),
                func.coalesce(SB1010.b1_filial, '') == '01'  # Filtrar por filial ou filial vazia = '01'
            )
        ).first()
        
        # Se não encontrar na filial '01', tentar filial vazia (dados migrados)
        if not product:
            product = db.query(SB1010).filter(
                and_(
                    func.trim(SB1010.b1_cod) == inventory_item.product_code.strip(),
                    func.coalesce(SB1010.b1_filial, '') == ''
                )
            ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Produto não encontrado")
        
        # Validar lote se produto controla lote
        if product.b1_rastro == 'L' and not request.lot_number:
            raise HTTPException(status_code=400, detail="Número do lote é obrigatório para este produto")
        
        # SISTEMA DE CONTAGEM MÚLTIPLA COM CONTROLE DE DIVERGÊNCIAS
        # 1ª contagem: Qualquer usuário atribuído
        # 2ª contagem: SUPERVISOR ou ADMIN (quando há divergência)
        # 3ª contagem: Apenas ADMIN (decisão final)
        
        # Determinar qual contagem deve ser feita
        from app.models.models import Discrepancy
        
        # Buscar contagens existentes para este item
        existing_counts = db.query(Counting).filter(
            Counting.inventory_item_id == item_uuid
        ).order_by(Counting.count_number.desc()).all()
        
        last_count_number = existing_counts[0].count_number if existing_counts else 0
        
        # Verificar se há divergências não resolvidas
        has_unresolved_discrepancy = db.query(Discrepancy).filter(
            Discrepancy.inventory_item_id == item_uuid,
            Discrepancy.status == 'PENDING'
        ).first() is not None
        
        # ====================================================================
        # SISTEMA DE LISTA DE CONTAGEM - REGRA DE NEGÓCIO CORRETA
        # APENAS USUÁRIOS COM ATRIBUIÇÃO ESPECÍFICA PODEM CONTAR
        # ====================================================================
        
        from app.models.models import CountingAssignment
        
        user_assignment = db.query(CountingAssignment).filter(
            CountingAssignment.inventory_item_id == item_uuid,
            CountingAssignment.assigned_to == current_user.id,
            CountingAssignment.status.in_(['PENDING', 'IN_PROGRESS', 'COMPLETED'])
        ).first()
        
        if user_assignment:
            # ✅ CASO 1: Usuário tem atribuição específica (CountingAssignment)
            # CORREÇÃO CRÍTICA: Usar ciclo atual do inventário, não count_number da atribuição
            inventory_list = db.query(InventoryListModel).filter(
                InventoryListModel.id == inventory_item.inventory_list_id
            ).first()
            current_cycle = getattr(inventory_list, 'cycle_number', 1) if inventory_list else 1
            expected_count_number = current_cycle
            print(f"✅ LISTA DE CONTAGEM: Usuário {current_user.username} pode contar item {item_uuid} na {expected_count_number}ª rodada (CICLO ATUAL: {current_cycle})")
        else:
            # 🔄 CASO 2: Verificar se usuário tem lista liberada (compatibilidade com sistema existente)
            # Buscar se o usuário tem produtos atribuídos via endpoint existing-assignments
            from sqlalchemy import and_, or_
            
            # Verificar se existe uma relação entre o usuário e o inventário
            inventory_check = db.query(InventoryItemModel).filter(
                InventoryItemModel.inventory_list_id == inventory_item.inventory_list_id,
                InventoryItemModel.id == item_uuid
            ).first()
            
            # Para compatibilidade: Se o inventário está EM_CONTAGEM e o usuário é SUPERVISOR/ADMIN
            # Permitir contagem (sistema legado)
            inventory_list = db.query(InventoryListModel).filter(
                InventoryListModel.id == inventory_item.inventory_list_id
            ).first()
            
            if (inventory_list and 
                getattr(inventory_list, 'list_status', '') == 'EM_CONTAGEM' and 
                current_user.role in ['ADMIN', 'SUPERVISOR'] and
                inventory_check):
                # CORREÇÃO: Usar ciclo atual do inventário
                current_cycle = getattr(inventory_list, 'cycle_number', 1)
                expected_count_number = current_cycle
                print(f"🔄 COMPATIBILIDADE: Usuário {current_user.username} ({current_user.role}) pode contar item {item_uuid} - CICLO ATUAL: {current_cycle}")
            else:
                # ❌ SEM PERMISSÃO
                print(f"❌ ACESSO NEGADO: Usuário {current_user.username} ({current_user.role}) tentou contar item {item_uuid} SEM atribuição")
                raise HTTPException(
                    status_code=403, 
                    detail="Produto não atribuído para contagem. No sistema LISTA DE CONTAGEM, apenas usuários com atribuição específica podem contar."
                )
        
        # Validação básica de permissão
        if current_user.role not in ['ADMIN', 'SUPERVISOR']:
            # Para operadores, verificar se tem acesso a este inventário
            from app.models.models import InventoryList
            inventory = db.query(InventoryList).filter(
                InventoryList.id == inventory_item.inventory_list_id
            ).first()
            
            if not inventory or inventory.store_id != current_user.store_id:
                raise HTTPException(status_code=403, detail="Você não possui permissão para contar itens deste inventário")
        
        # Verificar se usuário já fez contagem nesta rodada específica
        existing_user_count = db.query(Counting).filter(
            Counting.inventory_item_id == item_uuid,
            Counting.counted_by == current_user.id,
            Counting.count_number == expected_count_number
        ).first()
        
        count_number = expected_count_number
        
        if existing_user_count:
            # ATUALIZAR contagem existente em vez de criar nova
            from sqlalchemy import func
            existing_user_count.quantity = request.quantity
            existing_user_count.lot_number = request.lot_number
            existing_user_count.observation = request.observation
            existing_user_count.updated_at = func.now()
            counting = existing_user_count
        else:
            # Criar novo registro de contagem
            counting = Counting(
                inventory_item_id=item_uuid,
                quantity=request.quantity,
                lot_number=request.lot_number,
                serial_number=request.serial_number,
                observation=request.observation,
                counted_by=current_user.id,
                count_number=count_number
            )
            
            db.add(counting)
        
        # 🎯 SISTEMA DE 3 CICLOS - Conforme planejamento CSV do usuário
        expected_qty = float(inventory_item.expected_quantity or 0)
        counted_qty = float(request.quantity)
        
        # Buscar contagens anteriores para este item
        existing_counts = db.query(Counting).filter(
            Counting.inventory_item_id == inventory_item.id
        ).order_by(Counting.count_number).all()
        
        current_count_number = len(existing_counts) + 1
        
        # Aplicar lógica de status conforme CSV do usuário
        if current_count_number == 1:
            # PRIMEIRA CONTAGEM
            if counted_qty == 0 and expected_qty == 0:
                inventory_item.status = "COUNTED"
            elif abs(counted_qty - expected_qty) <= 0.01:
                inventory_item.status = "COUNTED"  # Quantidade bate com esperado
            else:
                inventory_item.status = "PENDING"  # ✅ CORREÇÃO: Divergência no 1º ciclo = PENDING (aguarda 2º ciclo)
                
        elif current_count_number == 2:
            # SEGUNDA CONTAGEM
            first_count = existing_counts[0].quantity
            if counted_qty == 0 and expected_qty == 0:
                inventory_item.status = "COUNTED"
            elif abs(counted_qty - expected_qty) <= 0.01:
                inventory_item.status = "COUNTED"  # Bate com esperado
            elif abs(float(first_count) - counted_qty) <= 0.01:
                # ✅ CORREÇÃO CRÍTICA: Consenso existe, mas verificar se bate com esperado
                if abs(counted_qty - expected_qty) <= 0.01:
                    inventory_item.status = "COUNTED"  # Consenso = Esperado → CONTADO
                else:
                    inventory_item.status = "PENDING"  # Consenso ≠ Esperado → DIVERGÊNCIA (manter PENDING para frontend processar)
            else:
                inventory_item.status = "PENDING"  # Ainda há divergência entre ciclos
                
        elif current_count_number == 3:
            # TERCEIRA CONTAGEM (FINAL)
            first_count = existing_counts[0].quantity
            second_count = existing_counts[1].quantity if len(existing_counts) > 1 else None
            
            if counted_qty == 0 and expected_qty == 0:
                inventory_item.status = "COUNTED"
            elif abs(counted_qty - expected_qty) <= 0.01:
                inventory_item.status = "COUNTED"  # Bate com esperado
            elif second_count and abs(float(second_count) - counted_qty) <= 0.01:
                # ✅ CORREÇÃO: Consenso 2ª=3ª, mas verificar se bate com esperado
                if abs(counted_qty - expected_qty) <= 0.01:
                    inventory_item.status = "COUNTED"  # Consenso = Esperado → CONTADO
                else:
                    inventory_item.status = "PENDING"  # Consenso ≠ Esperado → DIVERGÊNCIA
            elif abs(float(first_count) - counted_qty) <= 0.01:
                # ✅ CORREÇÃO: Consenso 1ª=3ª, mas verificar se bate com esperado
                if abs(counted_qty - expected_qty) <= 0.01:
                    inventory_item.status = "COUNTED"  # Consenso = Esperado → CONTADO
                else:
                    inventory_item.status = "PENDING"  # Consenso ≠ Esperado → DIVERGÊNCIA
            else:
                inventory_item.status = "PENDING"  # ✅ CORREÇÃO: Divergência final = PENDING (para frontend processar)
            
        inventory_item.last_counted_at = datetime.utcnow()
        inventory_item.last_counted_by = current_user.id
        
        # ✅ CORREÇÃO CRÍTICA: Atualizar campos count_cycle_X na tabela inventory_items
        # USAR count_number (ciclo atual) em vez de current_count_number (contagem das existentes)
        if count_number == 1:
            inventory_item.count_cycle_1 = counted_qty
        elif count_number == 2:
            inventory_item.count_cycle_2 = counted_qty
        elif count_number == 3:
            inventory_item.count_cycle_3 = counted_qty
        
        db.commit()
        
        logger.info(f"✅ Contagem #{count_number} registrada: Item {request.inventory_item_id}, Status: {inventory_item.status}, Qtd: {request.quantity}")
        
        return {
            "success": True,
            "counting_id": str(counting.id),
            "count_number": count_number,
            "message": f"Contagem #{count_number} registrada com sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao registrar contagem: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao registrar contagem"))

@app.post("/api/v1/inventory/lists/{inventory_list_id}/release-for-recount")
async def release_items_for_recount(
    inventory_list_id: str,
    db: Session = Depends(get_db)
):
    """Libera itens para próximo ciclo - atualiza status para EM_CONTAGEM"""
    try:
        from app.models.models import InventoryList
        from sqlalchemy import text
        
        # Buscar o inventário
        inventory_list = db.query(InventoryList).filter(
            InventoryList.id == inventory_list_id
        ).first()
        
        if not inventory_list:
            raise HTTPException(status_code=404, detail="Lista de inventário não encontrada")

        # Bloquear inventário efetivado
        check_inventory_not_closed(inventory_list)

        # Atualizar status para EM_CONTAGEM se não estiver já em contagem
        old_status = inventory_list.list_status
        if inventory_list.list_status in ["DRAFT", "ABERTA"]:
            inventory_list.list_status = "EM_CONTAGEM"
            
        # ✅ ATUALIZAR CAMPOS needs_recount_cycle_X baseado em divergências
        current_cycle = inventory_list.current_cycle
        if current_cycle == 1:
            # Após 1º ciclo, verificar divergências para determinar 2º ciclo
            db.execute(
                text("""
                    UPDATE inventario.inventory_items 
                    SET needs_recount_cycle_2 = CASE 
                        WHEN count_cycle_1 IS NOT NULL AND abs(count_cycle_1 - expected_quantity) >= 0.01 THEN true
                        ELSE false
                    END
                    WHERE inventory_list_id = CAST(:inventory_id AS uuid)
                """),
                {"inventory_id": inventory_list_id}
            )
            logger.info(f"✅ Campos needs_recount_cycle_2 atualizados baseado em divergências do 1º ciclo")
            
        elif current_cycle == 2:
            # Após 2º ciclo, verificar se precisa 3º ciclo
            # 🔧 CORREÇÃO v2.19.42: Tratar count_cycle_2 NULL como 0 quando item precisava de recontagem
            db.execute(
                text("""
                    UPDATE inventario.inventory_items
                    SET needs_recount_cycle_3 = CASE
                        -- REGRA ESPECIAL: Produtos com qty esperada = 0
                        WHEN expected_quantity = 0 THEN
                            CASE
                                -- 🔧 v2.19.42: NULL no ciclo 2 = 0 (não encontrado)
                                -- Se precisava recontar e não contou, tratamos como 0
                                -- Se c2(efetivo)=0 == expected=0 → Zero Confirmado, não precisa ciclo 3
                                WHEN count_cycle_2 IS NULL AND needs_recount_cycle_2 = true THEN false
                                -- Se 2ª contagem = 0 = esperado → NÃO precisa de 3ª contagem (Zero Confirmado)
                                WHEN count_cycle_2 = 0 THEN false
                                -- Se 1ª = 2ª (ambas != 0) → NÃO precisa de 3ª contagem (Divergência confirmada)
                                WHEN count_cycle_1 IS NOT NULL AND count_cycle_2 IS NOT NULL
                                     AND abs(count_cycle_1 - count_cycle_2) < 0.01 THEN false
                                -- Se 1ª != 2ª → SIM precisa de 3ª contagem (desempate)
                                WHEN count_cycle_1 IS NOT NULL AND count_cycle_2 IS NOT NULL
                                     AND abs(count_cycle_1 - count_cycle_2) >= 0.01 THEN true
                                ELSE false
                            END
                        -- REGRA GERAL: Produtos com qty esperada != 0
                        -- 🔧 v2.19.42: Usar COALESCE para tratar NULL como 0
                        WHEN count_cycle_1 IS NOT NULL
                             AND (count_cycle_2 IS NOT NULL OR needs_recount_cycle_2 = true)
                             AND abs(count_cycle_1 - COALESCE(count_cycle_2, 0)) >= 0.01
                             AND abs(COALESCE(count_cycle_2, 0) - expected_quantity) >= 0.01 THEN true
                        ELSE false
                    END,
                    -- 🔧 v2.19.42: Também atualizar count_cycle_2 para 0 quando NULL e precisava recontar
                    count_cycle_2 = CASE
                        WHEN count_cycle_2 IS NULL AND needs_recount_cycle_2 = true THEN 0
                        ELSE count_cycle_2
                    END
                    WHERE inventory_list_id = CAST(:inventory_id AS uuid)
                """),
                {"inventory_id": inventory_list_id}
            )
            logger.info(f"✅ Campos needs_recount_cycle_3 atualizados baseado em divergências do 2º ciclo (v2.19.42: NULL=0)")
        
        db.commit()
        logger.info(f"✅ Status atualizado de {old_status} para EM_CONTAGEM - Inventário: {inventory_list_id}")
        
        return {
            "success": True,
            "message": "✅ Inventário liberado para contagem",
            "items_released": 5,
            "current_cycle": inventory_list.current_cycle,
            "list_status": inventory_list.list_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao liberar itens para recontagem: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno do servidor"))

@app.post("/api/v1/inventory/lists/{inventory_list_id}/confirm-zero-expected")
async def confirm_zero_expected_items(
    inventory_list_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Confirma automaticamente produtos com quantidade esperada = 0 que não foram contados.
    
    Esta função identifica produtos que:
    - Têm quantidade esperada = 0
    - Não possuem nenhuma contagem registrada (NULL)
    - Marca como ZERO_CONFIRMED automaticamente
    """
    try:
        from app.models.models import InventoryItem, InventoryList, Counting
        from sqlalchemy import or_, and_
        
        # Verificar se o inventário existe
        inventory_list = db.query(InventoryList).filter(
            InventoryList.id == inventory_list_id
        ).first()
        
        if not inventory_list:
            raise HTTPException(status_code=404, detail="Lista de inventário não encontrada")
        
        # Buscar itens com expected_quantity = 0 que precisam de correção
        # Incluir produtos que:
        # 1. Não estão COUNTED ainda, OU
        # 2. Estão COUNTED mas não têm count_cycle_1 preenchido (dados inconsistentes), OU
        # 3. ✅ CORREÇÃO CONSERVADORA: Expected=0, count_cycle_1>0, mas count_cycle_2 é NULL (casos 00010299, 00010560)
        items_to_confirm = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory_list_id,
            InventoryItem.expected_quantity == 0,
            or_(
                InventoryItem.status != "COUNTED",  # Não contado ainda
                and_(
                    InventoryItem.status == "COUNTED",  # Contado mas...
                    InventoryItem.count_cycle_1.is_(None)  # ...sem count_cycle_1
                ),
                and_(
                    InventoryItem.status == "COUNTED",  # Contado no ciclo 1...
                    InventoryItem.count_cycle_1 > 0,    # ...com quantidade > 0...
                    InventoryItem.count_cycle_2.is_(None),  # ...mas sem count_cycle_2
                    InventoryItem.needs_recount_cycle_2 == True  # ...e precisa recontagem
                )
            )
        ).all()
        
        confirmed_items = []
        for item in items_to_confirm:
            # Para produtos com expected_quantity = 0, SEMPRE corrigir o status
            # independente de ter contagens ou não
            existing_counts = db.query(Counting).filter(
                Counting.inventory_item_id == item.id
            ).count()
            
            # Corrigir status para ZERO_CONFIRMED
            item.status = "COUNTED"
            item.last_counted_by = current_user.id
            item.last_counted_at = datetime.utcnow()
            
            # ✅ CORREÇÃO: Atualizar campo count_1/2/3 baseado no ciclo atual
            current_cycle = inventory_list.current_cycle or 1
            
            # Se não há contagens, criar registro automático E atualizar campo apropriado
            if existing_counts == 0:
                zero_counting = Counting(
                    inventory_item_id=item.id,
                    quantity=0,
                    observation="Auto-confirmado: quantidade esperada = 0, sem contagens",
                    counted_by=current_user.id,
                    count_number=current_cycle
                )
                db.add(zero_counting)
                
                # ✅ ATUALIZAR CAMPO APROPRIADO NA GRID
                if current_cycle == 1:
                    item.count_cycle_1 = 0.0
                elif current_cycle == 2:
                    item.count_cycle_2 = 0.0
                elif current_cycle == 3:
                    item.count_cycle_3 = 0.0
            else:
                # ✅ CORREÇÃO CRÍTICA: Se já tem contagens, mas precisa confirmar zero no ciclo atual
                # Para produtos expected=0 que foram contados >0 no ciclo 1, gravar zero no ciclo atual
                
                # ✅ CORREÇÃO v3.2: Gravar zero APENAS no ciclo atual (não em todos os subsequentes)
                # Botão "Confirmar Zeros" deve atualizar somente o ciclo ativo
                
                if current_cycle == 2 and item.count_cycle_2 is None:
                    item.count_cycle_2 = 0.0
                    # Criar registro na tabela counting para ciclo 2
                    zero_counting_2 = Counting(
                        inventory_item_id=item.id,
                        quantity=0,
                        observation=f"Confirmado ciclo {current_cycle}: quantidade esperada = 0",
                        counted_by=current_user.id,
                        count_number=2
                    )
                    db.add(zero_counting_2)
                
                elif current_cycle == 3 and item.count_cycle_3 is None:
                    item.count_cycle_3 = 0.0
                    # Criar registro na tabela counting para ciclo 3
                    zero_counting_3 = Counting(
                        inventory_item_id=item.id,
                        quantity=0,
                        observation=f"Confirmado ciclo {current_cycle}: quantidade esperada = 0",
                        counted_by=current_user.id,
                        count_number=3
                    )
                    db.add(zero_counting_3)
                
                # Fallback: garantir que o campo count_cycle_1 existe (código original)
                elif item.count_cycle_1 is None:
                    item.count_cycle_1 = 0.0
            
            confirmed_items.append({
                "product_code": item.product_code,
                "expected_quantity": float(item.expected_quantity or 0),
                "previous_status": item.status,
                "had_counts": existing_counts > 0
            })
        
        db.commit()
        
        logger.info(f"✅ Confirmados {len(confirmed_items)} itens com zero esperado no inventário {inventory_list_id}")
        
        return {
            "success": True,
            "message": f"✅ {len(confirmed_items)} produtos com quantidade esperada = 0 foram automaticamente confirmados",
            "confirmed_items": confirmed_items,
            "total_confirmed": len(confirmed_items)
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao confirmar itens com zero esperado: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno do servidor"))

@app.get("/api/v1/counting/my-assignments", tags=["Counting"])
async def get_my_counting_assignments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar itens atribuídos ao usuário atual para contagem"""
    try:
        from app.models.models import InventoryList, InventoryItem, SB1010, CountingAssignment, Counting
        
        # Buscar atribuições ativas do usuário atual
        query = db.query(
            CountingAssignment, 
            InventoryItem, 
            InventoryList, 
            SB1010
        ).join(
            InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
        ).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).join(
            SB1010, InventoryItem.product_code == SB1010.b1_cod
        ).filter(
            CountingAssignment.assigned_to == current_user.id,
            CountingAssignment.status.in_(['PENDING', 'COMPLETED']),  # ✅ Incluir COMPLETED para permitir revisões
            InventoryList.store_id == current_user.store_id,
            InventoryList.status.in_(["DRAFT", "IN_PROGRESS"])
        ).order_by(InventoryList.name, InventoryItem.sequence)
        
        assignments = query.all()
        
        # Agrupar por inventário
        inventories = {}
        for assignment, item, inventory, product in assignments:
            inv_id = str(inventory.id)
            
            if inv_id not in inventories:
                inventories[inv_id] = {
                    "inventory_id": inv_id,
                    "inventory_name": inventory.name,
                    "status": inventory.status.value,
                    "items": []
                }
            
            # Verificar contagens existentes para este item
            existing_counts = db.query(Counting).filter(
                Counting.inventory_item_id == item.id,
                Counting.counted_by == current_user.id
            ).order_by(Counting.count_number).all()
            
            inventories[inv_id]["items"].append({
                "assignment_id": str(assignment.id),
                "item_id": str(item.id),
                "sequence": item.sequence,
                "product_code": product.b1_cod,
                "product_name": product.b1_desc,
                "unit": product.b1_um,
                "has_lot": product.b1_rastro == 'L',
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0,
                "count_number": cycle_number,
                "deadline": assignment.deadline.isoformat() if assignment.deadline else None,
                "existing_counts": [
                    {
                        "count_number": count.count_number,
                        "quantity": float(count.quantity),
                        "lot_number": count.lot_number,
                        "counted_at": count.created_at.isoformat(),
                        "observation": count.observation
                    } for count in existing_counts
                ],
                "status": "COUNTED" if existing_counts else "PENDING"
            })
        
        return {
            "inventories": list(inventories.values()),
            "total_items": sum(len(inv["items"]) for inv in inventories.values()),
            "pending_items": sum(
                len([item for item in inv["items"] if item["status"] == "PENDING"]) 
                for inv in inventories.values()
            )
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar atribuições de contagem: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar atribuições"))

@app.get("/api/v1/counting/item/{item_id}/history", tags=["Counting"])
async def get_counting_history(
    item_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Buscar histórico de contagens de um item"""
    try:
        from app.models.models import InventoryItem, Counting
        import uuid
        
        item_uuid = uuid.UUID(item_id)
        
        # Verificar se item existe
        inventory_item = db.query(InventoryItem).filter(
            InventoryItem.id == item_uuid
        ).first()
        
        if not inventory_item:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        
        # Buscar histórico de contagens
        countings = db.query(Counting, User).join(
            User, Counting.counted_by == User.id
        ).filter(
            Counting.inventory_item_id == item_uuid
        ).order_by(Counting.count_number.desc()).all()
        
        history = []
        for counting, user in countings:
            history.append({
                "counting_id": str(counting.id),
                "count_number": counting.count_number,
                "quantity": float(counting.quantity),
                "lot_number": counting.lot_number,
                "serial_number": counting.serial_number,
                "observation": counting.observation,
                "counted_by": user.full_name,
                "counted_at": counting.created_at.isoformat()
            })
        
        return {
            "item_id": item_id,
            "product_code": inventory_item.product_code,
            "counting_history": history,
            "total_counts": len(history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar histórico de contagem: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar histórico"))

@app.get("/api/v1/counting/inventory/{inventory_id}/search-product", tags=["Counting"])
async def search_product_in_inventory(
    inventory_id: str,
    search_term: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Buscar produto específico dentro de um inventário para contagem"""
    try:
        from app.models.models import InventoryList, InventoryItem, SB1010
        import uuid
        
        # Validar UUID do inventário
        inventory_uuid = uuid.UUID(inventory_id)
        
        # Verificar se inventário existe e usuário tem acesso
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid,
            InventoryList.store_id == current_user.store_id
        ).first()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Buscar produto no inventário
        search_term = search_term.strip()
        
        # Buscar item do inventário que corresponde ao termo de busca
        query = db.query(InventoryItem, SB1010).join(
            SB1010, InventoryItem.product_code == SB1010.b1_cod
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        )
        
        # Buscar por código ou código de barras
        from sqlalchemy import or_
        query = query.filter(
            or_(
                SB1010.b1_cod.like(f"%{search_term}%"),
                SB1010.b1_codbar.like(f"%{search_term}%")
            )
        )
        
        result = query.first()
        
        if not result:
            return {
                "success": False,
                "message": "Produto não encontrado neste inventário"
            }
        
        inventory_item, product = result
        
        # Buscar contagens existentes
        from app.models.models import Counting
        existing_counts = db.query(Counting).filter(
            Counting.inventory_item_id == inventory_item.id
        ).order_by(Counting.count_number).all()
        
        # Buscar quantidade esperada real do Protheus
        from app.services.inventory_service import InventoryService
        filial = current_user.store.code if current_user.store else '01'
        # Sistema MULTI-ARMAZÉM - usar EXATAMENTE o armazém do inventário
        if not inventory.warehouse:
            raise HTTPException(status_code=400, detail="Inventário sem armazém definido")
        warehouse_location = inventory.warehouse  # NUNCA usar B1_LOCPAD
        has_lot = product.b1_rastro == 'L'
        
        logger.info(f"Buscando quantidade: filial={filial}, produto={product.b1_cod.strip()}, local={warehouse_location}, has_lot={has_lot}")
        
        quantity_info = InventoryService.get_expected_quantity(
            db, filial, product.b1_cod.strip(), warehouse_location, has_lot
        )
        
        logger.info(f"Quantidade encontrada: {quantity_info}")
        
        return {
            "success": True,
            "data": {
                "inventory_item_id": str(inventory_item.id),
                "product_code": product.b1_cod.strip(),
                "barcode": product.b1_codbar.strip() if product.b1_codbar else None,
                "name": product.b1_desc.strip(),
                "unit": product.b1_um.strip(),
                "has_lot": has_lot,
                "expected_quantity": quantity_info['expected_quantity'],
                "warehouse_location": warehouse_location,
                "existing_counts": [
                    {
                        "count_number": count.count_number,
                        "quantity": float(count.quantity),
                        "lot_number": count.lot_number,
                        "counted_at": count.created_at.isoformat(),
                        "observation": count.observation
                    } for count in existing_counts
                ]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar produto no inventário: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar produto"))

class SimpleCountRequest(BaseModel):
    quantity: float
    lot_number: Optional[str] = None
    observation: Optional[str] = None
    location: Optional[str] = None
    lot_counts: Optional[List[LotCount]] = None

@app.post("/api/v1/inventory/items/{item_id}/count", tags=["Counting"])
async def register_count_simple(
    item_id: str,
    count_data: SimpleCountRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Registrar contagem — endpoint simplificado (item_id na URL)"""
    try:
        import uuid
        from app.models.models import InventoryItem
        item_uuid = uuid.UUID(item_id)
        item = db.query(InventoryItem).filter(InventoryItem.id == item_uuid).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        # Delegar ao endpoint principal, montando o RegisterCountRequest
        full_request = RegisterCountRequest(
            inventory_item_id=item_id,
            quantity=count_data.quantity,
            lot_number=count_data.lot_number,
            observation=count_data.observation,
            location=count_data.location,
            lot_counts=count_data.lot_counts,
        )
        return await register_count(
            inventory_id=str(item.inventory_list_id),
            count_data=full_request,
            current_user=current_user,
            db=db,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao registrar contagem (simple): {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao registrar contagem"))

@app.post("/api/v1/counting/inventory/{inventory_id}/register-count", tags=["Counting"])
async def register_count(
    inventory_id: str,
    count_data: RegisterCountRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Registrar uma contagem de produto"""
    try:
        from app.models.models import InventoryItem, InventoryList, Counting, CountingAssignment
        import uuid
        
        # Validar UUIDs
        inventory_uuid = uuid.UUID(inventory_id)
        item_uuid = uuid.UUID(count_data.inventory_item_id)
        
        # Verificar se inventário existe e está ativo
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid
        ).first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # Bloquear inventário efetivado
        check_inventory_not_closed(inventory)

        # ✅ CORREÇÃO MULTI-LISTAS: Verificar status da COUNTING_LIST, não inventory_list
        from app.models.models import CountingAssignment as CountingAssignmentModel, CountingList

        # 🎯 BUSCAR STATUS REAL da counting_list específica que contém este item
        from app.models.models import CountingListItem
        counting_list = db.query(CountingList).join(
            CountingListItem, CountingList.id == CountingListItem.counting_list_id
        ).filter(
            CountingList.inventory_id == inventory_uuid,
            CountingListItem.inventory_item_id == item_uuid
        ).first()

        if counting_list:
            list_status = counting_list.list_status
            cycle_number = counting_list.current_cycle
            logger.info(f"🔍 Status da counting_list encontrado: {list_status}, Ciclo: {cycle_number}")
        else:
            # Fallback para o modelo antigo
            list_status = getattr(inventory, 'list_status', 'ABERTA')
            cycle_number = getattr(inventory, 'current_cycle', 1)
            logger.warning(f"⚠️ Counting_list não encontrada, usando status do inventário: {list_status}, Ciclo: {cycle_number}")

        # VALIDAÇÃO 1: Status inteligente - aceita tanto sistema novo quanto antigo
        valid_statuses = ['EM_CONTAGEM', 'RELEASED', 'IN_PROGRESS']

        # 🎯 CORREÇÃO GENÉRICA: Se encontrou counting_list, use lógica multi-lista
        if counting_list:
            # Sistema novo (multi-listas) - aceita EM_CONTAGEM
            if list_status not in valid_statuses:
                logger.warning(f"⚠️ Lista multi-lista não liberada: {inventory_id}, Status: {list_status}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Lista de contagem não foi liberada (Status: {list_status}). Solicite ao supervisor para liberar a lista."
                )
        else:
            # Sistema antigo (lista única) - aceita também ABERTA se for única
            valid_statuses.append('ABERTA')  # Compatibilidade com sistema antigo
            if list_status not in valid_statuses:
                logger.warning(f"⚠️ Lista única não liberada: {inventory_id}, Status: {list_status}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Lista de inventário não foi liberada para contagem (Status: {list_status}). Solicite ao supervisor para liberar a lista."
                )
        
        # VALIDAÇÃO 2: Lista ENCERRADA ou 3º ciclo encerrado não permite mais contagens
        if list_status == 'ENCERRADA' or (cycle_number >= 3 and list_status in ['FINALIZADA', 'ENCERRADA']):
            logger.warning(f"🚫 Tentativa de contagem em lista encerrada: {inventory_id}, Status: {list_status}, Ciclo: {cycle_number}")
            raise HTTPException(
                status_code=400, 
                detail=f"Lista de inventário encerrada (Status: {list_status}, Ciclo: {cycle_number}). Não é possível realizar mais contagens."
            )
        
        # Verificar se item existe no inventário
        inventory_item = db.query(InventoryItem).filter(
            InventoryItem.id == item_uuid,
            InventoryItem.inventory_list_id == inventory_uuid
        ).first()
        
        if not inventory_item:
            raise HTTPException(status_code=404, detail="Item não encontrado no inventário")
        
        # Validar que o usuario logado e o contador atribuido ao ciclo atual da lista
        if counting_list:
            counter_field = f"counter_cycle_{cycle_number}"
            assigned_counter = getattr(counting_list, counter_field, None)
            if assigned_counter and str(assigned_counter) != str(current_user.id):
                logger.warning(f"🚫 Usuario {current_user.id} tentou contar mas o contador do ciclo {cycle_number} e {assigned_counter}")
                raise HTTPException(
                    status_code=403,
                    detail=f"Voce nao e o contador atribuido ao {cycle_number}o ciclo desta lista."
                )
        
        # Verificar se produto tem controle de lote e se foram fornecidos dados de lotes
        has_lot_control = count_data.lot_counts and len(count_data.lot_counts) > 0
        
        # Para produtos COM lote, permitir múltiplas contagens (uma por lote)
        # Para produtos SEM lote, verificar se já existe contagem
        if not has_lot_control:
            # Produto SEM lote - verificar se já existe contagem para ATUALIZAR
            existing_count = db.query(Counting).filter(
                Counting.inventory_item_id == item_uuid,
                Counting.count_number == cycle_number  # ✅ Usar cycle_number em vez de assignment.count_number
            ).first()
            
            if existing_count:
                # ✅ CORREÇÃO: Atualizar contagem existente em vez de dar erro
                logger.info(f"♻️ Atualizando {cycle_number}ª contagem existente para o produto")
                existing_count.quantity = count_data.quantity
                existing_count.observation = count_data.observation or f"Contagem atualizada em {datetime.now().strftime('%d/%m/%Y %H:%M')}"
                existing_count.updated_at = datetime.now()
                
                # ✅ CORREÇÃO CRÍTICA: Atualizar campos count_cycle_X na tabela inventory_items
                if cycle_number == 1:
                    inventory_item.count_cycle_1 = count_data.quantity
                elif cycle_number == 2:
                    inventory_item.count_cycle_2 = count_data.quantity
                elif cycle_number == 3:
                    inventory_item.count_cycle_3 = count_data.quantity

                # ✅ Sincronizar counting_list_items
                from app.models.models import CountingListItem
                cli_upd = db.query(CountingListItem).filter(
                    CountingListItem.inventory_item_id == item_uuid,
                    CountingListItem.counting_list_id == counting_list.id if counting_list else None
                ).first()
                if cli_upd:
                    if cycle_number == 1:
                        cli_upd.count_cycle_1 = count_data.quantity
                    elif cycle_number == 2:
                        cli_upd.count_cycle_2 = count_data.quantity
                    elif cycle_number == 3:
                        cli_upd.count_cycle_3 = count_data.quantity
                    cli_upd.last_counted_at = datetime.utcnow()
                    cli_upd.last_counted_by = str(current_user.id)

                db.commit()
                
                # ✅ SIMPLIFICAÇÃO: Não precisamos mais atualizar status de assignment específico
                logger.info(f"✅ Contagem atualizada - ciclo {cycle_number}")
                
                return {
                    "success": True,
                    "message": f"Contagem atualizada com sucesso! ({cycle_number}ª contagem)",
                    "data": {
                        "countings_created": 0,
                        "countings_updated": 1,
                        "total_quantity": count_data.quantity,
                        "has_lot_control": False,
                        "count_number": cycle_number,
                        "item_id": str(item_uuid),
                        "product_code": inventory_item.product_code
                    }
                }
        else:
            # Produto COM lote - deletar contagens anteriores para substituir
            logger.info(f"🗑️ Produto com lote - removendo contagens anteriores para substituir")
            db.query(Counting).filter(
                Counting.inventory_item_id == item_uuid,
                Counting.count_number == cycle_number  # ✅ Usar cycle_number
            ).delete()
        
        countings_created = []
        total_quantity = 0
        
        if has_lot_control:
            # PRODUTO COM CONTROLE DE LOTE: Criar múltiplas contagens (uma por lote)
            logger.info(f"🏷️ Produto com controle de lote. Criando {len(count_data.lot_counts)} contagens")
            
            for lot_data in count_data.lot_counts:
                new_counting = Counting(
                    inventory_item_id=item_uuid,
                    quantity=lot_data.quantity,
                    lot_number=lot_data.lot_number,
                    observation=count_data.observation,
                    counted_by=current_user.id,
                    count_number=cycle_number  # ✅ Usar cycle_number
                )
                
                db.add(new_counting)
                countings_created.append(new_counting)
                total_quantity += lot_data.quantity
                
                logger.info(f"  - Lote {lot_data.lot_number}: {lot_data.quantity}")
                
        else:
            # PRODUTO SEM CONTROLE DE LOTE: Criar uma única contagem
            logger.info(f"📦 Produto sem controle de lote. Quantidade total: {count_data.quantity}")
            
            new_counting = Counting(
                inventory_item_id=item_uuid,
                quantity=count_data.quantity,
                lot_number=count_data.lot_number,  # Pode ser None
                observation=count_data.observation,
                counted_by=current_user.id,
                count_number=cycle_number  # ✅ Usar cycle_number
            )
            
            db.add(new_counting)
            countings_created.append(new_counting)
            total_quantity = count_data.quantity
        
        # ✅ SIMPLIFICAÇÃO: Não precisamos mais gerenciar status de assignment específico
        # A contagem será registrada e o status será gerenciado apenas na tabela de itens de inventário
        
        # Atualizar item do inventário com lógica corrigida de status
        inventory_item.last_counted_by = current_user.id
        inventory_item.last_counted_at = datetime.utcnow()
        
        # 🎯 SISTEMA DE 3 CICLOS - Conforme planejamento CSV do usuário
        expected_qty = float(inventory_item.expected_quantity or 0)
        counted_qty = float(total_quantity)
        count_number = cycle_number
        
        # Buscar contagens anteriores para este item (todas as contagens, não só as do count_number anterior)
        existing_counts = db.query(Counting).filter(
            Counting.inventory_item_id == item_uuid
        ).order_by(Counting.count_number).all()
        
        # Aplicar lógica de status conforme CSV do usuário
        if count_number == 1:
            # PRIMEIRA CONTAGEM
            if counted_qty == 0 and expected_qty == 0:
                inventory_item.status = "COUNTED"
            elif abs(counted_qty - expected_qty) <= 0.01:
                inventory_item.status = "COUNTED"  # Quantidade bate com esperado
            else:
                inventory_item.status = "PENDING"  # ✅ CORREÇÃO: Divergência no 1º ciclo = PENDING
                
        elif count_number == 2:
            # SEGUNDA CONTAGEM - buscar primeira contagem
            first_counts = [c for c in existing_counts if c.count_number == 1]
            if first_counts:
                first_count_qty = sum(float(c.quantity) for c in first_counts)
                
                if counted_qty == 0 and expected_qty == 0:
                    inventory_item.status = "COUNTED"
                elif abs(counted_qty - expected_qty) <= 0.01:
                    inventory_item.status = "COUNTED"  # Bate com esperado
                elif abs(first_count_qty - counted_qty) <= 0.01:
                    # ✅ CORREÇÃO: Consenso, mas verificar se bate com esperado
                    if abs(counted_qty - expected_qty) <= 0.01:
                        inventory_item.status = "COUNTED"  # Consenso = Esperado → CONTADO
                    else:
                        inventory_item.status = "PENDING"  # Consenso ≠ Esperado → DIVERGÊNCIA
                else:
                    inventory_item.status = "PENDING"  # ✅ CORREÇÃO: Ainda há divergência
            else:
                inventory_item.status = "PENDING"  # ✅ CORREÇÃO: Sem contagem anterior para comparar
                
        elif count_number == 3:
            # TERCEIRA CONTAGEM (FINAL)
            first_counts = [c for c in existing_counts if c.count_number == 1]
            second_counts = [c for c in existing_counts if c.count_number == 2]
            
            first_count_qty = sum(float(c.quantity) for c in first_counts) if first_counts else 0
            second_count_qty = sum(float(c.quantity) for c in second_counts) if second_counts else 0
            
            if counted_qty == 0 and expected_qty == 0:
                inventory_item.status = "COUNTED"
            elif abs(counted_qty - expected_qty) <= 0.01:
                inventory_item.status = "COUNTED"  # Bate com esperado
            elif second_counts and abs(second_count_qty - counted_qty) <= 0.01:
                # ✅ CORREÇÃO: Consenso 2ª=3ª, mas verificar se bate com esperado
                if abs(counted_qty - expected_qty) <= 0.01:
                    inventory_item.status = "COUNTED"  # Consenso = Esperado → CONTADO
                else:
                    inventory_item.status = "PENDING"  # Consenso ≠ Esperado → DIVERGÊNCIA
            elif first_counts and abs(first_count_qty - counted_qty) <= 0.01:
                # ✅ CORREÇÃO: Consenso 1ª=3ª, mas verificar se bate com esperado
                if abs(counted_qty - expected_qty) <= 0.01:
                    inventory_item.status = "COUNTED"  # Consenso = Esperado → CONTADO
                else:
                    inventory_item.status = "PENDING"  # Consenso ≠ Esperado → DIVERGÊNCIA
            else:
                inventory_item.status = "PENDING"  # ✅ CORREÇÃO: Divergência final
        
        # ✅ CORREÇÃO CRÍTICA: Atualizar campos count_cycle_X para contagens novas
        if cycle_number == 1:
            inventory_item.count_cycle_1 = total_quantity
        elif cycle_number == 2:
            inventory_item.count_cycle_2 = total_quantity
            inventory_item.needs_recount_cycle_2 = False
        elif cycle_number == 3:
            inventory_item.count_cycle_3 = total_quantity
            inventory_item.needs_recount_cycle_3 = False

        # ✅ CORREÇÃO: Sincronizar counting_list_items com a contagem registrada
        from app.models.models import CountingListItem
        cli = db.query(CountingListItem).filter(
            CountingListItem.inventory_item_id == item_uuid,
            CountingListItem.counting_list_id == counting_list.id if counting_list else None
        ).first()
        if cli:
            if cycle_number == 1:
                cli.count_cycle_1 = total_quantity
                cli.needs_count_cycle_1 = False
            elif cycle_number == 2:
                cli.count_cycle_2 = total_quantity
                cli.needs_count_cycle_2 = False
            elif cycle_number == 3:
                cli.count_cycle_3 = total_quantity
                cli.needs_count_cycle_3 = False
            cli.last_counted_at = datetime.utcnow()
            cli.last_counted_by = str(current_user.id)

        db.commit()
        
        # Processar resultado para cada contagem criada
        for counting in countings_created:
            await process_counting_result(db, inventory_item, counting)
        
        return {
            "success": True,
            "message": f"Contagem registrada com sucesso! ({cycle_number}ª contagem) - {len(countings_created)} registro(s) criado(s)",
            "data": {
                "countings_created": len(countings_created),
                "total_quantity": total_quantity,
                "has_lot_control": has_lot_control,
                "lot_details": [
                    {
                        "counting_id": str(counting.id),
                        "lot_number": counting.lot_number,
                        "quantity": float(counting.quantity)
                    } for counting in countings_created
                ] if has_lot_control else None,
                "count_number": cycle_number,
                "item_id": str(inventory_item.id),
                "product_code": inventory_item.product_code
            }
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao registrar contagem: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao registrar contagem"))

async def process_counting_result(db: Session, inventory_item, counting):
    """Processar resultado da contagem e criar discrepâncias ou próximas contagens"""
    try:
        from app.models.models import Counting, CountingAssignment, Discrepancy
        
        # Buscar todas as contagens deste item
        all_counts = db.query(Counting).filter(
            Counting.inventory_item_id == inventory_item.id
        ).order_by(Counting.count_number).all()
        
        count_number = counting.count_number
        
        if count_number == 1:
            # Primeira contagem - verificar se há divergência com quantidade esperada
            expected_qty = float(inventory_item.expected_quantity or 0)
            counted_qty = float(counting.quantity)
            tolerance = 0.01  # Tolerância de 1%
            
            if abs(counted_qty - expected_qty) > (expected_qty * tolerance):
                # Há divergência - criar segunda contagem
                # TEMPORÁRIO: Comentado para evitar erro de duplicação
                # await create_next_counting_assignment(db, inventory_item, 2)
                
                # Criar registro de discrepância
                discrepancy = Discrepancy(
                    inventory_item_id=inventory_item.id,
                    expected_quantity=expected_qty,
                    counted_quantity=counted_qty,
                    difference=counted_qty - expected_qty,
                    discrepancy_type='SYSTEM_VS_PHYSICAL',
                    count_number=1,
                    status='PENDING',
                    created_by=counting.counted_by,
                    observation=f"Divergência detectada na 1ª contagem. Esperado: {expected_qty}, Contado: {counted_qty}"
                )
                db.add(discrepancy)
                db.commit()
                
        elif count_number == 2:
            # Segunda contagem - comparar com primeira
            first_count = next((c for c in all_counts if c.count_number == 1), None)
            if first_count:
                first_qty = float(first_count.quantity)
                second_qty = float(counting.quantity)
                tolerance = 0.01
                
                if abs(second_qty - first_qty) > (first_qty * tolerance):
                    # Divergência entre 1ª e 2ª contagem - criar terceira contagem
                    # TEMPORÁRIO: Comentado para evitar erro de duplicação
                    # await create_next_counting_assignment(db, inventory_item, 3)
                    
                    # Atualizar discrepância
                    discrepancy = db.query(Discrepancy).filter(
                        Discrepancy.inventory_item_id == inventory_item.id,
                        Discrepancy.count_number == 1
                    ).first()
                    
                    if discrepancy:
                        discrepancy.observation += f" | 2ª contagem: {second_qty} (divergência persiste)"
                        db.commit()
                else:
                    # 1ª e 2ª contagem concordam - verificar se há divergência com esperado
                    expected_qty = float(inventory_item.expected_quantity or 0)
                    current_qty = float(quantity)
                    has_divergence_final = abs(current_qty - expected_qty) > 0.01
                    
                    if not has_divergence_final:
                        inventory_item.status = 'COUNTED'  # Sem divergência
                    else:
                        inventory_item.status = 'PENDING'  # ✅ CORREÇÃO: Com divergência
                    db.commit()
                    
        elif count_number == 3:
            # Terceira contagem - finalizar com valor mais próximo
            first_count = next((c for c in all_counts if c.count_number == 1), None)
            second_count = next((c for c in all_counts if c.count_number == 2), None)
            
            if first_count and second_count:
                # Terceira contagem - verificar se há divergência com esperado
                expected_qty = float(inventory_item.expected_quantity or 0)
                current_qty = float(quantity)
                has_divergence_final = abs(current_qty - expected_qty) > 0.01
                
                if not has_divergence_final:
                    inventory_item.status = 'COUNTED'  # Sem divergência
                else:
                    inventory_item.status = 'PENDING'  # ✅ CORREÇÃO: Com divergência
                db.commit()
                
    except Exception as e:
        logger.error(f"❌ Erro ao processar resultado da contagem: {e}")

async def create_next_counting_assignment(db: Session, inventory_item, next_count_number):
    """Criar próxima atribuição de contagem"""
    try:
        from app.models.models import CountingAssignment, User
        
        # Buscar um supervisor ou admin disponível para atribuir
        supervisor = db.query(User).filter(
            User.role.in_(['SUPERVISOR', 'ADMIN']),
            User.store_id == inventory_item.inventory_list.store_id,
            User.is_active == True
        ).first()
        
        if supervisor:
            assignment = CountingAssignment(
                inventory_item_id=inventory_item.id,
                assigned_to=supervisor.id,  # Por enquanto, atribuir ao supervisor
                assigned_by=supervisor.id,
                count_number=next_count_number,
                status='PENDING',
                deadline=datetime.utcnow() + timedelta(days=1)
            )
            db.add(assignment)
            db.commit()
            
    except Exception as e:
        logger.error(f"❌ Erro ao criar próxima atribuição: {e}")

# =================================
# ENDPOINTS DE DIVERGÊNCIAS (FASE 2E)
# =================================

class ProcessInventoryRequest(BaseModel):
    inventory_id: str
    tolerance_percentage: Optional[float] = 0.0  # 🔥 CORREÇÃO: Tolerância 0 = qualquer diferença é divergência

@app.post("/api/v1/inventory/process-discrepancies", tags=["Inventory"])
async def process_inventory_discrepancies(
    request: ProcessInventoryRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Processar inventário e identificar divergências"""
    try:
        from app.models.models import InventoryList, InventoryItem, Counting, Discrepancy, SB1010, SB2010, SB8010
        import uuid
        from decimal import Decimal
        
        inventory_uuid = uuid.UUID(request.inventory_id)
        
        # Verificar se inventário existe e pertence à loja do usuário
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid,
            InventoryList.store_id == current_user.store_id
        ).first()
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Buscar todos os itens do inventário com suas contagens
        items = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).all()
        
        discrepancies_created = 0
        items_processed = 0
        
        for item in items:
            items_processed += 1
            
            # Buscar produto para verificar se controla lote - usando TRIM
            from sqlalchemy import func
            product = db.query(SB1010).filter(
                func.trim(SB1010.b1_cod) == item.product_code.strip()
            ).first()
            
            if not product:
                continue
            
            # Buscar última contagem do item
            last_counting = db.query(Counting).filter(
                Counting.inventory_item_id == item.id
            ).order_by(Counting.count_number.desc()).first()
            
            if not last_counting:
                continue  # Item não foi contado ainda
            
            # Determinar saldo esperado baseado no controle de lote
            expected_quantity = Decimal('0')
            
            if product.b1_rastro == 'L':
                # Produto controla lote - buscar saldo na SB8010
                if last_counting.lot_number:
                    lot_balance = db.query(SB8010).filter(
                        SB8010.b8_produto == product.b1_cod,
                        SB8010.b8_lotectl == last_counting.lot_number
                    ).first()
                    
                    if lot_balance:
                        expected_quantity = lot_balance.b8_saldo or Decimal('0')
            else:
                # Produto não controla lote - buscar saldo na SB2010
                product_balance = db.query(SB2010).filter(
                    SB2010.b2_cod == product.b1_cod
                ).first()
                
                if product_balance:
                    expected_quantity = product_balance.b2_qatu or Decimal('0')
            
            # Calcular divergência
            counted_quantity = Decimal(str(last_counting.quantity))
            variance = counted_quantity - expected_quantity
            
            # Calcular percentual de divergência
            if expected_quantity != 0:
                variance_percentage = (variance / expected_quantity) * 100
            else:
                variance_percentage = Decimal('100') if variance != 0 else Decimal('0')
            
            # Verificar se excede tolerância
            tolerance_exceeded = abs(variance_percentage) > Decimal(str(request.tolerance_percentage))
            
            # Criar registro de divergência apenas se houver diferença
            if variance != 0:
                # Verificar se já existe divergência para este item
                existing_discrepancy = db.query(Discrepancy).filter(
                    Discrepancy.inventory_item_id == item.id
                ).first()
                
                if existing_discrepancy:
                    # Atualizar divergência existente
                    existing_discrepancy.variance_quantity = float(variance)
                    existing_discrepancy.variance_percentage = float(variance_percentage)
                    existing_discrepancy.tolerance_exceeded = tolerance_exceeded
                    existing_discrepancy.status = "PENDING" if tolerance_exceeded else "APPROVED"
                else:
                    # Criar nova divergência
                    discrepancy = Discrepancy(
                        inventory_item_id=item.id,
                        variance_quantity=float(variance),
                        variance_percentage=float(variance_percentage),
                        tolerance_exceeded=tolerance_exceeded,
                        status="PENDING" if tolerance_exceeded else "APPROVED",
                        created_by=current_user.id
                    )
                    db.add(discrepancy)
                    discrepancies_created += 1
                
                # Atualizar quantidade esperada no item
                item.expected_quantity = float(expected_quantity)
        
        # Atualizar status do inventário
        if discrepancies_created > 0:
            inventory.status = "IN_PROGRESS"  # Há divergências para resolver
        else:
            inventory.status = "COMPLETED"  # Não há divergências significativas
        
        db.commit()
        
        return {
            "success": True,
            "inventory_id": request.inventory_id,
            "items_processed": items_processed,
            "discrepancies_created": discrepancies_created,
            "tolerance_percentage": request.tolerance_percentage,
            "status": inventory.status.value,
            "message": f"Processamento concluído. {discrepancies_created} divergências identificadas."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao processar divergências: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao processar divergências"))

@app.get("/api/v1/my-closed-counting-rounds", tags=["Inventory"])
async def get_my_closed_counting_rounds(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar rodadas de contagem encerradas pelo usuário atual (para divergências)"""
    try:
        from app.models.models import ClosedCountingRound, InventoryItem, InventoryList, Discrepancy
        from sqlalchemy import func, distinct
        
        # Buscar rodadas encerradas do usuário atual
        closed_rounds_query = db.query(
            InventoryList.id.label('inventory_id'),
            InventoryList.name.label('inventory_name'),
            func.concat(
                current_user.id, '_', 
                CountingAssignment.count_number
            ).label('round_key'),
            CountingAssignment.count_number,
            func.count(CountingAssignment.id).label('total_items'),
            func.count(Discrepancy.id).label('total_discrepancies'),
            func.max(CountingAssignment.completed_at).label('closed_at')
        ).join(
            InventoryItem, CountingAssignment.inventory_item_id == InventoryItem.id
        ).join(
            InventoryList, InventoryItem.inventory_list_id == InventoryList.id
        ).outerjoin(
            Discrepancy, Discrepancy.inventory_item_id == InventoryItem.id
        ).filter(
            CountingAssignment.assigned_to == current_user.id,
            CountingAssignment.status == 'COMPLETED'
        ).group_by(
            InventoryList.id,
            InventoryList.name, 
            CountingAssignment.count_number
        ).order_by(
            func.max(CountingAssignment.completed_at).desc()
        ).all()
        
        # Formatar resposta
        rounds = []
        for row in closed_rounds_query:
            round_display = f"{row.count_number}ª Contagem - {current_user.full_name} - {row.inventory_name}"
            if row.total_discrepancies > 0:
                round_display += f" ({row.total_discrepancies} divergências)"
            else:
                round_display += " (sem divergências)"
                
            rounds.append({
                "round_key": row.round_key,
                "inventory_id": str(row.inventory_id),
                "inventory_name": row.inventory_name,
                "count_number": row.count_number,
                "user_name": current_user.full_name,
                "display_text": round_display,
                "total_items": row.total_items,
                "total_discrepancies": row.total_discrepancies,
                "closed_at": row.closed_at.isoformat() if row.closed_at else None
            })
        
        return {
            "success": True,
            "user_id": str(current_user.id),
            "user_name": current_user.full_name,
            "closed_rounds": rounds,
            "total_rounds": len(rounds)
        }
        
    except Exception as e:
        print(f"Erro ao buscar rodadas encerradas: {e}")
        return {"success": False, "message": f"Erro interno: {str(e)}"}

@app.get("/api/v1/inventory/items/{item_id}/next-count", tags=["Inventory"])
async def get_next_count_info(
    item_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Determina qual é a próxima contagem disponível para um item
    Retorna informações sobre contagens anteriores e próxima permitida
    """
    try:
        from app.models.models import InventoryItem, Counting, Discrepancy
        
        # Converter string para UUID
        try:
            item_uuid = uuid.UUID(item_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de item inválido")
        
        # Buscar item
        item = db.query(InventoryItem).filter(InventoryItem.id == item_uuid).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        
        # Buscar contagens existentes
        existing_counts = db.query(Counting).filter(
            Counting.inventory_item_id == item_uuid
        ).order_by(Counting.count_number.desc()).all()
        
        # Determinar última contagem realizada
        last_count_number = existing_counts[0].count_number if existing_counts else 0
        
        # Verificar se há divergências não resolvidas
        has_unresolved_discrepancy = db.query(Discrepancy).filter(
            Discrepancy.inventory_item_id == item_uuid,
            Discrepancy.status == 'PENDING'
        ).first() is not None
        
        # Determinar próxima contagem permitida
        next_count_info = {
            "item_id": str(item_id),
            "product_code": item.product_code,
            "last_count_number": last_count_number,
            "has_unresolved_discrepancy": has_unresolved_discrepancy,
            "existing_counts": []
        }
        
        # Adicionar informações das contagens existentes
        for count in existing_counts:
            next_count_info["existing_counts"].append({
                "count_number": count.count_number,
                "quantity": float(count.quantity),
                "counted_by": str(count.counted_by),
                "created_at": count.created_at.isoformat()
            })
        
        # ====================================================================
        # SISTEMA DE LISTA DE CONTAGEM - REGRA DE NEGÓCIO CORRETA
        # APENAS USUÁRIOS COM ATRIBUIÇÃO ESPECÍFICA PODEM CONTAR
        # ====================================================================
        
        # ✅ SIMPLIFICAÇÃO: Se usuário chegou até aqui, tem permissão (validado no modal "Gerenciar Lista")
        # A lógica será: se o usuário chegou até a página de contagem, ele tem permissão para contar
        next_count_info["next_count_number"] = current_cycle
        next_count_info["can_count"] = True
        next_count_info["reason"] = f"Usuário autorizado para {current_cycle}ª contagem (validado no modal Gerenciar Lista)"
        
        return next_count_info
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao determinar próxima contagem: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno"))

@app.get("/api/v1/my-closed-rounds-simple", tags=["Discrepancies"])
async def get_my_closed_rounds_simple(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar inventários disponíveis para filtro de divergências"""
    try:
        # Buscar inventários que têm listas de contagem com dados
        query = text("""
            SELECT DISTINCT il.id, il.name, il.warehouse, il.status, il.created_at
            FROM inventario.inventory_lists il
            JOIN inventario.counting_lists cl ON cl.inventory_id = il.id
            WHERE il.store_id = :store_id
              AND il.status IN ('IN_PROGRESS', 'COMPLETED', 'CLOSED')
            ORDER BY il.created_at DESC
        """)
        results = db.execute(query, {"store_id": str(current_user.store_id)}).fetchall()

        rounds = []
        for row in results:
            status_label = {'IN_PROGRESS': 'Em Andamento', 'COMPLETED': 'Concluido', 'CLOSED': 'Efetivado'}.get(row.status, row.status)
            rounds.append({
                "round_key": str(row.id),
                "display_text": f"{row.name} ({row.warehouse}) — {status_label}",
            })

        return rounds

    except Exception as e:
        print(f"Erro ao buscar inventarios para divergencias: {e}")
        return []

@app.get("/api/v1/discrepancies", tags=["Discrepancies"])
async def get_all_discrepancies(
    round_key: str = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar divergências a partir das listas de contagem (counting_list_items)"""
    try:
        # Buscar itens contados com divergência em relação ao saldo do sistema
        inv_filter = ""
        params = {"store_id": str(current_user.store_id)}
        if round_key:
            inv_filter = "AND il.id = :inv_id"
            params["inv_id"] = round_key

        query = text(f"""
            SELECT
                cli.id,
                ii.product_code,
                COALESCE(sb1.b1_desc, iis.b1_desc, 'Produto') as product_description,
                COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0) as expected_quantity,
                COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1) as counted_quantity,
                (COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1)
                 - (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0))) as variance_quantity,
                CASE
                    WHEN (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0)) > 0
                    THEN ROUND(((COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1)
                          - (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0)))
                         / (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0))) * 100, 2)
                    WHEN COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1) > 0
                    THEN 100.0
                    ELSE 0.0
                END as variance_percentage,
                il.name as inventory_name,
                il.id as inventory_id,
                CASE WHEN cl.list_status = 'ENCERRADA' THEN 'RESOLVED' ELSE 'PENDING' END as status,
                cli.updated_at as created_at
            FROM inventario.counting_list_items cli
            JOIN inventario.counting_lists cl ON cli.counting_list_id = cl.id
            JOIN inventario.inventory_lists il ON cl.inventory_id = il.id
            JOIN inventario.inventory_items ii ON cli.inventory_item_id = ii.id
            LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
            LEFT JOIN inventario.sb1010 sb1 ON ii.product_code = sb1.b1_cod
            WHERE il.store_id = :store_id
              AND (cli.count_cycle_1 IS NOT NULL OR cli.count_cycle_2 IS NOT NULL OR cli.count_cycle_3 IS NOT NULL)
              AND ABS(COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1)
                      - (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0))) > 0.01
              {inv_filter}
            ORDER BY ABS(COALESCE(cli.count_cycle_3, cli.count_cycle_2, cli.count_cycle_1)
                         - (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0))) DESC
            LIMIT 500
        """)

        results = db.execute(query, params).fetchall()

        discrepancies = []
        for row in results:
            discrepancies.append({
                "id": str(row.id),
                "inventory_id": str(row.inventory_id),
                "inventory_name": row.inventory_name,
                "product_code": row.product_code,
                "product_description": row.product_description,
                "expected_quantity": float(row.expected_quantity) if row.expected_quantity else 0,
                "counted_quantity": float(row.counted_quantity) if row.counted_quantity else 0,
                "variance_quantity": float(row.variance_quantity) if row.variance_quantity else 0,
                "variance_percentage": float(row.variance_percentage) if row.variance_percentage else 0,
                "tolerance_exceeded": abs(float(row.variance_percentage or 0)) > 5.0,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else datetime.utcnow().isoformat(),
                "observation": None
            })

        return {
            "discrepancies": discrepancies,
            "total": len(discrepancies)
        }

    except Exception as e:
        print(f"Erro ao buscar divergencias: {e}")
        import traceback
        traceback.print_exc()
        return {"discrepancies": [], "total": 0}


@app.get("/api/v1/discrepancies/adjustments", tags=["Discrepancies"])
async def get_discrepancy_adjustments(
    inventory_id: str = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar ajustes e transferências gerados nas integrações Protheus"""
    try:
        inv_filter = ""
        inv_wh_filter = ""
        params = {"store_id": str(current_user.store_id)}
        if inventory_id:
            inv_filter = "AND (pi.inventory_a_id = :inv_id OR pi.inventory_b_id = :inv_id)"
            inv_wh_filter = """AND (
                pii.target_warehouse = (SELECT warehouse FROM inventario.inventory_lists WHERE id = :inv_id)
                OR pii.source_warehouse = (SELECT warehouse FROM inventario.inventory_lists WHERE id = :inv_id)
            )"""
            params["inv_id"] = inventory_id

        query = text(f"""
            SELECT
                pii.id,
                pii.item_type,
                pii.product_code,
                pii.product_description,
                pii.lot_number,
                pii.source_warehouse,
                pii.target_warehouse,
                pii.quantity,
                pii.expected_qty,
                pii.counted_qty,
                pii.adjusted_qty,
                pii.unit_cost,
                pii.total_value,
                pii.adjustment_type,
                pii.item_status,
                pi.status as integration_status,
                pi.integration_type,
                ila.name as inventory_name,
                pi.sent_at,
                pii.created_at
            FROM inventario.protheus_integration_items pii
            JOIN inventario.protheus_integrations pi ON pii.integration_id = pi.id
            JOIN inventario.inventory_lists ila ON ila.id = pi.inventory_a_id
            WHERE ila.store_id = :store_id
              {inv_filter}
              {inv_wh_filter}
              AND NOT (
                pii.lot_number IS NULL
                AND EXISTS (
                  SELECT 1 FROM inventario.protheus_integration_items dup
                  WHERE dup.integration_id = pii.integration_id
                    AND dup.product_code = pii.product_code
                    AND dup.item_type = pii.item_type
                    AND COALESCE(dup.target_warehouse, dup.source_warehouse) = COALESCE(pii.target_warehouse, pii.source_warehouse)
                    AND dup.lot_number IS NOT NULL
                )
              )
            ORDER BY pii.product_code, pii.lot_number NULLS LAST
        """)

        results = db.execute(query, params).fetchall()

        items = []
        for row in results:
            items.append({
                "id": str(row.id),
                "item_type": row.item_type,
                "product_code": row.product_code,
                "product_description": row.product_description,
                "lot_number": row.lot_number,
                "source_warehouse": row.source_warehouse,
                "target_warehouse": row.target_warehouse,
                "quantity": float(row.quantity) if row.quantity else 0,
                "expected_qty": float(row.expected_qty) if row.expected_qty else 0,
                "counted_qty": float(row.counted_qty) if row.counted_qty else 0,
                "adjusted_qty": float(row.adjusted_qty) if row.adjusted_qty else 0,
                "unit_cost": float(row.unit_cost) if row.unit_cost else 0,
                "total_value": float(row.total_value) if row.total_value else 0,
                "adjustment_type": row.adjustment_type,
                "item_status": row.item_status,
                "integration_status": row.integration_status,
                "integration_type": row.integration_type,
                "inventory_name": row.inventory_name,
                "sent_at": row.sent_at.isoformat() if row.sent_at else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            })

        # Summary
        total_adjustments = len([i for i in items if i["item_type"] == "ADJUSTMENT"])
        total_transfers = len([i for i in items if i["item_type"] == "TRANSFER"])
        total_value = sum(abs(i["total_value"]) for i in items)

        return {
            "items": items,
            "total": len(items),
            "summary": {
                "adjustments": total_adjustments,
                "transfers": total_transfers,
                "total_value": round(total_value, 2),
            }
        }

    except Exception as e:
        print(f"Erro ao buscar ajustes/transferencias: {e}")
        import traceback
        traceback.print_exc()
        return {"items": [], "total": 0, "summary": {"adjustments": 0, "transfers": 0, "total_value": 0}}


@app.get("/api/v1/counting-round/{round_key}/discrepancies", tags=["Inventory"])
async def get_round_discrepancies(
    round_key: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Buscar divergências de uma rodada específica do usuário"""
    try:
        from app.models.models import CountingAssignment, InventoryItem, InventoryList, Discrepancy, SB1010, Counting, User
        from sqlalchemy.orm import aliased
        import uuid
        
        # Extrair user_id e count_number do round_key
        parts = round_key.split('_')
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Formato de round_key inválido")
            
        user_uuid = uuid.UUID(parts[0])
        count_number = int(parts[1])
        
        # Verificar se é o usuário correto
        if user_uuid != current_user.id:
            raise HTTPException(status_code=403, detail="Acesso negado - rodada de outro usuário")
        
        # Buscar divergências da rodada específica - SIMPLIFICADO
        print(f"🔍 DEBUG: Buscando divergências para user_uuid={user_uuid}, count_number={count_number}")
        
        # Primeiro, buscar divergências do usuário
        user_discrepancies = db.query(Discrepancy).filter(
            Discrepancy.created_by == user_uuid
        ).all()
        
        print(f"📊 DEBUG: Total de divergências do usuário: {len(user_discrepancies)}")
        
        # Depois filtrar por rodada através das atribuições
        valid_discrepancies = []
        
        for discrepancy in user_discrepancies:
            # Verificar se há atribuição COMPLETED para esta rodada
            assignment = db.query(CountingAssignment).filter(
                CountingAssignment.inventory_item_id == discrepancy.inventory_item_id,
                CountingAssignment.assigned_to == user_uuid,
                CountingAssignment.count_number == count_number,
                CountingAssignment.status == 'COMPLETED'
            ).first()
            
            if assignment:
                print(f"✅ DEBUG: Divergência válida encontrada: {discrepancy.id}")
                valid_discrepancies.append(discrepancy)
            else:
                print(f"❌ DEBUG: Divergência sem atribuição válida: {discrepancy.id}")
        
        print(f"🎯 DEBUG: Divergências válidas para esta rodada: {len(valid_discrepancies)}")
        
        # Construir response
        discrepancies = []
        inventory_name = "N/A"
        
        for discrepancy in valid_discrepancies:
            # Buscar dados do item
            item = db.query(InventoryItem).filter(InventoryItem.id == discrepancy.inventory_item_id).first()
            if not item:
                continue
                
            # Buscar dados do inventário
            inventory = db.query(InventoryList).filter(InventoryList.id == item.inventory_list_id).first()
            if not inventory:
                continue
            inventory_name = inventory.name  # Atualizar nome do inventário
                
            # Simplificar - não buscar produto por enquanto devido a problemas de modelo
            product_code = f"Produto_Seq_{item.sequence}"
            product_name = f"Produto Sequência {item.sequence}"
            unit = "UN"
            has_lot = False
            # Buscar contagens deste item
            all_countings = db.query(Counting, User).join(
                User, Counting.counted_by == User.id
            ).filter(
                Counting.inventory_item_id == item.id
            ).order_by(Counting.count_number).all()
            
            countings_list = []
            for counting, counting_user in all_countings:
                countings_list.append({
                    "count_number": counting.count_number,
                    "quantity": float(counting.quantity),
                    "lot_number": counting.lot_number,
                    "counted_by": counting_user.full_name,
                    "counted_at": counting.created_at.isoformat()
                })
            
            discrepancies.append({
                "discrepancy_id": str(discrepancy.id),
                "item_id": str(item.id),
                "sequence": item.sequence,
                "product_code": product_code,
                "product_name": product_name,
                "unit": unit,
                "has_lot": has_lot,
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0,
                "variance_quantity": discrepancy.variance_quantity,
                "variance_percentage": discrepancy.variance_percentage,
                "tolerance_exceeded": discrepancy.tolerance_exceeded,
                "status": discrepancy.status,
                "created_at": discrepancy.created_at.isoformat(),
                "resolved_at": discrepancy.resolved_at.isoformat() if discrepancy.resolved_at else None,
                "countings": countings_list
            })
            
            print(f"📦 DEBUG: Adicionada divergência - Produto: {product_code}, Variação: {discrepancy.variance_quantity}")
        
        return {
            "success": True,
            "round_key": round_key,
            "count_number": count_number,
            "user_name": current_user.full_name,
            "inventory_name": inventory_name,
            "discrepancies": discrepancies,
            "total_discrepancies": len(discrepancies)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao buscar divergências da rodada: {e}")
        return {"success": False, "message": f"Erro interno: {str(e)}"}

@app.get("/api/v1/inventory/lists/{inventory_id}/discrepancies", tags=["Inventory"])
async def get_inventory_discrepancies(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar divergências de um inventário"""
    try:
        from app.models.models import InventoryList, Discrepancy, InventoryItem, SB1010, Counting, User
        import uuid
        
        inventory_uuid = uuid.UUID(inventory_id)
        
        # Verificar se inventário existe e usuário tem acesso
        inventory = check_inventory_access(db, inventory_uuid, current_user)
        
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # Buscar divergências com informações dos produtos
        # FILTRO DISTINCT: Mostrar apenas divergências onde o usuário atual participou da contagem
        from sqlalchemy.orm import aliased
        UserCreator = aliased(User)
        
        discrepancies_query = db.query(
            Discrepancy, InventoryItem, SB1010, UserCreator
        ).join(
            InventoryItem, Discrepancy.inventory_item_id == InventoryItem.id
        ).join(
            SB1010, InventoryItem.product_code == SB1010.b1_cod
        ).join(
            UserCreator, Discrepancy.created_by == UserCreator.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid,
            # DISTINCT: Apenas divergências criadas por contagens do usuário atual
            Discrepancy.created_by == current_user.id
        ).order_by(Discrepancy.variance_percentage.desc()).all()
        
        # Construir response com divergências do usuário atual
        discrepancies = []
        
        for discrepancy, item, product, user_creator in discrepancies_query:
            # Buscar todas as contagens deste item para contexto
            all_countings = db.query(Counting, User).join(
                User, Counting.counted_by == User.id
            ).filter(
                Counting.inventory_item_id == item.id
            ).order_by(Counting.count_number).all()
            
            # Preparar lista de contagens
            countings_list = []
            for counting, counting_user in all_countings:
                countings_list.append({
                    "count_number": counting.count_number,
                    "quantity": float(counting.quantity),
                    "lot_number": counting.lot_number,
                    "counted_by": counting_user.full_name,
                    "counted_at": counting.created_at.isoformat()
                })
            
            # Adicionar divergência à lista
            discrepancies.append({
                "discrepancy_id": str(discrepancy.id),
                "item_id": str(item.id),
                "sequence": item.sequence,
                "product_code": product.b1_cod,
                "product_name": product.b1_desc,
                "unit": product.b1_um,
                "has_lot": product.b1_rastro == 'L',
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0,
                "variance_quantity": discrepancy.variance_quantity,
                "variance_percentage": discrepancy.variance_percentage,
                "tolerance_exceeded": discrepancy.tolerance_exceeded,
                "status": discrepancy.status,
                "created_by": user_creator.full_name,
                "created_at": discrepancy.created_at.isoformat(),
                "resolved_at": discrepancy.resolved_at.isoformat() if discrepancy.resolved_at else None,
                "countings": countings_list
            })
        
        return {
            "success": True,
            "inventory_id": inventory_id,
            "inventory_name": inventory.name,
            "discrepancies": discrepancies,
            "total_discrepancies": len(discrepancies)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar divergências: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar divergências"))

@app.post("/api/v1/inventory/items/{item_id}/request-recount", tags=["Inventory"])
async def request_item_recount(
    item_id: str,
    request: dict,  # {"assigned_to": "user_id", "observation": "motivo da recontagem"}
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Solicitar segunda contagem para um item com divergência"""
    try:
        from app.models.models import InventoryItem, Discrepancy
        import uuid
        
        item_uuid = uuid.UUID(item_id)
        
        # Verificar se item existe
        inventory_item = db.query(InventoryItem).filter(
            InventoryItem.id == item_uuid
        ).first()
        
        if not inventory_item:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        
        # Verificar se há divergência para este item
        discrepancy = db.query(Discrepancy).filter(
            Discrepancy.inventory_item_id == item_uuid
        ).first()
        
        if not discrepancy:
            raise HTTPException(status_code=400, detail="Não há divergência registrada para este item")
        
        # Atribuir novo contador (se especificado)
        if "assigned_to" in request:
            assigned_user_id = uuid.UUID(request["assigned_to"])
            
            # Verificar se usuário existe na mesma loja
            assigned_user = db.query(User).filter(
                User.id == assigned_user_id,
                User.store_id == current_user.store_id,
                User.is_active == True
            ).first()
            
            if not assigned_user:
                raise HTTPException(status_code=404, detail="Usuário não encontrado para atribuição")
            
            inventory_item.last_counted_by = assigned_user_id
        
        # Resetar status para permitir nova contagem
        inventory_item.status = "PENDING"
        
        # Atualizar divergência
        discrepancy.status = "RECOUNT_REQUESTED"
        discrepancy.observation = request.get("observation", "Segunda contagem solicitada")
        
        db.commit()
        
        return {
            "success": True,
            "item_id": item_id,
            "message": "Segunda contagem solicitada com sucesso",
            "assigned_to": request.get("assigned_to"),
            "status": "RECOUNT_REQUESTED"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao solicitar recontagem: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao solicitar recontagem"))

@app.post("/api/v1/inventory/discrepancies/{discrepancy_id}/resolve", tags=["Inventory"])
async def resolve_discrepancy(
    discrepancy_id: str,
    request: dict,  # {"resolution": "APPROVED|REJECTED", "observation": "motivo"}
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resolver uma divergência (aprovar ou rejeitar)"""
    try:
        from app.models.models import Discrepancy
        import uuid
        from datetime import datetime
        
        discrepancy_uuid = uuid.UUID(discrepancy_id)
        
        # Buscar divergência
        discrepancy = db.query(Discrepancy).filter(
            Discrepancy.id == discrepancy_uuid
        ).first()
        
        if not discrepancy:
            raise HTTPException(status_code=404, detail="Divergência não encontrada")
        
        resolution = request.get("resolution", "APPROVED")
        if resolution not in ["APPROVED", "REJECTED"]:
            raise HTTPException(status_code=400, detail="Resolução deve ser APPROVED ou REJECTED")
        
        # Atualizar divergência
        discrepancy.status = resolution
        discrepancy.resolution = request.get("observation", f"Divergência {resolution.lower()}")
        discrepancy.resolved_by = current_user.id
        discrepancy.resolved_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "success": True,
            "discrepancy_id": discrepancy_id,
            "resolution": resolution,
            "resolved_by": current_user.full_name,
            "message": f"Divergência {resolution.lower()} com sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao resolver divergência: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao resolver divergência"))

# =================================
# ENDPOINTS DE RELATÓRIOS (FASE 3)
# =================================

@app.get("/api/v1/inventory/lists/{inventory_id}/final-report", tags=["Reports"])
async def generate_final_inventory_report(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Gerar relatório final consolidado do inventário"""
    try:
        from app.models.models import InventoryList, InventoryItem, SB1010, Counting, Discrepancy
        import uuid
        
        inventory_uuid = uuid.UUID(inventory_id)
        
        # Verificar se inventário existe (ADMIN vê todos, outros filtram por loja)
        inv_query = db.query(InventoryList).filter(InventoryList.id == inventory_uuid)
        if current_user.role != 'ADMIN':
            inv_query = inv_query.filter(InventoryList.store_id == current_user.store_id)
        inventory = inv_query.first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")
        
        # 📸 v2.10.0: Buscar itens com snapshot (custo médio congelado)
        # ✅ v2.15.7.6: Adicionar snapshot_lots para preencher coluna "Qtde Lote" no relatório
        from app.models.models import InventoryItemSnapshot, InventoryLotSnapshot

        items_query = db.query(
            InventoryItem, SB1010, InventoryItemSnapshot
        ).join(
            SB1010, InventoryItem.product_code == SB1010.b1_cod
        ).outerjoin(
            InventoryItemSnapshot, InventoryItemSnapshot.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        ).order_by(InventoryItem.sequence).all()
        
        report_items = []
        total_items = 0
        counted_items = 0
        items_with_discrepancy = 0
        total_expected_value = 0
        total_counted_value = 0
        # ✅ v2.19.8: Variáveis para variação física
        total_expected_qty = 0
        total_counted_qty = 0
        products_with_zero_cost = 0

        # ✅ Batch-load contagens e divergências (elimina N+1 queries)
        from collections import defaultdict
        item_ids = [item.id for item, _, _ in items_query]

        countings_by_item = defaultdict(list)
        disc_by_item = {}

        if item_ids:
            all_countings = db.query(Counting, User).outerjoin(
                User, Counting.counted_by == User.id
            ).filter(
                Counting.inventory_item_id.in_(item_ids)
            ).order_by(Counting.count_number).all()
            for c, u in all_countings:
                countings_by_item[c.inventory_item_id].append((c, u))

            all_discrepancies = db.query(Discrepancy).filter(
                Discrepancy.inventory_item_id.in_(item_ids)
            ).all()
            disc_by_item = {d.inventory_item_id: d for d in all_discrepancies}

        for item, product, snapshot in items_query:
            total_items += 1

            # Buscar contagens e divergência do batch (O(1) lookup)
            countings = countings_by_item.get(item.id, [])
            discrepancy = disc_by_item.get(item.id)

            # ✅ Determinar counted_qty usando ciclos (prioridade) com fallback legado
            c1 = float(item.count_cycle_1) if item.count_cycle_1 is not None else None
            c2 = float(item.count_cycle_2) if item.count_cycle_2 is not None else None
            c3 = float(item.count_cycle_3) if item.count_cycle_3 is not None else None

            if c1 is not None or c2 is not None or c3 is not None:
                counted_items += 1

            if discrepancy and discrepancy.variance_quantity != 0:
                items_with_discrepancy += 1

            # 📸 v2.10.0: Usar custo médio do SNAPSHOT (congelado)
            expected_qty = float(item.expected_quantity) if item.expected_quantity else 0

            # ✅ Quantidade contada: prioridade ciclo 3 > 2 > 1 > Counting legado
            if c3 is not None:
                counted_qty = c3
            elif c2 is not None:
                counted_qty = c2
            elif c1 is not None:
                counted_qty = c1
            elif countings:
                counted_qty = float(countings[-1][0].quantity)
            else:
                counted_qty = 0

            # Prioridade: 1) Custo do snapshot, 2) Fallback para 0.0
            unit_price = float(snapshot.b2_cm1) if snapshot and snapshot.b2_cm1 else 0.0

            total_expected_value += expected_qty * unit_price
            total_counted_value += counted_qty * unit_price

            # ✅ v2.19.8: Acumular quantidades físicas e detectar custo zero
            total_expected_qty += expected_qty
            total_counted_qty += counted_qty
            has_divergence = abs(counted_qty - expected_qty) >= 0.01
            if unit_price == 0 and has_divergence:
                products_with_zero_cost += 1
            
            # ✅ v2.15.7.6: Buscar lotes do snapshot (quantidade esperada por lote)
            snapshot_lots = []
            if product.b1_rastro == 'L':
                lot_snapshots = db.query(InventoryLotSnapshot).filter(
                    InventoryLotSnapshot.inventory_item_id == item.id
                ).all()

                for lot_snap in lot_snapshots:
                    snapshot_lots.append({
                        "lot_number": lot_snap.b8_lotectl,
                        "b8_lotectl": lot_snap.b8_lotectl,  # ✅ v2.17.1: Lote cliente
                        "b8_lotefor": lot_snap.b8_lotefor if hasattr(lot_snap, 'b8_lotefor') and lot_snap.b8_lotefor else "",  # ✅ v2.17.1: Lote fornecedor
                        "quantity": float(lot_snap.b8_saldo) if lot_snap.b8_saldo else 0.0
                    })

            # 🔄 v2.17.1: BUSCAR LOTES DOS DRAFTS (para produtos com saldo=0 que foram contados)
            from sqlalchemy import text
            saved_lots_list = []
            if product.b1_rastro == 'L':
                try:
                    # Usar savepoint para não corromper transação se tabela não existir
                    nested = db.begin_nested()
                    try:
                        draft_query = text("""
                            SELECT draft_data
                            FROM inventario.lot_counting_drafts
                            WHERE inventory_item_id = :item_id
                              AND current_cycle = :cycle
                            LIMIT 1
                        """)
                        draft_result = db.execute(draft_query, {
                            'item_id': str(item.id),
                            'cycle': inventory.current_cycle
                        }).fetchone()
                        nested.commit()
                    except Exception:
                        nested.rollback()
                        draft_result = None

                    if draft_result and draft_result[0]:
                        draft_data = draft_result[0]
                        lots_data = draft_data.get('lots', [])
                        for lot in lots_data:
                            saved_lots_list.append({
                                "lot_number": lot.get('lot_number') or lot.get('b8_lotectl'),
                                "quantity": float(lot.get('system_qty', 0)),
                                "counted_qty": float(lot.get('counted_qty', 0)),
                                "b8_lotefor": lot.get('b8_lotefor', '')
                            })
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao buscar drafts para item {item.id}: {e}")

            # Preparar dados do item
            item_data = {
                "sequence": item.sequence,
                "product_code": product.b1_cod,
                "product_name": product.b1_desc,
                "unit": product.b1_um,
                "group": product.b1_grupo,
                "category": product.b1_xcatgor,
                "has_lot": product.b1_rastro == 'L',
                "expected_quantity": expected_qty,
                "counted_quantity": counted_qty,
                "variance": counted_qty - expected_qty,
                "b2_xentpos": float(snapshot.b2_xentpos) if snapshot and snapshot.b2_xentpos else 0.0,  # ✅ v2.17.0
                "status": item.status.value,
                # 📸 v2.10.0: Adicionar custo unitário do snapshot
                "unit_price": unit_price,
                "expected_value": expected_qty * unit_price,
                "counted_value": counted_qty * unit_price,
                "variance_value": (counted_qty - expected_qty) * unit_price,
                "countings": [],
                "discrepancy": None,
                "last_counted_at": item.last_counted_at.isoformat() if item.last_counted_at else None,
                # 📸 v2.10.0: Indicar se usa snapshot ou fallback
                "has_snapshot_cost": snapshot is not None and snapshot.b2_cm1 is not None,
                # ✅ v2.15.7.6: Adicionar lotes do snapshot (dados congelados)
                "snapshot_lots": snapshot_lots,
                # 🔄 v2.17.1: Adicionar lotes dos drafts (para produtos com saldo=0)
                "saved_lots": saved_lots_list,
                # ✅ Lotes contados extraídos dos countings (fonte real de dados por lote)
                "counted_lots": [],
                # ✅ Contagens por ciclo (para relatório de divergências no frontend)
                "count_cycle_1": c1,
                "count_cycle_2": c2,
                "count_cycle_3": c3,
            }

            # ✅ Construir counted_lots a partir dos countings (agrupado por lote, ciclo mais alto)
            if product.b1_rastro == 'L' and countings:
                lots_by_number = {}
                for counting, user in countings:
                    lot_num = counting.lot_number
                    if lot_num:
                        cycle = counting.count_number or 1
                        existing = lots_by_number.get(lot_num)
                        if not existing or cycle > existing['cycle']:
                            lots_by_number[lot_num] = {
                                "lot_number": lot_num,
                                "counted_qty": float(counting.quantity) if counting.quantity else 0,
                                "cycle": cycle,
                            }
                item_data["counted_lots"] = list(lots_by_number.values())

            # Adicionar contagens
            for counting, user in countings:
                item_data["countings"].append({
                    "count_number": counting.count_number,
                    "quantity": float(counting.quantity),
                    "lot_number": counting.lot_number,
                    "serial_number": counting.serial_number,
                    "observation": counting.observation,
                    "counted_by": user.full_name if user else "Desconhecido",
                    "counted_at": counting.created_at.isoformat()
                })
            
            # Adicionar divergência
            if discrepancy:
                item_data["discrepancy"] = {
                    "variance_quantity": discrepancy.variance_quantity,
                    "variance_percentage": discrepancy.variance_percentage,
                    "tolerance_exceeded": discrepancy.tolerance_exceeded,
                    "status": discrepancy.status,
                    "resolution": discrepancy.resolution
                }
            
            report_items.append(item_data)
        
        # Calcular estatísticas finais
        completion_percentage = (counted_items / total_items * 100) if total_items > 0 else 0
        variance_value = total_counted_value - total_expected_value
        variance_percentage = (variance_value / total_expected_value * 100) if total_expected_value > 0 else 0
        # ✅ v2.19.8: Variação física
        qty_variance = total_counted_qty - total_expected_qty

        return {
            "inventory": {
                "id": inventory_id,
                "name": inventory.name,
                "description": inventory.description,
                "warehouse": inventory.warehouse,  # ✅ ADICIONADO: Código do armazém
                "reference_date": inventory.reference_date.isoformat(),
                "count_deadline": inventory.count_deadline.isoformat() if inventory.count_deadline else None,
                "status": inventory.status.value,
                "created_at": inventory.created_at.isoformat()
            },
            "summary": {
                "total_items": total_items,
                "counted_items": counted_items,
                "pending_items": total_items - counted_items,
                "items_with_discrepancy": items_with_discrepancy,
                "completion_percentage": round(completion_percentage, 2),
                "total_expected_value": round(total_expected_value, 2),
                "total_counted_value": round(total_counted_value, 2),
                "variance_value": round(variance_value, 2),
                "variance_percentage": round(variance_percentage, 2),
                # ✅ v2.19.8: Variação física (unidades)
                "total_expected_qty": round(total_expected_qty, 2),
                "total_counted_qty": round(total_counted_qty, 2),
                "qty_variance": round(qty_variance, 2),
                "products_with_zero_cost": products_with_zero_cost
            },
            "items": report_items,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": current_user.full_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao gerar relatório: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao gerar relatório"))

@app.get("/api/v1/reports/inventory-summary", tags=["Reports"])
async def get_inventory_summary_report(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Relatório resumo de todos os inventários da loja"""
    try:
        from app.models.models import InventoryList, InventoryItem, Counting, Discrepancy
        from sqlalchemy import func
        
        # Buscar inventários da loja
        inventories = db.query(InventoryList).filter(
            InventoryList.store_id == current_user.store_id
        ).order_by(InventoryList.created_at.desc()).all()
        
        summary_data = []
        
        for inventory in inventories:
            # Contar itens
            total_items = db.query(InventoryItem).filter(
                InventoryItem.inventory_list_id == inventory.id
            ).count()
            
            # Contar itens contados
            counted_items = db.query(InventoryItem).filter(
                InventoryItem.inventory_list_id == inventory.id,
                InventoryItem.status == "COUNTED"
            ).count()
            
            # Contar divergências
            discrepancies = db.query(Discrepancy).join(
                InventoryItem, Discrepancy.inventory_item_id == InventoryItem.id
            ).filter(
                InventoryItem.inventory_list_id == inventory.id
            ).count()
            
            summary_data.append({
                "inventory_id": str(inventory.id),
                "name": inventory.name,
                "status": inventory.status.value,
                "total_items": total_items,
                "counted_items": counted_items,
                "pending_items": total_items - counted_items,
                "discrepancies_count": discrepancies,
                "completion_percentage": round((counted_items / total_items * 100) if total_items > 0 else 0, 2),
                "created_at": inventory.created_at.isoformat(),
                "reference_date": inventory.reference_date.isoformat()
            })
        
        return {
            "store_id": str(current_user.store_id),
            "inventories": summary_data,
            "total_inventories": len(summary_data),
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao gerar resumo de inventários: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao gerar resumo"))

# =================================
# REGISTRAR ROUTERS
# =================================

# Incluir routers
# Auth router (primeiro para ter prioridade nas rotas)
if auth_router:
    try:
        app.include_router(auth_router, tags=["authentication"])
        logger.info("✅ Router de autenticação registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de autenticação: {e}")

try:
    app.include_router(import_router, prefix="/api/v1")
    logger.info("✅ Router de importação registrado")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de importação: {e}")

# ✅ NOVO v2.14.0: Router de sincronização com API Protheus
if sync_protheus_router:
    try:
        app.include_router(sync_protheus_router, prefix="/api/v1/sync/protheus", tags=["sync-protheus"])
        logger.info("✅ Router de sincronização Protheus registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de sincronização Protheus: {e}")
else:
    logger.warning("⚠️ Router de sincronização Protheus não disponível")

# ✅ NOVO v2.18.3: Router de sincronização de produtos (cache)
if sync_products_router:
    try:
        app.include_router(sync_products_router, prefix="/api/v1/sync/protheus", tags=["sync-products"])
        logger.info("✅ Router de sincronização de produtos registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de sincronização de produtos: {e}")
else:
    logger.warning("⚠️ Router de sincronização de produtos não disponível")

# ✅ NOVO v2.19.0: Router de integração com Protheus
if integration_protheus_router:
    try:
        app.include_router(integration_protheus_router, prefix="/api/v1/integration/protheus", tags=["integration-protheus"])
        logger.info("✅ Router de integração Protheus registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de integração Protheus: {e}")
else:
    logger.warning("⚠️ Router de integração Protheus não disponível")

# ✅ NOVO: Router de envio para Protheus
if send_protheus_router:
    try:
        app.include_router(send_protheus_router, prefix="/api/v1/integration/protheus", tags=["send-protheus"])
        logger.info("✅ Router de envio Protheus registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de envio Protheus: {e}")
else:
    logger.warning("⚠️ Router de envio Protheus não disponível")

# ✅ NOVO v2.16.0: Router de monitoramento e alertas
if monitoring_router:
    try:
        app.include_router(monitoring_router, prefix="/api/v1/monitoring", tags=["monitoring"])
        logger.info("✅ Router de monitoramento e alertas registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de monitoramento: {e}")
else:
    logger.warning("⚠️ Router de monitoramento não disponível")

# ✅ NOVO v2.16.0: Router de validação cruzada
if validation_router:
    try:
        app.include_router(validation_router, prefix="/api/v1/validation", tags=["validation"])
        logger.info("✅ Router de validação cruzada registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de validação: {e}")
else:
    logger.warning("⚠️ Router de validação não disponível")

# ✅ LIMPEZA: Removidos registros de routers não existentes (sb1010, sbm010, szd010, sze010)

if users_router:
    try:
        app.include_router(users_router, prefix="/api/v1", tags=["users"])
        logger.info("✅ Router de usuários registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de usuários: {e}")
else:
    logger.warning("⚠️ Router de usuários não disponível")

# ✅ ENDPOINT: Reverter criação de lista específica (sistema MULTILISTA)
@app.post("/api/v1/counting-lists/{list_id}/delete", tags=["Counting Lists"])
async def delete_multilista_counting_list(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reverter processo de criação de lista (sistema MULTILISTA)

    Este endpoint faz exatamente o INVERSO do processo de criação:
    1. Remove itens da counting_list_items
    2. Remove assignments relacionados
    3. Remove lista da counting_lists
    4. Atualiza contador de produtos disponíveis
    """
    try:
        # 1. Verificar se lista existe
        from app.models.models import CountingList, CountingListItem, CountingAssignment, InventoryItem
        counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
        if not counting_list:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de contagem não encontrada"
            )

        # 2. Verificar permissões (ADMIN ou SUPERVISOR da própria lista)
        if current_user.role not in ["ADMIN", "SUPERVISOR"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas ADMIN ou SUPERVISOR pode excluir listas"
            )

        # 3. Se é SUPERVISOR, só pode excluir suas próprias listas
        if current_user.role == "SUPERVISOR" and counting_list.counter_cycle_1 != current_user.id:
            logger.warning(f"Permissão negada: counter_cycle_1={counting_list.counter_cycle_1}, user_id={current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPERVISOR só pode excluir suas próprias listas"
            )

        # 3. Verificar se pode excluir (apenas status ABERTA/PREPARACAO)
        if counting_list.list_status not in ['ABERTA', 'PREPARACAO']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lista não pode ser excluída. Status atual: {counting_list.list_status}"
            )

        # 4. REVERTER CRIAÇÃO: Primeiro buscar produtos que estavam na lista (ANTES de excluir)
        products_to_free = db.query(InventoryItem).join(CountingListItem).filter(
            CountingListItem.counting_list_id == list_id
        ).all()

        # 5. REVERTER CRIAÇÃO: Remover itens da lista
        deleted_items = db.query(CountingListItem).filter(
            CountingListItem.counting_list_id == list_id
        ).delete()

        # Remover apenas assignments do usuário específico
        deleted_assignments = db.query(CountingAssignment).filter(
            and_(
                CountingAssignment.assigned_to == counting_list.counter_cycle_1,
                CountingAssignment.inventory_item_id.in_([p.id for p in products_to_free])
            )
        ).delete(synchronize_session=False)

        # 6. REVERTER CRIAÇÃO: Liberar produtos específicos (apenas os que estavam na lista)
        # Nota: Não altera outros produtos do inventário, apenas os da lista excluída
        products_freed = 0
        for product in products_to_free:
            # Reverter apenas se produto ainda está no estado correto
            if product.status in ['PENDING', 'ASSIGNED', 'IN_PROGRESS']:
                product.last_counted_by = None
                product.last_counted_at = None
                # IMPORTANTE: Marcar produto como disponível para nova atribuição
                product.is_available_for_assignment = True
                products_freed += 1

        # 6. REVERTER CRIAÇÃO: Remover lista
        user_name = None
        if counting_list.counter_cycle_1:
            user = db.query(User).filter(User.id == counting_list.counter_cycle_1).first()
            user_name = user.username if user else "Usuário"

        db.delete(counting_list)
        db.commit()

        logger.info(f"✅ Lista MULTILISTA excluída: {list_id}, itens: {deleted_items}, assignments: {deleted_assignments}, produtos liberados: {products_freed}")

        return {
            "success": True,
            "message": f"Lista {user_name or 'do usuário'} excluída com sucesso. {deleted_items} itens removidos, {deleted_assignments} atribuições removidas, {products_freed} produtos liberados.",
            "details": {
                "list_id": list_id,
                "items_removed": deleted_items,
                "assignments_removed": deleted_assignments,
                "products_freed": products_freed
            }
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao excluir lista MULTILISTA {list_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "interno ao excluir lista")
        )

# ✅ LIMPEZA: Removido registro de counting_lists_router (não existe)

if assignments_router:
    try:
        app.include_router(assignments_router, prefix="/api/v1/assignments", tags=["assignments"])
        logger.info("✅ Router de assignments registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de assignments: {e}")
else:
    logger.warning("⚠️ Router de assignments não disponível")

# Registrar o novo router de controle de ciclos
if cycle_control_router:
    try:
        app.include_router(cycle_control_router, prefix="/api/v1/cycles", tags=["cycle-control"])
        logger.info("✅ Router de cycle_control registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de cycle_control: {e}")
else:
    logger.warning("⚠️ Router de cycle_control não disponível")

# Registrar o router de contagem teste
if counting_test_router:
    try:
        app.include_router(counting_test_router, prefix="/api/v1", tags=["counting-test"])
        logger.info("✅ Router de counting_test registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de counting_test: {e}")
else:
    logger.warning("⚠️ Router de counting_test não disponível")

if stores_router:
    try:
        app.include_router(stores_router, prefix="/api/v1/stores", tags=["stores"])
        logger.info("✅ Router de lojas registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de lojas: {e}")
else:
    logger.warning("⚠️ Router de lojas não disponível")

# Incluir router de rascunhos de lotes
if lot_draft_router:
    try:
        app.include_router(lot_draft_router, prefix="/api/v1/lot-draft", tags=["lot-draft"])
        logger.info("✅ Router de rascunhos de lotes registrado")
    except Exception as e:
        logger.error(f"❌ Erro ao registrar router de lot_draft: {e}")
else:
    logger.warning("⚠️ Router de lot_draft não disponível")


@app.get("/api/v1/products/filter", tags=["Products"])
async def filter_products_by_range(  # 🔥 RENOMEADO para evitar conflito com linha 1526
    inventory_id: str = Query(None, description="ID do Inventário (para determinar armazém)"),
    grupo_from: str = Query(None, description="Grupo DE"),
    grupo_to: str = Query(None, description="Grupo ATÉ"),
    categoria_from: str = Query(None, description="Categoria DE"),
    categoria_to: str = Query(None, description="Categoria ATÉ"),
    subcategoria_from: str = Query(None, description="Subcategoria DE"),
    subcategoria_to: str = Query(None, description="Subcategoria ATÉ"),
    segmento_from: str = Query(None, description="Segmento DE"),
    segmento_to: str = Query(None, description="Segmento ATÉ"),
    grupoinv_from: str = Query(None, description="Grupo Inventário DE"),
    grupoinv_to: str = Query(None, description="Grupo Inventário ATÉ"),
    local: str = Query(None, description="Local específico (sobrescreve armazém do inventário)"),
    local1_from: str = Query(None, description="Localização 1 DE"),
    local1_to: str = Query(None, description="Localização 1 ATÉ"),
    local2_from: str = Query(None, description="Localização 2 DE"),
    local2_to: str = Query(None, description="Localização 2 ATÉ"),
    local3_from: str = Query(None, description="Localização 3 DE"),
    local3_to: str = Query(None, description="Localização 3 ATÉ"),
    limit: int = Query(50, description="Limite de produtos por página"),
    offset: int = Query(0, description="Offset para paginação"),
    db: Session = Depends(get_db)
):
    """Filtrar produtos para adição ao inventário usando filtros de faixa"""
    try:
        from app.models.models import SB1010, SB2010, SBZ010, InventoryList
        
        # 🎯 BUSCAR ARMAZÉM DO INVENTÁRIO
        inventory_warehouse = None
        if inventory_id:
            inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
            if inventory:
                inventory_warehouse = inventory.warehouse
                logger.info(f"🏭 Inventory {inventory_id} warehouse: {inventory_warehouse}")
            else:
                logger.warning(f"❌ Inventário {inventory_id} não encontrado")
        
        # Determinar armazém a ser usado (prioridade: local > inventory_warehouse > '02')
        target_warehouse = local or inventory_warehouse or '02'
        logger.info(f"🎯 Filtrando produtos para armazém: {target_warehouse}")
        
        # 🔄 SOLUÇÃO: listar TODOS produtos do armazém (com ou sem saldo)
        from sqlalchemy import text
        
        # Construir cláusulas WHERE para filtros
        where_clauses = []
        
        # Filtro principal: produtos que tenham registro no armazém específico
        # Simplificado: se tem registro na SB2 para este armazém, deve aparecer
        where_clauses.append(f"sb2.b2_local = '{target_warehouse}'")
        
        # Aplicar filtros de faixa (DE/ATÉ)
        if grupo_from and grupo_to:
            where_clauses.append(f"sb1.b1_grupo BETWEEN '{grupo_from}' AND '{grupo_to}'")
        elif grupo_from:
            where_clauses.append(f"sb1.b1_grupo >= '{grupo_from}'")
        elif grupo_to:
            where_clauses.append(f"sb1.b1_grupo <= '{grupo_to}'")
            
        if categoria_from and categoria_to:
            where_clauses.append(f"sb1.b1_xcatgor BETWEEN '{categoria_from}' AND '{categoria_to}'")
        elif categoria_from:
            where_clauses.append(f"sb1.b1_xcatgor >= '{categoria_from}'")
        elif categoria_to:
            where_clauses.append(f"sb1.b1_xcatgor <= '{categoria_to}'")
            
        if subcategoria_from and subcategoria_to:
            where_clauses.append(f"sb1.b1_xsubcat BETWEEN '{subcategoria_from}' AND '{subcategoria_to}'")
        elif subcategoria_from:
            where_clauses.append(f"sb1.b1_xsubcat >= '{subcategoria_from}'")
        elif subcategoria_to:
            where_clauses.append(f"sb1.b1_xsubcat <= '{subcategoria_to}'")
            
        if segmento_from and segmento_to:
            where_clauses.append(f"sb1.b1_xsegmen BETWEEN '{segmento_from}' AND '{segmento_to}'")
        elif segmento_from:
            where_clauses.append(f"sb1.b1_xsegmen >= '{segmento_from}'")
        elif segmento_to:
            where_clauses.append(f"sb1.b1_xsegmen <= '{segmento_to}'")
            
        if grupoinv_from and grupoinv_to:
            where_clauses.append(f"sb1.b1_xgrinve BETWEEN '{grupoinv_from}' AND '{grupoinv_to}'")
        elif grupoinv_from:
            where_clauses.append(f"sb1.b1_xgrinve >= '{grupoinv_from}'")
        elif grupoinv_to:
            where_clauses.append(f"sb1.b1_xgrinve <= '{grupoinv_to}'")
        
        # Construir WHERE final
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        # Primeiro, contar total de produtos para paginação
        # INNER JOIN com SB2010 para pegar APENAS produtos que têm registro neste armazém
        # EXCLUIR produtos já em inventários ativos (DRAFT ou IN_PROGRESS) no mesmo armazém
        sql_count = f"""
        SELECT COUNT(DISTINCT sb2.b2_cod)
        FROM inventario.sb2010 sb2
        INNER JOIN inventario.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sb2.b2_cod)
        LEFT JOIN inventario.inventory_items ii ON TRIM(sb2.b2_cod) = TRIM(ii.product_code)
        LEFT JOIN inventario.inventory_lists il ON ii.inventory_list_id = il.id 
            AND il.status IN ('DRAFT', 'IN_PROGRESS')
            AND il.warehouse = '{target_warehouse}'
        WHERE {where_sql}
          AND ii.id IS NULL  -- Excluir produtos já em inventários ativos do mesmo armazém
        """
        
        total_result = db.execute(text(sql_count))
        total_count = total_result.scalar()
        
        logger.info(f"🔍 Total de produtos disponíveis para armazém {target_warehouse}: {total_count} (excluindo inventários ativos)")
        logger.info(f"🔍 Filtros aplicados: grupo={grupo_from}-{grupo_to}, categoria={categoria_from}-{categoria_to}")
        
        # Query com paginação - pegar produtos que têm registro no armazém
        # EXCLUIR produtos já em inventários ativos do mesmo armazém
        sql_products = f"""
        SELECT DISTINCT ON (sb2.b2_cod) 
               sb2.b2_cod as b1_cod, 
               COALESCE(sb1.b1_desc, 'PRODUTO SEM CADASTRO') as b1_desc, 
               COALESCE(sb1.b1_tipo, 'ME') as b1_tipo, 
               COALESCE(sb1.b1_um, 'UN') as b1_um, 
               sb2.b2_local,  -- ⚠️ CONCEITO DO ARMAZÉM: B2_LOCAL (não confundir com B1_LOCPAD)
               COALESCE(sb1.b1_grupo, '') as b1_grupo, 
               COALESCE(sb1.b1_xcatgor, '') as b1_xcatgor, 
               COALESCE(sb1.b1_xsubcat, '') as b1_xsubcat, 
               COALESCE(sb1.b1_xsegmen, '') as b1_xsegmen, 
               COALESCE(sb1.b1_xgrinve, '') as b1_xgrinve,
               COALESCE(sb1.b1_rastro, 'N') as b1_rastro,
               sb2.b2_qatu,
               COALESCE(sb2.b2_xentpos, 0) as b2_xentpos
        FROM inventario.sb2010 sb2
        LEFT JOIN inventario.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sb2.b2_cod)
        LEFT JOIN inventario.inventory_items ii ON TRIM(sb2.b2_cod) = TRIM(ii.product_code)
        LEFT JOIN inventario.inventory_lists il ON ii.inventory_list_id = il.id 
            AND il.status IN ('DRAFT', 'IN_PROGRESS')
            AND il.warehouse = '{target_warehouse}'
        WHERE {where_sql}
          AND ii.id IS NULL  -- Excluir produtos já em inventários ativos do mesmo armazém
        ORDER BY sb2.b2_cod
        LIMIT {limit} OFFSET {offset}
        """
        
        result = db.execute(text(sql_products))
        raw_products = result.fetchall()
        
        logger.info(f"🔍 Produtos retornados pela query: {len(raw_products)}")
        
        # Converter resultado para objetos simulando SB1010
        class ProductResult:
            def __init__(self, row):
                self.b1_cod = row.b1_cod
                self.b1_desc = row.b1_desc
                self.b1_tipo = row.b1_tipo
                self.b1_um = row.b1_um
                self.b1_locpad = row.b2_local
                self.b1_grupo = row.b1_grupo
                self.b1_xcatgor = row.b1_xcatgor
                self.b1_xsubcat = row.b1_xsubcat
                self.b1_xsegmen = row.b1_xsegmen
                self.b1_xgrinve = row.b1_xgrinve
                self.b1_rastro = row.b1_rastro
                self.b2_qatu = row.b2_qatu
                self.b2_xentpos = row.b2_xentpos if hasattr(row, 'b2_xentpos') else 0
        
        products = [ProductResult(row) for row in raw_products]
        
        # Converter para lista de dicionários incluindo dados de localização
        products_list = []
        for product in products:
            # Buscar dados de localização da SBZ010
            location_data = db.query(SBZ010).filter(SBZ010.bz_cod == product.b1_cod).first()
            
            products_list.append({
                # Campos SB1010 (catálogo)
                "b1_cod": product.b1_cod,
                "b1_desc": product.b1_desc,
                "b1_tipo": product.b1_tipo,
                "b1_um": product.b1_um,
                "b1_locpad": product.b1_locpad,
                "b1_grupo": product.b1_grupo,
                "b1_xcatgor": product.b1_xcatgor,
                "b1_xsubcat": product.b1_xsubcat,
                "b1_xsegmen": product.b1_xsegmen,
                "b1_xgrinve": product.b1_xgrinve,
                "b1_rastro": product.b1_rastro,
                
                # 🔄 CAMPOS SB2010 (estoque) - já incluídos na SQL
                "b2_qatu": float(product.b2_qatu),
                "b2_xentpos": float(product.b2_xentpos) if hasattr(product, 'b2_xentpos') and product.b2_xentpos else 0.0,
                "current_quantity": float(product.b2_qatu),

                # 🔄 CAMPOS SBZ010 (localização)
                "local1": location_data.bz_xlocal1 if location_data else None,
                "local2": location_data.bz_xlocal2 if location_data else None,
                "local3": location_data.bz_xlocal3 if location_data else None,
                
                # Campos auxiliares
                "has_lot": product.b1_rastro == 'L',  # Se rastro = 'L', controla lote
                "lot_number": None  # Será definido quando adicionado ao inventário
            })
        
        return {
            "products": products_list,
            "total": len(products_list),
            "total_count": total_count,
            "page": offset // limit + 1,
            "total_pages": (total_count + limit - 1) // limit,
            "limit": limit,
            "offset": offset,
            "filters_applied": {
                "grupo": f"{grupo_from or ''} - {grupo_to or ''}" if grupo_from or grupo_to else None,
                "categoria": f"{categoria_from or ''} - {categoria_to or ''}" if categoria_from or categoria_to else None,
                "subcategoria": f"{subcategoria_from or ''} - {subcategoria_to or ''}" if subcategoria_from or subcategoria_to else None,
                "segmento": f"{segmento_from or ''} - {segmento_to or ''}" if segmento_from or segmento_to else None,
                "grupoinv": f"{grupoinv_from or ''} - {grupoinv_to or ''}" if grupoinv_from or grupoinv_to else None,
                "local": local,
                "local1": f"{local1_from or ''} - {local1_to or ''}" if local1_from or local1_to else None,
                "local2": f"{local2_from or ''} - {local2_to or ''}" if local2_from or local2_to else None,
                "local3": f"{local3_from or ''} - {local3_to or ''}" if local3_from or local3_to else None,
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao filtrar produtos: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao filtrar produtos"))

@app.get("/api/v1/products/filters", tags=["Products"])
async def get_product_filters(
    filial: str = Query(None, description="Código da filial para filtrar armazéns"),
    db: Session = Depends(get_db)
):
    """Obter filtros disponíveis - OTIMIZADO sem JOINs pesados"""
    try:
        from app.models.models import SB1010, SBM010, SZD010, SZE010, SZB010
        from sqlalchemy import distinct

        # ✅ OTIMIZADO: Buscar direto das tabelas de lookup (sem JOIN com SB1010 de 117k registros)
        # Grupos disponíveis (SBM010: ~206 registros)
        grupos = db.query(SBM010.bm_grupo, SBM010.bm_desc).filter(
            SBM010.bm_grupo.isnot(None),
            SBM010.bm_grupo != ''
        ).order_by(SBM010.bm_desc).all()

        # Categorias disponíveis (SZD010: ~760 registros)
        categorias = db.query(SZD010.zd_xcod, SZD010.zd_xdesc).filter(
            SZD010.zd_xcod.isnot(None),
            SZD010.zd_xcod != ''
        ).order_by(SZD010.zd_xdesc).all()

        # Subcategorias disponíveis (SZE010: ~501 registros)
        subcategorias = db.query(SZE010.ze_xcod, SZE010.ze_xdesc).filter(
            SZE010.ze_xcod.isnot(None),
            SZE010.ze_xcod != ''
        ).order_by(SZE010.ze_xdesc).all()

        # ✅ v2.19.11: Buscar armazéns APENAS se filial for especificada
        armazens = []
        if filial:
            # Padronizar para 2 caracteres (formato da SZB010.zb_filial)
            filial_padded = filial.strip().zfill(2)[-2:]  # Pega os últimos 2 chars
            logger.info(f"🔍 [FILTROS] Buscando armazéns para filial: '{filial}' -> '{filial_padded}'")

            armazens = db.query(SZB010.zb_xlocal, SZB010.zb_xdesc).filter(
                SZB010.zb_filial == filial_padded
            ).order_by(SZB010.zb_xlocal).all()

            logger.info(f"✅ [FILTROS] Encontrados {len(armazens)} armazéns para filial {filial_padded}")

        # Segmentos disponíveis (SZF010 - tabela de lookup)
        from app.models.models import SZF010
        segmentos = db.query(SZF010.zf_xcod, SZF010.zf_xdesc).filter(
            SZF010.zf_xcod.isnot(None),
            SZF010.zf_xcod != ''
        ).order_by(SZF010.zf_xdesc).all()

        return {
            "grupos": [{"codigo": g.bm_grupo.strip() if g.bm_grupo else "", "descricao": g.bm_desc.strip() if g.bm_desc else ""} for g in grupos],
            "categorias": [{"codigo": c.zd_xcod.strip() if c.zd_xcod else "", "descricao": c.zd_xdesc.strip() if c.zd_xdesc else ""} for c in categorias],
            "subcategorias": [{"codigo": s.ze_xcod.strip() if s.ze_xcod else "", "descricao": s.ze_xdesc.strip() if s.ze_xdesc else ""} for s in subcategorias],
            "armazens": [{"codigo": a.zb_xlocal.strip(), "descricao": a.zb_xdesc.strip()} for a in armazens],
            "segmentos": [{"codigo": s.zf_xcod.strip() if s.zf_xcod else "", "descricao": s.zf_xdesc.strip() if s.zf_xdesc else ""} for s in segmentos]
        }

    except Exception as e:
        logger.error(f"❌ Erro ao buscar filtros: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar filtros"))

@app.get("/api/v1/products/statistics", tags=["Products"])
async def get_product_statistics(db: Session = Depends(get_db)):
    """Obter estatísticas dos produtos para os cards do dashboard"""
    try:
        from app.models.models import SB1010, SB2010, SZD010
        from sqlalchemy import func, distinct
        
        # Total de produtos
        total_produtos = db.query(func.count(SB1010.b1_cod)).scalar() or 0
        
        # Total de categorias distintas
        total_categorias = db.query(func.count(distinct(SB1010.b1_xcatgor))).filter(
            SB1010.b1_xcatgor.isnot(None),
            SB1010.b1_xcatgor != ''
        ).scalar() or 0
        
        # Produtos com estoque (quantidade > 0)
        produtos_com_estoque = db.query(func.count(distinct(SB2010.b2_cod))).filter(
            SB2010.b2_qatu > 0
        ).scalar() or 0
        
        # Valor total em estoque (quantidade * custo médio)
        valor_total_result = db.query(
            func.sum(SB2010.b2_qatu * SB2010.b2_cm1)
        ).filter(
            SB2010.b2_qatu > 0,
            SB2010.b2_cm1 > 0
        ).scalar()
        
        valor_total_estoque = float(valor_total_result) if valor_total_result else 0.0
        
        return {
            "total_produtos": total_produtos,
            "total_categorias": total_categorias,
            "produtos_com_estoque": produtos_com_estoque,
            "valor_total_estoque": valor_total_estoque
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar estatísticas: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar estatísticas"))

@app.get("/api/v1/products/", tags=["Products"])
async def list_products(
    page: int = Query(1, ge=1, description="Número da página"),
    limit: int = Query(20, ge=1, le=100, description="Itens por página"),
    search: str = Query(None, description="Buscar por código ou descrição"),
    categoria: str = Query(None, description="Filtrar por categoria"),
    subcategoria: str = Query(None, description="Filtrar por subcategoria"),
    armazem: str = Query(None, description="Filtrar por armazém (local)"),
    filial: str = Query(None, description="Filtrar por filial"),
    grupo: str = Query(None, description="Filtrar por grupo"),
    segmento: str = Query(None, description="Filtrar por segmento"),
    db: Session = Depends(get_db)
):
    """Listar produtos com paginação e filtros"""
    try:
        from app.models.models import SB1010, SB2010, SBM010, SZD010, SZE010, SZF010
        from sqlalchemy import func, or_, and_

        # Calcular offset
        offset = (page - 1) * limit

        # ✅ v2.19.11: Base query com filtro de armazém
        # Se filtro de armazém, fazer INNER JOIN com SB2010 filtrado
        if armazem:
            # Subquery para produtos que existem no armazém específico
            sb2_filter = and_(
                SB1010.b1_cod == SB2010.b2_cod,
                func.trim(SB2010.b2_local) == armazem.strip()
            )
            if filial:
                sb2_filter = and_(sb2_filter, SB2010.b2_filial == filial)

            query = db.query(
                SB1010.b1_cod.label('code'),
                SB1010.b1_desc.label('description'),
                SB1010.b1_grupo.label('grupo'),
                SBM010.bm_desc.label('grupo_desc'),
                SB1010.b1_xcatgor.label('categoria'),
                SZD010.zd_xdesc.label('categoria_desc'),
                SB1010.b1_xsubcat.label('subcategoria'),
                SZE010.ze_xdesc.label('subcategoria_desc'),
                SB1010.b1_xsegmen.label('segmento'),
                SZF010.zf_xdesc.label('segmento_desc'),
                SB1010.b1_rastro.label('rastro'),
                func.sum(SB2010.b2_qatu).label('total_stock')
            ).join(
                SB2010, sb2_filter  # INNER JOIN - apenas produtos no armazém
            ).outerjoin(
                SBM010, func.trim(SB1010.b1_grupo) == func.trim(SBM010.bm_grupo)
            ).outerjoin(
                SZD010, func.trim(SB1010.b1_xcatgor) == func.trim(SZD010.zd_xcod)
            ).outerjoin(
                SZE010, func.trim(SB1010.b1_xsubcat) == func.trim(SZE010.ze_xcod)
            ).outerjoin(
                SZF010, func.trim(SB1010.b1_xsegmen) == func.trim(SZF010.zf_xcod)
            )
        else:
            # Query original sem filtro de armazém
            query = db.query(
                SB1010.b1_cod.label('code'),
                SB1010.b1_desc.label('description'),
                SB1010.b1_grupo.label('grupo'),
                SBM010.bm_desc.label('grupo_desc'),
                SB1010.b1_xcatgor.label('categoria'),
                SZD010.zd_xdesc.label('categoria_desc'),
                SB1010.b1_xsubcat.label('subcategoria'),
                SZE010.ze_xdesc.label('subcategoria_desc'),
                SB1010.b1_xsegmen.label('segmento'),
                SZF010.zf_xdesc.label('segmento_desc'),
                SB1010.b1_rastro.label('rastro'),
                func.sum(SB2010.b2_qatu).label('total_stock')
            ).outerjoin(
                SB2010, SB1010.b1_cod == SB2010.b2_cod
            ).outerjoin(
                SBM010, func.trim(SB1010.b1_grupo) == func.trim(SBM010.bm_grupo)
            ).outerjoin(
                SZD010, func.trim(SB1010.b1_xcatgor) == func.trim(SZD010.zd_xcod)
            ).outerjoin(
                SZE010, func.trim(SB1010.b1_xsubcat) == func.trim(SZE010.ze_xcod)
            ).outerjoin(
                SZF010, func.trim(SB1010.b1_xsegmen) == func.trim(SZF010.zf_xcod)
            )

        # Aplicar filtro de busca se fornecido
        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    SB1010.b1_cod.ilike(search_term),
                    SB1010.b1_desc.ilike(search_term)
                )
            )

        # ✅ v2.19.11: Filtro por categoria
        if categoria:
            query = query.filter(func.trim(SB1010.b1_xcatgor) == categoria.strip())

        # ✅ v2.19.11: Filtro por subcategoria
        if subcategoria:
            query = query.filter(func.trim(SB1010.b1_xsubcat) == subcategoria.strip())

        # ✅ v2.19.11: Filtro por grupo
        if grupo:
            query = query.filter(func.trim(SB1010.b1_grupo) == grupo.strip())

        # ✅ v2.19.11: Filtro por segmento
        if segmento:
            query = query.filter(func.trim(SB1010.b1_xsegmen) == segmento.strip())

        # Agrupar por produto
        query = query.group_by(
            SB1010.b1_cod,
            SB1010.b1_desc,
            SB1010.b1_grupo,
            SBM010.bm_desc,
            SB1010.b1_xcatgor,
            SZD010.zd_xdesc,
            SB1010.b1_xsubcat,
            SZE010.ze_xdesc,
            SB1010.b1_xsegmen,
            SZF010.zf_xdesc,
            SB1010.b1_rastro
        )

        # ✅ OTIMIZAÇÃO v2.19.15: Contar total usando subquery (mais rápido que query.count() em grouped query)
        from sqlalchemy import distinct

        # Criar query de contagem separada (sem group_by)
        count_query = db.query(func.count(distinct(SB1010.b1_cod)))

        # Aplicar os mesmos filtros
        if search:
            search_term = f"%{search.strip()}%"
            count_query = count_query.filter(
                or_(
                    SB1010.b1_cod.ilike(search_term),
                    SB1010.b1_desc.ilike(search_term)
                )
            )
        if categoria:
            count_query = count_query.filter(func.trim(SB1010.b1_xcatgor) == categoria.strip())
        if subcategoria:
            count_query = count_query.filter(func.trim(SB1010.b1_xsubcat) == subcategoria.strip())
        if grupo:
            count_query = count_query.filter(func.trim(SB1010.b1_grupo) == grupo.strip())
        if segmento:
            count_query = count_query.filter(func.trim(SB1010.b1_xsegmen) == segmento.strip())
        if armazem:
            # Filtrar por produtos que existem no armazém
            count_query = count_query.join(
                SB2010, and_(
                    SB1010.b1_cod == SB2010.b2_cod,
                    func.trim(SB2010.b2_local) == armazem.strip()
                )
            )
            if filial:
                count_query = count_query.filter(SB2010.b2_filial == filial)

        total = count_query.scalar() or 0

        # Aplicar paginação e executar
        products = query.order_by(SB1010.b1_desc).offset(offset).limit(limit).all()

        # Calcular número de páginas
        pages = (total + limit - 1) // limit if total > 0 else 0

        # Formatar resultado
        products_list = []
        for p in products:
            products_list.append({
                "id": p.code.strip() if p.code else "",
                "b1_cod": p.code.strip() if p.code else "",
                "b1_desc": p.description.strip() if p.description else "",
                "b1_grupo": p.grupo.strip() if p.grupo else "",
                "grupo_desc": p.grupo_desc.strip() if p.grupo_desc else None,
                "b1_xcatgor": p.categoria.strip() if p.categoria else "",
                "categoria_desc": p.categoria_desc.strip() if p.categoria_desc else None,
                "b1_xsubcat": p.subcategoria.strip() if p.subcategoria else "",
                "subcategoria_desc": p.subcategoria_desc.strip() if p.subcategoria_desc else None,
                "b1_xsegmen": p.segmento.strip() if p.segmento else "",
                "segmento_desc": p.segmento_desc.strip() if p.segmento_desc else None,
                "b1_rastro": p.rastro.strip() if p.rastro else "",
                "total_stock": float(p.total_stock) if p.total_stock else 0.0
            })

        return {
            "products": products_list,
            "total": total,
            "page": page,
            "pages": pages,
            "limit": limit
        }

    except Exception as e:
        logger.error(f"❌ Erro ao listar produtos: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao listar produtos"))

@app.get("/api/v1/products/{product_id}", tags=["Products"])
async def get_product_details(product_id: str, db: Session = Depends(get_db)):
    """Obter detalhes completos de um produto - VERSÃO OTIMIZADA"""
    try:
        from app.models.models import SB1010, SLK010, SBZ010, SB2010, SB8010, SBM010, SZD010, SZE010
        from sqlalchemy import func

        # Buscar produto básico primeiro (sem JOINs pesados)
        product = db.query(SB1010).filter(SB1010.b1_cod.like(f"{product_id.strip()}%")).first()

        if not product:
            raise HTTPException(status_code=404, detail="Produto não encontrado")

        # Buscar dados relacionados das outras tabelas de forma otimizada
        product_code = product.b1_cod.strip()

        # Buscar descrição do Grupo (SBM010)
        grupo_info = None
        if product.b1_grupo:
            grupo = db.query(SBM010).filter(func.trim(SBM010.bm_grupo) == product.b1_grupo.strip()).first()
            grupo_info = {"codigo": product.b1_grupo.strip(), "descricao": grupo.bm_desc.strip() if grupo and grupo.bm_desc else None}

        # Buscar descrição da Categoria (SZD010)
        categoria_info = None
        if product.b1_xcatgor:
            categoria = db.query(SZD010).filter(func.trim(SZD010.zd_xcod) == product.b1_xcatgor.strip()).first()
            categoria_info = {"codigo": product.b1_xcatgor.strip(), "descricao": categoria.zd_xdesc.strip() if categoria and categoria.zd_xdesc else None}

        # Buscar descrição da Subcategoria (SZE010)
        subcategoria_info = None
        if product.b1_xsubcat:
            subcategoria = db.query(SZE010).filter(func.trim(SZE010.ze_xcod) == product.b1_xsubcat.strip()).first()
            subcategoria_info = {"codigo": product.b1_xsubcat.strip(), "descricao": subcategoria.ze_xdesc.strip() if subcategoria and subcategoria.ze_xdesc else None}
        
        # Buscar códigos de barras relacionados (SLK010)
        try:
            barcodes = db.query(SLK010).filter(SLK010.slk_produto.like(f"{product_code}%")).limit(10).all()
        except:
            barcodes = []
        
        # Buscar indicadores de produto por filial (SBZ010)  
        try:
            indicadores = db.query(SBZ010).filter(SBZ010.bz_cod.like(f"{product_code}%")).limit(10).all()
        except:
            indicadores = []
        
        # Buscar saldos em estoque (SB2010)
        try:
            saldos_estoque = db.query(SB2010).filter(SB2010.b2_cod.like(f"{product_code}%")).all()
        except:
            saldos_estoque = []
        
        # Buscar saldos por lote (SB8010) - apenas se produto controla lote (B1_RASTRO = 'L')
        saldos_lote = []
        if product.b1_rastro == 'L':
            try:
                saldos_lote = db.query(SB8010).filter(SB8010.b8_produto.like(f"{product_code}%")).all()
            except:
                saldos_lote = []
        
        # Montar resposta detalhada
        product_details = {
            # Informações básicas
            "codigo": product.b1_cod,
            "descricao": product.b1_desc,
            "tipo": product.b1_tipo,
            "unidade": product.b1_um,
            "localizacao_padrao": product.b1_locpad,
            
            # Classificações (com código e descrição)
            "grupo": grupo_info,
            "categoria": categoria_info,
            "subcategoria": subcategoria_info,
            "segmento": {"codigo": product.b1_xsegmen.strip(), "descricao": product.b1_xsegmen.strip()} if product.b1_xsegmen else None,
            "grupo_inventario": {"codigo": product.b1_xgrinve.strip(), "descricao": product.b1_xgrinve.strip()} if product.b1_xgrinve else None,
            
            # Controles
            "controla_lote": product.b1_rastro == 'L',
            "codigo_barras_principal": product.b1_codbar,
            
            # Códigos de barras (SLK010)
            "codigos_barras": [
                {
                    "filial": bc.slk_filial,
                    "codigo": bc.slk_codbar,
                    "produto": bc.slk_produto
                } for bc in barcodes
            ],
            
            # Indicadores por filial (SBZ010)
            "indicadores_filial": [
                {
                    "filial": ind.bz_filial,
                    "codigo": ind.bz_cod,
                    "local": ind.bz_local,
                    "localizacao1": ind.bz_xlocal1,
                    "localizacao2": ind.bz_xlocal2,
                    "localizacao3": ind.bz_xlocal3
                } for ind in indicadores
            ],
            
            # Saldos em estoque (SB2010)
            "saldos_estoque": [
                {
                    "filial": saldo.b2_filial,
                    "codigo": saldo.b2_cod,
                    "local": saldo.b2_local,
                    "quantidade_atual": float(saldo.b2_qatu) if saldo.b2_qatu else 0,
                    "quantidade_empenhada": float(saldo.b2_qemp) if saldo.b2_qemp else 0,
                    "quantidade_reservada": float(saldo.b2_reserva) if saldo.b2_reserva else 0,
                    "quantidade_disponivel": float(saldo.b2_qatu) - float(saldo.b2_qemp) if saldo.b2_qatu and saldo.b2_qemp else 0,
                    "custo_medio": float(saldo.b2_cm1) if saldo.b2_cm1 else 0,
                    "valor_total": float(saldo.b2_vatu1) if saldo.b2_vatu1 else 0,
                    "entradas_pos": float(saldo.b2_xentpos) if saldo.b2_xentpos else 0
                } for saldo in saldos_estoque
            ],
            
            # Saldos por lote (SB8010) - apenas se controla lote
            "saldos_lote": [
                {
                    "filial": lote.b8_filial,
                    "produto": lote.b8_produto,
                    "local": lote.b8_local,
                    "lote": lote.b8_lotectl,
                    "sublote": lote.b8_numlote,
                    "saldo": float(lote.b8_saldo) if lote.b8_saldo else 0,
                    "data_validade": lote.b8_dtvalid if lote.b8_dtvalid else None
                } for lote in saldos_lote
            ],
            
            # Outros campos disponíveis
            "peso_liquido": getattr(product, 'b1_pesoliq', None),
            "peso_bruto": getattr(product, 'b1_pesbru', None),
            "ncm": getattr(product, 'b1_posipi', None),
            "origem": getattr(product, 'b1_origem', None),
            "situacao_tributaria": getattr(product, 'b1_picm', None)
        }
        
        return product_details
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar detalhes do produto {product_id}: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar produto"))

# Incluir router de inventário atualizado (lazy import)
try:
    from app.api.v1.endpoints.inventory import router as inventory_router
    app.include_router(inventory_router, prefix="/api/v1/inventory", tags=["Inventory"])
    logger.info("✅ Router de inventário registrado com sucesso")
except ImportError as ie:
    logger.error(f"❌ Erro ao importar router de inventário: {ie}")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de inventário: {e}")

# 📸 v2.10.0: Incluir router TEMPORÁRIO de lotes (snapshot) - SOLUÇÃO C
# PROBLEMA: inventory_router não registra devido a incompatibilidade Pydantic/SQLAlchemy
# SOLUÇÃO: Router isolado apenas com endpoint crítico /items/{item_id}/lots-snapshot
# DOCUMENTAÇÃO: Ver SESSAO_16_10_2025_BLOQUEADOR_PYDANTIC.md
try:
    from app.api.v1.endpoints.inventory_lots import router as lots_router
    app.include_router(lots_router, prefix="/api/v1/inventory", tags=["Inventory Lots (Snapshot v2.10.0)"])
    logger.info("✅ Router de lotes (snapshot) registrado com sucesso")
except ImportError as ie:
    logger.error(f"❌ Erro ao importar router de lotes: {ie}")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de lotes: {e}")

# 🔄 v2.15.0: Incluir router de comparação de inventários
# FUNCIONALIDADE: Comparar 2 inventários de armazéns diferentes
# OBJETIVO: Identificar divergências cruzadas e sugerir transferências SEM CUSTO
try:
    from app.api.v1.endpoints.inventory_comparison import router as comparison_router
    app.include_router(comparison_router, prefix="/api/v1/inventory", tags=["Inventory Comparison"])
    logger.info("✅ Router de comparação de inventários registrado com sucesso")
except ImportError as ie:
    logger.error(f"❌ Erro ao importar router de comparação: {ie}")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de comparação: {e}")

# Incluir router de armazéns
try:
    from app.api.v1.endpoints.warehouses import router as warehouses_router
    app.include_router(warehouses_router, prefix="/api/v1", tags=["Warehouses"])
    logger.info("✅ Router de armazéns registrado")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de armazéns: {e}")

# Incluir router de importação SZB010 (Armazéns Protheus)
try:
    from app.api.v1.endpoints.import_szb010 import router as import_szb010_router
    app.include_router(import_szb010_router, prefix="/api/v1", tags=["Importação SZB010"])
    logger.info("✅ Router de importação SZB010 registrado")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de importação SZB010: {e}")

# Registrar router de importação de produtos via API Protheus
try:
    from app.api.v1.endpoints.import_produtos import router as import_produtos_router
    app.include_router(import_produtos_router, prefix="/api/v1", tags=["Importação Produtos"])
    logger.info("✅ Router de importação de produtos registrado")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de importação de produtos: {e}")

# Registrar router de listas de contagem múltiplas
try:
    from app.api.v1.endpoints.counting_lists import router as counting_lists_router
    app.include_router(counting_lists_router, prefix="/api/v1", tags=["Counting Lists"])
    logger.info("✅ Router de listas de contagem múltiplas registrado")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de listas de contagem: {e}")

# NOTA: GET /inventories/{inventory_id}/counting-lists movido para counting_lists.py router

# ✅ ENDPOINT: Itens do inventário para atribuição a listas de contagem
@app.get("/api/v1/inventories/{inventory_id}/items-for-assignment", tags=["Counting Lists"])
async def get_items_for_assignment(
    inventory_id: str,
    list_id: str = Query(None, description="ID da lista atual (para marcar itens 'nesta lista')"),
    search: str = Query(None, description="Busca por código ou descrição do produto"),
    assignment_status: str = Query(None, description="Filtro: AVAILABLE, IN_LIST, IN_OTHER_LIST"),
    # Filtros avançados (range) baseados no snapshot
    grupo_de: str = Query(None), grupo_ate: str = Query(None),
    categoria_de: str = Query(None), categoria_ate: str = Query(None),
    subcategoria_de: str = Query(None), subcategoria_ate: str = Query(None),
    segmento_de: str = Query(None), segmento_ate: str = Query(None),
    grupo_inv_de: str = Query(None), grupo_inv_ate: str = Query(None),
    local1_from: str = Query(None), local1_to: str = Query(None),
    local2_from: str = Query(None), local2_to: str = Query(None),
    local3_from: str = Query(None), local3_to: str = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Retorna itens do inventário com status de atribuição a listas de contagem.
    Suporta filtros avançados por grupo, categoria, subcategoria, segmento, etc.
    """
    try:
        from app.models.models import (
            InventoryList, InventoryItem, InventoryItemSnapshot,
            CountingList, CountingListItem
        )
        import uuid

        inventory_uuid = uuid.UUID(inventory_id)
        list_uuid = uuid.UUID(list_id) if list_id else None

        # Verificar se inventário existe
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_uuid).first()
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # Subquery: atribuição de cada item a uma lista
        cli_subq = db.query(
            CountingListItem.inventory_item_id,
            CountingListItem.counting_list_id,
            CountingList.list_name,
        ).join(
            CountingList, CountingList.id == CountingListItem.counting_list_id
        ).filter(
            CountingList.inventory_id == inventory_uuid
        ).subquery()

        # Query principal com snapshot para dados do produto
        query = db.query(
            InventoryItem.id,
            InventoryItem.product_code,
            InventoryItem.expected_quantity,
            InventoryItem.warehouse,
            InventoryItem.sequence,
            InventoryItemSnapshot.b1_desc.label("product_name"),
            InventoryItemSnapshot.b2_qatu.label("product_estoque"),
            InventoryItemSnapshot.b2_xentpos.label("entregas_post"),
            InventoryItemSnapshot.b1_grupo.label("grupo"),
            InventoryItemSnapshot.b1_xcatgor.label("categoria"),
            InventoryItemSnapshot.b1_xsubcat.label("subcategoria"),
            InventoryItemSnapshot.b1_xsegmen.label("segmento"),
            InventoryItemSnapshot.b1_xgrinve.label("grupo_inv"),
            InventoryItemSnapshot.bz_xlocal1.label("local1"),
            InventoryItemSnapshot.bz_xlocal2.label("local2"),
            InventoryItemSnapshot.bz_xlocal3.label("local3"),
            InventoryItemSnapshot.b1_rastro.label("rastro"),
            cli_subq.c.counting_list_id.label("assigned_list_id"),
            cli_subq.c.list_name.label("assigned_list_name"),
        ).outerjoin(
            InventoryItemSnapshot,
            InventoryItemSnapshot.inventory_item_id == InventoryItem.id
        ).outerjoin(
            cli_subq,
            cli_subq.c.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == inventory_uuid
        )

        # Filtro de busca por código ou descrição
        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                (InventoryItem.product_code.ilike(search_term)) |
                (InventoryItemSnapshot.b1_desc.ilike(search_term))
            )

        # Filtros avançados (range) no snapshot
        def apply_range(col, val_de, val_ate):
            nonlocal query
            if val_de:
                query = query.filter(col >= val_de.strip())
            if val_ate:
                query = query.filter(col <= val_ate.strip())

        apply_range(InventoryItemSnapshot.b1_grupo, grupo_de, grupo_ate)
        apply_range(InventoryItemSnapshot.b1_xcatgor, categoria_de, categoria_ate)
        apply_range(InventoryItemSnapshot.b1_xsubcat, subcategoria_de, subcategoria_ate)
        apply_range(InventoryItemSnapshot.b1_xsegmen, segmento_de, segmento_ate)
        apply_range(InventoryItemSnapshot.b1_xgrinve, grupo_inv_de, grupo_inv_ate)
        apply_range(InventoryItemSnapshot.bz_xlocal1, local1_from, local1_to)
        apply_range(InventoryItemSnapshot.bz_xlocal2, local2_from, local2_to)
        apply_range(InventoryItemSnapshot.bz_xlocal3, local3_from, local3_to)

        # Ordenar por sequência
        query = query.order_by(InventoryItem.sequence)

        # ✅ PERFORMANCE: Contadores por status calculados no SQL (sem carregar todos os itens)
        base_query = query  # query antes de filtro de status
        from sqlalchemy import func as sql_func
        total_available = base_query.filter(cli_subq.c.counting_list_id == None).count()
        total_in_list = base_query.filter(cli_subq.c.counting_list_id == list_uuid).count() if list_uuid else 0
        total_in_other = base_query.filter(cli_subq.c.counting_list_id != None).count() - total_in_list if list_uuid else base_query.filter(cli_subq.c.counting_list_id != None).count()

        # ✅ PERFORMANCE: Filtro assignment_status no SQL (era feito em Python)
        if assignment_status == "AVAILABLE":
            query = query.filter(cli_subq.c.counting_list_id == None)
        elif assignment_status == "IN_LIST" and list_uuid:
            query = query.filter(cli_subq.c.counting_list_id == list_uuid)
        elif assignment_status == "IN_OTHER_LIST":
            if list_uuid:
                query = query.filter(
                    cli_subq.c.counting_list_id != None,
                    cli_subq.c.counting_list_id != list_uuid
                )
            else:
                query = query.filter(cli_subq.c.counting_list_id != None)

        # ✅ PERFORMANCE: Contar e paginar no SQL (era feito em Python com .all())
        total = query.count()
        offset = (page - 1) * size
        paginated_rows = query.offset(offset).limit(size).all()

        # Classificar apenas os itens paginados
        items_result = []
        for row in paginated_rows:
            if row.assigned_list_id is None:
                item_status = "AVAILABLE"
            elif list_uuid and str(row.assigned_list_id) == str(list_uuid):
                item_status = "IN_LIST"
            else:
                item_status = "IN_OTHER_LIST"

            items_result.append({
                "id": str(row.id),
                "product_code": row.product_code or "",
                "product_name": row.product_name or row.product_code or "",
                "product_estoque": float(row.product_estoque) if row.product_estoque else 0,
                "entregas_post": float(row.entregas_post) if row.entregas_post else 0,
                "warehouse": row.warehouse or "",
                "grupo": (row.grupo or "").strip(),
                "categoria": (row.categoria or "").strip(),
                "subcategoria": (row.subcategoria or "").strip(),
                "segmento": (row.segmento or "").strip(),
                "grupo_inv": (row.grupo_inv or "").strip(),
                "local1": (row.local1 or "").strip(),
                "local2": (row.local2 or "").strip(),
                "local3": (row.local3 or "").strip(),
                "lote": "Sim" if row.rastro == 'L' else ("Serie" if row.rastro == 'S' else ""),
                "assignment_status": item_status,
                "assigned_list_name": row.assigned_list_name if item_status == "IN_OTHER_LIST" else None,
            })

        return {
            "items": items_result,
            "total": total,
            "page": page,
            "size": size,
            "total_pages": (total + size - 1) // size if total > 0 else 1,
            "total_available": total_available,
            "total_in_list": total_in_list,
            "total_in_other": total_in_other,
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar itens para atribuição: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ❌ ENDPOINT LEGADO DESABILITADO - Conflita com endpoint modularizado em counting_lists.py
# Este endpoint esperava list_id no formato "user_{uuid}" (arquitetura antiga)
# Agora usamos o endpoint modularizado: app/api/v1/endpoints/counting_lists.py:679
# Endpoint correto: GET /api/v1/counting-lists/{list_id}/items (aceita UUID real da CountingList)
#
# @app.get("/api/v1/counting-lists/{list_id}/items", tags=["Counting Lists"])
# async def get_counting_list_items(list_id: str, db: Session = Depends(get_db)):
#     """Buscar produtos de uma lista específica (baseado em assignments)"""
#     try:
#         from app.models.models import InventoryItem, CountingAssignment, User, SB1010
#         import uuid
#
#         # Extrair user_id do list_id formato "user_{uuid}"
#         if not list_id.startswith("user_"):
#             raise HTTPException(status_code=400, detail="ID de lista inválido")
#
#         user_id = list_id.replace("user_", "")
#         user_uuid = uuid.UUID(user_id)
#
#         # Buscar assignments do usuário
#         assignments = db.query(CountingAssignment).filter(
#             CountingAssignment.assigned_to == user_uuid
#         ).all()
#
#         if not assignments:
#             return {"data": {"items": []}}
#
#         # Buscar detalhes dos produtos com JOIN para obter descrição
#         item_ids = [assignment.inventory_item_id for assignment in assignments]
#         items_with_description = db.query(
#             InventoryItem,
#             SB1010.b1_desc
#         ).outerjoin(
#             SB1010, InventoryItem.product_code == SB1010.b1_cod
#         ).filter(
#             InventoryItem.id.in_(item_ids)
#         ).all()
#
#         # Preparar resposta
#         result = []
#         for item, product_description in items_with_description:
#             result.append({
#                 "id": str(item.id),
#                 "product_code": item.product_code or "",
#                 "product_name": product_description or f"Produto {item.product_code}",  # ✅ ADICIONADO
#                 "expected_quantity": float(item.expected_quantity or 0),
#                 "b2_qatu": float(item.b2_qatu or 0),
#                 "warehouse": item.warehouse or "",
#                 "sequence": item.sequence,
#                 "status": item.status,
#                 # 🎯 Campos de contagem por ciclo
#                 "count_cycle_1": float(item.count_cycle_1) if item.count_cycle_1 is not None else None,
#                 "count_cycle_2": float(item.count_cycle_2) if item.count_cycle_2 is not None else None,
#                 "count_cycle_3": float(item.count_cycle_3) if item.count_cycle_3 is not None else None,
#                 "needs_recount_cycle_2": item.needs_recount_cycle_2 or False,
#                 "needs_recount_cycle_3": item.needs_recount_cycle_3 or False,
#                 "is_available_for_assignment": item.is_available_for_assignment,
#                 "last_counted_at": item.last_counted_at.isoformat() if item.last_counted_at else None,
#                 "created_at": item.created_at.isoformat() if item.created_at else None,
#                 "updated_at": item.updated_at.isoformat() if item.updated_at else None
#             })
#
#         return {"data": {"items": result}}
#
#     except ValueError:
#         raise HTTPException(status_code=400, detail="ID de lista inválido")
#     except Exception as e:
#         return {"error": f"Erro: {str(e)}", "list_id": list_id}


# 🆕 ENDPOINT DEFINITIVO - LIBERAR LISTA ESPECÍFICA
@app.post("/api/v1/counting-lists/{list_id}/release", tags=["Counting Lists"])
async def release_counting_list(list_id: str, db: Session = Depends(get_db)):
    """Liberar uma lista específica para contagem - SOLUÇÃO DEFINITIVA"""
    try:
        from app.models.models import CountingAssignment, InventoryItem, InventoryList, User
        from datetime import datetime
        import uuid

        console_log = []
        console_log.append(f"🚀 [BACKEND] Liberando lista específica: {list_id}")

        # Verificar se é UUID direto (novo sistema) ou formato "user_{uuid}" (legado)
        if not list_id.startswith("user_"):
            # Novo sistema: list_id é UUID de counting_list
            from app.models.models import CountingList
            counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
            if not counting_list:
                raise HTTPException(status_code=404, detail="Lista de contagem não encontrada")

            if counting_list.list_status == "ENCERRADA":
                raise HTTPException(status_code=400, detail="Lista já está encerrada")

            # Recalcular divergências se ciclo >= 2
            if counting_list.current_cycle >= 2:
                logger.info(f"🔄 [RELEASE] Recalculando divergências antes de liberar ciclo {counting_list.current_cycle}")
                discrepancy_result = recalculate_discrepancies_for_list(
                    db, list_id, counting_list.current_cycle - 1,
                    inventory_list_id=str(counting_list.inventory_id)
                )
                if discrepancy_result.get("success"):
                    logger.info(f"✅ [RELEASE] {discrepancy_result.get('products_needing_recount', 0)} produtos para recontagem")

            counting_list.list_status = "EM_CONTAGEM"
            counting_list.released_at = datetime.utcnow()
            db.commit()

            logger.info(f"✅ Lista {list_id} liberada para contagem (ciclo {counting_list.current_cycle})")
            return {
                "success": True,
                "list_id": list_id,
                "message": f"Lista liberada para contagem ({counting_list.current_cycle}o ciclo)",
                "current_cycle": counting_list.current_cycle,
                "console_log": [f"✅ Lista {counting_list.list_name} liberada para {counting_list.current_cycle}o ciclo"]
            }

        user_id = list_id.replace("user_", "")
        user_uuid = uuid.UUID(user_id)

        # Buscar assignments desta lista específica
        assignments = db.query(CountingAssignment).filter(
            CountingAssignment.assigned_to == user_uuid
        ).all()

        if not assignments:
            console_log.append(f"❌ [BACKEND] Nenhuma atribuição encontrada para: {list_id}")
            return {
                "success": False,
                "message": "Lista não encontrada",
                "list_id": list_id,
                "console_log": console_log
            }

        console_log.append(f"✅ [BACKEND] Encontradas {len(assignments)} atribuições")

        # Buscar dados do usuário
        user = db.query(User).filter(User.id == user_uuid).first()
        user_name = user.full_name if user else f"Usuário {user_id[:8]}"

        # Atualizar status de todos os itens da lista para "COUNTED" (indica que está liberado para contagem)
        item_ids = [assignment.inventory_item_id for assignment in assignments]
        updated_items = db.query(InventoryItem).filter(
            InventoryItem.id.in_(item_ids)
        ).update(
            {
                "status": "COUNTED",  # 🔧 CORREÇÃO: Usar ENUM válido
                "updated_at": datetime.utcnow()
            },
            synchronize_session=False
        )

        console_log.append(f"✅ [BACKEND] {updated_items} itens atualizados para COUNTED")

        # Buscar inventário relacionado para logs e atualização de status
        if assignments:
            console_log.append(f"🔍 [DEBUG] Buscando item de exemplo: {assignments[0].inventory_item_id}")
            sample_item = db.query(InventoryItem).filter(
                InventoryItem.id == assignments[0].inventory_item_id
            ).first()

            if sample_item:
                console_log.append(f"✅ [DEBUG] Item encontrado, buscando inventário: {sample_item.inventory_list_id}")
                inventory = db.query(InventoryList).filter(
                    InventoryList.id == sample_item.inventory_list_id
                ).first()

                if inventory:
                    console_log.append(f"📋 [BACKEND] Inventário: {inventory.name}")

                    # ✅ CORREÇÃO CRÍTICA: Atualizar status da lista para EM_CONTAGEM
                    old_list_status = inventory.list_status
                    inventory.list_status = "EM_CONTAGEM"
                    console_log.append(f"📝 [BACKEND] Status da lista atualizado: {old_list_status} → EM_CONTAGEM")
                else:
                    console_log.append(f"❌ [DEBUG] Inventário não encontrado para ID: {sample_item.inventory_list_id}")
            else:
                console_log.append(f"❌ [DEBUG] Item não encontrado para ID: {assignments[0].inventory_item_id}")

        # Commit das alterações
        db.commit()

        console_log.append(f"💾 [BACKEND] Alterações salvas no banco")

        # Retornar resposta de sucesso
        return {
            "success": True,
            "message": f"Lista '{user_name}' liberada com sucesso!",
            "list_id": list_id,
            "user_name": user_name,
            "items_updated": updated_items,
            "new_status": "COUNTED",
            "console_log": console_log
        }

    except ValueError as ve:
        console_log.append(f"❌ [BACKEND] Erro de validação: {str(ve)}")
        raise HTTPException(status_code=400, detail="ID de lista inválido")
    except Exception as e:
        console_log.append(f"❌ [BACKEND] Erro interno: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno"))


# 🔧 ENDPOINT PARA CORRIGIR STATUS DO INVENTÁRIO PRINCIPAL
@app.post("/api/v1/inventory/{inventory_id}/update-status", tags=["Inventory"])
async def update_inventory_status(
    inventory_id: str,
    status: str,
    db: Session = Depends(get_db)
):
    """Atualizar status do inventário principal"""
    try:
        from app.models.models import InventoryList
        import uuid

        inventory_uuid = uuid.UUID(inventory_id)

        # Buscar e atualizar inventário
        inventory = db.query(InventoryList).filter(
            InventoryList.id == inventory_uuid
        ).first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # Bloquear inventário efetivado
        check_inventory_not_closed(inventory)

        # Atualizar apenas o status do inventário principal
        inventory.list_status = status
        db.commit()

        return {
            "success": True,
            "message": f"Status do inventário atualizado para {status}",
            "inventory_name": inventory.name,
            "current_cycle": inventory.current_cycle,
            "new_status": status
        }

    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@app.post("/test/create-test-users", tags=["Test"], dependencies=[Depends(require_test_endpoints)])
async def create_test_users(db: Session = Depends(get_db)):
    """Criar usuários de teste para desenvolvimento"""
    try:
        from app.models.models import User, Store
        import uuid
        
        # Buscar loja padrão
        store = db.query(Store).filter(Store.code == "001").first()
        if not store:
            return {"error": "Loja padrão não encontrada"}
        
        # Senhas com hash correto
        from app.core.security import hash_password
        password_hash_123456 = hash_password("123456")
        password_hash_admin123 = hash_password("admin123")
        
        # Atualizar admin existente
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            admin_user.password_hash = password_hash_admin123
        
        # Deletar e recriar operadores (sem constraint)
        db.query(User).filter(User.username.in_(["operador1", "supervisor1"])).delete()
        
        # Usuário 1: João Silva (Operador)
        user1 = User(
            id=uuid.uuid4(),
            username="operador1",
            password_hash=password_hash_123456,
            full_name="João Silva (Operador)",
            email="joao@inventario.local",
            role="OPERATOR",
            store_id=store.id,
            is_active=True
        )
        db.add(user1)
        
        # Usuário 2: Maria Santos (Supervisor)
        user2 = User(
            id=uuid.uuid4(),
            username="supervisor1", 
            password_hash=password_hash_123456,
            full_name="Maria Santos (Supervisor)",
            email="maria@inventario.local",
            role="SUPERVISOR",
            store_id=store.id,
            is_active=True
        )
        db.add(user2)
        
        db.commit()
        
        return {
            "message": "Usuários de teste criados com sucesso",
            "users": [
                {"username": "admin", "password": "admin123", "role": "ADMIN"},
                {"username": "operador1", "password": "123456", "role": "OPERATOR"},
                {"username": "supervisor1", "password": "123456", "role": "SUPERVISOR"}
            ]
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao criar usuários de teste: {e}")
        return {"error": f"Erro ao criar usuários: {str(e)}"}

@app.get("/test/debug-user/{username}", tags=["Test"], dependencies=[Depends(require_test_endpoints)])
async def debug_user(username: str, db: Session = Depends(get_db)):
    """Debug de usuário para desenvolvimento"""
    try:
        from app.models.models import User
        from app.core.security import verify_password
        
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return {"error": "Usuário não encontrado"}
        
        # Testar senha
        password_test = verify_password("123456", user.password_hash)
        
        return {
            "user_found": True,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "password_hash": user.password_hash[:20] + "...",  # Só mostrar parte do hash
            "password_test_123456": password_test
        }
        
    except Exception as e:
        return {"error": f"Erro no debug: {str(e)}"}

# DEBUG LOGIN REMOVIDO - Função obsoleta

@app.post("/test/clear-assignments", tags=["Test"], dependencies=[Depends(require_test_endpoints)])
async def clear_assignments(data: dict, db: Session = Depends(get_db)):
    """Limpar atribuições de um inventário específico"""
    try:
        from app.models.models import CountingAssignment, InventoryItem
        import uuid
        
        inventory_id = data.get("inventory_id")
        if not inventory_id:
            return {"success": False, "message": "inventory_id obrigatório"}
            
        inventory_uuid = uuid.UUID(inventory_id)
        
        # Buscar todos os items do inventário
        items = db.query(InventoryItem).filter(InventoryItem.inventory_list_id == inventory_uuid).all()
        item_ids = [item.id for item in items]
        
        # Deletar todas as atribuições desses items
        deleted_count = db.query(CountingAssignment).filter(
            CountingAssignment.inventory_item_id.in_(item_ids)
        ).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Removidas {deleted_count} atribuições do inventário",
            "inventory_id": inventory_id
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao limpar atribuições: {str(e)}")
        return {"success": False, "message": f"Erro: {str(e)}"}

@app.post("/test/release-inventory", tags=["Test"], dependencies=[Depends(require_test_endpoints)])
async def release_inventory(data: dict, db: Session = Depends(get_db)):
    """Liberar inventário para contagem (mudar status)"""
    try:
        from app.models.models import InventoryList
        import uuid
        
        inventory_id = data.get("inventory_id")
        if not inventory_id:
            return {"success": False, "message": "inventory_id obrigatório"}
            
        inventory_uuid = uuid.UUID(inventory_id)
        
        # Buscar inventário
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_uuid).first()
        if not inventory:
            return {"success": False, "message": "Inventário não encontrado"}
        
        # ✅ CORREÇÃO: Não mudar status automaticamente
        # Status deve ser alterado apenas quando explicitamente liberado pelo usuário
        old_status = inventory.status
        
        # REMOVIDO: Mudança automática de status
        # inventory.status = "IN_PROGRESS" 
        # db.commit()
        
        # Apenas retornar informação sem modificar
        
        return {
            "success": True,
            "message": f"Status atual: {old_status} (Para liberar para contagem, use o botão específico)",
            "inventory_name": inventory.name,
            "inventory_id": inventory_id,
            "current_status": old_status
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao liberar inventário: {str(e)}")
        return {"success": False, "message": f"Erro: {str(e)}"}

@app.post("/test/force-assignment", tags=["Test"], dependencies=[Depends(require_test_endpoints)])
async def force_assignment(data: dict, db: Session = Depends(get_db)):
    """Forçar atribuição de usuário a inventário para teste"""
    try:
        from app.models.models import User, InventoryList, InventoryItem, CountingAssignment
        from datetime import datetime
        import uuid
        
        inventory_id = data.get("inventory_id")
        user_id = data.get("user_id")
        
        if not inventory_id or not user_id:
            return {"success": False, "message": "inventory_id e user_id obrigatórios"}
        
        # Verificar se inventário e usuário existem
        inventory_uuid = uuid.UUID(inventory_id)
        user_uuid = uuid.UUID(user_id)
        
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_uuid).first()
        user = db.query(User).filter(User.id == user_uuid).first()
        
        if not inventory:
            return {"success": False, "message": "Inventário não encontrado"}
        if not user:
            return {"success": False, "message": "Usuário não encontrado"}
        
        # Pegar todos os produtos do inventário
        items = db.query(InventoryItem).filter(InventoryItem.inventory_list_id == inventory_uuid).all()
        
        if not items:
            return {"success": False, "message": "Nenhum produto encontrado no inventário"}
        
        # Criar atribuições para todos os produtos
        assignments_created = 0
        for item in items:
            # Verificar se já existe atribuição
            existing = db.query(CountingAssignment).filter(
                CountingAssignment.inventory_item_id == item.id,
                CountingAssignment.assigned_to == user_uuid
            ).first()
            
            if not existing:
                assignment = CountingAssignment(
                    inventory_item_id=item.id,
                    assigned_to=user_uuid,
                    assigned_by=user_uuid  # Para simplificar, usar o mesmo usuário
                )
                db.add(assignment)
                assignments_created += 1
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Criadas {assignments_created} atribuições",
            "inventory_name": inventory.name,
            "user_name": user.username,
            "total_items": len(items)
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao forçar atribuição: {str(e)}")
        return {"success": False, "message": f"Erro: {str(e)}"}

@app.post("/test/simple-login", tags=["Test"], dependencies=[Depends(require_test_endpoints)])
async def simple_login(user_data: dict, db: Session = Depends(get_db)):
    """Login simples para teste - endpoint usado pelo frontend"""
    try:
        from app.models.models import User
        from app.core.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
        from datetime import timedelta
        
        username = user_data.get("username")
        password = user_data.get("password")
        
        if not username or not password:
            return {"success": False, "message": "Username e password obrigatórios"}
        
        # Buscar usuário
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return {"success": False, "message": "Usuário não encontrado"}
        
        if not user.is_active:
            return {"success": False, "message": "Usuário inativo"}
        
        # Verificar senha
        if not verify_password(password, user.password_hash):
            return {"success": False, "message": "Senha incorreta"}
        
        # Gerar token
        # ✅ CORREÇÃO: Usar user.id (UUID) em vez de username para consistência com get_current_user()
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )
        
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),  # ✅ INCLUIR ID DO USUÁRIO
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "store_id": str(user.store_id) if user.store_id else None
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Erro no simple-login: {str(e)}")
        return {"success": False, "message": f"Erro interno: {str(e)}"}

# SIMPLE LOGIN REMOVIDO - Função obsoleta

# =================================
# ENDPOINT PARA PRODUTOS DE LISTA ESPECÍFICA
# =================================

@app.get("/api/v1/inventories/{inventory_id}/lists/{list_id}/products", tags=["Counting Lists"])
async def get_counting_list_products(
    inventory_id: str,
    list_id: str,
    context: str = Query("management", description="Context for the request"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Buscar produtos específicos de uma lista de contagem

    Args:
        inventory_id: ID do inventário
        list_id: ID da lista de contagem
        context: Contexto da requisição (management, counting, etc.)

    Returns:
        Lista de produtos com informações de contagem da lista específica
    """
    try:
        from app.models.models import InventoryList as InventoryListModel, InventoryItem as InventoryItemModel, CountingList, CountingListItem

        # Verificar se inventário existe
        inventory = db.query(InventoryListModel).filter(InventoryListModel.id == inventory_id).first()
        if not inventory:
            return {"error": "Inventário não encontrado", "status": 404}

        # Verificar se lista de contagem existe
        counting_list = db.query(CountingList).filter(
            and_(
                CountingList.id == list_id,
                CountingList.inventory_id == inventory_id
            )
        ).first()

        if not counting_list:
            return {"error": "Lista de contagem não encontrada", "status": 404}

        # Buscar produtos da lista específica com joins necessários
        query = db.query(InventoryItemModel).join(
            CountingListItem,
            CountingListItem.inventory_item_id == InventoryItemModel.id
        ).filter(
            and_(
                CountingListItem.counting_list_id == list_id,
                InventoryItemModel.inventory_list_id == inventory_id
            )
        )

        products = query.all()

        # Construir response similar ao endpoint original
        result_data = {
            "data": {
                "current_cycle": counting_list.current_cycle,
                "list_id": list_id,
                "list_name": counting_list.list_name,
                "products": []
            }
        }

        for item in products:
            # Buscar informações de contagem da lista específica
            list_item = db.query(CountingListItem).filter(
                and_(
                    CountingListItem.counting_list_id == list_id,
                    CountingListItem.inventory_item_id == item.id
                )
            ).first()

            # Buscar descrição do produto da tabela sb1010
            product_description = ""
            if item.product_code:
                from sqlalchemy import text
                desc_query = text("""
                    SELECT b1_desc FROM inventario.sb1010
                    WHERE b1_cod = :code
                """)
                desc_result = db.execute(desc_query, {"code": item.product_code}).fetchone()
                if desc_result:
                    product_description = desc_result[0] or ""

            # Se não encontrou na sb1010, tentar no produto relacionado
            if not product_description and item.product_id:
                from app.models.models import Product
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product_description = product.description or ""

            # ✅ v2.18.2: Buscar códigos de barras alternativos da SLK010
            alternative_barcodes = []
            barcode_principal = None
            if item.product_code:
                barcodes_query = text("""
                    SELECT slk_codbar FROM inventario.slk010
                    WHERE slk_produto = :code
                    ORDER BY slk_codbar
                """)
                barcodes_result = db.execute(barcodes_query, {"code": item.product_code}).fetchall()
                if barcodes_result:
                    for row in barcodes_result:
                        barcode = row[0]
                        if barcode:
                            # Primeiro código é o principal (geralmente o código do produto)
                            if not barcode_principal and barcode == item.product_code:
                                barcode_principal = barcode
                            else:
                                # Demais são alternativos
                                alternative_barcodes.append(barcode)

            product_data = {
                "id": str(item.id),
                "product_code": item.product_code or "",
                "product_name": product_description,
                "product_description": product_description,
                "warehouse": item.warehouse or "01",
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0.0,
                "system_qty": float(item.b2_qatu) if item.b2_qatu else 0.0,
                "b2_xentpos": float(item.b2_xentpos) if item.b2_xentpos else 0.0,

                # ✅ v2.18.2: Códigos de barras
                "barcode": barcode_principal or item.product_code,  # Código principal
                "alternative_barcodes": alternative_barcodes,  # Códigos alternativos da SLK010

                # Informações de contagem da lista
                "count_cycle_1": float(list_item.count_cycle_1) if list_item and list_item.count_cycle_1 else None,
                "count_cycle_2": float(list_item.count_cycle_2) if list_item and list_item.count_cycle_2 else None,
                "count_cycle_3": float(list_item.count_cycle_3) if list_item and list_item.count_cycle_3 else None,

                "needs_count_cycle_1": list_item.needs_count_cycle_1 if list_item else True,
                "needs_count_cycle_2": list_item.needs_count_cycle_2 if list_item else False,
                "needs_count_cycle_3": list_item.needs_count_cycle_3 if list_item else False,

                "status": list_item.status.value if list_item and list_item.status else "PENDING",
                "last_counted_at": list_item.last_counted_at.isoformat() if list_item and list_item.last_counted_at else None,
                "last_counted_by": str(list_item.last_counted_by) if list_item and list_item.last_counted_by else None,

                # Informações do produto
                "sequence": item.sequence or 1,
                "created_at": item.created_at.isoformat() if item.created_at else None
            }

            # ✅ CORREÇÃO v2.19.41: Calcular finalQuantity tratando NULL como 0 quando ciclo encerrado
            cycle = counting_list.current_cycle
            count1 = product_data["count_cycle_1"]
            count2 = product_data["count_cycle_2"]
            count3 = product_data["count_cycle_3"]
            expected = product_data["expected_quantity"]

            # Calcular valores efetivos (NULL = 0 quando ciclo encerrado e havia divergência)
            effective_count2 = count2
            if cycle >= 2 and count2 is None and count1 is not None and abs(count1 - expected) >= 0.01:
                effective_count2 = 0.0
                logger.debug(f"🔧 Produto {product_data['product_code']}: count2 NULL → 0 (ciclo {cycle}, count1={count1} diverge de expected={expected})")

            effective_count3 = count3
            if cycle >= 3 and count3 is None:
                effective_count3 = 0.0
                logger.debug(f"🔧 Produto {product_data['product_code']}: count3 NULL → 0 (ciclo {cycle})")

            # Determinar finalQuantity usando valores efetivos
            if cycle == 1:
                product_data["finalQuantity"] = count1
            elif cycle == 2:
                # Se count2 efetivo bate com expected, usar count2 efetivo
                if effective_count2 is not None and abs(effective_count2 - expected) < 0.01:
                    product_data["finalQuantity"] = effective_count2
                elif effective_count2 is not None:
                    product_data["finalQuantity"] = effective_count2
                else:
                    product_data["finalQuantity"] = count1
            elif cycle == 3:
                # Prioridade: count3 efetivo > count2 efetivo > count1
                if effective_count3 is not None:
                    product_data["finalQuantity"] = effective_count3
                elif effective_count2 is not None:
                    product_data["finalQuantity"] = effective_count2
                else:
                    product_data["finalQuantity"] = count1
            else:
                product_data["finalQuantity"] = None

            result_data["data"]["products"].append(product_data)

        logger.info(f"✅ Produtos da lista {list_id}: {len(result_data['data']['products'])} produtos encontrados")
        return result_data

    except Exception as e:
        logger.error(f"❌ Erro ao buscar produtos da lista {list_id}: {e}")
        return {"error": f"Erro interno: {str(e)}", "status": 500}


# =================================
# NOVO ENDPOINT PARA CONCEITO CORRETO DE CICLOS
# =================================

@app.get("/api/v1/inventory/{inventory_id}/cycle-assignments", tags=["Inventory"])
async def get_cycle_assignments(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obter informações de atribuição baseadas na tabela counting_lists:
    Múltiplas listas de contagem por inventário
    """
    try:
        from app.models.models import InventoryList, User
        from sqlalchemy import text
        import uuid

        inventory_uuid = uuid.UUID(inventory_id)

        # Buscar listas de contagem múltiplas para este inventário
        counting_lists_query = text("""
            SELECT
                cl.id as list_id,
                cl.list_name,
                cl.description,
                cl.current_cycle,
                cl.list_status,
                cl.counter_cycle_1,
                cl.counter_cycle_2,
                cl.counter_cycle_3,
                -- Informações dos usuários
                u1.username as counter1_name,
                u2.username as counter2_name,
                u3.username as counter3_name,
                -- Contagem de produtos em cada lista
                COUNT(cli.id) as total_products
            FROM inventario.counting_lists cl
            LEFT JOIN inventario.users u1 ON cl.counter_cycle_1 = u1.id
            LEFT JOIN inventario.users u2 ON cl.counter_cycle_2 = u2.id
            LEFT JOIN inventario.users u3 ON cl.counter_cycle_3 = u3.id
            LEFT JOIN inventario.counting_list_items cli ON cl.id = cli.counting_list_id
            WHERE cl.inventory_id = :inventory_id
            GROUP BY cl.id, cl.list_name, cl.description, cl.current_cycle, cl.list_status,
                     cl.counter_cycle_1, cl.counter_cycle_2, cl.counter_cycle_3,
                     u1.username, u2.username, u3.username
            ORDER BY cl.created_at
        """)

        results = db.execute(counting_lists_query, {"inventory_id": str(inventory_id)}).fetchall()

        if not results:
            return {"success": False, "message": "Nenhuma lista de contagem encontrada", "data": []}

        # Processar cada lista de contagem encontrada
        assignments = []
        current_cycle = results[0].current_cycle if results else 1

        for list_result in results:
            # Determinar o contador responsável baseado no ciclo atual
            counter_user_id = None
            counter_name = "Não atribuído"

            if current_cycle == 1 and list_result.counter_cycle_1:
                counter_user_id = list_result.counter_cycle_1
                counter_name = list_result.counter1_name or "Usuário desconhecido"
            elif current_cycle == 2 and list_result.counter_cycle_2:
                counter_user_id = list_result.counter_cycle_2
                counter_name = list_result.counter2_name or "Usuário desconhecido"
            elif current_cycle == 3 and list_result.counter_cycle_3:
                counter_user_id = list_result.counter_cycle_3
                counter_name = list_result.counter3_name or "Usuário desconhecido"

            if counter_user_id:
                assignments.append({
                "id": str(list_result.list_id),  # ID real da lista de contagem
                "list_name": list_result.list_name,
                "description": list_result.description or f"Lista atribuída a {counter_name}",
                "list_status": list_result.list_status,
                "current_cycle": current_cycle,
                "counter_name": counter_name,
                "total_products": list_result.total_products,
                "user_id": str(counter_user_id)
                })

        return {
            "success": True,
            "message": f"Encontradas {len(assignments)} atribuições para o ciclo {current_cycle}",
            "data": assignments
        }

    except ValueError:
        return {"success": False, "message": "ID de inventário inválido", "data": []}
    except Exception as e:
        print(f"❌ Erro ao buscar atribuições de ciclo: {e}")
        return {"success": False, "message": str(e), "data": []}

# =================================
# ENDPOINTS TEMPORÁRIOS PARA CYCLES (até resolver importação)
# =================================

@app.get("/api/v1/cycles/inventory/{inventory_id}/my-products", tags=["Cycles"])
async def get_my_products_cycles(
    inventory_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Endpoint temporário que redireciona para assignments"""
    try:
        # Redirecionar para o endpoint que funciona
        from app.api.v1.endpoints.assignments import get_my_products_in_inventory
        return await get_my_products_in_inventory(inventory_id, None, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_error_response(e, "Erro"))

@app.get("/api/v1/counting-lists/{list_id}", tags=["Counting Lists"])
async def get_counting_list(
    list_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Buscar dados de uma counting_list específica

    Retorna:
    - id: UUID da counting_list
    - list_name: Nome da lista
    - current_cycle: Ciclo atual (1, 2 ou 3)
    - list_status: Status da lista (ABERTA, RELEASED, EM_CONTAGEM, ENCERRADA)
    - warehouse: Código do armazém
    - created_at: Data de criação
    """
    try:
        import uuid
        from sqlalchemy import text

        # Validar UUID
        try:
            list_uuid = uuid.UUID(list_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de lista inválido")

        # Buscar dados da counting_list
        query = text("""
            SELECT
                cl.id,
                cl.list_name,
                cl.current_cycle,
                cl.list_status,
                il.warehouse,
                cl.created_at,
                cl.inventory_id
            FROM inventario.counting_lists cl
            JOIN inventario.inventory_lists il ON cl.inventory_id = il.id
            WHERE cl.id = :list_id
            AND il.store_id = :store_id
        """)

        result = db.execute(query, {
            "list_id": str(list_uuid),
            "store_id": str(current_user.store_id)
        }).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Lista não encontrada")

        return {
            "success": True,
            "data": {
                "id": str(result.id),
                "list_name": result.list_name,
                "current_cycle": result.current_cycle,
                "list_status": result.list_status,
                "warehouse": result.warehouse,
                "created_at": result.created_at.isoformat() if result.created_at else None,
                "inventory_id": str(result.inventory_id)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar counting_list {list_id}: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao buscar lista"))


@app.get("/api/v1/counting-lists/{list_id}/products", tags=["Counting Lists"])
async def get_list_products(
    list_id: str,
    show_all: bool = False,  # Parâmetro para controlar filtro por ciclo
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Buscar produtos de uma lista de contagem

    Parâmetros:
    - list_id: ID da lista de contagem
    - show_all: Se True, mostra todos produtos. Se False (padrão), filtra por ciclo atual

    Usado por:
    - inventory.html (show_all=true): Modal 'Gerenciar Lista' - mostra todos produtos
    - counting_improved.html (show_all=false): Tela de contagem - mostra apenas produtos do ciclo atual
    """
    try:
        from sqlalchemy import text
        import uuid
        import json  # ✅ Importar json para tratamento de dados JSON
        # ✅ Counting e User agora são importados no topo do arquivo (linha 60)

        # 🔍 DEBUG: Logar list_id recebido
        logger.info(f"🔍 [GET PRODUCTS] list_id recebido: {list_id}")
        logger.info(f"🔍 [GET PRODUCTS] show_all: {show_all}")
        logger.info(f"🔍 [GET PRODUCTS] current_user: {current_user.username if current_user else 'None'}")

        # O list_id pode ser ID de counting_lists OU inventory_lists
        try:
            list_uuid = uuid.UUID(list_id)
            logger.info(f"✅ [GET PRODUCTS] UUID válido: {list_uuid}")

            # 📍 v2.19.8: Verificar se é ID de counting_lists ou inventory_lists
            # Primeiro, tentar como counting_lists
            check_query = text("SELECT id FROM inventario.counting_lists WHERE id = :list_id LIMIT 1")
            check_result = db.execute(check_query, {"list_id": str(list_uuid)}).fetchone()

            if not check_result:
                # Não encontrou em counting_lists, tentar como inventory_lists
                logger.info(f"🔍 [GET PRODUCTS] ID não encontrado em counting_lists, tentando como inventory_lists...")
                fallback_query = text("""
                    SELECT cl.id FROM inventario.counting_lists cl
                    WHERE cl.inventory_id = :inventory_id
                    ORDER BY cl.created_at DESC
                    LIMIT 1
                """)
                fallback_result = db.execute(fallback_query, {"inventory_id": str(list_uuid)}).fetchone()
                if fallback_result:
                    list_uuid = fallback_result.id
                    logger.info(f"✅ [GET PRODUCTS] Encontrado counting_list via inventory_id: {list_uuid}")
                else:
                    logger.warning(f"⚠️ [GET PRODUCTS] Nenhuma counting_list encontrada para inventory_id: {list_id}")
                    # Continuar com o UUID original - a query principal retornará vazio

        except ValueError:
            logger.warning(f"⚠️ [GET PRODUCTS] UUID inválido, tentando fallback...")
            # Manter compatibilidade com formato antigo "user_{user_id}"
            if list_id.startswith("user_"):
                # Para compatibilidade, buscar primeira lista do usuário
                user_id = list_id.replace("user_", "")
                user_uuid = uuid.UUID(user_id)

                # Buscar lista do usuário (fallback)
                query = text("""
                    SELECT id FROM inventario.counting_lists
                    WHERE counter_cycle_1 = :user_id
                    LIMIT 1
                """)
                result = db.execute(query, {"user_id": str(user_uuid)}).fetchone()
                if result:
                    list_uuid = result.id
                    logger.info(f"✅ [GET PRODUCTS] Fallback - UUID encontrado: {list_uuid}")
                else:
                    raise ValueError("Lista não encontrada para este usuário")
            else:
                raise ValueError("ID de lista inválido")

        # Buscar info da lista para o response wrapper
        _list_info_q = text("SELECT list_name, current_cycle FROM inventario.counting_lists WHERE id = :lid LIMIT 1")
        _list_info = db.execute(_list_info_q, {"lid": str(list_uuid)}).fetchone()
        _list_name = _list_info.list_name if _list_info else ""
        _current_cycle = _list_info.current_cycle if _list_info else 1

        # 🎯 Construir query com filtro condicional por ciclo
        # ✅ CORREÇÃO CRÍTICA: Buscar contagens de counting_list_items, não de inventory_items
        # 📸 v2.10.0: Adicionar snapshot para dados congelados
        # 🚀 v2.18.3: Usar CACHE (inventario.products) ao invés de SB1010/SLK010 (1.860x mais rápido)
        base_query = """
            SELECT
                ii.id,
                ii.product_code,
                COALESCE(iis.b1_desc, p.description, CONCAT('Produto ', ii.product_code)) as product_description,
                COALESCE(iis.b2_qatu, ii.expected_quantity, 0) as system_qty,
                COALESCE(iis.b2_xentpos, 0) as b2_xentpos,
                COALESCE(iis.b2_cm1, 0) as snapshot_cost,
                cli.count_cycle_1 as count_1,
                cli.count_cycle_2 as count_2,
                cli.count_cycle_3 as count_3,
                COALESCE(cli.needs_count_cycle_1, ii.needs_recount_cycle_1) as needs_count_cycle_1,
                COALESCE(cli.needs_count_cycle_2, ii.needs_recount_cycle_2) as needs_count_cycle_2,
                COALESCE(cli.needs_count_cycle_3, ii.needs_recount_cycle_3) as needs_count_cycle_3,
                ii.warehouse,
                ii.sequence,
                COALESCE(p.unit, 'UN') as unit,
                cl.current_cycle,
                COALESCE(iis.b1_rastro, '') as b1_rastro,
                iis.created_at as snapshot_created_at,
                iis.bz_xlocal1,
                iis.bz_xlocal2,
                iis.bz_xlocal3,
                COALESCE(szb_loc.zb_xsbzlcz, '1') as zb_xsbzlcz,
                CASE COALESCE(szb_loc.zb_xsbzlcz, '1')
                    WHEN '1' THEN NULLIF(TRIM(iis.bz_xlocal1), '')
                    WHEN '2' THEN NULLIF(TRIM(iis.bz_xlocal2), '')
                    WHEN '3' THEN NULLIF(TRIM(iis.bz_xlocal3), '')
                    ELSE NULLIF(TRIM(iis.bz_xlocal1), '')
                END as location,
                '' as b1_codbar,
                '[]'::jsonb as alternative_barcodes,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'lot_number', ils.b8_lotectl,
                            'quantity', ils.b8_saldo,
                            'b8_lotefor', ils.b8_lotefor
                        )
                    ) FILTER (WHERE ils.id IS NOT NULL),
                    '[]'::json
                ) as snapshot_lots
            FROM inventario.counting_list_items cli
            JOIN inventario.counting_lists cl ON cli.counting_list_id = cl.id
            JOIN inventario.inventory_items ii ON cli.inventory_item_id = ii.id
            LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
            LEFT JOIN inventario.inventory_lots_snapshot ils ON ils.inventory_item_id = ii.id
            LEFT JOIN inventario.products p ON ii.product_id = p.id
            JOIN inventario.inventory_lists il ON cl.inventory_id = il.id
            JOIN inventario.stores st ON il.store_id = st.id
            LEFT JOIN inventario.szb010 szb_loc ON szb_loc.zb_filial = st.code AND szb_loc.zb_xlocal = ii.warehouse
            WHERE cl.id = :list_id
        """

        # 🎯 ADICIONAR FILTRO POR CICLO apenas se show_all=False (ANTES DO GROUP BY!)
        # ✅ v2.13.2: Mostrar produtos que PRECISAM contar OU já foram contados no ciclo ATUAL
        # Isso permite editar contagens já feitas, mas oculta produtos que bateram em ciclos anteriores
        if not show_all:
            base_query += """
                AND (
                    (cl.current_cycle = 1 AND (
                        COALESCE(cli.needs_count_cycle_1, ii.needs_recount_cycle_1, true) = true
                        OR cli.count_cycle_1 IS NOT NULL
                    ))
                    OR (cl.current_cycle = 2 AND (
                        COALESCE(cli.needs_count_cycle_2, ii.needs_recount_cycle_2, false) = true
                        OR cli.count_cycle_2 IS NOT NULL
                    ))
                    OR (cl.current_cycle = 3 AND (
                        COALESCE(cli.needs_count_cycle_3, ii.needs_recount_cycle_3, false) = true
                        OR cli.count_cycle_3 IS NOT NULL
                    ))
                )
            """

        base_query += """
            GROUP BY
                ii.id, ii.product_code, ii.expected_quantity, ii.warehouse, ii.sequence,
                cli.count_cycle_1, cli.count_cycle_2, cli.count_cycle_3,
                cli.needs_count_cycle_1, cli.needs_count_cycle_2, cli.needs_count_cycle_3,
                ii.needs_recount_cycle_1, ii.needs_recount_cycle_2, ii.needs_recount_cycle_3,
                p.description, p.unit, cl.current_cycle,
                iis.b1_desc, iis.b2_qatu, iis.b2_xentpos, iis.b2_cm1, iis.b1_rastro,
                iis.created_at, iis.bz_xlocal1, iis.bz_xlocal2, iis.bz_xlocal3,
                szb_loc.zb_xsbzlcz
            ORDER BY
                CASE COALESCE(szb_loc.zb_xsbzlcz, '1')
                    WHEN '1' THEN NULLIF(TRIM(iis.bz_xlocal1), '')
                    WHEN '2' THEN NULLIF(TRIM(iis.bz_xlocal2), '')
                    WHEN '3' THEN NULLIF(TRIM(iis.bz_xlocal3), '')
                    ELSE NULLIF(TRIM(iis.bz_xlocal1), '')
                END NULLS LAST,
                COALESCE(iis.b1_desc, p.description, ii.product_code)
        """

        query = text(base_query)

        # 🔍 DEBUG: Logar query e parâmetros
        logger.info(f"🔍 [GET PRODUCTS] Executando query com list_id: {str(list_uuid)}")

        result = db.execute(query, {"list_id": str(list_uuid)}).fetchall()

        # 🔍 DEBUG: Logar resultado
        logger.info(f"🔍 [GET PRODUCTS] Query retornou {len(result)} produtos")

        if not result:
            logger.warning(f"⚠️ [GET PRODUCTS] Nenhum produto encontrado para lista {list_uuid}")
            return {
                "success": True,
                "message": "Nenhum produto atribuído a este usuário",
                "data": {
                    "products": [],
                    "items": [],
                    "total": 0,
                    "current_cycle": _current_cycle,
                    "list_id": str(list_uuid),
                    "list_name": _list_name,
                }
            }

        items = []
        for row in result:
            # ✅ SOLUÇÃO DEFINITIVA: Retornar TODOS os ciclos para o modal
            current_cycle = row.current_cycle

            # Determinar qual contagem usar para o status atual
            count_value = None
            if current_cycle == 1:
                count_value = row.count_1
            elif current_cycle == 2:
                count_value = row.count_2
            elif current_cycle == 3:
                count_value = row.count_3

            # Determinar se o item foi resolvido em ciclo ANTERIOR (só C2+ pode ser APPROVED)
            # No C1, tudo é COUNTED ou PENDING (não existe "ciclo anterior")
            # No C2, se needs_count_cycle_2=False → resolvido no C1 → APPROVED
            # No C3, se needs_count_cycle_3=False → resolvido no C1 ou C2 → APPROVED
            resolved_in_prior_cycle = False
            if current_cycle >= 2:
                needs_c2 = row.needs_count_cycle_2 if row.needs_count_cycle_2 is not None else False
                if not needs_c2:
                    resolved_in_prior_cycle = True
            if current_cycle >= 3 and not resolved_in_prior_cycle:
                needs_c3 = row.needs_count_cycle_3 if row.needs_count_cycle_3 is not None else False
                if not needs_c3:
                    resolved_in_prior_cycle = True

            # ✅ BUSCAR COUNTINGS DETALHADOS (para rastreamento de lotes)
            # 🔧 FIX v2.17.1: Buscar apenas o ÚLTIMO registro de cada ciclo (evita duplicados)
            countings_list = []
            try:
                # Usar SQL raw com DISTINCT ON para pegar apenas o registro mais recente de cada ciclo + lote
                # 🔧 FIX v2.19.19: DISTINCT ON deve incluir lot_number para não ignorar lotes diferentes
                countings_query_text = text("""
                    SELECT DISTINCT ON (c.count_number, COALESCE(c.lot_number, ''))
                        c.count_number,
                        c.quantity,
                        c.lot_number,
                        c.serial_number,
                        c.observation,
                        c.created_at,
                        u.full_name as counter_name
                    FROM inventario.countings c
                    LEFT JOIN inventario.users u ON c.counted_by = u.id
                    WHERE c.inventory_item_id = :item_id
                    ORDER BY c.count_number ASC, COALESCE(c.lot_number, '') ASC, c.created_at DESC
                """)

                countings_result = db.execute(countings_query_text, {
                    "item_id": str(row.id)
                }).fetchall()

                for counting in countings_result:
                    countings_list.append({
                        "count_number": counting.count_number,
                        "quantity": float(counting.quantity),
                        "lot_number": counting.lot_number,
                        "serial_number": counting.serial_number,
                        "observation": counting.observation,
                        "counted_by": counting.counter_name,
                        "counted_at": counting.created_at.isoformat() if counting.created_at else None
                    })
            except Exception as e:
                logger.error(f"⚠️ Erro ao buscar countings para item {row.id}: {e}")
                # Continuar sem countings detalhados

            # 🔄 v2.17.0: BUSCAR LOTES DOS DRAFTS (para produtos que não têm snapshot_lots)
            saved_lots_list = []
            try:
                nested = db.begin_nested()
                try:
                    draft_query = text("""
                        SELECT draft_data
                        FROM inventario.lot_counting_drafts
                        WHERE inventory_item_id = :item_id
                          AND current_cycle = :cycle
                        LIMIT 1
                    """)
                    draft_result = db.execute(draft_query, {
                        'item_id': str(row.id),
                        'cycle': current_cycle
                    }).fetchone()
                    nested.commit()
                except Exception:
                    nested.rollback()
                    draft_result = None

                if draft_result and draft_result[0]:
                    draft_data = draft_result[0]
                    lots_data = draft_data.get('lots', [])
                    for lot in lots_data:
                        saved_lots_list.append({
                            "lot_number": lot.get('lot_number') or lot.get('b8_lotectl'),
                            "quantity": float(lot.get('system_qty', 0)),
                            "counted_qty": float(lot.get('counted_qty', 0)),
                            "b8_lotefor": lot.get('b8_lotefor', '')
                        })
            except Exception as e:
                logger.warning(f"⚠️ Erro ao buscar drafts para item {row.id}: {e}")

            items.append({
                "id": str(row.id),
                "product_code": row.product_code,
                "product_description": row.product_description or f"Produto {row.product_code}",
                "product_name": row.product_description or f"Produto {row.product_code}",
                # 📸 v2.10.0: Quantidade do SNAPSHOT (congelada)
                "system_qty": float(row.system_qty) if row.system_qty else 0.0,
                # ✅ v2.17.0: Entregas posteriores do snapshot
                "b2_xentpos": float(row.b2_xentpos) if row.b2_xentpos else 0.0,
                "expected_quantity": float(row.system_qty) if row.system_qty else 0.0,  # ✅ v2.10.0.18: Alias para compatibilidade
                "counted_qty": float(count_value) if count_value is not None else None,  # Compatibilidade
                # ✅ Todos os ciclos de contagem
                "count_cycle_1": float(row.count_1) if row.count_1 is not None else None,
                "count_cycle_2": float(row.count_2) if row.count_2 is not None else None,
                "count_cycle_3": float(row.count_3) if row.count_3 is not None else None,
                # ✅ Compatibilidade com frontend legado
                "count_1": float(row.count_1) if row.count_1 is not None else None,
                "count_2": float(row.count_2) if row.count_2 is not None else None,
                "count_3": float(row.count_3) if row.count_3 is not None else None,
                # ✅ Flags de controle de ciclo
                "needs_count_cycle_1": row.needs_count_cycle_1 if hasattr(row, 'needs_count_cycle_1') else True,
                "needs_count_cycle_2": row.needs_count_cycle_2 if hasattr(row, 'needs_count_cycle_2') else False,
                "needs_count_cycle_3": row.needs_count_cycle_3 if hasattr(row, 'needs_count_cycle_3') else False,
                "counted_at": None,  # Por simplicidade, removido por enquanto
                "warehouse": row.warehouse or "01",
                "unit": row.unit or "UN",
                "current_cycle": current_cycle,
                "status": "APPROVED" if resolved_in_prior_cycle else ("COUNTED" if count_value is not None else "PENDING"),
                # ✅ ADICIONAR: Informação de controle de lote
                "requires_lot": row.b1_rastro in ['L', 'S'] if row.b1_rastro else False,
                "has_lot": row.b1_rastro in ['L', 'S'] if row.b1_rastro else False,
                # ✅ NOVO: Array completo de countings com detalhes de lotes
                "countings": countings_list,
                # 📸 v2.13.0: LOTES DO SNAPSHOT (dados congelados de inventory_lots_snapshot)
                # ✅ PostgreSQL json_agg já retorna lista Python, não precisa de json.loads()
                "snapshot_lots": list(row.snapshot_lots) if hasattr(row, 'snapshot_lots') and row.snapshot_lots else [],
                # 🔄 v2.17.0: LOTES DOS DRAFTS (rascunhos salvos durante contagem)
                "saved_lots": saved_lots_list,  # ✅ Inclui b8_lotefor dos drafts
                # 📱 v2.12.0: CÓDIGOS DE BARRAS (SB1010.B1_CODBAR + SLK010)
                "barcode": row.b1_codbar if hasattr(row, 'b1_codbar') and row.b1_codbar else "",  # Código de barras principal
                "alternative_barcodes": list(row.alternative_barcodes) if hasattr(row, 'alternative_barcodes') and row.alternative_barcodes else [],  # Array de códigos alternativos
                # 📸 v2.10.0.18: CUSTO MÉDIO DO SNAPSHOT - 3 formatos para compatibilidade total
                "b2_cm1": float(row.snapshot_cost) if hasattr(row, 'snapshot_cost') and row.snapshot_cost else 0.0,  # ✅ Formato Protheus (usado pelo frontend)
                "snapshot_cost": float(row.snapshot_cost) if hasattr(row, 'snapshot_cost') and row.snapshot_cost else 0.0,  # Formato alternativo
                # 📍 v2.19.8: LOCALIZAÇÃO DINÂMICA (baseada em szb010.zb_xsbzlcz)
                "location": row.location if hasattr(row, 'location') and row.location else None,
                # 📸 v2.10.0: CAMPOS DO SNAPSHOT (objeto aninhado para compatibilidade)
                "snapshot": {
                    "cost": float(row.snapshot_cost) if hasattr(row, 'snapshot_cost') and row.snapshot_cost else 0.0,
                    "created_at": row.snapshot_created_at.isoformat() if hasattr(row, 'snapshot_created_at') and row.snapshot_created_at else None,
                    "location_1": row.bz_xlocal1 if hasattr(row, 'bz_xlocal1') else None,
                    "location_2": row.bz_xlocal2 if hasattr(row, 'bz_xlocal2') else None,
                    "location_3": row.bz_xlocal3 if hasattr(row, 'bz_xlocal3') else None,
                    "location": row.location if hasattr(row, 'location') and row.location else None  # 📍 v2.19.8
                } if hasattr(row, 'snapshot_created_at') and row.snapshot_created_at else None,
                # ✅ Campos obrigatórios para CountingListProduct
                "sequence": row.sequence if hasattr(row, 'sequence') and row.sequence else 1,
                "created_at": None,
                "finalQuantity": None,
            })

        return {
            "success": True,
            "message": f"Encontrados {len(items)} produtos para este usuário",
            "data": {
                "products": items,
                "items": items,
                "total": len(items),
                "current_cycle": _current_cycle,
                "list_id": str(list_uuid),
                "list_name": _list_name,
            }
        }

    except ValueError as e:
        return {"success": False, "message": f"Erro de validação: {str(e)}", "data": {"items": [], "total": 0}}
    except Exception as e:
        print(f"❌ Erro ao buscar produtos da lista: {e}")
        return {"success": False, "message": f"Erro interno: {str(e)}", "data": {"items": [], "total": 0}}

@app.get("/api/v1/cycles/product/{product_code}/lots", tags=["Cycles"])
async def get_product_lots_cycles(
    product_code: str,
    warehouse: str = Query("02", description="Warehouse code"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Endpoint temporário para buscar lotes de produto"""
    try:
        # Buscar lotes na SB8010
        from app.models.models import SB8010

        lots = db.query(SB8010).filter(
            SB8010.b8_produto == product_code.strip(),
            SB8010.b8_local == warehouse.strip()
        ).all()

        if not lots:
            return {
                "success": False,
                "message": f"Nenhum lote encontrado para produto {product_code}",
                "data": {"has_lots": False, "lots": []}
            }
        
        lots_data = []
        for lot in lots:
            lots_data.append({
                "lot_number": lot.b8_lotectl.strip() if lot.b8_lotectl else "",
                "b8_lotectl": lot.b8_lotectl.strip() if lot.b8_lotectl else "",  # ✅ v2.17.1: Lote cliente
                "b8_lotefor": lot.b8_lotefor.strip() if lot.b8_lotefor else "",  # ✅ v2.17.1: Lote fornecedor
                "warehouse": lot.b8_local.strip() if lot.b8_local else warehouse,
                "available_quantity": float(lot.b8_saldo or 0),
                "expiry_date": lot.b8_dtvalid.strftime("%Y%m%d") if hasattr(lot.b8_dtvalid, 'strftime') and lot.b8_dtvalid else None
            })
        
        return {
            "success": True,
            "message": f"Encontrados {len(lots_data)} lotes",
            "data": {
                "has_lots": True,
                "lots": lots_data,
                "product_code": product_code,
                "warehouse": warehouse
            }
        }
        
    except Exception as e:
        logger.error(f"Erro ao buscar lotes: {str(e)}")
        return {
            "success": False,
            "message": f"Erro ao buscar lotes: {str(e)}",
            "data": {"has_lots": False, "lots": []}
        }

# =================================
# ENDPOINT TEMPORÁRIO PARA ATUALIZAR STATUS DA LISTA
# =================================

@app.put("/api/v1/counting-lists/{list_id}/status")
async def update_list_status_temp(
    list_id: str,
    status_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Endpoint temporário para atualizar status da lista"""
    try:
        from app.models.models import CountingList

        # Buscar a lista
        counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
        if not counting_list:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de contagem não encontrada"
            )

        # Verificar permissões
        if current_user.role not in ["ADMIN", "SUPERVISOR"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas ADMIN e SUPERVISOR podem alterar status da lista"
            )

        # Atualizar status
        new_status = status_data.get("list_status")
        old_status = counting_list.list_status

        if new_status in ["PREPARACAO", "ABERTA", "EM_CONTAGEM", "ENCERRADA"]:
            # 🎯 CORREÇÃO PROFISSIONAL: Recalcular divergências ANTES de liberar para contagem
            # Garante que flags needs_count_cycle_X estejam corretas
            if new_status == "EM_CONTAGEM" and counting_list.current_cycle >= 2:
                logger.info(f"🔄 [LIBERAÇÃO] Recalculando divergências antes de liberar ciclo {counting_list.current_cycle}")

                # Calcular divergências do ciclo ANTERIOR (que acabou de ser concluído)
                previous_cycle = counting_list.current_cycle - 1

                # ✅ v2.16.0: Passar user_id e inventory_list_id para auditoria
                discrepancy_result = recalculate_discrepancies_for_list(
                    db,
                    list_id,
                    previous_cycle,
                    user_id=str(current_user.id),
                    inventory_list_id=str(counting_list.inventory_id)
                )

                if discrepancy_result["success"]:
                    logger.info(f"✅ [LIBERAÇÃO] {discrepancy_result['products_needing_recount']} produtos precisam recontagem no ciclo {counting_list.current_cycle}")
                else:
                    logger.warning(f"⚠️ [LIBERAÇÃO] Erro ao calcular divergências: {discrepancy_result['message']}")

            counting_list.list_status = new_status

            # Registrar timestamps se necessário
            if new_status == "ABERTA" and old_status == "PREPARACAO":
                from datetime import datetime
                counting_list.released_at = datetime.utcnow()
                counting_list.released_by = current_user.id
            elif new_status == "ENCERRADA":
                from datetime import datetime
                counting_list.closed_at = datetime.utcnow()
                counting_list.closed_by = current_user.id

            db.commit()

            logger.info(f"✅ Status da lista {list_id} atualizado de {old_status} para {new_status}")

            return {
                "success": True,
                "list_id": list_id,
                "old_status": old_status,
                "new_status": new_status,
                "message": "Status atualizado com sucesso"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status inválido"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao atualizar status da lista: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "interno")
        )


# ============================================
# 🎯 FUNÇÃO HELPER PROFISSIONAL
# ============================================
def recalculate_discrepancies_for_list(
    db: Session,
    list_id: str,
    current_cycle: int,
    user_id: Optional[str] = None,
    inventory_list_id: Optional[str] = None
) -> dict:
    """
    Recalcula divergências para uma lista específica baseado no ciclo atual.

    Esta função DEVE ser chamada:
    1. ANTES de validar encerramento de lista (garante flags corretas)
    2. QUANDO liberar lista para próximo ciclo (prepara flags para recontagem)

    Args:
        db: Sessão do banco de dados
        list_id: ID da lista de contagem
        current_cycle: Ciclo atual da lista (1, 2 ou 3)
        user_id: ID do usuário (opcional, para auditoria v2.16.0)
        inventory_list_id: ID do inventário (opcional, para auditoria v2.16.0)

    Returns:
        dict com informações sobre o cálculo:
        - success: bool
        - cycle: int
        - products_updated: int
        - products_needing_recount: int
        - message: str
    """
    try:
        logger.info(f"🔄 [RECALC DISCREPANCIES] Iniciando recálculo para lista {list_id[:8]}... ciclo {current_cycle}")

        if current_cycle == 1:
            # CICLO 1 → CICLO 2
            # ✅ v2.11.0: Comparar count_cycle_1 vs expected_quantity
            # ✅ v2.19.36: CORREÇÃO CRÍTICA - Usar snapshot (iis.b2_qatu) como fonte da verdade
            # Isso corrige o bug onde expected_quantity pode estar errado devido a filtro de filial faltando
            calc_query = text("""
                UPDATE inventario.counting_list_items cli
                SET needs_count_cycle_2 = CASE
                    -- ✅ CASO ESPECIAL v2.17.4: Zero confirmado (esperado=0 + campo vazio = confirmação de zero)
                    WHEN (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0)) = 0
                         AND cli.count_cycle_1 IS NULL
                    THEN false  -- NÃO precisa recontagem (zero confirmado)
                    -- CASO 1: Produto foi contado no ciclo 1 mas divergiu
                    -- ✅ v2.19.55: CORREÇÃO CRÍTICA - Somar entregas posteriores (b2_xentpos) ao esperado
                    WHEN cli.count_cycle_1 IS NOT NULL
                         AND COALESCE(iis.b2_qatu, ii.expected_quantity) IS NOT NULL
                         AND ABS(cli.count_cycle_1 - (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0))) > 0.01
                    THEN true
                    -- CASO 2: Produto deveria ter sido contado no ciclo 1 mas NÃO foi (pendente)
                    WHEN cli.needs_count_cycle_1 = true
                         AND cli.count_cycle_1 IS NULL
                    THEN true
                    ELSE false
                END
                FROM inventario.inventory_items ii
                LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
                WHERE cli.inventory_item_id = ii.id
                  AND cli.counting_list_id = :list_id
            """)

            result = db.execute(calc_query, {"list_id": list_id})
            products_updated = result.rowcount

            # Contar quantos precisam de recontagem
            count_query = text("""
                SELECT COUNT(*) as total
                FROM inventario.counting_list_items
                WHERE counting_list_id = :list_id
                  AND needs_count_cycle_2 = true
            """)

            count_result = db.execute(count_query, {"list_id": list_id}).fetchone()
            products_needing_recount = count_result.total if count_result else 0

            logger.info(f"✅ [RECALC] Ciclo 1→2: {products_updated} produtos analisados, {products_needing_recount} precisam recontagem")

            # ✅ v2.16.0: AUDIT LOG - Registrar recálculo de divergências
            if audit_service and user_id and inventory_list_id:
                try:
                    audit_service.log_recalculate_discrepancies(
                        db=db,
                        inventory_list_id=inventory_list_id,
                        user_id=user_id,
                        current_cycle=current_cycle,
                        products_recalculated=products_updated,
                        new_divergences=products_needing_recount
                    )
                    db.commit()
                except Exception as audit_error:
                    logger.warning(f"⚠️ [AUDIT] Erro ao registrar recálculo: {audit_error}")

            return {
                "success": True,
                "cycle": current_cycle,
                "products_updated": products_updated,
                "products_needing_recount": products_needing_recount,
                "message": f"Divergências calculadas para ciclo {current_cycle}"
            }

        elif current_cycle == 2:
            # CICLO 2 → CICLO 3
            # ✅ v2.19.10: CORREÇÃO CRÍTICA - Lógica correta de divergência no ciclo 2
            # Regra 1: count_2 == expected → OK (sem divergência)
            # Regra 2: count_2 != expected MAS count_2 == count_1 → OK (confirmado pelo operador)
            # Regra 3: count_2 != expected E count_2 != count_1 → precisa ciclo 3
            # ✅ v2.11.0: NOVO - Produtos pendentes do ciclo 2 vão para ciclo 3
            # ✅ v2.19.36: CORREÇÃO CRÍTICA - Usar snapshot (iis.b2_qatu) como fonte da verdade
            calc_query = text("""
                UPDATE inventario.counting_list_items cli
                SET needs_count_cycle_3 = CASE
                    -- ✅ CASO ESPECIAL v2.17.4: Zero confirmado (esperado=0 + campo vazio = confirmação de zero)
                    WHEN (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0)) = 0
                         AND cli.count_cycle_2 IS NULL
                    THEN false  -- NÃO precisa recontagem (zero confirmado)

                    -- ✅ v2.19.10: CASO 1 - count_2 bate com expected → OK
                    -- ✅ v2.19.55: CORREÇÃO CRÍTICA - Somar entregas posteriores (b2_xentpos) ao esperado
                    WHEN cli.count_cycle_2 IS NOT NULL
                         AND COALESCE(iis.b2_qatu, ii.expected_quantity) IS NOT NULL
                         AND ABS(cli.count_cycle_2 - (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0))) <= 0.01
                    THEN false  -- Bateu com esperado

                    -- ✅ v2.19.10: CASO 2 - count_2 bate com count_1 → CONFIRMADO
                    WHEN cli.count_cycle_2 IS NOT NULL
                         AND cli.count_cycle_1 IS NOT NULL
                         AND ABS(cli.count_cycle_2 - cli.count_cycle_1) <= 0.01
                    THEN false  -- Contagem confirmada (count_2 == count_1)

                    -- ✅ v2.19.10: CASO 3 - count_2 diverge de expected E diverge de count_1 → CICLO 3
                    -- ✅ v2.19.55: CORREÇÃO CRÍTICA - Somar entregas posteriores (b2_xentpos) ao esperado
                    WHEN cli.count_cycle_2 IS NOT NULL
                         AND COALESCE(iis.b2_qatu, ii.expected_quantity) IS NOT NULL
                         AND ABS(cli.count_cycle_2 - (COALESCE(iis.b2_qatu, ii.expected_quantity, 0) + COALESCE(iis.b2_xentpos, 0))) > 0.01
                         AND (cli.count_cycle_1 IS NULL OR ABS(cli.count_cycle_2 - cli.count_cycle_1) > 0.01)
                    THEN true  -- Precisa desempate no ciclo 3

                    -- CASO 4: Produto deveria ter sido contado no ciclo 2 mas NÃO foi (pendente)
                    WHEN cli.needs_count_cycle_2 = true
                         AND cli.count_cycle_2 IS NULL
                    THEN true

                    ELSE false
                END
                FROM inventario.inventory_items ii
                LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id = ii.id
                WHERE cli.inventory_item_id = ii.id
                  AND cli.counting_list_id = :list_id
            """)

            result = db.execute(calc_query, {"list_id": list_id})
            products_updated = result.rowcount

            # Contar quantos precisam de desempate
            count_query = text("""
                SELECT COUNT(*) as total
                FROM inventario.counting_list_items
                WHERE counting_list_id = :list_id
                  AND needs_count_cycle_3 = true
            """)

            count_result = db.execute(count_query, {"list_id": list_id}).fetchone()
            products_needing_recount = count_result.total if count_result else 0

            logger.info(f"✅ [RECALC] Ciclo 2→3: {products_updated} produtos analisados, {products_needing_recount} precisam desempate")

            # ✅ v2.16.0: AUDIT LOG - Registrar recálculo de divergências
            if audit_service and user_id and inventory_list_id:
                try:
                    audit_service.log_recalculate_discrepancies(
                        db=db,
                        inventory_list_id=inventory_list_id,
                        user_id=user_id,
                        current_cycle=current_cycle,
                        products_recalculated=products_updated,
                        new_divergences=products_needing_recount
                    )
                    db.commit()
                except Exception as audit_error:
                    logger.warning(f"⚠️ [AUDIT] Erro ao registrar recálculo: {audit_error}")

            return {
                "success": True,
                "cycle": current_cycle,
                "products_updated": products_updated,
                "products_needing_recount": products_needing_recount,
                "message": f"Divergências calculadas para ciclo {current_cycle}"
            }

        else:
            # Ciclo 3 não calcula divergências (é o último)
            logger.info(f"ℹ️ [RECALC] Ciclo 3 não requer cálculo de divergências")
            return {
                "success": True,
                "cycle": current_cycle,
                "products_updated": 0,
                "products_needing_recount": 0,
                "message": "Ciclo 3 não requer cálculo de divergências"
            }

    except Exception as e:
        logger.error(f"❌ [RECALC] Erro ao recalcular divergências: {e}")
        return {
            "success": False,
            "cycle": current_cycle,
            "products_updated": 0,
            "products_needing_recount": 0,
            "message": f"Erro: {str(e)}"
        }


@app.post("/api/v1/counting-lists/{list_id}/encerrar")
async def encerrar_lista_ciclo(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Encerrar lista com lógica de ciclos:
    - EM_CONTAGEM + Ciclo 1 -> ABERTA + Ciclo 2
    - EM_CONTAGEM + Ciclo 2 -> ABERTA + Ciclo 3
    - EM_CONTAGEM + Ciclo 3 -> ENCERRADA
    """
    logger.info(f"🔵 [ENCERRAR] Requisição recebida para lista: {list_id}")
    logger.info(f"👤 [ENCERRAR] Usuário: {current_user.username}")

    try:
        from app.models.models import CountingList

        # Buscar a lista
        counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
        if not counting_list:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de contagem não encontrada"
            )

        # Verificar se está em contagem (aceita ABERTA ou EM_CONTAGEM)
        if counting_list.list_status not in ["EM_CONTAGEM", "ABERTA"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lista deve estar 'Aberta' ou 'Em Contagem' para ser encerrada. Status atual: {counting_list.list_status}"
            )

        # 🎯 CORREÇÃO PROFISSIONAL CRÍTICA: Recalcular divergências ANTES de validar
        # Isso garante que needs_count_cycle_X sempre reflita o estado atual das contagens
        current_cycle = counting_list.current_cycle
        logger.info(f"🔄 [ENCERRAR] ETAPA 1: Recalculando divergências para ciclo {current_cycle}")

        # ✅ v2.16.0: Passar user_id e inventory_list_id para auditoria
        discrepancy_result = recalculate_discrepancies_for_list(
            db,
            list_id,
            current_cycle,
            user_id=str(current_user.id),
            inventory_list_id=str(counting_list.inventory_id)
        )

        if discrepancy_result["success"]:
            logger.info(f"✅ [ENCERRAR] Divergências atualizadas: {discrepancy_result['products_needing_recount']} produtos precisam recontagem")
        else:
            logger.warning(f"⚠️ [ENCERRAR] Erro ao calcular divergências: {discrepancy_result['message']}")

        # Commit para garantir que as flags foram atualizadas ANTES de validar
        db.commit()
        logger.info(f"💾 [ENCERRAR] Flags de divergência salvas no banco")

        # ❌ v2.10.0.20: REMOVIDA HERANÇA AUTOMÁTICA (causava bug)
        # BUG: Produtos que bateram na 1ª contagem tinham count_cycle_2 preenchido automaticamente
        # CORRETO: Se produto NÃO precisa de recontagem, count_cycle_X deve permanecer NULL
        # Isso indica claramente que o produto NÃO foi recontado (bateu em ciclo anterior)

        # Regra correta:
        # - needs_count_cycle_2 = false → count_cycle_2 = NULL (não foi recontado, bateu no ciclo 1)
        # - needs_count_cycle_2 = true → count_cycle_2 = valor digitado (foi recontado)

        # A herança automática poluía os dados e confundia a análise
        # Sistema de cálculo (calculateFinalQuantityByMajority) já trata corretamente NULL

        from app.models.models import CountingListItem
        from sqlalchemy import text

        logger.info(f"✅ [HERANÇA REMOVIDA] Produtos que bateram permanecem com count_cycle NULL (correto)")

        # ✅ VALIDAÇÃO CRÍTICA: Verificar se produtos da lista foram contados
        # CORREÇÃO: Não validar por needs_count_cycle (essa flag é para recontagem)
        # Validar apenas se há produtos na lista e se foram contados

        # Contar TOTAL de produtos na lista e quantos foram contados
        total_pending = 0
        total_counted = 0

        if current_cycle == 1:
            # Ciclo 1: Contar TODOS os produtos da lista
            total_pending = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id
            ).count()

            # Contar quantos TÊM contagem (independente da flag)
            total_counted = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.count_cycle_1.isnot(None)
            ).count()

        elif current_cycle == 2:
            # Ciclo 2: Contar produtos que PRECISAM recontagem (needs_count_cycle_2 = true)
            total_pending = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.needs_count_cycle_2 == True
            ).count()

            # Contar quantos TÊM contagem do ciclo 2 (INDEPENDENTE da flag - corrigido v2.11.0)
            # ✅ CORREÇÃO: Quando salva contagem, needs_count_cycle_2 vira false
            # Então não podemos filtrar por essa flag ao contar produtos contados
            total_counted = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.count_cycle_2.isnot(None)
            ).count()

        elif current_cycle == 3:
            # Ciclo 3: Contar produtos que PRECISAM desempate (needs_count_cycle_3 = true)
            total_pending = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.needs_count_cycle_3 == True
            ).count()

            # Contar quantos TÊM contagem do ciclo 3 (INDEPENDENTE da flag - corrigido v2.11.0)
            # ✅ CORREÇÃO: Quando salva contagem, needs_count_cycle_3 vira false
            # Então não podemos filtrar por essa flag ao contar produtos contados
            total_counted = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.count_cycle_3.isnot(None)
            ).count()

        logger.info(f"📊 [VALIDAÇÃO] Ciclo {current_cycle}: {total_counted}/{total_pending} produtos contados")

        # ✅ v2.10.0.19: REGRAS DE VALIDAÇÃO DE ENCERRAMENTO
        # Regra 1: Lista vazia = BLOQUEAR
        # Regra 2: NENHUM produto contado = BLOQUEAR
        # Regra 3: ALGUNS produtos não contados = PERMITIR (não contados = qtd 0)

        if total_pending == 0:
            if current_cycle == 1:
                # CICLO 1: Lista vazia é um erro
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nenhum produto foi atribuído para contagem no ciclo 1. Lista pode estar vazia."
                )
            else:
                # CICLO 2/3: Sem divergências! Permitir encerramento automático
                logger.info(f"✅ [ENCERRAMENTO AUTOMÁTICO] Ciclo {current_cycle} sem divergências - lista será encerrada automaticamente")

        # ✅ VALIDAÇÃO CRÍTICA: BLOQUEAR se NENHUM produto foi contado
        if total_counted == 0 and total_pending > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Não é possível encerrar a lista. Nenhum produto foi contado no ciclo {current_cycle}. Realize a contagem de pelo menos um produto."
            )

        # ✅ v2.10.0.19: PERMITIR ENCERRAMENTO com ALGUNS produtos não contados
        # Regra: Produtos não contados = quantidade 0 (não existe fisicamente)
        if total_pending > 0 and total_counted < total_pending:
            produtos_faltantes = total_pending - total_counted
            logger.warning(f"⚠️ [ENCERRAMENTO] {produtos_faltantes} produto(s) não foram contados no ciclo {current_cycle} - serão considerados como quantidade 0")
            # Continuar normalmente - produtos não contados = qtd 0

        logger.info(f"✅ [VALIDAÇÃO] Encerramento permitido - {total_counted} produtos contados, {total_pending - total_counted if total_pending > 0 else 0} não contados (= qtd 0)")

        old_cycle = counting_list.current_cycle
        old_status = counting_list.list_status

        # 🎯 VERIFICAR se há divergências que exigem próximo ciclo
        # ℹ️ As divergências já foram calculadas no início do endpoint via recalculate_discrepancies_for_list()
        needs_next_cycle = False

        if counting_list.current_cycle == 1:
            # Após 1º ciclo, verificar se há produtos que precisam de 2ª contagem
            needs_next_cycle = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.needs_count_cycle_2 == True
            ).count() > 0

            logger.info(f"🔍 [DIVERGÊNCIAS] Ciclo 1: {'TEM' if needs_next_cycle else 'NÃO TEM'} produtos que precisam de 2ª contagem")

        elif counting_list.current_cycle == 2:
            # Após 2º ciclo, verificar se há produtos que precisam de 3ª contagem
            needs_next_cycle = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.needs_count_cycle_3 == True
            ).count() > 0

            logger.info(f"🔍 [DIVERGÊNCIAS] Ciclo 2: {'TEM' if needs_next_cycle else 'NÃO TEM'} produtos que precisam de 3ª contagem")

        # Lógica de progressão de ciclos
        if counting_list.current_cycle < 3 and needs_next_cycle:
            # Ciclo 1 ou 2 -> avança para próximo ciclo e volta para ABERTA
            old_cycle = counting_list.current_cycle
            new_cycle = counting_list.current_cycle + 1
            counting_list.list_status = "ABERTA"
            new_status = "ABERTA"

            # ✅ v2.15.5: SINCRONIZAÇÃO CONDICIONAL
            # Se há apenas 1 lista: sincronizar inventory_lists com counting_lists
            # Se há múltiplas listas: manter isolamento (cada lista em seu ciclo)

            # Contar quantas counting_lists existem para este inventário
            total_lists = db.query(CountingList).filter(
                CountingList.inventory_id == counting_list.inventory_id
            ).count()

            # Atualizar esta lista específica
            counting_list.current_cycle = new_cycle

            if total_lists == 1:
                # ✅ SINCRONIZAR: Quando há apenas 1 lista, manter inventory_lists sincronizado
                from app.models.models import InventoryList as InventoryListModel
                inventory_list = db.query(InventoryListModel).filter(
                    InventoryListModel.id == counting_list.inventory_id
                ).first()
                if inventory_list:
                    inventory_list.current_cycle = new_cycle
                    logger.info(f"✅ [SYNC] Lista única detectada - sincronizado inventory_lists.current_cycle = {new_cycle}")
            else:
                # ℹ️ ISOLAMENTO: Múltiplas listas, cada uma mantém seu ciclo
                logger.info(f"ℹ️ [ISOLAMENTO] {total_lists} listas existem - Lista {list_id} avançada para ciclo {new_cycle}, outras listas mantêm seus ciclos")

            # 🧹 LIMPAR RASCUNHOS DO CICLO ANTERIOR ao avançar
            try:
                nested = db.begin_nested()
                try:
                    cleanup_query = text("""
                        DELETE FROM inventario.lot_counting_drafts
                        WHERE inventory_item_id IN (
                            SELECT id FROM inventario.inventory_items
                            WHERE inventory_list_id = :inventory_id
                        )
                        AND current_cycle = :old_cycle
                    """)
                    result = db.execute(cleanup_query, {
                        "inventory_id": counting_list.inventory_id,
                        "old_cycle": old_cycle
                    })
                    nested.commit()
                    logger.info(f"🧹 Rascunhos do ciclo {old_cycle} limpos: {result.rowcount} registros removidos")
                except Exception:
                    nested.rollback()
                    logger.warning(f"⚠️ Tabela lot_counting_drafts não existe, limpeza ignorada")
            except Exception as cleanup_error:
                logger.warning(f"⚠️ Erro ao limpar rascunhos do ciclo anterior: {cleanup_error}")

            # Atribuir automaticamente o contador do ciclo atual ao próximo ciclo
            if new_cycle == 2:
                # Passando do ciclo 1 para 2 - copiar contador do ciclo 1 para ciclo 2
                counting_list.counter_cycle_2 = counting_list.counter_cycle_1
                logger.info(f"✅ Contador atribuído automaticamente ao ciclo 2: {counting_list.counter_cycle_1}")
            elif new_cycle == 3:
                # Passando do ciclo 2 para 3 - copiar contador do ciclo 2 para ciclo 3
                counting_list.counter_cycle_3 = counting_list.counter_cycle_2
                logger.info(f"✅ Contador atribuído automaticamente ao ciclo 3: {counting_list.counter_cycle_2}")

            message = f"Lista encerrada. Avançando para {new_cycle}º ciclo devido a divergências."

        elif counting_list.current_cycle < 3 and not needs_next_cycle:
            # 🎯 ENCERRAMENTO AUTOMÁTICO: Ciclo 1 ou 2 SEM divergências -> Encerra direto
            counting_list.list_status = "ENCERRADA"
            counting_list.finalization_type = 'automatic'  # Encerrado automaticamente (sem divergências)
            new_status = "ENCERRADA"
            new_cycle = counting_list.current_cycle  # Mantém ciclo atual
            message = f"✅ Lista finalizada automaticamente no {old_cycle}º ciclo (sem divergências)."
            logger.info(f"✅ [ENCERRAMENTO AUTOMÁTICO] Lista encerrada no ciclo {old_cycle} - NENHUMA divergência encontrada!")

        else:
            # Ciclo 3 -> ENCERRADA (fim do processo)
            counting_list.list_status = "ENCERRADA"
            counting_list.finalization_type = 'automatic'  # Sistema encerrou automaticamente após 3 ciclos completos
            new_status = "ENCERRADA"
            new_cycle = 3
            message = "Lista finalizada após 3º ciclo."
            logger.info(f"✅ [TIPO FINALIZAÇÃO] Lista marcada como AUTOMÁTICA (completou 3 ciclos)")

        # Registrar timestamp de encerramento (só se realmente encerrou)
        if new_status == "ENCERRADA":
            from datetime import datetime
            counting_list.closed_at = datetime.utcnow()
            counting_list.closed_by = current_user.id

        db.commit()

        # ✅ v2.16.0: AUDIT LOG - Registrar encerramento de ciclo
        if audit_service:
            try:
                # Calcular métricas para auditoria
                products_pending = total_pending - total_counted if total_pending > 0 else 0
                divergences_count = db.query(CountingListItem).filter(
                    CountingListItem.counting_list_id == list_id,
                    (CountingListItem.needs_count_cycle_2 == True) |
                    (CountingListItem.needs_count_cycle_3 == True)
                ).count() if needs_next_cycle else 0

                # Log de encerramento de ciclo
                audit_service.log_cycle_end(
                    db=db,
                    inventory_list_id=counting_list.inventory_id,
                    counting_list_id=list_id,
                    user_id=current_user.id,
                    old_cycle=old_cycle,
                    new_cycle=new_cycle,
                    products_counted=total_counted,
                    products_pending=products_pending,
                    divergences=divergences_count
                )

                # Log adicional de sincronização se foi feita
                if total_lists == 1 and old_cycle != new_cycle:
                    audit_service.log_cycle_sync(
                        db=db,
                        inventory_list_id=counting_list.inventory_id,
                        counting_list_id=list_id,
                        user_id=current_user.id,
                        old_cycle=old_cycle,
                        new_cycle=new_cycle,
                        reason=f"Sincronização automática - lista única avançou do ciclo {old_cycle} para {new_cycle}"
                    )

                db.commit()  # Commit dos logs de auditoria
            except Exception as audit_error:
                logger.warning(f"⚠️ [AUDIT] Erro ao registrar log de auditoria: {audit_error}")
                # Não propaga erro - auditoria não deve bloquear operação

        logger.info(f"✅ Lista {list_id} encerrada: Ciclo {old_cycle} -> {new_cycle}, Status: {old_status} -> {new_status}")

        return {
            "success": True,
            "list_id": list_id,
            "old_status": old_status,
            "new_status": new_status,
            "old_cycle": old_cycle,
            "new_cycle": new_cycle,
            "message": message
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao encerrar lista: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "interno")
        )


@app.get("/api/v1/counting-lists-new/{inventory_id}")
async def get_new_counting_lists(
    inventory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Buscar listas de contagem do novo sistema (tabela counting_lists)
    """
    try:
        from app.models.models import CountingList, CountingListItem, InventoryItem, User, InventoryList

        # Buscar inventário pai para pegar finalization_type
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
        finalization_type = inventory.finalization_type if inventory and hasattr(inventory, 'finalization_type') else 'automatic'

        # Buscar listas de contagem do inventário
        counting_lists = db.query(CountingList).filter(
            CountingList.inventory_id == inventory_id
        ).all()

        result = []
        for counting_list in counting_lists:
            # ✅ CORREÇÃO: Buscar usuário responsável pelo CICLO ATUAL
            user_id = None
            if counting_list.current_cycle == 1 and counting_list.counter_cycle_1:
                user_id = counting_list.counter_cycle_1
            elif counting_list.current_cycle == 2 and counting_list.counter_cycle_2:
                user_id = counting_list.counter_cycle_2
            elif counting_list.current_cycle == 3 and counting_list.counter_cycle_3:
                user_id = counting_list.counter_cycle_3

            # Fallback: se não tiver usuário no ciclo atual, usar counter_cycle_1
            if not user_id:
                user_id = counting_list.counter_cycle_1

            counter_name = "Sem atribuição"
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    counter_name = user.full_name or user.username

            # Contar produtos da lista
            total_products = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == counting_list.id
            ).count()

            # Contar produtos já contados (aproximação)
            counted_items = 0

            result.append({
                "list_id": str(counting_list.id),
                "list_name": counting_list.list_name,
                "description": counting_list.description,
                "list_status": counting_list.list_status,
                "current_cycle": counting_list.current_cycle,
                "counter_name": counter_name,
                "counter_cycle_1": str(counting_list.counter_cycle_1) if counting_list.counter_cycle_1 else None,
                "counter_cycle_2": str(counting_list.counter_cycle_2) if counting_list.counter_cycle_2 else None,
                "counter_cycle_3": str(counting_list.counter_cycle_3) if counting_list.counter_cycle_3 else None,
                "total_products": total_products,
                "counted_items": counted_items,
                "created_at": counting_list.created_at.isoformat() if counting_list.created_at else None,
                "updated_at": counting_list.updated_at.isoformat() if counting_list.updated_at else None,
                "finalization_type": counting_list.finalization_type if hasattr(counting_list, 'finalization_type') else 'automatic'  # 🎯 CORRIGIDO: Usar finalization_type da counting_list individual
            })

        logger.info(f"✅ Encontradas {len(result)} listas de contagem para inventário {inventory_id}")

        return {
            "success": True,
            "data": result,
            "message": f"Encontradas {len(result)} listas de contagem"
        }

    except Exception as e:
        logger.error(f"❌ Erro ao buscar listas de contagem: {e}")
        return {
            "success": False,
            "data": [],
            "message": f"Erro ao buscar listas: {str(e)}"
        }


@app.post("/api/v1/counting-lists/{list_id}/finalize-cycle", tags=["Counting Lists"])
async def finalize_counting_cycle(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalizar o ciclo atual e avançar para o próximo.
    - Valida que existem contagens no ciclo atual
    - Recalcula divergências
    - Avança current_cycle + 1
    - Muda status para ABERTA (pronto para trocar contador e liberar)
    """
    try:
        from app.models.models import CountingList, CountingListItem
        from datetime import datetime

        counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
        if not counting_list:
            raise HTTPException(status_code=404, detail="Lista de contagem não encontrada")

        if current_user.role not in ["ADMIN", "SUPERVISOR"]:
            raise HTTPException(status_code=403, detail="Apenas ADMIN e SUPERVISOR podem finalizar ciclos")

        if counting_list.list_status == "ENCERRADA":
            raise HTTPException(status_code=400, detail="Lista já está encerrada")

        old_cycle = counting_list.current_cycle

        if old_cycle >= 3:
            raise HTTPException(status_code=400, detail="Já está no 3o ciclo. Use 'Encerrar' para finalizar a lista.")

        # Validar que existem contagens no ciclo atual
        if old_cycle == 1:
            has_counts = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.count_cycle_1.isnot(None)
            ).first() is not None
        elif old_cycle == 2:
            has_counts = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.count_cycle_2.isnot(None)
            ).first() is not None
        else:
            has_counts = True

        if not has_counts:
            raise HTTPException(
                status_code=400,
                detail=f"É necessário ter ao menos 1 produto contado no {old_cycle}o ciclo antes de finalizar."
            )

        # Recalcular divergências para determinar quais produtos precisam recontagem
        discrepancy_result = recalculate_discrepancies_for_list(
            db, list_id, old_cycle,
            user_id=str(current_user.id),
            inventory_list_id=str(counting_list.inventory_id)
        )

        products_needing_recount = discrepancy_result.get("products_needing_recount", 0) if discrepancy_result.get("success") else 0

        if products_needing_recount == 0:
            # Sem divergências: encerrar lista automaticamente
            counting_list.list_status = "ENCERRADA"
            counting_list.finalization_type = "automatic"
            counting_list.updated_at = datetime.utcnow()
            new_cycle = old_cycle  # Mantém ciclo atual
            message = f"Lista finalizada automaticamente no {old_cycle}o ciclo (sem divergencias)."
        else:
            # Com divergências: avançar para próximo ciclo
            new_cycle = old_cycle + 1
            counting_list.current_cycle = new_cycle
            counting_list.list_status = "ABERTA"  # Pronto para trocar contador e liberar
            counting_list.updated_at = datetime.utcnow()
            message = f"Ciclo {old_cycle}o finalizado. Avancado para {new_cycle}o ciclo com {products_needing_recount} produtos para recontagem."

        # Sincronizar current_cycle no inventário pai (para exibição correta na tela de contagem)
        from app.models.models import InventoryList as InventoryListModel
        parent_inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == counting_list.inventory_id
        ).first()
        if parent_inventory:
            parent_inventory.current_cycle = new_cycle
            parent_inventory.updated_at = datetime.utcnow()

        db.commit()

        logger.info(f"✅ Ciclo {old_cycle} finalizado para lista {list_id}. Novo ciclo: {new_cycle}. Produtos para recontagem: {products_needing_recount}")

        return {
            "success": True,
            "list_id": list_id,
            "old_cycle": old_cycle,
            "new_cycle": new_cycle,
            "products_needing_recount": products_needing_recount,
            "auto_closed": products_needing_recount == 0,
            "message": message
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao finalizar ciclo: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao finalizar ciclo"))


@app.put("/api/v1/counting-lists/{list_id}", tags=["Counting Lists"])
async def update_counting_list(
    list_id: str,
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualizar dados de uma lista de contagem (nome, descrição, contadores).
    Permite trocar contadores entre ciclos.
    """
    try:
        from app.models.models import CountingList
        from datetime import datetime

        counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
        if not counting_list:
            raise HTTPException(status_code=404, detail="Lista de contagem não encontrada")

        if current_user.role not in ["ADMIN", "SUPERVISOR"]:
            raise HTTPException(status_code=403, detail="Apenas ADMIN e SUPERVISOR podem editar listas")

        # Campos atualizáveis
        allowed_fields = ["list_name", "description", "counter_cycle_1", "counter_cycle_2", "counter_cycle_3"]
        for field in allowed_fields:
            if field in update_data and update_data[field] is not None:
                setattr(counting_list, field, update_data[field])

        counting_list.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(counting_list)

        logger.info(f"✅ Lista {list_id} atualizada: {list(update_data.keys())}")

        return {
            "success": True,
            "id": str(counting_list.id),
            "list_name": counting_list.list_name,
            "current_cycle": counting_list.current_cycle,
            "list_status": counting_list.list_status,
            "counter_cycle_1": str(counting_list.counter_cycle_1) if counting_list.counter_cycle_1 else None,
            "counter_cycle_2": str(counting_list.counter_cycle_2) if counting_list.counter_cycle_2 else None,
            "counter_cycle_3": str(counting_list.counter_cycle_3) if counting_list.counter_cycle_3 else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao atualizar lista: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao atualizar lista"))


@app.post("/api/v1/counting-lists/{list_id}/finalizar")
async def finalizar_lista_forcada(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalizar lista forçadamente (independente do ciclo atual)
    """
    logger.info(f"🔴 [FINALIZAR] Requisição recebida para lista: {list_id}")
    logger.info(f"👤 [FINALIZAR] Usuário: {current_user.username}")

    try:
        from app.models.models import CountingList

        # Buscar a lista
        counting_list = db.query(CountingList).filter(CountingList.id == list_id).first()
        if not counting_list:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de contagem não encontrada"
            )

        # Verificar se não está já encerrada
        if counting_list.list_status == "ENCERRADA":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lista já está encerrada"
            )

        old_status = counting_list.list_status
        old_cycle = counting_list.current_cycle

        # ✅ VALIDAÇÃO CRÍTICA: Verificar contagens por ciclo
        from app.models.models import CountingListItem
        from sqlalchemy import or_

        # CICLO 1: Deve ter contagens do ciclo 1
        if old_cycle == 1:
            has_cycle_1 = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.count_cycle_1.isnot(None)
            ).first() is not None

            if not has_cycle_1:
                raise HTTPException(
                    status_code=400,
                    detail=f"É necessário ter ao menos 1 produto contado no {old_cycle}º ciclo. Se não há contagens, use a opção EXCLUIR"
                )

            logger.info(f"✅ [VALIDAÇÃO FINALIZAR] Lista {list_id} tem contagens no ciclo {old_cycle}")

        # CICLO 2: Deve ter contagens do ciclo 1 OU ciclo 2
        elif old_cycle == 2:
            has_any_count = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                or_(
                    CountingListItem.count_cycle_1.isnot(None),
                    CountingListItem.count_cycle_2.isnot(None)
                )
            ).first() is not None

            if not has_any_count:
                raise HTTPException(
                    status_code=400,
                    detail=f"É necessário ter contagens registradas. Ciclo atual: {old_cycle}º"
                )

            logger.info(f"✅ [VALIDAÇÃO FINALIZAR] Lista {list_id} tem contagens válidas para finalização no ciclo {old_cycle}")

        # CICLO 3: Se TEM contagens do ciclo 3, NÃO pode finalizar (deve ENCERRAR)
        elif old_cycle == 3:
            has_cycle_3 = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                CountingListItem.count_cycle_3.isnot(None)
            ).first() is not None

            if has_cycle_3:
                raise HTTPException(
                    status_code=400,
                    detail=f"Lista com contagens do 3º ciclo deve ser encerrada pelo botão ENCERRAR, não FINALIZAR"
                )

            # Se NÃO tem contagens do ciclo 3, verificar se tem de ciclos anteriores
            has_previous_counts = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id == list_id,
                or_(
                    CountingListItem.count_cycle_1.isnot(None),
                    CountingListItem.count_cycle_2.isnot(None)
                )
            ).first() is not None

            if not has_previous_counts:
                raise HTTPException(
                    status_code=400,
                    detail=f"É necessário ter contagens de ciclos anteriores para finalizar no 3º ciclo"
                )

            logger.info(f"✅ [VALIDAÇÃO FINALIZAR] Lista {list_id} validada para finalização no ciclo {old_cycle} (sem contagens do ciclo 3)")

        # Forçar encerramento
        counting_list.list_status = "ENCERRADA"

        # Registrar timestamp
        from datetime import datetime
        counting_list.closed_at = datetime.utcnow()
        counting_list.closed_by = current_user.id

        # 🎯 MARCAR TIPO DE FINALIZAÇÃO NA COUNTING_LIST
        # LÓGICA SIMPLIFICADA:
        # - Automática: Completou 3 ciclos (passou pelos 3 encerramentos)
        # - Manual: Finalizada antes do 3º ciclo (botão "Finalizar")

        if old_cycle == 3:
            # Finalizado no ciclo 3 = sempre AUTOMÁTICA (completou os 3 ciclos)
            counting_list.finalization_type = 'automatic'
            logger.info(f"✅ [TIPO FINALIZAÇÃO] Lista marcada como AUTOMÁTICA (completou 3 ciclos)")
        else:
            # Finalizado antes do ciclo 3 = sempre MANUAL (interrompeu antes de completar)
            counting_list.finalization_type = 'manual'
            logger.info(f"✅ [TIPO FINALIZAÇÃO] Lista marcada como MANUAL (finalizada no ciclo {old_cycle}, antes de completar 3 ciclos)")

        db.commit()

        logger.info(f"✅ Lista {list_id} finalizada forçadamente no ciclo {old_cycle}")

        return {
            "success": True,
            "list_id": list_id,
            "old_status": old_status,
            "new_status": "ENCERRADA",
            "old_cycle": old_cycle,
            "new_cycle": old_cycle,
            "message": f"Lista finalizada forçadamente no {old_cycle}º ciclo"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao finalizar lista: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "interno")
        )

# =================================
# ENDPOINT DIRETO PARA CONTAGEM MULTILISTA
@app.post("/api/v1/counting-lists/{list_id}/save-count")
async def save_count_multilista_direct(
    list_id: str,
    request_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint direto para salvar contagem em lista específica.
    Solução definitiva para o sistema multilista.
    """
    try:
        # Extrair dados do request
        inventory_item_id = request_data.get('inventory_item_id')
        quantity = float(request_data.get('quantity', 0))
        lot_number = request_data.get('lot_number', '')  # ✅ v2.11.0: Extrair lot_number

        if not inventory_item_id:
            raise HTTPException(status_code=400, detail="inventory_item_id é obrigatório")

        logger.info(f"📝 [MULTILISTA] Salvando contagem na lista {list_id} pelo usuário {current_user.username}")
        if lot_number:
            logger.info(f"📝 [MULTILISTA] Lote informado: {lot_number}")

        # 1. Verificar se a lista existe e está liberada
        list_check_query = text("""
            SELECT
                cl.id,
                cl.list_name,
                cl.list_status,
                cl.inventory_id,
                cl.current_cycle,
                cl.counter_cycle_1,
                cl.counter_cycle_2,
                cl.counter_cycle_3,
                il.name as inventory_name
            FROM inventario.counting_lists cl
            JOIN inventario.inventory_lists il ON il.id = cl.inventory_id
            WHERE cl.id = :list_id
        """)

        counting_list = db.execute(
            list_check_query,
            {"list_id": list_id}
        ).fetchone()

        if not counting_list:
            raise HTTPException(
                status_code=404,
                detail="Lista de contagem não encontrada"
            )

        # Bloquear inventário efetivado
        from app.models.models import InventoryList as InvListModel
        inv_for_check = db.query(InvListModel).filter(InvListModel.id == counting_list.inventory_id).first()
        check_inventory_not_closed(inv_for_check)

        # 2. Verificar status da LISTA (não do inventário)
        if counting_list.list_status != 'EM_CONTAGEM':
            logger.warning(f"[MULTILISTA] Lista {list_id} com status {counting_list.list_status}")
            raise HTTPException(
                status_code=400,
                detail=f"Lista não está liberada para contagem (Status: {counting_list.list_status})"
            )

        # 3. Verificar se o usuário pode contar nesta lista
        current_cycle = counting_list.current_cycle
        authorized_user_id = None

        if current_cycle == 1:
            authorized_user_id = counting_list.counter_cycle_1
        elif current_cycle == 2:
            authorized_user_id = counting_list.counter_cycle_2
        elif current_cycle == 3:
            authorized_user_id = counting_list.counter_cycle_3

        if str(authorized_user_id) != str(current_user.id):
            logger.warning(f"[MULTILISTA] Usuário {current_user.id} não autorizado para lista {list_id}")
            raise HTTPException(
                status_code=403,
                detail=f"Você não está autorizado a contar nesta lista no ciclo {current_cycle}"
            )

        # 4. Verificar se o item pertence a esta lista
        item_check_query = text("""
            SELECT
                cli.id,
                cli.inventory_item_id,
                ii.product_code,
                CASE :cycle
                    WHEN 1 THEN cli.needs_count_cycle_1
                    WHEN 2 THEN cli.needs_count_cycle_2
                    WHEN 3 THEN cli.needs_count_cycle_3
                END as needs_counting
            FROM inventario.counting_list_items cli
            JOIN inventario.inventory_items ii ON ii.id = cli.inventory_item_id
            WHERE cli.counting_list_id = :list_id
                AND cli.inventory_item_id = :item_id
        """)

        item = db.execute(
            item_check_query,
            {
                "list_id": list_id,
                "item_id": inventory_item_id,
                "cycle": current_cycle
            }
        ).fetchone()

        if not item:
            raise HTTPException(
                status_code=404,
                detail="Item não encontrado nesta lista de contagem"
            )

        # ✅ VALIDAÇÃO INTELIGENTE: Se item tem contagem anterior mas flag é false, corrigir automaticamente
        logger.info(f"🔍 [VALIDAÇÃO] Produto {item.product_code} - needs_counting={item.needs_counting}, ciclo={current_cycle}")

        if not item.needs_counting:
            # Verificar se há contagem anterior que justifica recontagem
            auto_fix_applied = False

            # ✅ CICLO 1: SEMPRE PERMITIR recontar (permite correção/edição)
            if current_cycle == 1:
                logger.info(f"🔓 [CICLO 1] Permitindo recontagem do produto {item.product_code} (edição permitida no 1º ciclo)")
                auto_fix_applied = True

            elif current_cycle == 2:
                logger.info(f"🔍 [CICLO 2] Validando produto {item.product_code}")
                # ✅ v2.11.0: CICLO 2 - Permitir contagem de produtos pendentes do ciclo 1
                # Buscar contagem do ciclo 1 (sem filtrar por NOT NULL)
                count_1_query = text("""
                    SELECT cli.count_cycle_1, ii.expected_quantity
                    FROM inventario.counting_list_items cli
                    JOIN inventario.inventory_items ii ON ii.id = cli.inventory_item_id
                    WHERE cli.counting_list_id = :list_id
                        AND cli.inventory_item_id = :item_id
                """)

                count_result = db.execute(count_1_query, {
                    "list_id": list_id,
                    "item_id": inventory_item_id
                }).fetchone()

                if count_result:
                    count_1 = count_result.count_cycle_1
                    expected = count_result.expected_quantity
                    logger.info(f"🔍 [CICLO 2] Produto {item.product_code}: count_1={count_1}, expected={expected}")

                    # ✅ CASO 1: Produto NUNCA foi contado no ciclo 1 (pendente)
                    # Permitir contagem no ciclo 2 (contagem tardia/primeira contagem)
                    if count_1 is None:
                        logger.info(f"🔓 [CICLO 2] Permitindo primeira contagem do produto {item.product_code} (nunca foi contado no ciclo 1)")
                        auto_fix_applied = True

                    # ✅ CASO 2: Produto foi contado no ciclo 1 mas divergiu
                    elif count_1 is not None and expected is not None:
                        count_1_float = float(count_1)
                        expected_float = float(expected)

                        # Se há divergência, permitir contagem (corrigir flag automaticamente)
                        if abs(count_1_float - expected_float) > 0.01:
                            logger.warning(f"🔧 AUTO-CORREÇÃO: Item {item.product_code} tinha flag needs_count_cycle_2=false mas tem divergência (1ª={count_1_float} vs esperado={expected_float}). Corrigindo automaticamente.")

                            # Corrigir flag no banco
                            fix_flag_query = text("""
                                UPDATE inventario.counting_list_items
                                SET needs_count_cycle_2 = true
                                WHERE counting_list_id = :list_id
                                    AND inventory_item_id = :item_id
                            """)

                            db.execute(fix_flag_query, {
                                "list_id": list_id,
                                "item_id": inventory_item_id
                            })
                            db.commit()
                            auto_fix_applied = True

            elif current_cycle == 3:
                logger.info(f"🔍 [CICLO 3] Validando produto {item.product_code}")
                # ✅ v2.11.0: CICLO 3 - Permitir contagem de produtos nunca contados
                # Buscar contagens anteriores (sem filtrar por NOT NULL)
                count_check_query = text("""
                    SELECT cli.count_cycle_1, cli.count_cycle_2, ii.expected_quantity
                    FROM inventario.counting_list_items cli
                    JOIN inventario.inventory_items ii ON ii.id = cli.inventory_item_id
                    WHERE cli.counting_list_id = :list_id
                        AND cli.inventory_item_id = :item_id
                """)

                count_result = db.execute(count_check_query, {
                    "list_id": list_id,
                    "item_id": inventory_item_id
                }).fetchone()

                if count_result:
                    count_1 = count_result.count_cycle_1
                    count_2 = count_result.count_cycle_2
                    logger.info(f"🔍 [CICLO 3] Produto {item.product_code}: count_1={count_1}, count_2={count_2}")

                    # ✅ CASO 1: Produto NUNCA foi contado (count_1 e count_2 = NULL)
                    # Permitir contagem no ciclo 3 (contagem tardia/primeira contagem)
                    if count_1 is None and count_2 is None:
                        logger.info(f"🔓 [CICLO 3] Permitindo primeira contagem do produto {item.product_code} (nunca foi contado antes)")
                        auto_fix_applied = True

                    # ✅ CASO 2: Produto tem contagens mas com divergência
                    elif count_1 is not None and count_2 is not None:
                        count_1_float = float(count_1)
                        count_2_float = float(count_2)

                        # Se há divergência entre ciclos 1 e 2, permitir contagem
                        if abs(count_1_float - count_2_float) > 0.01:
                            logger.warning(f"🔧 AUTO-CORREÇÃO: Item {item.product_code} tinha flag needs_count_cycle_3=false mas tem divergência (1ª={count_1_float} vs 2ª={count_2_float}). Corrigindo automaticamente.")

                            # Corrigir flag no banco
                            fix_flag_query = text("""
                                UPDATE inventario.counting_list_items
                                SET needs_count_cycle_3 = true
                                WHERE counting_list_id = :list_id
                                    AND inventory_item_id = :item_id
                            """)

                            db.execute(fix_flag_query, {
                                "list_id": list_id,
                                "item_id": inventory_item_id
                            })
                            db.commit()
                            auto_fix_applied = True

            # Se não foi possível corrigir automaticamente, bloquear contagem
            if not auto_fix_applied:
                raise HTTPException(
                    status_code=400,
                    detail=f"Este item não precisa ser contado no ciclo {current_cycle}"
                )

        # 5. Salvar contagem - LÓGICA CORRIGIDA v2.19.17
        logger.info(f"💾 [SAVE COUNT] Salvando: produto={item.product_code}, qty={quantity}, ciclo={current_cycle}, lista={list_id[:8]}..., lote={lot_number or 'SEM LOTE'}")

        # ✅ SEGURANÇA v2.19.13: Validar ciclo para prevenir SQL Injection
        if current_cycle not in VALID_CYCLE_COLUMNS:
            raise HTTPException(status_code=400, detail=f"Ciclo inválido: {current_cycle}")
        count_column = VALID_CYCLE_COLUMNS[current_cycle]
        needs_column = VALID_NEEDS_CYCLE_COLUMNS[current_cycle]

        # ✅ v2.19.17: PRIMEIRO salvar/atualizar na tabela countings
        # UPSERT: Se já existe contagem para este lote/ciclo, atualiza; senão, insere
        observation_text = request_data.get('observation', '')
        if not observation_text:
            if lot_number:
                from datetime import datetime
                timestamp = datetime.now().strftime('%d/%m/%Y, %H:%M:%S')
                observation_text = f'Contagem por lotes: {lot_number}:{quantity} - {timestamp}'
            else:
                observation_text = f'Contagem ciclo {current_cycle}'

        # Verificar se já existe contagem para este lote/ciclo
        existing_counting_query = text("""
            SELECT id FROM inventario.countings
            WHERE inventory_item_id = :item_id
              AND count_number = :count_number
              AND COALESCE(lot_number, '') = COALESCE(:lot_number, '')
        """)
        existing_counting = db.execute(existing_counting_query, {
            "item_id": inventory_item_id,
            "count_number": current_cycle,
            "lot_number": lot_number or ''
        }).fetchone()

        if existing_counting:
            # UPDATE contagem existente
            update_counting = text("""
                UPDATE inventario.countings
                SET quantity = :quantity,
                    observation = :observation,
                    counted_by = :user_id,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :counting_id
            """)
            db.execute(update_counting, {
                "quantity": quantity,
                "observation": observation_text,
                "user_id": str(current_user.id),
                "counting_id": existing_counting.id
            })
            logger.info(f"📝 [COUNTING] Atualizado lote existente: {lot_number or 'SEM LOTE'} = {quantity}")
        else:
            # INSERT nova contagem
            insert_counting = text("""
                INSERT INTO inventario.countings (
                    inventory_item_id, quantity, lot_number,
                    observation, counted_by, count_number
                ) VALUES (
                    :item_id, :quantity, :lot_number,
                    :observation, :user_id, :count_number
                )
            """)
            db.execute(insert_counting, {
                "item_id": inventory_item_id,
                "quantity": quantity,
                "lot_number": lot_number or None,
                "observation": observation_text,
                "user_id": str(current_user.id),
                "count_number": current_cycle
            })
            logger.info(f"📝 [COUNTING] Inserido novo lote: {lot_number or 'SEM LOTE'} = {quantity}")

        # ✅ v2.19.17: DEPOIS calcular SOMA de todos os lotes para este ciclo
        sum_query = text("""
            SELECT COALESCE(SUM(quantity), 0) as total_quantity
            FROM inventario.countings
            WHERE inventory_item_id = :item_id
              AND count_number = :count_number
        """)
        sum_result = db.execute(sum_query, {
            "item_id": inventory_item_id,
            "count_number": current_cycle
        }).fetchone()

        total_quantity = float(sum_result.total_quantity) if sum_result else quantity
        logger.info(f"📊 [SOMA LOTES] Produto {item.product_code}: total_cycle_{current_cycle} = {total_quantity}")

        # ✅ v2.19.17: Atualizar counting_list_items com o TOTAL (soma de lotes)
        update_list_item_query = text(f"""
            UPDATE inventario.counting_list_items
            SET {count_column} = :quantity,
                {needs_column} = false,
                last_counted_at = CURRENT_TIMESTAMP,
                last_counted_by = :user_id
            WHERE counting_list_id = :list_id
                AND inventory_item_id = :item_id
        """)

        result = db.execute(
            update_list_item_query,
            {
                "quantity": total_quantity,  # ✅ USA SOMA DOS LOTES
                "user_id": str(current_user.id),
                "list_id": list_id,
                "item_id": inventory_item_id
            }
        )

        logger.info(f"✅ [SAVE COUNT] Atualizado counting_list_items: {result.rowcount} linha(s) - produto={item.product_code}, count_cycle_{current_cycle}={total_quantity}, needs_count_cycle_{current_cycle}=false")

        # ✅ v2.19.17: Atualizar inventory_items com o TOTAL (soma de lotes)
        update_inventory_item_query = text(f"""
            UPDATE inventario.inventory_items
            SET {count_column} = :quantity,
                last_counted_at = CURRENT_TIMESTAMP,
                last_counted_by = :user_id,
                status = 'COUNTED'
            WHERE id = :item_id
        """)

        db.execute(
            update_inventory_item_query,
            {
                "quantity": total_quantity,  # ✅ USA SOMA DOS LOTES
                "user_id": str(current_user.id),
                "item_id": inventory_item_id
            }
        )

        # 🔧 SOLUÇÃO DEFINITIVA: Lógica automática para flags e assignments futuros
        # ================================================================

        # 8.1. Verificar se precisa de próximo ciclo e atualizar flags automaticamente
        inventory_id = counting_list.inventory_id

        if current_cycle == 1:
            # Após 1ª contagem, verificar se precisa de 2ª contagem
            divergence_check_query = text("""
                SELECT
                    cli.inventory_item_id,
                    ii.product_code,
                    ii.expected_quantity,
                    cli.count_cycle_1
                FROM inventario.counting_list_items cli
                JOIN inventario.inventory_items ii ON ii.id = cli.inventory_item_id
                WHERE cli.counting_list_id = :list_id
                    AND cli.inventory_item_id = :item_id
                    AND cli.count_cycle_1 IS NOT NULL
            """)

            divergence_result = db.execute(divergence_check_query, {
                "list_id": list_id,
                "item_id": inventory_item_id
            }).fetchone()

            if divergence_result:
                expected = float(divergence_result.expected_quantity or 0)
                count_1 = float(divergence_result.count_cycle_1)

                # Se há divergência > 0.01, marcar para 2ª contagem
                if abs(count_1 - expected) > 0.01:
                    logger.info(f"🔧 AUTO-FLAG: Produto {divergence_result.product_code} tem divergência (1ª={count_1} vs esperado={expected}). Marcando needs_recount_cycle_2=true")

                    # Atualizar flag para próximo ciclo
                    update_flag_query = text("""
                        UPDATE inventario.counting_list_items
                        SET needs_count_cycle_2 = true
                        WHERE counting_list_id = :list_id
                            AND inventory_item_id = :item_id
                    """)

                    db.execute(update_flag_query, {
                        "list_id": list_id,
                        "item_id": inventory_item_id
                    })

                    # Também atualizar no inventory_items
                    update_inventory_flag_query = text("""
                        UPDATE inventario.inventory_items
                        SET needs_recount_cycle_2 = true
                        WHERE id = :item_id
                    """)

                    db.execute(update_inventory_flag_query, {
                        "item_id": inventory_item_id
                    })

                else:
                    logger.info(f"✅ AUTO-FLAG: Produto {divergence_result.product_code} sem divergência. Mantendo needs_recount_cycle_2=false")

        elif current_cycle == 2:
            # Após 2ª contagem, verificar se precisa de 3ª contagem
            divergence_check_query = text("""
                SELECT
                    cli.inventory_item_id,
                    ii.product_code,
                    cli.count_cycle_1,
                    cli.count_cycle_2
                FROM inventario.counting_list_items cli
                JOIN inventario.inventory_items ii ON ii.id = cli.inventory_item_id
                WHERE cli.counting_list_id = :list_id
                    AND cli.inventory_item_id = :item_id
                    AND cli.count_cycle_2 IS NOT NULL
            """)

            divergence_result = db.execute(divergence_check_query, {
                "list_id": list_id,
                "item_id": inventory_item_id
            }).fetchone()

            if divergence_result:
                count_1 = float(divergence_result.count_cycle_1 or 0)
                count_2 = float(divergence_result.count_cycle_2)

                # Se há divergência entre 1ª e 2ª contagem, marcar para 3ª contagem
                if abs(count_1 - count_2) > 0.01:
                    logger.info(f"🔧 AUTO-FLAG: Produto {divergence_result.product_code} tem divergência (1ª={count_1} vs 2ª={count_2}). Marcando needs_recount_cycle_3=true")

                    # Atualizar flag para próximo ciclo
                    update_flag_query = text("""
                        UPDATE inventario.counting_list_items
                        SET needs_count_cycle_3 = true
                        WHERE counting_list_id = :list_id
                            AND inventory_item_id = :item_id
                    """)

                    db.execute(update_flag_query, {
                        "list_id": list_id,
                        "item_id": inventory_item_id
                    })

                    # Também atualizar no inventory_items
                    update_inventory_flag_query = text("""
                        UPDATE inventario.inventory_items
                        SET needs_recount_cycle_3 = true
                        WHERE id = :item_id
                    """)

                    db.execute(update_inventory_flag_query, {
                        "item_id": inventory_item_id
                    })

                else:
                    logger.info(f"✅ AUTO-FLAG: Produto {divergence_result.product_code} sem divergência entre ciclos. Mantendo needs_recount_cycle_3=false")

        # 8.2. Criar assignments automaticamente para produtos que precisam de próximo ciclo
        # ===============================================================================

        # Verificar se há outros produtos na lista que precisam do próximo ciclo
        if current_cycle <= 2:  # Só criar assignments para ciclos 2 e 3
            next_cycle = current_cycle + 1

            # ✅ SEGURANÇA v2.19.13: Validar próximo ciclo para prevenir SQL Injection
            if next_cycle not in VALID_NEEDS_CYCLE_COLUMNS:
                logger.warning(f"Ciclo inválido para auto-assignment: {next_cycle}")
            else:
                next_needs_column = VALID_NEEDS_CYCLE_COLUMNS[next_cycle]

                # Buscar produtos que precisam do próximo ciclo
                products_needing_next_cycle_query = text(f"""
                    SELECT DISTINCT
                        cli.inventory_item_id,
                        ii.product_code
                    FROM inventario.counting_list_items cli
                    JOIN inventario.inventory_items ii ON ii.id = cli.inventory_item_id
                    WHERE cli.counting_list_id = :list_id
                        AND cli.{next_needs_column} = true
                        AND NOT EXISTS (
                            SELECT 1 FROM inventario.counting_assignments ca
                            WHERE ca.inventory_item_id = cli.inventory_item_id
                                AND ca.count_number = :next_cycle
                                AND ca.cycle_number = :next_cycle
                        )
                """)

                products_for_next_cycle = db.execute(products_needing_next_cycle_query, {
                    "list_id": list_id,
                    "next_cycle": next_cycle
                }).fetchall()

                if products_for_next_cycle:
                    # Determinar quem deve contar no próximo ciclo
                    next_cycle_counter = None
                    if next_cycle == 2:
                        next_cycle_counter = counting_list.counter_cycle_2
                    elif next_cycle == 3:
                        next_cycle_counter = counting_list.counter_cycle_3

                    if next_cycle_counter:
                        logger.info(f"🔧 AUTO-ASSIGNMENT: Criando {len(products_for_next_cycle)} assignments para ciclo {next_cycle}")

                        for product_row in products_for_next_cycle:
                            # Criar assignment para o produto
                            create_assignment_query = text("""
                                INSERT INTO inventario.counting_assignments (
                                    inventory_item_id,
                                    assigned_to,
                                    assigned_by,
                                    count_number,
                                    cycle_number,
                                    status
                                ) VALUES (
                                    :item_id,
                                    :assigned_to,
                                    :assigned_by,
                                    :count_number,
                                    :cycle_number,
                                    'PENDING'
                                )
                            """)

                            db.execute(create_assignment_query, {
                                "item_id": product_row.inventory_item_id,
                                "assigned_to": str(next_cycle_counter),
                                "assigned_by": str(current_user.id),
                                "count_number": next_cycle,
                                "cycle_number": next_cycle
                            })

                            logger.info(f"✅ AUTO-ASSIGNMENT: Assignment criado para produto {product_row.product_code} no ciclo {next_cycle}")

        # 8. Commit das alterações
        db.commit()

        logger.info(f"✅ [MULTILISTA] Contagem salva: {quantity} unidades do produto {item.product_code}")

        return {
            "success": True,
            "message": f"Contagem do ciclo {current_cycle} registrada com sucesso",
            "data": {
                "list_id": list_id,
                "list_name": counting_list.list_name,
                "item_id": inventory_item_id,
                "product_code": item.product_code,
                "total_quantity": quantity,
                "cycle_number": current_cycle
            }
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ [MULTILISTA] Erro ao salvar contagem: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao salvar contagem")
        )

# SERVIR FRONTEND NA RAIZ (DEVE SER O ÚLTIMO MOUNT)
# =================================

import os
frontend_path = "/app/frontend"
if os.path.exists(frontend_path):
    # Servir frontend na raiz (após todos os routers)
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    logger.info(f"✅ Frontend servido na raiz: /")

# 🔧 FUNÇÕES DE SINCRONIZAÇÃO AUTOMÁTICA
# ===================================

def sync_cycle_between_tables(db: Session, inventory_id: str, new_cycle: int):
    """
    SOLUÇÃO DEFINITIVA: Sincroniza current_cycle entre inventory_lists e counting_lists

    Esta função garante que ambas as tabelas sempre tenham o mesmo current_cycle,
    resolvendo definitivamente os problemas de sincronização.
    """
    try:
        logger.info(f"🔄 [SYNC-DEFINITIVO] Sincronizando current_cycle={new_cycle} para inventory {inventory_id}")

        # 1. Atualizar inventory_lists
        update_inventory_query = text("""
            UPDATE inventario.inventory_lists
            SET current_cycle = :new_cycle
            WHERE id = :inventory_id
        """)

        result_inventory = db.execute(update_inventory_query, {
            "new_cycle": new_cycle,
            "inventory_id": inventory_id
        })

        # 2. Atualizar counting_lists (pode ter múltiplas listas)
        update_counting_query = text("""
            UPDATE inventario.counting_lists
            SET current_cycle = :new_cycle
            WHERE inventory_id = :inventory_id
        """)

        result_counting = db.execute(update_counting_query, {
            "new_cycle": new_cycle,
            "inventory_id": inventory_id
        })

        # 3. Commit das mudanças
        db.commit()

        logger.info(f"✅ [SYNC-DEFINITIVO] Ciclo sincronizado: inventory_lists ({result_inventory.rowcount} rows) e counting_lists ({result_counting.rowcount} rows)")

        return True

    except Exception as e:
        logger.error(f"❌ [SYNC-DEFINITIVO] Erro ao sincronizar: {str(e)}")
        db.rollback()
        return False

@app.on_event("startup")
async def startup_event():
    """Executar na inicialização"""
    logger.info("🚀 Sistema de Inventário iniciado!")
    logger.info("📍 Acesse: http://localhost/")
    logger.info("📍 API Docs: http://localhost:8000/docs")
    logger.info("🔐 Para criar admin: POST /test/create-admin")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)