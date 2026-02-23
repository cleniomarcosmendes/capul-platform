#!/bin/bash

# =============================================================================
# Script de Backup Automático do Banco de Dados PostgreSQL
# Sistema de Inventário Protheus
# =============================================================================
# Este script cria backups seguros do banco de dados sem afetar o sistema
# =============================================================================

# Configurações do banco (mesmas do docker-compose.yml)
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="inventario_protheus"
DB_USER="inventario_user"
DB_PASS="inventario2024"
DB_SCHEMA="inventario"

# Diretório de backup
BACKUP_DIR="./database/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_inventario_${DATE}.sql"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# FUNÇÕES
# =============================================================================

print_header() {
    echo ""
    echo "============================================================"
    echo "🔄 BACKUP DO BANCO DE DADOS - SISTEMA DE INVENTÁRIO"
    echo "============================================================"
    echo "📅 Data/Hora: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

check_postgres() {
    echo -n "🔍 Verificando conexão com PostgreSQL... "
    
    # Tenta conectar ao banco usando docker
    docker exec -i inventario_postgres psql -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Conectado${NC}"
        return 0
    else
        echo -e "${RED}✗ Falha na conexão${NC}"
        echo "   Verifique se o container PostgreSQL está rodando"
        return 1
    fi
}

create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "📁 Criando diretório de backup: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

count_database_objects() {
    echo ""
    echo "📊 Estatísticas do banco:"
    
    # Conta objetos no banco
    docker exec -i inventario_postgres psql -U $DB_USER -d $DB_NAME <<EOF 2>/dev/null
SELECT '   - Tabelas: ' || COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_SCHEMA';
SELECT '   - Usuários: ' || COUNT(*) FROM $DB_SCHEMA.users;
SELECT '   - Produtos: ' || COUNT(*) FROM $DB_SCHEMA.products;
SELECT '   - Lojas: ' || COUNT(*) FROM $DB_SCHEMA.stores;
EOF
}

create_backup() {
    echo ""
    echo "💾 Criando backup..."
    echo "   Arquivo: $BACKUP_DIR/$BACKUP_FILE"
    
    # Executa pg_dump dentro do container
    docker exec -i inventario_postgres pg_dump \
        -U $DB_USER \
        -d $DB_NAME \
        --schema=$DB_SCHEMA \
        --verbose \
        --no-owner \
        --no-acl \
        --format=plain \
        --encoding=UTF8 \
        > "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        # Compacta o backup
        gzip "$BACKUP_DIR/$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE}.gz"
        
        # Verifica tamanho do arquivo
        SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        echo -e "   ${GREEN}✓ Backup criado com sucesso!${NC}"
        echo "   📦 Tamanho: $SIZE"
        echo "   📍 Local: $BACKUP_DIR/$BACKUP_FILE"
        return 0
    else
        echo -e "   ${RED}✗ Erro ao criar backup${NC}"
        return 1
    fi
}

list_recent_backups() {
    echo ""
    echo "📋 Últimos 5 backups:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 | while read line; do
            echo "   $line" | awk '{print "   - " $9 " (" $5 ")"}'
        done
    else
        echo "   Nenhum backup encontrado"
    fi
}

cleanup_old_backups() {
    # Mantém apenas os últimos 10 backups
    KEEP_BACKUPS=10
    
    if [ -d "$BACKUP_DIR" ]; then
        BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)
        
        if [ $BACKUP_COUNT -gt $KEEP_BACKUPS ]; then
            echo ""
            echo "🧹 Limpando backups antigos (mantendo últimos $KEEP_BACKUPS)..."
            
            # Remove backups mais antigos
            ls -t "$BACKUP_DIR"/*.gz | tail -n +$(($KEEP_BACKUPS + 1)) | xargs rm -f
            
            echo -e "   ${GREEN}✓ Limpeza concluída${NC}"
        fi
    fi
}

restore_instructions() {
    echo ""
    echo "📝 Para restaurar este backup, use:"
    echo ""
    echo -e "${YELLOW}# 1. Descompactar o arquivo:${NC}"
    echo "   gunzip $BACKUP_DIR/$BACKUP_FILE"
    echo ""
    echo -e "${YELLOW}# 2. Restaurar no banco:${NC}"
    echo "   docker exec -i inventario_postgres psql -U $DB_USER -d $DB_NAME < $BACKUP_DIR/${BACKUP_FILE%.gz}"
    echo ""
}

# =============================================================================
# EXECUÇÃO PRINCIPAL
# =============================================================================

main() {
    print_header
    
    # Verifica conexão com o banco
    if ! check_postgres; then
        echo -e "\n${RED}❌ Backup cancelado - Banco de dados não está acessível${NC}"
        exit 1
    fi
    
    # Mostra estatísticas
    count_database_objects
    
    # Cria diretório de backup se necessário
    create_backup_dir
    
    # Cria o backup
    if create_backup; then
        # Lista backups recentes
        list_recent_backups
        
        # Limpa backups antigos
        cleanup_old_backups
        
        # Mostra instruções de restauração
        restore_instructions
        
        echo ""
        echo "============================================================"
        echo -e "${GREEN}✅ BACKUP CONCLUÍDO COM SUCESSO!${NC}"
        echo "============================================================"
        echo ""
        
        exit 0
    else
        echo ""
        echo "============================================================"
        echo -e "${RED}❌ BACKUP FALHOU${NC}"
        echo "============================================================"
        echo ""
        exit 1
    fi
}

# Executa o script
main