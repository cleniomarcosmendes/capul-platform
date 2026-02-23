"""
Configuração do Banco de Dados PostgreSQL
Sistema de Inventário Protheus
"""

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import os
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =================================
# CONFIGURAÇÃO DO SQLALCHEMY
# =================================

# Engine do SQLAlchemy
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://inventario_user:inventario_2024!@postgres:5432/inventario_protheus")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=DEBUG
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base para os modelos
Base = declarative_base()

# =================================
# DEPENDÊNCIA DE SESSÃO
# =================================

def get_db() -> Session:
    """
    Dependência para obter sessão do banco de dados
    Usado nas rotas FastAPI com Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

# =================================
# FUNÇÕES DE INICIALIZAÇÃO
# =================================

async def create_tables():
    """
    Cria todas as tabelas no banco
    (As tabelas já foram criadas pelo init.sql, mas deixamos para compatibilidade)
    """
    try:
        # Em produção, as tabelas já existem pelo init.sql
        # Mas podemos verificar a conexão
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"❌ Error creating tables: {e}")
        raise

async def test_database_connection() -> dict:
    """
    Testa conexão com o banco de dados
    Retorna informações sobre o banco
    """
    try:
        db = SessionLocal()
        
        # Testar conexão básica
        result = db.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        
        # Testar se as tabelas existem
        tables_query = text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'inventario'
            ORDER BY table_name
        """)
        
        tables_result = db.execute(tables_query)
        tables = [row[0] for row in tables_result.fetchall()]
        
        # Contar registros nas tabelas principais
        stores_count = db.execute(text("SELECT COUNT(*) FROM inventario.stores")).fetchone()[0]
        users_count = db.execute(text("SELECT COUNT(*) FROM inventario.users")).fetchone()[0]
        
        db.close()
        
        return {
            "status": "connected",
            "version": version,
            "tables": tables,
            "data": {
                "stores": stores_count,
                "users": users_count
            }
        }
        
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

# =================================
# CONFIGURAÇÕES AVANÇADAS
# =================================

def get_database_info():
    """
    Retorna informações sobre a configuração do banco
    """
    return {
        "database_url": settings.DATABASE_URL.split("@")[1] if "@" in settings.DATABASE_URL else "hidden",
        "engine_info": {
            "driver": engine.driver,
            "pool_size": engine.pool.size() if hasattr(engine.pool, 'size') else 'N/A',
            "echo": engine.echo
        }
    }