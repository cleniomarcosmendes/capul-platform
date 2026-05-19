-- =================================================================
-- Migration: atividade_historico (timeline imutável) + enum TipoEventoAtividade
-- =================================================================
-- Contexto: repaginação da aba Atividades (List + Drawer, plano
-- docs/PLANO_REPAGINACAO_ATIVIDADES_PROJETO_v1.md, PR3). O drawer da
-- tarefa ganha aba "Histórico" — antes não havia onde registrar a
-- cronologia (criou, mudou status, iniciou/encerrou cronômetro, comentou).
--
-- Solução: tabela atividade_historico cresce a cada evento. O service
-- registra automaticamente (fire-and-forget — nunca quebra o fluxo
-- principal se a gravação do histórico falhar). Nome do autor é
-- resolvido na leitura (sem desnormalizar).
--
-- Mesmo padrão de parada_historico (28/04/2026).
-- Idempotente. Migration aditiva (cria objetos novos, sem alterar dados).
-- =================================================================

-- Enum TipoEventoAtividade
DO $$ BEGIN
  CREATE TYPE "gestao_ti"."TipoEventoAtividade" AS ENUM (
    'CRIADA', 'STATUS_ALTERADO', 'TITULO_ALTERADO', 'RESPONSAVEL_ALTERADO',
    'FASE_ALTERADA', 'TEMPO_INICIADO', 'TEMPO_ENCERRADO', 'COMENTARIO_ADICIONADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela atividade_historico
CREATE TABLE IF NOT EXISTS "gestao_ti"."atividade_historico" (
  "id"           TEXT NOT NULL,
  "atividade_id" TEXT NOT NULL,
  "tipo"         "gestao_ti"."TipoEventoAtividade" NOT NULL,
  "descricao"    TEXT,
  "usuario_id"   TEXT,
  "metadata"     JSONB,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "atividade_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "atividade_historico_atividade_id_created_at_idx"
  ON "gestao_ti"."atividade_historico" ("atividade_id", "created_at");

-- FKs (idempotentes via DO $$)
DO $$ BEGIN
  ALTER TABLE "gestao_ti"."atividade_historico"
    ADD CONSTRAINT "atividade_historico_atividade_id_fkey"
    FOREIGN KEY ("atividade_id")
    REFERENCES "gestao_ti"."atividades_projeto"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "gestao_ti"."atividade_historico"
    ADD CONSTRAINT "atividade_historico_usuario_id_fkey"
    FOREIGN KEY ("usuario_id")
    REFERENCES "core"."usuarios"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
