#!/usr/bin/env python3
"""
Script MANUAL de diagnóstico da API Protheus (erro 500 por armazém).

NÃO é teste automatizado — bate na API de PRODUÇÃO. O nome começava com `test_`, o
que fazia o pytest coletá-lo junto da suíte: `test_api(filial, armazem)` virava um
teste cujos parâmetros o pytest tentava resolver como fixtures inexistentes, e a
suíte do Inventário terminava com erro. Renomeado para `diag_` em 02/08/2026.

Uso:
    export PROTHEUS_INVENTARIO_AUTH="<basic base64>"
    python diag_api_protheus.py
"""
import httpx
import json
import os
import sys
import time

PROTHEUS_API_URL = os.getenv(
    "PROTHEUS_INVENTARIO_URL",
    "https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES/inventario/produtos",
)
# Sem credencial embutida: ela vem do ambiente. O valor estava fixo aqui e é um dos
# locais listados no Anexo B de `docs/PENDENCIAS_PROTHEUS_10052026_SEGURANCA.md`.
PROTHEUS_AUTH = os.getenv("PROTHEUS_INVENTARIO_AUTH", "")

def test_api(filial, armazem):
    """Testa chamada à API Protheus"""

    headers = {
        "Authorization": f"Basic {PROTHEUS_AUTH}",
        "Content-Type": "application/json"
    }

    payload = {
        "filial": filial,
        "armazem": [{"codigo": arm} for arm in armazem]
    }

    print(f"\n{'='*80}")
    print(f"TESTE API PROTHEUS - Filial {filial}, Armazéns: {', '.join(armazem)}")
    print(f"{'='*80}")
    print(f"📦 Payload: {json.dumps(payload, indent=2)}")

    try:
        start = time.time()

        with httpx.Client(verify=False, timeout=900.0) as client:
            print(f"\n📡 Enviando requisição...")
            response = client.post(PROTHEUS_API_URL, json=payload, headers=headers)

            duration = time.time() - start
            print(f"⏱️  Tempo de resposta: {duration:.2f}s")
            print(f"📊 Status Code: {response.status_code}")

            if response.status_code == 200:
                try:
                    data = response.json()
                    produtos = data.get("produtos", [])
                    print(f"✅ Sucesso! {len(produtos)} produtos recebidos")

                    if len(produtos) > 0:
                        print(f"\n📦 Primeiro produto (exemplo):")
                        print(f"   - Código: {produtos[0].get('b1_cod')}")
                        print(f"   - Descrição: {produtos[0].get('b1_desc')[:50] if produtos[0].get('b1_desc') else 'N/A'}")
                        print(f"   - Armazéns: {len(produtos[0].get('armazens', []))}")
                        print(f"   - Lotes: {len(produtos[0].get('lotes', []))}")

                except json.JSONDecodeError as e:
                    print(f"❌ Erro ao decodificar JSON: {e}")
                    print(f"📄 Resposta (primeiros 500 chars): {response.text[:500]}")
            else:
                print(f"❌ ERRO HTTP {response.status_code}")
                print(f"📄 Resposta: {response.text[:500]}")

    except httpx.TimeoutException as e:
        print(f"⏱️  ❌ TIMEOUT após {duration:.2f}s: {e}")
    except Exception as e:
        print(f"❌ Erro inesperado: {type(e).__name__}: {e}")

if __name__ == "__main__":
    if not PROTHEUS_AUTH:
        print("PROTHEUS_INVENTARIO_AUTH nao definido — exporte a credencial antes de rodar.")
        sys.exit(1)
    print("="*80)
    print("DIAGNÓSTICO DE ERRO NA API PROTHEUS")
    print("="*80)

    # Teste 1: Armazém 02 (que funciona)
    print("\n🧪 TESTE 1: Filial 02, Armazém 02 (deve funcionar)")
    test_api("02", ["02"])

    # Teste 2: Armazém 01 (que quebra)
    print("\n🧪 TESTE 2: Filial 02, Armazém 01 (ERRO 500 esperado)")
    test_api("02", ["01"])

    print(f"\n{'='*80}")
    print("TESTES CONCLUÍDOS")
    print(f"{'='*80}")
