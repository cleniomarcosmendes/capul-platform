-- ============================================================================
-- Workspace Onda 3 S1 — departamento_lancamento_id em cadastros operacionais
-- ============================================================================
-- Adiciona coluna `departamento_lancamento_id` em 6 entidades:
--   softwares, software_licencas, contratos, notas_fiscais, ativos,
--   registros_parada
--
-- Semântica (decisão Clenio E2):
--   - `departamento_id` (existente) = ALOCAÇÃO (onde o item está rodando) —
--     filtra visibilidade via applyDepartamentoFilter
--   - `departamento_lancamento_id` (NOVO) = LANÇAMENTO (snapshot do depto do
--     user que cadastrou) — auditoria, relatório "quem cadastrou pra quem"
--
-- Estratégia de backfill (decisão Clenio E4):
--   Todos os 19 itens existentes (10 SW + 6 Lic + 3 Contratos + 0 NF/Ativo/
--   Parada com dados em DEV) foram cadastrados por user T.I. — único depto
--   operacional pré-Workspace. Backfill automático = T.I. pra todos.
--
-- Aborta com RAISE EXCEPTION se depto T.I. não encontrado.
-- Cada entidade segue o ciclo padrão: ADD nullable → UPDATE → SET NOT NULL +
-- FK + índice.
-- ============================================================================

DO $$
DECLARE
  v_ti_id text;
BEGIN
  -- Resolver UUID do depto T.I. (ILIKE pra robustez — códigos vazios no DEV)
  SELECT id INTO v_ti_id
  FROM core.departamentos
  WHERE nome ILIKE 'Tecnologia%'
  LIMIT 1;

  IF v_ti_id IS NULL THEN
    RAISE EXCEPTION 'Migration abortada: depto "Tecnologia da Informacao" não encontrado em core.departamentos. Rodar seed do auth-gateway antes.';
  END IF;

  -- Helper anônimo pra cada tabela (DDL em loop não dá com EXECUTE simples;
  -- vamos explícitos pra evitar magia que dificulta debug em HOM/PROD).

  -- ─── 1. softwares ──────────────────────────────────────────────
  ALTER TABLE gestao_ti.softwares ADD COLUMN IF NOT EXISTS departamento_lancamento_id text;
  UPDATE gestao_ti.softwares SET departamento_lancamento_id = v_ti_id WHERE departamento_lancamento_id IS NULL;
  ALTER TABLE gestao_ti.softwares ALTER COLUMN departamento_lancamento_id SET NOT NULL;
  ALTER TABLE gestao_ti.softwares DROP CONSTRAINT IF EXISTS softwares_departamento_lancamento_fkey;
  ALTER TABLE gestao_ti.softwares ADD CONSTRAINT softwares_departamento_lancamento_fkey
    FOREIGN KEY (departamento_lancamento_id) REFERENCES core.departamentos(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS softwares_departamento_lancamento_id_idx
    ON gestao_ti.softwares(departamento_lancamento_id);

  -- ─── 2. software_licencas ──────────────────────────────────────
  ALTER TABLE gestao_ti.software_licencas ADD COLUMN IF NOT EXISTS departamento_lancamento_id text;
  UPDATE gestao_ti.software_licencas SET departamento_lancamento_id = v_ti_id WHERE departamento_lancamento_id IS NULL;
  ALTER TABLE gestao_ti.software_licencas ALTER COLUMN departamento_lancamento_id SET NOT NULL;
  ALTER TABLE gestao_ti.software_licencas DROP CONSTRAINT IF EXISTS software_licencas_departamento_lancamento_fkey;
  ALTER TABLE gestao_ti.software_licencas ADD CONSTRAINT software_licencas_departamento_lancamento_fkey
    FOREIGN KEY (departamento_lancamento_id) REFERENCES core.departamentos(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS software_licencas_departamento_lancamento_id_idx
    ON gestao_ti.software_licencas(departamento_lancamento_id);

  -- ─── 3. contratos ──────────────────────────────────────────────
  ALTER TABLE gestao_ti.contratos ADD COLUMN IF NOT EXISTS departamento_lancamento_id text;
  UPDATE gestao_ti.contratos SET departamento_lancamento_id = v_ti_id WHERE departamento_lancamento_id IS NULL;
  ALTER TABLE gestao_ti.contratos ALTER COLUMN departamento_lancamento_id SET NOT NULL;
  ALTER TABLE gestao_ti.contratos DROP CONSTRAINT IF EXISTS contratos_departamento_lancamento_fkey;
  ALTER TABLE gestao_ti.contratos ADD CONSTRAINT contratos_departamento_lancamento_fkey
    FOREIGN KEY (departamento_lancamento_id) REFERENCES core.departamentos(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS contratos_departamento_lancamento_id_idx
    ON gestao_ti.contratos(departamento_lancamento_id);

  -- ─── 4. notas_fiscais ──────────────────────────────────────────
  ALTER TABLE gestao_ti.notas_fiscais ADD COLUMN IF NOT EXISTS departamento_lancamento_id text;
  UPDATE gestao_ti.notas_fiscais SET departamento_lancamento_id = v_ti_id WHERE departamento_lancamento_id IS NULL;
  ALTER TABLE gestao_ti.notas_fiscais ALTER COLUMN departamento_lancamento_id SET NOT NULL;
  ALTER TABLE gestao_ti.notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_departamento_lancamento_fkey;
  ALTER TABLE gestao_ti.notas_fiscais ADD CONSTRAINT notas_fiscais_departamento_lancamento_fkey
    FOREIGN KEY (departamento_lancamento_id) REFERENCES core.departamentos(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS notas_fiscais_departamento_lancamento_id_idx
    ON gestao_ti.notas_fiscais(departamento_lancamento_id);

  -- ─── 5. ativos ─────────────────────────────────────────────────
  ALTER TABLE gestao_ti.ativos ADD COLUMN IF NOT EXISTS departamento_lancamento_id text;
  UPDATE gestao_ti.ativos SET departamento_lancamento_id = v_ti_id WHERE departamento_lancamento_id IS NULL;
  ALTER TABLE gestao_ti.ativos ALTER COLUMN departamento_lancamento_id SET NOT NULL;
  ALTER TABLE gestao_ti.ativos DROP CONSTRAINT IF EXISTS ativos_departamento_lancamento_fkey;
  ALTER TABLE gestao_ti.ativos ADD CONSTRAINT ativos_departamento_lancamento_fkey
    FOREIGN KEY (departamento_lancamento_id) REFERENCES core.departamentos(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS ativos_departamento_lancamento_id_idx
    ON gestao_ti.ativos(departamento_lancamento_id);

  -- ─── 6. registros_parada ───────────────────────────────────────
  ALTER TABLE gestao_ti.registros_parada ADD COLUMN IF NOT EXISTS departamento_lancamento_id text;
  UPDATE gestao_ti.registros_parada SET departamento_lancamento_id = v_ti_id WHERE departamento_lancamento_id IS NULL;
  ALTER TABLE gestao_ti.registros_parada ALTER COLUMN departamento_lancamento_id SET NOT NULL;
  ALTER TABLE gestao_ti.registros_parada DROP CONSTRAINT IF EXISTS registros_parada_departamento_lancamento_fkey;
  ALTER TABLE gestao_ti.registros_parada ADD CONSTRAINT registros_parada_departamento_lancamento_fkey
    FOREIGN KEY (departamento_lancamento_id) REFERENCES core.departamentos(id) ON DELETE RESTRICT;
  CREATE INDEX IF NOT EXISTS registros_parada_departamento_lancamento_id_idx
    ON gestao_ti.registros_parada(departamento_lancamento_id);
END $$;
