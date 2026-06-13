-- ============================================================
-- Registro do módulo LOGÍSTICA na plataforma (schema core).
-- Idempotente. Aplicar no auth-gateway/core (mesma forma do
-- fiscal/seed-integracoes-fiscal.sql). O grant a usuários é feito
-- pelo Configurador (ou seed do auth-gateway) — não entra aqui.
-- O card no Hub e o RBAC (RolesGuard 'LOGISTICA') dependem disto.
-- ============================================================

-- Módulo (card "Entregas" no Hub; backend /api/v1/logistica)
INSERT INTO core.modulos_sistema
  (id, codigo, nome, descricao, icone, cor, url_frontend, url_backend, ordem, status, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'LOGISTICA', 'Logística',
   'Gestão de entregas e frota', 'truck', '#0ea5e9',
   '/entregas/', '/api/v1/logistica', 4, 'ATIVO', now(), now())
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, icone = EXCLUDED.icone,
  cor = EXCLUDED.cor, url_frontend = EXCLUDED.url_frontend,
  url_backend = EXCLUDED.url_backend, ordem = EXCLUDED.ordem, updated_at = now();

-- Roles do módulo (Fase 1; roles de frota da Fase 2 entram depois)
INSERT INTO core.roles_modulo (id, codigo, nome, descricao, modulo_id)
SELECT gen_random_uuid()::text, r.codigo, r.nome, r.descricao, m.id
FROM (VALUES
  ('ADMIN',            'Administrador',        'Administra o módulo Logística'),
  ('GESTOR_ENTREGA',   'Gestor de Entregas',   'Painel, indicadores e cadastros'),
  ('OPERADOR_ENTREGA', 'Operador de Entregas', 'Cadastra entregas, monta viagens, imprime etiquetas'),
  ('ENTREGADOR',       'Entregador',           'App do entregador (Fase 1b)')
) AS r(codigo, nome, descricao)
CROSS JOIN core.modulos_sistema m
WHERE m.codigo = 'LOGISTICA'
ON CONFLICT (modulo_id, codigo) DO NOTHING;
