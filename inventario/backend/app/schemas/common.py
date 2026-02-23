# backend/app/schemas/common.py
"""
Schemas Comuns Reutilizáveis
v2.19.13 - Correções de Performance

Fornece schemas comuns como paginação, respostas padronizadas, etc.
"""

from typing import Generic, TypeVar, List, Optional, Any
from pydantic import BaseModel, Field
from fastapi import Query

# Type variable para respostas genéricas
T = TypeVar('T')


class PaginationParams:
    """
    Parâmetros de paginação reutilizáveis.

    Uso:
        @router.get("/items")
        async def list_items(
            pagination: PaginationParams = Depends(),
            db: Session = Depends(get_db)
        ):
            query = db.query(Item)
            total = query.count()
            items = query.offset(pagination.offset).limit(pagination.limit).all()
            return pagination.response(items, total)
    """

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Número da página (começa em 1)"),
        limit: int = Query(20, ge=1, le=100, description="Itens por página (max 100)")
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit

    def response(self, items: list, total: int) -> dict:
        """
        Gera resposta paginada padronizada.

        Args:
            items: Lista de itens da página atual
            total: Total de itens (sem paginação)

        Returns:
            Dict com estrutura padronizada de paginação
        """
        pages = (total + self.limit - 1) // self.limit if total > 0 else 1

        return {
            "success": True,
            "data": items,
            "pagination": {
                "page": self.page,
                "limit": self.limit,
                "total": total,
                "pages": pages,
                "has_next": self.page < pages,
                "has_prev": self.page > 1
            }
        }


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Schema de resposta paginada tipada.

    Uso:
        @router.get("/items", response_model=PaginatedResponse[ItemSchema])
        async def list_items(...):
            ...
    """
    success: bool = True
    data: List[T]
    pagination: dict = Field(
        default_factory=dict,
        description="Informações de paginação"
    )


class StandardResponse(BaseModel):
    """Resposta padrão da API"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Resposta de erro padronizada"""
    success: bool = False
    error: str
    error_id: Optional[str] = None
    detail: Optional[str] = None


# Helpers para respostas rápidas
def success_response(message: str = "Operação realizada com sucesso", data: Any = None) -> dict:
    """Gera resposta de sucesso padronizada"""
    return {
        "success": True,
        "message": message,
        "data": data
    }


def error_response(error: str, error_id: Optional[str] = None, detail: Optional[str] = None) -> dict:
    """Gera resposta de erro padronizada"""
    response = {
        "success": False,
        "error": error
    }
    if error_id:
        response["error_id"] = error_id
    if detail:
        response["detail"] = detail
    return response
