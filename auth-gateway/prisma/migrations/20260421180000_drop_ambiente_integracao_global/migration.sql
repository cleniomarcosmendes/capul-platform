-- =================================================================
-- Migration: drop coluna integracoes_api.ambiente (global)
-- =================================================================
-- Contexto: a flag global de ambiente foi substituida pelo controle
-- per-endpoint via ModuloConsumidor + flag `ativo` (ver migration
-- 20260420230000_add_modulo_per_endpoint).
--
-- Esta migration finaliza a transicao removendo a coluna obsoleta.
-- Pre-requisitos ja satisfeitos:
--   - Todos os consumidores (Fiscal, Gestao TI, Inventario) leem o
--     ambiente derivado do response do endpoint interno.
--   - UI Configurador nao referencia mais `integ.ambiente` global.
--   - Response de getEndpointsAtivos deriva "ambiente" dos endpoints
--     ativos (valor pode ser MIXED).
-- =================================================================

ALTER TABLE "core"."integracoes_api"
  DROP COLUMN IF EXISTS "ambiente";
