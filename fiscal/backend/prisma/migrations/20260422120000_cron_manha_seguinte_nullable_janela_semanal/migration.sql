-- =================================================================
-- Migration: cron_movimento_manha_seguinte nullable + default NULL
-- =================================================================
-- Contexto: setor fiscal definiu em 22/04/2026 que a consulta cadastral
-- SEFAZ é feita no maximo 1x por semana (domingo -> sabado BRT). A
-- 2a corrida diaria (MOVIMENTO_MANHA_SEGUINTE as 06:00) torna-se
-- redundante sob essa janela semanal.
--
-- Alteracoes:
--   - cron_movimento_manha_seguinte: DROP NOT NULL + DROP DEFAULT
--   - Linhas existentes com '0 6 * * *' ficam preservadas (compat. back.
--     operador pode apagar via UI para desabilitar). Em deploy novo o
--     default passa a ser NULL (desabilitado).
--
-- O scheduler.service.ts trata NULL/vazio como "cron desabilitado" e so
-- registra o cron se houver expressao valida.
-- =================================================================

-- 1. Remover default para que novos registros venham NULL por padrao
ALTER TABLE "fiscal"."ambiente_config"
  ALTER COLUMN "cron_movimento_manha_seguinte" DROP DEFAULT;

-- 2. Tornar a coluna nullable
ALTER TABLE "fiscal"."ambiente_config"
  ALTER COLUMN "cron_movimento_manha_seguinte" DROP NOT NULL;

-- 3. Aplicar padrao novo (NULL) ao singleton id=1 se ainda estiver com
--    o valor legado "0 6 * * *". Operadores que ja tivessem customizado
--    (ex: "30 5 * * *") NAO sao afetados — so mudamos quem estava no
--    default de fabrica.
UPDATE "fiscal"."ambiente_config"
   SET "cron_movimento_manha_seguinte" = NULL
 WHERE id = 1
   AND "cron_movimento_manha_seguinte" = '0 6 * * *';
