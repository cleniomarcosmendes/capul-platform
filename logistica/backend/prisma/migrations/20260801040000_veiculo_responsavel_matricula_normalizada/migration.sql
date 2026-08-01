-- Normaliza a matrícula do REPRESENTANTE responsável pelo veículo para a chapa
-- E+5 dígitos, a mesma forma que o RDV e a frota usam para comparar matrícula.
--
-- O campo era texto livre sem validação, então convivem formatos diferentes para o
-- mesmo dado (no DEV: 'E02336' em um veículo e '005274' em outro). Isso era inócuo
-- enquanto o campo só documentava quem ficava com o carro; passou a importar quando
-- ele virou a origem da SUGESTÃO de veículo do planejamento do RDV — casar por texto
-- cru faria a sugestão não aparecer para quem foi cadastrado no outro formato.
--
-- Só reescreve o que tem dígito: matrícula sem nenhum número (lixo de digitação)
-- fica como está para não virar 'E00000' e casar com quem não deve.
UPDATE "logistica"."veiculo"
   SET "supervisor_area_matricula" =
       'E' || LPAD(RIGHT(REGEXP_REPLACE("supervisor_area_matricula", '\D', '', 'g'), 5), 5, '0')
 WHERE "supervisor_area_matricula" IS NOT NULL
   AND REGEXP_REPLACE("supervisor_area_matricula", '\D', '', 'g') <> '';

-- O HISTÓRICO de troca (veiculo_supervisor_area_historico) fica INTOCADO de propósito:
-- ele registra o que foi digitado na época, e reescrever apagaria esse rastro.
