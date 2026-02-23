# backend/app/core/cache.py
"""
Sistema de Cache com Redis
v2.19.13 - Correções de Performance

Fornece decorator para cache de endpoints e funções utilitárias.
"""

import json
import hashlib
import logging
from functools import wraps
from typing import Optional, Any, Callable
import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Conexão Redis (lazy initialization)
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """
    Obtém cliente Redis com lazy initialization.
    Retorna None se Redis não estiver disponível.
    """
    global _redis_client

    if _redis_client is None:
        try:
            redis_url = getattr(settings, 'REDIS_URL', 'redis://redis:6379/0')
            _redis_client = redis.Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=2,
                socket_connect_timeout=2
            )
            # Testar conexão
            _redis_client.ping()
            logger.info("✅ Conexão Redis estabelecida")
        except Exception as e:
            logger.warning(f"⚠️ Redis não disponível, cache desabilitado: {e}")
            _redis_client = None

    return _redis_client


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    Gera chave de cache baseada nos argumentos.

    Args:
        prefix: Prefixo para a chave (ex: nome da função)
        *args: Argumentos posicionais
        **kwargs: Argumentos nomeados

    Returns:
        String de chave única para cache
    """
    # Serializar argumentos (ignorar objetos não-serializáveis)
    key_parts = [prefix]

    for arg in args:
        try:
            if hasattr(arg, '__dict__'):
                # Objeto - usar representação simplificada
                key_parts.append(str(type(arg).__name__))
            else:
                key_parts.append(str(arg))
        except Exception:
            key_parts.append("_obj_")

    for k, v in sorted(kwargs.items()):
        try:
            key_parts.append(f"{k}={v}")
        except Exception:
            key_parts.append(f"{k}=_obj_")

    # Gerar hash da chave para manter tamanho consistente
    key_str = ":".join(key_parts)
    key_hash = hashlib.md5(key_str.encode()).hexdigest()[:16]

    return f"cache:{prefix}:{key_hash}"


def cache_response(ttl_seconds: int = 300, prefix: Optional[str] = None):
    """
    Decorator para cache de respostas de endpoints.

    Uso:
        @app.get("/api/v1/products/filters")
        @cache_response(ttl_seconds=600)
        async def get_product_filters(...):
            ...

    Args:
        ttl_seconds: Tempo de vida do cache em segundos (default: 5 min)
        prefix: Prefixo customizado para a chave (default: nome da função)

    Returns:
        Decorator que adiciona caching à função
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            redis_client = get_redis_client()

            # Se Redis não disponível, executar sem cache
            if redis_client is None:
                return await func(*args, **kwargs)

            # Gerar chave de cache
            cache_prefix = prefix or func.__name__
            cache_key = generate_cache_key(cache_prefix, *args, **kwargs)

            try:
                # Tentar buscar do cache
                cached = redis_client.get(cache_key)
                if cached:
                    logger.debug(f"🎯 Cache HIT: {cache_key}")
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"⚠️ Erro ao ler cache: {e}")

            # Executar função
            result = await func(*args, **kwargs)

            # Armazenar no cache
            try:
                # Converter resultado para JSON (se possível)
                json_result = json.dumps(result, default=str)
                redis_client.setex(cache_key, ttl_seconds, json_result)
                logger.debug(f"💾 Cache SET: {cache_key} (TTL: {ttl_seconds}s)")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao salvar cache: {e}")

            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            redis_client = get_redis_client()

            # Se Redis não disponível, executar sem cache
            if redis_client is None:
                return func(*args, **kwargs)

            # Gerar chave de cache
            cache_prefix = prefix or func.__name__
            cache_key = generate_cache_key(cache_prefix, *args, **kwargs)

            try:
                # Tentar buscar do cache
                cached = redis_client.get(cache_key)
                if cached:
                    logger.debug(f"🎯 Cache HIT: {cache_key}")
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"⚠️ Erro ao ler cache: {e}")

            # Executar função
            result = func(*args, **kwargs)

            # Armazenar no cache
            try:
                json_result = json.dumps(result, default=str)
                redis_client.setex(cache_key, ttl_seconds, json_result)
                logger.debug(f"💾 Cache SET: {cache_key} (TTL: {ttl_seconds}s)")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao salvar cache: {e}")

            return result

        # Retornar wrapper apropriado baseado no tipo da função
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def invalidate_cache(pattern: str = "*") -> int:
    """
    Invalida entradas de cache por padrão.

    Args:
        pattern: Padrão para buscar chaves (ex: "cache:get_stores:*")

    Returns:
        Número de chaves removidas
    """
    redis_client = get_redis_client()

    if redis_client is None:
        return 0

    try:
        # Buscar chaves pelo padrão
        keys = list(redis_client.scan_iter(f"cache:{pattern}"))

        if keys:
            deleted = redis_client.delete(*keys)
            logger.info(f"🗑️ Cache invalidado: {deleted} chaves removidas (pattern: {pattern})")
            return deleted

        return 0
    except Exception as e:
        logger.error(f"❌ Erro ao invalidar cache: {e}")
        return 0


def clear_all_cache() -> int:
    """
    Limpa todo o cache da aplicação.

    Returns:
        Número de chaves removidas
    """
    return invalidate_cache("*")


def get_cache_stats() -> dict:
    """
    Retorna estatísticas do cache.

    Returns:
        Dicionário com informações do cache
    """
    redis_client = get_redis_client()

    if redis_client is None:
        return {"status": "unavailable", "keys": 0}

    try:
        # Contar chaves de cache
        keys = list(redis_client.scan_iter("cache:*"))

        # Informações do Redis
        info = redis_client.info("memory")

        return {
            "status": "connected",
            "cache_keys": len(keys),
            "used_memory": info.get("used_memory_human", "unknown"),
            "connected_clients": redis_client.info("clients").get("connected_clients", 0)
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# Constantes de TTL para uso consistente
class CacheTTL:
    """Constantes de TTL para cache"""
    SHORT = 60          # 1 minuto
    MEDIUM = 300        # 5 minutos
    LONG = 600          # 10 minutos
    EXTENDED = 1800     # 30 minutos
    HOUR = 3600         # 1 hora
