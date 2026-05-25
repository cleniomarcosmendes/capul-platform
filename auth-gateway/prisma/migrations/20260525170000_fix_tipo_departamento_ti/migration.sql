-- ============================================================================
-- S14.3 (25/05) — corrige tipo_departamento do depto T.I.
-- ============================================================================
-- O seed inicial cria T.I. com `tipo_departamento = 'Tecnologia'` (ver
-- auth-gateway/prisma/seed.ts:155). Mas DEV/HOM/PROD têm o depto com tipo
-- 'Administrativo' (provavelmente alteração manual antiga via Configurador
-- ou seed pré-existente). Resultado: `isTI` no JWT (S12) depende da regra
-- OR (nome OU tipo começa com "Tecnologia") em vez de só do tipo.
--
-- Esta migration corrige a tipagem sem mexer em outros deptos. Idempotente:
-- aborta com NOTICE se o tipo "Tecnologia" não existir (devs custom poderia
-- ter renomeado). Não cria o tipo — assume seed básico aplicado.
--
-- Após esta migration, a regra `nome OR tipo` continua válida (defesa em
-- profundidade preservada — se algum depto for renomeado em outro deploy,
-- o tipo segue marcando), mas o tipo passa a ser a fonte primária correta.
-- ============================================================================

DO $$
DECLARE
  v_tipo_tecnologia text;
  v_updated int;
BEGIN
  -- Resolver ID do tipo "Tecnologia" como text (tolerante a uuid OU text na
  -- coluna — algumas tabelas do auth-gateway usam uuid nativo, outras text;
  -- comparação cast pra text funciona nos dois).
  SELECT id::text INTO v_tipo_tecnologia
  FROM core.tipos_departamento
  WHERE LOWER(nome) LIKE 'tecnologia%'
  ORDER BY nome
  LIMIT 1;

  IF v_tipo_tecnologia IS NULL THEN
    RAISE NOTICE 'S14.3: tipo "Tecnologia" não existe em core.tipos_departamento — skip (rode seed antes).';
    RETURN;
  END IF;

  -- Atualiza deptos cujo nome começa com "Tecnologia" (T.I., variantes).
  -- Não toca deptos com nome diferente — operador pode classificar manualmente.
  -- Cast pra text na comparação dá robustez a uuid/text mismatch.
  UPDATE core.departamentos
     SET tipo_departamento_id = v_tipo_tecnologia::uuid,
         updated_at = NOW()
   WHERE LOWER(nome) LIKE 'tecnologia%'
     AND tipo_departamento_id::text IS DISTINCT FROM v_tipo_tecnologia;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'S14.3: % depto(s) reclassificado(s) para tipo "Tecnologia".', v_updated;
END $$;
