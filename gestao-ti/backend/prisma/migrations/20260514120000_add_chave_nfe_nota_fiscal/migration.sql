-- Vincula NF Compras (gestao_ti.notas_fiscais) ao XML NF-e armazenado no
-- modulo Fiscal (SZR/SZQ no Protheus + cache fiscal.documento_consulta).
--
-- Contexto (14/05/2026): pedido Clenio. Antes do modulo Fiscal existir, o
-- pessoal anexava PDF da NF. Agora que o Fiscal baixa/grava XML automatico,
-- queremos pendurar a chave de 44 digitos na NF Compras para rastrear o
-- vinculo, sem duplicar dados. Compras chama POST /fiscal/nfe/consulta que
-- ja faz SZR->SEFAZ->grava Protheus. So persistimos a chave aqui.
--
-- Mudancas:
-- 1) Coluna `chave_nfe CHAR(44)` em notas_fiscais (NULL — vinculo opcional)
--    com UNIQUE: uma chave = no maximo 1 NF Compras.
-- 2) Tabela `nota_fiscal_chave_historico` para audit de alteracoes da chave
--    (motivo + quem + quando). Edicao bloqueada quando status >= CONFERIDA
--    (regra no service); em REGISTRADA exige motivo gravado aqui.
--
-- Idempotente.

-- 1) Coluna chave_nfe em notas_fiscais
ALTER TABLE "gestao_ti"."notas_fiscais"
  ADD COLUMN IF NOT EXISTS "chave_nfe" CHAR(44);

CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_chave_nfe_key"
  ON "gestao_ti"."notas_fiscais" ("chave_nfe");

-- 2) Audit table
CREATE TABLE IF NOT EXISTS "gestao_ti"."nota_fiscal_chave_historico" (
  "id"               TEXT NOT NULL,
  "chave_anterior"   CHAR(44),
  "chave_nova"       CHAR(44),
  "motivo"           TEXT,
  "alterado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nota_fiscal_id"   TEXT NOT NULL,
  "alterado_por_id"  TEXT NOT NULL,

  CONSTRAINT "nota_fiscal_chave_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nota_fiscal_chave_historico_nota_fiscal_id_idx"
  ON "gestao_ti"."nota_fiscal_chave_historico" ("nota_fiscal_id");

CREATE INDEX IF NOT EXISTS "nota_fiscal_chave_historico_alterado_por_id_idx"
  ON "gestao_ti"."nota_fiscal_chave_historico" ("alterado_por_id");

-- FKs. DO blocks idempotentes (ADD CONSTRAINT nao suporta IF NOT EXISTS no
-- PostgreSQL <= 16; checamos via pg_constraint).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nota_fiscal_chave_historico_nota_fiscal_id_fkey'
  ) THEN
    ALTER TABLE "gestao_ti"."nota_fiscal_chave_historico"
      ADD CONSTRAINT "nota_fiscal_chave_historico_nota_fiscal_id_fkey"
      FOREIGN KEY ("nota_fiscal_id")
      REFERENCES "gestao_ti"."notas_fiscais"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nota_fiscal_chave_historico_alterado_por_id_fkey'
  ) THEN
    ALTER TABLE "gestao_ti"."nota_fiscal_chave_historico"
      ADD CONSTRAINT "nota_fiscal_chave_historico_alterado_por_id_fkey"
      FOREIGN KEY ("alterado_por_id")
      REFERENCES "core"."usuarios"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
