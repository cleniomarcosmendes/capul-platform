-- Cadastro de locais/pontos de parada (Fase 2d) — pick-list do planejamento.
CREATE TABLE "logistica"."local_parada" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "local_parada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "local_parada_nome_key" ON "logistica"."local_parada"("nome");
