"""
Fixtures compartilhadas para testes do Sistema de Inventário Protheus v2.16.0
"""

import pytest
import sys
import os
from uuid import uuid4
from datetime import datetime, timezone
from typing import Generator

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models.models import (
    Base,
    User,
    Store,
    UserStore,
    InventoryList,
    InventoryItem,
    CountingList,
    CountingListItem,
    Product,
    UserRole,
    InventoryStatus
)
from app.core.security import hash_password


# =================================
# DATABASE FIXTURES
# =================================

@pytest.fixture(scope="session")
def db_engine():
    """
    Cria engine do banco de dados de testes.

    Usa o mesmo banco de produção mas com schema de testes.
    CUIDADO: Limpa dados após testes!
    """
    # URL do banco de testes (pode ser diferente do prod)
    DATABASE_URL = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql://inventario_user:senha123@localhost:5432/inventario_protheus"
    )

    engine = create_engine(DATABASE_URL)

    # Criar tabelas se não existirem
    # Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup após todos os testes
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator[Session, None, None]:
    """
    Cria uma sessão de banco de dados isolada para cada teste.

    Usa transações que são rolled back após cada teste,
    garantindo isolamento completo.
    """
    connection = db_engine.connect()
    transaction = connection.begin()

    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()

    yield session

    # Rollback da transação após o teste
    session.close()
    transaction.rollback()
    connection.close()


# =================================
# USER FIXTURES
# =================================

@pytest.fixture
def test_admin_user(db_session: Session, test_store: Store) -> User:
    """Cria usuário ADMIN para testes"""
    admin = User(
        id=uuid4(),
        username="test_admin",
        full_name="Test Admin",
        email="admin@test.com",
        hashed_password=hash_password("test123"),
        role=UserRole.ADMIN,
        store_id=test_store.id,
        is_active=True
    )
    db_session.add(admin)
    db_session.flush()

    # Adicionar acesso à store
    user_store = UserStore(
        id=uuid4(),
        user_id=admin.id,
        store_id=test_store.id,
        is_default=True
    )
    db_session.add(user_store)
    db_session.flush()

    return admin


@pytest.fixture
def test_supervisor_user(db_session: Session, test_store: Store) -> User:
    """Cria usuário SUPERVISOR para testes"""
    supervisor = User(
        id=uuid4(),
        username="test_supervisor",
        full_name="Test Supervisor",
        email="supervisor@test.com",
        hashed_password=hash_password("test123"),
        role=UserRole.SUPERVISOR,
        store_id=test_store.id,
        is_active=True
    )
    db_session.add(supervisor)
    db_session.flush()

    user_store = UserStore(
        id=uuid4(),
        user_id=supervisor.id,
        store_id=test_store.id,
        is_default=True
    )
    db_session.add(user_store)
    db_session.flush()

    return supervisor


@pytest.fixture
def test_operator_user(db_session: Session, test_store: Store) -> User:
    """Cria usuário OPERATOR para testes"""
    operator = User(
        id=uuid4(),
        username="test_operator",
        full_name="Test Operator",
        email="operator@test.com",
        hashed_password=hash_password("test123"),
        role=UserRole.OPERATOR,
        store_id=test_store.id,
        is_active=True
    )
    db_session.add(operator)
    db_session.flush()

    user_store = UserStore(
        id=uuid4(),
        user_id=operator.id,
        store_id=test_store.id,
        is_default=True
    )
    db_session.add(user_store)
    db_session.flush()

    return operator


# =================================
# STORE FIXTURES
# =================================

@pytest.fixture
def test_store(db_session: Session) -> Store:
    """Cria loja de teste"""
    store = Store(
        id=uuid4(),
        code="TEST01",
        name="Loja Teste 01",
        description="Loja para testes automatizados",
        is_active=True
    )
    db_session.add(store)
    db_session.flush()
    return store


@pytest.fixture
def test_store_02(db_session: Session) -> Store:
    """Cria segunda loja de teste"""
    store = Store(
        id=uuid4(),
        code="TEST02",
        name="Loja Teste 02",
        description="Segunda loja para testes",
        is_active=True
    )
    db_session.add(store)
    db_session.flush()
    return store


# =================================
# PRODUCT FIXTURES
# =================================

@pytest.fixture
def test_products(db_session: Session, test_store: Store) -> list[Product]:
    """Cria 5 produtos de teste"""
    products = []
    for i in range(1, 6):
        product = Product(
            id=uuid4(),
            code=f"PROD{i:03d}",
            description=f"Produto Teste {i}",
            store_id=test_store.id,
            unit="UN",
            is_active=True
        )
        db_session.add(product)
        products.append(product)

    db_session.flush()
    return products


# =================================
# INVENTORY FIXTURES
# =================================

@pytest.fixture
def test_inventory(db_session: Session, test_store: Store, test_admin_user: User) -> InventoryList:
    """Cria inventário de teste"""
    inventory = InventoryList(
        id=uuid4(),
        name="INV_TEST_001",
        description="Inventário de teste",
        store_id=test_store.id,
        warehouse="01",
        status=InventoryStatus.IN_PROGRESS,
        current_cycle=1,
        created_by=test_admin_user.id
    )
    db_session.add(inventory)
    db_session.flush()
    return inventory


@pytest.fixture
def test_inventory_items(
    db_session: Session,
    test_inventory: InventoryList,
    test_products: list[Product]
) -> list[InventoryItem]:
    """Cria itens de inventário para os produtos de teste"""
    items = []
    for i, product in enumerate(test_products, 1):
        item = InventoryItem(
            id=uuid4(),
            inventory_list_id=test_inventory.id,
            product_code=product.code,
            expected_quantity=float(i * 10),  # 10, 20, 30, 40, 50
            sequence=i
        )
        db_session.add(item)
        items.append(item)

    db_session.flush()
    return items


# =================================
# COUNTING LIST FIXTURES
# =================================

@pytest.fixture
def test_counting_list(
    db_session: Session,
    test_inventory: InventoryList,
    test_supervisor_user: User
) -> CountingList:
    """Cria lista de contagem de teste"""
    counting_list = CountingList(
        id=uuid4(),
        code="CL_TEST_001",
        inventory_id=test_inventory.id,
        current_cycle=1,
        list_status="ABERTA",
        counter_cycle_1=test_supervisor_user.id,
        created_by=test_supervisor_user.id
    )
    db_session.add(counting_list)
    db_session.flush()
    return counting_list


@pytest.fixture
def test_counting_list_items(
    db_session: Session,
    test_counting_list: CountingList,
    test_inventory_items: list[InventoryItem]
) -> list[CountingListItem]:
    """Cria itens da lista de contagem"""
    items = []
    for inventory_item in test_inventory_items:
        item = CountingListItem(
            id=uuid4(),
            counting_list_id=test_counting_list.id,
            inventory_item_id=inventory_item.id,
            needs_count_cycle_1=True,
            needs_count_cycle_2=False,
            needs_count_cycle_3=False
        )
        db_session.add(item)
        items.append(item)

    db_session.flush()
    return items
