-- Criar tabela categorias_licenca
CREATE TABLE "gestao_ti"."categorias_licenca" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "gestao_ti"."StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categorias_licenca_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categorias_licenca_codigo_key" ON "gestao_ti"."categorias_licenca"("codigo");

-- Inserir categorias iniciais a partir dos valores do enum
INSERT INTO "gestao_ti"."categorias_licenca" (id, codigo, nome, descricao) VALUES
  (gen_random_uuid(), 'CERT_DIGITAL', 'Certificado Digital', 'Certificados digitais e-CPF, e-CNPJ, etc.'),
  (gen_random_uuid(), 'DOMINIO', 'Dominio', 'Registro de dominios de internet'),
  (gen_random_uuid(), 'SSL_TLS', 'SSL/TLS', 'Certificados SSL/TLS para websites'),
  (gen_random_uuid(), 'CLOUD', 'Servico Cloud', 'Servicos de nuvem (AWS, Azure, GCP)'),
  (gen_random_uuid(), 'ASSINATURA', 'Assinatura Eletronica', 'Servicos de assinatura eletronica/digital'),
  (gen_random_uuid(), 'OUTRO', 'Outro', 'Outras categorias');

-- Adicionar coluna categoria_id e migrar dados do enum
ALTER TABLE "gestao_ti"."software_licencas" ADD COLUMN "categoria_id" TEXT;

-- Migrar dados existentes do enum para a nova tabela
UPDATE "gestao_ti"."software_licencas" sl
SET categoria_id = cl.id
FROM "gestao_ti"."categorias_licenca" cl
WHERE (sl.categoria = 'CERTIFICADO_DIGITAL' AND cl.codigo = 'CERT_DIGITAL')
   OR (sl.categoria = 'DOMINIO' AND cl.codigo = 'DOMINIO')
   OR (sl.categoria = 'SSL_TLS' AND cl.codigo = 'SSL_TLS')
   OR (sl.categoria = 'CLOUD_SERVICE' AND cl.codigo = 'CLOUD')
   OR (sl.categoria = 'ASSINATURA_ELETRONICA' AND cl.codigo = 'ASSINATURA')
   OR (sl.categoria = 'OUTRO' AND cl.codigo = 'OUTRO');

-- Remover coluna enum antiga
ALTER TABLE "gestao_ti"."software_licencas" DROP COLUMN "categoria";

-- Adicionar FK
ALTER TABLE "gestao_ti"."software_licencas" ADD CONSTRAINT "software_licencas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "gestao_ti"."categorias_licenca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remover o enum (nao mais necessario)
DROP TYPE "gestao_ti"."CategoriaLicenca";
