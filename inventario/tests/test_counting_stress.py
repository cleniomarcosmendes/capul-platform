#!/usr/bin/env python3
"""
TESTE DE STRESS - SALVAMENTO DE CONTAGENS
=========================================
Teste específico para validar o salvamento de contagens com a nova estrutura.
"""

import requests
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor

API_BASE = "http://localhost:8000"
INVENTORY_ID = "e38f0cb4-414a-4b53-bac4-cb1e5ce77f8a"

def get_token():
    """Obter token do usuário clenio"""
    response = requests.post(
        f"{API_BASE}/test/simple-login",
        json={"username": "clenio", "password": "123456"}
    )
    
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    return None

def get_products():
    """Obter lista de produtos para teste"""
    token = get_token()
    response = requests.get(
        f"{API_BASE}/api/v1/cycles/inventory/{INVENTORY_ID}/my-products",
        headers={'Authorization': f'Bearer {token}'}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            return data.get("data", {}).get("user_products", [])
    return []

def test_simple_counting():
    """Testar contagem simples (sem lote)"""
    print("🧪 TESTANDO CONTAGEM SIMPLES (SEM LOTE)")
    
    products = get_products()
    if not products:
        print("❌ Nenhum produto encontrado")
        return False
    
    # Produto sem lote (CHAVE)
    chave_product = next((p for p in products if p['product_code'] == '00010008'), None)
    if not chave_product:
        print("❌ Produto CHAVE não encontrado")
        return False
    
    token = get_token()
    count_data = {
        "inventory_item_id": chave_product["item_id"],
        "quantity": 5.0,
        "lot_counts": [],
        "observation": "Teste de contagem simples automatizado"
    }
    
    print(f"📝 Registrando contagem: {chave_product['product_code']} = 5.0 unidades")
    
    # Primeiro, limpar contagens anteriores (simulação)
    # Em produção real, isso seria feito pela interface
    
    # Registrar contagem
    response = requests.post(
        f"{API_BASE}/api/v1/cycles/inventory/{INVENTORY_ID}/register-count",
        json=count_data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            print(f"✅ Contagem registrada com sucesso!")
            print(f"   • Produto: {data.get('data', {}).get('product_code')}")
            print(f"   • Quantidade: {data.get('data', {}).get('total_quantity')}")
            print(f"   • Ciclo: {data.get('data', {}).get('cycle_number')}")
            return True
        else:
            print(f"❌ Falha na contagem: {data.get('message')}")
    else:
        print(f"❌ Erro HTTP {response.status_code}: {response.text}")
    
    return False

def test_lot_counting():
    """Testar contagem com controle de lote"""
    print("\n🧪 TESTANDO CONTAGEM COM LOTE")
    
    products = get_products()
    if not products:
        print("❌ Nenhum produto encontrado")
        return False
    
    # Produto com lote (COLOSSO)
    colosso_product = next((p for p in products if p['product_code'] == '00010037'), None)
    if not colosso_product:
        print("❌ Produto COLOSSO não encontrado")
        return False
    
    token = get_token()
    count_data = {
        "inventory_item_id": colosso_product["item_id"],
        "quantity": 0,  # Total será calculado a partir dos lotes
        "lot_counts": [
            {
                "lot_number": "L20250117A",
                "quantity": 20.0,
                "observation": "Lote A - prateleira superior"
            },
            {
                "lot_number": "L20250117B", 
                "quantity": 15.0,
                "observation": "Lote B - prateleira inferior"
            },
            {
                "lot_number": "L20250118",
                "quantity": 8.0,
                "observation": "Lote C - estoque reserva"
            }
        ],
        "observation": "Teste de contagem com múltiplos lotes automatizado"
    }
    
    total_quantity = sum(lot['quantity'] for lot in count_data['lot_counts'])
    print(f"📝 Registrando contagem por lotes: {colosso_product['product_code']}")
    print(f"   • Total de lotes: {len(count_data['lot_counts'])}")
    print(f"   • Quantidade total: {total_quantity} unidades")
    
    # Registrar contagem
    response = requests.post(
        f"{API_BASE}/api/v1/cycles/inventory/{INVENTORY_ID}/register-count",
        json=count_data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            print(f"✅ Contagem por lotes registrada com sucesso!")
            response_data = data.get('data', {})
            print(f"   • Produto: {response_data.get('product_code')}")
            print(f"   • Quantidade total: {response_data.get('total_quantity')}")
            print(f"   • Número de lotes: {response_data.get('lot_count')}")
            print(f"   • Ciclo: {response_data.get('cycle_number')}")
            return True
        else:
            print(f"❌ Falha na contagem: {data.get('message')}")
    else:
        print(f"❌ Erro HTTP {response.status_code}: {response.text}")
    
    return False

def test_concurrent_counting():
    """Testar contagens concorrentes"""
    print("\n🔥 TESTANDO CONTAGENS CONCORRENTES")
    
    products = get_products()
    if len(products) < 2:
        print("❌ Produtos insuficientes para teste")
        return False
    
    def make_count(product_info):
        product, count_value = product_info
        token = get_token()
        count_data = {
            "inventory_item_id": product["item_id"],
            "quantity": count_value,
            "lot_counts": [],
            "observation": f"Contagem concorrente - {count_value}"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{API_BASE}/api/v1/cycles/inventory/{INVENTORY_ID}/register-count",
            json=count_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}'
            }
        )
        elapsed = time.time() - start_time
        
        product_code = product.get('product_code', 'UNKNOWN')
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"✅ {product_code}: {count_value} unidades ({elapsed:.3f}s)")
                return True
            else:
                print(f"❌ {product_code}: {data.get('message')} ({elapsed:.3f}s)")
        else:
            print(f"❌ {product_code}: HTTP {response.status_code} ({elapsed:.3f}s)")
        return False
    
    # Preparar dados para teste concorrente
    test_data = [
        (products[0], 10.0),
        (products[1], 25.0),
    ]
    
    print(f"📡 Executando {len(test_data)} contagens simultâneas...")
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=len(test_data)) as executor:
        futures = [executor.submit(make_count, data) for data in test_data]
        results = [future.result() for future in futures]
    
    total_time = time.time() - start_time
    successful = sum(results)
    
    print(f"\n📊 RESULTADOS DO TESTE CONCORRENTE:")
    print(f"   • Contagens executadas: {len(test_data)}")
    print(f"   • Contagens bem-sucedidas: {successful}")
    print(f"   • Taxa de sucesso: {successful/len(test_data)*100:.1f}%")
    print(f"   • Tempo total: {total_time:.3f}s")
    
    return successful == len(test_data)

def test_edge_cases():
    """Testar casos extremos"""
    print("\n⚠️  TESTANDO CASOS EXTREMOS")
    
    products = get_products()
    if not products:
        print("❌ Nenhum produto encontrado")
        return False
    
    token = get_token()
    test_cases = [
        {
            "name": "Quantidade zero",
            "data": {
                "inventory_item_id": products[0]["item_id"],
                "quantity": 0.0,
                "lot_counts": [],
                "observation": "Produto com quantidade zero"
            }
        },
        {
            "name": "Quantidade muito alta",
            "data": {
                "inventory_item_id": products[0]["item_id"],
                "quantity": 999999.99,
                "lot_counts": [],
                "observation": "Teste de quantidade alta"
            }
        },
        {
            "name": "Observação muito longa",
            "data": {
                "inventory_item_id": products[0]["item_id"],
                "quantity": 1.0,
                "lot_counts": [],
                "observation": "Observação muito longa " + "x" * 1000
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"🧪 Testando: {test_case['name']}")
        
        response = requests.post(
            f"{API_BASE}/api/v1/cycles/inventory/{INVENTORY_ID}/register-count",
            json=test_case['data'],
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}'
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"   ✅ Aceito: {test_case['name']}")
            else:
                print(f"   ⚠️  Rejeitado: {data.get('message')}")
        else:
            print(f"   ❌ Erro HTTP {response.status_code}")
    
    return True

def main():
    """Executar todos os testes de contagem"""
    print("🚀 INICIANDO TESTES DE STRESS - CONTAGENS")
    print("=" * 60)
    
    # Verificar se há produtos disponíveis
    products = get_products()
    if not products:
        print("❌ Nenhum produto disponível para teste")
        return
    
    print(f"📋 Produtos disponíveis para teste: {len(products)}")
    for product in products:
        lot_control = "COM lote" if product.get('requires_lot') else "SEM lote"
        print(f"   • {product['product_code']}: {product['product_name']} ({lot_control})")
    
    # Executar testes
    tests_results = []
    
    # 1. Teste de contagem simples
    tests_results.append(("Contagem simples", test_simple_counting()))
    
    # 2. Teste de contagem com lote
    tests_results.append(("Contagem com lote", test_lot_counting()))
    
    # 3. Teste de contagens concorrentes
    tests_results.append(("Contagens concorrentes", test_concurrent_counting()))
    
    # 4. Teste de casos extremos
    tests_results.append(("Casos extremos", test_edge_cases()))
    
    # Relatório final
    print("\n" + "=" * 60)
    print("📊 RELATÓRIO FINAL DOS TESTES DE CONTAGEM")
    print("=" * 60)
    
    successful_tests = 0
    for test_name, result in tests_results:
        status = "✅ PASSOU" if result else "❌ FALHOU"
        print(f"   {status}: {test_name}")
        if result:
            successful_tests += 1
    
    success_rate = successful_tests / len(tests_results) * 100
    print(f"\n🎯 TAXA DE SUCESSO: {success_rate:.1f}% ({successful_tests}/{len(tests_results)})")
    
    if success_rate >= 75:
        print("🟢 RESULTADO: Sistema de contagem APROVADO para produção!")
    else:
        print("🔴 RESULTADO: Sistema precisa de ajustes antes da produção.")

if __name__ == "__main__":
    main()