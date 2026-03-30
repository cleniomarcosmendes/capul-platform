"""
Configuracao centralizada de endpoints Protheus.

Busca endpoints ativos via API do Auth Gateway (tabela core.integracoes_api)
com fallback para variaveis de ambiente caso a API esteja indisponivel.

Uso:
    from app.core.protheus_config import get_protheus_config
    config = await get_protheus_config()
    url = config.get_url("HIERARQUIA")
    auth = config.auth_header
"""

import os
import time
import logging
import httpx
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Cache em memoria (TTL 5 minutos)
_cache: Optional[Dict[str, Any]] = None
_cache_ts: float = 0
_CACHE_TTL = 300  # 5 minutos

# Auth Gateway URL (interna via Docker network)
AUTH_GATEWAY_URL = os.getenv("AUTH_GATEWAY_URL", "http://auth-gateway:3000")


class ProtheusConfig:
    """Configuracao Protheus resolvida (da API ou fallback)."""

    def __init__(self, data: Dict[str, Any]):
        self._data = data
        self._endpoints: Dict[str, Dict[str, Any]] = {}
        for ep in data.get("endpoints", []):
            self._endpoints[ep["operacao"]] = ep

    @property
    def ambiente(self) -> str:
        return self._data.get("ambiente", "HOMOLOGACAO")

    @property
    def tipo_auth(self) -> str:
        return self._data.get("tipoAuth", "BASIC")

    @property
    def auth_config(self) -> Optional[str]:
        return self._data.get("authConfig")

    @property
    def auth_header(self) -> str:
        """Retorna o header Authorization completo."""
        cfg = self.auth_config
        if not cfg:
            return ""
        if self.tipo_auth == "BASIC":
            return f"Basic {cfg}"
        elif self.tipo_auth == "BEARER":
            return f"Bearer {cfg}"
        return cfg

    def get_url(self, operacao: str) -> Optional[str]:
        ep = self._endpoints.get(operacao)
        return ep["url"] if ep else None

    def get_metodo(self, operacao: str) -> str:
        ep = self._endpoints.get(operacao)
        return ep.get("metodo", "GET") if ep else "GET"

    def get_timeout(self, operacao: str) -> int:
        ep = self._endpoints.get(operacao)
        return ep.get("timeoutMs", 30000) if ep else 30000

    def get_timeout_seconds(self, operacao: str) -> int:
        return self.get_timeout(operacao) // 1000

    def has_endpoint(self, operacao: str) -> bool:
        return operacao in self._endpoints

    @property
    def endpoints_disponiveis(self) -> list:
        return list(self._endpoints.keys())


async def _fetch_from_api() -> Optional[Dict[str, Any]]:
    """Busca config do Auth Gateway via API interna."""
    url = f"{AUTH_GATEWAY_URL}/api/v1/internal/integracoes/codigo/PROTHEUS/endpoints-ativos"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Usa JWT_SECRET para gerar um token interno simplificado
            # ou faz chamada sem auth (endpoint pode ser aberto para rede interna)
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                logger.info(
                    f"Config Protheus carregada da API: ambiente={data.get('ambiente')}, "
                    f"{len(data.get('endpoints', []))} endpoints"
                )
                return data
            else:
                logger.warning(f"API integracoes retornou {response.status_code}")
                return None
    except Exception as e:
        logger.warning(f"Nao foi possivel buscar config Protheus da API: {e}")
        return None


def _fallback_config() -> Dict[str, Any]:
    """Fallback para variaveis de ambiente (compatibilidade)."""
    logger.info("Usando fallback .env para config Protheus")

    base_url = os.getenv(
        "PROTHEUS_INVENTARIO_URL",
        "https://apiportal.capul.com.br:443/rest"
    )
    auth = os.getenv("PROTHEUS_INVENTARIO_AUTH", "QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=")
    # Limpar prefixo "Basic " se presente
    if auth.startswith("Basic "):
        auth = auth[6:]

    base = base_url.rstrip("/")

    return {
        "codigo": "PROTHEUS",
        "nome": "Protheus ERP (fallback .env)",
        "ambiente": os.getenv("PROTHEUS_AMBIENTE", "PRODUCAO"),
        "tipoAuth": "BASIC",
        "authConfig": auth,
        "endpoints": [
            {"operacao": "HIERARQUIA", "url": f"{base}/api/INFOCLIENTES/INVENTARIO/hierarquiaMercadologica", "metodo": "GET", "timeoutMs": 30000},
            {"operacao": "PRODUTOS", "url": f"{base}/api/INFOCLIENTES/INVENTARIO/produtos", "metodo": "POST", "timeoutMs": 900000},
            {"operacao": "TRANSFERENCIA", "url": f"{base}/api/INFOCLIENTES/INVENTARIO/transferencia", "metodo": "POST", "timeoutMs": 60000},
            {"operacao": "DIGITACAO", "url": f"{base}/api/INFOCLIENTES/INVENTARIO/digitacao", "metodo": "POST", "timeoutMs": 60000},
            {"operacao": "HISTORICO", "url": f"{base}/api/INFOCLIENTES/INVENTARIO/historico", "metodo": "POST", "timeoutMs": 60000},
        ],
    }


async def get_protheus_config(force_refresh: bool = False) -> ProtheusConfig:
    """
    Retorna configuracao Protheus.
    Tenta API do Auth Gateway primeiro, com fallback para .env.
    Cache de 5 minutos.
    """
    global _cache, _cache_ts

    now = time.time()
    if not force_refresh and _cache and (now - _cache_ts) < _CACHE_TTL:
        return ProtheusConfig(_cache)

    # Tentar API
    data = await _fetch_from_api()
    if data:
        _cache = data
        _cache_ts = now
        return ProtheusConfig(data)

    # Fallback
    data = _fallback_config()
    _cache = data
    _cache_ts = now
    return ProtheusConfig(data)


def invalidate_cache():
    """Invalida cache para forcar reload na proxima chamada."""
    global _cache, _cache_ts
    _cache = None
    _cache_ts = 0
