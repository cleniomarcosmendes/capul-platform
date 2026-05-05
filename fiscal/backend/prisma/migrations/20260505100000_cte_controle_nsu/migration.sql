-- CT-e Distribuição NSU — Fase 1 do PLANO_CTE_DISTRIBUICAO_v2.md
-- PoC validada em 05/05/2026 contra HOM SEFAZ.
-- Tabela rastreia o cursor sequencial NSU por CNPJ+ambiente para o serviço
-- SEFAZ CTeDistribuicaoDFe modo distNSU. Capul é tomadora/destinatária —
-- NÃO emite CT-e.

-- CreateTable
CREATE TABLE "fiscal"."cte_controle_nsu" (
    "id" SERIAL NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "ambiente" INTEGER NOT NULL,
    "ultimo_nsu_processado" VARCHAR(15) NOT NULL DEFAULT '000000000000000',
    "max_nsu_conhecido" VARCHAR(15) NOT NULL DEFAULT '000000000000000',
    "ultima_consulta" TIMESTAMP(3),
    "proxima_consulta" TIMESTAMP(3),
    "bloqueado_ate" TIMESTAMP(3),
    "motivo_bloqueio" TEXT,
    "consultas_na_janela" INTEGER NOT NULL DEFAULT 0,
    "janela_inicio" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cte_controle_nsu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cte_controle_nsu_ativo_idx" ON "fiscal"."cte_controle_nsu"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "cte_controle_nsu_cnpj_ambiente_key" ON "fiscal"."cte_controle_nsu"("cnpj", "ambiente");
