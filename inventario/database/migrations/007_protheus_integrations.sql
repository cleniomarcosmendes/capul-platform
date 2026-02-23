-- =====================================================
-- Migration 007: Tabela de Controle de Integrações com Protheus
-- Versão: 2.19.0
-- Data: 21/11/2025
-- Descrição: Controla integrações de inventário com ERP Protheus
--            Suporta modo simples (SB7) e comparativo (SD3 + SB7)
-- =====================================================

-- Tabela principal de integrações
CREATE TABLE IF NOT EXISTS inventario.protheus_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Referências aos inventários
    inventory_a_id UUID NOT NULL REFERENCES inventario.inventory_lists(id) ON DELETE RESTRICT,
    inventory_b_id UUID REFERENCES inventario.inventory_lists(id) ON DELETE RESTRICT,

    -- Informações da loja
    store_id UUID NOT NULL REFERENCES inventario.stores(id),

    -- Tipo de integração
    integration_type VARCHAR(20) NOT NULL CHECK (integration_type IN ('SIMPLE', 'COMPARATIVE')),
    -- SIMPLE: Apenas inventário (SB7)
    -- COMPARATIVE: Transferências (SD3) + Inventário ajustado (SB7)

    -- Status da integração
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',      -- Rascunho (preview feito, não enviado)
        'PENDING',    -- Aguardando envio
        'SENT',       -- Enviado ao Protheus
        'PROCESSING', -- Protheus processando
        'CONFIRMED',  -- Confirmado pelo Protheus
        'PARTIAL',    -- Parcialmente processado (alguns erros)
        'ERROR',      -- Erro na integração
        'CANCELLED'   -- Cancelado pelo usuário
    )),

    -- Dados da integração (payload completo)
    integration_data JSONB NOT NULL DEFAULT '{}',

    -- Resumo para exibição rápida
    summary JSONB NOT NULL DEFAULT '{}',
    -- Estrutura esperada:
    -- {
    --   "total_transfers": 10,
    --   "total_adjustments": 25,
    --   "total_transfer_value": 15000.00,
    --   "total_adjustment_value": 8500.00,
    --   "warehouses": ["06", "02"]
    -- }

    -- Resposta do Protheus
    protheus_response JSONB,
    protheus_doc_transfers VARCHAR(50),  -- Número do documento de transferência
    protheus_doc_inventory VARCHAR(50),  -- Número do documento de inventário
    error_message TEXT,

    -- Auditoria
    created_by UUID NOT NULL REFERENCES inventario.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES inventario.users(id),
    cancellation_reason TEXT,

    -- Controle de versão (para reprocessamentos)
    version INT DEFAULT 1
);

-- Índice único para evitar duplicatas (inventário A + B ou apenas A)
CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_inv_a_b
    ON inventario.protheus_integrations(inventory_a_id, inventory_b_id)
    WHERE inventory_b_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_inv_a_only
    ON inventario.protheus_integrations(inventory_a_id)
    WHERE inventory_b_id IS NULL;

-- Comentários
COMMENT ON TABLE inventario.protheus_integrations IS 'Controle de integrações de inventário com ERP Protheus (v2.19.0)';
COMMENT ON COLUMN inventario.protheus_integrations.integration_type IS 'SIMPLE=apenas SB7, COMPARATIVE=SD3+SB7';
COMMENT ON COLUMN inventario.protheus_integrations.integration_data IS 'Payload JSON completo para envio ao Protheus';
COMMENT ON COLUMN inventario.protheus_integrations.summary IS 'Resumo para exibição rápida na UI';
COMMENT ON COLUMN inventario.protheus_integrations.version IS 'Incrementado a cada reprocessamento';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_protheus_int_status
    ON inventario.protheus_integrations(status);

CREATE INDEX IF NOT EXISTS idx_protheus_int_store
    ON inventario.protheus_integrations(store_id);

CREATE INDEX IF NOT EXISTS idx_protheus_int_inv_a
    ON inventario.protheus_integrations(inventory_a_id);

CREATE INDEX IF NOT EXISTS idx_protheus_int_inv_b
    ON inventario.protheus_integrations(inventory_b_id)
    WHERE inventory_b_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_protheus_int_created
    ON inventario.protheus_integrations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_protheus_int_type_status
    ON inventario.protheus_integrations(integration_type, status);

-- Tabela de itens da integração (detalhamento)
CREATE TABLE IF NOT EXISTS inventario.protheus_integration_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES inventario.protheus_integrations(id) ON DELETE CASCADE,

    -- Tipo do item
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('TRANSFER', 'ADJUSTMENT')),
    -- TRANSFER: Movimentação SD3
    -- ADJUSTMENT: Ajuste de inventário SB7

    -- Dados do produto
    product_code VARCHAR(15) NOT NULL,
    product_description VARCHAR(100),
    lot_number VARCHAR(50),  -- NULL se produto sem lote

    -- Armazéns
    source_warehouse VARCHAR(2),  -- Origem (para transferências)
    target_warehouse VARCHAR(2),  -- Destino (para transferências) ou armazém (para ajustes)

    -- Quantidades
    quantity NUMERIC(15,4) NOT NULL,
    expected_qty NUMERIC(15,4),  -- Quantidade esperada (antes)
    counted_qty NUMERIC(15,4),   -- Quantidade contada
    adjusted_qty NUMERIC(15,4),  -- Quantidade ajustada (após transferência)

    -- Valores
    unit_cost NUMERIC(15,4),     -- Custo unitário (B2_CM1)
    total_value NUMERIC(15,2),   -- Valor total da operação

    -- Tipo de ajuste (para ADJUSTMENT)
    adjustment_type VARCHAR(20) CHECK (adjustment_type IN (
        'INCREASE',    -- Aumento de estoque
        'DECREASE',    -- Diminuição de estoque
        'ZERO_OUT',    -- Zerar estoque
        'NO_CHANGE'    -- Sem alteração (confirmação)
    )),

    -- Status do item
    item_status VARCHAR(20) DEFAULT 'PENDING' CHECK (item_status IN (
        'PENDING',     -- Aguardando
        'SENT',        -- Enviado
        'CONFIRMED',   -- Confirmado
        'ERROR'        -- Erro
    )),
    error_detail TEXT,

    -- Referência ao Protheus
    protheus_seq VARCHAR(20),  -- Sequência no documento Protheus

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentários
COMMENT ON TABLE inventario.protheus_integration_items IS 'Itens detalhados das integrações (transferências e ajustes)';
COMMENT ON COLUMN inventario.protheus_integration_items.item_type IS 'TRANSFER=SD3, ADJUSTMENT=SB7';

-- Índices
CREATE INDEX IF NOT EXISTS idx_protheus_int_items_integration
    ON inventario.protheus_integration_items(integration_id);

CREATE INDEX IF NOT EXISTS idx_protheus_int_items_product
    ON inventario.protheus_integration_items(product_code);

CREATE INDEX IF NOT EXISTS idx_protheus_int_items_type
    ON inventario.protheus_integration_items(item_type);

CREATE INDEX IF NOT EXISTS idx_protheus_int_items_status
    ON inventario.protheus_integration_items(item_status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION inventario.update_protheus_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protheus_integration_updated ON inventario.protheus_integrations;
CREATE TRIGGER trg_protheus_integration_updated
    BEFORE UPDATE ON inventario.protheus_integrations
    FOR EACH ROW
    EXECUTE FUNCTION inventario.update_protheus_integration_timestamp();

-- =====================================================
-- Dados de exemplo (comentado - apenas para referência)
-- =====================================================
/*
INSERT INTO inventario.protheus_integrations (
    inventory_a_id, inventory_b_id, store_id, integration_type, status,
    integration_data, summary, created_by
) VALUES (
    'uuid-inv-a', 'uuid-inv-b', 'uuid-store', 'COMPARATIVE', 'DRAFT',
    '{
        "header": {"type": "COMPARATIVE", "version": 1},
        "transfers": [...],
        "adjustments": [...]
    }'::jsonb,
    '{
        "total_transfers": 10,
        "total_adjustments": 25,
        "total_transfer_value": 15000.00
    }'::jsonb,
    'uuid-user'
);
*/

-- =====================================================
-- Verificação
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 007 executada com sucesso!';
    RAISE NOTICE '   - Tabela protheus_integrations criada';
    RAISE NOTICE '   - Tabela protheus_integration_items criada';
    RAISE NOTICE '   - Índices criados';
    RAISE NOTICE '   - Triggers configurados';
END $$;
