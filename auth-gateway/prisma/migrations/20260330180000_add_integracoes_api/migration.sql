-- CreateEnum AmbienteIntegracao
DO $$ BEGIN
  CREATE TYPE "core"."AmbienteIntegracao" AS ENUM ('PRODUCAO', 'HOMOLOGACAO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum MetodoHttp
DO $$ BEGIN
  CREATE TYPE "core"."MetodoHttp" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum TipoAuth
DO $$ BEGIN
  CREATE TYPE "core"."TipoAuth" AS ENUM ('BASIC', 'BEARER', 'API_KEY', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable integracoes_api
CREATE TABLE IF NOT EXISTS "core"."integracoes_api" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ambiente" "core"."AmbienteIntegracao" NOT NULL DEFAULT 'HOMOLOGACAO',
    "tipo_auth" "core"."TipoAuth" NOT NULL DEFAULT 'BASIC',
    "auth_config" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integracoes_api_pkey" PRIMARY KEY ("id")
);

-- CreateTable integracoes_api_endpoints
CREATE TABLE IF NOT EXISTS "core"."integracoes_api_endpoints" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "ambiente" "core"."AmbienteIntegracao" NOT NULL,
    "operacao" TEXT NOT NULL,
    "descricao" TEXT,
    "url" TEXT NOT NULL,
    "metodo" "core"."MetodoHttp" NOT NULL DEFAULT 'GET',
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "headers" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "integracao_id" TEXT NOT NULL,

    CONSTRAINT "integracoes_api_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integracoes_api_codigo_key" ON "core"."integracoes_api"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integracoes_api_endpoints_integracao_id_ambiente_operacao_key"
ON "core"."integracoes_api_endpoints"("integracao_id", "ambiente", "operacao");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "core"."integracoes_api_endpoints"
    ADD CONSTRAINT "integracoes_api_endpoints_integracao_id_fkey"
    FOREIGN KEY ("integracao_id") REFERENCES "core"."integracoes_api"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
