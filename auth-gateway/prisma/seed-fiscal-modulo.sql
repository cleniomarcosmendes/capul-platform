-- ============================================================
-- seed-fiscal-modulo.sql
-- Registra o módulo FISCAL em core.modulos_sistema, suas roles
-- em core.roles_modulo e atribui ADMIN_TI ao usuário admin.
--
-- Usar em servidores onde o seed do auth-gateway foi executado
-- ANTES da inclusão do módulo Fiscal (ou seja, o seed já existia
-- sem o bloco FISCAL).
--
-- Idempotente: ON CONFLICT DO NOTHING em todos os INSERTs.
-- Seguro re-executar quantas vezes for necessário.
-- Gerado em: 20/04/2026
-- ============================================================

-- 1. Módulo FISCAL
INSERT INTO core.modulos_sistema (
  id, codigo, nome, descricao,
  icone, cor, url_frontend, url_backend,
  ordem, status, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'FISCAL',
  'Fiscal',
  'Consulta NF-e/CT-e, cadastro de contribuintes e cruzamento de dados com SEFAZ',
  'file-text',
  '#F59E0B',
  '/fiscal/',
  '/api/v1/fiscal',
  3,
  'ATIVO',
  NOW(), NOW()
) ON CONFLICT (codigo) DO NOTHING;

-- 2. Roles do módulo FISCAL
WITH mod AS (SELECT id FROM core.modulos_sistema WHERE codigo = 'FISCAL')
INSERT INTO core.roles_modulo (id, codigo, nome, descricao, modulo_id)
SELECT gen_random_uuid(), r.codigo, r.nome, r.descricao, mod.id
FROM mod,
  (VALUES
    ('GESTOR_FISCAL', 'Gestor Fiscal',  'Consulta cadastral, NF-e/CT-e, divergencias e agendamentos'),
    ('ADMIN_TI',      'Admin TI',       'Acesso total ao fiscal: certificados, limites, alternancia PROD/HOM e pausar jobs')
  ) AS r(codigo, nome, descricao)
ON CONFLICT (modulo_id, codigo) DO NOTHING;

-- 3. Atribuir ADMIN_TI ao usuário admin (criado pelo seed do auth-gateway)
--    Identifica o admin pelo username 'admin' — não depende do UUID fixo.
INSERT INTO core.permissoes_modulo (id, status, usuario_id, modulo_id, role_modulo_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'ATIVO',
  u.id,
  ms.id,
  rm.id,
  NOW(), NOW()
FROM core.usuarios u
JOIN core.modulos_sistema ms ON ms.codigo = 'FISCAL'
JOIN core.roles_modulo rm ON rm.modulo_id = ms.id AND rm.codigo = 'ADMIN_TI'
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;

-- Verificação
SELECT
  ms.codigo  AS modulo,
  rm.codigo  AS role,
  u.username AS usuario,
  pm.status
FROM core.permissoes_modulo pm
JOIN core.modulos_sistema ms ON ms.id = pm.modulo_id
JOIN core.roles_modulo rm    ON rm.id = pm.role_modulo_id
JOIN core.usuarios u         ON u.id  = pm.usuario_id
WHERE ms.codigo = 'FISCAL';
