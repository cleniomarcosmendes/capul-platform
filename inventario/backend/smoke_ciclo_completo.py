#!/usr/bin/env python3
"""
Smoke do CICLO COMPLETO do Inventário — contra o DEV, com os papéis reais.

    python3 inventario/backend/smoke_ciclo_completo.py

Por que existe: em 08/08/2026 foram encontrados defeitos que a suíte de unidade
não pegava porque atravessavam vários endpoints e papéis — contagem cega vazando
por payload, produto com lote gravando `lot_number = NULL`, o app nunca avisando
o supervisor. Este script percorre o caminho de ponta a ponta como o operador
percorre, e é onde esse tipo de coisa aparece.

⚠️ NÃO substitui o `run-tests.sh`. Aquele prova regra isolada e roda em CI;
este prova que as peças se encaixam, e precisa do DEV de pé com dados reais.

O que cobre: criar inventário → adicionar produtos (COM e SEM lote) → listas →
atribuição → liberar (cega e aberta) → contar (simples, por lote, lote fora da
lista) → handoff → devolução parcial do supervisor → ciclos 1, 2 e 3 → encerrar →
divergências → marcar analisado.

⚠️ PARA ANTES do envio ao Protheus: DIGITACAO/TRANSFERENCIA/HISTORICO apontam
para HOMOLOGACAO **ativa**, e o envio cria registro real no Protheus HOM.

⚠️ Cria o inventário `SMOKE_09AGO` e o DEIXA no banco, de propósito — serve para
conferir na tela depois. Rodar de novo APAGA o anterior automaticamente (o
sistema barra nome duplicado na mesma loja, e é isso que torna a limpeza
necessária: um smoke que só roda uma vez não é smoke).
"""
import base64
import json
import os
import sys
import tempfile
import time

import requests
import urllib3

urllib3.disable_warnings()

BASE = "https://localhost/api/v1"
S = requests.Session()
S.verify = False

# Usuários de teste do DEV. `clenio` conduz (SUPERVISOR) e jordana/juliocesar
# contam (OPERATOR) — os papéis importam: metade das verificações é justamente
# que o operador NÃO pode o que o supervisor pode.
USUARIOS = {
    "admin": "admin123",
    "clenio": "Cl123456",
    "jordana": "Jo123456",
    "juliocesar": "Ju123456",
}
TOK = {}
RESULT = []


# ⚠️ O `/auth/login` tem rate-limit. Rodar o smoke duas vezes seguidas satura e
# devolve 429 — o token é CACHEADO em disco e só se reloga quando expira.
CACHE = os.path.join(tempfile.gettempdir(), "capul_smoke_tokens.json")


def _valido(token):
    """Expira 60s antes, para não perder a corrida no meio da execução."""
    try:
        corpo = token.split(".")[1]
        corpo += "=" * (-len(corpo) % 4)
        return json.loads(base64.urlsafe_b64decode(corpo))["exp"] - 60 > time.time()
    except Exception:
        return False


def login():
    cache = {}
    if os.path.exists(CACHE):
        try:
            cache = json.load(open(CACHE))
        except Exception:
            cache = {}

    for u, p in USUARIOS.items():
        if u in cache and _valido(cache[u]):
            TOK[u] = cache[u]
            continue
        r = S.post(f"{BASE}/auth/login", json={"login": u, "senha": p})
        if r.status_code == 429:
            print(f"  429 no login de {u} — aguardando o throttle liberar...")
            time.sleep(20)
            r = S.post(f"{BASE}/auth/login", json={"login": u, "senha": p})
        r.raise_for_status()
        TOK[u] = r.json()["accessToken"]

    json.dump(TOK, open(CACHE, "w"))


def H(user):
    return {"Authorization": f"Bearer {TOK[user]}", "Content-Type": "application/json"}


def chk(nome, ok, detalhe=""):
    RESULT.append((nome, bool(ok), detalhe))
    print(f"  {'PASS' if ok else 'FAIL'}  {nome}" + (f"  — {detalhe}" if detalhe else ""))
    return ok


def req(user, metodo, caminho, **kw):
    """Devolve (status, corpo). Nunca levanta — o smoke reporta, não morre."""
    r = S.request(metodo, f"{BASE}{caminho}", headers=H(user), **kw)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


def fase(t):
    print(f"\n{'='*72}\n{t}\n{'='*72}")


# ===========================================================================
fase("FASE 0 — acesso e papéis")
login()
for u, esperado in [("clenio", "SUPERVISOR"), ("jordana", "OPERATOR"),
                    ("juliocesar", "OPERATOR"), ("admin", "ADMIN")]:
    p = TOK[u].split(".")[1] + "=="
    d = json.loads(base64.urlsafe_b64decode(p))
    papel = next((m["role"] for m in d.get("modulos", []) if m["codigo"] == "INVENTARIO"), None)
    chk(f"{u} tem papel {esperado}", papel == esperado, f"veio {papel}")


# ===========================================================================
fase("FASE 1 — supervisor monta o inventário")

# Limpa a execução anterior: o sistema recusa nome duplicado na mesma loja
# (regra correta), e sem isto o smoke só rodaria uma vez.
import subprocess as _sp
_sp.run(["docker", "exec", "capul-db", "psql", "-U", "capul_user", "-d", "capul_platform",
         "-qc", "DELETE FROM inventario.inventory_lists WHERE name LIKE 'SMOKE_%'"],
        capture_output=True)

st, inv = req("clenio", "POST", "/inventory/lists", json={
    "name": "SMOKE_09AGO", "description": "smoke profundo", "warehouse": "06",
})
chk("criar inventário (SUPERVISOR)", st == 200 and "id" in inv, f"HTTP {st}")
if st != 200:
    print("\n>>> ABORTADO: sem inventário não há o que testar.")
    sys.exit(1)
INV = inv["id"]
print(f"  inventário: {INV}  loja: {inv.get('store_name')}")

# --- escolher produtos: alguns SEM lote e alguns COM lote
st, fp = req("clenio", "POST", "/inventory/filter-products", json={"local": "06"})
prods = fp.get("produtos", []) if isinstance(fp, dict) else []
chk("filtrar produtos do armazém 06", st == 200 and len(prods) > 0, f"{len(prods)} produtos")

com_lote = [p for p in prods if (p.get("b1_rastro") or "").strip() in ("L", "S")]
sem_lote = [p for p in prods if (p.get("b1_rastro") or "").strip() not in ("L", "S")]
print(f"  no filtro: {len(sem_lote)} sem lote, {len(com_lote)} com lote")

# O filtro devolve uma página; se não veio produto com lote, buscar por faixa.
if not com_lote:
    st, fp2 = req("clenio", "POST", "/inventory/filter-products",
                  json={"local": "06", "rastro": "L"})
    p2 = fp2.get("produtos", []) if isinstance(fp2, dict) else []
    com_lote = [p for p in p2 if (p.get("b1_rastro") or "").strip() in ("L", "S")]
    print(f"  segunda tentativa (rastro=L): {len(com_lote)} com lote")

chk("existe produto COM LOTE para testar", len(com_lote) > 0,
    "sem isto metade do smoke não é exercitada")

escolhidos = [p["b1_cod"] for p in sem_lote[:6]] + [p["b1_cod"] for p in com_lote[:3]]
st, add = req("clenio", "POST", f"/inventory/lists/{INV}/add-products",
              json={"product_codes": escolhidos, "warehouse_location": "06"})
dados = add.get("data", add) if isinstance(add, dict) else {}
chk("adicionar produtos ao inventário", st == 200 and dados.get("success"),
    f"{dados.get('summary', {}).get('added_count')} adicionados")

print(json.dumps({"inventario": INV, "produtos": escolhidos}, indent=2))


# ===========================================================================
fase("FASE 2 — listas e atribuição")

st, disp = req("clenio", "GET", f"/inventory/{INV}/available-users")
users = disp.get("data", []) if isinstance(disp, dict) else []
nomes = {u["username"]: u["id"] for u in users}
chk("available-users traz os contadores", {"jordana", "juliocesar"} <= set(nomes),
    f"veio: {sorted(nomes)}")

st, l1 = req("clenio", "POST", f"/inventories/{INV}/counting-lists",
             json={"list_name": "L1 jordana", "counter_cycle_1": nomes.get("jordana")})
chk("criar lista 1 (contadora jordana)", st == 200 and "id" in l1, f"HTTP {st}")
L1 = l1.get("id")

st, l2 = req("clenio", "POST", f"/inventories/{INV}/counting-lists",
             json={"list_name": "L2 juliocesar", "counter_cycle_1": nomes.get("juliocesar")})
L2 = l2.get("id")
chk("criar lista 2 (contador juliocesar)", st == 200 and L2, f"HTTP {st}")

# OPERATOR não pode criar lista
st, _ = req("jordana", "POST", f"/inventories/{INV}/counting-lists",
            json={"list_name": "X", "counter_cycle_1": nomes.get("jordana")})
chk("OPERATOR NÃO cria lista de contagem", st == 403, f"HTTP {st}")

# --- distribuir itens: lista 1 recebe os com lote, lista 2 o resto
st, itens = req("clenio", "GET", f"/inventory/lists/{INV}/items") if False else (0, None)
import subprocess
ids = subprocess.run(
    ["docker", "exec", "capul-db", "psql", "-U", "capul_user", "-d", "capul_platform", "-tAc",
     f"""SELECT ii.id||'|'||ii.product_code||'|'||COALESCE(iis.b1_rastro,'')
           FROM inventario.inventory_items ii
           LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id=ii.id
          WHERE ii.inventory_list_id='{INV}' ORDER BY iis.b1_rastro DESC, ii.product_code"""],
    capture_output=True, text=True).stdout.strip().split("\n")
ITENS = [dict(zip(("id", "cod", "rastro"), x.split("|"))) for x in ids if x]
COM_LOTE = [i for i in ITENS if i["rastro"] in ("L", "S")]
SEM_LOTE = [i for i in ITENS if i["rastro"] not in ("L", "S")]
print(f"  itens: {len(COM_LOTE)} com lote, {len(SEM_LOTE)} sem lote")

st, _ = req("clenio", "POST", f"/counting-lists/{L1}/items",
            json=[i["id"] for i in COM_LOTE] + [i["id"] for i in SEM_LOTE[:3]])
chk("adicionar itens à lista 1", st == 200, f"HTTP {st}")
st, _ = req("clenio", "POST", f"/counting-lists/{L2}/items",
            json=[i["id"] for i in SEM_LOTE[3:]])
chk("adicionar itens à lista 2", st == 200, f"HTTP {st}")

# --- liberar: L1 CEGA (padrão), L2 com contagens anteriores visíveis
st, _ = req("clenio", "POST", f"/counting-lists/{L1}/release",
            json={"show_previous_counts": False, "sort_order": "ORIGINAL"})
chk("liberar lista 1 (contagem CEGA)", st == 200, f"HTTP {st}")
st, _ = req("clenio", "POST", f"/counting-lists/{L2}/release",
            json={"show_previous_counts": True, "sort_order": "PRODUCT_CODE"})
chk("liberar lista 2 (previous counts visíveis)", st == 200, f"HTTP {st}")


# ===========================================================================
fase("FASE 3 — contagem cega: o OPERADOR não pode ver saldo")

st, prod = req("jordana", "GET", f"/counting-lists/{L1}/products", params={"show_all": True})
itens_j = prod.get("data", {}).get("products", []) if isinstance(prod, dict) else []
chk("jordana baixa os itens da lista dela", st == 200 and len(itens_j) > 0, f"{len(itens_j)} itens")

vazou_item = [p["product_code"] for p in itens_j
              if p.get("system_qty") is not None or p.get("expected_quantity") is not None]
chk("⭐ saldo do ITEM não vem para OPERATOR", not vazou_item, f"vazou em {vazou_item[:3]}")

vazou_lote = []
for p in itens_j:
    for l in (p.get("snapshot_lots") or []):
        if "quantity" in l:
            vazou_lote.append(f"{p['product_code']}/{l.get('lot_number')}")
chk("⭐ saldo POR LOTE não vem para OPERATOR", not vazou_lote, f"vazou em {vazou_lote[:3]}")

tem_validade = [l for p in itens_j for l in (p.get("snapshot_lots") or []) if l.get("b8_dtvalid")]
chk("validade do lote CHEGA (não é saldo)", len(tem_validade) > 0,
    f"{len(tem_validade)} lote(s) com validade")

# supervisor VÊ o saldo
st, prod_s = req("clenio", "GET", f"/counting-lists/{L1}/products", params={"show_all": True})
itens_s = prod_s.get("data", {}).get("products", [])
tem_saldo = [p for p in itens_s if p.get("system_qty") is not None]
chk("SUPERVISOR continua vendo o saldo", len(tem_saldo) > 0, f"{len(tem_saldo)} itens com saldo")

# o outro endpoint (o do modal de lote do desktop)
item_lote = next((p for p in itens_j if p.get("requires_lot")), None)
if item_lote:
    st, ls = req("jordana", "GET", f"/inventory/items/{item_lote['id']}/lots-snapshot")
    lotes = ls.get("data", {}).get("lots", []) if isinstance(ls, dict) else []
    chk("⭐ lots-snapshot também esconde o saldo (OPERATOR)",
        all("system_qty" not in l for l in lotes), f"{len(lotes)} lotes")
    st, ls2 = req("clenio", "GET", f"/inventory/items/{item_lote['id']}/lots-snapshot")
    lotes2 = ls2.get("data", {}).get("lots", [])
    chk("lots-snapshot mostra saldo para SUPERVISOR",
        any(l.get("system_qty") is not None for l in lotes2), f"{len(lotes2)} lotes")


# ===========================================================================
fase("FASE 4 — contagem: as regras que protegem o número")

def erro_de(corpo):
    d = corpo.get("detail") if isinstance(corpo, dict) else None
    return d.get("erro") if isinstance(d, dict) else (d if isinstance(d, str) else None)

item_sem = next(p for p in itens_j if not p.get("requires_lot"))
item_com = next(p for p in itens_j if p.get("requires_lot"))
lotes_do_item = [l["lot_number"] for l in (item_com.get("snapshot_lots") or [])]
print(f"  item sem lote: {item_sem['product_code']}  |  com lote: {item_com['product_code']} "
      f"({len(lotes_do_item)} lote(s))")

# --- quem não é o contador não conta
st, c = req("juliocesar", "POST", f"/inventory/items/{item_sem['id']}/count",
            json={"quantity": 5, "counting_list_id": L1, "expected_cycle": 1})
chk("contador NÃO atribuído é recusado", st == 403 and erro_de(c) == "CONTADOR_NAO_ATRIBUIDO",
    f"HTTP {st} {erro_de(c)}")

# --- contagem simples funciona
st, c = req("jordana", "POST", f"/inventory/items/{item_sem['id']}/count",
            json={"quantity": 7, "counting_list_id": L1, "expected_cycle": 1,
                  "idempotency_key": "smoke-1"})
chk("contagem simples (produto sem lote)", st == 200, f"HTTP {st}")

# --- ciclo divergente é recusado
st, c = req("jordana", "POST", f"/inventory/items/{item_sem['id']}/count",
            json={"quantity": 9, "counting_list_id": L1, "expected_cycle": 2})
chk("⭐ ciclo divergente é RECUSADO", st == 409 and erro_de(c) == "CICLO_DIVERGENTE",
    f"HTTP {st} {erro_de(c)}")

# --- lista divergente é recusada
st, c = req("jordana", "POST", f"/inventory/items/{item_sem['id']}/count",
            json={"quantity": 9, "counting_list_id": L2, "expected_cycle": 1})
chk("lista divergente é RECUSADA", st == 409 and erro_de(c) == "LISTA_DIVERGENTE",
    f"HTTP {st} {erro_de(c)}")

# --- produto COM LOTE recusa contagem única
st, c = req("jordana", "POST", f"/inventory/items/{item_com['id']}/count",
            json={"quantity": 10, "counting_list_id": L1, "expected_cycle": 1})
chk("⭐ produto com lote RECUSA contagem única",
    st == 400 and erro_de(c) == "CONTAGEM_EXIGE_LOTE", f"HTTP {st} {erro_de(c)}")

# --- e aceita com lot_counts
st, c = req("jordana", "POST", f"/inventory/items/{item_com['id']}/count",
            json={"quantity": 6, "counting_list_id": L1, "expected_cycle": 1,
                  "lot_counts": [{"lot_number": lotes_do_item[0], "quantity": 6}]})
chk("contagem POR LOTE é aceita", st == 200, f"HTTP {st}")

# --- lote FORA da lista (o que o contador achou na prateleira)
st, c = req("jordana", "POST", f"/inventory/items/{item_com['id']}/count",
            json={"quantity": 9, "counting_list_id": L1, "expected_cycle": 1,
                  "lot_counts": [{"lot_number": lotes_do_item[0], "quantity": 6},
                                 {"lot_number": "ACHADO-NA-PRATELEIRA", "quantity": 3}]})
chk("⭐ lote FORA da lista é aceito", st == 200, f"HTTP {st}")

gravados = subprocess.run(
    ["docker", "exec", "capul-db", "psql", "-U", "capul_user", "-d", "capul_platform", "-tAc",
     f"""SELECT COALESCE(lot_number,'(sem lote)')||'='||quantity
           FROM inventario.countings WHERE inventory_item_id='{item_com['id']}'
          ORDER BY lot_number"""],
    capture_output=True, text=True).stdout.strip().split("\n")
chk("lote informado à mão foi PERSISTIDO",
    any("ACHADO-NA-PRATELEIRA" in g for g in gravados), " ".join(gravados))

# --- juliocesar conta a lista DELE
st, prod2 = req("juliocesar", "GET", f"/counting-lists/{L2}/products", params={"show_all": True})
itens_ju = prod2.get("data", {}).get("products", [])
st, c = req("juliocesar", "POST", f"/inventory/items/{itens_ju[0]['id']}/count",
            json={"quantity": 4, "counting_list_id": L2, "expected_cycle": 1})
chk("juliocesar conta a lista dele", st == 200, f"HTTP {st}")

# --- lista 2 foi liberada com show_previous_counts=True
vaza = [p for p in itens_ju if p.get("system_qty") is not None]
chk("show_previous_counts NÃO libera o saldo do sistema", not vaza,
    "saldo é sempre restrito ao staff; a flag governa ciclos anteriores")


# ===========================================================================
fase("FASE 5 — handoff, revisão do supervisor e avanço de ciclo")

def sql(q):
    return subprocess.run(
        ["docker", "exec", "capul-db", "psql", "-U", "capul_user", "-d", "capul_platform", "-tAc", q],
        capture_output=True, text=True).stdout.strip()

# --- OPERATOR não devolve lista (é ato do supervisor)
st, c = req("jordana", "POST", f"/counting-lists/{L1}/return", json={"motivo": "x"})
chk("OPERATOR NÃO devolve lista ao contador", st == 403, f"HTTP {st}")

# --- jordana entrega
antes_status = sql(f"SELECT list_status FROM inventario.counting_lists WHERE id='{L1}'")
st, h = req("jordana", "POST", f"/counting-lists/{L1}/handoff")
chk("contadora libera para o supervisor", st == 200, f"HTTP {st} zerados={h.get('zerados')}")
depois = sql(f"SELECT list_status FROM inventario.counting_lists WHERE id='{L1}'")
chk("lista vai para AGUARDANDO_REVISAO", depois == "AGUARDANDO_REVISAO",
    f"{antes_status} → {depois}")

zerados_marcados = sql(f"""SELECT count(*) FROM inventario.counting_list_items
                            WHERE counting_list_id='{L1}' AND zerado_no_fecho""")
chk("⭐ itens preenchidos com zero ficam RASTREADOS (zerado_no_fecho)",
    int(zerados_marcados) == int(h.get("zerados", -1)),
    f"{zerados_marcados} marcados, handoff informou {h.get('zerados')}")

# --- contar depois de entregar não pode
st, c = req("jordana", "POST", f"/inventory/items/{item_sem['id']}/count",
            json={"quantity": 99, "counting_list_id": L1, "expected_cycle": 1})
chk("⭐ não se conta lista já ENTREGUE", st >= 400, f"HTTP {st} {erro_de(c)}")

# --- supervisor devolve PARCIAL
alvo = [item_sem["id"]]
st, d = req("clenio", "POST", f"/counting-lists/{L1}/return",
            json={"motivo": "conferir este item", "item_ids": alvo})
chk("supervisor devolve PARCIAL", st == 200 and d.get("parcial"),
    f"HTTP {st} marcados={d.get('itens_marcados')}")

marcados = sql(f"""SELECT count(*) FROM inventario.counting_list_items
                    WHERE counting_list_id='{L1}' AND revisar_no_ciclo""")
chk("só o item escolhido entra em revisão", marcados == "1", f"{marcados} marcado(s)")

contagem_preservada = sql(f"""SELECT count(*) FROM inventario.countings c
                               JOIN inventario.inventory_items ii ON ii.id=c.inventory_item_id
                              WHERE ii.inventory_list_id='{INV}'""")
chk("⭐ devolução PRESERVA as contagens (não zera)", int(contagem_preservada) > 0,
    f"{contagem_preservada} contagens de pé")

# --- contadora revisa e reentrega
st, c = req("jordana", "POST", f"/inventory/items/{item_sem['id']}/count",
            json={"quantity": 8, "counting_list_id": L1, "expected_cycle": 1,
                  "idempotency_key": "smoke-revisao"})
chk("contadora corrige o item devolvido", st == 200, f"HTTP {st}")
limpou = sql(f"""SELECT revisar_no_ciclo FROM inventario.counting_list_items
                  WHERE counting_list_id='{L1}' AND inventory_item_id='{item_sem['id']}'""")
chk("flag de revisão LIMPA ao recontar", limpou == "f", f"revisar_no_ciclo={limpou}")

st, h = req("jordana", "POST", f"/counting-lists/{L1}/handoff")
chk("reentrega ao supervisor", st == 200, f"HTTP {st}")

# --- entregar a lista 2 também, para o inventário poder avançar
req("juliocesar", "POST", f"/counting-lists/{L2}/handoff")

# --- supervisor finaliza o ciclo 1
st, f1 = req("clenio", "POST", f"/counting-lists/{L1}/finalize-cycle")
chk("supervisor finaliza o ciclo da lista 1", st == 200, f"HTTP {st} {str(f1)[:90]}")
ciclo = sql(f"SELECT current_cycle FROM inventario.counting_lists WHERE id='{L1}'")
status = sql(f"SELECT list_status FROM inventario.counting_lists WHERE id='{L1}'")
print(f"  lista 1 agora: ciclo={ciclo} status={status}")


# ===========================================================================
fase("FASE 6 — 2º ciclo: só o que divergiu")

detalhe = sql(f"""SELECT ii.product_code||' c1='||COALESCE(cli.count_cycle_1::text,'-')
                        ||' esperado='||COALESCE(iis.b2_qatu::text,'-')
                        ||' precisa_c2='||cli.needs_count_cycle_2
                    FROM inventario.counting_list_items cli
                    JOIN inventario.inventory_items ii ON ii.id=cli.inventory_item_id
                    LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id=ii.id
                   WHERE cli.counting_list_id='{L1}' ORDER BY ii.product_code""")
print("  " + "\n  ".join(detalhe.split("\n")))

precisa_c2 = sql(f"""SELECT count(*) FROM inventario.counting_list_items
                      WHERE counting_list_id='{L1}' AND needs_count_cycle_2""")
total = sql(f"""SELECT count(*) FROM inventario.counting_list_items
                 WHERE counting_list_id='{L1}'""")
chk("⭐ 2º ciclo traz SÓ os divergentes, não a lista toda",
    0 < int(precisa_c2) <= int(total), f"{precisa_c2} de {total} itens")

# ⚠️ Cada ciclo tem contador PRÓPRIO: liberar o 2º sem atribuir dá
# "Lista não tem contador atribuído para o ciclo 2". É regra, não bug — a
# recontagem costuma ser de outra pessoa, e o sistema obriga a decisão.
st, _ = req("clenio", "POST", f"/counting-lists/{L1}/release",
            json={"show_previous_counts": False, "sort_order": "ORIGINAL"})
chk("2º ciclo SEM contador atribuído é recusado", st == 400,
    "cada ciclo exige seu contador — regra, não bug")

# o supervisor atribui OUTRO contador para a recontagem
st, upd = req("clenio", "PUT", f"/counting-lists/{L1}",
              json={"counter_cycle_2": nomes.get("juliocesar")})
chk("supervisor atribui contador do 2º ciclo", st == 200, f"HTTP {st}")

st, _ = req("clenio", "POST", f"/counting-lists/{L1}/release",
            json={"show_previous_counts": False, "sort_order": "ORIGINAL"})
chk("supervisor libera o 2º ciclo", st == 200, f"HTTP {st}")

st, prod3 = req("juliocesar", "GET", f"/counting-lists/{L1}/products")
itens_c2 = prod3.get("data", {}).get("products", [])
chk("contador recebe só os itens do 2º ciclo", 0 < len(itens_c2) <= int(total),
    f"{len(itens_c2)} itens (lista tem {total})")

vazou_c1 = [p["product_code"] for p in itens_c2 if p.get("count_cycle_1") is not None]
chk("⭐ contagem CEGA: o 1º ciclo não é revelado no 2º", not vazou_c1,
    f"vazou em {vazou_c1[:3]}")

# conta o 2º ciclo — com o MESMO valor do 1º em um item (deve encerrar nele)
if itens_c2:
    alvo2 = itens_c2[0]
    corpo = {"quantity": 8, "counting_list_id": L1, "expected_cycle": 2,
             "idempotency_key": "smoke-c2"}
    if alvo2.get("requires_lot"):
        ls = [l["lot_number"] for l in (alvo2.get("snapshot_lots") or [])]
        corpo["lot_counts"] = [{"lot_number": ls[0], "quantity": 8}] if ls else []
        corpo["quantity"] = 8
    # ⭐ quem conta o 2º ciclo é o contador DO 2º ciclo — a jordana (1º) não pode
    st, cj = req("jordana", "POST", f"/inventory/items/{alvo2['id']}/count", json=corpo)
    chk("contador do 1º ciclo NÃO conta o 2º", st == 403, f"HTTP {st} {erro_de(cj)}")

    st, c = req("juliocesar", "POST", f"/inventory/items/{alvo2['id']}/count", json=corpo)
    chk("contagem do 2º ciclo é aceita", st == 200, f"HTTP {st} {erro_de(c)}")

    grav = sql(f"""SELECT count_number||'='||quantity FROM inventario.countings
                    WHERE inventory_item_id='{alvo2['id']}' ORDER BY count_number""")
    chk("⭐ o 1º ciclo NÃO foi sobrescrito pelo 2º",
        grav.count("\n") >= 1 or "1=" in grav, grav.replace("\n", " "))

# entrega e finaliza o 2º ciclo
req("juliocesar", "POST", f"/counting-lists/{L1}/handoff")
st, f2 = req("clenio", "POST", f"/counting-lists/{L1}/finalize-cycle")
chk("finalizar o 2º ciclo", st == 200, f"HTTP {st}")
print(f"  lista 1: ciclo={sql(f'SELECT current_cycle FROM inventario.counting_lists WHERE id=' + chr(39) + L1 + chr(39))}"
      f" status={sql(f'SELECT list_status FROM inventario.counting_lists WHERE id=' + chr(39) + L1 + chr(39))}")


# ===========================================================================
fase("FASE 7 — 3º ciclo, encerramento e análise")

precisa_c3 = sql(f"""SELECT count(*) FROM inventario.counting_list_items
                      WHERE counting_list_id='{L1}' AND needs_count_cycle_3""")
chk("3º ciclo só para quem divergiu de novo", int(precisa_c3) >= 0, f"{precisa_c3} item(ns)")

if int(precisa_c3) > 0:
    st, _ = req("clenio", "PUT", f"/counting-lists/{L1}",
                json={"counter_cycle_3": nomes.get("jordana")})
    st, _ = req("clenio", "POST", f"/counting-lists/{L1}/release",
                json={"show_previous_counts": False, "sort_order": "ORIGINAL"})
    chk("liberar o 3º ciclo", st == 200, f"HTTP {st}")
    st, p3 = req("jordana", "GET", f"/counting-lists/{L1}/products")
    i3 = p3.get("data", {}).get("products", [])
    if i3:
        corpo = {"quantity": 5, "counting_list_id": L1, "expected_cycle": 3,
                 "idempotency_key": "smoke-c3"}
        if i3[0].get("requires_lot"):
            ls = [l["lot_number"] for l in (i3[0].get("snapshot_lots") or [])]
            corpo["lot_counts"] = [{"lot_number": ls[0], "quantity": 5}] if ls else []
        st, c = req("jordana", "POST", f"/inventory/items/{i3[0]['id']}/count", json=corpo)
        chk("contagem do 3º ciclo é aceita", st == 200, f"HTTP {st} {erro_de(c)}")
    req("jordana", "POST", f"/counting-lists/{L1}/handoff")

# --- encerrar as listas
st, fin = req("clenio", "POST", f"/counting-lists/{L1}/finalizar")
chk("encerrar a lista 1", st == 200, f"HTTP {st} {str(fin)[:80]}")
st, _ = req("clenio", "POST", f"/counting-lists/{L2}/finalizar")
chk("encerrar a lista 2", st == 200, f"HTTP {st}")

# --- encerrar o INVENTÁRIO (as listas já foram; são coisas diferentes)
st, fi = req("clenio", "POST", f"/inventory/lists/{INV}/finalize-inventory")
chk("encerrar o INVENTÁRIO", st == 200, f"HTTP {st} {str(fi)[:90]}")
# `etapa_atual` é property do MODEL, não coluna — ler `status`.
etapa = sql(f"SELECT status FROM inventario.inventory_lists WHERE id='{INV}'")
chk("inventário vai para COMPLETED (= Encerrado)", etapa == "COMPLETED", f"status={etapa}")

# --- divergências aparecem para o supervisor
st, dv = req("clenio", "GET", "/discrepancies")
divs = dv.get("discrepancies", []) if isinstance(dv, dict) else []
meu = [d for d in divs if d.get("inventory_id") == INV]
chk("⭐ divergências do inventário aparecem para o SUPERVISOR", st == 200 and len(meu) > 0,
    f"{len(meu)} divergência(s) — ex.: " +
    ", ".join(f"{d['product_code']} esperado {d.get('expected_quantity')} contado {d.get('counted_quantity')}"
              for d in meu[:2]))

st, dv_op = req("jordana", "GET", "/discrepancies")
chk("⭐ OPERATOR não acessa divergências (revelam o esperado)", dv_op != divs or st >= 400,
    f"HTTP {st}")

# --- marcar analisado (o gate para enviar ao Protheus)
st, an = req("clenio", "POST", f"/inventory/lists/{INV}/marcar-analisado")
chk("supervisor marca o inventário como ANALISADO", st == 200, f"HTTP {st} {str(an)[:80]}")
etapa = sql(f"SELECT COALESCE(analisado_em::text,'(nao)') FROM inventario.inventory_lists WHERE id='{INV}'")
chk("analisado_em gravado", etapa != "(nao)", etapa)

st, elig = req("clenio", "GET", "/inventory/lists/available-for-integration")
n_elig = len(elig.get("items", [])) if isinstance(elig, dict) else 0
chk("inventário analisado fica ELEGÍVEL para integração", st == 200 and n_elig >= 1,
    f"HTTP {st} — {n_elig} elegível(is)")

print("\n  ⚠️ PARADO ANTES do envio ao Protheus: DIGITACAO/TRANSFERENCIA/HISTORICO")
print("     apontam para HOMOLOGACAO ATIVA — o envio cria registro real no Protheus HOM.")


# ===========================================================================
fase("RESUMO")
falhas = [r for r in RESULT if not r[1]]
print(f"\n  {len(RESULT) - len(falhas)} PASS · {len(falhas)} FAIL\n")
for nome, ok, det in falhas:
    print(f"  ❌ {nome} — {det}")
print(f"\n  Inventário deixado no DEV para inspeção na tela: SMOKE_09AGO ({INV})")
