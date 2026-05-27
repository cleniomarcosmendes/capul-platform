-- ============================================================================
-- S16.4 (27/05) — Backfill Cadastros funcionalidades (parte 2/2)
-- ============================================================================
-- Pré-requisito: migration 20260527150000_add_cadastro_funcionalidades
-- já comitada (9 valores CADASTRO_* presentes no enum).
--
-- Backfill: ativa as 9 funcionalidades novas APENAS em T.I. (preserva
-- status quo — só T.I. tinha menu Cadastros visível antes; demais deptos
-- ativam manualmente via Configurador). ativadoPor = primeiro usuário de
-- Tec Info. Aborta se não houver — força rodar seed.
-- ============================================================================

DO $$
DECLARE
  -- core.usuarios.id e core.departamentos.id são `text`, não `uuid`.
  v_ativador_id text;
  v_ti_id text;
  v_funcionalidades core."FuncionalidadeWorkspace"[] := ARRAY[
    'CADASTRO_DEPARTAMENTO',
    'CADASTRO_CENTRO_CUSTO',
    'CADASTRO_NATUREZA_FINANCEIRA',
    'CADASTRO_TIPO_CONTRATO',
    'CADASTRO_FORNECEDOR',
    'CADASTRO_PRODUTO',
    'CADASTRO_TIPO_PRODUTO',
    'CADASTRO_TIPO_PROJETO',
    'CADASTRO_CATEGORIA_LICENCA'
  ]::core."FuncionalidadeWorkspace"[];
  v_func core."FuncionalidadeWorkspace";
BEGIN
  SELECT id INTO v_ti_id FROM core.departamentos
    WHERE nome = 'Tecnologia da Informacao' LIMIT 1;

  IF v_ti_id IS NULL THEN
    RAISE EXCEPTION 'Migration abortada: depto "Tecnologia da Informacao" não encontrado. Rodar seed do auth-gateway primeiro.';
  END IF;

  SELECT u.id INTO v_ativador_id
  FROM core.usuarios u
  WHERE u.departamento_id = v_ti_id
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_ativador_id IS NULL THEN
    RAISE EXCEPTION 'Migration abortada: nenhum usuário em T.I. pra usar como ativadoPor. Rodar seed do auth-gateway primeiro.';
  END IF;

  FOREACH v_func IN ARRAY v_funcionalidades LOOP
    INSERT INTO core.departamento_funcionalidades
      (id, departamento_id, funcionalidade, ativo, ativado_em, ativado_por)
    VALUES
      (gen_random_uuid(), v_ti_id, v_func, true, NOW(), v_ativador_id)
    ON CONFLICT (departamento_id, funcionalidade) DO NOTHING;
  END LOOP;
END $$;
