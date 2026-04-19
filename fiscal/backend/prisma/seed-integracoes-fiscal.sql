-- Seed dos endpoints Protheus consumidos pelo Módulo Fiscal.
-- Idempotente: ON CONFLICT DO NOTHING baseado no UNIQUE (integracao_id, ambiente, operacao).
--
-- Operações cadastradas:
--   cadastroFiscal  — GET  — lista/consulta SA1010/SA2010 (contrato recebido 17/04/2026)
--   eventosNfe      — GET  — timeline SPED150/SPED156/SZR010/SF1010 (recebido 18/04/2026)
--   grvXML          — POST — grava SZR010 + SZQ010 (recebido 18/04/2026)
--
-- URLs seguem o padrão dos endpoints já cadastrados:
--   HOMOLOGACAO: https://192.168.7.63:8115/rest/api/INFOCLIENTES/FISCAL/<operacao>
--   PRODUCAO:    https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/FISCAL/<operacao>

DO $$
DECLARE
  v_integracao_id text;
BEGIN
  SELECT id INTO v_integracao_id FROM core.integracoes_api WHERE codigo = 'PROTHEUS';
  IF v_integracao_id IS NULL THEN
    RAISE EXCEPTION 'Integracao PROTHEUS nao encontrada em core.integracoes_api';
  END IF;

  -- cadastroFiscal (HOM + PROD)
  INSERT INTO core.integracoes_api_endpoints (id, integracao_id, ambiente, operacao, descricao, url, metodo, timeout_ms, ativo, created_at, updated_at)
  VALUES
    (gen_random_uuid()::text, v_integracao_id, 'HOMOLOGACAO', 'cadastroFiscal',
     'Cadastro fiscal SA1010/SA2010 — lista paginada e consulta por CNPJ (contrato 17/04/2026)',
     'https://192.168.7.63:8115/rest/api/INFOCLIENTES/FISCAL/cadastroFiscal',
     'GET', 30000, true, NOW(), NOW())
  ON CONFLICT (integracao_id, ambiente, operacao) DO NOTHING;

  INSERT INTO core.integracoes_api_endpoints (id, integracao_id, ambiente, operacao, descricao, url, metodo, timeout_ms, ativo, created_at, updated_at)
  VALUES
    (gen_random_uuid()::text, v_integracao_id, 'PRODUCAO', 'cadastroFiscal',
     'Cadastro fiscal SA1010/SA2010 — lista paginada e consulta por CNPJ (contrato 17/04/2026)',
     'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/FISCAL/cadastroFiscal',
     'GET', 30000, true, NOW(), NOW())
  ON CONFLICT (integracao_id, ambiente, operacao) DO NOTHING;

  -- eventosNfe (HOM + PROD)
  INSERT INTO core.integracoes_api_endpoints (id, integracao_id, ambiente, operacao, descricao, url, metodo, timeout_ms, ativo, created_at, updated_at)
  VALUES
    (gen_random_uuid()::text, v_integracao_id, 'HOMOLOGACAO', 'eventosNfe',
     'Timeline de eventos NF-e (SPED150/SPED156/SZR010/SF1010) por chave — contrato 18/04/2026',
     'https://192.168.7.63:8115/rest/api/INFOCLIENTES/FISCAL/eventosNfe',
     'GET', 30000, true, NOW(), NOW())
  ON CONFLICT (integracao_id, ambiente, operacao) DO NOTHING;

  INSERT INTO core.integracoes_api_endpoints (id, integracao_id, ambiente, operacao, descricao, url, metodo, timeout_ms, ativo, created_at, updated_at)
  VALUES
    (gen_random_uuid()::text, v_integracao_id, 'PRODUCAO', 'eventosNfe',
     'Timeline de eventos NF-e (SPED150/SPED156/SZR010/SF1010) por chave — contrato 18/04/2026',
     'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/FISCAL/eventosNfe',
     'GET', 30000, true, NOW(), NOW())
  ON CONFLICT (integracao_id, ambiente, operacao) DO NOTHING;

  -- grvXML (HOM + PROD)
  INSERT INTO core.integracoes_api_endpoints (id, integracao_id, ambiente, operacao, descricao, url, metodo, timeout_ms, ativo, created_at, updated_at)
  VALUES
    (gen_random_uuid()::text, v_integracao_id, 'HOMOLOGACAO', 'grvXML',
     'Gravação SZR010 (cabeçalho) + SZQ010 (itens) a partir de XML base64 — contrato 18/04/2026',
     'https://192.168.7.63:8115/rest/api/INFOCLIENTES/FISCAL/grvXML',
     'POST', 30000, true, NOW(), NOW())
  ON CONFLICT (integracao_id, ambiente, operacao) DO NOTHING;

  INSERT INTO core.integracoes_api_endpoints (id, integracao_id, ambiente, operacao, descricao, url, metodo, timeout_ms, ativo, created_at, updated_at)
  VALUES
    (gen_random_uuid()::text, v_integracao_id, 'PRODUCAO', 'grvXML',
     'Gravação SZR010 (cabeçalho) + SZQ010 (itens) a partir de XML base64 — contrato 18/04/2026',
     'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/FISCAL/grvXML',
     'POST', 30000, true, NOW(), NOW())
  ON CONFLICT (integracao_id, ambiente, operacao) DO NOTHING;

  RAISE NOTICE 'Seed de endpoints fiscais concluido.';
END;
$$;
