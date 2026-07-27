-- Amarração EXPLÍCITA de quem é o Supervisor de Departamento (RDV) por departamento.
--
-- Antes o escopo do SUPERVISOR_FROTA no RDV era derivado dos veículos que ele
-- supervisiona (`veiculo.supervisor_id` + `departamento_lotacao_id`). Aquele campo
-- existe para dizer quem responde pelo VEÍCULO (controle de frota) — usá-lo como
-- fonte de autoridade sobre prestação de contas era acoplamento acidental, e falhava
-- em silêncio: sem veículo vinculado, o supervisor perdia o RDV do departamento sem
-- nenhum aviso. A FROTA continua usando `veiculo.supervisor_id` (lá está correto).

-- CreateTable
CREATE TABLE "logistica"."supervisor_departamento" (
    "id" TEXT NOT NULL,
    "filial_id" TEXT NOT NULL,
    "departamento_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por_id" TEXT NOT NULL,

    CONSTRAINT "supervisor_departamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supervisor_departamento_usuario_id_idx" ON "logistica"."supervisor_departamento"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_departamento_filial_id_departamento_id_key" ON "logistica"."supervisor_departamento"("filial_id", "departamento_id");

-- Backfill: preserva EXATAMENTE a autoridade que já existia, copiando o mapeamento
-- derivado dos veículos. Sem isto, todo Supervisor de Departamento perderia o RDV no
-- deploy.
--
-- Só os departamentos com UM único supervisor entre seus veículos. Departamento com
-- DOIS supervisores diferentes fica de fora DE PROPÓSITO: a tabela admite um
-- responsável, e escolher um deles aqui seria conceder autoridade sobre prestação de
-- contas no chute. Esses casos aparecem vazios na aba Equipe › Supervisores de
-- Departamento e precisam ser definidos à mão (falha fechada, não aberta).
INSERT INTO "logistica"."supervisor_departamento" (id, filial_id, departamento_id, usuario_id, criado_por_id)
SELECT gen_random_uuid(), t.filial_id, t.departamento_lotacao_id, MIN(t.supervisor_id), 'BACKFILL_20260727180000'
FROM (
  SELECT DISTINCT filial_id, departamento_lotacao_id, supervisor_id
  FROM "logistica"."veiculo"
  WHERE supervisor_id IS NOT NULL AND departamento_lotacao_id IS NOT NULL
) t
GROUP BY t.filial_id, t.departamento_lotacao_id
HAVING COUNT(DISTINCT t.supervisor_id) = 1;
