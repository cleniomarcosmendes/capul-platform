-- REFERÊNCIA entre chamados — "este chamado veio daquele".
--
-- Contrapartida de tirar o "Reabrir" das mãos do solicitante (26/08). O que estava
-- acontecendo: chamado resolvido virou atalho — em vez de abrir uma demanda nova, o
-- usuário reabria a antiga. O histórico do atendimento antigo passava a carregar outro
-- assunto, o tempo de resolução do primeiro contava o segundo, e o indicador de
-- reabertura — que deveria medir "não resolvemos direito" — media preguiça de abrir
-- chamado.
--
-- Agora ele abre um chamado NOVO e escreve `#123` no detalhamento; o backend resolve o
-- número, confere se ele pode ver aquele chamado e grava o laço AQUI, em campo
-- estruturado. (Deixar a citação só no texto seria o mesmo erro do cliente no assunto
-- da Venda Ativa: o dado existe, mas ninguém consegue navegar nem contar.)
--
-- ⚠️ NÃO é agrupamento. `chamado_agrupador_id` tem efeito de estado (filho vira
-- AGRUPADO, SLA pausa, resolver cascateia). Referência é só contexto: os dois chamados
-- seguem independentes, cada um com seu SLA e seu ciclo.
--
-- ON DELETE CASCADE nos dois lados: some o chamado, some o laço — laço órfão não tem
-- significado. UNIQUE (origem, destino) porque citar duas vezes é a mesma citação.

CREATE TABLE "gestao_ti"."chamado_referencias" (
    "id" TEXT NOT NULL,
    "origem_id" TEXT NOT NULL,
    "destino_id" TEXT NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamado_referencias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chamado_referencias_origem_id_destino_id_key"
    ON "gestao_ti"."chamado_referencias"("origem_id", "destino_id");

CREATE INDEX "chamado_referencias_destino_id_idx"
    ON "gestao_ti"."chamado_referencias"("destino_id");

ALTER TABLE "gestao_ti"."chamado_referencias"
    ADD CONSTRAINT "chamado_referencias_origem_id_fkey"
    FOREIGN KEY ("origem_id") REFERENCES "gestao_ti"."chamados"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gestao_ti"."chamado_referencias"
    ADD CONSTRAINT "chamado_referencias_destino_id_fkey"
    FOREIGN KEY ("destino_id") REFERENCES "gestao_ti"."chamados"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
