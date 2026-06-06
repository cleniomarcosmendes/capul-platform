-- Escopo por filial nos cadastros (ClienteLocal/EnderecoEntrega). As filiais
-- ficam em cidades diferentes — sem escopo, a busca do balcão misturaria
-- endereços homônimos de outras cidades. Aditivo/idempotente.

ALTER TABLE "logistica"."cliente_local"   ADD COLUMN IF NOT EXISTS "filial_id" TEXT;
ALTER TABLE "logistica"."endereco_entrega" ADD COLUMN IF NOT EXISTS "filial_id" TEXT;

CREATE INDEX IF NOT EXISTS "cliente_local_filial_id_idx"   ON "logistica"."cliente_local"("filial_id");
CREATE INDEX IF NOT EXISTS "endereco_entrega_filial_id_idx" ON "logistica"."endereco_entrega"("filial_id");

-- Backfill: deriva a filial das entregas que usam cada cadastro (linhas antigas).
-- 1) Endereço diretamente vinculado a entregas (endereco_entrega_id).
UPDATE "logistica"."endereco_entrega" ee
   SET "filial_id" = sub.filial_id
  FROM (
    SELECT DISTINCT ON (endereco_entrega_id) endereco_entrega_id, filial_id
      FROM "logistica"."entrega"
     WHERE endereco_entrega_id IS NOT NULL
     ORDER BY endereco_entrega_id, criado_em
  ) sub
 WHERE ee.id = sub.endereco_entrega_id AND ee."filial_id" IS NULL;

-- 2) Endereço por matrícula (sem vínculo direto) → deriva por matrícula.
UPDATE "logistica"."endereco_entrega" ee
   SET "filial_id" = sub.filial_id
  FROM (
    SELECT DISTINCT ON (matricula) matricula, filial_id
      FROM "logistica"."entrega"
     WHERE matricula IS NOT NULL
     ORDER BY matricula, criado_em
  ) sub
 WHERE ee.matricula = sub.matricula AND ee."filial_id" IS NULL;

-- 3) Cliente local → deriva das entregas vinculadas.
UPDATE "logistica"."cliente_local" cl
   SET "filial_id" = sub.filial_id
  FROM (
    SELECT DISTINCT ON (cliente_local_id) cliente_local_id, filial_id
      FROM "logistica"."entrega"
     WHERE cliente_local_id IS NOT NULL
     ORDER BY cliente_local_id, criado_em
  ) sub
 WHERE cl.id = sub.cliente_local_id AND cl."filial_id" IS NULL;
