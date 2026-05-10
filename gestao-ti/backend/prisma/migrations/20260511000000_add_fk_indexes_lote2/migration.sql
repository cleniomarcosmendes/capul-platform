-- Auditoria 10/05/2026 #A1 (Performance) — Sub-lote 2: ~50 indices restantes
--
-- Continuação do lote prioritário (12 indices em chamados/historicos/projetos
-- aplicado em 20260510140000). Este lote cobre tabelas que tambem aparecem em
-- listas com filtros e fariam JOIN/CASCADE via FK sem indice.

-- gestao_ti.notas_fiscais (NF de compras)
CREATE INDEX IF NOT EXISTS notas_fiscais_criado_por_id_idx ON gestao_ti.notas_fiscais(criado_por_id);

-- gestao_ti.anexos_*  (uploads em chamados/projetos/paradas/NFs/conhecimento/pendencias)
CREATE INDEX IF NOT EXISTS anexos_nota_fiscal_usuario_id_idx ON gestao_ti.anexos_nota_fiscal(usuario_id);
CREATE INDEX IF NOT EXISTS anexos_parada_usuario_id_idx ON gestao_ti.anexos_parada(usuario_id);
CREATE INDEX IF NOT EXISTS anexos_chamado_usuario_id_idx ON gestao_ti.anexos_chamado(usuario_id);
CREATE INDEX IF NOT EXISTS anexos_projeto_usuario_id_idx ON gestao_ti.anexos_projeto(usuario_id);
CREATE INDEX IF NOT EXISTS anexos_pendencia_usuario_id_idx ON gestao_ti.anexos_pendencia(usuario_id);
CREATE INDEX IF NOT EXISTS anexos_conhecimento_usuario_id_idx ON gestao_ti.anexos_conhecimento(usuario_id);

-- gestao_ti.parada_historico
CREATE INDEX IF NOT EXISTS parada_historico_usuario_id_idx ON gestao_ti.parada_historico(usuario_id);

-- gestao_ti.ordens_servico (3 FKs hot)
CREATE INDEX IF NOT EXISTS ordens_servico_solicitante_id_idx ON gestao_ti.ordens_servico(solicitante_id);
CREATE INDEX IF NOT EXISTS ordens_servico_filial_id_idx ON gestao_ti.ordens_servico(filial_id);
CREATE INDEX IF NOT EXISTS historicos_ordem_servico_usuario_id_idx ON gestao_ti.historicos_ordem_servico(usuario_id);

-- gestao_ti.softwares
CREATE INDEX IF NOT EXISTS softwares_equipe_responsavel_id_idx ON gestao_ti.softwares(equipe_responsavel_id);

-- gestao_ti.software_licencas
CREATE INDEX IF NOT EXISTS software_licencas_contrato_id_idx ON gestao_ti.software_licencas(contrato_id);
CREATE INDEX IF NOT EXISTS software_licencas_categoria_id_idx ON gestao_ti.software_licencas(categoria_id);

-- gestao_ti.contratos (relatorios + renovacoes)
CREATE INDEX IF NOT EXISTS contratos_produto_id_idx ON gestao_ti.contratos(produto_id);
CREATE INDEX IF NOT EXISTS contratos_contrato_original_id_idx ON gestao_ti.contratos(contrato_original_id);
CREATE INDEX IF NOT EXISTS contratos_fornecedor_id_idx ON gestao_ti.contratos(fornecedor_id);
CREATE INDEX IF NOT EXISTS contrato_historicos_usuario_id_idx ON gestao_ti.contrato_historicos(usuario_id);
CREATE INDEX IF NOT EXISTS contrato_renovacoes_contrato_anterior_id_idx ON gestao_ti.contrato_renovacoes(contrato_anterior_id);
CREATE INDEX IF NOT EXISTS contrato_renovacoes_contrato_novo_id_idx ON gestao_ti.contrato_renovacoes(contrato_novo_id);

-- gestao_ti.registros_parada (5 FKs)
CREATE INDEX IF NOT EXISTS registros_parada_finalizado_por_id_idx ON gestao_ti.registros_parada(finalizado_por_id);
CREATE INDEX IF NOT EXISTS registros_parada_reaberta_por_id_idx ON gestao_ti.registros_parada(reaberta_por_id);
CREATE INDEX IF NOT EXISTS registros_parada_motivo_parada_id_idx ON gestao_ti.registros_parada(motivo_parada_id);
CREATE INDEX IF NOT EXISTS registros_parada_software_modulo_id_idx ON gestao_ti.registros_parada(software_modulo_id);
CREATE INDEX IF NOT EXISTS registros_parada_registrado_por_id_idx ON gestao_ti.registros_parada(registrado_por_id);

-- gestao_ti.projetos (3 FKs adicionais alem do lote 1)
CREATE INDEX IF NOT EXISTS projetos_contrato_id_idx ON gestao_ti.projetos(contrato_id);

-- gestao_ti.atividades_projeto + relacionados
CREATE INDEX IF NOT EXISTS atividades_projeto_fase_id_idx ON gestao_ti.atividades_projeto(fase_id);
CREATE INDEX IF NOT EXISTS atividades_projeto_usuario_id_idx ON gestao_ti.atividades_projeto(usuario_id);
CREATE INDEX IF NOT EXISTS riscos_projeto_responsavel_id_idx ON gestao_ti.riscos_projeto(responsavel_id);
CREATE INDEX IF NOT EXISTS apontamentos_horas_fase_id_idx ON gestao_ti.apontamentos_horas(fase_id);
CREATE INDEX IF NOT EXISTS pendencias_projeto_criador_id_idx ON gestao_ti.pendencias_projeto(criador_id);
CREATE INDEX IF NOT EXISTS pendencias_projeto_fase_id_idx ON gestao_ti.pendencias_projeto(fase_id);
CREATE INDEX IF NOT EXISTS interacoes_pendencia_usuario_id_idx ON gestao_ti.interacoes_pendencia(usuario_id);
CREATE INDEX IF NOT EXISTS comentarios_tarefa_usuario_id_idx ON gestao_ti.comentarios_tarefa(usuario_id);

-- gestao_ti.ativos
CREATE INDEX IF NOT EXISTS ativos_responsavel_id_idx ON gestao_ti.ativos(responsavel_id);
CREATE INDEX IF NOT EXISTS ativos_departamento_id_idx ON gestao_ti.ativos(departamento_id);

-- gestao_ti.artigos_conhecimento
CREATE INDEX IF NOT EXISTS artigos_conhecimento_equipe_ti_id_idx ON gestao_ti.artigos_conhecimento(equipe_ti_id);

-- gestao_ti.rateio_template_itens / parcela_rateio_itens
CREATE INDEX IF NOT EXISTS rateio_template_itens_natureza_id_idx ON gestao_ti.rateio_template_itens(natureza_id);
CREATE INDEX IF NOT EXISTS parcela_rateio_itens_natureza_id_idx ON gestao_ti.parcela_rateio_itens(natureza_id);

-- gestao_ti.produtos
CREATE INDEX IF NOT EXISTS produtos_tipo_produto_id_idx ON gestao_ti.produtos(tipo_produto_id);

-- core.departamentos
CREATE INDEX IF NOT EXISTS departamentos_filial_id_idx ON core.departamentos(filial_id);
