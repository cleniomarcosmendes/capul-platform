-- Adiciona a role PORTARIA ao módulo LOGISTICA (core.roles_modulo).
-- Perfil do pessoal da PORTARIA: registra a SAÍDA e o RETORNO do veículo apontando
-- o motorista por NOME (sem a senha do motorista); o porteiro se identifica por
-- matrícula+senha (Protheus loginPortal) a cada ação. Login compartilhado (PADRÃO),
-- no mesmo padrão do REGISTRADOR_FROTA.
--
-- Idempotente: ON CONFLICT (modulo_id, codigo) DO NOTHING. Guardado na existência do
-- módulo LOGISTICA. Data-only (não altera schema).
INSERT INTO "core"."roles_modulo" ("id", "codigo", "nome", "descricao", "modulo_id")
SELECT gen_random_uuid()::text, r."codigo", r."nome", r."descricao", m."id"
FROM "core"."modulos_sistema" m
CROSS JOIN (VALUES
  ('PORTARIA', 'Portaria', 'Registra saída e retorno de veículo pela portaria (motorista por nome, sem senha do motorista); o porteiro identifica-se por matrícula+senha')
) AS r("codigo", "nome", "descricao")
WHERE m."codigo" = 'LOGISTICA'
ON CONFLICT ("modulo_id", "codigo") DO NOTHING;
