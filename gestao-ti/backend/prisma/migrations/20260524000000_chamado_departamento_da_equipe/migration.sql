-- Workspace Multi-Departamento Onda 2 C2.7 — alinhamento de dados.
--
-- Até este ponto, `chamados.departamento_id` era gravado como o depto do
-- SOLICITANTE (via cascade resolveDepartamento). O modelo correto é que o
-- departamento de um chamado seja o departamento da EQUIPE QUE ATENDE
-- (workspace dono), porque qualquer user de qualquer depto pode abrir
-- chamado pra qualquer equipe — quem é dono é quem RESOLVE.
--
-- Este UPDATE alinha registros existentes: chamados que tenham equipe
-- atual passam a referenciar o departamento dessa equipe. Chamados sem
-- equipe atual (raríssimo) ou em equipes sem departamento_id (legacy)
-- mantêm o valor anterior — não bloqueia.

UPDATE gestao_ti.chamados c
SET departamento_id = e.departamento_id
FROM gestao_ti.equipes_ti e
WHERE c.equipe_atual_id = e.id
  AND e.departamento_id IS NOT NULL
  AND (c.departamento_id IS DISTINCT FROM e.departamento_id);
