-- CreateTable
CREATE TABLE "tipos_departamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_departamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_departamento_nome_key" ON "tipos_departamento"("nome");

-- AlterTable departamentos: add codigo and tipo_departamento_id
ALTER TABLE "departamentos" ADD COLUMN "codigo" TEXT;
ALTER TABLE "departamentos" ADD COLUMN "tipo_departamento_id" TEXT;

-- AlterTable usuarios: add mfa columns
ALTER TABLE "usuarios" ADD COLUMN "mfa_secret" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Seed default TipoDepartamento (needed for FK before seed populates real data)
INSERT INTO "tipos_departamento" ("id", "nome", "descricao", "ordem", "status", "created_at", "updated_at")
VALUES (gen_random_uuid()::text, 'Geral', 'Tipo padrao', 0, 'ATIVO', NOW(), NOW());

-- Set tipo_departamento_id for any existing departamentos (fresh deploy: table is empty, but safe)
UPDATE "departamentos"
SET "tipo_departamento_id" = (SELECT id FROM "tipos_departamento" WHERE nome = 'Geral' LIMIT 1)
WHERE "tipo_departamento_id" IS NULL;

-- Make tipo_departamento_id NOT NULL
ALTER TABLE "departamentos" ALTER COLUMN "tipo_departamento_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_tipo_departamento_id_fkey"
    FOREIGN KEY ("tipo_departamento_id") REFERENCES "tipos_departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fix usuarios.departamento_id: make NOT NULL and change FK to RESTRICT
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_departamento_id_fkey";
ALTER TABLE "usuarios" ALTER COLUMN "departamento_id" SET NOT NULL;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_departamento_id_fkey"
    FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
