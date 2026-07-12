-- Adiciona a role SUPERVISOR_FROTA ("Supervisor de Departamento") ao módulo LOGISTICA.
-- Distinta do GESTOR_FROTA (que administra a frota da empresa toda): o Supervisor de
-- Departamento age SÓ nos veículos dos departamentos em que é encarregado
-- (veiculo.supervisor_id) — escopo por departamento (viagens, acerto, despesas/custo).
-- Decisões estratégicas (manutenção/retífica, cancelar, cross-filial) seguem do GESTOR.
--
-- Idempotente: ON CONFLICT (modulo_id, codigo) DO NOTHING. Data-only (não altera schema).

INSERT INTO "core"."roles_modulo" ("id", "codigo", "nome", "descricao", "modulo_id")
SELECT gen_random_uuid()::text, r."codigo", r."nome", r."descricao", m."id"
FROM "core"."modulos_sistema" m
CROSS JOIN (VALUES
  ('SUPERVISOR_FROTA', 'Supervisor de Departamento',
   'Gere os veículos do(s) seu(s) departamento(s): viagens, acerto e despesas/custo (escopo por departamento). Não administra a frota inteira nem faz manutenção estratégica.')
) AS r("codigo", "nome", "descricao")
WHERE m."codigo" = 'LOGISTICA'
ON CONFLICT ("modulo_id", "codigo") DO NOTHING;
