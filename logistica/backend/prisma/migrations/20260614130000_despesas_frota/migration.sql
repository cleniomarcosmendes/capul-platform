-- Despesas da frota (Fase 2) — tipos de despesa + despesas de veículo com governança.

-- CreateEnum
CREATE TYPE "logistica"."StatusDespesa" AS ENUM ('PENDENTE', 'APROVADA', 'CONTESTADA');

-- CreateTable: tipo_despesa (cadastro auxiliar global)
CREATE TABLE "logistica"."tipo_despesa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipo_despesa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipo_despesa_nome_key" ON "logistica"."tipo_despesa"("nome");

-- CreateTable: despesa_veiculo
CREATE TABLE "logistica"."despesa_veiculo" (
    "id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,
    "veiculo_id" TEXT NOT NULL,
    "viagem_id" TEXT,
    "tipo_despesa_id" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data_despesa" TIMESTAMP(3) NOT NULL,
    "fornecedor" TEXT,
    "observacao" TEXT,
    "situacao" "logistica"."StatusDespesa" NOT NULL DEFAULT 'PENDENTE',
    "autor_matricula" TEXT,
    "autor_nome" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprovado_por_id" TEXT,
    "aprovado_em" TIMESTAMP(3),
    "motivo_contestacao" TEXT,
    CONSTRAINT "despesa_veiculo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "despesa_veiculo_filial_id_situacao_idx" ON "logistica"."despesa_veiculo"("filial_id", "situacao");
CREATE INDEX "despesa_veiculo_veiculo_id_idx" ON "logistica"."despesa_veiculo"("veiculo_id");
CREATE INDEX "despesa_veiculo_viagem_id_idx" ON "logistica"."despesa_veiculo"("viagem_id");
CREATE INDEX "despesa_veiculo_tipo_despesa_id_idx" ON "logistica"."despesa_veiculo"("tipo_despesa_id");

-- Foreign keys
ALTER TABLE "logistica"."despesa_veiculo" ADD CONSTRAINT "despesa_veiculo_veiculo_id_fkey"
    FOREIGN KEY ("veiculo_id") REFERENCES "logistica"."veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "logistica"."despesa_veiculo" ADD CONSTRAINT "despesa_veiculo_viagem_id_fkey"
    FOREIGN KEY ("viagem_id") REFERENCES "logistica"."viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "logistica"."despesa_veiculo" ADD CONSTRAINT "despesa_veiculo_tipo_despesa_id_fkey"
    FOREIGN KEY ("tipo_despesa_id") REFERENCES "logistica"."tipo_despesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
