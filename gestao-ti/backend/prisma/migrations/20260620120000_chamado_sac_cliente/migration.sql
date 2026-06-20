-- SAC Fase 1 (20/06) — dados do CLIENTE externo no chamado + canal de origem.
-- O colaborador da filial registra o SAC em nome do cliente (cliente não é
-- usuário do sistema) → guardamos nome/contato como CAMPOS. Aditivo + idempotente;
-- nullable (chamados internos não preenchem). `cliente_contato` habilita o
-- e-mail de saída na Fase 2; o threading usa o `numero` do chamado (`[SAC-<n>]`).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'CanalOrigemSac' AND n.nspname = 'gestao_ti') THEN
    CREATE TYPE "gestao_ti"."CanalOrigemSac" AS ENUM ('BALCAO', 'TELEFONE', 'EMAIL', 'OUTRO');
  END IF;
END $$;

ALTER TABLE "gestao_ti"."chamados" ADD COLUMN IF NOT EXISTS "cliente_nome" TEXT;
ALTER TABLE "gestao_ti"."chamados" ADD COLUMN IF NOT EXISTS "cliente_contato" TEXT;
ALTER TABLE "gestao_ti"."chamados" ADD COLUMN IF NOT EXISTS "canal_origem" "gestao_ti"."CanalOrigemSac";
