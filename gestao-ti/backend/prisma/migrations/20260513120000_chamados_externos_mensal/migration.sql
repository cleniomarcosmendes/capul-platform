-- Cria gestao_ti.chamados_externos_mensal: registro manual mensal de
-- quantos chamados a CAPUL abriu junto a fornecedores externos
-- (TOTVS-Protheus, ZANTHUS, LINIX, etc.). Alimenta o 6o KPI no
-- Dashboard de Indicadores Estrategicos.
--
-- Decisao 13/05/2026: reaproveitar `gestao_ti.softwares` como entidade
-- de "fornecedor de software externo" — Software ja tem campo
-- `fabricante` e a planilha existente da CAPUL ja menciona TOTVS,
-- Zanthus etc. (10 softwares ativos cobrem o universo de fornecedores
-- que o setor T.I. abre chamado).
--
-- Unique (mes, ano, software_id) garante um lancamento por
-- competencia/fornecedor. Edicao posterior eh permitida (cadastro
-- normal). Apenas ADMIN/GESTOR_TI lancam.

CREATE TABLE "gestao_ti"."chamados_externos_mensal" (
    "id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "qtd_chamados" INTEGER NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "software_id" TEXT NOT NULL,
    "registrado_por_id" TEXT,

    CONSTRAINT "chamados_externos_mensal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chamados_externos_mensal_mes_ano_software_id_key"
    ON "gestao_ti"."chamados_externos_mensal"("mes", "ano", "software_id");

CREATE INDEX "chamados_externos_mensal_ano_mes_idx"
    ON "gestao_ti"."chamados_externos_mensal"("ano", "mes");

CREATE INDEX "chamados_externos_mensal_software_id_idx"
    ON "gestao_ti"."chamados_externos_mensal"("software_id");

ALTER TABLE "gestao_ti"."chamados_externos_mensal"
    ADD CONSTRAINT "chamados_externos_mensal_software_id_fkey"
    FOREIGN KEY ("software_id") REFERENCES "gestao_ti"."softwares"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "gestao_ti"."chamados_externos_mensal"
    ADD CONSTRAINT "chamados_externos_mensal_registrado_por_id_fkey"
    FOREIGN KEY ("registrado_por_id") REFERENCES "core"."usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
