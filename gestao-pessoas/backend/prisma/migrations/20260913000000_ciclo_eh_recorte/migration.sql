-- ⭐ O CICLO DIZ SE ALCANÇA A EMPRESA INTEIRA OU SÓ UM RECORTE.
--
-- Sem esta coluna o painel só sabia contar: "N pessoas fora de TODAS as
-- aplicações deste ciclo", em vermelho, com "monte o público que falta". Num
-- ciclo que NUNCA teve a intenção de alcançar essas pessoas — um piloto de 16
-- centros de custo — o número é verdadeiro e a leitura é falsa: ele mostra como
-- buraco a decisão de recortar.
--
-- ⚠️ Por que uma COLUNA e não uma inferência (a alternativa de ~3h que foi
-- recusada): derivar "é recorte" do público (< X% dos elegíveis) obriga a
-- inventar um limiar, e limiar arbitrário erra CALADO — o ciclo de 49% vira
-- recorte e o de 51% vira ciclo da empresa, sem ninguém ter decidido nada.
-- Quem monta o ciclo sabe se é recorte; é dele que a informação tem de vir.
ALTER TABLE "rh"."ciclo"
  ADD COLUMN "eh_recorte" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "rh"."ciclo"."eh_recorte" IS
  'Ciclo alcança só parte da empresa (piloto, recorte por área). Quando true, quem está fora de todas as aplicações é INFORMAÇÃO, não pendência. Declarado por quem monta — nunca derivado de percentual.';
