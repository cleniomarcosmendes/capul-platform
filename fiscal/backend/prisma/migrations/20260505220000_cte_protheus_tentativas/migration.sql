-- CT-e — Limite de retry Protheus (05/05/2026 noite)
-- Sub 6.1: hoje qualquer FALHA_TECNICA do Protheus é re-tentada
-- indefinidamente no cron de enriquecimento (hh:30). Se Protheus ficar
-- offline ou XML for definitivamente inválido, fica "varrendo eternamente".
--
-- Solução:
--   - Contador de tentativas em cte_documento
--   - Após MAX_TENTATIVAS_PROTHEUS (default 5), status vira PROTHEUS_DESISTIU
--     (terminal — saí da fila de retry)
--   - Endpoint admin reseta contador pra forçar nova tentativa após
--     resolver causa raiz (ex: corrigir XML, religar Protheus)

ALTER TABLE "fiscal"."cte_documento"
  ADD COLUMN "protheus_tentativas" INTEGER NOT NULL DEFAULT 0;

-- Índice composto pra cron — fila de retry (FALHA_TECNICA com tentativas < MAX)
CREATE INDEX "cte_documento_protheus_status_tentativas_idx"
  ON "fiscal"."cte_documento" ("protheus_status", "protheus_tentativas");
