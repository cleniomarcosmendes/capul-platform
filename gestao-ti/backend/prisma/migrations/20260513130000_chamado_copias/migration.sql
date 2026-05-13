-- Cria gestao_ti.chamado_copias: usuarios "em copia" no chamado.
--
-- Decidido em 13/05/2026: feature "Em copia" para que solicitantes
-- envolvam outros usuarios (nao-T.I.) no chamado, sem que estes virem
-- "colaboradores" (conceito T.I.-only). Copiados tem papel de
-- solicitante: leem detalhes, recebem notificacoes em todos os eventos
-- (criacao, comentario, transferencia, resolucao, fechamento) e podem
-- comentar.
--
-- Restricao de negocio (validada no service): nao pode adicionar membro
-- ativo de EquipeTI em copia — impediria contornar designacao do tecnico.
--
-- Unique (chamado_id, usuario_id): cada usuario aparece uma vez por chamado.

CREATE TABLE "gestao_ti"."chamado_copias" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamado_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "adicionado_por_id" TEXT,

    CONSTRAINT "chamado_copias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chamado_copias_chamado_id_usuario_id_key"
    ON "gestao_ti"."chamado_copias"("chamado_id", "usuario_id");

CREATE INDEX "chamado_copias_usuario_id_idx"
    ON "gestao_ti"."chamado_copias"("usuario_id");

ALTER TABLE "gestao_ti"."chamado_copias"
    ADD CONSTRAINT "chamado_copias_chamado_id_fkey"
    FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gestao_ti"."chamado_copias"
    ADD CONSTRAINT "chamado_copias_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "gestao_ti"."chamado_copias"
    ADD CONSTRAINT "chamado_copias_adicionado_por_id_fkey"
    FOREIGN KEY ("adicionado_por_id") REFERENCES "core"."usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
