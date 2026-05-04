-- Migration: cria tabela gestao_ti.atividade_responsaveis
--
-- Contexto: o modelo `AtividadeResponsavel` (relação many-to-many entre
-- atividades de projeto e usuários responsáveis) já existia no schema.prisma
-- e em DEV/HOM via `db push`, mas sem migration commitada. PROD do Douglas
-- não tinha a tabela — qualquer feature de projeto que tente listar/atribuir
-- responsáveis dispara 500. Descoberto em 28/04/2026 junto com `anexos_parada`
-- e `projetos_favorito` (mesma classe de bug: schema editado sem migrate).
--
-- SQL idempotente — IF NOT EXISTS + verificação de FK via DO $$.

CREATE TABLE IF NOT EXISTS "gestao_ti"."atividade_responsaveis" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atividade_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "atividade_responsaveis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "atividade_responsaveis_atividade_id_usuario_id_key"
    ON "gestao_ti"."atividade_responsaveis"("atividade_id", "usuario_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'gestao_ti'
          AND table_name = 'atividade_responsaveis'
          AND constraint_name = 'atividade_responsaveis_atividade_id_fkey'
    ) THEN
        ALTER TABLE "gestao_ti"."atividade_responsaveis"
        ADD CONSTRAINT "atividade_responsaveis_atividade_id_fkey"
        FOREIGN KEY ("atividade_id") REFERENCES "gestao_ti"."atividades_projeto"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'gestao_ti'
          AND table_name = 'atividade_responsaveis'
          AND constraint_name = 'atividade_responsaveis_usuario_id_fkey'
    ) THEN
        ALTER TABLE "gestao_ti"."atividade_responsaveis"
        ADD CONSTRAINT "atividade_responsaveis_usuario_id_fkey"
        FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id")
        ON DELETE NO ACTION ON UPDATE CASCADE;
    END IF;
END $$;
