-- =================================
-- MIGRATION: Sistema de Snapshot de Inventário
-- Versão: v2.10.0
-- Data: 15/10/2025
-- Descrição: Adiciona tabelas para congelar dados do inventário no momento
--            da inclusão de produtos, garantindo imutabilidade e consistência
-- =================================

-- Definir search_path para o schema inventario
SET search_path TO inventario, public;

-- =================================
-- TABELA 1: SNAPSHOT DE DADOS ÚNICOS DO PRODUTO (1:1)
-- =================================
-- Armazena dados congelados de SB1 (Produto), SB2 (Estoque) e SBZ (Indicadores)
-- no momento da inclusão do produto no inventário

CREATE TABLE IF NOT EXISTS inventory_items_snapshot (
    -- Chave primária
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relacionamento 1:1 com inventory_items
    inventory_item_id UUID NOT NULL UNIQUE,

    -- =================================
    -- SB2: DADOS DE ESTOQUE POR ARMAZÉM
    -- =================================
    b2_filial VARCHAR(4),           -- Código da filial
    b2_cod VARCHAR(50),              -- Código do produto
    b2_local VARCHAR(2),             -- Código do armazém (ex: 01, 02, 03)
    b2_qatu NUMERIC(15,4),           -- Quantidade atual em estoque (congelada)
    b2_cm1 NUMERIC(15,4),            -- ⭐ Custo médio unitário (para cálculos financeiros)

    -- =================================
    -- SB1: DADOS DO CADASTRO DE PRODUTOS
    -- =================================
    b1_desc VARCHAR(200),            -- Descrição do produto
    b1_rastro VARCHAR(1),            -- Tipo de rastreamento: L=Lote, S=Série, N=Não rastreia
    b1_grupo VARCHAR(50),            -- Grupo do produto
    b1_xcatgor VARCHAR(50),          -- Categoria personalizada
    b1_xsubcat VARCHAR(50),          -- Subcategoria personalizada
    b1_xsegmen VARCHAR(50),          -- Segmento personalizado
    b1_xgrinve VARCHAR(50),          -- Grupo de inventário personalizado

    -- =================================
    -- SBZ: DADOS DE INDICADORES DO PRODUTO
    -- =================================
    bz_xlocal1 VARCHAR(50),          -- Localização física nível 1 (ex: Corredor A)
    bz_xlocal2 VARCHAR(50),          -- Localização física nível 2 (ex: Prateleira 5)
    bz_xlocal3 VARCHAR(50),          -- Localização física nível 3 (ex: Posição 12)

    -- =================================
    -- METADATA
    -- =================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    -- Foreign keys
    CONSTRAINT fk_inventory_items_snapshot_item
        FOREIGN KEY (inventory_item_id)
        REFERENCES inventory_items(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inventory_items_snapshot_user
        FOREIGN KEY (created_by)
        REFERENCES users(id)
);

-- =================================
-- ÍNDICES PARA PERFORMANCE
-- =================================

-- Índice principal (relacionamento 1:1)
CREATE INDEX IF NOT EXISTS idx_inventory_items_snapshot_item
    ON inventory_items_snapshot(inventory_item_id);

-- Índice para busca por produto
CREATE INDEX IF NOT EXISTS idx_inventory_items_snapshot_product
    ON inventory_items_snapshot(b2_cod);

-- Índice para busca temporal
CREATE INDEX IF NOT EXISTS idx_inventory_items_snapshot_created_at
    ON inventory_items_snapshot(created_at);

-- =================================
-- COMENTÁRIOS
-- =================================

COMMENT ON TABLE inventory_items_snapshot IS
    'Snapshot de dados congelados do produto no momento da inclusão no inventário. '
    'Unifica dados de SB1 (Cadastro), SB2 (Estoque) e SBZ (Indicadores). '
    'Relacionamento 1:1 com inventory_items. Imutável após criação.';

COMMENT ON COLUMN inventory_items_snapshot.inventory_item_id IS
    'Relacionamento 1:1 com inventory_items. Cada item tem exatamente um snapshot.';

COMMENT ON COLUMN inventory_items_snapshot.b2_cm1 IS
    'Custo médio unitário congelado (b2_cm1) para cálculos financeiros. '
    'Permite calcular valor total do inventário: qty * b2_cm1';

COMMENT ON COLUMN inventory_items_snapshot.b1_rastro IS
    'Tipo de rastreamento: L=Lote, S=Série, N=Não rastreia. '
    'Produtos com L=Lote terão snapshots em inventory_lots_snapshot.';

-- =================================
-- TABELA 2: SNAPSHOT DE LOTES (1:N)
-- =================================
-- Armazena múltiplos lotes congelados de SB8 (Saldo por Lote)
-- no momento da inclusão do produto no inventário

CREATE TABLE IF NOT EXISTS inventory_lots_snapshot (
    -- Chave primária
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relacionamento 1:N com inventory_items
    inventory_item_id UUID NOT NULL,

    -- =================================
    -- SB8: DADOS DE SALDO POR LOTE
    -- =================================
    b8_lotectl VARCHAR(50) NOT NULL,    -- Número do lote (ex: 000000000019208)
    b8_saldo NUMERIC(15,4) NOT NULL,    -- Saldo do lote (congelado)

    -- =================================
    -- METADATA
    -- =================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    -- Foreign keys
    CONSTRAINT fk_inventory_lots_snapshot_item
        FOREIGN KEY (inventory_item_id)
        REFERENCES inventory_items(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inventory_lots_snapshot_user
        FOREIGN KEY (created_by)
        REFERENCES users(id),

    -- Constraint: Lote único por item (não pode ter lote duplicado para mesmo item)
    CONSTRAINT uk_inventory_lots_snapshot_item_lot
        UNIQUE (inventory_item_id, b8_lotectl)
);

-- =================================
-- ÍNDICES PARA PERFORMANCE
-- =================================

-- Índice principal (relacionamento 1:N)
CREATE INDEX IF NOT EXISTS idx_inventory_lots_snapshot_item
    ON inventory_lots_snapshot(inventory_item_id);

-- Índice para busca por lote
CREATE INDEX IF NOT EXISTS idx_inventory_lots_snapshot_lot
    ON inventory_lots_snapshot(b8_lotectl);

-- Índice para busca temporal
CREATE INDEX IF NOT EXISTS idx_inventory_lots_snapshot_created_at
    ON inventory_lots_snapshot(created_at);

-- =================================
-- COMENTÁRIOS
-- =================================

COMMENT ON TABLE inventory_lots_snapshot IS
    'Snapshot de lotes congelados no momento da inclusão do produto no inventário. '
    'Armazena múltiplos lotes de SB8 (Saldo por Lote). '
    'Relacionamento 1:N com inventory_items (um produto pode ter vários lotes). '
    'Apenas produtos com b1_rastro=L terão registros aqui. Imutável após criação.';

COMMENT ON COLUMN inventory_lots_snapshot.inventory_item_id IS
    'Relacionamento 1:N com inventory_items. Cada item pode ter múltiplos lotes.';

COMMENT ON COLUMN inventory_lots_snapshot.b8_lotectl IS
    'Número do lote congelado (ex: 000000000019208). '
    'Constraint garante que não há lotes duplicados para o mesmo item.';

COMMENT ON COLUMN inventory_lots_snapshot.b8_saldo IS
    'Saldo do lote congelado no momento da inclusão. '
    'Usado para validação de contagens por lote.';

-- =================================
-- FIM DA MIGRATION
-- =================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 003: Tabelas de snapshot criadas com sucesso!';
    RAISE NOTICE '   - inventory_items_snapshot (1:1 com inventory_items)';
    RAISE NOTICE '   - inventory_lots_snapshot (1:N com inventory_items)';
    RAISE NOTICE '   - Índices criados para performance';
    RAISE NOTICE '   - Sistema pronto para congelamento de dados v2.10.0';
END $$;
