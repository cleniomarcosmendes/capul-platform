-- Módulo GESTAO_PESSOAS (Avaliação de Desempenho) + suas roles em `core`.
-- RBAC como código-fonte: nada de INSERT manual em ambiente, como aconteceu com
-- a Logística (que precisou de uma migration de captura depois).
--
-- Idempotente: ON CONFLICT DO NOTHING (módulo por codigo; role por modulo_id+codigo).
-- Data-only, não altera schema.

-- 1) Módulo.
--    ⚠️ Nasce INATIVO de propósito: o frontend ainda não existe, e módulo ATIVO
--    vira card no Hub — card que abriria uma tela inexistente. Ligar é
--    UPDATE "core"."modulos_sistema" SET status='ATIVO' WHERE codigo='GESTAO_PESSOAS';
--    no dia em que a SPA entrar no ar.
INSERT INTO "core"."modulos_sistema"
  ("id", "codigo", "nome", "descricao", "icone", "cor", "url_frontend", "url_backend", "ordem", "status", "updated_at")
VALUES
  (gen_random_uuid()::text, 'GESTAO_PESSOAS', 'Gestão de Pessoas',
   'Avaliação de desempenho: ciclos, questionários por perfil e resultados',
   'users', '#8b5cf6', '/gestao-pessoas/', '/api/v1/gestao-pessoas', 5, 'INATIVO', now())
ON CONFLICT ("codigo") DO NOTHING;

-- 2) Roles. Derivadas de como o RH da Capul trabalha, não de um catálogo genérico.
--
--    ⚠️ RH_MODELO e RH_CICLO são SEPARADAS de propósito. Falta o RH confirmar o
--    que a gestora delega ao supervisor — montar o instrumento, ou montar o ciclo
--    e a designação. São autoridades diferentes (quem pondera decide quanto vale
--    cada coisa; quem designa decide quem julga quem). Uma role só concederia as
--    duas por descuido, e separar depois seria mudança de permissão em produção.
--    Quando a resposta vier, é possível que uma delas simplesmente não seja
--    atribuída a ninguém — o que não custa nada.
--
--    ⭐ RH_ADMIN precisa ser dado a PELO MENOS DUAS pessoas. A separação de
--    funções proíbe qualquer um de mexer na própria avaliação, RH_ADMIN
--    inclusive; e a gestora de RH também é avaliada. Com um único RH_ADMIN,
--    ninguém consegue corrigir um problema na avaliação dela.
--    ⚠️ E precisam ser PESSOAS COM MATRÍCULA: o módulo resolve o colaborador do
--    usuário pela matrícula e nega o acesso quando não consegue (falha fechada),
--    então conta genérica de sistema não serve como segundo administrador.
INSERT INTO "core"."roles_modulo" ("id", "codigo", "nome", "descricao", "modulo_id")
SELECT gen_random_uuid()::text, r."codigo", r."nome", r."descricao", m."id"
FROM "core"."modulos_sistema" m
CROSS JOIN (VALUES
  ('ADMIN',     'Administrador',        'Administra o módulo (suporte da T.I.). Não dispensa a separação de funções.'),
  ('RH_ADMIN',  'Gestor de RH',         'Monta, publica, designa, apura, fecha e vê tudo. Exige ao menos DUAS pessoas com este papel.'),
  ('RH_MODELO', 'Monta o instrumento',  'Cria e pondera modelos: perguntas, grupos e pesos. Não publica, não designa, não apura.'),
  ('RH_CICLO',  'Monta o ciclo',        'Cria ciclos, aplicações e a designação de quem avalia quem. Não mexe no instrumento.'),
  ('AVALIADOR', 'Avaliador',            'Responde as avaliações que lhe foram designadas, e só essas.')
) AS r("codigo", "nome", "descricao")
WHERE m."codigo" = 'GESTAO_PESSOAS'
ON CONFLICT ("modulo_id", "codigo") DO NOTHING;
