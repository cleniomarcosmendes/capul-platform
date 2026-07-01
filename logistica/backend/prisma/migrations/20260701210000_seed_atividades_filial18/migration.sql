-- Seed das 10 atividades de visita da Indústria de Ração (Filial 18), idêntico à
-- planilha "Visitas Maio" (fonte do dropdown), sem o '*' de legenda. Idempotente
-- (ON CONFLICT) e editável depois pela tela (Supervisores). Busca a filial por
-- CÓDIGO ('18') — robusto entre ambientes; se não achar, não insere nada.
INSERT INTO "logistica"."atividade_visita" ("id", "nome", "filial_id", "ativo")
SELECT gen_random_uuid(), a.nome, f.id, true
FROM (VALUES
  ('COLETA PEDIDO/LOGISTICA'),
  ('NEGOCIAÇÃO/PROSPECÇÃO'),
  ('PARECER ANALISE CREDITO/CADASTRO'),
  ('PARTICIPAÇÃO EVENTOS'),
  ('PLANEJAMENTO/PROPOSTA COMERCIAL'),
  ('POS VENDA/VISITA TECNICA'),
  ('SAC'),
  ('TREINAMENTO'),
  ('VENDA EFETUADA'),
  ('OUTRO')
) AS a(nome)
CROSS JOIN (SELECT id FROM "core"."filiais" WHERE codigo = '18' LIMIT 1) f
ON CONFLICT ("filial_id", "nome") DO NOTHING;
