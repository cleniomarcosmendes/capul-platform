-- Quem FECHOU a viagem (retorno) e quando.
--
-- Antes ninguém sabia: havia `criado_por_id` (quem abriu) e
-- `acerto_encerrado_por_id` (quem encerrou o acerto), mas nada para o retorno —
-- em NENHUM dos fluxos (individual, PADRÃO ou portaria).
--
-- É o que substitui, com rastro de verdade, a exigência de redigitar a matrícula
-- do condutor no retorno quando ela não podia ser conferida (usuário sem
-- matrícula no cadastro): pedir um número que está escrito na própria tela não
-- impedia nada e não deixava registro.
--
-- Aditiva: colunas nuláveis, sem backfill. Viagens antigas ficam com NULL, que
-- significa honestamente "não sabemos quem fechou".
-- AlterTable
ALTER TABLE "logistica"."viagem" ADD COLUMN     "fechado_em" TIMESTAMP(3),
ADD COLUMN     "fechado_por_id" TEXT;
