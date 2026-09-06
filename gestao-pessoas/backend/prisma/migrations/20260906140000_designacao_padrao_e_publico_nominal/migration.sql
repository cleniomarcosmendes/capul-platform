-- ============================================================================
-- AS DUAS LISTAS NOMINAIS
--
-- A estrutura de GESTAO nao coincide com a CONTABIL. Medido no cadastro real
-- em 06/09/2026: limpeza sao 46 pessoas em 19 pares filial x CC (o CC
-- "LIMPEZA" tem 14 delas), transporte 46 em 18, seguranca 28 em 9; e os 31
-- aprendizes estao em 15 pares, todos compartilhados com gente efetiva -- nao
-- existe CC que os isole, e a aplicacao propria deles, que a regua e o
-- OBSERVACAO_RH_APRENDIZES.md ja tratam como decidida, era impossivel de
-- montar.
--
-- Por isso o que se persiste e sempre nominal. Centro de custo e filial viram
-- ATALHOS DE PREENCHIMENTO na tela e sobrevivem so como origem +
-- origem_referencia.
-- ============================================================================

CREATE TYPE "rh"."OrigemVinculo" AS ENUM ('CENTRO_CUSTO', 'FILIAL', 'MANUAL', 'DIVISAO_AUTOMATICA');

-- AlterEnum
ALTER TYPE "rh"."OrigemDesignacao" ADD VALUE 'FILIAL';

-- CreateTable
CREATE TABLE "rh"."designacao_padrao" (
    "id" TEXT NOT NULL,
    "avaliador_id" TEXT NOT NULL,
    "avaliado_id" TEXT NOT NULL,
    "origem" "rh"."OrigemVinculo" NOT NULL,
    "origem_referencia" TEXT,
    "provisorio" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "registrado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designacao_padrao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."aplicacao_publico" (
    "id" TEXT NOT NULL,
    "aplicacao_id" TEXT NOT NULL,
    "ciclo_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "origem" "rh"."OrigemVinculo" NOT NULL,
    "origem_referencia" TEXT,
    "registrado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicacao_publico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "designacao_padrao_avaliador_id_vigencia_fim_idx" ON "rh"."designacao_padrao"("avaliador_id", "vigencia_fim");

-- CreateIndex
CREATE INDEX "designacao_padrao_avaliado_id_vigencia_fim_idx" ON "rh"."designacao_padrao"("avaliado_id", "vigencia_fim");

-- CreateIndex
CREATE INDEX "designacao_padrao_origem_origem_referencia_idx" ON "rh"."designacao_padrao"("origem", "origem_referencia");

-- CreateIndex
CREATE INDEX "aplicacao_publico_aplicacao_id_idx" ON "rh"."aplicacao_publico"("aplicacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "aplicacao_publico_ciclo_id_colaborador_id_key" ON "rh"."aplicacao_publico"("ciclo_id", "colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "aplicacao_id_ciclo_id_key" ON "rh"."aplicacao"("id", "ciclo_id");

-- AddForeignKey
ALTER TABLE "rh"."designacao_padrao" ADD CONSTRAINT "designacao_padrao_avaliador_id_fkey" FOREIGN KEY ("avaliador_id") REFERENCES "rh"."colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."designacao_padrao" ADD CONSTRAINT "designacao_padrao_avaliado_id_fkey" FOREIGN KEY ("avaliado_id") REFERENCES "rh"."colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."aplicacao_publico" ADD CONSTRAINT "aplicacao_publico_aplicacao_id_ciclo_id_fkey" FOREIGN KEY ("aplicacao_id", "ciclo_id") REFERENCES "rh"."aplicacao"("id", "ciclo_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."aplicacao_publico" ADD CONSTRAINT "aplicacao_publico_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "rh"."colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- O QUE O PRISMA NAO GERA A PARTIR DO SCHEMA
-- ============================================================================

-- UM AVALIADOR POR AVALIADO, ENTRE OS VIGENTES.
-- E a mesma regra do @@unique([ciclo_id, avaliado_id]) da avaliacao, uma etapa
-- antes: o conflito e recusado no CADASTRO, que fala com quem errou, e nao uma
-- pessoa por vez na designacao. Precisa ser PARCIAL porque a mesma pessoa tem
-- varias linhas ao longo do tempo -- o que nao pode e ter duas VIGENTES.
-- Mesmo caso de ciclo_elegibilidade, que ficou sem unique por isto.
CREATE UNIQUE INDEX "designacao_padrao_avaliado_vigente_key"
    ON "rh"."designacao_padrao"("avaliado_id")
    WHERE "vigencia_fim" IS NULL;

-- NINGUEM NA PROPRIA LISTA. Autoavaliacao nao existe (decisao A2/F1), e deixar
-- o cadastro aceitar o que a designacao recusa so adiaria o erro para a hora
-- em que ele custa mais caro.
ALTER TABLE "rh"."designacao_padrao"
    ADD CONSTRAINT "designacao_padrao_avaliador_diferente_do_avaliado"
    CHECK ("avaliador_id" <> "avaliado_id");

-- DIVISAO_AUTOMATICA SO EXISTE NA DESIGNACAO.
-- La ela significa "a importacao repartiu um CC entre N responsaveis em ordem
-- alfabetica; ninguem decidiu esta linha". No publico da aplicacao nao ha o
-- que repartir, e o valor nao significaria nada -- enum compartilhado sem esta
-- trava e um estado invalido esperando alguem grava-lo.
ALTER TABLE "rh"."aplicacao_publico"
    ADD CONSTRAINT "aplicacao_publico_sem_divisao_automatica"
    CHECK ("origem" <> 'DIVISAO_AUTOMATICA');
