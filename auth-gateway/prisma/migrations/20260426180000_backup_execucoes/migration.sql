-- Backup & DR visibility — auditoria 26/04/2026 Sprint 4
-- Tabela registra execuções do scripts/backup.sh (POSTa em /api/v1/internal/backup/execucao)

CREATE TABLE "core"."backup_execucoes" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "iniciado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMP(3),
    "duracao_ms" INTEGER,
    "tamanho_bytes" BIGINT,
    "hostname" TEXT,
    "destino" TEXT,
    "cifrado" BOOLEAN NOT NULL DEFAULT false,
    "mensagem" TEXT,
    "metadata" JSONB,
    CONSTRAINT "backup_execucoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backup_execucoes_iniciado_em_idx"
  ON "core"."backup_execucoes"("iniciado_em" DESC);

CREATE INDEX "backup_execucoes_status_idx"
  ON "core"."backup_execucoes"("status");
