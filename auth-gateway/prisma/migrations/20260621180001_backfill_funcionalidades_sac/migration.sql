-- SAC — backfill das funcionalidades de SAC (parte 2/2).
-- Pré-requisito: 20260621180000 comitada (4 valores no enum).
-- Ativa as 4 funcionalidades de SAC em T.I. (preserva o status quo: admin de
-- T.I. enxerga o menu). Os demais deptos (ex.: o workspace de SAC) ativam pelo
-- Configurador conforme uso. Após rodar, os usuários precisam RE-LOGAR pra o
-- JWT trazer as funcionalidades novas.
DO $$
DECLARE
  v_ativador_id text;
  v_ti_id text;
  v_funcionalidades core."FuncionalidadeWorkspace"[] := ARRAY[
    'SAC_TRIAGEM',
    'SAC_INDICADOR',
    'SAC_TEMPLATE',
    'SAC_EMAIL_CONFIG'
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
