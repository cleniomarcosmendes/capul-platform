"""
Configura JSON logging + correlation ID via X-Request-ID.
Auditoria observabilidade 26/04/2026 #1 — alinha o inventário com auth-gateway,
gestão TI e fiscal (todos em JSON pra agregação futura via Loki/ELK).

Uso em main.py:
    from app.core.logging_config import setup_logging, RequestIdMiddleware
    setup_logging()
    app.add_middleware(RequestIdMiddleware)
"""
import logging
import os
import sys
import uuid
from contextvars import ContextVar
from typing import Optional

from pythonjsonlogger import json as jsonlogger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


class _RequestIdFilter(logging.Filter):
    """Injeta reqId em cada log record a partir do contextvar."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.reqId = _request_id_ctx.get() or "-"
        return True


def setup_logging() -> None:
    """Substitui handlers default por JSON. Idempotente."""
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    root = logging.getLogger()
    root.setLevel(level)

    # Remove handlers preexistentes (basicConfig do main.py)
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    fmt = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(reqId)s",
        rename_fields={"asctime": "time", "levelname": "level", "name": "logger"},
    )
    handler.setFormatter(fmt)
    handler.addFilter(_RequestIdFilter())
    root.addHandler(handler)

    # Reduz ruído de bibliotecas que logam a cada request/conexão
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Lê X-Request-ID do request (ou gera UUID) e devolve no response header."""

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = _request_id_ctx.set(rid)
        try:
            response = await call_next(request)
            response.headers["x-request-id"] = rid
            return response
        finally:
            _request_id_ctx.reset(token)


def get_request_id() -> Optional[str]:
    """Acesso ao reqId atual (útil pra propagar em chamadas externas)."""
    return _request_id_ctx.get()
