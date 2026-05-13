-- Feature de agrupamento de chamados.
--
-- Quando varios usuarios abrem chamados com o mesmo problema, T.I.
-- agrupa todos em um chamado-pai. Decidido em 13/05/2026 (item 3 do
-- pacote de melhorias do Clenio).
--
-- Modelo:
--   - chamado_agrupador_id: FK self para o chamado-pai (filho aponta pro pai).
--   - status_anterior_agrupamento: TEXT (nao enum) — preserva status original
--     para restaurar no desagrupamento. Usar texto evita ALTER TYPE em update.
--   - sla_pausado_em: TIMESTAMP — usado para somar tempo pausado a
--     data_limite_sla na hora de desagrupar.
--
-- Enums:
--   - StatusChamado ganha valor AGRUPADO.
--   - TipoHistorico ganha AGRUPADO_EM, DESAGRUPADO, RESPONDIDO_EM_GRUPO,
--     RESOLVIDO_EM_GRUPO, FECHADO_EM_GRUPO.
--
-- Idempotente via IF NOT EXISTS (enums) e DDL padrao (colunas/FK).

ALTER TYPE "gestao_ti"."StatusChamado" ADD VALUE IF NOT EXISTS 'AGRUPADO';
ALTER TYPE "gestao_ti"."TipoHistorico" ADD VALUE IF NOT EXISTS 'AGRUPADO_EM';
ALTER TYPE "gestao_ti"."TipoHistorico" ADD VALUE IF NOT EXISTS 'DESAGRUPADO';
ALTER TYPE "gestao_ti"."TipoHistorico" ADD VALUE IF NOT EXISTS 'RESPONDIDO_EM_GRUPO';
ALTER TYPE "gestao_ti"."TipoHistorico" ADD VALUE IF NOT EXISTS 'RESOLVIDO_EM_GRUPO';
ALTER TYPE "gestao_ti"."TipoHistorico" ADD VALUE IF NOT EXISTS 'FECHADO_EM_GRUPO';

ALTER TABLE "gestao_ti"."chamados"
    ADD COLUMN IF NOT EXISTS "chamado_agrupador_id" TEXT,
    ADD COLUMN IF NOT EXISTS "status_anterior_agrupamento" TEXT,
    ADD COLUMN IF NOT EXISTS "sla_pausado_em" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "chamados_chamado_agrupador_id_idx"
    ON "gestao_ti"."chamados"("chamado_agrupador_id");

ALTER TABLE "gestao_ti"."chamados"
    ADD CONSTRAINT "chamados_chamado_agrupador_id_fkey"
    FOREIGN KEY ("chamado_agrupador_id") REFERENCES "gestao_ti"."chamados"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
