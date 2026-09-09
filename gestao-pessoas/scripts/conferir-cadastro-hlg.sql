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
