-- Apagar um CENTRO DE CUSTO em uso passa a FALHAR, em vez de zerar o rateio.
--
-- Contexto (incidente de 20/08/2026, produção): a tela de Notas Fiscais e o
-- Dashboard de investimento devolviam 500 com
--   Error converting field "centroCustoId" of expected non-nullable type
--   "String", found incompatible value of "null"  (P2032)
-- porque havia item de nota fiscal com `centro_custo_id` NULL — e o Prisma
-- declarava o campo obrigatório. Uma linha assim derruba a QUERY INTEIRA: a
-- lista vinha vazia em vez de vir incompleta.
--
-- De onde veio o NULL: a migration 20260406110000 criou a coluna nullable de
-- propósito ("por seguranca, deixamos nullable e o backend validara" — o
-- NOT NULL nunca veio) E amarrou a FK com ON DELETE SET NULL. Com isso, excluir
-- um centro de custo no Configurador APAGAVA o centro de custo dos itens de nota
-- fiscal, silenciosamente, destruindo o rateio do histórico.
--
-- O `auth-gateway` já tentava proteger (`centro-custo.service.ts` → catch →
-- "possui vinculos. Inative-o em vez de excluir."), mas o catch nunca disparava:
-- não havia violação de FK para capturar. Com RESTRICT, essa mensagem passa a
-- funcionar como sempre se pretendeu — e `core.centros_custo` tem coluna
-- `status`, então inativar é o caminho previsto.
--
-- As outras duas tabelas que referenciam centro de custo (rateio_template_itens,
-- parcela_rateio_itens) JÁ eram RESTRICT. Esta era a única fora do padrão.
--
-- A coluna segue NULLABLE de propósito: já existem NULLs históricos e o schema
-- Prisma agora os reconhece (`centroCustoId String?`). Quem garante o
-- preenchimento é `CreateNotaFiscalDto` (@IsNotEmpty), na entrada.
--
-- ⚠️ Escrita à mão porque `prisma migrate diff --from-migrations` não roda aqui:
-- as migrations do gestao_ti dependem de tabelas do schema `core`, criadas pelas
-- migrations do auth-gateway, então o shadow database não pode ser construído
-- só com este histórico. Conferida contra `pg_constraint` após aplicar.

-- DropForeignKey
ALTER TABLE "gestao_ti"."nota_fiscal_itens" DROP CONSTRAINT "nota_fiscal_itens_centro_custo_id_fkey";

-- AddForeignKey
ALTER TABLE "gestao_ti"."nota_fiscal_itens" ADD CONSTRAINT "nota_fiscal_itens_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "core"."centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
