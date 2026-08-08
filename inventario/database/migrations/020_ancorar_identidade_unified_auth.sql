-- 020_ancorar_identidade_unified_auth.sql
--
-- Terceira vez que a MESMA raiz aparece (07-08/08/2026):
--   1. seletor de armazem vazio       -> contornado no warehouses.py (casa por CODIGO)
--   2. importacao da slk010 quebrando -> contornado na 019 (FKs viraram opcionais)
--   3. "Loja nao encontrada ou invalida" ao criar inventario  <- este aqui
--
-- A RAIZ: com o UNIFIED_AUTH o `store_id` do usuario logado passou a ser o UUID
-- de `core.filiais` e o `id` passou a ser o de `core.usuarios` (core/security.py,
-- `_get_current_user_unified`). Mas 48 FKs do modulo continuam apontando para
-- `inventario.stores` e `inventario.users` — que estao VAZIAS. Doze dessas FKs
-- sao NOT NULL, entre elas:
--
--     inventory_lists.store_id / .created_by      countings.counted_by
--     counting_lists.created_by                   cycle_audit_log.user_id
--     counting_list_handoff_history.ator_id       closed_counting_rounds.user_id
--
-- Ou seja: TODO o caminho de escrita da contagem estava bloqueado — criar
-- inventario, criar lista, atribuir contador, contar, auditar, fazer handoff,
-- encerrar ciclo. Nao so a criacao do inventario.
--
-- ESCOLHA: ancorar a identidade, em vez de afrouxar as FKs.
--
-- Daria para estender a 019 e derrubar os NOT NULL, mas `counted_by`/`created_by`
-- nulos apagariam a trilha de auditoria — que e justamente o miolo do modulo
-- (contagem cega, ciclos, handoff). "Quem contou este item?" precisa ter
-- resposta. A direcao aqui e a inversa: dar as FKs um alvo real.
--
-- `inventario.stores` e `inventario.users` deixam de ser CADASTRO e viram
-- ANCORA DE IDENTIDADE: mesmos UUIDs do core, espelhados. O cadastro segue
-- sendo do Configurador; aqui existe so o que as FKs precisam para apontar.
--
-- ⚠️ NUNCA APAGAR linha espelhada: as FKs de contagem dependem dela para o
-- historico continuar legivel. Usuario que sai do modulo e DESATIVADO
-- (is_active=false), nunca removido.
--
-- ⚠️ TIPOS DIFERENTES DOS DOIS LADOS: o core e gerenciado pelo Prisma e guarda
-- id como TEXT; o inventario usa UUID nativo. Por isso todo cruzamento leva
-- cast explicito. E como o Prisma pode gerar `cuid` (que nao e UUID), as linhas
-- com id fora do formato UUID sao IGNORADAS com aviso, em vez de estourar o
-- cast e derrubar a migration inteira.
--
-- Esta migration faz a carga inicial. Manter em dia (usuario novo, troca de
-- papel, filial nova) e do `_espelhar_identidade` no core/security.py, que roda
-- na validacao do JWT.

SET search_path TO inventario, public;

-- Formato UUID canonico — usado como guarda em todo cruzamento com o core.
CREATE OR REPLACE FUNCTION pg_temp.eh_uuid(v TEXT) RETURNS BOOLEAN AS $$
    SELECT v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$ LANGUAGE SQL IMMUTABLE;

-- ===========================================================================
-- 0. Aviso sobre ids que nao poderao ser espelhados
-- ===========================================================================
DO $$
DECLARE
    f_ruins INTEGER;
    u_ruins INTEGER;
BEGIN
    SELECT COUNT(*) INTO f_ruins FROM core.filiais WHERE NOT pg_temp.eh_uuid(id);
    SELECT COUNT(*) INTO u_ruins
      FROM core.permissoes_modulo p
      JOIN core.modulos_sistema m ON m.id = p.modulo_id AND m.codigo = 'INVENTARIO'
      JOIN core.usuarios c ON c.id = p.usuario_id
     WHERE NOT pg_temp.eh_uuid(c.id);

    IF f_ruins > 0 OR u_ruins > 0 THEN
        RAISE WARNING '[020] % filial(is) e % usuario(s) com id fora do formato UUID — NAO espelhados. O modulo nao conseguira gravar contagem para eles enquanto inventario.* usar UUID nativo.', f_ruins, u_ruins;
    END IF;
END $$;

-- ===========================================================================
-- 1. FILIAIS: core.filiais -> inventario.stores (mesmos UUIDs)
-- ===========================================================================

-- 1a. Rede de seguranca para HLG/PROD: linha legada cujo `code` colide com uma
--     filial do core mas tem UUID proprio. Em DEV a tabela esta vazia e isto
--     nao faz nada. Renomeia (preservando o dado e as FKs que a referenciam)
--     em vez de apagar — o INSERT abaixo morreria em `stores_code_key`.
DO $$
DECLARE
    orfas INTEGER;
BEGIN
    UPDATE inventario.stores s
       SET code = LEFT('LEG-' || s.code, 10),
           updated_at = NOW()
     WHERE NOT EXISTS (
             SELECT 1 FROM core.filiais f
              WHERE pg_temp.eh_uuid(f.id) AND f.id::uuid = s.id)
       AND EXISTS (SELECT 1 FROM core.filiais f WHERE f.codigo = s.code);

    GET DIAGNOSTICS orfas = ROW_COUNT;
    IF orfas > 0 THEN
        RAISE NOTICE '[020] % loja(s) legada(s) renomeada(s) para LEG-* (codigo colidia com core.filiais). Conferir antes de descartar.', orfas;
    END IF;
END $$;

-- 1b. Espelhar.
INSERT INTO inventario.stores (id, code, name, is_active, created_at, updated_at)
SELECT
    f.id::uuid,
    f.codigo,
    LEFT(COALESCE(NULLIF(TRIM(f.nome_fantasia), ''), f.razao_social, 'Filial ' || f.codigo), 100),
    (f.status = 'ATIVO'),
    NOW(),
    NOW()
FROM core.filiais f
WHERE pg_temp.eh_uuid(f.id)
ON CONFLICT (id) DO UPDATE SET
    code       = EXCLUDED.code,
    name       = EXCLUDED.name,
    is_active  = EXCLUDED.is_active,
    updated_at = NOW();

-- ===========================================================================
-- 2. USUARIOS: quem tem o modulo INVENTARIO -> inventario.users
-- ===========================================================================
--
-- Semeia TODOS os usuarios com permissao no modulo, nao so quem ja logou. Isso
-- importa porque a atribuicao de contador (`main.py`, `available_users` /
-- `counting_lists_service`) monta a lista lendo `inventario.users` filtrada por
-- `store_id` — se so existisse quem ja acessou, o supervisor nao teria a quem
-- atribuir a lista no primeiro uso.

-- 2a. Mesma rede de seguranca do passo 1a, agora para `users_username_key`.
DO $$
DECLARE
    orfaos INTEGER;
BEGIN
    UPDATE inventario.users u
       SET username = LEFT(u.username || '~legado', 50),
           updated_at = NOW()
     WHERE NOT EXISTS (
             SELECT 1 FROM core.usuarios c
              WHERE pg_temp.eh_uuid(c.id) AND c.id::uuid = u.id)
       AND EXISTS (SELECT 1 FROM core.usuarios c WHERE c.username = u.username);

    GET DIAGNOSTICS orfaos = ROW_COUNT;
    IF orfaos > 0 THEN
        RAISE NOTICE '[020] % usuario(s) legado(s) renomeado(s) para *~legado (username colidia com core.usuarios). A contagem antiga deles continua atribuida a essas linhas — nao apagar.', orfaos;
    END IF;
END $$;

-- 2b. Espelhar.
--
-- `password_hash` e NOT NULL e no UNIFIED_AUTH nao existe senha aqui. Grava-se
-- um valor com FORMATO de bcrypt (para o passlib nao levantar excecao se o
-- modo standalone for religado) e CONTEUDO aleatorio, que nenhuma senha
-- produz — a linha espelhada nao consegue autenticar pelo caminho legado.
INSERT INTO inventario.users (
    id, username, password_hash, full_name, email, role, store_id, is_active, created_at, updated_at
)
SELECT DISTINCT ON (c.id)
    c.id::uuid,
    LEFT(c.username, 50),
    '$2b$12$' || SUBSTR(MD5(RANDOM()::text) || MD5(RANDOM()::text), 1, 53),
    LEFT(COALESCE(NULLIF(TRIM(c.nome), ''), c.username), 100),
    LEFT(c.email, 100),
    COALESCE(r.codigo, 'OPERATOR')::userrole,
    CASE WHEN pg_temp.eh_uuid(c.filial_principal_id) THEN c.filial_principal_id::uuid END,
    (c.status = 'ATIVO' AND p.status = 'ATIVO'),
    NOW(),
    NOW()
FROM core.permissoes_modulo p
JOIN core.modulos_sistema m ON m.id = p.modulo_id AND m.codigo = 'INVENTARIO'
JOIN core.usuarios       c ON c.id = p.usuario_id
LEFT JOIN core.roles_modulo r ON r.id = p.role_modulo_id
WHERE pg_temp.eh_uuid(c.id)
  -- A filial precisa existir em stores (passo 1 acabou de garantir); sem ela o
  -- usuario entra SEM loja, em vez de violar a FK.
  AND (
        c.filial_principal_id IS NULL
        OR NOT pg_temp.eh_uuid(c.filial_principal_id)
        OR EXISTS (SELECT 1 FROM inventario.stores s WHERE s.id = c.filial_principal_id::uuid)
      )
ORDER BY c.id, p.status DESC
ON CONFLICT (id) DO UPDATE SET
    -- password_hash NAO entra no UPDATE: reexecutar a migration nao pode
    -- reescrever a senha de quem tenha vindo do cadastro legado.
    username   = EXCLUDED.username,
    full_name  = EXCLUDED.full_name,
    email      = EXCLUDED.email,
    role       = EXCLUDED.role,
    store_id   = EXCLUDED.store_id,
    is_active  = EXCLUDED.is_active,
    updated_at = NOW();

-- ===========================================================================
-- 3. MULTI-FILIAL: core.usuario_filiais -> inventario.user_stores
-- ===========================================================================
--
-- Terceira tabela orfa da mesma raiz, achada ao conferir o passo SEGUINTE do
-- roteiro: `GET /inventory/{id}/available-users` — a lista de quem pode receber
-- a contagem — nao le `users.store_id`, le o vinculo multi-filial em
-- `user_stores` (comentario "v2.15.4" no endpoint). Com ela vazia o supervisor
-- via "Found 0 available users" e nao tinha a quem atribuir a lista, mesmo com
-- os usuarios ja ancorados no passo 2.
--
-- As duas tabelas tem a MESMA forma (id, is_default, created_at, created_by,
-- updated_at, usuario_id/filial_id <-> user_id/store_id), entao o espelho e 1:1.

INSERT INTO inventario.user_stores (id, user_id, store_id, is_default, created_by, created_at, updated_at)
SELECT
    CASE WHEN pg_temp.eh_uuid(uf.id) THEN uf.id::uuid ELSE gen_random_uuid() END,
    uf.usuario_id::uuid,
    uf.filial_id::uuid,
    COALESCE(uf.is_default, FALSE),
    -- `created_by` referencia inventario.users; quem criou o vinculo pode nao
    -- ter o modulo INVENTARIO e portanto nao estar ancorado. Nesse caso entra
    -- NULL (a coluna aceita) em vez de violar a FK.
    CASE WHEN pg_temp.eh_uuid(uf.created_by)
              AND EXISTS (SELECT 1 FROM inventario.users u WHERE u.id = uf.created_by::uuid)
         THEN uf.created_by::uuid END,
    NOW(),
    NOW()
FROM core.usuario_filiais uf
WHERE pg_temp.eh_uuid(uf.usuario_id)
  AND pg_temp.eh_uuid(uf.filial_id)
  -- So vincula quem foi ancorado no passo 2 e filial ancorada no passo 1.
  AND EXISTS (SELECT 1 FROM inventario.users  u WHERE u.id = uf.usuario_id::uuid)
  AND EXISTS (SELECT 1 FROM inventario.stores s WHERE s.id = uf.filial_id::uuid)
  -- Idempotencia por chave NATURAL: `user_stores` so tem PK em `id`, entao
  -- reexecutar com id diferente duplicaria o vinculo.
  AND NOT EXISTS (
        SELECT 1 FROM inventario.user_stores us
         WHERE us.user_id = uf.usuario_id::uuid
           AND us.store_id = uf.filial_id::uuid);

-- A idempotencia acima depende de nao existir duplicata. Formaliza isso num
-- indice — mas so se a tabela ja estiver limpa, para nao derrubar a migration
-- num ambiente com vinculo repetido de antes.
DO $$
DECLARE
    dups INTEGER;
BEGIN
    SELECT COUNT(*) INTO dups FROM (
        SELECT user_id, store_id FROM inventario.user_stores
         GROUP BY user_id, store_id HAVING COUNT(*) > 1
    ) d;

    IF dups > 0 THEN
        RAISE WARNING '[020] % par(es) (user_id, store_id) duplicado(s) em user_stores — UNIQUE nao criada. Limpar e criar depois.', dups;
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_user_stores_user_store
            ON inventario.user_stores (user_id, store_id);
    END IF;
END $$;

-- ===========================================================================
-- 4. Conferencia
-- ===========================================================================
DO $$
DECLARE
    filiais     INTEGER;
    lojas       INTEGER;
    com_modulo  INTEGER;
    espelhados  INTEGER;
    sem_vinculo INTEGER;
    vinculos    INTEGER;
BEGIN
    SELECT COUNT(*) INTO filiais FROM core.filiais WHERE pg_temp.eh_uuid(id);
    SELECT COUNT(*) INTO lojas
      FROM inventario.stores s
      JOIN core.filiais f ON pg_temp.eh_uuid(f.id) AND f.id::uuid = s.id;

    IF lojas < filiais THEN
        RAISE EXCEPTION '[020] Espelhamento de filiais incompleto: % de %', lojas, filiais;
    END IF;

    SELECT COUNT(DISTINCT p.usuario_id) INTO com_modulo
      FROM core.permissoes_modulo p
      JOIN core.modulos_sistema m ON m.id = p.modulo_id AND m.codigo = 'INVENTARIO'
      JOIN core.usuarios c ON c.id = p.usuario_id
     WHERE pg_temp.eh_uuid(c.id);

    SELECT COUNT(*) INTO espelhados
      FROM inventario.users u
      JOIN core.usuarios c ON pg_temp.eh_uuid(c.id) AND c.id::uuid = u.id;

    IF espelhados < com_modulo THEN
        RAISE EXCEPTION '[020] Espelhamento de usuarios incompleto: % de % com o modulo INVENTARIO', espelhados, com_modulo;
    END IF;

    -- Sem vinculo em user_stores o supervisor nao tem a quem atribuir a lista
    -- (`available-users` retorna vazio), mesmo com o usuario ancorado.
    SELECT COUNT(*) INTO sem_vinculo
      FROM inventario.users u
     WHERE u.is_active
       AND u.store_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM inventario.user_stores us WHERE us.user_id = u.id);

    IF sem_vinculo > 0 THEN
        RAISE WARNING '[020] % usuario(s) ancorado(s) sem nenhuma filial em user_stores — nao aparecerao para atribuicao de contagem.', sem_vinculo;
    END IF;

    SELECT COUNT(*) INTO vinculos FROM inventario.user_stores;

    RAISE NOTICE '[020] OK — % filial(is), % usuario(s) e % vinculo(s) usuario-filial ancorados.', lojas, espelhados, vinculos;
END $$;
