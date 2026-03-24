-- ================================================
-- MIGRATION 006: Cycle Audit Log Table
-- Sistema de Inventário Protheus v2.16.0
-- Data: 28/10/2025
-- Descrição: Tabela de auditoria para rastreamento
--            completo de operações de ciclos
-- ================================================
-- Motivação: Bug crítico v2.15.5 demonstrou necessidade
--            de rastreabilidade completa para proteger
--            contra prejuízos financeiros (R$ 850/produto)
-- ================================================

-- Criar tabela de auditoria de ciclos
CREATE TABLE IF NOT EXISTS inventario.cycle_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacionamentos
    inventory_list_id UUID NOT NULL REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE,
    counting_list_id UUID REFERENCES inventario.counting_lists(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES inventario.users(id) ON DELETE RESTRICT,

    -- Dados da operação
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'CREATE_LIST',           -- Criação de lista de contagem
        'START_CYCLE',           -- Início de um ciclo
        'END_CYCLE',             -- Encerramento de ciclo
        'FINALIZE_INVENTORY',    -- Finalização do inventário
        'RECALCULATE_DISCREPANCIES', -- Recálculo de divergências
        'ADVANCE_CYCLE',         -- Avanço de ciclo
        'SYNC_CYCLES',           -- Sincronização de ciclos (fix v2.15.5)
        'MANUAL_ADJUSTMENT',     -- Ajuste manual
        'ANOMALY_DETECTED'       -- Anomalia detectada pelo sistema
    )),

    -- Estado anterior e novo
    old_cycle INT,
    new_cycle INT,

    -- Timestamps
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Metadados adicionais (JSON) - NOTA: "extra_metadata" é reservado pelo SQLAlchemy
    extra_extra_metadata JSONB DEFAULT '{}'::jsonb,

    -- Índices
    CONSTRAINT cycle_audit_log_cycle_values CHECK (
        (old_cycle IS NULL OR old_cycle >= 1) AND
        (new_cycle IS NULL OR new_cycle >= 1)
    )
);

-- Comentários da tabela
COMMENT ON TABLE inventario.cycle_audit_log IS 'Tabela de auditoria para rastreamento completo de operações de ciclos de inventário (v2.16.0)';
COMMENT ON COLUMN inventario.cycle_audit_log.id IS 'ID único do log de auditoria';
COMMENT ON COLUMN inventario.cycle_audit_log.inventory_list_id IS 'ID do inventário relacionado';
COMMENT ON COLUMN inventario.cycle_audit_log.counting_list_id IS 'ID da lista de contagem (NULL se operação no inventário)';
COMMENT ON COLUMN inventario.cycle_audit_log.user_id IS 'ID do usuário que executou a ação';
COMMENT ON COLUMN inventario.cycle_audit_log.action IS 'Tipo de ação executada (CREATE_LIST, START_CYCLE, END_CYCLE, etc.)';
COMMENT ON COLUMN inventario.cycle_audit_log.old_cycle IS 'Ciclo anterior (NULL se não aplicável)';
COMMENT ON COLUMN inventario.cycle_audit_log.new_cycle IS 'Novo ciclo (NULL se não aplicável)';
COMMENT ON COLUMN inventario.cycle_audit_log.timestamp IS 'Data/hora da operação';
COMMENT ON COLUMN inventario.cycle_audit_log.extra_metadata IS 'Dados adicionais em formato JSON: { products_pending: 10, discrepancies: 5, products_counted: 100, etc }';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cycle_audit_log_inventory_list
    ON inventario.cycle_audit_log(inventory_list_id);

CREATE INDEX IF NOT EXISTS idx_cycle_audit_log_counting_list
    ON inventario.cycle_audit_log(counting_list_id)
    WHERE counting_list_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cycle_audit_log_user
    ON inventario.cycle_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_cycle_audit_log_action
    ON inventario.cycle_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_cycle_audit_log_timestamp
    ON inventario.cycle_audit_log(timestamp DESC);

-- Índice GIN para busca rápida em JSONB
CREATE INDEX IF NOT EXISTS idx_cycle_audit_log_extra_metadata_gin
    ON inventario.cycle_audit_log USING GIN(extra_metadata);

-- ================================================
-- FUNÇÃO HELPER: Registrar auditoria
-- ================================================
CREATE OR REPLACE FUNCTION inventario.log_cycle_audit(
    p_inventory_list_id UUID,
    p_counting_list_id UUID,
    p_user_id UUID,
    p_action VARCHAR,
    p_old_cycle INT DEFAULT NULL,
    p_new_cycle INT DEFAULT NULL,
    p_extra_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO inventario.cycle_audit_log (
        inventory_list_id,
        counting_list_id,
        user_id,
        action,
        old_cycle,
        new_cycle,
        extra_metadata
    ) VALUES (
        p_inventory_list_id,
        p_counting_list_id,
        p_user_id,
        p_action,
        p_old_cycle,
        p_new_cycle,
        p_extra_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION inventario.log_cycle_audit IS 'Função helper para registrar logs de auditoria de ciclos';

-- ================================================
-- TESTES DE VALIDAÇÃO
-- ================================================

-- Teste 1: Inserção básica
DO $$
DECLARE
    v_log_id UUID;
    v_test_inventory_id UUID;
    v_test_user_id UUID;
BEGIN
    -- Buscar primeiro inventário e usuário para teste
    SELECT id INTO v_test_inventory_id FROM inventario.inventory_lists LIMIT 1;
    SELECT id INTO v_test_user_id FROM inventario.users LIMIT 1;

    IF v_test_inventory_id IS NULL OR v_test_user_id IS NULL THEN
        RAISE NOTICE '⚠️ Teste ignorado: sem dados para testar';
        RETURN;
    END IF;

    -- Testar função helper
    v_log_id := inventario.log_cycle_audit(
        p_inventory_list_id := v_test_inventory_id,
        p_counting_list_id := NULL,
        p_user_id := v_test_user_id,
        p_action := 'START_CYCLE',
        p_old_cycle := 1,
        p_new_cycle := 2,
        p_extra_metadata := '{"test": true, "products_counted": 100}'::jsonb
    );

    IF v_log_id IS NOT NULL THEN
        RAISE NOTICE '✅ Teste 1 passou: Log criado com ID %', v_log_id;

        -- Limpar teste
        DELETE FROM inventario.cycle_audit_log WHERE id = v_log_id;
    ELSE
        RAISE EXCEPTION '❌ Teste 1 falhou: Log não foi criado';
    END IF;
END $$;

-- Teste 2: Validação de constraints
DO $$
BEGIN
    -- Tentar inserir ação inválida (deve falhar)
    BEGIN
        INSERT INTO inventario.cycle_audit_log (
            inventory_list_id,
            user_id,
            action
        ) VALUES (
            gen_random_uuid(),
            gen_random_uuid(),
            'INVALID_ACTION'
        );

        RAISE EXCEPTION '❌ Teste 2 falhou: Constraint de action não funcionou';
    EXCEPTION
        WHEN check_violation OR invalid_text_representation THEN
            RAISE NOTICE '✅ Teste 2 passou: Constraint de action funcionando';
    END;
END $$;

-- ================================================
-- SUMMARY
-- ================================================
SELECT
    '✅ Migration 006 aplicada com sucesso' as status,
    COUNT(*) as total_logs,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'cycle_audit_log') as total_indexes
FROM inventario.cycle_audit_log;
