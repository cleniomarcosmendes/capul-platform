-- UF no snapshot de endereço da entrega (lastro de cobrança). A EnderecoEntrega
-- global já tinha `uf`; o snapshot da Entrega não. Aditivo/idempotente.
ALTER TABLE "logistica"."entrega"
  ADD COLUMN IF NOT EXISTS "end_uf" VARCHAR(2);
