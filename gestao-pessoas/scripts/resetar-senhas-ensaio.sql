-- ═══════════════════════════════════════════════════════════════════════════
-- RESET DE SENHA DAS 16 CONTAS DO ENSAIO INTEGRAL — **NO DEV**
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️⚠️ DECISÃO DO CLENIO, 13/09/2026. Este arquivo existe para que ELE execute:
-- *montagem de coisa que fica vai na conta de quem decidiu* — a mesma regra do
-- `ehRecorte` e das 348 designações.
--
-- ── POR QUE É SEGURO, E POR QUE PRECISA SER FEITO ───────────────────────────
--
--  • São contas do **DEV**. As pessoas reais não as usam.
--  • `autentica_portal = false` nas 16 → a senha é **local** a `core.usuarios`
--    do DEV. **Não toca o Protheus e não toca produção.**
--  • Sem isto o ensaio integral **não roda**: a skill precisa entrar como cada
--    avaliador para responder a fila dele, e as senhas são de gente real —
--    ninguém aqui as tem, nem deve ter.
--
-- ⚠️ São **16**, não 17: a ARIELLY (`ariellypereira`, RH_ADMIN) **já está entre
-- os 16** — ela é a avaliadora designada de 5 pessoas do ENSAIO.
--
-- ── A SENHA ─────────────────────────────────────────────────────────────────
--
--   Temp2026
--
-- Hash gerado com a MESMA biblioteca e custo do auth-gateway (`bcryptjs`, 12
-- rounds), dentro do próprio container, e conferido com `compareSync` → true.
-- ⚠️ Nunca escrever hash "equivalente" à mão: custo ou algoritmo diferente
-- produz login que falha sem dizer por quê.
--
-- ── COMO RODAR ──────────────────────────────────────────────────────────────
--
-- ⚠️ NO POWERSHELL (5.1) — o terminal do Clenio. **Não use `<`**: o PS 5.1 não
-- tem redireção de entrada, e o `|` dele REENCODA o texto, o que estragaria os
-- acentos e o hash. Copiar o arquivo para dentro do container evita as duas
-- coisas, porque `docker cp` copia BYTES:
--
--   docker cp C:\meus_projetos\capul-platform\gestao-pessoas\scripts\resetar-senhas-ensaio.sql capul-db:/tmp/reset.sql
--   docker compose exec postgres psql -U capul_user -d capul_platform -f /tmp/reset.sql
--   docker compose exec postgres rm /tmp/reset.sql
--
-- ⚠️ CAMINHO ABSOLUTO, de propósito. O relativo falha se quem roda não estiver
--    na raiz do repo — e falha com uma mensagem que parece outra coisa
--    ("O sistema não pode encontrar o arquivo"), mandando procurar o arquivo em
--    vez de olhar o diretório.
--
-- (No bash/WSL o `< arquivo` funciona igual.)
--
-- ⚠️ Transação única, com a lista ANTES e a conferência DEPOIS. `COMMIT` na
-- última linha — troque por `ROLLBACK` se algum número surpreender.

BEGIN;

-- As 16, por MATRÍCULA (a chave que liga conta e colaborador). Lista explícita:
-- "todos os avaliadores do ciclo" mudaria de tamanho se a designação mudasse.
CREATE TEMP TABLE alvo(matricula text);
INSERT INTO alvo VALUES
  ('003113'),  -- adrianacaetano    · AVALIADOR · fila 91
  ('004060'),  -- thiagomacedo      · AVALIADOR · fila 83
  ('002336'),  -- lidyanerocha      · AVALIADOR · fila 46
  ('001960'),  -- marcioantonio     · AVALIADOR · fila 33  (FÉRIAS — entra na régua)
  ('001079'),  -- claudimaroliveira · AVALIADOR · fila 15
  ('001277'),  -- esmeraldasilva    · AVALIADOR · fila 13
  ('001047'),  -- clenio            · AVALIADOR · fila 13
  ('001106'),  -- denisealves       · AVALIADOR · fila 6
  ('001086'),  -- vanialucia        · AVALIADOR · fila 6
  ('002448'),  -- ariellypereira    · RH_ADMIN  · fila 5   ⭐ RH **e** avaliadora
  ('001981'),  -- renataborges      · AVALIADOR · fila 3
  ('001134'),  -- jaiclerferreira   · AVALIADOR · fila 3
  ('001907'),  -- julianacouto      · AVALIADOR · fila 3
  ('003969'),  -- ivanlucas         · AVALIADOR · fila 2
  ('002865'),  -- laislourenco      · AVALIADOR · fila 2
  ('005380');  -- liciaversiani     · AVALIADOR · fila 1   (AFASTADO — entra na régua)

-- ── ANTES: confira que são 16 e que nenhuma autentica pelo portal ──────────
-- ⚠️ Nomes de coluna em ASCII PURO, de propósito: o `⚠_` que estava aqui
--    quebraria no PowerShell 5.1, que reencoda o texto ao passar por um pipe.
SELECT count(*) AS contas_encontradas,
       count(*) FILTER (WHERE u.autentica_portal) AS ATENCAO_autenticam_pelo_portal,
       count(*) FILTER (WHERE u.status <> 'ATIVO') AS ATENCAO_inativas
  FROM core.usuarios u JOIN alvo a ON a.matricula = u.matricula;

-- ⚠️ Se `autenticam_pelo_portal` não for 0, PARE: nessas contas a senha local é
-- ignorada e o reset não teria efeito — o login iria ao Protheus.

UPDATE core.usuarios u SET
  senha = '$2b$12$nuxEPtMdm23rZFX8V8YucOJmbVZVcJFgbcGRSH41dfyJzgaoDIqE6',
  -- ⭐ `false`: o reset do Configurador marca `primeiro_acesso = true`, e aqui
  --    isso só serviria para a skill tropeçar num fluxo de troca de senha.
  primeiro_acesso = false,
  updated_at = now()
 FROM alvo a
 WHERE u.matricula = a.matricula;

-- ── DEPOIS: tem de dizer 16 ────────────────────────────────────────────────
SELECT count(*) AS senhas_trocadas
  FROM core.usuarios u JOIN alvo a ON a.matricula = u.matricula
 WHERE u.senha = '$2b$12$nuxEPtMdm23rZFX8V8YucOJmbVZVcJFgbcGRSH41dfyJzgaoDIqE6';

COMMIT;
-- ou: ROLLBACK;

-- ⚠️ O UPDATE não confere o login — só troca o hash. **Confirme entrando**, nas
-- 16, com `gestao-pessoas/scripts/conferir-login-ensaio.sh`. Hash certo com
-- conta INATIVA, sem permissão ou sem colaborador continua sem entrar, e é isso
-- que o ensaio precisa saber ANTES de começar.
