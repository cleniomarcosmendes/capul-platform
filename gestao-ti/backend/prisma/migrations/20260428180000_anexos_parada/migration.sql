-- Migration: cria tabela gestao_ti.anexos_parada
--
-- Contexto: o modelo `AnexoParada` já existia no schema.prisma há semanas e a
-- tabela existia em ambientes onde alguém rodou `prisma db push` (DEV/HOM
-- local), mas NUNCA houve migration commitada — em PROD a tabela nunca foi
-- criada. Descoberto em 28/04/2026 após Douglas reportar erro 500 no upload
-- de anexo de parada (ver memory `feedback_sefaz_an_fallback_consulente.md`
-- e investigação do mesmo dia sobre `projetos_favorito`).
--
-- SQL idempotente — pode ser aplicado em qualquer ambiente sem efeito quando
-- a tabela já existe (caso de DEV onde db push criou).

CREATE TABLE IF NOT EXISTS "gestao_ti"."anexos_parada" (
    "id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parada_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "anexos_parada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "anexos_parada_parada_id_idx" ON "gestao_ti"."anexos_parada"("parada_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'gestao_ti'
          AND table_name = 'anexos_parada'
          AND constraint_name = 'anexos_parada_parada_id_fkey'
    ) THEN
        ALTER TABLE "gestao_ti"."anexos_parada"
        ADD CONSTRAINT "anexos_parada_parada_id_fkey"
        FOREIGN KEY ("parada_id") REFERENCES "gestao_ti"."registros_parada"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'gestao_ti'
          AND table_name = 'anexos_parada'
          AND constraint_name = 'anexos_parada_usuario_id_fkey'
    ) THEN
        ALTER TABLE "gestao_ti"."anexos_parada"
        ADD CONSTRAINT "anexos_parada_usuario_id_fkey"
        FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id")
        ON DELETE NO ACTION ON UPDATE CASCADE;
    END IF;
END $$;
