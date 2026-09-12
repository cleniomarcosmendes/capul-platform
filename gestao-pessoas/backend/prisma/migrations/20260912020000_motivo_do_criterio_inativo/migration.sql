-- ⭐ O MOTIVO DE ESTAR DESATIVADO, no DADO — não só no documento.
--
-- `QTDE_TREINAMENTO` está com `ativo = false` desde o seed, por decisão: o
-- registro de treinamento no Protheus **parou em 14/11/2025** e, na janela de 12
-- meses da data-base do Piloto, apenas **6 pessoas de 1.036** pontuariam.
--
-- ⚠️ O motivo morava só no `ESTADO-DO-PROJETO.md` e no comentário do resolver.
-- Na tela o critério aparecia como "Inativo" e mais nada — e quem não conhece a
-- história liga achando que foi lapso. Ligar assim **puniria 1.030 pessoas** por
-- uma lacuna administrativa: o critério não distingue "não fez curso" de
-- "ninguém registrou o curso", e com peso 10 contra 60 empurra a nota final de
-- quase todo mundo para baixo, igualmente, sem que ninguém veja o motivo.
--
-- A `descricao` é onde o motivo mora porque é o que a tela já mostra — e a tela
-- de cadastro passou a pedir isso de quem desativa qualquer critério.
--
-- COMO SE DESFAZ: restaurar a descrição anterior (está no `prisma/seed.ts`).

UPDATE "rh"."criterio"
   SET "descricao" =
       'DESATIVADO (decisão de 05/09/2026, revista em 11/09): o registro de treinamento no '
       || 'Protheus parou em 14/11/2025 — 1.188 registros em 2023, 1.011 em 2024, 64 em 2025 e '
       || 'nada depois. Na janela de 12 meses do Piloto, 6 pessoas de 1.036 pontuariam. Ligar '
       || 'assim puniria as outras por falta de REGISTRO, não por falta de curso: o critério não '
       || 'distingue as duas coisas. Só religar depois que o RH esclarecer por que o registro '
       || 'parou. O resolver, as faixas e a tela já existem — falta o dado.',
       "atualizado_em" = NOW()
 WHERE "codigo" = 'QTDE_TREINAMENTO';

-- Recusa alta se o critério não existir: a migration existe para dizer algo
-- sobre uma linha específica, e aplicá-la sem efeito seria dar por registrado
-- um motivo que ninguém vai ler.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "rh"."criterio" WHERE "codigo" = 'QTDE_TREINAMENTO') THEN
    RAISE EXCEPTION 'Critério QTDE_TREINAMENTO não existe — a migration do motivo não teve efeito.';
  END IF;
END $$;
