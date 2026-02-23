#!/usr/bin/env python3
"""
Script para executar migrations usando SQLAlchemy
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migration():
    """Executa a migration para adicionar controle de ciclos"""
    
    # Criar engine do banco
    engine = create_engine(settings.DATABASE_URL)
    
    try:
        with engine.connect() as conn:
            # Começar transação
            trans = conn.begin()
            
            try:
                print("🔄 Executando migration: Controle de Ciclos e Status...")
                
                # 1. Criar tipo ENUM para status das listas
                print("  1. Criando tipo list_status...")
                conn.execute(text("""
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'list_status') THEN
                            CREATE TYPE list_status AS ENUM ('ABERTA', 'EM_CONTAGEM', 'ENCERRADA');
                        END IF;
                    END$$;
                """))
                
                # 2. Adicionar campos na tabela inventory_lists
                print("  2. Adicionando campos de controle...")
                
                # Verificar e adicionar cada campo individualmente
                campos = [
                    ("cycle_number", "INTEGER DEFAULT 1 CHECK (cycle_number BETWEEN 1 AND 3)"),
                    ("list_status", "list_status DEFAULT 'ABERTA'"),
                    ("released_at", "TIMESTAMP WITH TIME ZONE"),
                    ("released_by", "UUID"),
                    ("closed_at", "TIMESTAMP WITH TIME ZONE"),
                    ("closed_by", "UUID")
                ]
                
                for campo, tipo in campos:
                    # Verificar se o campo já existe
                    result = conn.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_schema = 'inventario' 
                        AND table_name = 'inventory_lists' 
                        AND column_name = '{campo}'
                    """))
                    
                    if not result.fetchone():
                        print(f"     - Adicionando campo {campo}...")
                        if campo in ['released_by', 'closed_by']:
                            conn.execute(text(f"""
                                ALTER TABLE inventario.inventory_lists 
                                ADD COLUMN {campo} {tipo} REFERENCES inventario.users(id)
                            """))
                        else:
                            conn.execute(text(f"""
                                ALTER TABLE inventario.inventory_lists 
                                ADD COLUMN {campo} {tipo}
                            """))
                    else:
                        print(f"     - Campo {campo} já existe, pulando...")
                
                # 3. Criar índices
                print("  3. Criando índices...")
                indices = [
                    ("idx_inventory_lists_cycle", "cycle_number"),
                    ("idx_inventory_lists_list_status", "list_status")
                ]
                
                for idx_name, column in indices:
                    conn.execute(text(f"""
                        CREATE INDEX IF NOT EXISTS {idx_name} 
                        ON inventario.inventory_lists({column})
                    """))
                
                # 4. Criar tabela de histórico
                print("  4. Criando tabela de histórico de ciclos...")
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS inventario.inventory_cycle_history (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        inventory_list_id UUID NOT NULL REFERENCES inventario.inventory_lists(id),
                        cycle_number INTEGER NOT NULL CHECK (cycle_number BETWEEN 1 AND 3),
                        assigned_user_id UUID REFERENCES inventario.users(id),
                        status list_status NOT NULL,
                        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        completed_at TIMESTAMP WITH TIME ZONE,
                        items_count INTEGER DEFAULT 0,
                        counted_items INTEGER DEFAULT 0,
                        discrepancy_count INTEGER DEFAULT 0,
                        notes TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                
                # 5. Criar índices para histórico
                print("  5. Criando índices para histórico...")
                hist_indices = [
                    ("idx_cycle_history_list", "inventory_list_id"),
                    ("idx_cycle_history_user", "assigned_user_id"),
                    ("idx_cycle_history_cycle", "cycle_number")
                ]
                
                for idx_name, column in hist_indices:
                    conn.execute(text(f"""
                        CREATE INDEX IF NOT EXISTS {idx_name} 
                        ON inventario.inventory_cycle_history({column})
                    """))
                
                # 6. Adicionar campo de ciclo em counting_assignments
                print("  6. Adicionando campo de ciclo em counting_assignments...")
                result = conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'inventario' 
                    AND table_name = 'counting_assignments' 
                    AND column_name = 'cycle_number'
                """))
                
                if not result.fetchone():
                    conn.execute(text("""
                        ALTER TABLE inventario.counting_assignments 
                        ADD COLUMN cycle_number INTEGER DEFAULT 1 CHECK (cycle_number BETWEEN 1 AND 3)
                    """))
                    
                    conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_counting_assignments_cycle 
                        ON inventario.counting_assignments(cycle_number)
                    """))
                else:
                    print("     - Campo cycle_number já existe em counting_assignments")
                
                # Commit da transação
                trans.commit()
                print("\n✅ Migration executada com sucesso!")
                
                # Verificar alterações
                print("\n📊 Verificando alterações...")
                result = conn.execute(text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'inventario' 
                    AND table_name = 'inventory_lists'
                    AND column_name IN ('cycle_number', 'list_status', 'released_at', 'released_by', 'closed_at', 'closed_by')
                    ORDER BY column_name
                """))
                
                columns = result.fetchall()
                if columns:
                    print("\nNovos campos em inventory_lists:")
                    for col_name, col_type in columns:
                        print(f"  ✓ {col_name}: {col_type}")
                
                # Verificar tabela de histórico
                result = conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'inventario' 
                        AND table_name = 'inventory_cycle_history'
                    )
                """))
                
                if result.fetchone()[0]:
                    print("\n✓ Tabela inventory_cycle_history criada")
                
                return True
                
            except Exception as e:
                trans.rollback()
                print(f"\n❌ Erro durante migration: {e}")
                return False
                
    except Exception as e:
        print(f"\n❌ Erro ao conectar ao banco: {e}")
        return False
    finally:
        engine.dispose()

if __name__ == "__main__":
    if run_migration():
        print("\n🎉 Migration concluída com sucesso!")
        sys.exit(0)
    else:
        print("\n❌ Falha na migration!")
        sys.exit(1)