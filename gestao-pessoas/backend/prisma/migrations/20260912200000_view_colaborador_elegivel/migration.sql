-- ⭐⭐ A RÉGUA DE ELEGIBILIDADE, DISPONÍVEL EM SQL.
--
-- Existe porque nem toda conferência passa por script: num deploy, o Marco abre
-- o `psql`. E foi escrever `situacao = 'ATIVO'` à mão numa consulta de
-- conferência que quase produziu um bloqueio falso em 12/09 — dois avaliadores
-- em FÉRIAS e AFASTADO contados como impedidos (§3.1.136).
--
-- ⚠️ ISTO NÃO É O DONO DA VERDADE. A régua é `SITUACOES_ELEGIVEIS`, em
-- `src/common/elegibilidade.ts`. Esta view é uma CÓPIA em SQL, e cópia de regra
-- envelhece errada — por isso existe o
-- `common/regua-em-sql.invariante.spec.ts`, que lê ESTE ARQUIVO e exige que a
-- lista abaixo seja exatamente a da constante. Mudar uma sem a outra quebra a
-- suíte.
--
-- ⚠️ Não use em código de aplicação: lá a régua se importa. Isto é para
-- conferência humana no terminal.
CREATE OR REPLACE VIEW rh.v_colaborador_elegivel AS
SELECT c.*
  FROM rh.colaborador c
 WHERE c.situacao IN ('ATIVO', 'AFASTADO', 'FERIAS');

COMMENT ON VIEW rh.v_colaborador_elegivel IS
  'Colaboradores elegíveis ao módulo — espelha SITUACOES_ELEGIVEIS de src/common/elegibilidade.ts. Preso por invariante (regua-em-sql.invariante.spec.ts). Para conferência no psql; em código, importe a constante.';
