-- ============================================================================
-- Workspace Multi-Departamento C2.7 — chamado.departamento_id NOT NULL
-- ============================================================================
-- Pós auditoria 24/05 (Workspace branch): 0 chamados com departamento_id NULL
-- no DB DEV (após migration 20260524000000 ter realocado os 98 existentes).
-- Tornar NOT NULL elimina o risco de chamado órfão criado por código novo
-- bypassando o backfill — `applyDepartamentoFilter` ficaria "cego" pra null.
--
-- equipes.departamentoId já é NOT NULL desde 1.1, então o create
-- (chamado-core.service.ts:540) sempre consegue popular. Defesa em
-- profundidade: backend + DB constraint.
-- ============================================================================

-- Safety net: aborta se houver chamado órfão (não deveria, mas barato confirmar)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gestao_ti.chamados WHERE departamento_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migration abortada: % chamados com departamento_id NULL. Investigar antes de aplicar (ex: criados após backfill C2.7 sem equipe? equipes sem departamentoId?).', v_count;
  END IF;
END $$;

ALTER TABLE gestao_ti.chamados ALTER COLUMN departamento_id SET NOT NULL;
