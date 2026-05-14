-- Adiciona flag `anexo_removido` em `gestao_ti.interacoes_pendencia`.
--
-- Contexto (14/05/2026): paridade com Chamado que mostra chip "anexo
-- removido" quando o anexo referenciado por um comentario foi excluido.
-- Pendencia usa FK (InteracaoPendencia 1-to-1 AnexoPendencia) em vez de
-- marcador `[anexo:uuid]` no texto, entao precisa de um campo persistente
-- pra lembrar que ali existia um anexo apos a exclusao do mesmo.
--
-- O service `removeAnexoPendencia` marca a flag pra true antes de deletar
-- o anexo, se este tiver `interacaoId` setado.
--
-- Idempotente via `IF NOT EXISTS`.

ALTER TABLE "gestao_ti"."interacoes_pendencia"
ADD COLUMN IF NOT EXISTS "anexo_removido" BOOLEAN NOT NULL DEFAULT false;
