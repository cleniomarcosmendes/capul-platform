-- Fase 6a — cadastro de Supervisor de Área + vínculo com o Coordenador.
-- Ver docs/PLANO_LOGISTICA_REPRESENTANTES_v1.md (redesenho 03/07).

-- CreateTable
CREATE TABLE "logistica"."supervisor" (
    "id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,
    "coordenador_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_filial_id_matricula_key" ON "logistica"."supervisor"("filial_id", "matricula");

-- CreateIndex
CREATE INDEX "supervisor_coordenador_id_idx" ON "logistica"."supervisor"("coordenador_id");
