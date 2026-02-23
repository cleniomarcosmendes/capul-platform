#!/usr/bin/env python3
"""
Script para corrigir atribuições do ciclo 2 do inventário clenio_30
"""

import psycopg2
import uuid
from datetime import datetime

# Configurações de conexão
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'inventario_protheus',
    'user': 'inventario_user',
    'password': 'inventario_2024!'
}

def fix_cycle2_assignments():
    """Corrige as atribuições do ciclo 2 para o inventário clenio_30"""
    
    conn = None
    cur = None
    
    try:
        # Conectar ao banco
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Buscar o inventário clenio_30
        cur.execute("""
            SELECT id, name, status 
            FROM inventario.inventory_lists 
            WHERE name = 'clenio_30'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        inventory = cur.fetchone()
        if not inventory:
            print("❌ Inventário clenio_30 não encontrado")
            return
            
        inventory_id = inventory[0]
        print(f"✅ Inventário encontrado: {inventory[1]} (ID: {inventory_id})")
        
        # Buscar o usuário clenio
        cur.execute("""
            SELECT id, username, full_name 
            FROM inventario.users 
            WHERE username = 'clenio'
        """)
        
        user = cur.fetchone()
        if not user:
            print("❌ Usuário clenio não encontrado")
            return
            
        user_id = user[0]
        print(f"✅ Usuário encontrado: {user[1]} (ID: {user_id})")
        
        # Verificar atribuições existentes para ciclo 2
        cur.execute("""
            SELECT COUNT(*) 
            FROM inventario.counting_assignments 
            WHERE inventory_list_id = %s 
            AND count_number = 2
        """, (inventory_id,))
        
        existing_count = cur.fetchone()[0]
        
        if existing_count > 0:
            print(f"⚠️ Já existem {existing_count} atribuições para o ciclo 2")
            
            # Atualizar atribuições existentes para garantir que estejam corretas
            cur.execute("""
                UPDATE inventario.counting_assignments
                SET 
                    assigned_to = %s,
                    status = 'PENDING',
                    updated_at = CURRENT_TIMESTAMP
                WHERE 
                    inventory_list_id = %s 
                    AND count_number = 2
            """, (user_id, inventory_id))
            
            print(f"✅ Atribuições do ciclo 2 atualizadas")
        else:
            # Buscar itens do inventário
            cur.execute("""
                SELECT id, product_id, sequence 
                FROM inventario.inventory_items 
                WHERE inventory_list_id = %s
                ORDER BY sequence
            """, (inventory_id,))
            
            items = cur.fetchall()
            print(f"📦 Encontrados {len(items)} itens no inventário")
            
            # Criar atribuições para o ciclo 2
            for item in items:
                assignment_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO inventario.counting_assignments 
                    (id, inventory_list_id, inventory_item_id, assigned_to, 
                     assigned_by, count_number, status, created_at, updated_at)
                    VALUES 
                    (%s, %s, %s, %s, %s, 2, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (assignment_id, inventory_id, item[0], user_id, user_id))
            
            print(f"✅ Criadas {len(items)} atribuições para o ciclo 2")
        
        # Verificar e atualizar o status da lista se necessário
        cur.execute("""
            UPDATE inventario.inventory_lists
            SET 
                status = 'IN_PROGRESS',
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                id = %s
                AND status = 'DRAFT'
        """, (inventory_id,))
        
        # Commit das alterações
        conn.commit()
        print("✅ Alterações salvas com sucesso!")
        
        # Verificar resultado final
        cur.execute("""
            SELECT 
                il.name,
                il.status,
                COUNT(DISTINCT ca.id) as total_assignments,
                COUNT(DISTINCT CASE WHEN ca.count_number = 2 THEN ca.id END) as cycle2_assignments
            FROM inventario.inventory_lists il
            LEFT JOIN inventario.counting_assignments ca ON ca.inventory_list_id = il.id
            WHERE il.id = %s
            GROUP BY il.id, il.name, il.status
        """, (inventory_id,))
        
        result = cur.fetchone()
        print(f"""
📊 Status Final:
- Inventário: {result[0]}
- Status: {result[1]}
- Total de atribuições: {result[2]}
- Atribuições ciclo 2: {result[3]}
        """)
        
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        if conn:
            conn.rollback()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🔧 Corrigindo atribuições do ciclo 2...")
    fix_cycle2_assignments()
    print("✅ Processo concluído!")