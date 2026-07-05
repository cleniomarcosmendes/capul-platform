-- Captura o MÓDULO LOGISTICA + TODAS as suas roles em core (RBAC como código-fonte).
-- O módulo e as 8 roles originais tinham sido inseridos MANUALMENTE (não estavam em
-- nenhuma migration/seed do repo) — ver memory/project_logistica_representantes_rdv.
-- Esta migration os cria de forma idempotente, junto com COORDENADOR/SUPERVISOR, para
-- o repositório passar a ser a FONTE ÚNICA da RBAC de Logística (nada mais depende de
-- passo manual, inclusive num ambiente do zero).
--
-- Idempotente: ON CONFLICT DO NOTHING (módulo por codigo; role por modulo_id+codigo).
-- Data-only (não altera schema). Complementa a migration ..._add_logistica_roles_*
-- (mantida por já estar aplicada); aqui é a versão completa e auto-suficiente.

-- 1) Módulo LOGISTICA (se já existir, mantém o id atual; senão, cria com novo uuid).
INSERT INTO "core"."modulos_sistema"
  ("id", "codigo", "nome", "descricao", "icone", "cor", "url_frontend", "url_backend", "ordem", "updated_at")
VALUES
  (gen_random_uuid()::text, 'LOGISTICA', 'Logística', 'Gestão de entregas e frota',
   'truck', '#0ea5e9', '/entregas/', '/api/v1/logistica', 4, now())
ON CONFLICT ("codigo") DO NOTHING;

-- 2) Roles do módulo (8 originais + COORDENADOR + SUPERVISOR).
INSERT INTO "core"."roles_modulo" ("id", "codigo", "nome", "descricao", "modulo_id")
SELECT gen_random_uuid()::text, r."codigo", r."nome", r."descricao", m."id"
FROM "core"."modulos_sistema" m
CROSS JOIN (VALUES
  ('ADMIN',               'Administrador',            'Administra o módulo Logística'),
  ('ENTREGADOR',          'Entregador',               'App do entregador (Fase 1b)'),
  ('GESTOR_ENTREGA',      'Gestor de Entregas',       'Painel, indicadores e cadastros'),
  ('GESTOR_FROTA',        'Gestor de Frota',          'Controle de frota: viagens, veículos, ajustes e indicadores'),
  ('OPERADOR_ENTREGA',    'Operador de Entregas',     'Cadastra entregas, monta viagens, imprime etiquetas'),
  ('REGISTRADOR_ENTREGA', 'Registrador de Entregas',  'Caixa: só inclui e altera entregas (identifica-se por matrícula+senha)'),
  ('REGISTRADOR_FROTA',   'Registrador de Frota',     'Login compartilhado: só registra saída/retorno de veículo (condutor por matrícula+senha); não administra a frota'),
  ('COORDENADOR',         'Coordenador',              'Aprova planejamentos e despesas dos seus supervisores + fechamento (RDV)'),
  ('SUPERVISOR',          'Supervisor de Área',       'Cria e executa seus planejamentos (fluxo de campo)')
) AS r("codigo", "nome", "descricao")
WHERE m."codigo" = 'LOGISTICA'
ON CONFLICT ("modulo_id", "codigo") DO NOTHING;
