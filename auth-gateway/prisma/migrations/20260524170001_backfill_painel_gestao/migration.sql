-- ============================================================================
-- Workspace Multi-Departamento — Backfill Painel de Gestão (parte 2/2)
-- ============================================================================
-- Pré-requisito: migration 20260524170000_add_painel_gestao_funcionalidades
-- já comitada (valores PAINEL_GESTAO_CHAMADO/PROJETO presentes no enum).
--
-- Backfill: todo departamento que tem CHAMADO ativo ganha PAINEL_GESTAO_CHAMADO
-- ativo; análogo pra PROJETO. ativadoPor = primeiro usuário de Tec Info
-- (mesmo critério do seed inicial). Aborta se não houver — força rodar seed.
-- ============================================================================

DO $$
DECLARE
  v_ativador_id uuid;
BEGIN
  SELECT u.id INTO v_ativador_id
  FROM core.usuarios u
  JOIN core.departamentos d ON d.id = u.departamento_id
  WHERE d.nome = 'Tecnologia da Informacao'
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_ativador_id IS NULL THEN
    RAISE EXCEPTION 'Migration abortada: nenhum usuário em "Tecnologia da Informacao" pra usar como ativadoPor do backfill. Rodar seed do auth-gateway primeiro.';
  END IF;

  -- Backfill PAINEL_GESTAO_CHAMADO: pra cada depto com CHAMADO ativo
  INSERT INTO core.departamento_funcionalidades
    (id, departamento_id, funcionalidade, ativo, ativado_em, ativado_por)
  SELECT
    gen_random_uuid(),
    df.departamento_id,
    'PAINEL_GESTAO_CHAMADO'::core."FuncionalidadeWorkspace",
    true,
    NOW(),
    v_ativador_id
  FROM core.departamento_funcionalidades df
  WHERE df.funcionalidade = 'CHAMADO'
    AND df.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM core.departamento_funcionalidades df2
      WHERE df2.departamento_id = df.departamento_id
        AND df2.funcionalidade = 'PAINEL_GESTAO_CHAMADO'
    );

  -- Backfill PAINEL_GESTAO_PROJETO: pra cada depto com PROJETO ativo
  INSERT INTO core.departamento_funcionalidades
    (id, departamento_id, funcionalidade, ativo, ativado_em, ativado_por)
  SELECT
    gen_random_uuid(),
    df.departamento_id,
    'PAINEL_GESTAO_PROJETO'::core."FuncionalidadeWorkspace",
    true,
    NOW(),
    v_ativador_id
  FROM core.departamento_funcionalidades df
  WHERE df.funcionalidade = 'PROJETO'
    AND df.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM core.departamento_funcionalidades df2
      WHERE df2.departamento_id = df.departamento_id
        AND df2.funcionalidade = 'PAINEL_GESTAO_PROJETO'
    );
END $$;
