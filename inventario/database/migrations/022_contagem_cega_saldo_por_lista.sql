-- =============================================================================
-- 022 — A contagem cega passa a ser decisão DA LISTA, não do PAPEL (04/09/2026)
-- =============================================================================
-- Até aqui `system_qty` sumia para quem NÃO era staff (ADMIN/SUPERVISOR), por
-- papel, dentro de `aplicar_contagem_cega`. O pressuposto era "staff supervisiona,
-- não conta" — mas o sistema PERMITE designar supervisor como contador
-- (counter_cycle_1/2/3 aceita qualquer usuário), e foi o que aconteceu: duas
-- listas liberadas como CEGAS foram contadas por SUPERVISOR, que viu o saldo do
-- começo ao fim. A lista seguia marcada como cega; ninguém era avisado.
--
-- Agora quem decide é o supervisor no ato de liberar, e vale para QUALQUER papel.
--
-- Por que uma coluna NOVA em vez de reaproveitar `show_previous_counts`: são duas
-- decisões diferentes. No 3º ciclo é legítimo liberar C1/C2 para o contador
-- resolver divergência SEM revelar o saldo do sistema. Uma caixa só obrigaria o
-- rótulo a mentir sobre uma delas — foi exatamente o defeito corrigido em 03/09.
--
-- DEFAULT FALSE: cego é o padrão. Lista já existente permanece cega, que é o
-- comportamento seguro e o que o supervisor esperava ao liberá-la.
-- =============================================================================

ALTER TABLE inventario.counting_lists
    ADD COLUMN IF NOT EXISTS show_system_balance BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN inventario.counting_lists.show_system_balance IS
    'Permite ao contador ver o SALDO do sistema durante a contagem. Decisão do '
    'supervisor ao liberar a lista; vale para qualquer papel, inclusive SUPERVISOR '
    'e ADMIN quando forem os contadores. Default FALSE = contagem cega. '
    'Distinta de show_previous_counts, que libera as contagens de ciclos anteriores.';

COMMENT ON COLUMN inventario.counting_lists.show_previous_counts IS
    'Permite ao contador ver as contagens de ciclos ANTERIORES (C1/C2). Não afeta '
    'o saldo do sistema — para isso existe show_system_balance.';
