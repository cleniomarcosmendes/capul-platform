-- ============================================================================
-- BACKFILL — as aplicacoes que ja existiam ganham publico NOMINAL.
--
-- `designacao.listar()` passa a ler o publico de `aplicacao_publico` em vez de
-- derivar dos centros de custo. Sem este backfill, toda aplicacao criada antes
-- da virada ficaria com publico VAZIO — e as avaliacoes ja enviadas sairiam de
-- todas as contagens do painel sem que nada acusasse. E exatamente a familia
-- de defeito que o modulo existe para eliminar.
--
-- ⚠️ A alternativa — `listar()` cair no recorte por CC quando nao houvesse
-- publico — foi recusada: seria uma SEGUNDA fonte da verdade para "quem esta
-- na aplicacao", e as duas divergiriam no primeiro ajuste manual.
--
-- `aplicacao_centro_custo` NAO e apagada. Ela deixa de decidir o publico e
-- passa a ser o registro do atalho que foi usado para preenche-lo — que e o
-- que `origem` + `origem_referencia` dizem em cada linha nova.
--
-- Reexecucao segura: o WHERE NOT EXISTS e o unique (ciclo, colaborador)
-- garantem que rodar de novo nao duplica nem sobrescreve ajuste manual.
-- ============================================================================

INSERT INTO "rh"."aplicacao_publico"
    ("id", "aplicacao_id", "ciclo_id", "colaborador_id", "origem", "origem_referencia", "criado_em")
SELECT
    gen_random_uuid()::text,
    a."id",
    a."ciclo_id",
    c."id",
    'CENTRO_CUSTO'::"rh"."OrigemVinculo",
    -- Guarda o atalho como a tela passa a gravar: filial|CC quando o recorte
    -- tinha filial, so o CC quando valia para todas.
    CASE WHEN acc."filial" IS NULL THEN acc."centro_custo"
         ELSE acc."filial" || '|' || acc."centro_custo" END,
    now()
FROM "rh"."aplicacao" a
JOIN "rh"."aplicacao_centro_custo" acc ON acc."aplicacao_id" = a."id"
JOIN "rh"."colaborador" c
  ON c."centro_custo" = acc."centro_custo"
 -- filial NULL no recorte antigo significava "qualquer filial deste CC".
 AND (acc."filial" IS NULL OR c."filial" = acc."filial")
 AND c."situacao" IN ('ATIVO', 'AFASTADO', 'FERIAS')
WHERE NOT EXISTS (
    SELECT 1 FROM "rh"."aplicacao_publico" ap
    WHERE ap."ciclo_id" = a."ciclo_id" AND ap."colaborador_id" = c."id"
);

-- Ninguem que ja tem avaliacao no ciclo pode ter ficado de fora do publico: a
-- avaliacao existe, a pessoa responderia, e o painel a perderia de vista.
-- Cobre tambem quem entrou por designacao MANUAL, fora do recorte por CC.
INSERT INTO "rh"."aplicacao_publico"
    ("id", "aplicacao_id", "ciclo_id", "colaborador_id", "origem", "origem_referencia", "criado_em")
SELECT gen_random_uuid()::text, av."aplicacao_id", av."ciclo_id", av."avaliado_id",
       'MANUAL'::"rh"."OrigemVinculo", 'backfill: tinha avaliacao sem publico', now()
FROM "rh"."avaliacao" av
WHERE NOT EXISTS (
    SELECT 1 FROM "rh"."aplicacao_publico" ap
    WHERE ap."ciclo_id" = av."ciclo_id" AND ap."colaborador_id" = av."avaliado_id"
);
