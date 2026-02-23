# 📸 PLANO DE IMPLEMENTAÇÃO - SNAPSHOT DE INVENTÁRIO v1.0

**Data de Criação**: 13/10/2025
**Versão Sistema**: v2.9.3.2 → v2.10.0 (após implementação)
**Prioridade**: ALTA (Correção Arquitetural Crítica)
**Status**: AGUARDANDO INÍCIO

---

## 🎯 OBJETIVO

Implementar sistema de **SNAPSHOT (congelamento)** de dados do inventário no momento da inclusão de produtos, garantindo que:

- ✅ Quantidade esperada permanece constante
- ✅ Saldo por lote permanece constante
- ✅ Lotes disponíveis não mudam
- ✅ Dados de produto (descrição, grupo, localização) permanecem inalterados
- ✅ Custo médio (b2_cm1) congelado para cálculos financeiros
- ✅ Análises e relatórios sempre consistentes

**Resultado**: Sistema imune a mudanças externas após sincronização com ERP Protheus

---

## 🚨 PROBLEMA ATUAL

### **Comportamento Indesejado:**

```
DIA 1: Criar Inventário
- Produto X: qty esperada = 100 (buscado de SB2)
- Lote A: saldo = 50 (buscado de SB8)
- Lote B: saldo = 50 (buscado de SB8)

DIA 5: Sistema sincroniza com Protheus
- Produto X: qty esperada = 120 ❌ MUDOU!
- Lote A: saldo = 30 ❌ MUDOU!
- Lote C: saldo = 40 ❌ LOTE NOVO!

RESULTADO:
❌ Relatórios mostram dados diferentes
❌ Status de produtos mudam automaticamente
❌ Análise de divergência fica incorreta
❌ Perde-se o "retrato do momento"
```

---

## 🏗️ ARQUITETURA DA SOLUÇÃO

### **Opção Escolhida**: OPÇÃO 2 (Tabelas Separadas)

**Motivo**: Profissional, escalável, pensando a longo prazo

### **Estrutura:**

```
inventory_items (produto no inventário)
  ├─ snapshot (1:1) → inventory_items_snapshot
  │   ├── Dados SB1 (Cadastro de Produto)
  │   ├── Dados SB2 (Estoque por Armazém)
  │   └── Dados SBZ (Indicadores)
  │
  └─ lot_snapshots (1:N) → inventory_lots_snapshot
      └── Dados SB8 (Saldo por Lote)
```

---

## 📋 CAMPOS A CONGELAR

### **Tabela 1: `inventory_items_snapshot` (Dados Únicos 1:1)**

#### **SB2 (Estoque por Armazém)**
- `b2_filial` - Filial
- `b2_cod` - Código do produto
- `b2_local` - Armazém
- `b2_qatu` - Quantidade atual (estoque)
- `b2_cm1` - **Custo médio unitário** ⭐ NOVO CAMPO

#### **SB1 (Cadastro de Produtos)**
- `b1_desc` - Descrição do produto
- `b1_rastro` - Tipo de rastreamento (L=Lote, S=Série, N=Não)
- `b1_grupo` - Grupo do produto
- `b1_xcatgor` - Categoria
- `b1_xsubcat` - Subcategoria
- `b1_xsegmen` - Segmento
- `b1_xgrinve` - Grupo inventário

#### **SBZ (Indicadores de Produto)**
- `bz_xlocal1` - Localização física 1
- `bz_xlocal2` - Localização física 2
- `bz_xlocal3` - Localização física 3

### **Tabela 2: `inventory_lots_snapshot` (Múltiplos Lotes 1:N)**

#### **SB8 (Saldo por Lote)**
- `b8_lotectl` - Número do lote
- `b8_saldo` - Saldo do lote (congelado)

---

## ⏰ MOMENTO DO CONGELAMENTO

**Gatilho**: Botão **"Configurar Produtos"** → `addProductsToInventory(inventory_id)`

**Fluxo:**
```
1. Usuário clica "Configurar Produtos"
2. Sistema busca dados das tabelas LOCAIS (SB1, SB2, SB8, SBZ)
3. Sistema cria inventory_item
4. Sistema cria snapshot (inventory_items_snapshot)
5. Se produto tem lote (b1_rastro = 'L'):
   ├─ Sistema busca lotes da tabela SB8 local
   └─ Sistema cria snapshots de lotes (inventory_lots_snapshot)
6. Dados congelados ✅
```

**IMPORTANTE**: Sistema busca de **tabelas LOCAIS**, NÃO do ERP Protheus diretamente
(Sincronização ERP → Tabelas Locais será implementada em outra fase)

---

## 🚀 ROTEIRO DE IMPLEMENTAÇÃO

### **ETAPA 0: DOCUMENTAÇÃO E PLANEJAMENTO** ⏳

**Duração**: 30 minutos

#### **ETAPA 0.1: Atualizar CLAUDE.md**
- Documentar mudança v2.10.0
- Adicionar seção "Sistema de Snapshot"
- Referenciar este documento

#### **ETAPA 0.2: Atualizar DOCUMENTACAO.md**
- Adicionar entrada para PLANO_SNAPSHOT_INVENTARIO_v1.0.md
- Categorizar em "Arquitetura"

#### **ETAPA 0.3: Criar CHANGELOG entrada**
- Nova entrada v2.10.0 em docs/CHANGELOG_CICLOS.md
- Documentar nova arquitetura

#### **ETAPA 0.4: Atualizar TROUBLESHOOTING**
- Adicionar solução para problemas de dados dinâmicos

#### **ETAPA 0.5: Criar backup de segurança**
- Backup completo do sistema antes de mudanças estruturais

---

### **ETAPA 1: CRIAR ESTRUTURA DO BANCO DE DADOS** 📊

**Duração**: 1 hora

#### **ETAPA 1.1: Criar arquivo de migration**
**Arquivo**: `database/migrations/001_add_inventory_snapshot_tables.sql`

```sql
-- =================================
-- MIGRATION: Sistema de Snapshot de Inventário
-- Versão: v2.10.0
-- Data: 14/10/2025
-- =================================

SET search_path TO inventario, public;

-- Tabela 1: Snapshot de dados únicos do produto
CREATE TABLE inventory_items_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL UNIQUE REFERENCES inventory_items(id) ON DELETE CASCADE,

    -- SB2: Estoque por Armazém
    b2_filial VARCHAR(4),
    b2_cod VARCHAR(50),
    b2_local VARCHAR(2),
    b2_qatu NUMERIC(15,4),
    b2_cm1 NUMERIC(15,4),

    -- SB1: Cadastro de Produtos
    b1_desc VARCHAR(200),
    b1_rastro VARCHAR(1),
    b1_grupo VARCHAR(50),
    b1_xcatgor VARCHAR(50),
    b1_xsubcat VARCHAR(50),
    b1_xsegmen VARCHAR(50),
    b1_xgrinve VARCHAR(50),

    -- SBZ: Indicadores de Produto
    bz_xlocal1 VARCHAR(50),
    bz_xlocal2 VARCHAR(50),
    bz_xlocal3 VARCHAR(50),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Índices para performance
CREATE INDEX idx_inventory_items_snapshot_item ON inventory_items_snapshot(inventory_item_id);
CREATE INDEX idx_inventory_items_snapshot_created_at ON inventory_items_snapshot(created_at);
CREATE INDEX idx_inventory_items_snapshot_product ON inventory_items_snapshot(b2_cod);

-- Comentário
COMMENT ON TABLE inventory_items_snapshot IS 'Snapshot de dados congelados do produto no momento da inclusão no inventário (SB1 + SB2 + SBZ)';

-- Tabela 2: Snapshot de lotes
CREATE TABLE inventory_lots_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

    -- SB8: Saldo por Lote
    b8_lotectl VARCHAR(50) NOT NULL,
    b8_saldo NUMERIC(15,4) NOT NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),

    -- Constraint: Lote único por item
    CONSTRAINT uk_inventory_lots_snapshot_item_lot UNIQUE (inventory_item_id, b8_lotectl)
);

-- Índices para performance
CREATE INDEX idx_inventory_lots_snapshot_item ON inventory_lots_snapshot(inventory_item_id);
CREATE INDEX idx_inventory_lots_snapshot_lot ON inventory_lots_snapshot(b8_lotectl);
CREATE INDEX idx_inventory_lots_snapshot_created_at ON inventory_lots_snapshot(created_at);

-- Comentário
COMMENT ON TABLE inventory_lots_snapshot IS 'Snapshot de lotes congelados no momento da inclusão do produto no inventário (SB8)';

-- Fim da migration
```

#### **ETAPA 1.2: Executar migration**
```bash
# Conectar ao banco e executar
docker-compose exec postgres psql -U inventario_user -d inventario_protheus -f /path/to/migration.sql
```

#### **ETAPA 1.3: Validar estrutura**
```bash
# Verificar tabelas criadas
docker-compose exec postgres psql -U inventario_user -d inventario_protheus -c "\d inventario.inventory_items_snapshot"
docker-compose exec postgres psql -U inventario_user -d inventario_protheus -c "\d inventario.inventory_lots_snapshot"
```

---

### **ETAPA 2: CRIAR MODELOS SQLALCHEMY** 🔧

**Duração**: 30 minutos

#### **ETAPA 2.1: Adicionar modelos**
**Arquivo**: `backend/app/models/models.py`

**Localização**: Após a classe `InventoryItem` (linha ~320)

```python
# =================================
# MODELO: INVENTORY_ITEMS_SNAPSHOT
# =================================

class InventoryItemSnapshot(Base):
    """
    Snapshot de dados congelados do produto no momento da inclusão no inventário
    Unifica dados de SB1 (Produto), SB2 (Estoque) e SBZ (Indicadores)
    Relacionamento 1:1 com InventoryItem
    """
    __tablename__ = "inventory_items_snapshot"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # SB2 - Estoque por Armazém
    b2_filial = Column(String(4))
    b2_cod = Column(String(50))
    b2_local = Column(String(2))
    b2_qatu = Column(Numeric(15, 4))
    b2_cm1 = Column(Numeric(15, 4))  # Custo médio ⭐

    # SB1 - Cadastro de Produtos
    b1_desc = Column(String(200))
    b1_rastro = Column(String(1))  # L=Lote, S=Série, N=Não
    b1_grupo = Column(String(50))
    b1_xcatgor = Column(String(50))
    b1_xsubcat = Column(String(50))
    b1_xsegmen = Column(String(50))
    b1_xgrinve = Column(String(50))

    # SBZ - Indicadores de Produto
    bz_xlocal1 = Column(String(50))
    bz_xlocal2 = Column(String(50))
    bz_xlocal3 = Column(String(50))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Relacionamentos
    inventory_item = relationship("InventoryItem", back_populates="snapshot")
    created_by_user = relationship("User", foreign_keys=[created_by])


# =================================
# MODELO: INVENTORY_LOTS_SNAPSHOT
# =================================

class InventoryLotSnapshot(Base):
    """
    Snapshot de lotes congelados no momento da inclusão do produto
    Armazena saldo de lotes de SB8 (Saldo por Lote)
    Relacionamento 1:N com InventoryItem (um produto pode ter múltiplos lotes)
    """
    __tablename__ = "inventory_lots_snapshot"
    __table_args__ = (
        UniqueConstraint('inventory_item_id', 'b8_lotectl', name='uk_inventory_lots_snapshot_item_lot'),
        {"schema": "inventario"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventario.inventory_items.id", ondelete="CASCADE"),
        nullable=False
    )

    # SB8 - Saldo por Lote
    b8_lotectl = Column(String(50), nullable=False)
    b8_saldo = Column(Numeric(15, 4), nullable=False)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Relacionamentos
    inventory_item = relationship("InventoryItem", back_populates="lot_snapshots")
    created_by_user = relationship("User", foreign_keys=[created_by])
```

#### **ETAPA 2.2: Adicionar relacionamentos em InventoryItem**
**Arquivo**: `backend/app/models/models.py`
**Localização**: Dentro da classe `InventoryItem` (linha ~315)

```python
# Adicionar no final da classe InventoryItem, após os relacionamentos existentes:

# Relacionamentos com snapshots (v2.10.0)
snapshot = relationship(
    "InventoryItemSnapshot",
    back_populates="inventory_item",
    uselist=False,  # 1:1
    cascade="all, delete-orphan"
)
lot_snapshots = relationship(
    "InventoryLotSnapshot",
    back_populates="inventory_item",
    cascade="all, delete-orphan"  # 1:N
)
```

#### **ETAPA 2.3: Testar importação dos modelos**
```bash
# Testar se modelos foram criados corretamente
docker-compose restart backend
docker-compose logs backend | grep -i "error"
```

---

### **ETAPA 3: CRIAR FUNÇÕES AUXILIARES DE BUSCA** 🔍

**Duração**: 1 hora

#### **ETAPA 3.1: Identificar tabelas locais**

**Perguntas para confirmar:**
1. Tabelas SB1, SB2, SB8, SBZ já existem LOCALMENTE?
2. Qual o nome exato dessas tabelas? (ex: `protheus.SB1010`?)
3. Schema dessas tabelas? (ex: `schema = protheus`?)

**Se não existem**: Precisaremos criar tabelas temporárias ou buscar direto do Protheus

#### **ETAPA 3.2: Criar funções de busca**
**Arquivo**: `backend/app/services/snapshot_service.py` (NOVO)

```python
"""
Serviço de Snapshot de Inventário
Responsável por congelar dados no momento da inclusão de produtos
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


def buscar_dados_produto_local(
    db: Session,
    product_code: str,
    warehouse: str,
    store_code: str
) -> Optional[Dict]:
    """
    Busca dados do produto nas tabelas LOCAIS (SB1, SB2, SBZ)

    Args:
        db: Sessão do banco
        product_code: Código do produto (ex: '00001')
        warehouse: Código do armazém (ex: '01')
        store_code: Código da filial (ex: '01')

    Returns:
        Dicionário com todos os campos ou None se não encontrado
    """
    try:
        # TODO: Ajustar query conforme estrutura real das tabelas locais
        query = text("""
            SELECT
                -- SB2: Estoque
                sb2.b2_filial,
                sb2.b2_cod,
                sb2.b2_local,
                sb2.b2_qatu,
                sb2.b2_cm1,

                -- SB1: Produto
                sb1.b1_desc,
                sb1.b1_rastro,
                sb1.b1_grupo,
                sb1.b1_xcatgor,
                sb1.b1_xsubcat,
                sb1.b1_xsegmen,
                sb1.b1_xgrinve,

                -- SBZ: Indicadores
                sbz.bz_xlocal1,
                sbz.bz_xlocal2,
                sbz.bz_xlocal3

            FROM protheus.SB2010 sb2
            INNER JOIN protheus.SB1010 sb1 ON sb1.b1_cod = sb2.b2_cod
            LEFT JOIN protheus.SBZ010 sbz ON sbz.bz_cod = sb1.b1_cod
            WHERE sb2.b2_cod = :product_code
              AND sb2.b2_local = :warehouse
              AND sb2.b2_filial = :store_code
              AND sb2.D_E_L_E_T_ = ''
              AND sb1.D_E_L_E_T_ = ''
        """)

        result = db.execute(query, {
            "product_code": product_code,
            "warehouse": warehouse,
            "store_code": store_code
        }).fetchone()

        if not result:
            logger.warning(f"Produto {product_code} não encontrado nas tabelas locais")
            return None

        # Converter para dicionário
        return {
            # SB2
            "b2_filial": result.b2_filial,
            "b2_cod": result.b2_cod,
            "b2_local": result.b2_local,
            "b2_qatu": float(result.b2_qatu) if result.b2_qatu else 0.0,
            "b2_cm1": float(result.b2_cm1) if result.b2_cm1 else 0.0,

            # SB1
            "b1_desc": result.b1_desc,
            "b1_rastro": result.b1_rastro,
            "b1_grupo": result.b1_grupo,
            "b1_xcatgor": result.b1_xcatgor,
            "b1_xsubcat": result.b1_xsubcat,
            "b1_xsegmen": result.b1_xsegmen,
            "b1_xgrinve": result.b1_xgrinve,

            # SBZ
            "bz_xlocal1": result.bz_xlocal1,
            "bz_xlocal2": result.bz_xlocal2,
            "bz_xlocal3": result.bz_xlocal3,
        }

    except Exception as e:
        logger.error(f"Erro ao buscar dados do produto {product_code}: {e}")
        return None


def buscar_lotes_produto_local(
    db: Session,
    product_code: str,
    warehouse: str,
    store_code: str
) -> List[Dict]:
    """
    Busca lotes do produto nas tabelas LOCAIS (SB8)

    Args:
        db: Sessão do banco
        product_code: Código do produto
        warehouse: Código do armazém
        store_code: Código da filial

    Returns:
        Lista de dicionários com b8_lotectl e b8_saldo
    """
    try:
        # TODO: Ajustar query conforme estrutura real da tabela SB8 local
        query = text("""
            SELECT
                b8_lotectl,
                b8_saldo
            FROM protheus.SB8010
            WHERE b8_produto = :product_code
              AND b8_local = :warehouse
              AND b8_filial = :store_code
              AND b8_saldo > 0
              AND D_E_L_E_T_ = ''
            ORDER BY b8_lotectl
        """)

        results = db.execute(query, {
            "product_code": product_code,
            "warehouse": warehouse,
            "store_code": store_code
        }).fetchall()

        lotes = []
        for row in results:
            lotes.append({
                "b8_lotectl": row.b8_lotectl,
                "b8_saldo": float(row.b8_saldo) if row.b8_saldo else 0.0
            })

        logger.info(f"Encontrados {len(lotes)} lotes para produto {product_code}")
        return lotes

    except Exception as e:
        logger.error(f"Erro ao buscar lotes do produto {product_code}: {e}")
        return []


def criar_snapshot_produto(
    db: Session,
    inventory_item_id: str,
    product_data: Dict,
    user_id: str
) -> bool:
    """
    Cria snapshot de dados do produto

    Args:
        db: Sessão do banco
        inventory_item_id: UUID do inventory_item
        product_data: Dicionário com dados retornados por buscar_dados_produto_local
        user_id: UUID do usuário que está criando

    Returns:
        True se sucesso, False caso contrário
    """
    try:
        from app.models.models import InventoryItemSnapshot

        snapshot = InventoryItemSnapshot(
            inventory_item_id=inventory_item_id,
            # SB2
            b2_filial=product_data.get('b2_filial'),
            b2_cod=product_data.get('b2_cod'),
            b2_local=product_data.get('b2_local'),
            b2_qatu=product_data.get('b2_qatu'),
            b2_cm1=product_data.get('b2_cm1'),
            # SB1
            b1_desc=product_data.get('b1_desc'),
            b1_rastro=product_data.get('b1_rastro'),
            b1_grupo=product_data.get('b1_grupo'),
            b1_xcatgor=product_data.get('b1_xcatgor'),
            b1_xsubcat=product_data.get('b1_xsubcat'),
            b1_xsegmen=product_data.get('b1_xsegmen'),
            b1_xgrinve=product_data.get('b1_xgrinve'),
            # SBZ
            bz_xlocal1=product_data.get('bz_xlocal1'),
            bz_xlocal2=product_data.get('bz_xlocal2'),
            bz_xlocal3=product_data.get('bz_xlocal3'),
            # Metadata
            created_by=user_id
        )

        db.add(snapshot)
        logger.info(f"Snapshot criado para inventory_item {inventory_item_id}")
        return True

    except Exception as e:
        logger.error(f"Erro ao criar snapshot: {e}")
        return False


def criar_snapshots_lotes(
    db: Session,
    inventory_item_id: str,
    lotes: List[Dict],
    user_id: str
) -> int:
    """
    Cria snapshots de lotes

    Args:
        db: Sessão do banco
        inventory_item_id: UUID do inventory_item
        lotes: Lista de dicionários com b8_lotectl e b8_saldo
        user_id: UUID do usuário que está criando

    Returns:
        Número de lotes criados
    """
    try:
        from app.models.models import InventoryLotSnapshot

        count = 0
        for lote_data in lotes:
            lot_snapshot = InventoryLotSnapshot(
                inventory_item_id=inventory_item_id,
                b8_lotectl=lote_data['b8_lotectl'],
                b8_saldo=lote_data['b8_saldo'],
                created_by=user_id
            )
            db.add(lot_snapshot)
            count += 1

        logger.info(f"{count} snapshots de lotes criados para inventory_item {inventory_item_id}")
        return count

    except Exception as e:
        logger.error(f"Erro ao criar snapshots de lotes: {e}")
        return 0
```

---

### **ETAPA 4: MODIFICAR ENDPOINT DE ADICIONAR PRODUTOS** 🔌

**Duração**: 1.5 horas

#### **ETAPA 4.1: Identificar endpoint correto**

Buscar nos arquivos:
- `backend/app/main.py`
- `backend/app/api/v1/endpoints/inventory.py`

Endpoint provável:
- `POST /api/v1/inventory/lists/{id}/products`
- Ou similar que adiciona produtos ao inventário

#### **ETAPA 4.2: Modificar lógica do endpoint**

**Padrão atual** (provável):
```python
@app.post("/api/v1/inventory/lists/{id}/products")
async def add_products_to_inventory(...):
    for product_code in product_codes:
        # Criar inventory_item
        item = InventoryItem(...)
        db.add(item)

    db.commit()
    return {"success": True}
```

**Novo padrão** (com snapshot):
```python
from app.services.snapshot_service import (
    buscar_dados_produto_local,
    buscar_lotes_produto_local,
    criar_snapshot_produto,
    criar_snapshots_lotes
)

@app.post("/api/v1/inventory/lists/{id}/products")
async def add_products_to_inventory(...):
    for product_code in product_codes:
        # 1. Criar inventory_item (lógica existente)
        item = InventoryItem(...)
        db.add(item)
        db.flush()  # Para obter o ID

        # 2. ⭐ NOVO: Buscar dados do produto nas tabelas locais
        product_data = buscar_dados_produto_local(
            db=db,
            product_code=product_code,
            warehouse=warehouse,
            store_code=store_code
        )

        if not product_data:
            logger.warning(f"Produto {product_code} não encontrado - snapshot não criado")
            continue

        # 3. ⭐ NOVO: Criar snapshot do produto
        snapshot_created = criar_snapshot_produto(
            db=db,
            inventory_item_id=str(item.id),
            product_data=product_data,
            user_id=str(current_user.id)
        )

        if not snapshot_created:
            logger.error(f"Falha ao criar snapshot do produto {product_code}")
            # Decidir: continuar ou fazer rollback?

        # 4. ⭐ NOVO: Se produto tem lote, criar snapshots de lotes
        if product_data.get('b1_rastro') == 'L':
            lotes = buscar_lotes_produto_local(
                db=db,
                product_code=product_code,
                warehouse=warehouse,
                store_code=store_code
            )

            if lotes:
                lotes_created = criar_snapshots_lotes(
                    db=db,
                    inventory_item_id=str(item.id),
                    lotes=lotes,
                    user_id=str(current_user.id)
                )
                logger.info(f"Produto {product_code}: {lotes_created} lotes congelados")
            else:
                logger.warning(f"Produto {product_code} tem rastreamento por lote mas nenhum lote encontrado")

    db.commit()
    logger.info(f"Produtos adicionados ao inventário {inventory_id} com snapshots criados")
    return {"success": True, "message": "Produtos e snapshots criados com sucesso"}
```

---

### **ETAPA 5: MODIFICAR CONSULTAS PARA USAR SNAPSHOT** 🔄

**Duração**: 2 horas

#### **Endpoints/Telas a Modificar:**

1. **Modal "Ver Detalhes"** - Buscar descrição/custo do snapshot
2. **Modal de Lotes** - Buscar lotes do snapshot (NÃO mais SB8!)
3. **Página de Contagem** - Exibir dados do snapshot
4. **Análise de Inventário** - Usar snapshot para comparações
5. **Relatórios** - Usar snapshot para valores financeiros

#### **ETAPA 5.1: Modal de Lotes (PRIORITÁRIO)**

**Arquivo**: Buscar endpoint que retorna lotes
**Provável**: `GET /api/v1/cycles/product/{code}/lots`

**ANTES** (busca dinâmica):
```python
# Busca lotes DIRETO das tabelas Protheus (SB8010)
query = text("SELECT * FROM protheus.SB8010 WHERE ...")
lotes = db.execute(query).fetchall()
```

**DEPOIS** (busca snapshot):
```python
from app.models.models import InventoryLotSnapshot, InventoryItem

# Buscar inventory_item_id primeiro
inventory_item = db.query(InventoryItem).filter(
    InventoryItem.product_code == product_code,
    InventoryItem.inventory_list_id == inventory_id
).first()

if not inventory_item:
    return {"error": "Item não encontrado"}

# Buscar lotes CONGELADOS do snapshot
lotes_snapshot = db.query(InventoryLotSnapshot).filter(
    InventoryLotSnapshot.inventory_item_id == inventory_item.id
).all()

# Retornar lotes congelados
lotes = [{
    "lot_number": lot.b8_lotectl,
    "balance": float(lot.b8_saldo),
    "is_snapshot": True  # Flag indicando que é dado congelado
} for lot in lotes_snapshot]
```

#### **ETAPA 5.2: Modal "Ver Detalhes"**

**Modificar**: Exibir dados do snapshot (descrição, grupo, localização)

**Query exemplo**:
```python
from app.models.models import InventoryItemSnapshot

# Buscar snapshot junto com item
item_with_snapshot = db.query(InventoryItem).join(
    InventoryItemSnapshot,
    InventoryItem.id == InventoryItemSnapshot.inventory_item_id
).filter(InventoryItem.id == item_id).first()

# Usar dados do snapshot
descricao = item_with_snapshot.snapshot.b1_desc
grupo = item_with_snapshot.snapshot.b1_grupo
localizacao = item_with_snapshot.snapshot.bz_xlocal1
custo_medio = item_with_snapshot.snapshot.b2_cm1
```

#### **ETAPA 5.3: Relatórios (Custo Total)**

**Novo Cálculo**:
```python
# Calcular valor total do inventário usando custo médio congelado
query = text("""
    SELECT
        ii.product_code,
        s.b1_desc as descricao,
        s.b2_qatu as qty_esperada,
        ii.count_cycle_1 as qty_contada,
        s.b2_cm1 as custo_unitario,
        (ii.count_cycle_1 * s.b2_cm1) as valor_total
    FROM inventario.inventory_items ii
    JOIN inventario.inventory_items_snapshot s ON s.inventory_item_id = ii.id
    WHERE ii.inventory_list_id = :inventory_id
""")
```

---

### **ETAPA 6: TESTES E VALIDAÇÃO** ✅

**Duração**: 1.5 horas

#### **ETAPA 6.1: Teste Funcional Completo**

**Cenário de Teste:**
```
1. Criar novo inventário "Teste Snapshot"
2. Clicar "Configurar Produtos"
3. Adicionar produtos:
   - Produto SEM lote: código 00001
   - Produto COM lote: código 00002
4. Validar no banco:
   - SELECT * FROM inventory_items_snapshot WHERE inventory_item_id = ?
   - SELECT * FROM inventory_lots_snapshot WHERE inventory_item_id = ?
5. Abrir modal "Ver Detalhes"
   - Verificar descrição vem do snapshot
6. Abrir modal de Lotes
   - Verificar lotes vêm do snapshot
7. Simular mudança nos dados "ao vivo":
   - Alterar SB2.b2_qatu manualmente
   - Alterar SB8.b8_saldo manualmente
8. Reabrir modais
   - ✅ Dados devem permanecer os mesmos (congelados)
```

#### **ETAPA 6.2: Validação de Performance**

```sql
-- Query deve ser rápida (< 100ms)
EXPLAIN ANALYZE
SELECT ii.*, s.*
FROM inventario.inventory_items ii
LEFT JOIN inventario.inventory_items_snapshot s ON s.inventory_item_id = ii.id
WHERE ii.inventory_list_id = 'UUID_AQUI';
```

#### **ETAPA 6.3: Teste de Integridade**

```sql
-- Todos os inventory_items devem ter snapshot
SELECT COUNT(*) as items_sem_snapshot
FROM inventario.inventory_items ii
LEFT JOIN inventario.inventory_items_snapshot s ON s.inventory_item_id = ii.id
WHERE s.id IS NULL;
-- Deve retornar 0

-- Produtos com lote devem ter snapshots de lotes
SELECT ii.product_code, s.b1_rastro, COUNT(ls.id) as total_lotes
FROM inventario.inventory_items ii
JOIN inventario.inventory_items_snapshot s ON s.inventory_item_id = ii.id
LEFT JOIN inventario.inventory_lots_snapshot ls ON ls.inventory_item_id = ii.id
WHERE s.b1_rastro = 'L'
GROUP BY ii.product_code, s.b1_rastro
HAVING COUNT(ls.id) = 0;
-- Deve retornar 0 (produtos com lote devem ter ao menos 1 lote)
```

---

### **ETAPA 7: ANÁLISE DE ÓRFÃOS E COMMITS** 📦

**Duração**: 30 minutos

#### **ETAPA 7.1: Criar backup final**
```bash
timestamp=$(date +%Y%m%d_%H%M%S)
tar -czf backup_snapshot_${timestamp}.tar.gz \
    backend/ \
    database/ \
    frontend/ \
    docs/ \
    --exclude=node_modules \
    --exclude=__pycache__ \
    --exclude=*.pyc
```

#### **ETAPA 7.2: Análise de órfãos**
- Verificar arquivos temporários criados
- Validar que nada foi esquecido

#### **ETAPA 7.3: Commits organizados**

**Estrutura de commits:**
```
1. feat(database): Adicionar tabelas de snapshot de inventário (v2.10.0)
2. feat(models): Criar modelos SQLAlchemy para snapshot (v2.10.0)
3. feat(services): Adicionar serviço de snapshot de produtos (v2.10.0)
4. feat(api): Integrar snapshot ao adicionar produtos (v2.10.0)
5. fix(api): Modificar consultas para usar snapshot (v2.10.0)
6. docs: Documentar sistema de snapshot v2.10.0
```

---

## 📊 CHECKLIST DE EXECUÇÃO

### **Antes de Começar:**
- [ ] Sistema em funcionamento (v2.9.3.2)
- [ ] Backup completo criado
- [ ] Documentação lida e compreendida
- [ ] Ambiente de desenvolvimento pronto

### **ETAPA 0: Documentação**
- [ ] CLAUDE.md atualizado
- [ ] DOCUMENTACAO.md atualizado
- [ ] CHANGELOG_CICLOS.md atualizado
- [ ] TROUBLESHOOTING_CICLOS.md atualizado
- [ ] Backup de segurança criado

### **ETAPA 1: Banco de Dados**
- [ ] Migration SQL criada
- [ ] Migration executada com sucesso
- [ ] Tabelas criadas e validadas
- [ ] Índices criados

### **ETAPA 2: Modelos**
- [ ] InventoryItemSnapshot criado
- [ ] InventoryLotSnapshot criado
- [ ] Relacionamentos adicionados
- [ ] Backend reiniciado sem erros

### **ETAPA 3: Funções Auxiliares**
- [ ] Tabelas locais identificadas
- [ ] snapshot_service.py criado
- [ ] Funções de busca implementadas
- [ ] Funções testadas isoladamente

### **ETAPA 4: Endpoint**
- [ ] Endpoint identificado
- [ ] Lógica de snapshot integrada
- [ ] Logs adicionados
- [ ] Teste de adicionar produto com snapshot

### **ETAPA 5: Consultas**
- [ ] Modal de lotes modificado
- [ ] Modal "Ver Detalhes" modificado
- [ ] Página de contagem modificada
- [ ] Relatórios modificados
- [ ] Todos os endpoints testados

### **ETAPA 6: Testes**
- [ ] Teste funcional completo executado
- [ ] Validação de performance OK
- [ ] Teste de integridade OK
- [ ] Validação de imutabilidade OK

### **ETAPA 7: Finalização**
- [ ] Backup final criado
- [ ] Análise de órfãos concluída
- [ ] Commits organizados
- [ ] Documentação final atualizada

---

## 🚨 PONTOS DE ATENÇÃO

### **Riscos:**
1. **Tabelas locais não existem** → Precisará criar ou buscar direto do Protheus
2. **Performance em grandes volumes** → Testar com 10k+ produtos
3. **Produtos sem dados completos** → Decidir como tratar campos NULL

### **Validações Críticas:**
1. ✅ Todo inventory_item DEVE ter snapshot
2. ✅ Produtos com lote (b1_rastro='L') DEVEM ter ao menos 1 lote
3. ✅ Dados do snapshot NUNCA devem mudar após criação
4. ✅ Consultas devem usar snapshot, NÃO tabelas dinâmicas

---

## 📞 CONTATOS E REFERÊNCIAS

**Documento**: PLANO_SNAPSHOT_INVENTARIO_v1.0.md
**Autor**: Claude Code
**Revisor**: Clenio
**Data**: 13/10/2025
**Status**: APROVADO ✅

**Documentos Relacionados:**
- CLAUDE.md
- docs/CHANGELOG_CICLOS.md
- docs/TROUBLESHOOTING_CICLOS.md
- CORRECAO_DEFINITIVA_CICLOS_v2.8.md

---

## 🎯 RESULTADO ESPERADO

Ao final da implementação:

✅ **Sistema imune a mudanças externas**
✅ **Relatórios sempre consistentes**
✅ **Análises de divergência corretas**
✅ **Custo total do inventário calculável**
✅ **Rastreabilidade total de lotes**
✅ **Dados congelados no momento certo**

**Versão pós-implementação**: v2.10.0
**Tempo estimado total**: 6-8 horas

---

**🌙 BOM DESCANSO E ATÉ AMANHÃ!**
