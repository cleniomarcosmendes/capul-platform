#!/usr/bin/env python3
"""
Prepara o cenário do roteiro de Chrome — e PARA no ponto certo.

    python3 inventario/backend/preparar_teste_chrome.py

O `smoke_ciclo_completo.py` percorre o ciclo até o fim e deixa o inventário
ENCERRADO — ótimo para conferir análise e divergência, inútil para testar
contagem, que é a maior parte do roteiro. Este script deixa um inventário
**parado em EM_CONTAGEM**, com produto COM LOTE, esperando o teste na tela.

Cria `TESTE_CHROME` no armazém 06:
  - "Lista jordana"    → contagem CEGA     (show_previous_counts=False)
  - "Lista juliocesar" → contagem ABERTA   (show_previous_counts=True)

Ambas liberadas e SEM nenhuma contagem — é você quem conta, pela tela.
Reexecutar apaga e refaz.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time

import requests
import urllib3

urllib3.disable_warnings()
BASE = "https://localhost/api/v1"
S = requests.Session()
S.verify = False
USUARIOS = {"clenio": "Cl123456", "jordana": "Jo123456", "juliocesar": "Ju123456"}
CACHE = os.path.join(tempfile.gettempdir(), "capul_smoke_tokens.json")
TOK = {}


def _valido(t):
    try:
        c = t.split(".")[1] + "=="
        return json.loads(base64.urlsafe_b64decode(c))["exp"] - 60 > time.time()
    except Exception:
        return False


def login():
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    for u, p in USUARIOS.items():
        if u in cache and _valido(cache[u]):
            TOK[u] = cache[u]
            continue
        r = S.post(f"{BASE}/auth/login", json={"login": u, "senha": p})
        if r.status_code == 429:
            print(f"  429 no login de {u} — aguardando o throttle...")
            time.sleep(20)
            r = S.post(f"{BASE}/auth/login", json={"login": u, "senha": p})
        r.raise_for_status()
        TOK[u] = r.json()["accessToken"]
    json.dump({**cache, **TOK}, open(CACHE, "w"))


def req(u, m, c, **kw):
    r = S.request(m, f"{BASE}{c}", headers={"Authorization": f"Bearer {TOK[u]}",
                                            "Content-Type": "application/json"}, **kw)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


def sql(q):
    return subprocess.run(["docker", "exec", "capul-db", "psql", "-U", "capul_user",
                           "-d", "capul_platform", "-tAc", q],
                          capture_output=True, text=True).stdout.strip()


login()
sql("DELETE FROM inventario.inventory_lists WHERE name = 'TESTE_CHROME'")

st, inv = req("clenio", "POST", "/inventory/lists", json={
    "name": "TESTE_CHROME", "description": "cenario do roteiro de Chrome", "warehouse": "06"})
if st != 200:
    sys.exit(f"falhou ao criar: {inv}")
INV = inv["id"]

st, fp = req("clenio", "POST", "/inventory/filter-products", json={"local": "06"})
prods = fp.get("produtos", [])
com = [p["b1_cod"] for p in prods if (p.get("b1_rastro") or "").strip() in ("L", "S")][:4]
sem = [p["b1_cod"] for p in prods if (p.get("b1_rastro") or "").strip() not in ("L", "S")][:6]
if not com:
    sys.exit("nenhum produto COM LOTE no armazém 06 — o roteiro precisa de pelo menos um")

req("clenio", "POST", f"/inventory/lists/{INV}/add-products",
    json={"product_codes": com + sem, "warehouse_location": "06"})

st, d = req("clenio", "GET", f"/inventory/{INV}/available-users")
ids = {u["username"]: u["id"] for u in d.get("data", [])}

itens = [x.split("|") for x in sql(f"""
    SELECT ii.id||'|'||COALESCE(iis.b1_rastro,'N') FROM inventario.inventory_items ii
    LEFT JOIN inventario.inventory_items_snapshot iis ON iis.inventory_item_id=ii.id
    WHERE ii.inventory_list_id='{INV}'""").split("\n") if x]
com_lote = [i[0] for i in itens if i[1] in ("L", "S")]
sem_lote = [i[0] for i in itens if i[1] not in ("L", "S")]

# A lista da jordana leva TODOS os produtos com lote — é nela que se testa o
# modal, que é o caso que quebrava a tela do operador.
st, l1 = req("clenio", "POST", f"/inventories/{INV}/counting-lists",
             json={"list_name": "Lista jordana", "counter_cycle_1": ids["jordana"]})
st, l2 = req("clenio", "POST", f"/inventories/{INV}/counting-lists",
             json={"list_name": "Lista juliocesar", "counter_cycle_1": ids["juliocesar"]})
req("clenio", "POST", f"/counting-lists/{l1['id']}/items", json=com_lote + sem_lote[:2])
req("clenio", "POST", f"/counting-lists/{l2['id']}/items", json=sem_lote[2:])
req("clenio", "POST", f"/counting-lists/{l1['id']}/release",
    json={"show_previous_counts": False, "sort_order": "ORIGINAL"})
req("clenio", "POST", f"/counting-lists/{l2['id']}/release",
    json={"show_previous_counts": True, "sort_order": "PRODUCT_CODE"})

print(f"""
✅ TESTE_CHROME pronto — https://localhost/inventario/

   inventário : {INV}
   armazém    : 06
   Lista jordana     — {len(com_lote)} produto(s) COM LOTE + 2 sem  ·  contagem CEGA
   Lista juliocesar  — {len(sem_lote) - 2} produto(s) sem lote      ·  contagem ABERTA

   Nenhuma contagem lançada: é você quem conta, pela tela.

   Produtos COM LOTE (para o modal): {', '.join(com)}
""")
