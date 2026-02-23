"""
Endpoints de Validação Cruzada Backend/Frontend
Sistema de Inventário Protheus v2.16.0

Fornece APIs para validação cruzada entre backend e frontend,
prevenindo inconsistências que causam bugs críticos.

Criado em resposta ao bug v2.15.5 (produtos não contados não aparecendo
para recontagem) para garantir que frontend e backend sempre concordem
sobre quais produtos devem ser exibidos.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, InventoryItem, CountingListItem
from app.core.exceptions import safe_error_response

router = APIRouter()


# =================================
# SCHEMAS
# =================================

class FilterProductsRequest(BaseModel):
    """Request para validação de filtro de produtos"""
    inventory_list_id: str
    counting_list_id: Optional[str] = None
    current_cycle: int
    filter_type: str  # "all", "pending", "divergent", "counted"

    class Config:
        from_attributes = True


class ProductValidationItem(BaseModel):
    """Item de produto para validação"""
    product_code: str
    expected_quantity: float
    count_cycle_1: Optional[float] = None
    count_cycle_2: Optional[float] = None
    count_cycle_3: Optional[float] = None
    needs_count_cycle_1: bool
    needs_count_cycle_2: bool
    needs_count_cycle_3: bool
    has_divergence: bool
    status: str  # "PENDENTE", "CONTADO", "DIVERGENCIA"

    class Config:
        from_attributes = True


class FilterProductsResponse(BaseModel):
    """Response da validação de filtro"""
    success: bool
    filter_type: str
    current_cycle: int
    total_products: int
    products: List[ProductValidationItem]
    validation: dict

    class Config:
        from_attributes = True


# =================================
# ENDPOINTS
# =================================

@router.post("/filter-products", response_model=FilterProductsResponse)
async def validate_filter_products(
    request: FilterProductsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    **Valida filtro de produtos entre backend e frontend.**

    Este endpoint replica EXATAMENTE a lógica de filtro do backend,
    permitindo que o frontend valide se está exibindo os produtos corretos.

    **Casos de Uso**:
    - Frontend carrega produtos e chama este endpoint para validar
    - Backend retorna lista definitiva de produtos que DEVEM ser exibidos
    - Frontend compara e exibe warning se houver diferença

    **Parâmetros**:
    - `inventory_list_id`: ID do inventário
    - `counting_list_id`: ID da lista de contagem (opcional)
    - `current_cycle`: Ciclo atual (1, 2 ou 3)
    - `filter_type`: Tipo de filtro ("all", "pending", "divergent", "counted")

    **Retorna**:
    - Lista definitiva de produtos filtrados
    - Estatísticas de validação
    - Flags de divergência

    **Exemplo**:
    ```json
    {
        "inventory_list_id": "uuid",
        "current_cycle": 2,
        "filter_type": "pending"
    }
    ```
    """
    try:
        # Buscar itens do inventário
        query = db.query(InventoryItem).join(
            CountingListItem,
            CountingListItem.inventory_item_id == InventoryItem.id
        ).filter(
            InventoryItem.inventory_list_id == request.inventory_list_id
        )

        # Filtrar por lista de contagem se especificado
        if request.counting_list_id:
            query = query.filter(
                CountingListItem.counting_list_id == request.counting_list_id
            )

        # Aplicar filtro por tipo
        if request.filter_type == "pending":
            # Produtos NÃO contados no ciclo atual
            if request.current_cycle == 1:
                query = query.filter(CountingListItem.count_cycle_1.is_(None))
            elif request.current_cycle == 2:
                query = query.filter(CountingListItem.count_cycle_2.is_(None))
            elif request.current_cycle == 3:
                query = query.filter(CountingListItem.count_cycle_3.is_(None))

        elif request.filter_type == "divergent":
            # Produtos com divergência (needs_count_cycle_N = True)
            if request.current_cycle == 1:
                query = query.filter(CountingListItem.needs_count_cycle_1 == True)
            elif request.current_cycle == 2:
                query = query.filter(CountingListItem.needs_count_cycle_2 == True)
            elif request.current_cycle == 3:
                query = query.filter(CountingListItem.needs_count_cycle_3 == True)

        elif request.filter_type == "counted":
            # Produtos JÁ contados no ciclo atual
            if request.current_cycle == 1:
                query = query.filter(CountingListItem.count_cycle_1.isnot(None))
            elif request.current_cycle == 2:
                query = query.filter(CountingListItem.count_cycle_2.isnot(None))
            elif request.current_cycle == 3:
                query = query.filter(CountingListItem.count_cycle_3.isnot(None))

        # Executar query
        items = query.all()

        # Montar lista de produtos para validação
        products = []
        for item in items:
            # Buscar CountingListItem correspondente
            counting_item = db.query(CountingListItem).filter(
                CountingListItem.inventory_item_id == item.id
            ).first()

            if not counting_item:
                continue

            # Determinar status
            status = "PENDENTE"
            has_divergence = False

            if request.current_cycle == 1:
                if counting_item.count_cycle_1 is not None:
                    status = "CONTADO"
                if counting_item.needs_count_cycle_2:
                    has_divergence = True
                    status = "DIVERGENCIA"
            elif request.current_cycle == 2:
                if counting_item.count_cycle_2 is not None:
                    status = "CONTADO"
                if counting_item.needs_count_cycle_3:
                    has_divergence = True
                    status = "DIVERGENCIA"
            elif request.current_cycle == 3:
                if counting_item.count_cycle_3 is not None:
                    status = "CONTADO"

            products.append(ProductValidationItem(
                product_code=item.product_code,
                expected_quantity=float(item.expected_quantity),
                count_cycle_1=float(counting_item.count_cycle_1) if counting_item.count_cycle_1 is not None else None,
                count_cycle_2=float(counting_item.count_cycle_2) if counting_item.count_cycle_2 is not None else None,
                count_cycle_3=float(counting_item.count_cycle_3) if counting_item.count_cycle_3 is not None else None,
                needs_count_cycle_1=counting_item.needs_count_cycle_1,
                needs_count_cycle_2=counting_item.needs_count_cycle_2,
                needs_count_cycle_3=counting_item.needs_count_cycle_3,
                has_divergence=has_divergence,
                status=status
            ))

        # Estatísticas de validação
        total_pending = len([p for p in products if p.status == "PENDENTE"])
        total_counted = len([p for p in products if p.status == "CONTADO"])
        total_divergent = len([p for p in products if p.status == "DIVERGENCIA"])

        validation = {
            "is_valid": True,
            "total_pending": total_pending,
            "total_counted": total_counted,
            "total_divergent": total_divergent,
            "warnings": []
        }

        # Detectar anomalias
        if request.filter_type == "pending" and total_pending == 0:
            validation["warnings"].append("Nenhum produto pendente encontrado - pode indicar bug de filtro")

        if request.filter_type == "divergent" and total_divergent == 0:
            validation["warnings"].append("Nenhuma divergência encontrada - pode indicar bug de recálculo")

        return FilterProductsResponse(
            success=True,
            filter_type=request.filter_type,
            current_cycle=request.current_cycle,
            total_products=len(products),
            products=products,
            validation=validation
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao validar filtro de produtos")
        )


@router.post("/compare-frontend-backend")
async def compare_frontend_backend(
    inventory_list_id: str,
    frontend_product_codes: List[str],
    filter_type: str,
    current_cycle: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    **Compara lista de produtos do frontend vs backend.**

    Frontend envia lista de produtos que está exibindo,
    backend retorna se está correto ou não.

    **Parâmetros**:
    - `inventory_list_id`: ID do inventário
    - `frontend_product_codes`: Lista de códigos de produtos exibidos no frontend
    - `filter_type`: Tipo de filtro aplicado
    - `current_cycle`: Ciclo atual

    **Retorna**:
    - `is_match`: True se frontend == backend
    - `missing_in_frontend`: Produtos que deveriam estar mas não estão
    - `extra_in_frontend`: Produtos que não deveriam estar mas estão
    """
    try:
        # Obter lista definitiva do backend
        request = FilterProductsRequest(
            inventory_list_id=inventory_list_id,
            current_cycle=current_cycle,
            filter_type=filter_type
        )

        backend_response = await validate_filter_products(request, db, current_user)
        backend_codes = set([p.product_code for p in backend_response.products])
        frontend_codes = set(frontend_product_codes)

        # Comparar
        missing_in_frontend = backend_codes - frontend_codes
        extra_in_frontend = frontend_codes - backend_codes

        is_match = len(missing_in_frontend) == 0 and len(extra_in_frontend) == 0

        return {
            "success": True,
            "is_match": is_match,
            "total_backend": len(backend_codes),
            "total_frontend": len(frontend_codes),
            "missing_in_frontend": list(missing_in_frontend),
            "extra_in_frontend": list(extra_in_frontend),
            "severity": "CRITICAL" if len(missing_in_frontend) > 0 else ("WARNING" if len(extra_in_frontend) > 0 else "OK"),
            "message": (
                "✅ Frontend e backend estão sincronizados" if is_match else
                f"⚠️ Dessincronização detectada: {len(missing_in_frontend)} faltando, {len(extra_in_frontend)} extras"
            )
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao comparar frontend/backend")
        )
