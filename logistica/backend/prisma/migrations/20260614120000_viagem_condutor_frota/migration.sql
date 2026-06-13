-- Frota (Fase 2): condutor da viagem de frota = funcionário validado no Protheus
-- (matrícula+senha), não usuário do sistema. Aditivo.
ALTER TABLE "logistica"."viagem" ADD COLUMN "condutor_matricula" TEXT;
ALTER TABLE "logistica"."viagem" ADD COLUMN "condutor_nome" TEXT;
