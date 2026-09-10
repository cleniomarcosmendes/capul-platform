-- ============================================================================
-- CONFERÊNCIA do cadastro do piloto — rodar nos DOIS lados e comparar.
--
-- ⚠️ Contagem sozinha não prova nada: uma matrícula truncada continua contando 1.
-- Por isso vai também a SOMA DOS DÍGITOS das matrículas e o comprimento mínimo —
-- é o que denuncia zero à esquerda comido, que é o defeito silencioso do
-- transporte por planilha.
-- ============================================================================
select 'colaborador'                  tabela, count(*) linhas,
       min(length(matricula))         menor_matricula,
       sum(('x'||md5(matricula))::bit(32)::bigint) impressao
  from rh.colaborador
union all
select 'designacao_padrao', count(*), null, null from rh.designacao_padrao
union all
select 'designacao_padrao VIGENTE', count(*), null, null
  from rh.designacao_padrao where vigencia_fim is null
union all
select 'colaborador_treinamento', count(*), null, null from rh.colaborador_treinamento
union all
select 'colaborador_funcao_historico', count(*), null, null from rh.colaborador_funcao_historico
union all
select 'importacao_designacao', count(*), null, null from rh.importacao_designacao;

-- Os cinco avaliadores do piloto (recorte A) e o tamanho da fila de cada um.
-- ⚠️ Se algum vier com fila 0, o cadastro NÃO chegou inteiro — pare aqui.
select c.matricula, c.nome, count(d.id) fila
  from rh.colaborador c
  left join rh.designacao_padrao d
         on d.avaliador_id = c.id and d.vigencia_fim is null
 where c.matricula in ('003113','002749','003982','001277','001079')
 group by 1,2 order by fila desc;

-- ⚠️ `registrado_por_id` guarda o id de um usuário do DEV, que NÃO existe em
-- HLG (não há FK entre schemas, então copia calado). Isto mostra quantas linhas
-- ficam apontando para o vazio — decidir antes: reescrever para um usuário do
-- HLG, ou anular.
select count(*) filter (where registrado_por_id is not null) com_usuario_do_dev,
       count(*) total
  from rh.designacao_padrao;

-- ============================================================================
-- ⚠️ NENHUM AVALIADOR PODE ENCONTRAR RESPOSTA QUE NÃO DEU.
--
-- GUARDA DE DESTINO, não de transporte. O dump leva CINCO tabelas
-- (colaborador, importacao_designacao, designacao_padrao, colaborador_treinamento,
-- colaborador_funcao_historico) — `rh.avaliacao` e `rh.resposta` NÃO viajam.
-- Então isto não confere o que foi copiado: confere se o DESTINO está limpo.
--
-- Pega os três casos que o dump não cobre:
--   1. alguém acrescentar `avaliacao`/`resposta` à lista de TABELAS do exportador;
--   2. ensaio feito direto em HLG antes do dia 15 (foi o que aconteceu no DEV
--      em 10/09 — varredura de usabilidade escreveu no ciclo do piloto);
--   3. transporte reexecutado sobre uma base que já tinha ciclo montado.
--
-- ⚠️ O RECORTE É "CICLO NÃO ENCERRADO", e isso não é detalhe. Ciclo ENCERRADO
-- com avaliação enviada é história legítima — depois do piloto, o próprio
-- Piloto vira uma dessas. E desde 10/09 a fila do avaliador só mostra ciclo
-- ABERTO (`minhasAvaliacoes`), então é exatamente sobre o ciclo que ainda vai
-- rodar que a pergunta faz sentido. Sem este recorte, a conferência acusaria
-- para sempre no DEV — que guarda os ciclos de teste encerrados de propósito —
-- e alarme que sempre toca deixa de ser lido.
--
-- Rodar nos DOIS lados. Resultado esperado nos dois: ZERO linhas.
-- ============================================================================
select c.nome  ciclo,
       c.status ciclo_status,
       ado.nome avaliado,
       av.status,
       (select count(*) from rh.resposta r where r.avaliacao_id = av.id) respostas,
       av.enviada_em, av.reaberta_em, av.cancelada_em, av.nota_avaliacao
  from rh.avaliacao av
  join rh.ciclo c         on c.id   = av.ciclo_id
  join rh.colaborador ado on ado.id = av.avaliado_id
 where c.status <> 'ENCERRADO'
   and ( av.status <> 'PENDENTE'
      or av.enviada_em     is not null
      or av.reaberta_em    is not null
      or av.cancelada_em   is not null
      or av.nota_avaliacao is not null
      or exists (select 1 from rh.resposta r where r.avaliacao_id = av.id) )
 order by c.nome, respostas desc, ado.nome;
-- ✅ zero linhas = intocado.
-- 🔴 qualquer linha: PARE. Não libere o piloto antes de entender de onde veio.

-- E o mesmo pelo lado dos AGREGADOS, no mesmo recorte: em ciclo que ainda vai
-- rodar não pode haver resposta, resultado apurado, nem decisão manual de
-- elegibilidade — as três são rastro de ensaio.
select 'resposta'            o, count(*) n
  from rh.resposta r
  join rh.avaliacao av on av.id = r.avaliacao_id
  join rh.ciclo c      on c.id  = av.ciclo_id  where c.status <> 'ENCERRADO'
union all
select 'resultado_avaliacao', count(*)
  from rh.resultado_avaliacao ra
  join rh.ciclo c on c.id = ra.ciclo_id        where c.status <> 'ENCERRADO'
union all
select 'resultado_criterio',  count(*)
  from rh.resultado_criterio rc
  join rh.resultado_avaliacao ra on ra.id = rc.resultado_id
  join rh.ciclo c on c.id = ra.ciclo_id        where c.status <> 'ENCERRADO'
union all
select 'elegibilidade MANUAL_RH', count(*)
  from rh.ciclo_elegibilidade e
  join rh.ciclo c on c.id = e.ciclo_id
 where c.status <> 'ENCERRADO' and e.motivo = 'MANUAL_RH' and e.removido_em is null;
-- ✅ os quatro em zero antes do piloto começar.
