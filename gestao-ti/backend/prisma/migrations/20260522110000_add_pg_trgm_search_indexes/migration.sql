-- Busca profunda em Chamados e Projetos (full-text com pg_trgm) — PR1 Fundação.
--
-- Pedido do Clenio: buscar um termo (ex.: `MV_DATAFIN`, um parâmetro Protheus)
-- e achar TODOS os chamados/projetos que o mencionam em qualquer campo,
-- inclusive comentários. As buscas de hoje são rasas (só campos da entidade).
--
-- Tecnologia: `pg_trgm` (extensão nativa do Postgres) + índices GIN trigram.
-- Casa código técnico exato (`MV_DATAFIN`) E linguagem natural, tolera erro de
-- digitação e escala. Não usa Full-Text Search nativo (tsvector) porque o
-- stemming/tokenização quebra termos técnicos com underscore e maiúsculas.
--
-- Estes índices aceleram `column ILIKE '%termo%'` — ou seja, já melhoram as
-- buscas `contains` que os services usam hoje, e dão base para a busca profunda
-- (PR2 Chamado / PR3 Projeto) varrer histórico/comentários/pendências sem
-- seq scan. Mesmo padrão dos índices trigram do schema `rfb`
-- (migration 20260516220000_create_rfb_schema).
--
-- Additive e idempotente (CREATE ... IF NOT EXISTS). Sem migration destrutiva,
-- sem dependência nova (pg_trgm é nativo do PostgreSQL).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Chamado — título + descrição
CREATE INDEX IF NOT EXISTS "chamados_titulo_trgm_idx"
  ON "gestao_ti"."chamados" USING gin ("titulo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "chamados_descricao_trgm_idx"
  ON "gestao_ti"."chamados" USING gin ("descricao" gin_trgm_ops);

-- HistoricoChamado — descrição (comentários e eventos do chamado)
CREATE INDEX IF NOT EXISTS "historicos_chamado_descricao_trgm_idx"
  ON "gestao_ti"."historicos_chamado" USING gin ("descricao" gin_trgm_ops);

-- Projeto — nome + descrição
CREATE INDEX IF NOT EXISTS "projetos_nome_trgm_idx"
  ON "gestao_ti"."projetos" USING gin ("nome" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "projetos_descricao_trgm_idx"
  ON "gestao_ti"."projetos" USING gin ("descricao" gin_trgm_ops);

-- AtividadeProjeto — título + descrição
CREATE INDEX IF NOT EXISTS "atividades_projeto_titulo_trgm_idx"
  ON "gestao_ti"."atividades_projeto" USING gin ("titulo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "atividades_projeto_descricao_trgm_idx"
  ON "gestao_ti"."atividades_projeto" USING gin ("descricao" gin_trgm_ops);

-- ComentarioTarefa — texto (aba Conversa do drawer de tarefa)
CREATE INDEX IF NOT EXISTS "comentarios_tarefa_texto_trgm_idx"
  ON "gestao_ti"."comentarios_tarefa" USING gin ("texto" gin_trgm_ops);

-- PendenciaProjeto — título + descrição
CREATE INDEX IF NOT EXISTS "pendencias_projeto_titulo_trgm_idx"
  ON "gestao_ti"."pendencias_projeto" USING gin ("titulo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "pendencias_projeto_descricao_trgm_idx"
  ON "gestao_ti"."pendencias_projeto" USING gin ("descricao" gin_trgm_ops);
