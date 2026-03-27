-- AddColumns: matricula e nome do colaborador real (usuario padrao)
ALTER TABLE gestao_ti.chamados
    ADD COLUMN IF NOT EXISTS matricula_colaborador VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nome_colaborador VARCHAR(100);
