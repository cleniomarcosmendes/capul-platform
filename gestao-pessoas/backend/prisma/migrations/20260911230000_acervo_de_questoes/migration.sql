-- ⭐⭐ ACERVO DE QUESTÕES — a questão deixa de pertencer ao modelo.
--
-- ANTES: 39 linhas de `pergunta` em produção para **15 enunciados distintos**
-- (24 duplicatas, 62%). 11 dos 15 apareciam nos três modelos, com alternativas
-- IDÊNTICAS — `count(distinct assinatura) = 1` nos 15 — variando só o peso.
-- Corrigir um enunciado exigia lembrar de três lugares, e nada avisava se
-- esquecesse um. O `[DEMO]` reusava os mesmos códigos e não acrescentava
-- nenhum enunciado novo.
--
-- O `codigo_origem` do SQP010 (`004`–`018`) já era a chave do acervo: o
-- Protheus tratava isto como acervo, e **foi a importação que duplicou**.
--
-- ── AS TRÊS MUDANÇAS ────────────────────────────────────────────────────────
--
-- 1. ACERVO. `pergunta` passa a ser global: sem `grupo_id`, sem `peso`, sem
--    `ordem`, com `codigo` UNIQUE. 39 linhas viram 15.
--
-- 2. CLASSIFICAÇÃO. O "grupo" era estrutura do MODELO — 18 linhas para 8 nomes.
--    Vira atributo da QUESTÃO, global e ÚNICA.
--    ⭐ O dado já dizia isso e o schema é que não: para os 15 enunciados,
--    `count(distinct grupo) = 1`. **Nenhuma questão muda de tema conforme o
--    perfil** — esta migration não tem um caso ambíguo em 39 linhas.
--
-- 3. ARRANJO. `ModeloVersao` deixa de conter o questionário e passa a ser o
--    ARRANJO sobre o acervo: `arranjo_grupo` (peso por classificação) +
--    `arranjo_pergunta` (quais questões entram).
--
-- ── ⭐⭐ POR QUE O PESO VAI PARA O GRUPO, E NÃO FICA NA QUESTÃO ──────────────
--
-- Os pesos herdados JÁ eram do grupo. Dentro de cada grupo, em cada modelo,
-- todas as questões tinham o MESMO peso; as 18 somas de grupo eram inteiras
-- (3, 5, 9, 10, 12, 13, 16) e o total de cada modelo era exatamente 60 — o
-- mesmo 60 do `aplicacao.peso_avaliacao`.
--
--   Qualidade e Organização · Administrativo    → 5,34 + 5,33 + 5,33 = 16
--   Relacionamento e Conduta · Op. de Loja      → 3,34 + 3,33 + 3,33 = 10
--
-- ⚠️ O `5,34` NÃO É INTENÇÃO — é o resto de 16 ÷ 3, com o centavo sobrando
-- indo para a primeira questão. Guardar peso por questão era uma reescrita com
-- PERDA de "60 pontos repartidos entre grupos, cada grupo repartido igualmente
-- entre suas questões". Aqui o peso volta para onde a informação está.
--
-- ⭐ A regra de derivação foi VERIFICADA contra as 39 linhas antes desta
-- migration existir, e reproduz **39 de 39**:
--
--   peso(questão) = floor(peso_do_grupo / n, 2 casas)
--                 + 0,01 se a questão está entre as primeiras `resto` por ordem
--
-- Por isso `arranjo_pergunta` NÃO TEM COLUNA DE PESO e não deve ganhar uma:
-- seria peso em dois níveis, que é a decisão que este módulo já rejeitou por
-- escrito. Questão que precise pesar diferente das irmãs ganha classificação
-- própria.
--
-- ── ⚠️ AS 214 RESPOSTAS ─────────────────────────────────────────────────────
--
-- O Piloto tem 894 avaliações e ZERO respostas — foi por isso que esta
-- migration foi feita AGORA. Mas existem **214 respostas** em ciclos de
-- teste/simulação (158 Administrativo, 56 Operação de Loja) apontando para
-- linhas de `pergunta` que vão desaparecer. Elas são REMAPEADAS, não apagadas.
--
-- A chave do remapeamento é `(pergunta.codigo_origem, alternativa.ordem)`, e
-- foi verificada: identifica a alternativa sem ambiguidade nas 176 linhas,
-- DEMO incluído (nenhum par com descrição ou valor divergente).
--
-- COMO SE DESFAZ: não se desfaz por DDL — é colapso de linhas. Restaurar exige
-- backup. O DEV foi conferido antes; ver a conferência ao final do arquivo.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. CLASSIFICAÇÃO — 8 linhas, a partir dos nomes de grupo que já existiam
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "rh"."classificacao" (
    "id"        TEXT NOT NULL,
    "nome"      TEXT NOT NULL,
    "ordem"     INTEGER NOT NULL,
    "ativa"     BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "classificacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "classificacao_nome_key" ON "rh"."classificacao"("nome");

-- A ordem sai da posição média que o grupo ocupava nos modelos: preserva a
-- sequência de leitura que o RH já conhece, sem depender de um modelo só.
INSERT INTO "rh"."classificacao" ("id", "nome", "ordem")
SELECT gen_random_uuid()::text, g."titulo",
       (row_number() OVER (ORDER BY avg(g."ordem"), g."titulo"))::int - 1
  FROM "rh"."grupo" g
 GROUP BY g."titulo";

-- ───────────────────────────────────────────────────────────────────────────
-- 2. PERGUNTA vira ACERVO — colunas novas, ainda anuláveis para o backfill
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "rh"."pergunta"
  ADD COLUMN "codigo"           VARCHAR(10),
  ADD COLUMN "classificacao_id" TEXT,
  ADD COLUMN "ativa"            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "atualizado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "rh"."pergunta" p
   SET "codigo" = p."codigo_origem",
       "classificacao_id" = c."id"
  FROM "rh"."grupo" g, "rh"."classificacao" c
 WHERE g."id" = p."grupo_id" AND c."nome" = g."titulo";

-- Recusa alta se alguma linha ficou sem código: sem ele não há acervo, e
-- seguir produziria um `codigo` NULL que o UNIQUE deixaria passar em silêncio.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "rh"."pergunta" WHERE "codigo" IS NULL OR "classificacao_id" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'ACERVO: % pergunta(s) sem codigo_origem ou sem classificacao — migration abortada.', n;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. COLAPSO — 39 linhas viram 15, e as respostas seguem junto
-- ───────────────────────────────────────────────────────────────────────────
-- Canônica: a de menor id por código. Qualquer uma serviria (os enunciados e
-- as alternativas são idênticos); o que importa é ser DETERMINÍSTICO.
CREATE TEMP TABLE _canonica AS
SELECT "codigo", min("id") AS "id_canonico" FROM "rh"."pergunta" GROUP BY "codigo";

CREATE TEMP TABLE _mapa_pergunta AS
SELECT p."id" AS "de", c."id_canonico" AS "para"
  FROM "rh"."pergunta" p JOIN _canonica c ON c."codigo" = p."codigo"
 WHERE p."id" <> c."id_canonico";

-- Alternativa: casada por (código da pergunta, ordem) — verificado unívoco.
CREATE TEMP TABLE _mapa_alternativa AS
SELECT a_de."id" AS "de", a_para."id" AS "para"
  FROM "rh"."pergunta_alternativa" a_de
  JOIN "rh"."pergunta" p_de   ON p_de."id" = a_de."pergunta_id"
  JOIN _canonica c            ON c."codigo" = p_de."codigo"
  JOIN "rh"."pergunta_alternativa" a_para
       ON a_para."pergunta_id" = c."id_canonico" AND a_para."ordem" = a_de."ordem"
 WHERE a_de."id" <> a_para."id";

UPDATE "rh"."resposta" r SET "pergunta_id" = m."para"
  FROM _mapa_pergunta m WHERE m."de" = r."pergunta_id";

UPDATE "rh"."resposta" r SET "alternativa_id" = m."para"
  FROM _mapa_alternativa m WHERE m."de" = r."alternativa_id";

-- ───────────────────────────────────────────────────────────────────────────
-- 4. ARRANJO — peso por classificação e quais questões entram
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "rh"."arranjo_grupo" (
    "id"               TEXT NOT NULL,
    "modelo_versao_id" TEXT NOT NULL,
    "classificacao_id" TEXT NOT NULL,
    "peso"             DECIMAL(10,4) NOT NULL,
    "ordem"            INTEGER NOT NULL,
    CONSTRAINT "arranjo_grupo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rh"."arranjo_pergunta" (
    "id"               TEXT NOT NULL,
    "modelo_versao_id" TEXT NOT NULL,
    "pergunta_id"      TEXT NOT NULL,
    "ordem"            INTEGER NOT NULL,
    CONSTRAINT "arranjo_pergunta_pkey" PRIMARY KEY ("id")
);

-- O peso do grupo é a SOMA dos pesos das suas questões — é a identidade que
-- torna a derivação exata, não uma aproximação.
INSERT INTO "rh"."arranjo_grupo" ("id","modelo_versao_id","classificacao_id","peso","ordem")
SELECT gen_random_uuid()::text, g."modelo_versao_id", c."id", sum(p."peso"), g."ordem"
  FROM "rh"."grupo" g
  JOIN "rh"."classificacao" c ON c."nome" = g."titulo"
  JOIN "rh"."pergunta" p ON p."grupo_id" = g."id"
 GROUP BY g."modelo_versao_id", c."id", g."ordem";

-- `pergunta.ordem` era POR GRUPO (0,1,2 em cada um). No arranjo a ordem é da
-- versão inteira, senão a tela empilharia três questões "0".
INSERT INTO "rh"."arranjo_pergunta" ("id","modelo_versao_id","pergunta_id","ordem")
SELECT gen_random_uuid()::text, g."modelo_versao_id", can."id_canonico",
       (row_number() OVER (PARTITION BY g."modelo_versao_id" ORDER BY g."ordem", p."ordem"))::int - 1
  FROM "rh"."grupo" g
  JOIN "rh"."pergunta" p ON p."grupo_id" = g."id"
  JOIN _canonica can ON can."codigo" = p."codigo";

-- ───────────────────────────────────────────────────────────────────────────
-- 5. LIMPEZA — só agora, com tudo já remapeado
-- ───────────────────────────────────────────────────────────────────────────
DELETE FROM "rh"."pergunta_alternativa" a
 WHERE a."pergunta_id" IN (SELECT "de" FROM _mapa_pergunta);

DELETE FROM "rh"."pergunta" p
 WHERE p."id" IN (SELECT "de" FROM _mapa_pergunta);

ALTER TABLE "rh"."pergunta" DROP CONSTRAINT "pergunta_grupo_id_fkey";
DROP INDEX "rh"."pergunta_grupo_id_ordem_idx";
ALTER TABLE "rh"."pergunta"
  DROP COLUMN "grupo_id",
  DROP COLUMN "ordem",
  DROP COLUMN "peso",
  DROP COLUMN "codigo_origem";

ALTER TABLE "rh"."grupo" DROP CONSTRAINT "grupo_modelo_versao_id_fkey";
DROP TABLE "rh"."grupo";

ALTER TABLE "rh"."pergunta"
  ALTER COLUMN "codigo" SET NOT NULL,
  ALTER COLUMN "classificacao_id" SET NOT NULL,
  ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. ÍNDICES E CHAVES
-- ───────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "pergunta_codigo_key" ON "rh"."pergunta"("codigo");
CREATE INDEX "pergunta_classificacao_id_idx" ON "rh"."pergunta"("classificacao_id");
CREATE UNIQUE INDEX "pergunta_alternativa_pergunta_id_ordem_key"
    ON "rh"."pergunta_alternativa"("pergunta_id","ordem");
CREATE INDEX "arranjo_grupo_modelo_versao_id_ordem_idx"
    ON "rh"."arranjo_grupo"("modelo_versao_id","ordem");
CREATE UNIQUE INDEX "arranjo_grupo_modelo_versao_id_classificacao_id_key"
    ON "rh"."arranjo_grupo"("modelo_versao_id","classificacao_id");
CREATE INDEX "arranjo_pergunta_modelo_versao_id_ordem_idx"
    ON "rh"."arranjo_pergunta"("modelo_versao_id","ordem");
CREATE UNIQUE INDEX "arranjo_pergunta_modelo_versao_id_pergunta_id_key"
    ON "rh"."arranjo_pergunta"("modelo_versao_id","pergunta_id");

ALTER TABLE "rh"."pergunta" ADD CONSTRAINT "pergunta_classificacao_id_fkey"
  FOREIGN KEY ("classificacao_id") REFERENCES "rh"."classificacao"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "rh"."arranjo_grupo" ADD CONSTRAINT "arranjo_grupo_modelo_versao_id_fkey"
  FOREIGN KEY ("modelo_versao_id") REFERENCES "rh"."modelo_versao"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "rh"."arranjo_grupo" ADD CONSTRAINT "arranjo_grupo_classificacao_id_fkey"
  FOREIGN KEY ("classificacao_id") REFERENCES "rh"."classificacao"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "rh"."arranjo_pergunta" ADD CONSTRAINT "arranjo_pergunta_modelo_versao_id_fkey"
  FOREIGN KEY ("modelo_versao_id") REFERENCES "rh"."modelo_versao"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "rh"."arranjo_pergunta" ADD CONSTRAINT "arranjo_pergunta_pergunta_id_fkey"
  FOREIGN KEY ("pergunta_id") REFERENCES "rh"."pergunta"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. CONFERÊNCIA — a migration se recusa a terminar se algum número mudou
-- ───────────────────────────────────────────────────────────────────────────
-- ⭐ Está DENTRO da migration de propósito: conferência que depende de alguém
-- lembrar de rodar depois não é conferência. `migrate deploy` roda em
-- transação — falhar aqui desfaz tudo.
DO $$
DECLARE
  v_acervo int; v_class int; v_erros text := '';
  -- ⚠️ NUNCA chamar esta variável de `r`: em PL/pgSQL a variável declarada vence
  -- o alias de tabela, e `r."pergunta_id"` passa a ser lido como campo do record.
  perfil record;
BEGIN
  SELECT count(*) INTO v_acervo FROM "rh"."pergunta";
  SELECT count(*) INTO v_class  FROM "rh"."classificacao";
  IF v_acervo <> 15 THEN v_erros := v_erros || format('acervo tem %s questoes (esperado 15); ', v_acervo); END IF;
  IF v_class  <> 8  THEN v_erros := v_erros || format('ha %s classificacoes (esperado 8); ', v_class); END IF;

  -- Soma de peso por perfil: tem de continuar 60 nos três de PRODUCAO.
  FOR perfil IN
    SELECT m."nome", sum(ag."peso") AS soma
      FROM "rh"."arranjo_grupo" ag
      JOIN "rh"."modelo_versao" mv ON mv."id" = ag."modelo_versao_id"
      JOIN "rh"."modelo" m ON m."id" = mv."modelo_id"
     WHERE m."finalidade" = 'PRODUCAO'
     GROUP BY m."nome"
  LOOP
    IF perfil.soma <> 60 THEN
      v_erros := v_erros || format('perfil "%s" soma %s (esperado 60); ', perfil."nome", perfil.soma);
    END IF;
  END LOOP;

  -- Nenhuma resposta pode ter ficado apontando para linha morta.
  IF EXISTS (SELECT 1 FROM "rh"."resposta" r
              WHERE NOT EXISTS (SELECT 1 FROM "rh"."pergunta" p WHERE p."id" = r."pergunta_id")) THEN
    v_erros := v_erros || 'ha resposta apontando para pergunta inexistente; ';
  END IF;

  -- Toda questão do arranjo tem de ter a sua classificação com peso no arranjo,
  -- senão ela entra no questionário valendo zero, em silêncio.
  IF EXISTS (
    SELECT 1 FROM "rh"."arranjo_pergunta" ap
      JOIN "rh"."pergunta" p ON p."id" = ap."pergunta_id"
     WHERE NOT EXISTS (
       SELECT 1 FROM "rh"."arranjo_grupo" ag
        WHERE ag."modelo_versao_id" = ap."modelo_versao_id"
          AND ag."classificacao_id" = p."classificacao_id")) THEN
    v_erros := v_erros || 'ha questao no arranjo cuja classificacao nao tem peso; ';
  END IF;

  IF v_erros <> '' THEN
    RAISE EXCEPTION 'ACERVO — conferencia falhou: %', v_erros;
  END IF;
END $$;
