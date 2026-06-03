-- Vínculo de licença passa de USUÁRIO DO SISTEMA para FUNCIONÁRIO (matrícula Protheus).
-- Substitui a tabela licenca_usuarios (FK core.usuarios) por licenca_funcionarios
-- (matrícula + nome, resolvidos via INFOCLIENTES sem senha). Os vínculos antigos
-- são descartados — não há matrícula em core.usuarios para mapear. Decisão 03/06.
-- Migração CIRÚRGICA (multi-schema): toca SOMENTE o vínculo de licença.

-- DropForeignKey
ALTER TABLE "gestao_ti"."licenca_usuarios" DROP CONSTRAINT IF EXISTS "licenca_usuarios_licenca_id_fkey";
ALTER TABLE "gestao_ti"."licenca_usuarios" DROP CONSTRAINT IF EXISTS "licenca_usuarios_usuario_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "gestao_ti"."licenca_usuarios";

-- CreateTable
CREATE TABLE "gestao_ti"."licenca_funcionarios" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "licenca_id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "licenca_funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "licenca_funcionarios_licenca_id_idx" ON "gestao_ti"."licenca_funcionarios"("licenca_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenca_funcionarios_licenca_id_matricula_key" ON "gestao_ti"."licenca_funcionarios"("licenca_id", "matricula");

-- AddForeignKey
ALTER TABLE "gestao_ti"."licenca_funcionarios" ADD CONSTRAINT "licenca_funcionarios_licenca_id_fkey" FOREIGN KEY ("licenca_id") REFERENCES "gestao_ti"."software_licencas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
