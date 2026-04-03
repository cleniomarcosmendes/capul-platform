-- Fix: fornecedores.status was TEXT instead of StatusGeral enum
ALTER TABLE "gestao_ti"."fornecedores" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "gestao_ti"."fornecedores"
  ALTER COLUMN "status" TYPE "gestao_ti"."StatusGeral"
  USING "status"::"gestao_ti"."StatusGeral";
ALTER TABLE "gestao_ti"."fornecedores"
  ALTER COLUMN "status" SET DEFAULT 'ATIVO'::"gestao_ti"."StatusGeral";

-- Fix: produtos.status was TEXT instead of StatusGeral enum
ALTER TABLE "gestao_ti"."produtos" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "gestao_ti"."produtos"
  ALTER COLUMN "status" TYPE "gestao_ti"."StatusGeral"
  USING "status"::"gestao_ti"."StatusGeral";
ALTER TABLE "gestao_ti"."produtos"
  ALTER COLUMN "status" SET DEFAULT 'ATIVO'::"gestao_ti"."StatusGeral";
