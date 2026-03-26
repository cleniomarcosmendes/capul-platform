-- CreateTable
CREATE TABLE IF NOT EXISTS gestao_ti.atividade_responsaveis (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atividade_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,

    CONSTRAINT atividade_responsaveis_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS atividade_responsaveis_atividade_id_usuario_id_key
    ON gestao_ti.atividade_responsaveis(atividade_id, usuario_id);

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE gestao_ti.atividade_responsaveis
        ADD CONSTRAINT atividade_responsaveis_atividade_id_fkey
        FOREIGN KEY (atividade_id) REFERENCES gestao_ti.atividades_projeto(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE gestao_ti.atividade_responsaveis
        ADD CONSTRAINT atividade_responsaveis_usuario_id_fkey
        FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
