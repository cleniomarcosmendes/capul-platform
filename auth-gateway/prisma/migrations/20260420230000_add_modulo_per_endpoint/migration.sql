-- =================================================================
-- Migration: adicionar modulo consumidor + per-endpoint ativo
-- =================================================================
-- Contexto: hoje a flag global integracoes_api.ambiente é tudo-ou-nada.
-- Nova modelagem: cada endpoint pertence a 1 modulo (FISCAL/GESTAO_TI/INVENTARIO)
-- e "ativo" passa a ser a fonte de verdade de qual endpoint esta em uso
-- para cada par (integracao, modulo, operacao).
--
-- IMPORTANTE: esta migration NAO remove integracoes_api.ambiente ainda.
-- O drop fica para migration seguinte, apos o deploy dos 3 backends
-- (auth-gateway + fiscal + gestao-ti + inventario-python) consumirem o
-- novo contrato.
-- =================================================================

-- 1. Enum do modulo consumidor
DO $$ BEGIN
  CREATE TYPE "core"."ModuloConsumidor" AS ENUM ('FISCAL', 'GESTAO_TI', 'INVENTARIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Adicionar coluna modulo (nullable temporariamente para popular em seguida)
ALTER TABLE "core"."integracoes_api_endpoints"
  ADD COLUMN IF NOT EXISTS "modulo" "core"."ModuloConsumidor";

-- 3. Popular modulo pelo mapeamento conhecido das operacoes Protheus
UPDATE "core"."integracoes_api_endpoints"
   SET "modulo" = 'FISCAL'::"core"."ModuloConsumidor"
 WHERE "modulo" IS NULL
   AND "operacao" IN ('xmlNfe', 'grvXML', 'eventosNfe', 'cadastroFiscal');

UPDATE "core"."integracoes_api_endpoints"
   SET "modulo" = 'GESTAO_TI'::"core"."ModuloConsumidor"
 WHERE "modulo" IS NULL
   AND "operacao" IN ('INFOCLIENTES');

UPDATE "core"."integracoes_api_endpoints"
   SET "modulo" = 'INVENTARIO'::"core"."ModuloConsumidor"
 WHERE "modulo" IS NULL
   AND "operacao" IN ('DIGITACAO', 'HIERARQUIA', 'HISTORICO', 'PRODUTOS', 'TRANSFERENCIA');

-- 4. Guard: aborta se sobrou algum endpoint sem modulo definido
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "core"."integracoes_api_endpoints" WHERE "modulo" IS NULL) THEN
    RAISE EXCEPTION 'Existem endpoints sem modulo definido — atualize o mapeamento na migration antes de prosseguir';
  END IF;
END $$;

-- 5. Tornar NOT NULL
ALTER TABLE "core"."integracoes_api_endpoints"
  ALTER COLUMN "modulo" SET NOT NULL;

-- 6. Desativar linhas do ambiente nao-corrente (preserva comportamento efetivo)
UPDATE "core"."integracoes_api_endpoints" e
   SET "ativo" = (e."ambiente" = i."ambiente")
  FROM "core"."integracoes_api" i
 WHERE e."integracao_id" = i."id";

-- 7. Trocar unique constraint: (integracao_id, ambiente, operacao) -> (integracao_id, modulo, ambiente, operacao)
DROP INDEX IF EXISTS "core"."integracoes_api_endpoints_integracao_id_ambiente_operacao_key";

CREATE UNIQUE INDEX IF NOT EXISTS "integracoes_api_endpoints_integracao_id_modulo_ambiente_ope_key"
  ON "core"."integracoes_api_endpoints" ("integracao_id", "modulo", "ambiente", "operacao");

-- 8. Partial unique index: garante que so 1 linha pode estar ativa
--    por (integracao, modulo, operacao). Invariante da nova modelagem.
CREATE UNIQUE INDEX IF NOT EXISTS "integracoes_api_endpoints_ativo_unico"
  ON "core"."integracoes_api_endpoints" ("integracao_id", "modulo", "operacao")
  WHERE "ativo" = true;
