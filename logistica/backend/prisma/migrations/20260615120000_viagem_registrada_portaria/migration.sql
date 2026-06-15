-- Saída registrada pela portaria (exceção, sem senha do condutor) — flag de
-- auditoria. false = condutor se auto-autenticou (matrícula+senha).
ALTER TABLE "logistica"."viagem" ADD COLUMN "registrada_portaria" BOOLEAN NOT NULL DEFAULT false;
