-- Ativa o módulo GESTAO_PESSOAS no Hub.
--
-- ⭐ POLÍTICA (decisão de 05/09/2026): o módulo só vira ATIVO quando as SETE
-- telas existirem. Card no Hub com rota por construir é pior que módulo
-- ausente — o usuário clica, chega em tela vazia e conclui que o sistema está
-- quebrado. Em 05/09 isso aconteceu ao vivo, com cinco das sete faltando.
--
-- E a virada é MIGRATION, não UPDATE de ambiente: ligado à mão, o módulo fica
-- ATIVO no DEV e INATIVO em produção sem que nada registre a diferença, e a
-- pergunta "por que não aparece lá?" só se responde comparando bancos.
--
-- As sete, entregues em 06/09/2026:
--   1. Minhas avaliações (fila do avaliador)   5. Designação
--   2. Responder questionário                  6. Painel (+ pendências cadastrais)
--   3. Ciclos                                  7. Resultados (+ memória de cálculo)
--   4. Aplicações
--
-- ⚠️ Só desde 05/09 o `status` decide alguma coisa: `build-modulos-response.ts`
-- passou a filtrar `modulo.status = 'ATIVO'`. Antes disto a coluna era
-- decorativa e este UPDATE não teria efeito nenhum.
--
-- Idempotente e data-only.
UPDATE "core"."modulos_sistema"
   SET "status" = 'ATIVO', "updated_at" = now()
 WHERE "codigo" = 'GESTAO_PESSOAS'
   AND "status" <> 'ATIVO';
