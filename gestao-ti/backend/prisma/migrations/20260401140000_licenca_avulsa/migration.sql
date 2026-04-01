-- CreateEnum
CREATE TYPE "gestao_ti"."CategoriaLicenca" AS ENUM ('CERTIFICADO_DIGITAL', 'DOMINIO', 'SSL_TLS', 'CLOUD_SERVICE', 'ASSINATURA_ELETRONICA', 'OUTRO');

-- AlterTable: tornar software_id opcional e adicionar campos para licenca avulsa
ALTER TABLE "gestao_ti"."software_licencas" ALTER COLUMN "software_id" DROP NOT NULL;
ALTER TABLE "gestao_ti"."software_licencas" ADD COLUMN "categoria" "gestao_ti"."CategoriaLicenca";
ALTER TABLE "gestao_ti"."software_licencas" ADD COLUMN "nome" TEXT;
