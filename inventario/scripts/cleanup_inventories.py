#!/usr/bin/env python3
"""
Script para limpeza completa dos dados de inventário
Sistema de Inventário Protheus v2.0
"""
import requests
import sys

def clean_inventories():
    """Limpar todos os inventários e dependências"""
    
    base_url = "http://localhost:8000"
    
    # Token de admin
    admin_token = "token_admin_1736264079"
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    print("🧹 Iniciando limpeza completa dos inventários...")
    
    # Lista das tabelas para limpar (ordem importante devido às FKs)
    tables_to_clear = [
        "countings",
        "discrepancies", 
        "counting_discrepancies",
        "counting_assignments",
        "closed_counting_rounds",
        "counting_lists",
        "inventory_items",
        "inventory_lists"
    ]
    
    cleared_count = 0
    
    for table in tables_to_clear:
        try:
            response = requests.delete(
                f"{base_url}/api/v1/clear/{table}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                count = data.get("deleted_count", 0)
                print(f"✅ {table}: {count} registros removidos")
                cleared_count += count
            else:
                print(f"⚠️ {table}: Erro {response.status_code}")
                
        except Exception as e:
            print(f"❌ Erro ao limpar {table}: {e}")
    
    print(f"\n🎯 Limpeza concluída: {cleared_count} registros removidos")
    
    # Verificar estado final
    try:
        health_response = requests.get(f"{base_url}/health")
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"🟢 Sistema operacional")
            print(f"👥 Usuários ativos: {health_data.get('counts', {}).get('users', 0)}")
            print(f"🏪 Lojas ativas: {health_data.get('counts', {}).get('stores', 0)}")
        
        print("\n📋 Sistema pronto para novos inventários!")
        
    except Exception as e:
        print(f"⚠️ Erro ao verificar status: {e}")

if __name__ == "__main__":
    try:
        clean_inventories()
    except KeyboardInterrupt:
        print("\n🛑 Operação cancelada pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Erro crítico: {e}")
        sys.exit(1)