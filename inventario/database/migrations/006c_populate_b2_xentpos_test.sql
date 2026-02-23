-- Script de TESTE: Popular campo b2_xentpos com dados fictícios
-- Data: 31/10/2025
-- Versão: v2.17.0
-- ATENÇÃO: Este script é APENAS para testes. Dados reais virão da API Protheus.

BEGIN;

-- ==========================================
-- ATUALIZAR SB2010 (Saldo Estoque)
-- ==========================================

-- Estratégia: Atualizar 30 produtos com valores aleatórios
-- Valores entre 1 e 20 unidades para facilitar visualização

WITH produtos_aleatorios AS (
    SELECT b2_filial, b2_cod, b2_local, b2_qatu
    FROM inventario.sb2010
    WHERE b2_qatu > 0  -- Apenas produtos com saldo
    ORDER BY RANDOM()
    LIMIT 30
)
UPDATE inventario.sb2010 sb2
SET b2_xentpos = CASE
    -- 50% dos produtos: 5 unidades
    WHEN RANDOM() < 0.5 THEN 5.00
    -- 30% dos produtos: 10 unidades
    WHEN RANDOM() < 0.8 THEN 10.00
    -- 20% dos produtos: entre 1 e 20 unidades
    ELSE ROUND((RANDOM() * 19 + 1)::numeric, 2)
END
FROM produtos_aleatorios pa
WHERE sb2.b2_filial = pa.b2_filial
  AND sb2.b2_cod = pa.b2_cod
  AND sb2.b2_local = pa.b2_local;

-- ==========================================
-- ATUALIZAR INVENTORY_ITEMS_SNAPSHOT
-- ==========================================

-- Atualizar snapshots de inventários ativos com os mesmos valores
UPDATE inventario.inventory_items_snapshot snap
SET b2_xentpos = sb2.b2_xentpos
FROM inventario.sb2010 sb2
WHERE snap.b2_cod = sb2.b2_cod
  AND snap.b2_filial = sb2.b2_filial
  AND snap.b2_local = sb2.b2_local
  AND sb2.b2_xentpos > 0;  -- Apenas onde foi populado

COMMIT;

-- ==========================================
-- VERIFICAÇÃO: Mostrar produtos atualizados
-- ==========================================

SELECT
    '✅ PRODUTOS COM ENTREGAS POSTERIORES' as status,
    COUNT(*) as total_produtos
FROM inventario.sb2010
WHERE b2_xentpos > 0;

SELECT
    b2_filial as filial,
    b2_cod as codigo_produto,
    b2_local as armazem,
    b2_qatu as qtd_atual,
    b2_xentpos as entregas_posteriores,
    (b2_qatu + b2_xentpos) as qtd_esperada_ajustada
FROM inventario.sb2010
WHERE b2_xentpos > 0
ORDER BY b2_xentpos DESC, b2_cod
LIMIT 20;

SELECT
    '✅ SNAPSHOTS ATUALIZADOS' as status,
    COUNT(*) as total_snapshots
FROM inventario.inventory_items_snapshot
WHERE b2_xentpos > 0;
