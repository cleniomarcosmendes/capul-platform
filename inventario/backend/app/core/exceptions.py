# backend/app/core/exceptions.py
"""
Sistema de Exceções e Tratamento de Erros
v2.19.13 - Correções de Segurança

Fornece funções para tratar erros de forma segura,
sem expor detalhes internos ao usuário final.
"""

import logging
import traceback
import uuid
from typing import Optional
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


def safe_error_response(
    e: Exception,
    context: str = "",
    log_level: str = "error"
) -> str:
    """
    Retorna mensagem de erro segura para o usuário e loga detalhes internamente.

    Em ambiente de produção:
    - Retorna mensagem genérica com ID de erro
    - Loga detalhes completos internamente

    Em ambiente de desenvolvimento:
    - Retorna mensagem detalhada para debugging
    - Loga detalhes completos

    Args:
        e: Exceção capturada
        context: Contexto da operação (ex: "ao processar inventário")
        log_level: Nível de log (error, warning, info)

    Returns:
        Mensagem segura para exibição ao usuário
    """
    # Gerar ID único para rastreamento
    error_id = str(uuid.uuid4())[:8]

    # Formatar mensagem de log
    full_message = f"[{error_id}] {context}: {str(e)}"
    stack_trace = traceback.format_exc()

    # Registrar no log
    if log_level == "error":
        logger.error(f"{full_message}\n{stack_trace}")
    elif log_level == "warning":
        logger.warning(f"{full_message}\n{stack_trace}")
    else:
        logger.info(f"{full_message}\n{stack_trace}")

    # Em produção, retornar mensagem genérica
    if settings.ENVIRONMENT == "production":
        if context:
            return f"Erro {context}. ID: {error_id}. Contate o suporte."
        return f"Erro interno [{error_id}]. Contate o suporte."

    # Em desenvolvimento, retornar detalhes
    return f"[{error_id}] {context}: {str(e)}"


def raise_safe_http_exception(
    status_code: int,
    e: Exception,
    context: str = ""
) -> None:
    """
    Levanta HTTPException com mensagem segura.

    Args:
        status_code: Código HTTP (400, 500, etc)
        e: Exceção original
        context: Contexto da operação

    Raises:
        HTTPException com mensagem sanitizada
    """
    message = safe_error_response(e, context)
    raise HTTPException(status_code=status_code, detail=message)


class SafeHTTPException(HTTPException):
    """
    HTTPException que sanitiza automaticamente mensagens de erro.

    Uso:
        try:
            # operação
        except Exception as e:
            raise SafeHTTPException(500, e, "ao processar dados")
    """

    def __init__(
        self,
        status_code: int,
        exception: Optional[Exception] = None,
        context: str = "",
        detail: Optional[str] = None
    ):
        if exception:
            safe_detail = safe_error_response(exception, context)
        else:
            safe_detail = detail or "Erro interno"

        super().__init__(status_code=status_code, detail=safe_detail)


# Mensagens de erro padronizadas (seguras para exibição)
ERROR_MESSAGES = {
    # Autenticação
    "INVALID_CREDENTIALS": "Credenciais inválidas",
    "TOKEN_EXPIRED": "Sessão expirada. Faça login novamente.",
    "TOKEN_INVALID": "Token inválido",
    "UNAUTHORIZED": "Acesso não autorizado",

    # Recursos
    "NOT_FOUND": "Recurso não encontrado",
    "INVENTORY_NOT_FOUND": "Inventário não encontrado",
    "PRODUCT_NOT_FOUND": "Produto não encontrado",
    "USER_NOT_FOUND": "Usuário não encontrado",
    "STORE_NOT_FOUND": "Loja não encontrada",

    # Validação
    "INVALID_DATA": "Dados inválidos",
    "MISSING_FIELD": "Campo obrigatório não informado",
    "INVALID_CYCLE": "Ciclo inválido",

    # Operação
    "OPERATION_FAILED": "Operação não pôde ser concluída",
    "DATABASE_ERROR": "Erro ao acessar banco de dados",
    "EXTERNAL_API_ERROR": "Erro ao acessar serviço externo",
}


def get_error_message(key: str, **kwargs) -> str:
    """
    Retorna mensagem de erro padronizada.

    Args:
        key: Chave da mensagem (ex: "INVALID_CREDENTIALS")
        **kwargs: Parâmetros para interpolação (opcional)

    Returns:
        Mensagem de erro segura
    """
    message = ERROR_MESSAGES.get(key, "Erro interno")
    if kwargs:
        try:
            message = message.format(**kwargs)
        except KeyError:
            pass
    return message
