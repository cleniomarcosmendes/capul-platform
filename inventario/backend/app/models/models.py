"""
Modelos SQLAlchemy para o Sistema de Inventário Protheus
Baseado no schema PostgreSQL definido em database/init.sql
"""

# ✅ CORREÇÃO DEFINITIVA: Não usar __future__.annotations com FastAPI
# SQLAlchemy relationships já usam string quotes explícitas (ex: "User", "Store")
# FastAPI precisa avaliar model annotations em runtime para validação de Depends()
from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer, ForeignKey, Enum, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
import uuid
import enum

# Base para todos os modelos
Base = declarative_base()

# =================================
# ENUMS
# =================================

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SUPERVISOR = "SUPERVISOR"
    OPERATOR = "OPERATOR"

class InventoryStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"

class CountingStatus(str, enum.Enum):
    PENDING = "PENDING"
    COUNTED = "COUNTED"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"
    ZERO_CONFIRMED = "ZERO_CONFIRMED"  # ✅ v2.17.4: Adicionado (migration 005)
    # DIVERGENT removido - não existe no enum do banco
    # ✅ CORREÇÃO: Usar apenas status válidos do enum do banco
    # Status válidos: PENDING, COUNTED, REVIEWED, APPROVED, ZERO_CONFIRMED
    # Removidos: AWAITING_COUNT, RECOUNT, FINAL_COUNT

class AssignmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

# =================================
# MODELO: STORE
# =================================

class Store(Base):
    __tablename__ = "stores"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(10), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    address = Column(String(200))
    phone = Column(String(20))
    email = Column(String(100))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    users = relationship("User", back_populates="store")
    products = relationship("Product", back_populates="store")
    inventory_lists = relationship("InventoryList", back_populates="store")
    product_prices = relationship("ProductPrice", back_populates="store")
    warehouses = relationship("Warehouse", back_populates="store")

    # ✅ NOVO v2.12.0: Relacionamento N:N com usuários
    user_stores = relationship("UserStore", back_populates="store", cascade="all, delete-orphan")

# =================================
# MODELO: USER_STORE (v2.12.0)
# =================================

class UserStore(Base):
    """
    Relacionamento N:N entre usuários e lojas/filiais.
    Permite que um usuário acesse múltiplas lojas, selecionando qual acessar no login.
    """
    __tablename__ = "user_stores"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id", ondelete="CASCADE"), nullable=False)
    is_default = Column(Boolean, default=False)  # Loja padrão sugerida no login
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    user = relationship("User", foreign_keys=[user_id], back_populates="user_stores")
    store = relationship("Store", back_populates="user_stores")
    created_by_user = relationship("User", foreign_keys=[created_by])

# =================================
# MODELO: USER
# =================================

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100))
    role = Column(Enum(UserRole), nullable=False, default=UserRole.OPERATOR)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id"))
    is_active = Column(Boolean, nullable=False, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    store = relationship("Store", back_populates="users")
    created_inventory_lists = relationship("InventoryList", foreign_keys="InventoryList.created_by", back_populates="created_by_user")
    countings = relationship("Counting", back_populates="counted_by_user")
    counting_lots = relationship("CountingLot", back_populates="created_by_user")
    created_discrepancies = relationship("Discrepancy", foreign_keys="Discrepancy.created_by", back_populates="created_by_user")
    resolved_discrepancies = relationship("Discrepancy", foreign_keys="Discrepancy.resolved_by", back_populates="resolved_by_user")

    # ✅ NOVO v2.12.0: Relacionamento N:N com lojas
    user_stores = relationship("UserStore", foreign_keys="UserStore.user_id", back_populates="user", cascade="all, delete-orphan")

    # ✅ NOVO v2.12.0: Properties para acessar lojas do usuário
    @property
    def stores(self):
        """Retorna lista de lojas que o usuário tem acesso"""
        return [us.store for us in self.user_stores if us.store]

    @property
    def default_store_id(self):
        """Retorna ID da loja padrão do usuário"""
        default = next((us.store_id for us in self.user_stores if us.is_default), None)
        return default or (self.user_stores[0].store_id if self.user_stores else None)

    @property
    def store_ids(self):
        """Retorna lista de IDs de lojas que o usuário tem acesso"""
        return [us.store_id for us in self.user_stores]
    

# =================================
# MODELO: WAREHOUSE
# =================================

class Warehouse(Base):
    __tablename__ = "warehouses"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(2), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    store = relationship("Store", back_populates="warehouses")

# =================================
# MODELO: PRODUCT
# =================================

class Product(Base):
    __tablename__ = "products"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), nullable=False)
    barcode = Column(String(50))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    unit = Column(String(10), nullable=False, default='UN')
    cost_price = Column(Numeric(15, 4))
    sale_price = Column(Numeric(15, 4))
    current_stock = Column(Numeric(15, 4), default=0)
    has_serial = Column(Boolean, nullable=False, default=False)
    has_lot = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    warehouse = Column(String(2), default='01')
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    store = relationship("Store", back_populates="products")
    inventory_items = relationship("InventoryItem", back_populates="product")
    barcodes = relationship("ProductBarcode", back_populates="product", cascade="all, delete-orphan")
    store_data = relationship("ProductStore", back_populates="product", cascade="all, delete-orphan")
    prices = relationship("ProductPrice", back_populates="product", cascade="all, delete-orphan")
    
    # Propriedades computadas para compatibilidade
    @property
    def barcode(self):
        """Propriedade para compatibilidade - retorna B1_CODBAR"""
        return self.b1_codbar
    
    @property 
    def category(self):
        """Propriedade para compatibilidade - retorna B1_XCATGOR"""
        return self.b1_xcatgor
    
    @property
    def has_serial(self):
        """Propriedade para compatibilidade - baseada em B1_RASTRO"""
        return self.b1_rastro == 'L'
    
    @property
    def has_lot(self):
        """Propriedade para compatibilidade - baseada em B1_RASTRO"""
        return self.b1_rastro == 'L'

# =================================
# MODELO: PRODUCT_BARCODE (SLK010)
# =================================

class ProductBarcode(Base):
    __tablename__ = "product_barcodes"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Campos espelho SLK010 Protheus
    slk_filial = Column(String(10), nullable=False)  # SLK_FILIAL - Filial (código da loja)
    slk_codbar = Column(String(50), nullable=False)  # SLK_CODBAR - Código de Barras
    slk_produto = Column(String(50), nullable=False)  # SLK_PRODUTO - Código do Produto (B1_COD)
    
    # Campos de controle local
    product_id = Column(UUID(as_uuid=True), ForeignKey("inventario.products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    product = relationship("Product", back_populates="barcodes")
    store = relationship("Store", foreign_keys=[store_id])

# =================================
# MODELO: PRODUCT_STORE (SBZ010)
# =================================

class ProductStore(Base):
    __tablename__ = "product_stores"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Campos espelho SBZ010 Protheus
    bz_filial = Column(String(10), nullable=False)  # BZ_FILIAL - Filial (EXCLUSIVO)
    bz_cod = Column(String(50), nullable=False)     # BZ_COD - Código do Produto (B1_COD)
    bz_xlocliz1 = Column(String(50))                # BZ_XLOCLIZ1 - Localização 1
    bz_xlocliz2 = Column(String(50))                # BZ_XLOCLIZ2 - Localização 2
    bz_xlocliz3 = Column(String(50))                # BZ_XLOCLIZ3 - Localização 3
    
    # Campos de controle local
    product_id = Column(UUID(as_uuid=True), ForeignKey("inventario.products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    product = relationship("Product", back_populates="store_data")
    store = relationship("Store", foreign_keys=[store_id])

# =================================
# MODELO: INVENTORY_LIST
# =================================

class InventoryList(Base):
    __tablename__ = "inventory_lists"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    reference_date = Column(DateTime(timezone=True), server_default=func.now())
    count_deadline = Column(DateTime(timezone=True))
    warehouse = Column(String(2), nullable=False, default='01')  # Código do armazém sendo inventariado (B2_LOCAL)
    warehouse_location = Column(String(10))  # Mantido para compatibilidade (será removido futuramente)
    status = Column(Enum(InventoryStatus), nullable=False, default=InventoryStatus.DRAFT)

    # Novos campos para controle de ciclos e status de listas
    cycle_number = Column(Integer, default=1)  # Ciclo atual (1, 2 ou 3)
    list_status = Column(String(20), default='ABERTA')  # ABERTA (inicial), EM_CONTAGEM, ENCERRADA

    # ✅ v2.19.39: Sincronização automática entre status e list_status
    # Mapeamento: ABERTA↔DRAFT, EM_CONTAGEM↔IN_PROGRESS, ENCERRADA↔COMPLETED
    # Nota: A sincronização usa flag _status_syncing por instância para evitar recursão

    @validates('list_status')
    def sync_status_from_list_status(self, key, value):
        """Sincroniza status automaticamente quando list_status é alterado"""
        if getattr(self, '_status_syncing', False):
            return value
        object.__setattr__(self, '_status_syncing', True)
        try:
            status_map = {
                'ABERTA': InventoryStatus.DRAFT,
                'PREPARACAO': InventoryStatus.DRAFT,
                'EM_CONTAGEM': InventoryStatus.IN_PROGRESS,
                'RELEASED': InventoryStatus.IN_PROGRESS,
                'ENCERRADA': InventoryStatus.COMPLETED,
                'FINALIZADA': InventoryStatus.COMPLETED,
            }
            if value in status_map:
                self.status = status_map[value]
        finally:
            object.__setattr__(self, '_status_syncing', False)
        return value

    @validates('status')
    def sync_list_status_from_status(self, key, value):
        """Sincroniza list_status automaticamente quando status é alterado"""
        if getattr(self, '_status_syncing', False):
            return value
        object.__setattr__(self, '_status_syncing', True)
        try:
            list_status_map = {
                InventoryStatus.DRAFT: 'ABERTA',
                InventoryStatus.IN_PROGRESS: 'EM_CONTAGEM',
                InventoryStatus.COMPLETED: 'ENCERRADA',
                InventoryStatus.CLOSED: 'ENCERRADA',
            }
            if value in list_status_map:
                self.list_status = list_status_map[value]
        finally:
            object.__setattr__(self, '_status_syncing', False)
        return value
    released_at = Column(DateTime(timezone=True))  # Data/hora da liberação para contagem
    released_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))  # Usuário que liberou
    closed_at = Column(DateTime(timezone=True))  # Data/hora do encerramento da rodada
    closed_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))  # Usuário que encerrou
    
    # ✅ NOVA ESTRUTURA DE CICLOS: Responsáveis por ciclo
    counter_cycle_1 = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))  # Responsável pelo 1º ciclo
    counter_cycle_2 = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))  # Responsável pelo 2º ciclo
    counter_cycle_3 = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))  # Responsável pelo 3º ciclo
    current_cycle = Column(Integer, default=1)  # Ciclo ativo atual (1, 2 ou 3)

    # Tipo de finalização (automatic, manual, forced)
    finalization_type = Column(String(20), default='automatic')

    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Campos para suportar múltiplas listas
    use_multiple_lists = Column(Boolean, default=False)
    total_lists = Column(Integer, default=0)

    # Relacionamentos
    store = relationship("Store", back_populates="inventory_lists")
    created_by_user = relationship("User", foreign_keys=[created_by], back_populates="created_inventory_lists")
    released_by_user = relationship("User", foreign_keys=[released_by])
    closed_by_user = relationship("User", foreign_keys=[closed_by])
    items = relationship("InventoryItem", back_populates="inventory_list", cascade="all, delete-orphan")
    counting_lists = relationship("CountingList", back_populates="inventory", cascade="all, delete-orphan")

# =================================
# MODELO: INVENTORY_ITEM
# =================================

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_list_id = Column(UUID(as_uuid=True), ForeignKey("inventario.inventory_lists.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("inventario.products.id"))  # Opcional
    product_code = Column(String(50))  # Código do produto SB1010 (alternativa)
    sequence = Column(Integer, nullable=False)
    expected_quantity = Column(Numeric(15, 4))  # SB2010.B2_QATU (sem lote) ou soma(SB8010.B8_SALDO) (com lote)
    b2_qatu = Column(Numeric(15, 4), default=0.0000)  # Saldo do produto (B2_QATU) no momento da inclusão no inventário
    warehouse = Column(String(2), nullable=False, default='01')  # Armazém do produto (B2_LOCAL) para rastreabilidade
    status = Column(Enum(CountingStatus), nullable=False, default=CountingStatus.PENDING)
    is_available_for_assignment = Column(Boolean, nullable=False, default=True)  # Controla se pode ser colocado em nova lista
    last_counted_at = Column(DateTime(timezone=True))
    last_counted_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # ✅ NOVA ESTRUTURA DE CICLOS: Flags de necessidade de recontagem
    needs_recount_cycle_1 = Column(Boolean, default=True)   # Precisa ser contado no 1º ciclo
    needs_recount_cycle_2 = Column(Boolean, default=False)  # Precisa ser contado no 2º ciclo
    needs_recount_cycle_3 = Column(Boolean, default=False)  # Precisa ser contado no 3º ciclo
    
    # ✅ NOVA ESTRUTURA DE CICLOS: Contagens por ciclo
    count_cycle_1 = Column(Numeric(15, 4))  # Quantidade contada no 1º ciclo
    count_cycle_2 = Column(Numeric(15, 4))  # Quantidade contada no 2º ciclo
    count_cycle_3 = Column(Numeric(15, 4))  # Quantidade contada no 3º ciclo

    # Relacionamentos
    inventory_list = relationship("InventoryList", back_populates="items")
    product = relationship("Product", back_populates="inventory_items")
    last_counted_by_user = relationship("User", foreign_keys=[last_counted_by])
    countings = relationship("Counting", back_populates="inventory_item", cascade="all, delete-orphan")
    discrepancies = relationship("Discrepancy", back_populates="inventory_item", cascade="all, delete-orphan")

    # ✅ NOVOS RELACIONAMENTOS v2.10.0: Snapshot de dados congelados
    snapshot = relationship(
        "InventoryItemSnapshot",
        back_populates="inventory_item",
        uselist=False,  # Relacionamento 1:1
        cascade="all, delete-orphan"
    )
    lot_snapshots = relationship(
        "InventoryLotSnapshot",
        back_populates="inventory_item",
        cascade="all, delete-orphan"  # Relacionamento 1:N
    )

# =================================
# MODELO: INVENTORY_ITEM_SNAPSHOT (v2.10.0)
# =================================

class InventoryItemSnapshot(Base):
    """
    Snapshot de dados congelados do produto no momento da inclusão no inventário.
    Unifica dados de SB1 (Cadastro), SB2 (Estoque) e SBZ (Indicadores).
    Relacionamento 1:1 com inventory_items. Imutável após criação.
    """
    __tablename__ = "inventory_items_snapshot"
    __table_args__ = {"schema": "inventario"}

    # Chave primária
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relacionamento 1:1 com inventory_items
    inventory_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # =================================
    # SB2: DADOS DE ESTOQUE POR ARMAZÉM
    # =================================
    b2_filial = Column(String(4))           # Código da filial
    b2_cod = Column(String(50))             # Código do produto
    b2_local = Column(String(2))            # Código do armazém (ex: 01, 02, 03)
    b2_qatu = Column(Numeric(15, 4))        # Quantidade atual em estoque (congelada)
    b2_cm1 = Column(Numeric(15, 4))         # Custo médio unitário (para cálculos financeiros)
    b2_xentpos = Column(Numeric(15, 2), default=0.00)  # ✅ v2.17.0: Entregas Posteriores (Pós-Venda)

    # =================================
    # SB1: DADOS DO CADASTRO DE PRODUTOS
    # =================================
    b1_desc = Column(String(200))           # Descrição do produto
    b1_rastro = Column(String(1))           # Tipo de rastreamento: L=Lote, S=Série, N=Não rastreia
    b1_grupo = Column(String(50))           # Grupo do produto
    b1_xcatgor = Column(String(50))         # Categoria personalizada
    b1_xsubcat = Column(String(50))         # Subcategoria personalizada
    b1_xsegmen = Column(String(50))         # Segmento personalizado
    b1_xgrinve = Column(String(50))         # Grupo de inventário personalizado

    # =================================
    # SBZ: DADOS DE INDICADORES DO PRODUTO
    # =================================
    bz_xlocal1 = Column(String(50))         # Localização física nível 1 (ex: Corredor A)
    bz_xlocal2 = Column(String(50))         # Localização física nível 2 (ex: Prateleira 5)
    bz_xlocal3 = Column(String(50))         # Localização física nível 3 (ex: Posição 12)

    # =================================
    # METADATA
    # =================================
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Relacionamentos
    inventory_item = relationship("InventoryItem", back_populates="snapshot")
    created_by_user = relationship("User", foreign_keys=[created_by])


# =================================
# MODELO: INVENTORY_LOT_SNAPSHOT (v2.10.0)
# =================================

class InventoryLotSnapshot(Base):
    """
    Snapshot de lotes congelados no momento da inclusão do produto no inventário.
    Armazena múltiplos lotes de SB8 (Saldo por Lote).
    Relacionamento 1:N com inventory_items (um produto pode ter vários lotes).
    Apenas produtos com b1_rastro=L terão registros aqui. Imutável após criação.
    """
    __tablename__ = "inventory_lots_snapshot"
    __table_args__ = {"schema": "inventario"}

    # Chave primária
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relacionamento 1:N com inventory_items
    inventory_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"),
        nullable=False
    )

    # =================================
    # SB8: DADOS DE SALDO POR LOTE
    # =================================
    b8_lotectl = Column(String(50), nullable=False)    # Número do lote (ex: 000000000019208)
    b8_lotefor = Column(String(18), default="", nullable=False)  # ✅ v2.17.1: Lote fornecedor (snapshot)
    b8_saldo = Column(Numeric(15, 4), nullable=False)  # Saldo do lote (congelado)

    # =================================
    # METADATA
    # =================================
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Relacionamentos
    inventory_item = relationship("InventoryItem", back_populates="lot_snapshots")
    created_by_user = relationship("User", foreign_keys=[created_by])


# =================================
# MODELO: COUNTING
# =================================

class Counting(Base):
    __tablename__ = "countings"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(15, 4), nullable=False)
    lot_number = Column(String(50))  # SB8010.B8_LOTECTL quando aplicável
    serial_number = Column(String(50))
    observation = Column(Text)
    counted_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"), nullable=False)
    count_number = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    inventory_item = relationship("InventoryItem", back_populates="countings")
    counted_by_user = relationship("User", back_populates="countings")
    counting_lots = relationship("CountingLot", back_populates="counting", cascade="all, delete-orphan")

# =================================
# MODELO: COUNTING_LOT
# =================================

class CountingLot(Base):
    """Modelo para controle detalhado de lotes em contagens"""
    __tablename__ = "counting_lots"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    counting_id = Column(UUID(as_uuid=True), ForeignKey("inventario.countings.id", ondelete="CASCADE"), nullable=False)
    lot_number = Column(String(50), nullable=False)
    quantity = Column(Numeric(15, 4), nullable=False, default=0)
    expiry_date = Column(DateTime(timezone=True))
    observation = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Relacionamentos
    counting = relationship("Counting", back_populates="counting_lots")
    created_by_user = relationship("User", back_populates="counting_lots")

    # Constraints para validação
    __table_args__ = (
        CheckConstraint('quantity >= 0', name='counting_lots_quantity_positive'),
        {"schema": "inventario"}
    )

# =================================
# MODELO: DISCREPANCY
# =================================

class Discrepancy(Base):
    __tablename__ = "discrepancies"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"), nullable=False)
    variance_quantity = Column(Numeric(15, 4), nullable=False)
    variance_percentage = Column(Numeric(8, 4), nullable=False)
    tolerance_exceeded = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="PENDING")
    observation = Column(Text)
    resolution = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"), nullable=False)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))

    # Relacionamentos
    inventory_item = relationship("InventoryItem", back_populates="discrepancies")
    created_by_user = relationship("User", foreign_keys=[created_by], back_populates="created_discrepancies")
    resolved_by_user = relationship("User", foreign_keys=[resolved_by], back_populates="resolved_discrepancies")

# =================================
# MODELO: COUNTING_ASSIGNMENT
# =================================

class CountingAssignment(Base):
    __tablename__ = "counting_assignments"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID, primary_key=True, server_default=text("gen_random_uuid()"))
    
    # Chaves estrangeiras (usando estrutura correta do schema inventario)
    inventory_item_id = Column(UUID, ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"), nullable=False)
    assigned_to = Column(UUID, ForeignKey("inventario.users.id"), nullable=False)
    assigned_by = Column(UUID, ForeignKey("inventario.users.id"), nullable=False)
    
    # Histórico detalhado por ciclo de contagem
    counter_cycle_1 = Column(UUID, ForeignKey("inventario.users.id"), nullable=True)  # Contador do 1º ciclo
    counter_cycle_2 = Column(UUID, ForeignKey("inventario.users.id"), nullable=True)  # Contador do 2º ciclo  
    counter_cycle_3 = Column(UUID, ForeignKey("inventario.users.id"), nullable=True)  # Contador do 3º ciclo
    previous_counter_id = Column(UUID, ForeignKey("inventario.users.id"), nullable=True)  # Mantido para compatibilidade
    
    # Controle da atribuição (conforme estrutura real da tabela)
    count_number = Column(Integer, nullable=False, default=1)
    cycle_number = Column(Integer, default=1)  # Ciclo de contagem (1, 2 ou 3)
    reason = Column(Text, nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    
    # Status da atribuição
    status = Column(String(20), nullable=False, default='PENDING')
    list_status = Column(String(20), default='ABERTA')  # Status individual da lista do usuário

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relacionamentos
    inventory_item = relationship("InventoryItem", foreign_keys=[inventory_item_id])
    assigned_to_user = relationship("User", foreign_keys=[assigned_to])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])
    
    # Relacionamentos para histórico de ciclos
    counter_cycle_1_user = relationship("User", foreign_keys=[counter_cycle_1])
    counter_cycle_2_user = relationship("User", foreign_keys=[counter_cycle_2])
    counter_cycle_3_user = relationship("User", foreign_keys=[counter_cycle_3])
    previous_counter_user = relationship("User", foreign_keys=[previous_counter_id])  # Compatibilidade

# =================================
# MODELO: SYSTEM_LOG
# =================================

class SystemLog(Base):
    __tablename__ = "system_logs"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level = Column(String(10), nullable=False)
    message = Column(Text, nullable=False)
    module = Column(String(50))
    function = Column(String(50))
    user_id = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id"))
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    additional_data = Column(Text)  # JSON as text for simplicity
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    user = relationship("User", foreign_keys=[user_id])
    store = relationship("Store", foreign_keys=[store_id])

# =================================
# MODELO: SYSTEM_CONFIG
# =================================

class SystemConfig(Base):
    __tablename__ = "system_config"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), nullable=False, unique=True)
    value = Column(Text)
    description = Column(Text)
    category = Column(String(50))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# =================================
# MODELO: PRODUCT_PRICE (DA1010)
# =================================

class ProductPrice(Base):
    __tablename__ = "product_prices"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Campos espelho DA1010 Protheus
    da1_filial = Column(String(10), nullable=False)  # DA1_FILIAL - Filial (EXCLUSIVO)
    da1_item = Column(String(10), nullable=False)    # DA1_ITEM - Item/Sequência
    da1_codtab = Column(String(10), nullable=False)  # DA1_CODTAB - Código da Tabela de Preço
    da1_codpro = Column(String(50), nullable=False)  # DA1_CODPRO - Código do Produto (B1_COD)
    da1_prcven = Column(Numeric(15, 4), nullable=False)  # DA1_PRCVEN - Preço de Venda
    da1_xupd = Column(DateTime(timezone=True))       # DA1_XUPD - Data de Alteração
    
    # Campos de controle local
    product_id = Column(UUID(as_uuid=True), ForeignKey("inventario.products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    product = relationship("Product", back_populates="prices")
    store = relationship("Store", back_populates="product_prices")
    
    # Propriedades computadas
    @property
    def table_description(self):
        """Descrição da tabela de preço baseada no código"""
        table_descriptions = {
            '001': 'Tabela Padrão',
            '002': 'Tabela Promocional', 
            '003': 'Tabela Atacado',
            '004': 'Tabela Varejo',
            '005': 'Tabela VIP'
        }
        return table_descriptions.get(self.da1_codtab, f'Tabela {self.da1_codtab}')
    
    @property
    def margin_percentage(self):
        """Calcula margem percentual se produto tem custo"""
        if self.product and self.product.cost_price and self.product.cost_price > 0:
            return round(((float(self.da1_prcven) - float(self.product.cost_price)) / float(self.product.cost_price)) * 100, 2)
        return 0.0
    
    @property
    def is_promotional(self):
        """Verifica se é preço promocional"""
        return self.da1_codtab in ['002', '003']  # Promocional ou Atacado
    
    def __repr__(self):
        return f"<ProductPrice(filial={self.da1_filial}, codtab={self.da1_codtab}, codpro={self.da1_codpro}, preco={self.da1_prcven})>"

# =================================
# MODELOS PROTHEUS PARA IMPORTAÇÃO
# =================================

class SB1010(Base):
    """Tabela SB1010 - Cadastro de Produtos (Protheus)"""
    __tablename__ = "sb1010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    b1_filial = Column(String(10), primary_key=True, default='')  # Compartilhado
    b1_cod = Column(String(50), primary_key=True)  # Código do Produto
    
    # Campos da SB1010
    b1_codbar = Column(String(50))  # Código de Barras
    b1_desc = Column(String(100))   # Descrição
    b1_tipo = Column(String(2))     # Tipo (PA, MP, PI, etc.)
    b1_um = Column(String(2))       # Unidade de Medida
    b1_locpad = Column(String(10))  # Local Padrão
    b1_grupo = Column(String(10))   # Grupo
    b1_xcatgor = Column(String(10)) # Categoria
    b1_xsubcat = Column(String(10)) # Subcategoria
    b1_xsegmen = Column(String(10)) # Segmento
    b1_xgrinve = Column(String(10)) # Grupo de Inventário
    b1_rastro = Column(String(1), nullable=False, default='N')  # Controla Lote (S=Sim, N=Não)
    
    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SBZ010(Base):
    """Tabela SBZ010 - Parâmetros por Filial (Protheus)"""
    __tablename__ = "sbz010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    bz_filial = Column(String(10), primary_key=True)  # Filial
    bz_cod = Column(String(50), primary_key=True)     # Código do Produto
    
    # Campos da SBZ010 - seguindo exatamente o schema do banco
    bz_local = Column(String(10))    # Local (conforme banco real)
    bz_xlocal1 = Column(String(50))  # Descrição Local 1
    bz_xlocal2 = Column(String(50))  # Descrição Local 2
    bz_xlocal3 = Column(String(50))  # Descrição Local 3
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SB2010(Base):
    """Tabela SB2010 - Saldos por Local (Protheus)"""
    __tablename__ = "sb2010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    b2_filial = Column(String(10), primary_key=True)  # Filial
    b2_cod = Column(String(50), primary_key=True)     # Código do Produto
    b2_local = Column(String(10), primary_key=True)   # Local
    
    # Campos da SB2010
    b2_qatu = Column(Numeric(15, 4))     # Quantidade Atual
    b2_vatu1 = Column(Numeric(15, 2))    # Valor Atual
    b2_cm1 = Column(Numeric(15, 4))      # Custo Médio
    b2_qemp = Column(Numeric(15, 4))     # Quantidade Empenhada
    b2_reserva = Column(Numeric(15, 4))  # Quantidade Reservada
    b2_xentpos = Column(Numeric(15, 2), default=0.00, nullable=False)  # Entregas Posteriores (Pós-Venda)

    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SZB010(Base):
    """Tabela SZB010 - Cadastro de Armazéns/Locais (Protheus)"""
    __tablename__ = "szb010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    zb_filial = Column(String(2), primary_key=True)   # Filial (2 chars)
    zb_xlocal = Column(String(2), primary_key=True)   # Código do Armazém (2 chars)

    # Campos da SZB010
    zb_xdesc = Column(String(30), nullable=False)     # Descrição do Armazém (30 chars)

    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SB8010(Base):
    """Tabela SB8010 - Saldos por Lote (Protheus)"""
    __tablename__ = "sb8010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária usando ID conforme estrutura real
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Campos básicos da SB8010
    b8_filial = Column(String(2), nullable=False)     # Filial
    b8_produto = Column(String(15), nullable=False)   # Código do Produto
    b8_local = Column(String(2), nullable=False)      # Local
    b8_lotectl = Column(String(20), nullable=False)   # Lote Controle
    b8_lotefor = Column(String(18), default="", nullable=False)  # ✅ v2.17.1: Lote Fornecedor
    b8_saldo = Column(Numeric(15, 4), default=0)      # Saldo
    b8_dtvalid = Column(String(10))                   # Data de Validade como string
    b8_numlote = Column(String(20), nullable=False)   # Número do Lote
    
    # Campos de controle interno
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SLK010(Base):
    """Tabela SLK010 - Códigos de Barras (Protheus)"""
    __tablename__ = "slk010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária - usa ID UUID como na estrutura real
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Campos da SLK010 - conforme estrutura real do banco
    slk_filial = Column(String(10), nullable=False)  # Filial
    slk_codbar = Column(String(50), nullable=False)  # Código de Barras
    slk_produto = Column(String(50), nullable=False)  # Código do Produto
    
    # Campos de controle
    product_id = Column(UUID(as_uuid=True), ForeignKey("inventario.products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    product = relationship("Product", foreign_keys=[product_id])
    store = relationship("Store", foreign_keys=[store_id])

class DA1010(Base):
    """Tabela DA1010 - Tabela de Preços (Protheus)"""
    __tablename__ = "da1010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    da1_filial = Column(String(10), primary_key=True)   # Filial
    da1_codtab = Column(String(10), primary_key=True)   # Código da Tabela
    da1_codpro = Column(String(50), primary_key=True)   # Código do Produto
    da1_item = Column(String(10), primary_key=True)     # Item
    
    # Campos da DA1010
    da1_prcven = Column(Numeric(15, 4))  # Preço de Venda
    da1_moeda = Column(String(3))        # Moeda
    da1_tpoper = Column(String(10))      # Tipo de Operação
    da1_datvig = Column(DateTime)        # Data de Vigência
    
    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# =================================
# TABELAS DE CLASSIFICAÇÃO PROTHEUS
# =================================

class SBM010(Base):
    """Tabela SBM010 - Grupos de Produtos (Protheus)"""
    __tablename__ = "sbm010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    bm_filial = Column(String(10), primary_key=True, default='')  # Filial
    bm_grupo = Column(String(4), primary_key=True)               # Código do Grupo
    
    # Campos da SBM010
    bm_desc = Column(String(30), nullable=False)                 # Descrição do Grupo
    
    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

class SZD010(Base):
    """Tabela SZD010 - Categorias (Protheus)"""
    __tablename__ = "szd010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    zd_filial = Column(String(10), primary_key=True, default='')  # Filial
    zd_xcod = Column(String(4), primary_key=True)                # Código da Categoria
    
    # Campos da SZD010
    zd_xdesc = Column(String(30), nullable=False)                # Descrição da Categoria
    
    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

class SZE010(Base):
    """Tabela SZE010 - Subcategorias (Protheus)"""
    __tablename__ = "sze010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    ze_filial = Column(String(10), primary_key=True, default='')  # Filial
    ze_xcod = Column(String(4), primary_key=True)                # Código da Subcategoria
    
    # Campos da SZE010
    ze_xdesc = Column(String(30), nullable=False)                # Descrição da Subcategoria
    
    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)

class SZF010(Base):
    """Tabela SZF010 - Segmentos (Protheus)"""
    __tablename__ = "szf010"
    __table_args__ = {"schema": "inventario"}

    # Chave primária composta
    zf_filial = Column(String(10), primary_key=True, default='')  # Filial
    zf_xcod = Column(String(4), primary_key=True)                # Código do Segmento
    
    # Campos da SZF010
    zf_xdesc = Column(String(30), nullable=False)                # Descrição do Segmento
    
    # Campos de controle
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)


# =================================
# MODELO: CLOSED_COUNTING_ROUNDS
# =================================

class ClosedCountingRound(Base):
    """Modelo para controlar rodadas de contagem encerradas"""
    __tablename__ = "closed_counting_rounds"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_list_id = Column(UUID(as_uuid=True), ForeignKey("inventario.inventory_lists.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"), nullable=False)
    round_number = Column(Integer, nullable=False, default=1)
    closed_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())
    notes = Column(Text)

    # Relacionamentos
    inventory_list = relationship("InventoryList")


# =================================
# NOVOS MODELOS PARA MÚLTIPLAS LISTAS
# =================================

class CountingList(Base):
    """
    Lista de contagem - Múltiplas listas por inventário
    Cada lista tem seus próprios contadores e ciclos independentes
    """
    __tablename__ = "counting_lists"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_id = Column(UUID(as_uuid=True), ForeignKey("inventario.inventory_lists.id", ondelete="CASCADE"), nullable=False)
    list_name = Column(String(100), nullable=False)  # Ex: "Lista 1", "Lista Setor A"
    description = Column(Text)

    # Contadores responsáveis por cada ciclo desta lista
    counter_cycle_1 = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))
    counter_cycle_2 = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))
    counter_cycle_3 = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Controle de ciclos desta lista específica
    current_cycle = Column(Integer, default=1)
    list_status = Column(String(20), default='ABERTA')  # ABERTA, EM_CONTAGEM, ENCERRADA
    finalization_type = Column(String(20), default='automatic')  # automatic, manual

    # Timestamps de controle desta lista
    released_at = Column(DateTime(timezone=True))
    released_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))
    closed_at = Column(DateTime(timezone=True))
    closed_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"), nullable=False)

    # Relacionamentos
    inventory = relationship("InventoryList", back_populates="counting_lists")
    items = relationship("CountingListItem", back_populates="counting_list", cascade="all, delete-orphan")
    counter_1 = relationship("User", foreign_keys=[counter_cycle_1])
    counter_2 = relationship("User", foreign_keys=[counter_cycle_2])
    counter_3 = relationship("User", foreign_keys=[counter_cycle_3])
    released_by_user = relationship("User", foreign_keys=[released_by])
    closed_by_user = relationship("User", foreign_keys=[closed_by])
    created_by_user = relationship("User", foreign_keys=[created_by])


class CountingListItem(Base):
    """
    Itens de cada lista de contagem
    Relaciona produtos do inventário com listas específicas
    """
    __tablename__ = "counting_list_items"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    counting_list_id = Column(UUID(as_uuid=True), ForeignKey("inventario.counting_lists.id", ondelete="CASCADE"), nullable=False)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"), nullable=False)

    # Controle de contagem por ciclo para este item nesta lista
    needs_count_cycle_1 = Column(Boolean, default=True)
    needs_count_cycle_2 = Column(Boolean, default=False)
    needs_count_cycle_3 = Column(Boolean, default=False)

    count_cycle_1 = Column(Numeric(15, 4))
    count_cycle_2 = Column(Numeric(15, 4))
    count_cycle_3 = Column(Numeric(15, 4))

    # Status e controle
    status = Column(Enum(CountingStatus), default=CountingStatus.PENDING)
    last_counted_at = Column(DateTime(timezone=True))
    last_counted_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    counting_list = relationship("CountingList", back_populates="items")
    inventory_item = relationship("InventoryItem")


# =================================
# MODELO: CYCLE_AUDIT_LOG (v2.16.0)
# =================================

class CycleAuditActionEnum(str, enum.Enum):
    """Enum para ações de auditoria de ciclos"""
    CREATE_LIST = "CREATE_LIST"
    START_CYCLE = "START_CYCLE"
    END_CYCLE = "END_CYCLE"
    FINALIZE_INVENTORY = "FINALIZE_INVENTORY"
    RECALCULATE_DISCREPANCIES = "RECALCULATE_DISCREPANCIES"
    ADVANCE_CYCLE = "ADVANCE_CYCLE"
    SYNC_CYCLES = "SYNC_CYCLES"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    ANOMALY_DETECTED = "ANOMALY_DETECTED"


class CycleAuditLog(Base):
    """
    Log de auditoria para operações de ciclos de inventário.
    Rastreia todas as operações críticas para proteção financeira.

    Criado em resposta ao bug crítico v2.15.5 que causava
    produtos não contados não subirem para recontagem,
    gerando ajustes de estoque errados (R$ 850/produto).

    v2.16.0 - Sistema de Proteção de Ciclos
    """
    __tablename__ = "cycle_audit_log"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relacionamentos
    inventory_list_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventario.inventory_lists.id", ondelete="CASCADE"),
        nullable=False
    )
    counting_list_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventario.counting_lists.id", ondelete="SET NULL"),
        nullable=True
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventario.users.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Dados da operação
    action = Column(Enum(CycleAuditActionEnum), nullable=False)
    old_cycle = Column(Integer)
    new_cycle = Column(Integer)

    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Metadados adicionais (JSON) - NOTA: "metadata" é reservado pelo SQLAlchemy
    extra_metadata = Column(JSONB, default={})

    # Relacionamentos
    inventory_list = relationship("InventoryList")
    counting_list = relationship("CountingList")
    user = relationship("User")