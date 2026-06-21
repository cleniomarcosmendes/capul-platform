-- SAC — separa o contato do cliente: `cliente_contato` (que era o e-mail) vira
-- `cliente_email` (usado no e-mail de saída) e ganha um `cliente_telefone` à
-- parte. Aditivo + idempotente; sem perda de dado (rename preserva o conteúdo).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'gestao_ti' AND table_name = 'chamados'
               AND column_name = 'cliente_contato') THEN
    ALTER TABLE "gestao_ti"."chamados" RENAME COLUMN "cliente_contato" TO "cliente_email";
  END IF;
END $$;

ALTER TABLE "gestao_ti"."chamados" ADD COLUMN IF NOT EXISTS "cliente_email" TEXT;
ALTER TABLE "gestao_ti"."chamados" ADD COLUMN IF NOT EXISTS "cliente_telefone" TEXT;
