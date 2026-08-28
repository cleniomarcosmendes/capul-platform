-- Excluir um chamado passa a FUNCIONAR. Antes dava 500 SEMPRE.
--
-- Contexto (28/08/2026, achado ao testar outra coisa no DEV): o botão "Excluir"
-- do detalhe (habilitado para staff em chamado ABERTO) devolvia 500 em 100% das
-- tentativas:
--   Invalid `prisma.chamado.delete()` invocation:
--   Foreign key constraint violated on the constraint:
--   `historicos_chamado_chamado_id_fkey`   (P2003)
--
-- Motivo: TODO chamado nasce com um histórico 'ABERTURA' (criado no próprio
-- `create`), e a FK de `historicos_chamado` estava em ON DELETE RESTRICT. Não
-- havia caso em que a exclusão pudesse dar certo. O comentário do serviço dizia
-- "cascade cuida de historicos, anexos, colaboradores, registros tempo" — e o
-- banco só concordava com os três últimos.
--
-- As três FKs corrigidas aqui, e por que cada uma é Cascade:
--
--  * `historicos_chamado`  — a linha do tempo é DO chamado. Sem ele, não existe
--                            histórico órfão que signifique alguma coisa.
--  * `os_chamados`         — tabela de JUNÇÃO (OS ↔ Chamado). Some o chamado,
--                            some o vínculo; a Ordem de Serviço continua lá.
--  * `parada_chamados`     — idem, para RegistroParada.
--
-- ⭐ Nas duas tabelas de junção a assimetria era o próprio sintoma: o lado `os_id`
-- e o lado `parada_id` JÁ eram ON DELETE CASCADE. Só o lado do chamado ficou para
-- trás — esquecimento, não decisão.
--
-- ⚠️ Este arquivo foi escrito à mão de propósito. `prisma migrate dev` não roda
-- aqui (o shadow database não tem o schema `core`, que é do auth-gateway), e o
-- `prisma migrate diff` gera um script que DERRUBA as FKs do `core` inteiro —
-- porque o schema do gestão-TI só espelha `core` como leitura e o gerador não
-- sabe disso. Aplicar aquele diff destruiria a integridade do core.
--
-- Não há backfill: nenhuma linha muda, só a regra de exclusão.

-- DropForeignKey / AddForeignKey — historicos_chamado
ALTER TABLE "gestao_ti"."historicos_chamado"
  DROP CONSTRAINT "historicos_chamado_chamado_id_fkey";
ALTER TABLE "gestao_ti"."historicos_chamado"
  ADD CONSTRAINT "historicos_chamado_chamado_id_fkey"
  FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey / AddForeignKey — os_chamados
ALTER TABLE "gestao_ti"."os_chamados"
  DROP CONSTRAINT "os_chamados_chamado_id_fkey";
ALTER TABLE "gestao_ti"."os_chamados"
  ADD CONSTRAINT "os_chamados_chamado_id_fkey"
  FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey / AddForeignKey — parada_chamados
ALTER TABLE "gestao_ti"."parada_chamados"
  DROP CONSTRAINT "parada_chamados_chamado_id_fkey";
ALTER TABLE "gestao_ti"."parada_chamados"
  ADD CONSTRAINT "parada_chamados_chamado_id_fkey"
  FOREIGN KEY ("chamado_id") REFERENCES "gestao_ti"."chamados"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
