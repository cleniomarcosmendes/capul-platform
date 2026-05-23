-- ============================================================================
-- Onda 1 — Sub-fase 1.3 — Workspace Multi-Departamento
-- Migration: add_departamento_funcionalidades
-- ============================================================================
-- Cria enum FuncionalidadeWorkspace (12 valores) + tabela
-- core.departamento_funcionalidades (D32/§4.2.12 do doc-mestre v1.2) que
-- habilita/desabilita funcionalidades por departamento — granularidade fina
-- pra o onboarding piloto por depto (D34).
--
-- Seed inicial:
--   - T.I.: TODAS as 12 funcionalidades ativas (preserva status quo)
--   - Demais deptos: nada (ativam sob demanda via UI Configurador na Sub-fase 1.6)
--
-- Fiscal e Controladoria NÃO existem em DEV (vide investigação na sub-fase 1.1,
-- listagem de 13 deptos sem esses dois). Quando forem cadastrados, ADMIN
-- ativa funcionalidades manualmente.
-- ============================================================================

-- ============================================================================
-- PRÉ-FLIGHT — abortar se depto T.I. ou usuário admin não existirem
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.departamentos WHERE nome ILIKE 'Tecnologia%') THEN
    RAISE EXCEPTION 'Migration abortada: depto "Tecnologia da Informacao" nao encontrado em core.departamentos. Rodar seed do auth-gateway antes.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.usuarios WHERE username = 'admin') THEN
    RAISE EXCEPTION 'Migration abortada: usuario "admin" nao encontrado em core.usuarios (necessario para ativado_por do seed). Rodar seed do auth-gateway antes.';
  END IF;
END $$;

-- ============================================================================
-- 1. Enum FuncionalidadeWorkspace (12 valores)
-- ============================================================================
CREATE TYPE core."FuncionalidadeWorkspace" AS ENUM (
  'CHAMADO',
  'PROJETO',
  'OS',
  'EQUIPE',
  'CONTRATO',
  'NOTA_FISCAL',
  'SOFTWARE',
  'LICENCA',
  'ATIVO',
  'PARADA',
  'INDICADOR_OPERACIONAL',
  'INDICADOR_ESTRATEGICO'
);

-- ============================================================================
-- 2. Tabela departamento_funcionalidades
-- ============================================================================
CREATE TABLE core.departamento_funcionalidades (
  id              TEXT PRIMARY KEY,
  departamento_id TEXT NOT NULL,
  funcionalidade  core."FuncionalidadeWorkspace" NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ativado_em      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ativado_por     TEXT NOT NULL,
  desativado_em   TIMESTAMP(3),
  desativado_por  TEXT,
  CONSTRAINT departamento_funcionalidades_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- UNIQUE composta (padrão Prisma — UNIQUE INDEX, não CONSTRAINT formal;
-- vide feedback_prisma_unique_e_index_nao_constraint da Sub-fase 1.2)
CREATE UNIQUE INDEX departamento_funcionalidades_departamento_id_funcionalidade_key
  ON core.departamento_funcionalidades (departamento_id, funcionalidade);

-- INDEX pra filtros departamentais
CREATE INDEX departamento_funcionalidades_departamento_id_idx
  ON core.departamento_funcionalidades (departamento_id);

-- ============================================================================
-- 3. Seed inicial: T.I. com TODAS as 12 funcionalidades ativas
-- ============================================================================
INSERT INTO core.departamento_funcionalidades
  (id, departamento_id, funcionalidade, ativo, ativado_em, ativado_por)
SELECT
  gen_random_uuid()::text,
  d.id,
  f::core."FuncionalidadeWorkspace",
  true,
  CURRENT_TIMESTAMP,
  (SELECT id FROM core.usuarios WHERE username = 'admin' LIMIT 1)
FROM
  core.departamentos d,
  unnest(ARRAY[
    'CHAMADO', 'PROJETO', 'OS', 'EQUIPE', 'CONTRATO', 'NOTA_FISCAL',
    'SOFTWARE', 'LICENCA', 'ATIVO', 'PARADA',
    'INDICADOR_OPERACIONAL', 'INDICADOR_ESTRATEGICO'
  ]) AS f
WHERE d.nome ILIKE 'Tecnologia%';

-- ============================================================================
-- FIM
-- ============================================================================
-- Próximos passos (fora desta migration):
--   - Sub-fase 1.4: JWT payload — auth-gateway monta funcionalidades[] no payload
--   - Sub-fase 1.5: RBAC guards backend filtram por funcionalidade ativa
--   - Sub-fase 1.6: UI Configurador — grid depto × funcionalidade
