-- ============================================================================
-- Onda 1 — Sub-fase 1.1 — Workspace Multi-Departamento
-- Migration: add_departamento_id_workspace_entities
-- ============================================================================
-- Adiciona departamento_id em 10 entidades operacionais do schema gestao_ti,
-- preservando comportamento atual via backfill com o depto "Tecnologia da
-- Informacao" (T.I.) em todos os registros existentes.
--
-- Decisões aplicadas (doc-mestre v1.2 + plano §14):
--   D31  — todo operacional é multi-depto (sem T.I.-only por design)
--   D32  — habilitação granular vem em sub-fase 1.3 (esta sub-fase só schema)
--   D38  — notas_fiscais.filial_id mantém NOT NULL (Workspace NÃO é fiscal;
--          filial vestigial, RBAC primário via departamento_id)
--   D8   — software_licencas ganha equipe_responsavel_id NULLABLE junto (P2)
--   P3   — pré-flight embutido aborta migration se depto T.I. não existir
--   P6   — pré-flight usa nome ILIKE 'Tecnologia%' (codigo vazio em DEV;
--          vide INVESTIGACAO_DRIFT_DEV_23MAI.md)
--
-- Caso especial — Ativo:
--   Já tem coluna departamento_id NULLABLE (criada por migration anterior).
--   Aqui só faz: backfill NULLs + ALTER NOT NULL. ADD COLUMN/FK/INDEX já
--   existem (vide diff 23/05).
--
-- Caso especial — SoftwareLicenca:
--   Ganha 2 colunas novas: departamento_id NOT NULL + equipe_responsavel_id
--   NULLABLE (sem backfill — UX preenche).
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
-- 1. ATIVOS — caso especial (coluna já existe nullable)
-- ============================================================================
UPDATE gestao_ti.ativos
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1)
 WHERE departamento_id IS NULL;

ALTER TABLE gestao_ti.ativos
  ALTER COLUMN departamento_id SET NOT NULL;

-- (FK ativos_departamento_id_fkey e index ativos_departamento_id_idx já existem)

-- ============================================================================
-- 2. CONTRATOS — ADD COLUMN + backfill + NOT NULL + FK + INDEX
-- ============================================================================
ALTER TABLE gestao_ti.contratos ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.contratos
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.contratos
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT contratos_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX contratos_departamento_id_idx ON gestao_ti.contratos(departamento_id);

-- ============================================================================
-- 3. EQUIPES_TI — ADD COLUMN + backfill + NOT NULL + FK + INDEX
-- ============================================================================
ALTER TABLE gestao_ti.equipes_ti ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.equipes_ti
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.equipes_ti
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT equipes_ti_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX equipes_ti_departamento_id_idx ON gestao_ti.equipes_ti(departamento_id);

-- ============================================================================
-- 4. MOTIVOS_PARADA — ADD COLUMN + backfill + NOT NULL + FK + INDEX
-- ============================================================================
ALTER TABLE gestao_ti.motivos_parada ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.motivos_parada
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.motivos_parada
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT motivos_parada_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX motivos_parada_departamento_id_idx ON gestao_ti.motivos_parada(departamento_id);

-- ============================================================================
-- 5. NOTAS_FISCAIS — ADD COLUMN + backfill + NOT NULL + FK + INDEX
--    (D38: filial_id permanece NOT NULL intacto — não tocar)
-- ============================================================================
ALTER TABLE gestao_ti.notas_fiscais ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.notas_fiscais
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.notas_fiscais
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT notas_fiscais_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX notas_fiscais_departamento_id_idx ON gestao_ti.notas_fiscais(departamento_id);

-- ============================================================================
-- 6. ORDENS_SERVICO — ADD COLUMN + backfill + NOT NULL + FK + INDEX
--    (D15: filial_id permanece — visita presencial)
-- ============================================================================
ALTER TABLE gestao_ti.ordens_servico ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.ordens_servico
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.ordens_servico
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT ordens_servico_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX ordens_servico_departamento_id_idx ON gestao_ti.ordens_servico(departamento_id);

-- ============================================================================
-- 7. PROJETOS — ADD COLUMN + backfill + NOT NULL + FK + INDEX
--    (D14: subprojetos herdam departamento do projeto-pai — validado no service)
-- ============================================================================
ALTER TABLE gestao_ti.projetos ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.projetos
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.projetos
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT projetos_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX projetos_departamento_id_idx ON gestao_ti.projetos(departamento_id);

-- ============================================================================
-- 8. REGISTROS_PARADA — ADD COLUMN + backfill + NOT NULL + FK + INDEX
-- ============================================================================
ALTER TABLE gestao_ti.registros_parada ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.registros_parada
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.registros_parada
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT registros_parada_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX registros_parada_departamento_id_idx ON gestao_ti.registros_parada(departamento_id);

-- ============================================================================
-- 9. SOFTWARE_LICENCAS — ADD departamento_id NOT NULL + ADD equipe_responsavel_id NULLABLE
--    (P2 / D8: equipe_responsavel_id entra junto na sub-fase 1.1 — relação
--    "EquipeResponsavelLicenca" no Prisma pra não conflitar com Software.equipeResponsavel)
-- ============================================================================
-- departamento_id (NOT NULL com backfill)
ALTER TABLE gestao_ti.software_licencas ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.software_licencas
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.software_licencas
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT software_licencas_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX software_licencas_departamento_id_idx ON gestao_ti.software_licencas(departamento_id);

-- equipe_responsavel_id (NULLABLE — sem backfill; UX preenche quando relevante)
ALTER TABLE gestao_ti.software_licencas ADD COLUMN equipe_responsavel_id TEXT;

ALTER TABLE gestao_ti.software_licencas
  ADD CONSTRAINT software_licencas_equipe_responsavel_id_fkey
    FOREIGN KEY (equipe_responsavel_id) REFERENCES gestao_ti.equipes_ti(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX software_licencas_equipe_responsavel_id_idx ON gestao_ti.software_licencas(equipe_responsavel_id);

-- ============================================================================
-- 10. SOFTWARES — ADD COLUMN + backfill + NOT NULL + FK + INDEX
--     (D31: era nullable no v1.0 do design; agora NOT NULL)
-- ============================================================================
ALTER TABLE gestao_ti.softwares ADD COLUMN departamento_id TEXT;

UPDATE gestao_ti.softwares
   SET departamento_id = (SELECT id FROM core.departamentos WHERE nome ILIKE 'Tecnologia%' LIMIT 1);

ALTER TABLE gestao_ti.softwares
  ALTER COLUMN departamento_id SET NOT NULL,
  ADD CONSTRAINT softwares_departamento_id_fkey
    FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX softwares_departamento_id_idx ON gestao_ti.softwares(departamento_id);

-- ============================================================================
-- FIM
-- ============================================================================
-- Próximos passos (fora desta migration):
--   - Sub-fase 1.2: refactor core.permissoes_modulo (departamento_id + nova unique)
--   - Sub-fase 1.3: criar core.departamento_funcionalidades + enum
--   - Sub-fase 1.4: JWT payload novo
--   - Sub-fase 1.5: RBAC guards backend
