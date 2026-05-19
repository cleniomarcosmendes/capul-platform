-- Nota interna em comentários de tarefa de projeto (Conversa do drawer).
--
-- Contexto (16/05/2026): repaginação Atividades unificou Notas+Comentários na
-- aba "Conversa". Revisão apontou que USUARIO_CHAVE/TERCEIRIZADO membros do
-- projeto enxergam e postam TODA a timeline — TI não tinha como escrever algo
-- interno sem o usuário-chave ver. Decisão Clenio: espelhar a Regra única
-- 14/05 já aplicada em chamado (HistoricoChamado.publico) e pendência
-- (InteracaoPendencia.publica): publica=false => visível apenas para staff TI
-- (isTI: ADMIN/GESTOR_TI/SUPORTE_TI). Defesa em profundidade backend+frontend.
--
-- Compat: DEFAULT TRUE => todas as notas existentes permanecem públicas
-- (nenhuma vira interna retroativamente). Idempotente.

ALTER TABLE "gestao_ti"."comentarios_tarefa"
  ADD COLUMN IF NOT EXISTS "publica" BOOLEAN NOT NULL DEFAULT true;
