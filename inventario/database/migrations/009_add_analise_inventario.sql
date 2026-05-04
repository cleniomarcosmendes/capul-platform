-- Migration: Marcação de "Análise Concluída" em inventory_lists (Onda 3 — gating envio Protheus)
-- Data: 02/05/2026
-- Versão: v2.20.0
--
-- Motivação:
-- Plano Inventário Fluxo v1 — Onda 3. Após encerrar o inventário, o usuário
-- precisa revisar divergências antes de mandar pro Protheus. Antes desta
-- migration o envio podia ser disparado direto, sem revisão obrigatória.
--
-- Etapa do inventário (derivada no backend):
--   EM_CONTAGEM   → status DRAFT/IN_PROGRESS
--   ENCERRADO     → status COMPLETED && analisado_em IS NULL
--   ANALISADO     → analisado_em IS NOT NULL && status != CLOSED
--   INTEGRADO     → status CLOSED

BEGIN;

-- Colunas idempotentes
ALTER TABLE inventario.inventory_lists
  ADD COLUMN IF NOT EXISTS analisado_em      TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS analisado_por_id  UUID        NULL;

-- FK para users (criada apenas se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'inventory_lists_analisado_por_id_fkey'
       AND conrelid = 'inventario.inventory_lists'::regclass
  ) THEN
    ALTER TABLE inventario.inventory_lists
      ADD CONSTRAINT inventory_lists_analisado_por_id_fkey
      FOREIGN KEY (analisado_por_id) REFERENCES inventario.users(id);
  END IF;
END $$;

COMMENT ON COLUMN inventario.inventory_lists.analisado_em IS
  'Quando o supervisor marcou a análise como concluída (revisou divergências). Habilita o envio ao Protheus.';
COMMENT ON COLUMN inventario.inventory_lists.analisado_por_id IS
  'Usuário que marcou a análise como concluída. Audit trail.';

-- Backfill: inventários já efetivados (CLOSED) devem refletir etapa INTEGRADO
-- (ANALISADO inferido), evitando que histórico vire "ENCERRADO" no card.
UPDATE inventario.inventory_lists il
   SET analisado_em     = COALESCE(il.updated_at, il.created_at, NOW()),
       analisado_por_id = il.created_by
 WHERE il.status::text = 'CLOSED'
   AND il.analisado_em IS NULL;

COMMIT;
