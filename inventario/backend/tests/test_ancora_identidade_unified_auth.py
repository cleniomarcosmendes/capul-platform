"""
Âncora de identidade sob UNIFIED_AUTH (migration 020).

O problema que estes testes guardam apareceu TRÊS vezes em 07-08/08/2026, cada
vez com uma cara diferente: seletor de armazém vazio, importação da slk010
quebrando, e "Loja não encontrada ou inválida" ao criar inventário.

A raiz é sempre a mesma: com o UNIFIED_AUTH o `id` do usuário passou a vir de
`core.usuarios` e o `store_id` de `core.filiais`, mas 48 FKs do módulo continuam
apontando para `inventario.users` / `inventario.stores`. Se essas duas tabelas
não espelharem o core, TODO o caminho de escrita da contagem quebra — não só a
criação do inventário.

Por isso os testes abaixo cobrem a CLASSE do problema (a âncora cobre o core?),
não os três sintomas.
"""

import os
import uuid

import pytest
from sqlalchemy import text


UNIFIED_AUTH = os.getenv("UNIFIED_AUTH", "true").lower() == "true"

pytestmark = pytest.mark.skipif(
    not UNIFIED_AUTH,
    reason="Âncora só faz sentido sob UNIFIED_AUTH; no modo standalone o cadastro é local.",
)

# O core é gerenciado pelo Prisma e guarda id como TEXT — pode não ser UUID.
# `inventario.*` usa UUID nativo, então só o que casa no formato é espelhável.
_RE_UUID = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"


def test_toda_filial_do_core_tem_ancora_em_stores(db_session):
    """Sem isto, `create_inventory` responde "Loja não encontrada ou inválida".

    O `store_id` do usuário logado é o UUID de `core.filiais`; o endpoint valida
    esse UUID contra `inventario.stores`. Filial sem âncora = filial onde
    ninguém consegue abrir inventário.
    """
    faltando = db_session.execute(text(f"""
        SELECT f.codigo, COALESCE(f.nome_fantasia, f.razao_social)
          FROM core.filiais f
         WHERE f.id ~* '{_RE_UUID}'
           AND NOT EXISTS (SELECT 1 FROM inventario.stores s WHERE s.id = f.id::uuid)
         ORDER BY f.codigo
    """)).fetchall()

    assert not faltando, (
        "Filial(is) de core.filiais sem âncora em inventario.stores — abrir "
        "inventário nelas falha com 'Loja não encontrada ou inválida': "
        + ", ".join(f"{cod} ({nome})" for cod, nome in faltando)
    )


def test_todo_usuario_do_modulo_tem_ancora_em_users(db_session):
    """Sem isto, o INSERT morre em `created_by`/`counted_by` (FK NOT NULL).

    Cobre também a atribuição de contador: `available_users` monta a lista lendo
    `inventario.users` filtrada por `store_id`. Usuário com o módulo mas sem
    âncora simplesmente não aparece para o supervisor atribuir a lista.
    """
    faltando = db_session.execute(text(f"""
        SELECT c.username
          FROM core.permissoes_modulo p
          JOIN core.modulos_sistema m ON m.id = p.modulo_id AND m.codigo = 'INVENTARIO'
          JOIN core.usuarios c ON c.id = p.usuario_id
         WHERE c.id ~* '{_RE_UUID}'
           AND NOT EXISTS (SELECT 1 FROM inventario.users u WHERE u.id = c.id::uuid)
         ORDER BY c.username
    """)).fetchall()

    assert not faltando, (
        "Usuário(s) com o módulo INVENTARIO sem âncora em inventario.users — "
        "não conseguem criar/contar e não aparecem para atribuição: "
        + ", ".join(u for (u,) in faltando)
    )


def test_usuario_ancorado_tem_vinculo_de_filial(db_session):
    """⭐ A órfã que quase passou — achada conferindo o passo SEGUINTE do roteiro.

    `GET /inventory/{id}/available-users` (a lista de quem pode receber a
    contagem) não lê `users.store_id`: lê o vínculo multi-filial em
    `user_stores`. Ancorar usuário e filial não basta — sem o vínculo o
    supervisor vê "Found 0 available users" e não tem a quem atribuir a lista,
    com tudo mais aparentemente correto.
    """
    sem_vinculo = db_session.execute(text("""
        SELECT u.username
          FROM inventario.users u
         WHERE u.is_active
           AND u.store_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM inventario.user_stores us WHERE us.user_id = u.id)
         ORDER BY u.username
    """)).fetchall()

    assert not sem_vinculo, (
        "Usuário(s) ancorado(s) sem nenhuma filial em user_stores — não "
        "aparecem em available-users e não podem receber lista de contagem: "
        + ", ".join(u for (u,) in sem_vinculo)
    )


def test_vinculo_usuario_filial_nao_duplica(db_session):
    """`user_stores` só tem PK em `id`, então nada impede o mesmo par repetido.

    Duplicata faz o usuário aparecer N vezes na atribuição. A 020 cria a UNIQUE
    natural quando a tabela está limpa; este teste guarda a propriedade.
    """
    duplicados = db_session.execute(text("""
        SELECT u.username, s.code, COUNT(*)
          FROM inventario.user_stores us
          JOIN inventario.users  u ON u.id = us.user_id
          JOIN inventario.stores s ON s.id = us.store_id
         GROUP BY u.username, s.code
        HAVING COUNT(*) > 1
         ORDER BY 1, 2
    """)).fetchall()

    assert not duplicados, (
        "Vínculo usuário-filial duplicado em user_stores (usuário aparece "
        "repetido na atribuição): "
        + ", ".join(f"{u}/{c} x{n}" for u, c, n in duplicados)
    )


def test_ancora_usa_o_mesmo_uuid_do_core(db_session):
    """⭐ O ponto que torna a âncora uma âncora.

    Espelhar com UUID PRÓPRIO seria pior que não espelhar: as FKs passariam a
    apontar para uma identidade paralela, e o `current_user.id` vindo do JWT
    continuaria sem casar. O valor todo está em o id ser o MESMO dos dois lados.
    """
    divergentes = db_session.execute(text(f"""
        SELECT c.username
          FROM core.usuarios c
          JOIN inventario.users u ON u.username = LEFT(c.username, 50)
         WHERE c.id ~* '{_RE_UUID}'
           AND u.id <> c.id::uuid
           AND u.username NOT LIKE '%~legado'
         ORDER BY c.username
    """)).fetchall()

    assert not divergentes, (
        "Usuário(s) espelhado(s) com UUID diferente do core — as FKs apontam "
        "para uma identidade paralela e o id do JWT nunca vai casar: "
        + ", ".join(u for (u,) in divergentes)
    )


def test_ancora_nao_permite_login_pelo_caminho_legado(db_session):
    """A linha espelhada não pode virar uma credencial.

    `password_hash` é NOT NULL e no UNIFIED_AUTH não existe senha aqui. O valor
    gravado tem FORMATO de bcrypt (pro passlib não levantar exceção se o modo
    standalone for religado) e CONTEÚDO aleatório, que nenhuma senha produz.
    Um placeholder legível como 'UNIFIED_AUTH' ou '' seria um buraco.
    """
    suspeitos = db_session.execute(text(r"""
        SELECT u.username, LEFT(u.password_hash, 12)
          FROM inventario.users u
          JOIN core.usuarios c ON c.id::text = u.id::text
         WHERE u.password_hash !~ '^\$2[aby]\$\d{2}\$.{53}$'
         ORDER BY u.username
    """)).fetchall()

    assert not suspeitos, (
        "Usuário(s) espelhado(s) com password_hash fora do formato bcrypt — "
        "risco de autenticar pelo caminho standalone: "
        + ", ".join(f"{u} ({h}...)" for u, h in suspeitos)
    )


def test_toda_fk_not_null_para_users_ou_stores_tem_alvo(db_session):
    """⭐ A CLASSE do problema, não os sintomas.

    Varre o schema à procura de coluna NOT NULL com FK para `inventario.users`
    ou `inventario.stores` e exige que a tabela-alvo tenha conteúdo. É o teste
    que teria acusado os três incidentes de 07-08/08 de uma vez — e que acusa o
    próximo, se alguém criar uma FK obrigatória nova para essas tabelas depois
    de elas voltarem a esvaziar.
    """
    # `regclass::text` omite o schema quando ele está no search_path (o conftest
    # fixa search_path=inventario), então o alvo é resolvido por pg_class/
    # pg_namespace em vez de comparar string qualificada.
    obrigatorias = db_session.execute(text("""
        SELECT origem.relname, a.attname, alvo.relname
          FROM pg_constraint c
          JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON TRUE
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          JOIN pg_class origem ON origem.oid = c.conrelid
          JOIN pg_class alvo   ON alvo.oid = c.confrelid
          JOIN pg_namespace n  ON n.oid = alvo.relnamespace
         WHERE c.contype = 'f'
           AND a.attnotnull
           AND n.nspname = 'inventario'
           AND alvo.relname IN ('users', 'stores')
         ORDER BY 1, 2
    """)).fetchall()

    # Não é sobre o número exato — é sobre existirem e terem alvo.
    assert obrigatorias, "Nenhuma FK NOT NULL encontrada; a varredura não está enxergando o schema."

    vazios = set()
    for _, _, alvo in {(o, c, a) for o, c, a in obrigatorias}:
        (n,) = db_session.execute(
            text(f"SELECT COUNT(*) FROM inventario.{alvo}")
        ).first()
        if n == 0:
            vazios.add(f"inventario.{alvo}")

    assert not vazios, (
        "Tabela(s)-âncora vazia(s) com FK NOT NULL apontando para elas — todo o "
        "caminho de escrita da contagem (criar inventário/lista, contar, auditar, "
        "handoff, encerrar ciclo) está bloqueado: " + ", ".join(sorted(vazios))
        + ". Reaplicar a migration 020."
    )


def test_espelhar_identidade_cria_e_atualiza_sem_reescrever_a_cada_request(db_session):
    """O espelho contínuo (`_espelhar_identidade`) é chamado a CADA request.

    Duas propriedades importam: criar quem apareceu depois da carga inicial, e
    NÃO escrever quando nada mudou — senão toda leitura do módulo vira um UPDATE.
    """
    from app.core.security import _espelhar_identidade

    filial_id = db_session.execute(
        text("SELECT id::text FROM inventario.stores ORDER BY code LIMIT 1")
    ).scalar()
    novo_id = str(uuid.uuid4())
    username = f"teste_ancora_{novo_id[:8]}"

    # 1. Cria quem não existia.
    _espelhar_identidade(db_session, novo_id, username, "Teste Âncora",
                         "teste@ancora.local", "OPERATOR", filial_id)
    linha = db_session.execute(
        text("SELECT full_name, role::text, store_id::text, updated_at "
             "FROM inventario.users WHERE id = CAST(:i AS uuid)"),
        {"i": novo_id},
    ).first()
    assert linha is not None, "_espelhar_identidade não criou a linha do usuário novo"
    assert linha[1] == "OPERATOR"
    assert linha[2] == filial_id
    carimbo_inicial = linha[3]

    # 2. Nada mudou: não pode escrever.
    _espelhar_identidade(db_session, novo_id, username, "Teste Âncora",
                         "teste@ancora.local", "OPERATOR", filial_id)
    carimbo = db_session.execute(
        text("SELECT updated_at FROM inventario.users WHERE id = CAST(:i AS uuid)"),
        {"i": novo_id},
    ).scalar()
    assert carimbo == carimbo_inicial, (
        "_espelhar_identidade escreveu sem nada ter mudado — isso põe um UPDATE "
        "em cada request autenticado do módulo."
    )

    # 3. Trocou de papel no Configurador: tem que refletir.
    _espelhar_identidade(db_session, novo_id, username, "Teste Âncora",
                         "teste@ancora.local", "SUPERVISOR", filial_id)
    papel = db_session.execute(
        text("SELECT role::text FROM inventario.users WHERE id = CAST(:i AS uuid)"),
        {"i": novo_id},
    ).scalar()
    assert papel == "SUPERVISOR", "_espelhar_identidade não refletiu a troca de papel"

    # A função comita por conta própria (é chamada fora da transação do request),
    # então a limpeza é explícita — a reversão do fixture não a alcança.
    db_session.execute(text("DELETE FROM inventario.users WHERE id = CAST(:i AS uuid)"),
                       {"i": novo_id})
    db_session.commit()


def test_id_nao_uuid_nao_derruba_a_requisicao(db_session):
    """O Prisma pode gerar `cuid`, que não cabe num UUID nativo.

    Nesse caso o espelho tem que desistir com aviso, não estourar: quem só lê
    não deve ser barrado por um problema de espelho.
    """
    from app.core.security import _espelhar_identidade

    # Não deve levantar.
    _espelhar_identidade(db_session, "clh3k2j9x0000qwerty", "cuid_user",
                         "Usuario Cuid", "cuid@local", "OPERATOR", None)

    existe = db_session.execute(
        text("SELECT COUNT(*) FROM inventario.users WHERE username = 'cuid_user'")
    ).scalar()
    assert existe == 0, "id não-UUID não pode gerar linha espelhada"
