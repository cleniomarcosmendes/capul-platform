-- 021_lote_snapshot_validade.sql
--
-- Decisão do Clenio (08/08/2026), sobre a contagem por lote:
--
--   "produto vencido não pode ficar disponível na gôndola; oferecê-lo para
--    contagem é o sistema aceitando que isso é permitido"
--
-- O Protheus já gerencia validade por relatório próprio. O inventário não vai
-- concorrer com isso — ele apenas não oferece lote vencido para contar.
--
-- Isso já estava PROMETIDO na tela desde sempre: o modal de lote do desktop diz
-- "Produto sem lote válido na data do inventário. Todos os lotes possuem data de
-- vencimento anterior à data de referência." — uma regra que nunca foi
-- implementada. A mensagem descrevia a intenção; a implementação nunca chegou.
--
-- E era também a pendência nº 3 de `docs/historico/ANALISE_SNAPSHOT_CLENIO_02.md`
-- (19/10/2025): "Expandir Snapshot de Lotes (futuro) — adicionar b8_dtvalid".
--
-- ⚠️ A data fica no SNAPSHOT, não é lida do sb8010 na hora de exibir. Motivo: é
-- o recorte. Um lote que vence ENTRE a inclusão do produto e a contagem não pode
-- mudar a base da análise no meio do inventário — mesma regra que já vale para o
-- saldo. Sem congelar, "o que estava válido quando o inventário foi montado"
-- viraria uma pergunta sem resposta.
--
-- Formato: varchar YYYYMMDD, como o Protheus entrega em `sb8010.b8_dtvalid`
-- (comparação lexicográfica funciona e evita converter na leitura).

SET search_path TO inventario, public;

ALTER TABLE inventario.inventory_lots_snapshot
    ADD COLUMN IF NOT EXISTS b8_dtvalid VARCHAR(8);

COMMENT ON COLUMN inventario.inventory_lots_snapshot.b8_dtvalid IS
    'Data de validade do lote (YYYYMMDD) congelada na inclusão. Lote vencido na '
    'data de referência do inventário não é oferecido para contagem.';

-- Índice não faz falta: a leitura é sempre por `inventory_item_id`, que já tem
-- índice, e o volume por item é pequeno (medido em 08/08: 1 lote por item na
-- média, máximo 10 com saldo).

DO $$
DECLARE
    lotes INTEGER;
BEGIN
    SELECT COUNT(*) INTO lotes FROM inventario.inventory_lots_snapshot;
    IF lotes > 0 THEN
        RAISE WARNING '[021] % lote(s) ja congelado(s) ficam com b8_dtvalid NULL — '
                      'sao de inventarios anteriores a esta regra e seguem contaveis, '
                      'de proposito: mudar o recorte de um inventario em curso e pior.', lotes;
    END IF;
    RAISE NOTICE '[021] OK — inventory_lots_snapshot.b8_dtvalid criada.';
END $$;
