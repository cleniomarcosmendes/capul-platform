-- Auditoria 10/05/2026 #A1 (Performance) — Lote prioritario: 12 indices em FKs hot path
--
-- Foreign keys nao recebem indice automatico no PostgreSQL (diferente de PK).
-- Sem indice, JOIN ou DELETE em CASCADE faz seq scan da tabela inteira.
-- Em produção há ~1 ano, isso já está custando latência em queries de lista
-- com filtros. Lote prioritario foca nos hot paths do Gestao TI:
--   - chamados (modulo principal, ~hundreds de rows)
--   - historicos_chamado (timeline de cada chamado)
--   - projetos (relatorios)
--
-- Todas as tabelas tem volumetria pequena hoje, lock de CREATE INDEX e' instantaneo.
-- IF NOT EXISTS torna idempotente (seguro re-rodar).

-- gestao_ti.chamados — 7 FKs sem indice
CREATE INDEX IF NOT EXISTS chamados_filial_id_idx ON gestao_ti.chamados(filial_id);
CREATE INDEX IF NOT EXISTS chamados_departamento_id_idx ON gestao_ti.chamados(departamento_id);
CREATE INDEX IF NOT EXISTS chamados_projeto_id_idx ON gestao_ti.chamados(projeto_id);
CREATE INDEX IF NOT EXISTS chamados_software_id_idx ON gestao_ti.chamados(software_id);
CREATE INDEX IF NOT EXISTS chamados_software_modulo_id_idx ON gestao_ti.chamados(software_modulo_id);
CREATE INDEX IF NOT EXISTS chamados_catalogo_servico_id_idx ON gestao_ti.chamados(catalogo_servico_id);
CREATE INDEX IF NOT EXISTS chamados_sla_definicao_id_idx ON gestao_ti.chamados(sla_definicao_id);

-- gestao_ti.historicos_chamado — 3 FKs (timeline de chamado)
CREATE INDEX IF NOT EXISTS historicos_chamado_usuario_id_idx ON gestao_ti.historicos_chamado(usuario_id);
CREATE INDEX IF NOT EXISTS historicos_chamado_equipe_origem_id_idx ON gestao_ti.historicos_chamado(equipe_origem_id);
CREATE INDEX IF NOT EXISTS historicos_chamado_equipe_destino_id_idx ON gestao_ti.historicos_chamado(equipe_destino_id);

-- gestao_ti.projetos — 2 FKs (relatorio de projeto)
CREATE INDEX IF NOT EXISTS projetos_responsavel_id_idx ON gestao_ti.projetos(responsavel_id);
CREATE INDEX IF NOT EXISTS projetos_tipo_projeto_id_idx ON gestao_ti.projetos(tipo_projeto_id);
