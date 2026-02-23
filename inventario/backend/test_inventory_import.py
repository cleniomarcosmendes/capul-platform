#!/usr/bin/env python3
"""
Script para identificar o problema de importação
"""

import sys
sys.path.insert(0, '/app')

print("1. Testando imports básicos...")
try:
    from typing import List, Optional, Dict, Any
    from datetime import datetime
    print("✅ Typing OK")
except Exception as e:
    print(f"❌ Erro em typing: {e}")

print("\n2. Testando FastAPI...")
try:
    from fastapi import APIRouter, Depends, HTTPException, status, Query
    from sqlalchemy.orm import Session
    from sqlalchemy import and_, or_, func
    print("✅ FastAPI/SQLAlchemy OK")
except Exception as e:
    print(f"❌ Erro em FastAPI/SQLAlchemy: {e}")

print("\n3. Testando core...")
try:
    from app.core.database import get_db
    from app.core.security import get_current_active_user, verify_store_access, require_permission
    print("✅ Core OK")
except Exception as e:
    print(f"❌ Erro em core: {e}")

print("\n4. Testando schemas...")
try:
    from app.schemas.schemas import (
        Counting,
        CountingCreate,
        CountingUpdate,
        PaginatedResponse,
        APIResponse,
        InventoryStatus,
        CountingStatus
    )
    print("✅ Schemas básicos OK")
except Exception as e:
    print(f"❌ Erro em schemas: {e}")

print("\n5. Testando inventory schemas...")
try:
    from app.schemas.inventory_schemas import (
        InventoryListResponse as InventoryList,
        InventoryListCreate,
        InventoryListUpdate,
        InventoryItemCreate,
        InventoryItemResponse as InventoryItem
    )
    print("✅ Inventory schemas OK")
except Exception as e:
    print(f"❌ Erro em inventory schemas: {e}")

print("\n6. Testando models...")
try:
    from app.models.models import (
        InventoryList as InventoryListModel,
        InventoryItem as InventoryItemModel,
        Counting as CountingModel,
        Product as ProductModel,
        User as UserModel,
        Store as StoreModel,
        CountingAssignment,
        Discrepancy as DiscrepancyModel
    )
    print("✅ Models OK")
except Exception as e:
    print(f"❌ Erro em models: {e}")

print("\n7. Testando criação de router...")
try:
    router = APIRouter()
    print("✅ Router criado")

    @router.get("/test")
    def test_endpoint():
        return {"message": "Test"}

    print("✅ Endpoint simples OK")

    from app.models.models import User as UserModel
    from app.core.security import get_current_active_user
    from app.core.database import get_db
    from typing import Optional

    @router.get("/lists", response_model=PaginatedResponse)
    async def list_inventory_lists(
        store_id: Optional[str] = Query(None, description="ID da loja"),
        current_user: UserModel = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ):
        return {"items": [], "total": 0, "page": 1, "size": 20}

    print("✅ Endpoint complexo OK")

except Exception as e:
    import traceback
    print(f"❌ Erro ao criar router: {e}")
    traceback.print_exc()

print("\n✨ Script de teste concluído")