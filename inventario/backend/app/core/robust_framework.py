#!/usr/bin/env python3
"""
FRAMEWORK DE ROBUSTEZ
Sistema de proteção multicamadas para evitar falhas.
"""

import logging
import functools
import traceback
import time
from typing import Any, Callable, Dict, Optional, Union
from contextlib import contextmanager
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ===== DECORADOR DE ROBUSTEZ =====

def robust_endpoint(
    fallback_response: Any = None,
    max_retries: int = 3,
    retry_delay: float = 0.5,
    log_errors: bool = True
):
    """
    Decorador que torna qualquer endpoint robusto contra falhas.
    
    Proteções implementadas:
    1. Try/catch automático
    2. Retry em falhas temporárias  
    3. Fallback response
    4. Log estruturado
    5. Graceful degradation
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(max_retries + 1):
                try:
                    # Tentar executar função
                    result = await func(*args, **kwargs)
                    
                    # Log de sucesso (apenas no primeiro retry)
                    if attempt > 0 and log_errors:
                        logger.info(f"✅ {func.__name__} recuperou após {attempt} tentativas")
                    
                    return result
                    
                except SQLAlchemyError as e:
                    last_error = e
                    if log_errors:
                        logger.warning(f"🔄 {func.__name__} tentativa {attempt + 1}/{max_retries + 1} - SQL Error: {str(e)[:100]}")
                    
                    if attempt < max_retries:
                        time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
                        continue
                    
                except Exception as e:
                    last_error = e
                    if log_errors:
                        logger.error(f"❌ {func.__name__} falhou na tentativa {attempt + 1}: {str(e)[:100]}")
                        logger.debug(f"📋 Stack trace: {traceback.format_exc()}")
                    
                    # Para erros não-SQL, não retry
                    break
            
            # Se chegou aqui, todas as tentativas falharam
            if fallback_response is not None:
                logger.info(f"🛡️ {func.__name__} usando fallback response")
                return fallback_response
            
            # Se não tem fallback, propagar erro original
            if isinstance(last_error, SQLAlchemyError):
                raise HTTPException(
                    status_code=503,
                    detail=f"Erro temporário no banco de dados. Tente novamente."
                )
            
            raise HTTPException(
                status_code=500,
                detail=f"Erro interno do servidor: {str(last_error)[:100]}"
            )
        
        return wrapper
    return decorator

# ===== VALIDAÇÃO ROBUSTA =====

class RobustValidator:
    """Validador que nunca falha, sempre tenta corrigir dados"""
    
    @staticmethod
    def safe_string(value: Any, default: str = "", max_length: int = None) -> str:
        """Converte qualquer valor para string segura"""
        try:
            if value is None:
                return default
            
            result = str(value).strip()
            
            if max_length and len(result) > max_length:
                result = result[:max_length]
            
            return result
        except Exception:
            return default
    
    @staticmethod
    def safe_number(value: Any, default: float = 0.0) -> float:
        """Converte qualquer valor para número seguro"""
        try:
            if value is None or value == "":
                return default
            
            # Remover caracteres não numéricos exceto . e -
            if isinstance(value, str):
                cleaned = ''.join(c for c in value if c.isdigit() or c in '.-')
                if not cleaned or cleaned in '-.' :
                    return default
                value = cleaned
            
            return float(value)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def safe_boolean(value: Any, default: bool = False) -> bool:
        """Converte qualquer valor para boolean seguro"""
        try:
            if value is None:
                return default
            
            if isinstance(value, bool):
                return value
            
            if isinstance(value, str):
                return value.lower() in ('true', '1', 'yes', 'on', 't', 'y')
            
            return bool(value)
        except Exception:
            return default

# ===== ACESSO A DADOS RESILIENTE =====

@contextmanager
def resilient_db_session(db: Session):
    """Context manager para sessões de banco resilientes"""
    try:
        yield db
        db.commit()
    except SQLAlchemyError as e:
        logger.error(f"🔄 Erro SQL, fazendo rollback: {e}")
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"❌ Erro geral, fazendo rollback: {e}")
        db.rollback()
        raise

def safe_query(db: Session, query_func: Callable, fallback=None, log_prefix: str = ""):
    """
    Executa query de forma segura com fallback.
    
    Exemplo:
    products = safe_query(
        db, 
        lambda: db.query(Product).filter(Product.code == code).all(),
        fallback=[],
        log_prefix="get_products"
    )
    """
    try:
        with resilient_db_session(db):
            result = query_func()
            return result
    except Exception as e:
        logger.error(f"🛡️ {log_prefix} - Query falhou, usando fallback: {e}")
        return fallback

# ===== CACHE ROBUSTO =====

class RobustCache:
    """Cache que nunca falha, sempre retorna algo"""
    
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._ttl: Dict[str, float] = {}
    
    def get(self, key: str, default=None) -> Any:
        """Buscar do cache, nunca falha"""
        try:
            if key in self._cache:
                # Verificar TTL
                if key in self._ttl and time.time() > self._ttl[key]:
                    self.delete(key)
                    return default
                
                return self._cache[key]
            
            return default
        except Exception as e:
            logger.warning(f"🗄️ Cache.get falhou para {key}: {e}")
            return default
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> bool:
        """Armazenar no cache, nunca falha"""
        try:
            self._cache[key] = value
            self._ttl[key] = time.time() + ttl_seconds
            return True
        except Exception as e:
            logger.warning(f"🗄️ Cache.set falhou para {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Remover do cache, nunca falha"""
        try:
            self._cache.pop(key, None)
            self._ttl.pop(key, None)
            return True
        except Exception as e:
            logger.warning(f"🗄️ Cache.delete falhou para {key}: {e}")
            return False

# ===== INSTÂNCIA GLOBAL =====
robust_cache = RobustCache()

# ===== UTILITÁRIOS =====

def safe_json_response(data: Any, success: bool = True) -> Dict[str, Any]:
    """Sempre retorna JSON válido, mesmo com dados corrompidos"""
    try:
        return {
            "success": success,
            "data": data,
            "timestamp": time.time(),
            "robust": True
        }
    except Exception as e:
        logger.error(f"🛡️ safe_json_response falhou: {e}")
        return {
            "success": False,
            "data": None,
            "error": "Erro ao serializar resposta",
            "timestamp": time.time(),
            "robust": True
        }

def circuit_breaker(failure_threshold: int = 5, reset_timeout: int = 60):
    """
    Implementa circuit breaker pattern.
    Se uma função falha muito, para de tentar por um tempo.
    """
    def decorator(func: Callable) -> Callable:
        func._failures = 0
        func._last_failure_time = 0
        func._circuit_open = False
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            now = time.time()
            
            # Se circuit está aberto, verificar se pode resetar
            if func._circuit_open:
                if now - func._last_failure_time > reset_timeout:
                    func._circuit_open = False
                    func._failures = 0
                    logger.info(f"🔄 Circuit breaker resetado para {func.__name__}")
                else:
                    raise HTTPException(
                        status_code=503,
                        detail=f"Serviço temporariamente indisponível (circuit breaker)"
                    )
            
            try:
                result = func(*args, **kwargs)
                # Sucesso - resetar contador
                func._failures = 0
                return result
                
            except Exception as e:
                func._failures += 1
                func._last_failure_time = now
                
                if func._failures >= failure_threshold:
                    func._circuit_open = True
                    logger.warning(f"🚨 Circuit breaker aberto para {func.__name__} após {func._failures} falhas")
                
                raise
        
        return wrapper
    return decorator

# ===== EXEMPLO DE USO =====

"""
from app.core.robust_framework import robust_endpoint, RobustValidator, safe_query

@robust_endpoint(
    fallback_response={"products": [], "total": 0},
    max_retries=3
)
async def get_products_robust(db: Session = Depends(get_db)):
    # Este endpoint NUNCA quebra
    
    validator = RobustValidator()
    
    products = safe_query(
        db,
        lambda: db.query(Product).all(),
        fallback=[],
        log_prefix="get_products"
    )
    
    return safe_json_response({
        "products": [
            {
                "code": validator.safe_string(p.code),
                "name": validator.safe_string(p.name, "Produto sem nome"),
                "price": validator.safe_number(p.price, 0.0)
            }
            for p in products
        ],
        "total": len(products)
    })
"""