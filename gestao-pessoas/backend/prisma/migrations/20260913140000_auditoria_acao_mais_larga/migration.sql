-- ⭐⭐ `rh.auditoria.acao` ERA VARCHAR(40), E A TRILHA MORRIA CALADA AO ESTOURAR.
--
-- ── COMO APARECEU ───────────────────────────────────────────────────────────
--
-- Em 13/09 a devolutiva do avaliador registrou o acesso negado como
-- `ACESSO_NEGADO_PROPRIO_AVALIADO:devolutiva` — **41 caracteres**. O insert
-- falhou, `AuditoriaService.registrar` engoliu o erro (de propósito: trilha que
-- derruba leitura legítima troca observabilidade por disponibilidade), e a
-- resposta 403 saiu normal. **O spec passou**, porque mocka a auditoria e
-- verifica que ela foi CHAMADA — não que a linha POUSOU.
--
-- ⚠️ Quem descobriu foi conferir a TABELA depois do exercício, não o teste.
--
-- ── POR QUE ISTO É DA CLASSE, E NÃO DO CASO ─────────────────────────────────
--
-- A ação é montada assim: `ACESSO_NEGADO_PROPRIO_AVALIADO:${verbo}` — 31 de
-- prefixo. Com o teto em 40, sobravam **9 letras para o verbo**, e dois verbos
-- vivos já estavam EXATAMENTE no limite: `contestar` e `responder` (40/40). O
-- próximo verbo com 10 letras — `recalcular`, `descancelar` — apagaria em
-- silêncio um registro que a §8 da especificação EXIGE.
--
-- 120 não é generosidade: é tirar o limite do caminho de uma coluna cujo valor é
-- composto por convenção. E um invariante passa a cobrar que caiba
-- (`auditoria-cabe-na-coluna.invariante.spec.ts`), porque alargar só move o abismo.
ALTER TABLE "rh"."auditoria" ALTER COLUMN "acao" TYPE VARCHAR(120);

COMMENT ON COLUMN "rh"."auditoria"."acao" IS
  'Verbo do evento. Composto por convenção (PREFIXO:verbo), então o limite é folgado de proposito: em VARCHAR(40) a acao ACESSO_NEGADO_PROPRIO_AVALIADO:devolutiva estourava e a trilha sumia em silencio. Coberto por auditoria-cabe-na-coluna.invariante.spec.ts.';
