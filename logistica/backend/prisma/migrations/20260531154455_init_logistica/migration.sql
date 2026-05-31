-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "logistica";

-- CreateEnum
CREATE TYPE "logistica"."TipoClienteEntrega" AS ENUM ('IDENTIFICADO', 'RECORRENTE_LOCAL', 'EVENTUAL');

-- CreateEnum
CREATE TYPE "logistica"."StatusEntrega" AS ENUM ('PENDENTE', 'EM_VIAGEM', 'ENTREGUE', 'NAO_ENTREGUE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "logistica"."TipoViagem" AS ENUM ('ENTREGA', 'FROTA');

-- CreateEnum
CREATE TYPE "logistica"."StatusViagem" AS ENUM ('RASCUNHO', 'EM_CURSO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "logistica"."SituacaoVeiculo" AS ENUM ('DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'BAIXADO');

-- CreateEnum
CREATE TYPE "logistica"."TipoVeiculo" AS ENUM ('CARRO', 'UTILITARIO', 'CAMINHAO', 'OUTRO');

-- CreateTable
CREATE TABLE "logistica"."cliente_local" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."endereco_entrega" (
    "id" TEXT NOT NULL,
    "matricula" TEXT,
    "cliente_local_id" TEXT,
    "apelido" TEXT,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "ponto_referencia" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endereco_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."veiculo" (
    "id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "renavam" TEXT,
    "chassi" TEXT,
    "modelo" TEXT,
    "marca" TEXT,
    "ano" INTEGER,
    "cor" TEXT,
    "tipo" "logistica"."TipoVeiculo" NOT NULL DEFAULT 'CARRO',
    "km_atual" INTEGER NOT NULL DEFAULT 0,
    "capacidade_carga" TEXT,
    "situacao" "logistica"."SituacaoVeiculo" NOT NULL DEFAULT 'DISPONIVEL',
    "departamento_lotacao_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."veiculo_supervisor_historico" (
    "id" TEXT NOT NULL,
    "veiculo_id" TEXT NOT NULL,
    "supervisor_anterior_id" TEXT,
    "supervisor_novo_id" TEXT NOT NULL,
    "alterado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterado_por_id" TEXT NOT NULL,

    CONSTRAINT "veiculo_supervisor_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."contador_sequencial" (
    "filial_id" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contador_sequencial_pkey" PRIMARY KEY ("filial_id","escopo")
);

-- CreateTable
CREATE TABLE "logistica"."entrega" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "filial_id" TEXT NOT NULL,
    "tipo_cliente" "logistica"."TipoClienteEntrega" NOT NULL,
    "matricula" TEXT,
    "cliente_local_id" TEXT,
    "destinatario_nome" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco_entrega_id" TEXT,
    "end_logradouro" TEXT NOT NULL,
    "end_numero" TEXT,
    "end_complemento" TEXT,
    "end_bairro" TEXT,
    "end_cidade" TEXT,
    "end_cep" TEXT,
    "end_referencia" TEXT,
    "horario" TEXT,
    "observacoes" TEXT,
    "quantidade_volumes" INTEGER NOT NULL DEFAULT 1,
    "status" "logistica"."StatusEntrega" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por_id" TEXT NOT NULL,
    "cancelada_em" TIMESTAMP(3),
    "cancelada_por_id" TEXT,
    "motivo_cancelamento" TEXT,
    "tem_comprovante" BOOLEAN NOT NULL DEFAULT false,
    "comprovante_id" TEXT,

    CONSTRAINT "entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."entrega_cupom" (
    "id" TEXT NOT NULL,
    "entrega_id" TEXT NOT NULL,
    "numero_cupom" TEXT,
    "valor" DECIMAL(12,2),

    CONSTRAINT "entrega_cupom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."viagem" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "filial_id" TEXT NOT NULL,
    "tipo" "logistica"."TipoViagem" NOT NULL DEFAULT 'ENTREGA',
    "veiculo_id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "departamento_solicitante_id" TEXT,
    "km_inicial" INTEGER,
    "km_final" INTEGER,
    "local_saida" TEXT,
    "data_hora_saida" TIMESTAMP(3),
    "observacoes_saida" TEXT,
    "data_hora_chegada" TIMESTAMP(3),
    "observacoes_chegada" TEXT,
    "situacao" "logistica"."StatusViagem" NOT NULL DEFAULT 'RASCUNHO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por_id" TEXT NOT NULL,

    CONSTRAINT "viagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistica"."parada" (
    "id" TEXT NOT NULL,
    "viagem_id" TEXT NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "entrega_id" TEXT,
    "local" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "km" INTEGER,
    "data_hora" TIMESTAMP(3),
    "observacao" TEXT,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cliente_local_telefone_idx" ON "logistica"."cliente_local"("telefone");

-- CreateIndex
CREATE INDEX "cliente_local_nome_idx" ON "logistica"."cliente_local"("nome");

-- CreateIndex
CREATE INDEX "endereco_entrega_matricula_idx" ON "logistica"."endereco_entrega"("matricula");

-- CreateIndex
CREATE INDEX "endereco_entrega_cliente_local_id_idx" ON "logistica"."endereco_entrega"("cliente_local_id");

-- CreateIndex
CREATE INDEX "veiculo_filial_id_situacao_idx" ON "logistica"."veiculo"("filial_id", "situacao");

-- CreateIndex
CREATE INDEX "veiculo_supervisor_id_idx" ON "logistica"."veiculo"("supervisor_id");

-- CreateIndex
CREATE INDEX "veiculo_departamento_lotacao_id_idx" ON "logistica"."veiculo"("departamento_lotacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "veiculo_filial_id_placa_key" ON "logistica"."veiculo"("filial_id", "placa");

-- CreateIndex
CREATE INDEX "veiculo_supervisor_historico_veiculo_id_idx" ON "logistica"."veiculo_supervisor_historico"("veiculo_id");

-- CreateIndex
CREATE INDEX "entrega_filial_id_status_idx" ON "logistica"."entrega"("filial_id", "status");

-- CreateIndex
CREATE INDEX "entrega_matricula_idx" ON "logistica"."entrega"("matricula");

-- CreateIndex
CREATE INDEX "entrega_criado_em_idx" ON "logistica"."entrega"("criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "entrega_filial_id_numero_key" ON "logistica"."entrega"("filial_id", "numero");

-- CreateIndex
CREATE INDEX "entrega_cupom_entrega_id_idx" ON "logistica"."entrega_cupom"("entrega_id");

-- CreateIndex
CREATE INDEX "viagem_filial_id_situacao_idx" ON "logistica"."viagem"("filial_id", "situacao");

-- CreateIndex
CREATE INDEX "viagem_veiculo_id_idx" ON "logistica"."viagem"("veiculo_id");

-- CreateIndex
CREATE INDEX "viagem_motorista_id_idx" ON "logistica"."viagem"("motorista_id");

-- CreateIndex
CREATE INDEX "viagem_tipo_idx" ON "logistica"."viagem"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "viagem_filial_id_numero_key" ON "logistica"."viagem"("filial_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "parada_entrega_id_key" ON "logistica"."parada"("entrega_id");

-- CreateIndex
CREATE INDEX "parada_viagem_id_sequencia_idx" ON "logistica"."parada"("viagem_id", "sequencia");

-- AddForeignKey
ALTER TABLE "logistica"."endereco_entrega" ADD CONSTRAINT "endereco_entrega_cliente_local_id_fkey" FOREIGN KEY ("cliente_local_id") REFERENCES "logistica"."cliente_local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistica"."veiculo_supervisor_historico" ADD CONSTRAINT "veiculo_supervisor_historico_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "logistica"."veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistica"."entrega" ADD CONSTRAINT "entrega_cliente_local_id_fkey" FOREIGN KEY ("cliente_local_id") REFERENCES "logistica"."cliente_local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistica"."entrega" ADD CONSTRAINT "entrega_endereco_entrega_id_fkey" FOREIGN KEY ("endereco_entrega_id") REFERENCES "logistica"."endereco_entrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistica"."entrega_cupom" ADD CONSTRAINT "entrega_cupom_entrega_id_fkey" FOREIGN KEY ("entrega_id") REFERENCES "logistica"."entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistica"."viagem" ADD CONSTRAINT "viagem_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "logistica"."veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistica"."parada" ADD CONSTRAINT "parada_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "logistica"."viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistica"."parada" ADD CONSTRAINT "parada_entrega_id_fkey" FOREIGN KEY ("entrega_id") REFERENCES "logistica"."entrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

