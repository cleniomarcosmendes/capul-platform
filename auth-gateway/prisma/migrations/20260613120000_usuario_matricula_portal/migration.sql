-- Login do entregador (app) via portal RH (loginPortal): matrícula + flag.
-- Quando autentica_portal=true, o login valida matrícula+senha no Protheus e a
-- coluna `senha` local fica inutilizável (hash aleatório).
ALTER TABLE "core"."usuarios" ADD COLUMN "matricula" TEXT;
ALTER TABLE "core"."usuarios" ADD COLUMN "autentica_portal" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "usuarios_matricula_key" ON "core"."usuarios"("matricula");
