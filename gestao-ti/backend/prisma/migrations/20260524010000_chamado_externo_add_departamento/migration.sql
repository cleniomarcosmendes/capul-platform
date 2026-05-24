-- Workspace Multi-Departamento Onda 2 C2.7 refino (23/05 noite).
--
-- Adiciona `departamento_id` em `chamados_externos_mensal` pra que cada
-- workspace lance e visualize seus próprios chamados externos
-- separadamente. Antes, o KPI vazava entre deptos (Tatiane via os 30
-- chamados externos lançados pela T.I.).
--
-- Coluna opcional pra retrocompat com lançamentos existentes — eles são
-- todos backfilled pra T.I. (universo atual era exclusivamente da T.I.).
-- Unique passa de (mes, ano, software) pra (mes, ano, software, depto)
-- pra permitir que múltiplos deptos lancem o mesmo software no mesmo mês.

-- IDs do Prisma no Capul são TEXT (não UUID nativo) — ver core.departamentos.id.
ALTER TABLE gestao_ti.chamados_externos_mensal
  ADD COLUMN departamento_id TEXT;

ALTER TABLE gestao_ti.chamados_externos_mensal
  ADD CONSTRAINT chamados_externos_mensal_departamento_id_fkey
  FOREIGN KEY (departamento_id) REFERENCES core.departamentos(id);

CREATE INDEX chamados_externos_mensal_departamento_id_idx
  ON gestao_ti.chamados_externos_mensal (departamento_id);

-- Backfill: tudo o que existe hoje foi lançado pela T.I.
UPDATE gestao_ti.chamados_externos_mensal
SET departamento_id = (
  SELECT id FROM core.departamentos WHERE nome = 'Tecnologia da Informacao' LIMIT 1
);

-- Troca de UNIQUE: o antigo (mes, ano, software_id) passa a permitir
-- duplicação porque o novo escopo é (mes, ano, software_id, departamento_id).
-- Prisma UNIQUE = UNIQUE INDEX (não CONSTRAINT) — DROP INDEX, não DROP CONSTRAINT.
DROP INDEX IF EXISTS gestao_ti.chamados_externos_mensal_mes_ano_software_id_key;

CREATE UNIQUE INDEX chamados_externos_mensal_mes_ano_software_id_departamento_id_key
  ON gestao_ti.chamados_externos_mensal (mes, ano, software_id, departamento_id);
