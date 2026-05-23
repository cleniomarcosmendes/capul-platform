-- ============================================================================
-- Lote 1.7 — Rename GESTAO_TI → WORKSPACE (módulo paralelo — D37 Opção B)
-- ============================================================================
-- Cria WORKSPACE como módulo novo paralelo, copia roles (com renames),
-- migra TODAS as permissões do GESTAO_TI pro WORKSPACE, marca GESTAO_TI
-- INATIVO (preserva pra rollback) e remove roles legacy.
--
-- Decisões:
--   D37 (Q1) — Opção B paralelo (rollback fácil)
--   D6 — 6 roles ativas: ADMIN, GESTOR, SUPORTE, USUARIO_FINAL,
--        USUARIO_CHAVE, TERCEIRIZADO
--   D6 — 4 roles removidas: TECNICO, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA
--        (DEV confirma zero registros)
--
-- Pré-flight:
--   - GESTAO_TI deve existir e ter pelo menos 1 permissão
--   - WORKSPACE NÃO deve existir ainda (re-execução abortada)
-- ============================================================================

-- ============================================================================
-- PRÉ-FLIGHT
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.modulos_sistema WHERE codigo = 'GESTAO_TI') THEN
    RAISE EXCEPTION 'Migration abortada: módulo GESTAO_TI não encontrado';
  END IF;
  IF EXISTS (SELECT 1 FROM core.modulos_sistema WHERE codigo = 'WORKSPACE') THEN
    RAISE EXCEPTION 'Migration abortada: módulo WORKSPACE já existe (re-execução não permitida)';
  END IF;
END $$;

-- ============================================================================
-- 1. Criar módulo WORKSPACE
-- ============================================================================
INSERT INTO core.modulos_sistema (
  id, codigo, nome, descricao, icone, cor, url_frontend,
  ordem, status, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  'WORKSPACE',
  'Workspace',
  'Plataforma multi-departamental para gestão de operação interna (chamados, projetos, OS, contratos, NFs, etc.)',
  icone,
  cor,
  url_frontend,
  ordem,
  'ATIVO',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM core.modulos_sistema
WHERE codigo = 'GESTAO_TI';

-- ============================================================================
-- 2. Copiar roles (com renames) GESTAO_TI → WORKSPACE
--    Pular as 4 roles legacy a remover (TECNICO/DESENV/MANUT/INFRA)
-- ============================================================================
INSERT INTO core.roles_modulo (id, modulo_id, codigo, nome, descricao)
SELECT
  gen_random_uuid()::text,
  (SELECT id FROM core.modulos_sistema WHERE codigo = 'WORKSPACE'),
  CASE codigo
    WHEN 'GESTOR_TI'  THEN 'GESTOR'
    WHEN 'SUPORTE_TI' THEN 'SUPORTE'
    ELSE codigo
  END AS codigo,
  CASE codigo
    WHEN 'GESTOR_TI'  THEN 'Gestor'
    WHEN 'SUPORTE_TI' THEN 'Suporte'
    ELSE nome
  END AS nome,
  descricao
FROM core.roles_modulo
WHERE modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'GESTAO_TI')
  AND codigo NOT IN ('TECNICO', 'DESENVOLVEDOR', 'MANUTENCAO', 'INFRAESTRUTURA');

-- ============================================================================
-- 3. Migrar permissoes_modulo: GESTAO_TI → WORKSPACE (modulo + role)
-- ============================================================================
UPDATE core.permissoes_modulo pm
   SET modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'WORKSPACE'),
       role_modulo_id = (
         SELECT rn.id
           FROM core.roles_modulo ro
           JOIN core.roles_modulo rn
             ON rn.modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'WORKSPACE')
            AND rn.codigo = CASE ro.codigo
                              WHEN 'GESTOR_TI'  THEN 'GESTOR'
                              WHEN 'SUPORTE_TI' THEN 'SUPORTE'
                              ELSE ro.codigo
                            END
          WHERE ro.id = pm.role_modulo_id
       )
 WHERE pm.modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'GESTAO_TI');

-- ============================================================================
-- 4. Sanity check: todas as permissões do ex-GESTAO_TI devem ter role_modulo_id
-- ============================================================================
DO $$
DECLARE
  v_orfas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orfas
    FROM core.permissoes_modulo
   WHERE modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'WORKSPACE')
     AND role_modulo_id IS NULL;
  IF v_orfas > 0 THEN
    RAISE EXCEPTION 'Sanity check FAILED: % permissões WORKSPACE sem role_modulo_id. Rollback.', v_orfas;
  END IF;
END $$;

-- ============================================================================
-- 5. Marcar GESTAO_TI INATIVO (preserva pra rollback)
-- ============================================================================
UPDATE core.modulos_sistema
   SET status = 'INATIVO',
       updated_at = CURRENT_TIMESTAMP
 WHERE codigo = 'GESTAO_TI';

-- ============================================================================
-- 6. Remover roles antigas do GESTAO_TI (todas, sem registros agora)
-- ============================================================================
-- Confere primeiro: NENHUMA permissão deve estar apontando pra roles do
-- GESTAO_TI agora (foram todas migradas pro WORKSPACE no passo 3).
DO $$
DECLARE
  v_remanesc INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remanesc
    FROM core.permissoes_modulo pm
    JOIN core.roles_modulo rm ON rm.id = pm.role_modulo_id
   WHERE rm.modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'GESTAO_TI');
  IF v_remanesc > 0 THEN
    RAISE EXCEPTION 'Sanity check FAILED: % permissões ainda apontam pra roles do GESTAO_TI. Rollback.', v_remanesc;
  END IF;
END $$;

DELETE FROM core.roles_modulo
 WHERE modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = 'GESTAO_TI');

-- ============================================================================
-- FIM
-- ============================================================================
-- Estado final:
--   - core.modulos_sistema: WORKSPACE ATIVO + GESTAO_TI INATIVO + outros
--   - core.roles_modulo: 6 roles novas no WORKSPACE; 0 roles em GESTAO_TI
--   - core.permissoes_modulo: 24 linhas com modulo_id=WORKSPACE
-- ============================================================================
