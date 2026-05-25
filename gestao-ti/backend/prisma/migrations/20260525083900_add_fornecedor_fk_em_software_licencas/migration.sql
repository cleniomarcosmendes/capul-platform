-- ============================================================================
-- Workspace S11 (25/05) — fornecedor_id FK em software_licencas
-- ============================================================================
-- Adiciona FK opcional p/ gestao_ti.fornecedores na tabela software_licencas.
-- Mesmo padrão do Contrato (campo texto `fornecedor` continua existindo p/
-- retrocompat; `fornecedor_id` é o novo cadastro centralizado).
--
-- SEM backfill automático — registros legados ficam com fornecedor_id NULL e
-- mantêm o texto livre em `fornecedor`. Operador faz match manualmente via UI.
-- ON DELETE SET NULL: excluir um fornecedor não derruba a licença (apenas
-- desvincula — o texto `fornecedor` continua preservado p/ histórico).
-- ============================================================================

ALTER TABLE gestao_ti.software_licencas
  ADD COLUMN IF NOT EXISTS fornecedor_id text;

ALTER TABLE gestao_ti.software_licencas
  DROP CONSTRAINT IF EXISTS software_licencas_fornecedor_id_fkey;
ALTER TABLE gestao_ti.software_licencas
  ADD CONSTRAINT software_licencas_fornecedor_id_fkey
  FOREIGN KEY (fornecedor_id) REFERENCES gestao_ti.fornecedores(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS software_licencas_fornecedor_id_idx
  ON gestao_ti.software_licencas(fornecedor_id);
