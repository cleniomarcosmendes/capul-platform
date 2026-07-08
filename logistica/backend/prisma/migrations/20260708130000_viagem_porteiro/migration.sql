-- Fase 1b (portaria): registra QUAL porteiro operou a SAÍDA e o RETORNO pela
-- portaria. O motorista continua em condutor_matricula/nome; estes campos são o
-- funcionário da PORTARIA (identificado por matrícula+senha do Protheus).
-- Aditivo: colunas nulas.
ALTER TABLE "logistica"."viagem"
  ADD COLUMN "porteiro_saida_matricula" TEXT,
  ADD COLUMN "porteiro_saida_nome" TEXT,
  ADD COLUMN "porteiro_retorno_matricula" TEXT,
  ADD COLUMN "porteiro_retorno_nome" TEXT;
