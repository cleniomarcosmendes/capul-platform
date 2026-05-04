-- Migration: cria tabela gestao_ti.projetos_favorito
--
-- Contexto: o modelo `ProjetoFavorito` (favoritar projeto por usuário)
-- existia no schema.prisma e em ambientes via `db push`, mas sem migration
-- commitada. PROD do Douglas não tinha a tabela — botão "Favoritar" em
-- Gestão TI / Projetos disparava 500 (descoberto em 28/04/2026).
--
-- SQL idempotente.

CREATE TABLE IF NOT EXISTS "gestao_ti"."projetos_favorito" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projeto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "projetos_favorito_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "projetos_favorito_usuario_id_projeto_id_key"
    ON "gestao_ti"."projetos_favorito"("usuario_id", "projeto_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'gestao_ti'
          AND table_name = 'projetos_favorito'
          AND constraint_name = 'projetos_favorito_projeto_id_fkey'
    ) THEN
        ALTER TABLE "gestao_ti"."projetos_favorito"
        ADD CONSTRAINT "projetos_favorito_projeto_id_fkey"
        FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'gestao_ti'
          AND table_name = 'projetos_favorito'
          AND constraint_name = 'projetos_favorito_usuario_id_fkey'
    ) THEN
        ALTER TABLE "gestao_ti"."projetos_favorito"
        ADD CONSTRAINT "projetos_favorito_usuario_id_fkey"
        FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id")
        ON DELETE NO ACTION ON UPDATE CASCADE;
    END IF;
END $$;
