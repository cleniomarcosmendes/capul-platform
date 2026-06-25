-- Lembrete de chamado parado (gestão de inatividade).
-- Campos de controle no chamado + config singleton. 100% aditivo.

ALTER TABLE "gestao_ti"."chamados"
  ADD COLUMN "ultimo_lembrete_em" TIMESTAMP(3),
  ADD COLUMN "lembretes_enviados" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "gestao_ti"."chamado_lembrete_config" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "dias_inatividade_equipe" INTEGER NOT NULL DEFAULT 3,
  "dias_inatividade_solicitante" INTEGER NOT NULL DEFAULT 3,
  "dias_escala" INTEGER NOT NULL DEFAULT 7,
  "intervalo_reenvio_dias" INTEGER NOT NULL DEFAULT 3,
  "max_lembretes" INTEGER NOT NULL DEFAULT 3,
  "auto_fechar" BOOLEAN NOT NULL DEFAULT true,
  "dias_auto_fechamento" INTEGER NOT NULL DEFAULT 3,
  "hora_execucao" INTEGER NOT NULL DEFAULT 8,
  "last_run_at" TIMESTAMP(3),
  "last_resumo" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  CONSTRAINT "chamado_lembrete_config_pkey" PRIMARY KEY ("id")
);
