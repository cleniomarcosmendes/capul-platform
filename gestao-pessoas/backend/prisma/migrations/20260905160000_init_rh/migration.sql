-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "rh";

-- CreateEnum
CREATE TYPE "rh"."SituacaoColaborador" AS ENUM ('ATIVO', 'AFASTADO', 'FERIAS', 'DEMITIDO');

-- CreateEnum
CREATE TYPE "rh"."FinalidadeModelo" AS ENUM ('PRODUCAO', 'DEMONSTRACAO');

-- CreateEnum
CREATE TYPE "rh"."OrigemValorCriterio" AS ENUM ('CALCULADO', 'INFORMADO');

-- CreateEnum
CREATE TYPE "rh"."TipoValorCriterio" AS ENUM ('NUMERICO', 'DOMINIO');

-- CreateEnum
CREATE TYPE "rh"."TipoFaixa" AS ENUM ('NUMERICA', 'DOMINIO');

-- CreateEnum
CREATE TYPE "rh"."StatusCiclo" AS ENUM ('RASCUNHO', 'ABERTO', 'EM_APURACAO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "rh"."OrigemDesignacao" AS ENUM ('CENTRO_CUSTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "rh"."StatusAvaliacao" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'ENVIADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "rh"."colaborador" (
    "id" TEXT NOT NULL,
    "filial" VARCHAR(10) NOT NULL,
    "matricula" VARCHAR(10) NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" VARCHAR(14),
    "centro_custo" VARCHAR(20),
    "centro_custo_descricao" TEXT,
    "cargo_id" TEXT,
    "cargo_descricao" TEXT,
    "data_admissao" DATE NOT NULL,
    "data_demissao" DATE,
    "situacao" "rh"."SituacaoColaborador" NOT NULL DEFAULT 'ATIVO',
    "grau_instrucao_codigo" VARCHAR(10),
    "grau_instrucao_descricao" TEXT,
    "data_ultima_funcao" DATE,
    "descricao_funcao" TEXT,
    "usuario_id" TEXT,
    "sincronizado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."cargo" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" TEXT NOT NULL,
    "nivel" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."colaborador_treinamento" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "carga_horaria" DECIMAL(6,2),
    "origem" TEXT NOT NULL DEFAULT 'PROTHEUS_RA4',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaborador_treinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."modelo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "finalidade" "rh"."FinalidadeModelo" NOT NULL DEFAULT 'PRODUCAO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."modelo_versao" (
    "id" TEXT NOT NULL,
    "modelo_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "publicado_em" TIMESTAMP(3),
    "publicado_por_id" TEXT,
    "pontuacao_maxima" DECIMAL(10,4),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelo_versao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."grupo" (
    "id" TEXT NOT NULL,
    "modelo_versao_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."criterio" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "origem" "rh"."OrigemValorCriterio" NOT NULL,
    "tipoValor" "rh"."TipoValorCriterio" NOT NULL,
    "codigo_calculo" VARCHAR(40),
    "unidade" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criterio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."criterio_valor_informado" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "criterio_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "valor_numerico" DECIMAL(12,4),
    "valor_texto" TEXT,
    "origem_registro" TEXT NOT NULL DEFAULT 'IMPORTACAO',
    "informado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "criterio_valor_informado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."pergunta" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "peso" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "codigo_origem" VARCHAR(10),

    CONSTRAINT "pergunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."pergunta_alternativa" (
    "id" TEXT NOT NULL,
    "pergunta_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,4) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "codigo_origem" VARCHAR(10),

    CONSTRAINT "pergunta_alternativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."criterio_faixa" (
    "id" TEXT NOT NULL,
    "criterio_id" TEXT NOT NULL,
    "tipo" "rh"."TipoFaixa" NOT NULL,
    "limite_inferior" DECIMAL(12,4),
    "limite_superior" DECIMAL(12,4),
    "inclusivo_inf" BOOLEAN NOT NULL DEFAULT false,
    "inclusivo_sup" BOOLEAN NOT NULL DEFAULT true,
    "valor_dominio" VARCHAR(20),
    "pontuacao" DECIMAL(6,2) NOT NULL,
    "rotulo" TEXT,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "criterio_faixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."conceito_faixa" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "limite_inferior" DECIMAL(6,2) NOT NULL,
    "limite_superior" DECIMAL(6,2) NOT NULL,
    "cor" VARCHAR(10),
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "conceito_faixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."ciclo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fim" DATE NOT NULL,
    "data_base" DATE NOT NULL,
    "janela_treinamento_meses" INTEGER NOT NULL DEFAULT 12,
    "status" "rh"."StatusCiclo" NOT NULL DEFAULT 'RASCUNHO',
    "vale_para_merito" BOOLEAN NOT NULL DEFAULT false,
    "aberto_em" TIMESTAMP(3),
    "encerrado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ciclo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."aplicacao" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "modelo_versao_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "peso_avaliacao" DECIMAL(10,4) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."aplicacao_criterio" (
    "id" TEXT NOT NULL,
    "aplicacao_id" TEXT NOT NULL,
    "criterio_id" TEXT NOT NULL,
    "peso" DECIMAL(10,4) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "aplicacao_criterio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."aplicacao_centro_custo" (
    "id" TEXT NOT NULL,
    "aplicacao_id" TEXT NOT NULL,
    "filial" VARCHAR(10),
    "centro_custo" VARCHAR(20) NOT NULL,

    CONSTRAINT "aplicacao_centro_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."avaliacao" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "aplicacao_id" TEXT NOT NULL,
    "avaliado_id" TEXT NOT NULL,
    "avaliador_id" TEXT NOT NULL,
    "origem_designacao" "rh"."OrigemDesignacao" NOT NULL DEFAULT 'CENTRO_CUSTO',
    "filial_snapshot" VARCHAR(10),
    "centro_custo_snapshot" VARCHAR(20),
    "cargo_snapshot" TEXT,
    "status" "rh"."StatusAvaliacao" NOT NULL DEFAULT 'PENDENTE',
    "enviada_em" TIMESTAMP(3),
    "reaberta_em" TIMESTAMP(3),
    "reaberta_por_id" TEXT,
    "motivo_reabertura" TEXT,
    "observacao_avaliador" TEXT,
    "devolutiva_em" TIMESTAMP(3),
    "devolutiva_por_id" TEXT,
    "nota_avaliacao" DECIMAL(6,2),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."resposta" (
    "id" TEXT NOT NULL,
    "avaliacao_id" TEXT NOT NULL,
    "pergunta_id" TEXT NOT NULL,
    "alternativa_id" TEXT NOT NULL,
    "valor" DECIMAL(10,4) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."resultado_avaliacao" (
    "id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "avaliacao_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "nota_avaliacao" DECIMAL(6,2) NOT NULL,
    "peso_avaliacao" DECIMAL(10,4) NOT NULL,
    "nota_criterios" DECIMAL(6,2),
    "nota_final" DECIMAL(6,2) NOT NULL,
    "conceito_id" TEXT,
    "conceito_descricao" TEXT,
    "houve_renormalizacao" BOOLEAN NOT NULL DEFAULT false,
    "calculado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultado_avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."resultado_criterio" (
    "id" TEXT NOT NULL,
    "resultado_id" TEXT NOT NULL,
    "criterio_id" TEXT NOT NULL,
    "criterio_nome" TEXT NOT NULL,
    "valor_bruto" DECIMAL(12,4),
    "valor_texto" TEXT,
    "faixa_id" TEXT,
    "pontuacao" DECIMAL(6,2),
    "peso_aplicado" DECIMAL(10,4) NOT NULL,
    "sem_dado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "resultado_criterio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."auditoria" (
    "id" TEXT NOT NULL,
    "entidade" VARCHAR(60) NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "acao" VARCHAR(40) NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "valor_anterior" JSONB,
    "valor_novo" JSONB,
    "justificativa" TEXT,
    "ip" VARCHAR(45),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_usuario_id_key" ON "rh"."colaborador"("usuario_id");

-- CreateIndex
CREATE INDEX "colaborador_centro_custo_situacao_idx" ON "rh"."colaborador"("centro_custo", "situacao");

-- CreateIndex
CREATE INDEX "colaborador_situacao_idx" ON "rh"."colaborador"("situacao");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_filial_matricula_key" ON "rh"."colaborador"("filial", "matricula");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_codigo_key" ON "rh"."cargo"("codigo");

-- CreateIndex
CREATE INDEX "colaborador_treinamento_colaborador_id_data_fim_idx" ON "rh"."colaborador_treinamento"("colaborador_id", "data_fim");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_versao_modelo_id_versao_key" ON "rh"."modelo_versao"("modelo_id", "versao");

-- CreateIndex
CREATE INDEX "grupo_modelo_versao_id_ordem_idx" ON "rh"."grupo"("modelo_versao_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "criterio_codigo_key" ON "rh"."criterio"("codigo");

-- CreateIndex
CREATE INDEX "criterio_valor_informado_ciclo_id_criterio_id_idx" ON "rh"."criterio_valor_informado"("ciclo_id", "criterio_id");

-- CreateIndex
CREATE UNIQUE INDEX "criterio_valor_informado_ciclo_id_criterio_id_colaborador_i_key" ON "rh"."criterio_valor_informado"("ciclo_id", "criterio_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "pergunta_grupo_id_ordem_idx" ON "rh"."pergunta"("grupo_id", "ordem");

-- CreateIndex
CREATE INDEX "pergunta_alternativa_pergunta_id_ordem_idx" ON "rh"."pergunta_alternativa"("pergunta_id", "ordem");

-- CreateIndex
CREATE INDEX "criterio_faixa_criterio_id_ordem_idx" ON "rh"."criterio_faixa"("criterio_id", "ordem");

-- CreateIndex
CREATE INDEX "conceito_faixa_ciclo_id_ordem_idx" ON "rh"."conceito_faixa"("ciclo_id", "ordem");

-- CreateIndex
CREATE INDEX "ciclo_status_idx" ON "rh"."ciclo"("status");

-- CreateIndex
CREATE INDEX "aplicacao_ciclo_id_idx" ON "rh"."aplicacao"("ciclo_id");

-- CreateIndex
CREATE UNIQUE INDEX "aplicacao_criterio_aplicacao_id_criterio_id_key" ON "rh"."aplicacao_criterio"("aplicacao_id", "criterio_id");

-- CreateIndex
CREATE UNIQUE INDEX "aplicacao_centro_custo_aplicacao_id_filial_centro_custo_key" ON "rh"."aplicacao_centro_custo"("aplicacao_id", "filial", "centro_custo");

-- CreateIndex
CREATE INDEX "avaliacao_ciclo_id_avaliador_id_status_idx" ON "rh"."avaliacao"("ciclo_id", "avaliador_id", "status");

-- CreateIndex
CREATE INDEX "avaliacao_aplicacao_id_status_idx" ON "rh"."avaliacao"("aplicacao_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacao_ciclo_id_avaliado_id_key" ON "rh"."avaliacao"("ciclo_id", "avaliado_id");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_avaliacao_id_pergunta_id_key" ON "rh"."resposta"("avaliacao_id", "pergunta_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_avaliacao_avaliacao_id_key" ON "rh"."resultado_avaliacao"("avaliacao_id");

-- CreateIndex
CREATE INDEX "resultado_avaliacao_ciclo_id_colaborador_id_idx" ON "rh"."resultado_avaliacao"("ciclo_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "resultado_criterio_resultado_id_idx" ON "rh"."resultado_criterio"("resultado_id");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidade_id_idx" ON "rh"."auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_criado_em_idx" ON "rh"."auditoria"("usuario_id", "criado_em");

-- AddForeignKey
ALTER TABLE "rh"."colaborador" ADD CONSTRAINT "colaborador_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "rh"."cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."colaborador_treinamento" ADD CONSTRAINT "colaborador_treinamento_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "rh"."colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."modelo_versao" ADD CONSTRAINT "modelo_versao_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "rh"."modelo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."grupo" ADD CONSTRAINT "grupo_modelo_versao_id_fkey" FOREIGN KEY ("modelo_versao_id") REFERENCES "rh"."modelo_versao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."criterio_valor_informado" ADD CONSTRAINT "criterio_valor_informado_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "rh"."criterio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."pergunta" ADD CONSTRAINT "pergunta_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "rh"."grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."pergunta_alternativa" ADD CONSTRAINT "pergunta_alternativa_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "rh"."pergunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."criterio_faixa" ADD CONSTRAINT "criterio_faixa_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "rh"."criterio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."conceito_faixa" ADD CONSTRAINT "conceito_faixa_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "rh"."ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."aplicacao" ADD CONSTRAINT "aplicacao_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "rh"."ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."aplicacao" ADD CONSTRAINT "aplicacao_modelo_versao_id_fkey" FOREIGN KEY ("modelo_versao_id") REFERENCES "rh"."modelo_versao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."aplicacao_criterio" ADD CONSTRAINT "aplicacao_criterio_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "rh"."aplicacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."aplicacao_criterio" ADD CONSTRAINT "aplicacao_criterio_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "rh"."criterio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."aplicacao_centro_custo" ADD CONSTRAINT "aplicacao_centro_custo_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "rh"."aplicacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."avaliacao" ADD CONSTRAINT "avaliacao_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "rh"."ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."avaliacao" ADD CONSTRAINT "avaliacao_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "rh"."aplicacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."resposta" ADD CONSTRAINT "resposta_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "rh"."avaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."resposta" ADD CONSTRAINT "resposta_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "rh"."pergunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."resposta" ADD CONSTRAINT "resposta_alternativa_id_fkey" FOREIGN KEY ("alternativa_id") REFERENCES "rh"."pergunta_alternativa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."resultado_avaliacao" ADD CONSTRAINT "resultado_avaliacao_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "rh"."ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."resultado_avaliacao" ADD CONSTRAINT "resultado_avaliacao_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "rh"."avaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."resultado_criterio" ADD CONSTRAINT "resultado_criterio_resultado_id_fkey" FOREIGN KEY ("resultado_id") REFERENCES "rh"."resultado_avaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

