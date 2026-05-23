-- ============================================================================
-- Onda 1 — Sub-fase 1.2 — Workspace Multi-Departamento
-- Migration: add_departamento_id_permissoes_modulo
-- ============================================================================
-- Adiciona departamento_id NOT NULL em core.permissoes_modulo (auth-gateway),
-- habilita multi-perfil via UNIQUE composta (user × modulo × depto), e faz
-- backfill com depto "Tecnologia da Informacao" (T.I.) nas 46 permissões
-- existentes em DEV (preserva semantica atual).
--
-- Decisões aplicadas (doc-mestre v1.2 + plano §14 da 1.1 + §11 da 1.2):
--   D36 — sem flag is_super_admin; ADMIN é global via role
--   P7  — NOT NULL (não NULLABLE como texto literal do §4.2.1 sugeria)
--   P3  — pré-flight embutido (depto T.I. por nome, codigo vazio em DEV)
--
-- Atenção operacional:
--   Esta migration roda no auth-gateway via init job auth-migrate. Quando
--   aplicada, força o Prisma Client a esperar departamentoId em todos os
--   prisma.permissaoModulo.create/upsert — daí o commit acompanha 2 fixes
--   (usuario.service.ts e seed.ts).
-- ============================================================================

-- ============================================================================
-- PRÉ-FLIGHT — abortar se depto T.I. não existir
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.departamentos WHERE nome ILIKE 'Tecnologia%') THEN
    RAISE EXCEPTION 'Migration abortada: depto "Tecnologia da Informacao" nao encontrado em core.departamentos. Rodar seed do auth-gateway antes.';
  END IF;
END $$;

-- ============================================================================
-- 1. ADD COLUMN nullable + backfill T.I.
-- ============================================================================
ALTER TABLE core.permissoes_modulo ADD COLUMN departamento_id TEXT;

UPDATE core.permissoes_modulo
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

-- ============================================================================
-- 2. NOT NULL + FK + INDEX
-- ============================================================================
ALTER TABLE core.permissoes_modulo
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT permissoes_modulo_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX permissoes_modulo_departamento_id_idx ON core.permissoes_modulo(departamento_id);

-- ============================================================================
-- 3. UNIQUE swap — habilita multi-perfil (user × modulo × depto)
-- ============================================================================
-- ATENÇÃO: o UNIQUE original é um UNIQUE INDEX (não uma CONSTRAINT). Prisma
-- cria UNIQUE como UNIQUE INDEX e não como CONSTRAINT formal. Confirmado via
-- pg_constraint (só permissoes_modulo_pkey existe lá) e pg_indexes (o key
-- está em indexes). Usar DROP INDEX + CREATE UNIQUE INDEX pra alinhar.
DROP INDEX core.permissoes_modulo_usuario_id_modulo_id_key;

CREATE UNIQUE INDEX permissoes_modulo_usuario_id_modulo_id_departamento_id_key
  ON core.permissoes_modulo (usuario_id, modulo_id, departamento_id);

-- ============================================================================
-- FIM
-- ============================================================================
-- Próximos passos (fora desta migration):
--   - Sub-fase 1.3: criar core.departamento_funcionalidades + enum
--   - Sub-fase 1.4: JWT payload novo (auth-gateway)
--   - Sub-fase 1.5: RBAC guards backend (substitui helper temporário)
