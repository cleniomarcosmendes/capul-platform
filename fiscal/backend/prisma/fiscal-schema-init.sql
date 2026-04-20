-- ============================================================
-- Fiscal Schema — Inicialização completa das tabelas
-- Usar APENAS quando o schema fiscal nunca foi deployado antes.
-- NÃO inclui alterações no schema core (core é gerenciado pelo auth-gateway).
-- Gerado em: 20/04/2026
-- ============================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "fiscal";

-- CreateEnum
CREATE TYPE "fiscal"."TipoDocumentoFiscal" AS ENUM ('NFE', 'CTE');

-- CreateEnum
CREATE TYPE "fiscal"."OrigemConsulta" AS ENUM ('PROTHEUS_CACHE', 'PROTHEUS_CACHE_RACE', 'SEFAZ_DOWNLOAD');

-- CreateEnum
CREATE TYPE "fiscal"."SituacaoCadastral" AS ENUM ('HABILITADO', 'NAO_HABILITADO', 'SUSPENSO', 'INAPTO', 'BAIXADO', 'DESCONHECIDO');

-- CreateEnum
CREATE TYPE "fiscal"."TipoCadastroProtheus" AS ENUM ('SA1010', 'SA2010');

-- CreateEnum
CREATE TYPE "fiscal"."CriticidadeDivergencia" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "fiscal"."StatusDivergencia" AS ENUM ('ABERTA', 'RESOLVIDA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "fiscal"."TipoSincronizacao" AS ENUM ('MOVIMENTO_MEIO_DIA', 'MOVIMENTO_MANHA_SEGUINTE', 'MANUAL', 'PONTUAL');

-- CreateEnum
CREATE TYPE "fiscal"."StatusSincronizacao" AS ENUM ('AGENDADA', 'EM_EXECUCAO', 'CONCLUIDA', 'CONCLUIDA_COM_ERROS', 'FALHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "fiscal"."AmbienteSefaz" AS ENUM ('PRODUCAO', 'HOMOLOGACAO');

-- CreateEnum
CREATE TYPE "fiscal"."CircuitState" AS ENUM ('FECHADO', 'ABERTO', 'MEIO_ABERTO');

-- CreateTable
CREATE TABLE "fiscal"."documento_consulta" (
    "id" UUID NOT NULL,
    "chave" CHAR(44) NOT NULL,
    "tipo_documento" "fiscal"."TipoDocumentoFiscal" NOT NULL,
    "filial" VARCHAR(2) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "usuario_email" TEXT NOT NULL,
    "origem" "fiscal"."OrigemConsulta" NOT NULL,
    "consulta_sefaz_atualizada_em" TIMESTAMP(3),
    "ambiente_sefaz" VARCHAR(20) NOT NULL,
    "protocolo_autorizacao" TEXT,
    "data_autorizacao" TIMESTAMP(3),
    "cnpj_emitente" CHAR(14),
    "cnpj_destinatario" CHAR(14),
    "numero_nf" VARCHAR(9),
    "serie" VARCHAR(3),
    "valor_total" DECIMAL(15,2),
    "statusAtual" VARCHAR(30),
    "erro_mensagem" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_consulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."documento_xml" (
    "id" UUID NOT NULL,
    "chave" CHAR(44) NOT NULL,
    "tipo_documento" "fiscal"."TipoDocumentoFiscal" NOT NULL,
    "caminho_arquivo" TEXT,
    "tamanho_bytes" INTEGER,
    "origem" "fiscal"."OrigemConsulta" NOT NULL,
    "hash_sha256" CHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_xml_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."documento_evento" (
    "id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "tipo_evento" VARCHAR(20) NOT NULL,
    "descricao" TEXT NOT NULL,
    "data_evento" TIMESTAMP(3) NOT NULL,
    "protocolo_evento" TEXT,
    "c_stat" VARCHAR(4),
    "x_motivo" TEXT,
    "xml_evento" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."cadastro_contribuinte" (
    "id" UUID NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "inscricao_estadual" VARCHAR(20),
    "razao_social" TEXT,
    "nome_fantasia" TEXT,
    "cnae" VARCHAR(7),
    "regime_tributario" VARCHAR(50),
    "situacao" "fiscal"."SituacaoCadastral" NOT NULL,
    "data_inicio_atividade" TIMESTAMP(3),
    "data_ultima_atualizacao_ccc" TIMESTAMP(3),
    "endereco_logradouro" TEXT,
    "endereco_numero" VARCHAR(20),
    "endereco_bairro" TEXT,
    "endereco_municipio" TEXT,
    "endereco_cep" VARCHAR(8),
    "vinculos_protheus" JSONB,
    "ultima_consulta_ccc_em" TIMESTAMP(3),
    "ultima_sincronizacao_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cadastro_contribuinte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."cadastro_historico" (
    "id" UUID NOT NULL,
    "contribuinte_id" UUID NOT NULL,
    "situacao_anterior" "fiscal"."SituacaoCadastral",
    "situacao_nova" "fiscal"."SituacaoCadastral" NOT NULL,
    "detectado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sincronizacao_id" UUID,

    CONSTRAINT "cadastro_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."cadastro_divergencia" (
    "id" UUID NOT NULL,
    "contribuinte_id" UUID NOT NULL,
    "campo" VARCHAR(50) NOT NULL,
    "valor_protheus" TEXT,
    "valor_sefaz" TEXT,
    "criticidade" "fiscal"."CriticidadeDivergencia" NOT NULL,
    "status" "fiscal"."StatusDivergencia" NOT NULL DEFAULT 'ABERTA',
    "detectada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvida_em" TIMESTAMP(3),
    "resolvida_por" UUID,

    CONSTRAINT "cadastro_divergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."cadastro_sincronizacao" (
    "id" UUID NOT NULL,
    "tipo" "fiscal"."TipoSincronizacao" NOT NULL,
    "status" "fiscal"."StatusSincronizacao" NOT NULL,
    "disparado_por" TEXT,
    "iniciado_em" TIMESTAMP(3) NOT NULL,
    "finalizado_em" TIMESTAMP(3),
    "janela_inicio" TIMESTAMP(3),
    "janela_fim" TIMESTAMP(3),
    "filiais_movimento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_contribuintes" INTEGER,
    "sucessos" INTEGER NOT NULL DEFAULT 0,
    "erros" INTEGER NOT NULL DEFAULT 0,
    "erros_por_uf" JSONB,
    "resumo_mudancas" JSONB,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cadastro_sincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."protheus_snapshot" (
    "id" UUID NOT NULL,
    "sincronizacao_id" UUID,
    "tipo" "fiscal"."TipoCadastroProtheus" NOT NULL,
    "filial" VARCHAR(2),
    "quantidade" INTEGER NOT NULL,
    "hash" CHAR(64),
    "capturado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "protheus_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."alerta_enviado" (
    "id" UUID NOT NULL,
    "sincronizacao_id" UUID NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destinatarios" JSONB NOT NULL,
    "total_destinatarios" INTEGER NOT NULL,
    "total_mudancas" INTEGER NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "assunto" TEXT NOT NULL,
    "smtp_response" TEXT,
    "erro" TEXT,

    CONSTRAINT "alerta_enviado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."certificado" (
    "id" UUID NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "valido_de" TIMESTAMP(3) NOT NULL,
    "valido_ate" TIMESTAMP(3) NOT NULL,
    "senha_cifrada" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."ambiente_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ambiente_ativo" "fiscal"."AmbienteSefaz" NOT NULL DEFAULT 'HOMOLOGACAO',
    "bootstrap_concluido_em" TIMESTAMP(3),
    "cron_movimento_meio_dia" TEXT NOT NULL DEFAULT '0 12 * * *',
    "cron_movimento_manha_seguinte" TEXT NOT NULL DEFAULT '0 6 * * *',
    "pause_sync" BOOLEAN NOT NULL DEFAULT false,
    "ultima_alteracao_em" TIMESTAMP(3) NOT NULL,
    "ultima_alteracao_por" TEXT,

    CONSTRAINT "ambiente_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."limite_diario" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "limite_diario" INTEGER NOT NULL DEFAULT 2000,
    "alerta_amarelo" INTEGER NOT NULL DEFAULT 1600,
    "alerta_vermelho" INTEGER NOT NULL DEFAULT 1800,
    "contador_hoje" INTEGER NOT NULL DEFAULT 0,
    "data_contador" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausado_automatico" BOOLEAN NOT NULL DEFAULT false,
    "pausado_em" TIMESTAMP(3),
    "alertas_enviados_hoje" JSONB,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "atualizado_por" TEXT,

    CONSTRAINT "limite_diario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal"."uf_circuit_state" (
    "uf" CHAR(2) NOT NULL,
    "estado" "fiscal"."CircuitState" NOT NULL DEFAULT 'FECHADO',
    "erros_recentes" INTEGER NOT NULL DEFAULT 0,
    "aberto_em" TIMESTAMP(3),
    "retomada_em" TIMESTAMP(3),
    "motivo_bloqueio" TEXT,
    "ultima_atualizacao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uf_circuit_state_pkey" PRIMARY KEY ("uf")
);

-- CreateTable
CREATE TABLE "fiscal"."audit_log" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "usuario_email" TEXT,
    "acao" VARCHAR(80) NOT NULL,
    "recurso" VARCHAR(80),
    "payload" JSONB,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documento_consulta_cnpj_emitente_idx" ON "fiscal"."documento_consulta"("cnpj_emitente");
CREATE INDEX "documento_consulta_cnpj_destinatario_idx" ON "fiscal"."documento_consulta"("cnpj_destinatario");
CREATE INDEX "documento_consulta_usuario_id_idx" ON "fiscal"."documento_consulta"("usuario_id");
CREATE INDEX "documento_consulta_created_at_idx" ON "fiscal"."documento_consulta"("created_at");
CREATE UNIQUE INDEX "documento_consulta_chave_filial_key" ON "fiscal"."documento_consulta"("chave", "filial");

CREATE UNIQUE INDEX "documento_xml_chave_key" ON "fiscal"."documento_xml"("chave");
CREATE INDEX "documento_xml_chave_idx" ON "fiscal"."documento_xml"("chave");

CREATE INDEX "documento_evento_documento_id_idx" ON "fiscal"."documento_evento"("documento_id");
CREATE UNIQUE INDEX "documento_evento_documento_id_tipo_evento_data_evento_key" ON "fiscal"."documento_evento"("documento_id", "tipo_evento", "data_evento");

CREATE INDEX "cadastro_contribuinte_cnpj_idx" ON "fiscal"."cadastro_contribuinte"("cnpj");
CREATE INDEX "cadastro_contribuinte_situacao_idx" ON "fiscal"."cadastro_contribuinte"("situacao");
CREATE INDEX "cadastro_contribuinte_uf_idx" ON "fiscal"."cadastro_contribuinte"("uf");
CREATE UNIQUE INDEX "cadastro_contribuinte_cnpj_uf_key" ON "fiscal"."cadastro_contribuinte"("cnpj", "uf");

CREATE INDEX "cadastro_historico_contribuinte_id_idx" ON "fiscal"."cadastro_historico"("contribuinte_id");
CREATE INDEX "cadastro_historico_detectado_em_idx" ON "fiscal"."cadastro_historico"("detectado_em");

CREATE INDEX "cadastro_divergencia_contribuinte_id_idx" ON "fiscal"."cadastro_divergencia"("contribuinte_id");
CREATE INDEX "cadastro_divergencia_status_idx" ON "fiscal"."cadastro_divergencia"("status");
CREATE INDEX "cadastro_divergencia_criticidade_idx" ON "fiscal"."cadastro_divergencia"("criticidade");

CREATE INDEX "cadastro_sincronizacao_tipo_idx" ON "fiscal"."cadastro_sincronizacao"("tipo");
CREATE INDEX "cadastro_sincronizacao_status_idx" ON "fiscal"."cadastro_sincronizacao"("status");
CREATE INDEX "cadastro_sincronizacao_iniciado_em_idx" ON "fiscal"."cadastro_sincronizacao"("iniciado_em");

CREATE INDEX "protheus_snapshot_sincronizacao_id_idx" ON "fiscal"."protheus_snapshot"("sincronizacao_id");
CREATE INDEX "protheus_snapshot_tipo_idx" ON "fiscal"."protheus_snapshot"("tipo");

CREATE INDEX "alerta_enviado_sincronizacao_id_idx" ON "fiscal"."alerta_enviado"("sincronizacao_id");
CREATE INDEX "alerta_enviado_enviado_em_idx" ON "fiscal"."alerta_enviado"("enviado_em");

CREATE INDEX "certificado_cnpj_idx" ON "fiscal"."certificado"("cnpj");
CREATE INDEX "certificado_ativo_idx" ON "fiscal"."certificado"("ativo");

CREATE INDEX "audit_log_usuario_id_idx" ON "fiscal"."audit_log"("usuario_id");
CREATE INDEX "audit_log_acao_idx" ON "fiscal"."audit_log"("acao");
CREATE INDEX "audit_log_created_at_idx" ON "fiscal"."audit_log"("created_at");

-- AddForeignKey (somente dentro do schema fiscal)
ALTER TABLE "fiscal"."documento_evento"
    ADD CONSTRAINT "documento_evento_documento_id_fkey"
    FOREIGN KEY ("documento_id") REFERENCES "fiscal"."documento_consulta"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal"."cadastro_historico"
    ADD CONSTRAINT "cadastro_historico_contribuinte_id_fkey"
    FOREIGN KEY ("contribuinte_id") REFERENCES "fiscal"."cadastro_contribuinte"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal"."cadastro_divergencia"
    ADD CONSTRAINT "cadastro_divergencia_contribuinte_id_fkey"
    FOREIGN KEY ("contribuinte_id") REFERENCES "fiscal"."cadastro_contribuinte"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal"."alerta_enviado"
    ADD CONSTRAINT "alerta_enviado_sincronizacao_id_fkey"
    FOREIGN KEY ("sincronizacao_id") REFERENCES "fiscal"."cadastro_sincronizacao"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seeds de singletons obrigatórios
-- ambiente_config (singleton id=1)
INSERT INTO "fiscal"."ambiente_config" (
    "id", "ambiente_ativo", "pause_sync",
    "ultima_alteracao_em", "cron_movimento_meio_dia", "cron_movimento_manha_seguinte"
) VALUES (
    1, 'HOMOLOGACAO', false,
    NOW(), '0 12 * * *', '0 6 * * *'
) ON CONFLICT ("id") DO NOTHING;

-- limite_diario (singleton id=1)
INSERT INTO "fiscal"."limite_diario" ("id", "atualizado_em") VALUES (1, NOW()) ON CONFLICT ("id") DO NOTHING;
