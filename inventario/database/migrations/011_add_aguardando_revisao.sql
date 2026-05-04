-- Migration 011: Liberar para supervisor (handoff de listas)
-- Adiciona estado AGUARDANDO_REVISAO entre EM_CONTAGEM e ENCERRADA.
-- list_status é String(20) (sem enum no DB), então só novas colunas e tabela de histórico.

BEGIN;

-- 1) Colunas de handoff em counting_lists
ALTER TABLE inventario.counting_lists
  ADD COLUMN IF NOT EXISTS entregue_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entregue_por_id   UUID REFERENCES inventario.users(id),
  ADD COLUMN IF NOT EXISTS devolvido_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS devolvido_por_id  UUID REFERENCES inventario.users(id),
  ADD COLUMN IF NOT EXISTS motivo_devolucao  TEXT;

CREATE INDEX IF NOT EXISTS idx_counting_lists_entregue_em
  ON inventario.counting_lists(entregue_em)
  WHERE entregue_em IS NOT NULL;

-- 2) Tabela de histórico imutável de handoffs
CREATE TABLE IF NOT EXISTS inventario.counting_list_handoff_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id      UUID NOT NULL REFERENCES inventario.counting_lists(id) ON DELETE CASCADE,
  evento       VARCHAR(20) NOT NULL,  -- ENTREGUE, DEVOLVIDA, FINALIZADA, ENCERRADA
  ator_id      UUID NOT NULL REFERENCES inventario.users(id),
  ciclo        INTEGER NOT NULL,      -- ciclo da lista no momento do evento
  observacao   TEXT,
  itens_devolvidos JSONB,             -- lista de inventory_item_id quando devolução parcial
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_handoff_evento CHECK (evento IN ('ENTREGUE', 'DEVOLVIDA', 'FINALIZADA', 'ENCERRADA'))
);

CREATE INDEX IF NOT EXISTS idx_handoff_history_list_id
  ON inventario.counting_list_handoff_history(list_id);
CREATE INDEX IF NOT EXISTS idx_handoff_history_created_at
  ON inventario.counting_list_handoff_history(created_at DESC);

COMMENT ON TABLE  inventario.counting_list_handoff_history IS
  'Histórico imutável de handoffs entre contador e supervisor: entrega, devolução, finalização, encerramento.';
COMMENT ON COLUMN inventario.counting_lists.entregue_em IS
  'Quando o contador entregou a lista para revisão do supervisor (status AGUARDANDO_REVISAO).';
COMMENT ON COLUMN inventario.counting_lists.devolvido_em IS
  'Última vez que o supervisor devolveu a lista para o contador (volta a EM_CONTAGEM).';
COMMENT ON COLUMN inventario.counting_lists.motivo_devolucao IS
  'Motivo informado pelo supervisor na última devolução.';

COMMIT;
