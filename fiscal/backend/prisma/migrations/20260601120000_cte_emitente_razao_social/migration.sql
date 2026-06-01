-- Migration 01/06/2026: busca de CT-e Recebidos por Razão Social da
-- transportadora (pedido do setor Fiscal).
--
-- A Capul é tomadora/destinatária do CT-e — o "fornecedor" aqui é a
-- transportadora = EMITENTE do documento (<emit><xNome>). Até agora só dava
-- pra filtrar por CNPJ do transportador (substring no XML). O setor pediu
-- digitar PARTE DO NOME pra triar.
--
-- Abordagem robusta (vs. substring crua no XML): coluna dedicada extraída na
-- ingestão + índice GIN pg_trgm acelerando ILIKE '%termo%' (mesmo padrão dos
-- índices trigram de Gestão TI / schema rfb). Precisa (só o emitente),
-- case-insensitive e indexado (escala conforme a base cresce).
--
-- Additive e idempotente. Sem dependência nova (pg_trgm é nativo do Postgres).

ALTER TABLE "fiscal"."cte_documento"
  ADD COLUMN IF NOT EXISTS "emitente_razao_social" VARCHAR(120);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Backfill dos CT-es JÁ recebidos: extrai o <emit><xNome> do XML preservado.
-- Regex POSIX não-gulosa captura o PRIMEIRO <xNome> dentro do bloco <emit>
-- (= razão social do emitente/transportadora). Decodifica entidades XML
-- comuns (&amp; por último) p/ alinhar com o valor que o parser grava daqui
-- pra frente. resCTe (resumo, sem <emit>) não casa → permanece NULL.
-- Idempotente: só toca linhas ainda NULL.
UPDATE "fiscal"."cte_documento"
SET "emitente_razao_social" = LEFT(
  NULLIF(
    TRIM(
      replace(
        replace(
          replace(
            replace(
              replace(
                substring("xml" FROM '<emit>.*?<xNome>(.*?)</xNome>'),
              '&lt;', '<'),
            '&gt;', '>'),
          '&quot;', '"'),
        '&#39;', ''''),
      '&amp;', '&')
    ),
  ''),
120)
WHERE "emitente_razao_social" IS NULL
  AND "xml" LIKE '%<emit>%';

-- Índice trigram p/ acelerar `emitente_razao_social ILIKE '%termo%'`
-- (Prisma: { contains, mode: 'insensitive' }).
CREATE INDEX IF NOT EXISTS "cte_documento_emitente_razao_social_trgm_idx"
  ON "fiscal"."cte_documento" USING gin ("emitente_razao_social" gin_trgm_ops);
