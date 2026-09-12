-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPEZA DO ENSAIO INTEGRAL — escrita ANTES de o ensaio rodar (13/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⭐ Por que ANTES: escrever a limpeza depois é escrevê-la olhando o estrago, e
-- aí ela apaga o que se viu — não o que se produziu. Foi assim na varredura de
-- telas de 12/09, e funcionou.
--
-- ⚠️ Ela devolve o `ENSAIO PILOTO — 16 CCs` ao ESTADO DE PARTIDA registrado por
-- `dist/scripts/estado-de-partida.js`. Rode o script antes e depois da limpeza:
-- se os dois retratos baterem, a limpeza fechou.
--
-- ── COMO RODAR ──────────────────────────────────────────────────────────────
--
-- ⚠️ NO POWERSHELL (5.1): **não use `<`** — ele não tem redireção de entrada, e
-- o `|` dele REENCODA o texto (estragaria acentos). `docker cp` copia BYTES:
--
--   docker cp gestao-pessoas\scripts\limpar-ensaio-integral.sql capul-db:/tmp/limpar.sql
--   docker compose exec postgres psql -U capul_user -d capul_platform -f /tmp/limpar.sql
--   docker compose exec postgres rm /tmp/limpar.sql
--
-- (No bash/WSL: `docker compose exec -T postgres psql -U capul_user \
--  -d capul_platform < gestao-pessoas/scripts/limpar-ensaio-integral.sql`)
--
-- ⚠️ Ela é uma TRANSAÇÃO ÚNICA e imprime as contagens antes de confirmar. Se
-- algum número surpreender, dê ROLLBACK em vez de COMMIT.

BEGIN;

-- O alvo, uma vez só. ⚠️ Por NOME do ciclo, e nada mais: nunca por data, nunca
-- "tudo que foi criado hoje" — a regra que a limpeza de 12/09 estabeleceu.
CREATE TEMP TABLE alvo AS
  SELECT id AS ciclo_id FROM rh.ciclo WHERE nome = 'ENSAIO PILOTO — 16 CCs';

CREATE TEMP TABLE alvo_av AS
  SELECT a.id FROM rh.avaliacao a JOIN alvo ON a.ciclo_id = alvo.ciclo_id;

-- ── O QUE VAI SER APAGADO — conferir ANTES do commit ───────────────────────
SELECT 'respostas'            AS o_que, count(*) FROM rh.resposta            WHERE avaliacao_id IN (SELECT id FROM alvo_av)
UNION ALL SELECT 'resultados', count(*) FROM rh.resultado_avaliacao WHERE ciclo_id IN (SELECT ciclo_id FROM alvo)
UNION ALL SELECT 'criterios do resultado', count(*) FROM rh.resultado_criterio rc
            WHERE rc.resultado_id IN (SELECT id FROM rh.resultado_avaliacao WHERE ciclo_id IN (SELECT ciclo_id FROM alvo))
UNION ALL SELECT 'avaliacoes marcadas (envio/devolutiva/reabertura)', count(*) FROM rh.avaliacao
            WHERE id IN (SELECT id FROM alvo_av)
              AND (status <> 'PENDENTE' OR enviada_em IS NOT NULL OR nota_avaliacao IS NOT NULL
                   OR devolutiva_liberada_em IS NOT NULL OR devolutiva_conduzida_em IS NOT NULL
                   OR reaberta_em IS NOT NULL OR cancelada_em IS NOT NULL)
-- ⚠️ A PRÉVIA TEM DE TER O MESMO FILTRO DO DELETE. A primeira versão desta
--    linha esqueceu o escopo de entidade e anunciou **92** onde o DELETE fez 0 —
--    contava a auditoria do banco inteiro. Prévia que não é o ato é prévia que
--    mente, e é o defeito que o módulo já corrigiu na tela de público (07/09).
UNION ALL SELECT 'auditoria PRODUZIDA pelo ensaio (apaga)', count(*) FROM rh.auditoria
            WHERE (entidade_id IN (SELECT id FROM alvo_av)
                OR (entidade = 'Ciclo' AND entidade_id IN (SELECT ciclo_id FROM alvo)))
              AND (acao = ANY(ARRAY['ENVIAR','APURAR','REAPURAR','REABRIR','CANCELAR','DESCANCELAR',
                                    'LIBERAR_DEVOLUTIVA','DEVOLUTIVA_CONDUZIDA','DEVOLUTIVA_DESMARCADA',
                                    'ABRIR','ENCERRAR','NAO_E_MINHA_EQUIPE','LER_RESULTADO_INDIVIDUAL'])
                   OR acao LIKE 'ACESSO_%')
UNION ALL SELECT 'auditoria da MONTAGEM (preserva)', count(*) FROM rh.auditoria
            WHERE (entidade_id IN (SELECT id FROM alvo_av)
                OR (entidade = 'Ciclo' AND entidade_id IN (SELECT ciclo_id FROM alvo)))
              AND acao = ANY(ARRAY['DESIGNAR','CRIAR','MARCAR_RECORTE','PUBLICO_ADICIONAR',
                                   'COPIAR_DESIGNACAO_DO_CADASTRO','DECIDIR_EXCLUIR']);

-- ── 1. AS RESPOSTAS ────────────────────────────────────────────────────────
DELETE FROM rh.resposta WHERE avaliacao_id IN (SELECT id FROM alvo_av);

-- ── 2. AS APURAÇÕES (o critério do resultado sai junto pela FK) ────────────
DELETE FROM rh.resultado_criterio
 WHERE resultado_id IN (SELECT id FROM rh.resultado_avaliacao WHERE ciclo_id IN (SELECT ciclo_id FROM alvo));
DELETE FROM rh.resultado_avaliacao WHERE ciclo_id IN (SELECT ciclo_id FROM alvo);

-- ── 3. AS MARCAS NA AVALIAÇÃO — envio, devolutiva, reabertura, cancelamento ─
-- ⚠️ Volta a PENDENTE com nota NULA: é o estado de partida. O `avaliador_id` e o
-- `avaliado_id` NÃO são tocados — a designação é montagem, não produção do ensaio.
UPDATE rh.avaliacao SET
  status = 'PENDENTE',
  enviada_em = NULL,
  nota_avaliacao = NULL,
  observacao_avaliador = NULL,
  devolutiva_liberada_em = NULL,    devolutiva_liberada_por_id = NULL,
  devolutiva_conduzida_em = NULL,   devolutiva_conduzida_por_id = NULL,
  reaberta_em = NULL,               reaberta_por_id = NULL,  motivo_reabertura = NULL,
  cancelada_em = NULL,              cancelada_por_id = NULL, motivo_cancelamento = NULL,
  origem_cancelamento = NULL
 WHERE id IN (SELECT id FROM alvo_av);

-- ── 4. O CICLO volta a RASCUNHO ────────────────────────────────────────────
-- ⚠️ `eh_recorte` NÃO é tocado: é DECLARAÇÃO do Clenio (13/09), não produto do
-- ensaio. Apagá-la faria a limpeza desfazer uma decisão.
UPDATE rh.ciclo SET
  status = 'RASCUNHO', aberto_em = NULL, encerrado_em = NULL,
  reaberto_em = NULL, reaberto_por_id = NULL, motivo_reabertura = NULL
 WHERE id IN (SELECT ciclo_id FROM alvo);

-- ── 5. A AUDITORIA — só o que o ENSAIO PRODUZIU ────────────────────────────
--
-- ⚠️⚠️ POR AÇÃO **E** POR ENTIDADE, nunca só por entidade. A primeira versão
-- desta limpeza apagava tudo do ciclo, e o ensaio geral (com ROLLBACK) mostrou
-- que isso levaria junto **331 linhas de MONTAGEM** — 329 `DESIGNAR`, o `CRIAR`
-- do ciclo e o `MARCAR_RECORTE` que o Clenio declarou.
--
-- ⭐ O rastro de COMO O ENSAIO FOI MONTADO é justamente o que não pode sumir:
-- ele é a resposta a "quem designou quem, e quando" — pergunta que sobrevive ao
-- ensaio. **Nunca por data**, e agora nem só por entidade.
DELETE FROM rh.auditoria
 WHERE (entidade_id IN (SELECT id FROM alvo_av)
     OR (entidade = 'Ciclo' AND entidade_id IN (SELECT ciclo_id FROM alvo)))
   AND (acao = ANY(ARRAY['ENVIAR','APURAR','REAPURAR','REABRIR','CANCELAR','DESCANCELAR',
                         'LIBERAR_DEVOLUTIVA','DEVOLUTIVA_CONDUZIDA','DEVOLUTIVA_DESMARCADA',
                         'ABRIR','ENCERRAR','NAO_E_MINHA_EQUIPE','LER_RESULTADO_INDIVIDUAL'])
        OR acao LIKE 'ACESSO_%');

-- ── A CONFERÊNCIA — tem de sair tudo zero, menos as avaliações ─────────────
SELECT 'respostas restantes'      AS conferencia, count(*) FROM rh.resposta WHERE avaliacao_id IN (SELECT id FROM alvo_av)
UNION ALL SELECT 'resultados restantes', count(*) FROM rh.resultado_avaliacao WHERE ciclo_id IN (SELECT ciclo_id FROM alvo)
UNION ALL SELECT 'marcas restantes', count(*) FROM rh.avaliacao
            WHERE id IN (SELECT id FROM alvo_av) AND (status <> 'PENDENTE' OR enviada_em IS NOT NULL
              OR devolutiva_liberada_em IS NOT NULL OR devolutiva_conduzida_em IS NOT NULL)
UNION ALL SELECT 'auditoria de PRODUÇÃO restante (0)', count(*) FROM rh.auditoria
            WHERE (entidade_id IN (SELECT id FROM alvo_av) OR (entidade='Ciclo' AND entidade_id IN (SELECT ciclo_id FROM alvo)))
              AND (acao LIKE 'ACESSO_%' OR acao = ANY(ARRAY['ENVIAR','APURAR','REAPURAR','REABRIR',
                   'LIBERAR_DEVOLUTIVA','DEVOLUTIVA_CONDUZIDA','DEVOLUTIVA_DESMARCADA','ABRIR','ENCERRAR']))
UNION ALL SELECT '>>> auditoria da MONTAGEM (deve continuar 331)', count(*) FROM rh.auditoria
            WHERE (entidade_id IN (SELECT id FROM alvo_av) OR (entidade='Ciclo' AND entidade_id IN (SELECT ciclo_id FROM alvo)))
              AND acao = ANY(ARRAY['DESIGNAR','CRIAR','MARCAR_RECORTE','PUBLICO_ADICIONAR'])
UNION ALL SELECT '>>> AVALIACOES (deve continuar 325)', count(*) FROM alvo_av
UNION ALL SELECT '>>> PUBLICO (deve continuar 344)', count(DISTINCT colaborador_id) FROM rh.aplicacao_publico
            WHERE ciclo_id IN (SELECT ciclo_id FROM alvo);

-- ⚠️ CONFIRA OS NÚMEROS ACIMA E ENTÃO:
COMMIT;
-- ou: ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⛔ O QUE ESTA LIMPEZA **NÃO** APAGA, E POR QUÊ
-- ═══════════════════════════════════════════════════════════════════════════
--
--  1. AS 325 AVALIAÇÕES e o PÚBLICO (344). São a MONTAGEM do ensaio, não o
--     produto dele. Apagá-las obrigaria a remontar o recorte inteiro, e o
--     recorte custou uma medição de 16 centros de custo.
--
--  2. A DESIGNAÇÃO (`avaliador_id`). Mesma razão: quem julga quem foi decidido
--     antes do ensaio.
--
--  3. `ciclo.eh_recorte`. É DECLARAÇÃO do Clenio, não produto do ensaio.
--
--  4. O INSTRUMENTO — modelos, versões, arranjos, classificações, perguntas.
--     O ensaio não os altera; se alterou, é achado e não deve ser apagado.
--
--  5. OS CRITÉRIOS e a RÉGUA DE CONCEITOS do ciclo. Idem.
--
--  6. AS CONTAS de `core.usuarios` e as PERMISSÕES. O ensaio usa; não cria.
--
--  7a. ⚠️⚠️ A AUDITORIA DA **MONTAGEM** do próprio ENSAIO — 329 `DESIGNAR`, o
--     `CRIAR` e o `MARCAR_RECORTE`. São a resposta a *"quem designou quem, e
--     quando"*, e essa pergunta sobrevive ao ensaio. A primeira versão desta
--     limpeza as apagava; o ensaio geral com ROLLBACK é que mostrou.
--
--  7. ⚠️ A AUDITORIA DE **OUTROS** CICLOS. O filtro é por `entidade_id` do
--     ENSAIO — o Piloto 15/09, o SIMULACAO e o resto ficam intactos. **Nunca
--     apagar auditoria por DATA**: foi a regra que salvou a limpeza de 12/09.
--
--  8. `rh.colaborador`, `rh.cargo`, treinamentos e histórico funcional. São do
--     sync do Protheus, e o ensaio é somente leitura sobre eles.
--
-- ⚠️ E o que ela NÃO CONSEGUE desfazer: e-mail enviado (não há), e a memória de
-- quem participou. Se a skill rodar com contas de pessoas reais, o rastro nas
-- filas delas existiu — por isso o ensaio roda com as contas `zz.teste.*` onde
-- for possível.
