-- Whitelist de filiais para o CT-e Distribuição (07/05/2026)
--
-- Bug original: SincronizacaoFiliaisService roda a cada tick e re-ativa
-- TODOS os cursores em cte_controle_nsu cujo CNPJ esteja em core.filiais
-- com status=ATIVO. Resultado: nao da pra "habilitar so filial X" pra
-- testes graduais — o sync sobrescreve qualquer ativo=false manual.
--
-- Fix: campo de whitelist em ambiente_config que sobrevive ao sync.
--   - Vazio (default)  → processa todas (comportamento atual)
--   - Preenchido       → scheduler filtra cursors so dessas filiais
--
-- Codigo da filial (2 digitos), nao CNPJ — alinhado com core.filiais.codigo.
-- Permite ADMIN_TI listar via UI sem precisar consultar CNPJs.
--
-- Default vazio → backward-compatible (sem mudanca de comportamento ate
-- alguem preencher).

ALTER TABLE "fiscal"."ambiente_config"
  ADD COLUMN "cte_distribuicao_filiais_whitelist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
