
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "gestao_ti";

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusGeral" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "gestao_ti"."Prioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusChamado" AS ENUM ('ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'RESOLVIDO', 'FECHADO', 'CANCELADO', 'REABERTO');

-- CreateEnum
CREATE TYPE "gestao_ti"."Visibilidade" AS ENUM ('PUBLICO', 'PRIVADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoHistorico" AS ENUM ('ABERTURA', 'ASSUMIDO', 'TRANSFERENCIA_EQUIPE', 'TRANSFERENCIA_TECNICO', 'COMENTARIO', 'RESOLVIDO', 'FECHADO', 'REABERTO', 'CANCELADO', 'AVALIADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusOS" AS ENUM ('ABERTA', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoSoftware" AS ENUM ('ERP', 'CRM', 'SEGURANCA', 'COLABORACAO', 'INFRAESTRUTURA', 'OPERACIONAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "gestao_ti"."Criticidade" AS ENUM ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO');

-- CreateEnum
CREATE TYPE "gestao_ti"."AmbienteSoftware" AS ENUM ('ON_PREMISE', 'CLOUD', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusSoftware" AS ENUM ('ATIVO', 'EM_IMPLANTACAO', 'DESCONTINUADO', 'HOMOLOGACAO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusModulo" AS ENUM ('ATIVO', 'EM_IMPLANTACAO', 'DESATIVADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."ModeloLicenca" AS ENUM ('SUBSCRICAO', 'PERPETUA', 'POR_USUARIO', 'POR_ESTACAO', 'OEM', 'FREE_OPENSOURCE', 'SAAS', 'OUTRO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusLicenca" AS ENUM ('ATIVA', 'INATIVA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusContrato" AS ENUM ('RASCUNHO', 'ATIVO', 'SUSPENSO', 'VENCIDO', 'RENOVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."ModalidadeValor" AS ENUM ('FIXO', 'VARIAVEL');

-- CreateEnum
CREATE TYPE "gestao_ti"."ModalidadeRateio" AS ENUM ('PERCENTUAL_CUSTOMIZADO', 'VALOR_FIXO', 'PROPORCIONAL_CRITERIO', 'IGUALITARIO', 'SEM_RATEIO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusParcela" AS ENUM ('PENDENTE', 'PAGA', 'ATRASADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoHistoricoContrato" AS ENUM ('CRIACAO', 'ATIVACAO', 'ALTERACAO', 'SUSPENSAO', 'RENOVACAO', 'CANCELAMENTO', 'VENCIMENTO', 'RATEIO_ALTERADO', 'PARCELA_PAGA', 'OBSERVACAO');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoParada" AS ENUM ('PARADA_PROGRAMADA', 'PARADA_NAO_PROGRAMADA', 'MANUTENCAO_PREVENTIVA');

-- CreateEnum
CREATE TYPE "gestao_ti"."ImpactoParada" AS ENUM ('TOTAL', 'PARCIAL');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusParada" AS ENUM ('EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoProjeto" AS ENUM ('DESENVOLVIMENTO_INTERNO', 'IMPLANTACAO_TERCEIRO', 'INFRAESTRUTURA', 'OUTRO');

-- CreateEnum
CREATE TYPE "gestao_ti"."ModoProjeto" AS ENUM ('COMPLETO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusProjeto" AS ENUM ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."PapelRaci" AS ENUM ('RESPONSAVEL', 'APROVADOR', 'CONSULTADO', 'INFORMADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusFase" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusAtividade" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusCotacao" AS ENUM ('RASCUNHO', 'SOLICITADA', 'RECEBIDA', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "gestao_ti"."CategoriaCusto" AS ENUM ('MAO_DE_OBRA', 'INFRAESTRUTURA', 'LICENCIAMENTO', 'CONSULTORIA', 'TREINAMENTO', 'VIAGEM', 'MATERIAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "gestao_ti"."ProbabilidadeRisco" AS ENUM ('MUITO_BAIXA', 'BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA');

-- CreateEnum
CREATE TYPE "gestao_ti"."ImpactoRisco" AS ENUM ('MUITO_BAIXO', 'BAIXO', 'MEDIO', 'ALTO', 'MUITO_ALTO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusRisco" AS ENUM ('IDENTIFICADO', 'EM_ANALISE', 'MITIGANDO', 'ACEITO', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoDependencia" AS ENUM ('BLOQUEIO', 'PREDECESSOR', 'SUCESSOR', 'RELACIONADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoAnexo" AS ENUM ('DOCUMENTO', 'PLANILHA', 'IMAGEM', 'LINK', 'OUTRO', 'ARQUIVO');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoAtivo" AS ENUM ('SERVIDOR', 'ESTACAO_TRABALHO', 'NOTEBOOK', 'IMPRESSORA', 'SWITCH', 'ROTEADOR', 'STORAGE', 'OUTRO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusAtivo" AS ENUM ('ATIVO', 'INATIVO', 'EM_MANUTENCAO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."CategoriaArtigo" AS ENUM ('PROCEDIMENTO', 'SOLUCAO', 'FAQ', 'CONFIGURACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusArtigo" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoNotificacao" AS ENUM ('CHAMADO_ATRIBUIDO', 'CHAMADO_ATUALIZADO', 'SLA_ESTOURADO', 'LICENCA_VENCENDO', 'CONTRATO_VENCENDO', 'PARCELA_ATRASADA', 'PARADA_INICIADA', 'PROJETO_ATUALIZADO', 'GERAL');

-- CreateEnum
CREATE TYPE "gestao_ti"."StatusPendencia" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "gestao_ti"."PrioridadePendencia" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "gestao_ti"."TipoInteracaoPendencia" AS ENUM ('COMENTARIO', 'ANEXO', 'STATUS_ALTERADO', 'RESPONSAVEL_ALTERADO');

-- CreateTable
CREATE TABLE "gestao_ti"."equipes_ti" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT DEFAULT '#3B82F6',
    "icone" TEXT DEFAULT 'users',
    "aceita_chamado_externo" BOOLEAN NOT NULL DEFAULT true,
    "email_equipe" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipes_ti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."membros_equipe" (
    "id" TEXT NOT NULL,
    "is_lider" BOOLEAN NOT NULL DEFAULT false,
    "pode_gerir_contratos" BOOLEAN NOT NULL DEFAULT false,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,

    CONSTRAINT "membros_equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."catalogo_servicos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "prioridade_padrao" "gestao_ti"."Prioridade" NOT NULL DEFAULT 'MEDIA',
    "sla_padrao_horas" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "equipe_id" TEXT NOT NULL,

    CONSTRAINT "catalogo_servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."sla_definicoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prioridade" "gestao_ti"."Prioridade" NOT NULL,
    "horas_resposta" INTEGER NOT NULL,
    "horas_resolucao" INTEGER NOT NULL,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "equipe_id" TEXT NOT NULL,

    CONSTRAINT "sla_definicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."chamados" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "visibilidade" "gestao_ti"."Visibilidade" NOT NULL DEFAULT 'PUBLICO',
    "prioridade" "gestao_ti"."Prioridade" NOT NULL DEFAULT 'MEDIA',
    "status" "gestao_ti"."StatusChamado" NOT NULL DEFAULT 'ABERTO',
    "software_nome" TEXT,
    "modulo_nome" TEXT,
    "data_limite_sla" TIMESTAMP(3),
    "data_resolucao" TIMESTAMP(3),
    "data_fechamento" TIMESTAMP(3),
    "nota_satisfacao" INTEGER,
    "comentario_satisfacao" TEXT,
    "ip_maquina" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "tecnico_id" TEXT,
    "equipe_atual_id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,
    "catalogo_servico_id" TEXT,
    "sla_definicao_id" TEXT,
    "software_id" TEXT,
    "software_modulo_id" TEXT,
    "projeto_id" TEXT,
    "ativo_id" TEXT,
    "departamento_id" TEXT,

    CONSTRAINT "chamados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."historicos_chamado" (
    "id" TEXT NOT NULL,
    "tipo" "gestao_ti"."TipoHistorico" NOT NULL,
    "descricao" TEXT,
    "publico" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamado_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "equipe_origem_id" TEXT,
    "equipe_destino_id" TEXT,

    CONSTRAINT "historicos_chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."anexos_chamado" (
    "id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamado_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "anexos_chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."chamado_colaboradores" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamado_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "chamado_colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."registros_tempo_chamado" (
    "id" TEXT NOT NULL,
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_fim" TIMESTAMP(3),
    "duracao_minutos" INTEGER,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "chamado_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "registros_tempo_chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."ordens_servico" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "gestao_ti"."StatusOS" NOT NULL DEFAULT 'ABERTA',
    "data_agendamento" TIMESTAMP(3),
    "data_inicio" TIMESTAMP(3),
    "data_fim" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "filial_id" TEXT NOT NULL,
    "solicitante_id" TEXT NOT NULL,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."os_chamados" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "os_id" TEXT NOT NULL,
    "chamado_id" TEXT NOT NULL,

    CONSTRAINT "os_chamados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."os_tecnicos" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "os_id" TEXT NOT NULL,
    "tecnico_id" TEXT NOT NULL,

    CONSTRAINT "os_tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."historicos_ordem_servico" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "os_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "historicos_ordem_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."naturezas_contrato" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naturezas_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."tipos_contrato" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."fornecedores" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "loja" VARCHAR(10) NOT NULL DEFAULT '',
    "nome" VARCHAR(200) NOT NULL,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."produtos" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(15) NOT NULL,
    "descricao" VARCHAR(50) NOT NULL,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."softwares" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fabricante" TEXT,
    "tipo" "gestao_ti"."TipoSoftware" NOT NULL DEFAULT 'OUTROS',
    "criticidade" "gestao_ti"."Criticidade" NOT NULL DEFAULT 'MEDIO',
    "versao_atual" TEXT,
    "ambiente" "gestao_ti"."AmbienteSoftware" DEFAULT 'ON_PREMISE',
    "url_acesso" TEXT,
    "observacoes" TEXT,
    "status" "gestao_ti"."StatusSoftware" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "equipe_responsavel_id" TEXT,

    CONSTRAINT "softwares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."software_modulos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "versao" TEXT,
    "observacoes" TEXT,
    "status" "gestao_ti"."StatusModulo" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "software_id" TEXT NOT NULL,

    CONSTRAINT "software_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."software_filiais" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "software_id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,

    CONSTRAINT "software_filiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."modulo_filiais" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modulo_id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,

    CONSTRAINT "modulo_filiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."software_licencas" (
    "id" TEXT NOT NULL,
    "modelo_licenca" "gestao_ti"."ModeloLicenca",
    "quantidade" INTEGER,
    "valor_total" DECIMAL(12,2),
    "valor_unitario" DECIMAL(12,2),
    "data_inicio" TIMESTAMP(3),
    "data_vencimento" TIMESTAMP(3),
    "chave_serial" TEXT,
    "fornecedor" TEXT,
    "observacoes" TEXT,
    "status" "gestao_ti"."StatusLicenca" NOT NULL DEFAULT 'ATIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "software_id" TEXT NOT NULL,
    "contrato_id" TEXT,

    CONSTRAINT "software_licencas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."licenca_usuarios" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "licenca_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "licenca_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."contratos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "numero_contrato" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "gestao_ti"."StatusContrato" NOT NULL DEFAULT 'ATIVO',
    "modalidade_valor" "gestao_ti"."ModalidadeValor" NOT NULL DEFAULT 'FIXO',
    "fornecedor" TEXT,
    "codigo_fornecedor" TEXT,
    "loja_fornecedor" TEXT,
    "codigo_produto" VARCHAR(15),
    "descricao_produto" VARCHAR(50),
    "fornecedor_id" TEXT,
    "produto_id" TEXT,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "valor_mensal" DECIMAL(12,2),
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "data_assinatura" TIMESTAMP(3),
    "data_renovacao" TIMESTAMP(3),
    "renovacao_automatica" BOOLEAN NOT NULL DEFAULT false,
    "dias_alerta_vencimento" INTEGER NOT NULL DEFAULT 30,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tipo_contrato_id" TEXT,
    "filial_id" TEXT,
    "software_id" TEXT,
    "equipe_id" TEXT,
    "contrato_original_id" TEXT,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."parcelas_contrato" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "status" "gestao_ti"."StatusParcela" NOT NULL DEFAULT 'PENDENTE',
    "nota_fiscal" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "contrato_id" TEXT NOT NULL,

    CONSTRAINT "parcelas_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."rateio_templates" (
    "id" TEXT NOT NULL,
    "modalidade" "gestao_ti"."ModalidadeRateio" NOT NULL,
    "criterio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "contrato_id" TEXT NOT NULL,

    CONSTRAINT "rateio_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."rateio_template_itens" (
    "id" TEXT NOT NULL,
    "percentual" DECIMAL(7,4),
    "valor_fixo" DECIMAL(12,2),
    "parametro" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "template_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "natureza_id" TEXT,

    CONSTRAINT "rateio_template_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."parcela_rateio_itens" (
    "id" TEXT NOT NULL,
    "percentual" DECIMAL(7,4),
    "valor_calculado" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parcela_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "natureza_id" TEXT,

    CONSTRAINT "parcela_rateio_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."anexos_contrato" (
    "id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contrato_id" TEXT NOT NULL,

    CONSTRAINT "anexos_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."contrato_renovacoes" (
    "id" TEXT NOT NULL,
    "indice_reajuste" TEXT,
    "percentual_reajuste" DECIMAL(5,2),
    "valor_anterior" DECIMAL(12,2) NOT NULL,
    "valor_novo" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contrato_anterior_id" TEXT NOT NULL,
    "contrato_novo_id" TEXT NOT NULL,

    CONSTRAINT "contrato_renovacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."contrato_historicos" (
    "id" TEXT NOT NULL,
    "tipo" "gestao_ti"."TipoHistoricoContrato" NOT NULL,
    "descricao" TEXT,
    "dados_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contrato_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "contrato_historicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."motivos_parada" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motivos_parada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."registros_parada" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "gestao_ti"."TipoParada" NOT NULL,
    "impacto" "gestao_ti"."ImpactoParada" NOT NULL,
    "status" "gestao_ti"."StatusParada" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "duracao_minutos" INTEGER,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "motivo_parada_id" TEXT,
    "software_id" TEXT NOT NULL,
    "software_modulo_id" TEXT,
    "registrado_por_id" TEXT NOT NULL,
    "finalizado_por_id" TEXT,

    CONSTRAINT "registros_parada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."parada_filiais_afetadas" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parada_id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,

    CONSTRAINT "parada_filiais_afetadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."parada_chamados" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parada_id" TEXT NOT NULL,
    "chamado_id" TEXT NOT NULL,

    CONSTRAINT "parada_chamados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."parada_colaboradores" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parada_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "parada_colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."projetos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "gestao_ti"."TipoProjeto" NOT NULL,
    "modo" "gestao_ti"."ModoProjeto" NOT NULL DEFAULT 'COMPLETO',
    "status" "gestao_ti"."StatusProjeto" NOT NULL DEFAULT 'PLANEJAMENTO',
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "data_inicio" TIMESTAMP(3),
    "data_fim_prevista" TIMESTAMP(3),
    "data_fim_real" TIMESTAMP(3),
    "custo_previsto" DECIMAL(12,2),
    "custo_realizado" DECIMAL(12,2),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_pai_id" TEXT,
    "software_id" TEXT,
    "contrato_id" TEXT,
    "responsavel_id" TEXT NOT NULL,

    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."membros_projeto" (
    "id" TEXT NOT NULL,
    "papel" "gestao_ti"."PapelRaci" NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projeto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "membros_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."fases_projeto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL,
    "status" "gestao_ti"."StatusFase" NOT NULL DEFAULT 'PENDENTE',
    "data_inicio" TIMESTAMP(3),
    "data_fim_prevista" TIMESTAMP(3),
    "data_fim_real" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_id" TEXT NOT NULL,

    CONSTRAINT "fases_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."atividades_projeto" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "gestao_ti"."StatusAtividade" NOT NULL DEFAULT 'PENDENTE',
    "data_atividade" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projeto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fase_id" TEXT,
    "pendencia_id" TEXT,
    "data_inicio" TIMESTAMP(3),
    "data_fim_prevista" TIMESTAMP(3),

    CONSTRAINT "atividades_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."registros_tempo" (
    "id" TEXT NOT NULL,
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_fim" TIMESTAMP(3),
    "duracao_minutos" INTEGER,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "atividade_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "registros_tempo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."comentarios_tarefa" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "atividade_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "comentarios_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."cotacoes_projeto" (
    "id" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "data_recebimento" TIMESTAMP(3),
    "validade" TIMESTAMP(3),
    "status" "gestao_ti"."StatusCotacao" NOT NULL DEFAULT 'RASCUNHO',
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_id" TEXT NOT NULL,

    CONSTRAINT "cotacoes_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."custos_projeto" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" "gestao_ti"."CategoriaCusto" NOT NULL,
    "valor_previsto" DECIMAL(12,2),
    "valor_realizado" DECIMAL(12,2),
    "data" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_id" TEXT NOT NULL,

    CONSTRAINT "custos_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."riscos_projeto" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "probabilidade" "gestao_ti"."ProbabilidadeRisco" NOT NULL,
    "impacto" "gestao_ti"."ImpactoRisco" NOT NULL,
    "status" "gestao_ti"."StatusRisco" NOT NULL DEFAULT 'IDENTIFICADO',
    "plano_mitigacao" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "responsavel_id" TEXT,

    CONSTRAINT "riscos_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."dependencias_projeto" (
    "id" TEXT NOT NULL,
    "tipo" "gestao_ti"."TipoDependencia" NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projeto_origem_id" TEXT NOT NULL,
    "projeto_destino_id" TEXT NOT NULL,

    CONSTRAINT "dependencias_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."anexos_projeto" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "gestao_ti"."TipoAnexo" NOT NULL DEFAULT 'DOCUMENTO',
    "tamanho" TEXT,
    "descricao" TEXT,
    "nome_arquivo" TEXT,
    "nome_original" TEXT,
    "mime_type" TEXT,
    "tamanho_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projeto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "anexos_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."apontamentos_horas" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "horas" DECIMAL(5,2) NOT NULL,
    "descricao" TEXT NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fase_id" TEXT,

    CONSTRAINT "apontamentos_horas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."ativos" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "gestao_ti"."TipoAtivo" NOT NULL,
    "status" "gestao_ti"."StatusAtivo" NOT NULL DEFAULT 'ATIVO',
    "fabricante" TEXT,
    "modelo" TEXT,
    "numero_serie" TEXT,
    "data_aquisicao" TIMESTAMP(3),
    "data_garantia" TIMESTAMP(3),
    "processador" TEXT,
    "memoria_gb" INTEGER,
    "disco_gb" INTEGER,
    "sistema_operacional" TEXT,
    "ip" TEXT,
    "hostname" TEXT,
    "observacoes" TEXT,
    "glpi_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "filial_id" TEXT NOT NULL,
    "responsavel_id" TEXT,
    "departamento_id" TEXT,
    "ativo_pai_id" TEXT,

    CONSTRAINT "ativos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."ativos_software" (
    "id" TEXT NOT NULL,
    "versao_instalada" TEXT,
    "data_instalacao" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo_id" TEXT NOT NULL,
    "software_id" TEXT NOT NULL,

    CONSTRAINT "ativos_software_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."artigos_conhecimento" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "resumo" TEXT,
    "categoria" "gestao_ti"."CategoriaArtigo" NOT NULL,
    "status" "gestao_ti"."StatusArtigo" NOT NULL DEFAULT 'RASCUNHO',
    "tags" TEXT,
    "publicado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "software_id" TEXT,
    "equipe_ti_id" TEXT,
    "publica" BOOLEAN NOT NULL DEFAULT false,
    "autor_id" TEXT NOT NULL,

    CONSTRAINT "artigos_conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."anexos_conhecimento" (
    "id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "artigo_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "anexos_conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."notificacoes" (
    "id" TEXT NOT NULL,
    "tipo" "gestao_ti"."TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "dados_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."usuarios_chave_projeto" (
    "id" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projeto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "usuarios_chave_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."pendencias_projeto" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "gestao_ti"."StatusPendencia" NOT NULL DEFAULT 'ABERTA',
    "prioridade" "gestao_ti"."PrioridadePendencia" NOT NULL DEFAULT 'MEDIA',
    "data_limite" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "fase_id" TEXT,
    "responsavel_id" TEXT NOT NULL,
    "criador_id" TEXT NOT NULL,

    CONSTRAINT "pendencias_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."interacoes_pendencia" (
    "id" TEXT NOT NULL,
    "tipo" "gestao_ti"."TipoInteracaoPendencia" NOT NULL,
    "descricao" TEXT,
    "publica" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendencia_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "interacoes_pendencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."anexos_pendencia" (
    "id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendencia_id" TEXT NOT NULL,
    "interacao_id" TEXT,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "anexos_pendencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."terceirizados_projeto" (
    "id" TEXT NOT NULL,
    "empresa" TEXT,
    "funcao" TEXT NOT NULL,
    "especialidade" TEXT,
    "data_inicio" TIMESTAMP(3),
    "data_fim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,

    CONSTRAINT "terceirizados_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestao_ti"."horarios_trabalho" (
    "id" TEXT NOT NULL,
    "hora_inicio_expediente" TEXT NOT NULL DEFAULT '08:00',
    "hora_fim_expediente" TEXT NOT NULL DEFAULT '17:00',
    "hora_inicio_almoco" TEXT NOT NULL DEFAULT '12:00',
    "hora_fim_almoco" TEXT NOT NULL DEFAULT '13:00',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "usuario_id" TEXT,

    CONSTRAINT "horarios_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipes_ti_nome_key" ON "gestao_ti"."equipes_ti"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_ti_sigla_key" ON "gestao_ti"."equipes_ti"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "membros_equipe_usuario_id_equipe_id_key" ON "gestao_ti"."membros_equipe"("usuario_id", "equipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_servicos_equipe_id_nome_key" ON "gestao_ti"."catalogo_servicos"("equipe_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "sla_definicoes_equipe_id_prioridade_key" ON "gestao_ti"."sla_definicoes"("equipe_id", "prioridade");

-- CreateIndex
CREATE UNIQUE INDEX "chamados_numero_key" ON "gestao_ti"."chamados"("numero");

-- CreateIndex
CREATE INDEX "chamados_status_idx" ON "gestao_ti"."chamados"("status");

-- CreateIndex
CREATE INDEX "chamados_equipe_atual_id_status_idx" ON "gestao_ti"."chamados"("equipe_atual_id", "status");

-- CreateIndex
CREATE INDEX "chamados_solicitante_id_idx" ON "gestao_ti"."chamados"("solicitante_id");

-- CreateIndex
CREATE INDEX "chamados_tecnico_id_idx" ON "gestao_ti"."chamados"("tecnico_id");

-- CreateIndex
CREATE INDEX "historicos_chamado_chamado_id_idx" ON "gestao_ti"."historicos_chamado"("chamado_id");

-- CreateIndex
CREATE INDEX "anexos_chamado_chamado_id_idx" ON "gestao_ti"."anexos_chamado"("chamado_id");

-- CreateIndex
CREATE UNIQUE INDEX "chamado_colaboradores_chamado_id_usuario_id_key" ON "gestao_ti"."chamado_colaboradores"("chamado_id", "usuario_id");

-- CreateIndex
CREATE INDEX "registros_tempo_chamado_chamado_id_idx" ON "gestao_ti"."registros_tempo_chamado"("chamado_id");

-- CreateIndex
CREATE INDEX "registros_tempo_chamado_usuario_id_hora_inicio_idx" ON "gestao_ti"."registros_tempo_chamado"("usuario_id", "hora_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_numero_key" ON "gestao_ti"."ordens_servico"("numero");

-- CreateIndex
CREATE INDEX "ordens_servico_status_idx" ON "gestao_ti"."ordens_servico"("status");

-- CreateIndex
CREATE UNIQUE INDEX "os_chamados_os_id_chamado_id_key" ON "gestao_ti"."os_chamados"("os_id", "chamado_id");

-- CreateIndex
CREATE UNIQUE INDEX "os_tecnicos_os_id_tecnico_id_key" ON "gestao_ti"."os_tecnicos"("os_id", "tecnico_id");

-- CreateIndex
CREATE INDEX "historicos_ordem_servico_os_id_idx" ON "gestao_ti"."historicos_ordem_servico"("os_id");

-- CreateIndex
CREATE UNIQUE INDEX "naturezas_contrato_codigo_key" ON "gestao_ti"."naturezas_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_contrato_codigo_key" ON "gestao_ti"."tipos_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_codigo_loja_key" ON "gestao_ti"."fornecedores"("codigo", "loja");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_codigo_key" ON "gestao_ti"."produtos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "softwares_nome_key" ON "gestao_ti"."softwares"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "software_modulos_software_id_nome_key" ON "gestao_ti"."software_modulos"("software_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "software_filiais_software_id_filial_id_key" ON "gestao_ti"."software_filiais"("software_id", "filial_id");

-- CreateIndex
CREATE UNIQUE INDEX "modulo_filiais_modulo_id_filial_id_key" ON "gestao_ti"."modulo_filiais"("modulo_id", "filial_id");

-- CreateIndex
CREATE INDEX "software_licencas_data_vencimento_idx" ON "gestao_ti"."software_licencas"("data_vencimento");

-- CreateIndex
CREATE INDEX "software_licencas_software_id_status_idx" ON "gestao_ti"."software_licencas"("software_id", "status");

-- CreateIndex
CREATE INDEX "licenca_usuarios_licenca_id_idx" ON "gestao_ti"."licenca_usuarios"("licenca_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenca_usuarios_licenca_id_usuario_id_key" ON "gestao_ti"."licenca_usuarios"("licenca_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "gestao_ti"."contratos"("numero");

-- CreateIndex
CREATE INDEX "contratos_status_idx" ON "gestao_ti"."contratos"("status");

-- CreateIndex
CREATE INDEX "contratos_data_fim_idx" ON "gestao_ti"."contratos"("data_fim");

-- CreateIndex
CREATE INDEX "contratos_software_id_idx" ON "gestao_ti"."contratos"("software_id");

-- CreateIndex
CREATE INDEX "parcelas_contrato_data_vencimento_idx" ON "gestao_ti"."parcelas_contrato"("data_vencimento");

-- CreateIndex
CREATE INDEX "parcelas_contrato_status_idx" ON "gestao_ti"."parcelas_contrato"("status");

-- CreateIndex
CREATE UNIQUE INDEX "parcelas_contrato_contrato_id_numero_key" ON "gestao_ti"."parcelas_contrato"("contrato_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "rateio_templates_contrato_id_key" ON "gestao_ti"."rateio_templates"("contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "rateio_template_itens_template_id_centro_custo_id_key" ON "gestao_ti"."rateio_template_itens"("template_id", "centro_custo_id");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_rateio_itens_parcela_id_centro_custo_id_key" ON "gestao_ti"."parcela_rateio_itens"("parcela_id", "centro_custo_id");

-- CreateIndex
CREATE INDEX "anexos_contrato_contrato_id_idx" ON "gestao_ti"."anexos_contrato"("contrato_id");

-- CreateIndex
CREATE INDEX "contrato_historicos_contrato_id_idx" ON "gestao_ti"."contrato_historicos"("contrato_id");

-- CreateIndex
CREATE INDEX "registros_parada_software_id_status_idx" ON "gestao_ti"."registros_parada"("software_id", "status");

-- CreateIndex
CREATE INDEX "registros_parada_status_idx" ON "gestao_ti"."registros_parada"("status");

-- CreateIndex
CREATE INDEX "registros_parada_inicio_idx" ON "gestao_ti"."registros_parada"("inicio");

-- CreateIndex
CREATE UNIQUE INDEX "parada_filiais_afetadas_parada_id_filial_id_key" ON "gestao_ti"."parada_filiais_afetadas"("parada_id", "filial_id");

-- CreateIndex
CREATE UNIQUE INDEX "parada_chamados_parada_id_chamado_id_key" ON "gestao_ti"."parada_chamados"("parada_id", "chamado_id");

-- CreateIndex
CREATE UNIQUE INDEX "parada_colaboradores_parada_id_usuario_id_key" ON "gestao_ti"."parada_colaboradores"("parada_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "projetos_numero_key" ON "gestao_ti"."projetos"("numero");

-- CreateIndex
CREATE INDEX "projetos_status_idx" ON "gestao_ti"."projetos"("status");

-- CreateIndex
CREATE INDEX "projetos_projeto_pai_id_idx" ON "gestao_ti"."projetos"("projeto_pai_id");

-- CreateIndex
CREATE INDEX "projetos_software_id_idx" ON "gestao_ti"."projetos"("software_id");

-- CreateIndex
CREATE UNIQUE INDEX "membros_projeto_projeto_id_usuario_id_key" ON "gestao_ti"."membros_projeto"("projeto_id", "usuario_id");

-- CreateIndex
CREATE INDEX "fases_projeto_projeto_id_ordem_idx" ON "gestao_ti"."fases_projeto"("projeto_id", "ordem");

-- CreateIndex
CREATE INDEX "atividades_projeto_projeto_id_data_atividade_idx" ON "gestao_ti"."atividades_projeto"("projeto_id", "data_atividade");

-- CreateIndex
CREATE INDEX "atividades_projeto_pendencia_id_idx" ON "gestao_ti"."atividades_projeto"("pendencia_id");

-- CreateIndex
CREATE INDEX "registros_tempo_atividade_id_idx" ON "gestao_ti"."registros_tempo"("atividade_id");

-- CreateIndex
CREATE INDEX "registros_tempo_usuario_id_hora_inicio_idx" ON "gestao_ti"."registros_tempo"("usuario_id", "hora_inicio");

-- CreateIndex
CREATE INDEX "comentarios_tarefa_atividade_id_idx" ON "gestao_ti"."comentarios_tarefa"("atividade_id");

-- CreateIndex
CREATE INDEX "cotacoes_projeto_projeto_id_idx" ON "gestao_ti"."cotacoes_projeto"("projeto_id");

-- CreateIndex
CREATE INDEX "custos_projeto_projeto_id_idx" ON "gestao_ti"."custos_projeto"("projeto_id");

-- CreateIndex
CREATE INDEX "riscos_projeto_projeto_id_idx" ON "gestao_ti"."riscos_projeto"("projeto_id");

-- CreateIndex
CREATE INDEX "dependencias_projeto_projeto_origem_id_idx" ON "gestao_ti"."dependencias_projeto"("projeto_origem_id");

-- CreateIndex
CREATE INDEX "dependencias_projeto_projeto_destino_id_idx" ON "gestao_ti"."dependencias_projeto"("projeto_destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "dependencias_projeto_projeto_origem_id_projeto_destino_id_t_key" ON "gestao_ti"."dependencias_projeto"("projeto_origem_id", "projeto_destino_id", "tipo");

-- CreateIndex
CREATE INDEX "anexos_projeto_projeto_id_idx" ON "gestao_ti"."anexos_projeto"("projeto_id");

-- CreateIndex
CREATE INDEX "apontamentos_horas_projeto_id_idx" ON "gestao_ti"."apontamentos_horas"("projeto_id");

-- CreateIndex
CREATE INDEX "apontamentos_horas_usuario_id_data_idx" ON "gestao_ti"."apontamentos_horas"("usuario_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ativos_tag_key" ON "gestao_ti"."ativos"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ativos_glpi_id_key" ON "gestao_ti"."ativos"("glpi_id");

-- CreateIndex
CREATE INDEX "ativos_tipo_idx" ON "gestao_ti"."ativos"("tipo");

-- CreateIndex
CREATE INDEX "ativos_status_idx" ON "gestao_ti"."ativos"("status");

-- CreateIndex
CREATE INDEX "ativos_filial_id_idx" ON "gestao_ti"."ativos"("filial_id");

-- CreateIndex
CREATE INDEX "ativos_ativo_pai_id_idx" ON "gestao_ti"."ativos"("ativo_pai_id");

-- CreateIndex
CREATE INDEX "ativos_software_ativo_id_idx" ON "gestao_ti"."ativos_software"("ativo_id");

-- CreateIndex
CREATE UNIQUE INDEX "ativos_software_ativo_id_software_id_key" ON "gestao_ti"."ativos_software"("ativo_id", "software_id");

-- CreateIndex
CREATE INDEX "artigos_conhecimento_categoria_status_idx" ON "gestao_ti"."artigos_conhecimento"("categoria", "status");

-- CreateIndex
CREATE INDEX "artigos_conhecimento_software_id_idx" ON "gestao_ti"."artigos_conhecimento"("software_id");

-- CreateIndex
CREATE INDEX "artigos_conhecimento_autor_id_idx" ON "gestao_ti"."artigos_conhecimento"("autor_id");

-- CreateIndex
CREATE INDEX "anexos_conhecimento_artigo_id_idx" ON "gestao_ti"."anexos_conhecimento"("artigo_id");

-- CreateIndex
CREATE INDEX "notificacoes_usuario_id_lida_idx" ON "gestao_ti"."notificacoes"("usuario_id", "lida");

-- CreateIndex
CREATE INDEX "notificacoes_usuario_id_created_at_idx" ON "gestao_ti"."notificacoes"("usuario_id", "created_at");

-- CreateIndex
CREATE INDEX "usuarios_chave_projeto_usuario_id_idx" ON "gestao_ti"."usuarios_chave_projeto"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_chave_projeto_projeto_id_usuario_id_key" ON "gestao_ti"."usuarios_chave_projeto"("projeto_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "pendencias_projeto_numero_key" ON "gestao_ti"."pendencias_projeto"("numero");

-- CreateIndex
CREATE INDEX "pendencias_projeto_projeto_id_status_idx" ON "gestao_ti"."pendencias_projeto"("projeto_id", "status");

-- CreateIndex
CREATE INDEX "pendencias_projeto_responsavel_id_idx" ON "gestao_ti"."pendencias_projeto"("responsavel_id");

-- CreateIndex
CREATE INDEX "interacoes_pendencia_pendencia_id_idx" ON "gestao_ti"."interacoes_pendencia"("pendencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "anexos_pendencia_interacao_id_key" ON "gestao_ti"."anexos_pendencia"("interacao_id");

-- CreateIndex
CREATE INDEX "anexos_pendencia_pendencia_id_idx" ON "gestao_ti"."anexos_pendencia"("pendencia_id");

-- CreateIndex
CREATE INDEX "terceirizados_projeto_usuario_id_idx" ON "gestao_ti"."terceirizados_projeto"("usuario_id");

-- CreateIndex
CREATE INDEX "terceirizados_projeto_projeto_id_ativo_idx" ON "gestao_ti"."terceirizados_projeto"("projeto_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "terceirizados_projeto_projeto_id_usuario_id_key" ON "gestao_ti"."terceirizados_projeto"("projeto_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_trabalho_usuario_id_key" ON "gestao_ti"."horarios_trabalho"("usuario_id");

-- AddForeignKey
ALTER TABLE "gestao_ti"."membros_equipe" ADD CONSTRAINT "membros_equipe_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."membros_equipe" ADD CONSTRAINT "membros_equipe_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."catalogo_servicos" ADD CONSTRAINT "catalogo_servicos_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."sla_definicoes" ADD CONSTRAINT "sla_definicoes_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_equipe_atual_id_fkey" FOREIGN KEY ("equipe_atual_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_catalogo_servico_id_fkey" FOREIGN KEY ("catalogo_servico_id") REFERENCES "gestao_ti"."catalogo_servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_sla_definicao_id_fkey" FOREIGN KEY ("sla_definicao_id") REFERENCES "gestao_ti"."sla_definicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_software_modulo_id_fkey" FOREIGN KEY ("software_modulo_id") REFERENCES "gestao_ti"."software_modulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_ativo_id_fkey" FOREIGN KEY ("ativo_id") REFERENCES "gestao_ti"."ativos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamados" ADD CONSTRAINT "chamados_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "core"."departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."historicos_chamado" ADD CONSTRAINT "historicos_chamado_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."historicos_chamado" ADD CONSTRAINT "historicos_chamado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."historicos_chamado" ADD CONSTRAINT "historicos_chamado_equipe_origem_id_fkey" FOREIGN KEY ("equipe_origem_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."historicos_chamado" ADD CONSTRAINT "historicos_chamado_equipe_destino_id_fkey" FOREIGN KEY ("equipe_destino_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_chamado" ADD CONSTRAINT "anexos_chamado_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_chamado" ADD CONSTRAINT "anexos_chamado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamado_colaboradores" ADD CONSTRAINT "chamado_colaboradores_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."chamado_colaboradores" ADD CONSTRAINT "chamado_colaboradores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_tempo_chamado" ADD CONSTRAINT "registros_tempo_chamado_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_tempo_chamado" ADD CONSTRAINT "registros_tempo_chamado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ordens_servico" ADD CONSTRAINT "ordens_servico_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ordens_servico" ADD CONSTRAINT "ordens_servico_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."os_chamados" ADD CONSTRAINT "os_chamados_os_id_fkey" FOREIGN KEY ("os_id") REFERENCES "gestao_ti"."ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."os_chamados" ADD CONSTRAINT "os_chamados_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."os_tecnicos" ADD CONSTRAINT "os_tecnicos_os_id_fkey" FOREIGN KEY ("os_id") REFERENCES "gestao_ti"."ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."os_tecnicos" ADD CONSTRAINT "os_tecnicos_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."historicos_ordem_servico" ADD CONSTRAINT "historicos_ordem_servico_os_id_fkey" FOREIGN KEY ("os_id") REFERENCES "gestao_ti"."ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."historicos_ordem_servico" ADD CONSTRAINT "historicos_ordem_servico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."softwares" ADD CONSTRAINT "softwares_equipe_responsavel_id_fkey" FOREIGN KEY ("equipe_responsavel_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."software_modulos" ADD CONSTRAINT "software_modulos_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."software_filiais" ADD CONSTRAINT "software_filiais_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."software_filiais" ADD CONSTRAINT "software_filiais_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."modulo_filiais" ADD CONSTRAINT "modulo_filiais_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "gestao_ti"."software_modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."modulo_filiais" ADD CONSTRAINT "modulo_filiais_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."software_licencas" ADD CONSTRAINT "software_licencas_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."software_licencas" ADD CONSTRAINT "software_licencas_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."licenca_usuarios" ADD CONSTRAINT "licenca_usuarios_licenca_id_fkey" FOREIGN KEY ("licenca_id") REFERENCES "gestao_ti"."software_licencas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."licenca_usuarios" ADD CONSTRAINT "licenca_usuarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contratos" ADD CONSTRAINT "contratos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "gestao_ti"."fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contratos" ADD CONSTRAINT "contratos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "gestao_ti"."produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contratos" ADD CONSTRAINT "contratos_tipo_contrato_id_fkey" FOREIGN KEY ("tipo_contrato_id") REFERENCES "gestao_ti"."tipos_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contratos" ADD CONSTRAINT "contratos_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contratos" ADD CONSTRAINT "contratos_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contratos" ADD CONSTRAINT "contratos_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contratos" ADD CONSTRAINT "contratos_contrato_original_id_fkey" FOREIGN KEY ("contrato_original_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parcelas_contrato" ADD CONSTRAINT "parcelas_contrato_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."rateio_templates" ADD CONSTRAINT "rateio_templates_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."rateio_template_itens" ADD CONSTRAINT "rateio_template_itens_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "gestao_ti"."rateio_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."rateio_template_itens" ADD CONSTRAINT "rateio_template_itens_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "core"."centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."rateio_template_itens" ADD CONSTRAINT "rateio_template_itens_natureza_id_fkey" FOREIGN KEY ("natureza_id") REFERENCES "gestao_ti"."naturezas_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parcela_rateio_itens" ADD CONSTRAINT "parcela_rateio_itens_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "gestao_ti"."parcelas_contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parcela_rateio_itens" ADD CONSTRAINT "parcela_rateio_itens_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "core"."centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parcela_rateio_itens" ADD CONSTRAINT "parcela_rateio_itens_natureza_id_fkey" FOREIGN KEY ("natureza_id") REFERENCES "gestao_ti"."naturezas_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_contrato" ADD CONSTRAINT "anexos_contrato_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contrato_renovacoes" ADD CONSTRAINT "contrato_renovacoes_contrato_anterior_id_fkey" FOREIGN KEY ("contrato_anterior_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contrato_renovacoes" ADD CONSTRAINT "contrato_renovacoes_contrato_novo_id_fkey" FOREIGN KEY ("contrato_novo_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contrato_historicos" ADD CONSTRAINT "contrato_historicos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."contrato_historicos" ADD CONSTRAINT "contrato_historicos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_parada" ADD CONSTRAINT "registros_parada_motivo_parada_id_fkey" FOREIGN KEY ("motivo_parada_id") REFERENCES "gestao_ti"."motivos_parada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_parada" ADD CONSTRAINT "registros_parada_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_parada" ADD CONSTRAINT "registros_parada_software_modulo_id_fkey" FOREIGN KEY ("software_modulo_id") REFERENCES "gestao_ti"."software_modulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_parada" ADD CONSTRAINT "registros_parada_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_parada" ADD CONSTRAINT "registros_parada_finalizado_por_id_fkey" FOREIGN KEY ("finalizado_por_id") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parada_filiais_afetadas" ADD CONSTRAINT "parada_filiais_afetadas_parada_id_fkey" FOREIGN KEY ("parada_id") REFERENCES "gestao_ti"."registros_parada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parada_filiais_afetadas" ADD CONSTRAINT "parada_filiais_afetadas_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parada_chamados" ADD CONSTRAINT "parada_chamados_parada_id_fkey" FOREIGN KEY ("parada_id") REFERENCES "gestao_ti"."registros_parada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parada_chamados" ADD CONSTRAINT "parada_chamados_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parada_colaboradores" ADD CONSTRAINT "parada_colaboradores_parada_id_fkey" FOREIGN KEY ("parada_id") REFERENCES "gestao_ti"."registros_parada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."parada_colaboradores" ADD CONSTRAINT "parada_colaboradores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."projetos" ADD CONSTRAINT "projetos_projeto_pai_id_fkey" FOREIGN KEY ("projeto_pai_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."projetos" ADD CONSTRAINT "projetos_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."projetos" ADD CONSTRAINT "projetos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "gestao_ti"."contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."projetos" ADD CONSTRAINT "projetos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."membros_projeto" ADD CONSTRAINT "membros_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."membros_projeto" ADD CONSTRAINT "membros_projeto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."fases_projeto" ADD CONSTRAINT "fases_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."atividades_projeto" ADD CONSTRAINT "atividades_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."atividades_projeto" ADD CONSTRAINT "atividades_projeto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."atividades_projeto" ADD CONSTRAINT "atividades_projeto_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "gestao_ti"."fases_projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."atividades_projeto" ADD CONSTRAINT "atividades_projeto_pendencia_id_fkey" FOREIGN KEY ("pendencia_id") REFERENCES "gestao_ti"."pendencias_projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_tempo" ADD CONSTRAINT "registros_tempo_atividade_id_fkey" FOREIGN KEY ("atividade_id") REFERENCES "gestao_ti"."atividades_projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."registros_tempo" ADD CONSTRAINT "registros_tempo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."comentarios_tarefa" ADD CONSTRAINT "comentarios_tarefa_atividade_id_fkey" FOREIGN KEY ("atividade_id") REFERENCES "gestao_ti"."atividades_projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."comentarios_tarefa" ADD CONSTRAINT "comentarios_tarefa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."cotacoes_projeto" ADD CONSTRAINT "cotacoes_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."custos_projeto" ADD CONSTRAINT "custos_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."riscos_projeto" ADD CONSTRAINT "riscos_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."riscos_projeto" ADD CONSTRAINT "riscos_projeto_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."dependencias_projeto" ADD CONSTRAINT "dependencias_projeto_projeto_origem_id_fkey" FOREIGN KEY ("projeto_origem_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."dependencias_projeto" ADD CONSTRAINT "dependencias_projeto_projeto_destino_id_fkey" FOREIGN KEY ("projeto_destino_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_projeto" ADD CONSTRAINT "anexos_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_projeto" ADD CONSTRAINT "anexos_projeto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."apontamentos_horas" ADD CONSTRAINT "apontamentos_horas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."apontamentos_horas" ADD CONSTRAINT "apontamentos_horas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."apontamentos_horas" ADD CONSTRAINT "apontamentos_horas_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "gestao_ti"."fases_projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ativos" ADD CONSTRAINT "ativos_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "core"."filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ativos" ADD CONSTRAINT "ativos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ativos" ADD CONSTRAINT "ativos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "core"."departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ativos" ADD CONSTRAINT "ativos_ativo_pai_id_fkey" FOREIGN KEY ("ativo_pai_id") REFERENCES "gestao_ti"."ativos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ativos_software" ADD CONSTRAINT "ativos_software_ativo_id_fkey" FOREIGN KEY ("ativo_id") REFERENCES "gestao_ti"."ativos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."ativos_software" ADD CONSTRAINT "ativos_software_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."artigos_conhecimento" ADD CONSTRAINT "artigos_conhecimento_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."artigos_conhecimento" ADD CONSTRAINT "artigos_conhecimento_equipe_ti_id_fkey" FOREIGN KEY ("equipe_ti_id") REFERENCES "gestao_ti"."equipes_ti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."artigos_conhecimento" ADD CONSTRAINT "artigos_conhecimento_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_conhecimento" ADD CONSTRAINT "anexos_conhecimento_artigo_id_fkey" FOREIGN KEY ("artigo_id") REFERENCES "gestao_ti"."artigos_conhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_conhecimento" ADD CONSTRAINT "anexos_conhecimento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."notificacoes" ADD CONSTRAINT "notificacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."usuarios_chave_projeto" ADD CONSTRAINT "usuarios_chave_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."usuarios_chave_projeto" ADD CONSTRAINT "usuarios_chave_projeto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."pendencias_projeto" ADD CONSTRAINT "pendencias_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."pendencias_projeto" ADD CONSTRAINT "pendencias_projeto_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "gestao_ti"."fases_projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."pendencias_projeto" ADD CONSTRAINT "pendencias_projeto_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."pendencias_projeto" ADD CONSTRAINT "pendencias_projeto_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."interacoes_pendencia" ADD CONSTRAINT "interacoes_pendencia_pendencia_id_fkey" FOREIGN KEY ("pendencia_id") REFERENCES "gestao_ti"."pendencias_projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."interacoes_pendencia" ADD CONSTRAINT "interacoes_pendencia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_pendencia" ADD CONSTRAINT "anexos_pendencia_pendencia_id_fkey" FOREIGN KEY ("pendencia_id") REFERENCES "gestao_ti"."pendencias_projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_pendencia" ADD CONSTRAINT "anexos_pendencia_interacao_id_fkey" FOREIGN KEY ("interacao_id") REFERENCES "gestao_ti"."interacoes_pendencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."anexos_pendencia" ADD CONSTRAINT "anexos_pendencia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."terceirizados_projeto" ADD CONSTRAINT "terceirizados_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "gestao_ti"."projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."terceirizados_projeto" ADD CONSTRAINT "terceirizados_projeto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestao_ti"."horarios_trabalho" ADD CONSTRAINT "horarios_trabalho_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
