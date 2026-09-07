-- CICLO ENCERRADO FECHA — e ganha uma porta de volta (07/09/2026)
--
-- Duas mudanças:
--   1. `StatusCiclo` perde EM_APURACAO e CANCELADO. Os dois estavam no enum
--      desde o início, NADA no código os produzia e NENHUMA linha os tinha.
--      `encerrar` até aceitava vir de EM_APURACAO — um caminho que nunca
--      existiu. Estado que ninguém escreve engana quem lê o enum para entender
--      o processo.
--   2. O ciclo ganha REABERTURA (reaberto_em, reaberto_por_id,
--      motivo_reabertura), no mesmo desenho do reabrir avaliação. Ela existe
--      porque a regra nova fecha designação, público e apuração no ciclo
--      encerrado: sem porta registrada, "encerrei sem querer" viraria criar
--      outro ciclo.
--
-- ── CONFERÊNCIA FEITA ANTES DE ESCREVER ────────────────────────────────────
-- SELECT status, count(*) FROM rh.ciclo GROUP BY 1;  -->  ABERTO: 2
-- Nenhuma linha em EM_APURACAO ou CANCELADO, então o cast abaixo não mapeia
-- nada. Se em outro ambiente HOUVER linha, esta migration FALHA no cast (e a
-- transação desfaz tudo) — de propósito: mandar a linha para outro estado é
-- decisão de gente, não de migration.
--
-- ── COMO SE DESFAZ ─────────────────────────────────────────────────────────
-- O Prisma roda cada migration DENTRO DE UMA TRANSAÇÃO no PostgreSQL, e
-- `ALTER TYPE`/`CREATE TYPE` são transacionais aqui — então "quebrar no meio"
-- não deixa estado pela metade: ou tudo entra, ou nada entra.
-- Para desfazer DEPOIS de aplicada com sucesso, o inverso é este (e só funciona
-- enquanto ninguém tiver usado os campos novos):
--
--   BEGIN;
--   ALTER TYPE rh."StatusCiclo" RENAME TO "StatusCiclo_new";
--   CREATE TYPE rh."StatusCiclo" AS ENUM ('RASCUNHO','ABERTO','EM_APURACAO','ENCERRADO','CANCELADO');
--   ALTER TABLE rh.ciclo ALTER COLUMN status DROP DEFAULT;
--   ALTER TABLE rh.ciclo ALTER COLUMN status TYPE rh."StatusCiclo" USING status::text::rh."StatusCiclo";
--   ALTER TABLE rh.ciclo ALTER COLUMN status SET DEFAULT 'RASCUNHO';
--   DROP TYPE rh."StatusCiclo_new";
--   ALTER TABLE rh.ciclo DROP COLUMN reaberto_em, DROP COLUMN reaberto_por_id, DROP COLUMN motivo_reabertura;
--   DELETE FROM public._prisma_migrations WHERE migration_name = '20260907140000_ciclo_encerrado_fecha_e_reabre';
--   COMMIT;

-- 1) a reabertura do ciclo
ALTER TABLE "rh"."ciclo"
  ADD COLUMN "reaberto_em" TIMESTAMP(3),
  ADD COLUMN "reaberto_por_id" TEXT,
  ADD COLUMN "motivo_reabertura" TEXT;

-- 2) o enum de três estados
--    (remover valor de enum no Postgres exige recriar o tipo — não há
--     ALTER TYPE ... DROP VALUE)
ALTER TYPE "rh"."StatusCiclo" RENAME TO "StatusCiclo_old";

CREATE TYPE "rh"."StatusCiclo" AS ENUM ('RASCUNHO', 'ABERTO', 'ENCERRADO');

ALTER TABLE "rh"."ciclo" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "rh"."ciclo"
  ALTER COLUMN "status" TYPE "rh"."StatusCiclo"
  USING "status"::text::"rh"."StatusCiclo";

ALTER TABLE "rh"."ciclo" ALTER COLUMN "status" SET DEFAULT 'RASCUNHO';

DROP TYPE "rh"."StatusCiclo_old";
