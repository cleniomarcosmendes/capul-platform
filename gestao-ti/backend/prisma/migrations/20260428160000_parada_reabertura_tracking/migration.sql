-- =================================================================
-- Migration: registros_parada.reaberta_em + reaberta_por_id (NOVO)
-- =================================================================
-- Contexto: feedback do operador (28/04/2026) — paradas FINALIZADA
-- estavam permitindo edição silenciosa via API mesmo após bloqueio
-- de UI, e ao reabrir+refinalizar não havia rastreabilidade do que
-- mudou. Solução: registrar quando/quem reabriu para que a finalização
-- subsequente exija observações documentando as alterações.
--
-- Comportamento esperado:
--   - reabrir() seta reaberta_em + reaberta_por_id
--   - finalizar() em parada com reaberta_em != NULL exige observações
--     (mínimo 10 chars) — backend valida + frontend destaca campo
--   - Após finalização bem-sucedida, ambos os campos são zerados
--
-- Migration aditiva (colunas nullable). Rollback = voltar imagem;
-- colunas ficam órfãs sem uso.
-- =================================================================

ALTER TABLE "gestao_ti"."registros_parada"
  ADD COLUMN IF NOT EXISTS "reaberta_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reaberta_por_id" TEXT;

-- FK seguindo o padrão das outras (registrado_por_id, finalizado_por_id) —
-- referencia core.usuarios via cross-schema. ON DELETE SET NULL evita
-- que delete de usuário antigo bloqueie cleanup de paradas.
-- Idempotente: pula se a constraint já existe (re-execução segura).
DO $$ BEGIN
  ALTER TABLE "gestao_ti"."registros_parada"
    ADD CONSTRAINT "registros_parada_reaberta_por_id_fkey"
    FOREIGN KEY ("reaberta_por_id")
    REFERENCES "core"."usuarios"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FK para core.usuarios (Usuario está no schema core via Prisma, mas
-- a coluna é UUID livre — não criamos FK cross-schema porque o Prisma
-- gerencia a integridade referencial via @relation).
