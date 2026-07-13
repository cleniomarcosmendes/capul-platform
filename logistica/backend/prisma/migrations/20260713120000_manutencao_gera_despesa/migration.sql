-- Manutenção com custo passa a GERAR uma despesa.
--
-- Problema: `manutencao_veiculo.custo` era gravado e nunca somado. A Análise de
-- custos e os indicadores leem SÓ `despesa_veiculo` — então quem registrava a
-- revisão e preenchia o custo alimentava um campo que ninguém lia. Dinheiro
-- invisível no fechamento, sem nenhum erro na tela.
--
-- Decisão: `despesa_veiculo` continua sendo a ÚNICA fonte de dinheiro. A
-- manutenção não vira uma segunda fonte — ela passa a emitir uma despesa e
-- guardar o vínculo (1 custo = 1 despesa, sem contagem dupla e sem custo órfão).

-- 1. Vínculo manutenção → despesa gerada.
ALTER TABLE "logistica"."manutencao_veiculo" ADD COLUMN "despesa_id" TEXT;

CREATE UNIQUE INDEX "manutencao_veiculo_despesa_id_key"
  ON "logistica"."manutencao_veiculo"("despesa_id");

ALTER TABLE "logistica"."manutencao_veiculo"
  ADD CONSTRAINT "manutencao_veiculo_despesa_id_fkey"
  FOREIGN KEY ("despesa_id") REFERENCES "logistica"."despesa_veiculo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. O tipo "Manutenção" precisa existir (vem do seed, mas em base antiga pode
--    não estar lá). Sem ele o backfill abaixo não teria onde classificar.
INSERT INTO "logistica"."tipo_despesa" ("id", "nome", "categoria", "ativo", "requer_aprovacao", "criado_em")
SELECT gen_random_uuid(), 'Manutenção', 'VEICULO'::"logistica"."CategoriaDespesa", true, true, now()
 WHERE NOT EXISTS (SELECT 1 FROM "logistica"."tipo_despesa" WHERE "nome" = 'Manutenção');

-- 3. Backfill: as manutenções que JÁ têm custo viram despesa (aprovada, na data
--    da manutenção, no veículo dela). Sem isso o histórico continuaria fora da
--    Análise e o total do mês seguiria errado pra trás.
CREATE TEMP TABLE tmp_manutencao_backfill AS
SELECT m."id"                AS manutencao_id,
       gen_random_uuid()::text AS despesa_id,
       v."filial_id"         AS filial_id,
       m."veiculo_id"        AS veiculo_id,
       m."custo"             AS valor,
       m."data_manutencao"   AS data_despesa,
       m."criado_em"         AS criado_em,
       m."registrado_por_id" AS registrado_por_id,
       trim(
         CASE WHEN m."tipo"::text = 'CORRETIVA' THEN 'Manutenção corretiva' ELSE 'Manutenção preventiva' END
         || ' (KM ' || m."km"::text || ')'
         || COALESCE(' — ' || m."motivo", '')
       ) AS observacao
  FROM "logistica"."manutencao_veiculo" m
  JOIN "logistica"."veiculo" v ON v."id" = m."veiculo_id"
 WHERE m."custo" IS NOT NULL
   AND m."custo" > 0
   AND m."despesa_id" IS NULL;

INSERT INTO "logistica"."despesa_veiculo" (
  "id", "filial_id", "veiculo_id", "tipo_despesa_id", "valor", "data_despesa",
  "observacao", "sem_nota", "situacao", "anormalidade",
  "criado_por_id", "criado_em", "aprovado_por_id", "aprovado_em"
)
SELECT b.despesa_id,
       b.filial_id,
       b.veiculo_id,
       (SELECT "id" FROM "logistica"."tipo_despesa" WHERE "nome" = 'Manutenção' LIMIT 1),
       b.valor,
       b.data_despesa,
       b.observacao,
       true,  -- sem_nota: a manutenção não captura número de documento
       'APROVADA'::"logistica"."StatusDespesa",
       false,
       b.registrado_por_id,
       b.criado_em,
       b.registrado_por_id, -- quem registrou a manutenção é gestor/supervisor: já nasce aprovada
       b.criado_em
  FROM tmp_manutencao_backfill b;

UPDATE "logistica"."manutencao_veiculo" m
   SET "despesa_id" = b.despesa_id
  FROM tmp_manutencao_backfill b
 WHERE m."id" = b.manutencao_id;

DROP TABLE tmp_manutencao_backfill;
