-- CreateTable: tipos_projeto
CREATE TABLE "gestao_ti"."tipos_projeto" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "descricao" VARCHAR(100) NOT NULL,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_projeto_codigo_key" ON "gestao_ti"."tipos_projeto"("codigo");

-- Seed: popular com os valores do enum existente
INSERT INTO "gestao_ti"."tipos_projeto" ("id", "codigo", "descricao", "updated_at") VALUES
  (gen_random_uuid(), 'DESENVOLVIMENTO_INTERNO', 'Desenvolvimento Interno', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'IMPLANTACAO_TERCEIRO', 'Implantacao Terceiro', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'INFRAESTRUTURA', 'Infraestrutura', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OUTRO', 'Outro', CURRENT_TIMESTAMP);

-- AlterTable: projetos - add tipo_projeto_id (nullable first)
ALTER TABLE "gestao_ti"."projetos" ADD COLUMN "tipo_projeto_id" TEXT;

-- Data migration: popular tipo_projeto_id com base no enum tipo existente
UPDATE "gestao_ti"."projetos" p
SET "tipo_projeto_id" = tp."id"
FROM "gestao_ti"."tipos_projeto" tp
WHERE tp."codigo" = p."tipo"::text;

-- AddForeignKey
ALTER TABLE "gestao_ti"."projetos" ADD CONSTRAINT "projetos_tipo_projeto_id_fkey" FOREIGN KEY ("tipo_projeto_id") REFERENCES "gestao_ti"."tipos_projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
