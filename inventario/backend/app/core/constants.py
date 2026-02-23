"""
Constantes do Sistema de Inventário Protheus v2.0
"""

# ===================================
# AUTENTICAÇÃO E SEGURANÇA
# ===================================

# Tempo de expiração do token (em segundos) - 1 hora
TOKEN_EXPIRATION_SECONDS = 3600

# Algoritmo de hash para senhas
PASSWORD_HASH_ALGORITHM = "sha256"

# Prefixo dos tokens de autenticação
TOKEN_PREFIX = "token_"

# ===================================
# CONFIGURAÇÕES DE API
# ===================================

# Tamanho padrão de página para paginação
DEFAULT_PAGE_SIZE = 20

# Tamanho máximo de página para paginação
MAX_PAGE_SIZE = 100

# ===================================
# CÓDIGOS DE STATUS HTTP CUSTOMIZADOS
# ===================================

# Sucesso
HTTP_SUCCESS = 200
HTTP_CREATED = 201
HTTP_NO_CONTENT = 204

# Erros do Cliente
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409

# Erros do Servidor
HTTP_INTERNAL_ERROR = 500

# ===================================
# CONFIGURAÇÕES DO BANCO DE DADOS
# ===================================

# Nome do schema principal
DATABASE_SCHEMA = "inventario"

# ===================================
# CONFIGURAÇÕES DE INVENTÁRIO
# ===================================

# Status possíveis de inventário
INVENTORY_STATUS_DRAFT = "DRAFT"
INVENTORY_STATUS_RELEASED = "RELEASED"
INVENTORY_STATUS_IN_PROGRESS = "IN_PROGRESS"
INVENTORY_STATUS_COMPLETED = "COMPLETED"

# Status possíveis de contagem
COUNTING_STATUS_PENDING = "PENDING"
COUNTING_STATUS_COMPLETED = "COMPLETED"

# Ciclos de contagem
FIRST_COUNT = 1
SECOND_COUNT = 2
THIRD_COUNT = 3
MAX_COUNT_ROUNDS = 3

# ===================================
# SEGURANÇA - COLUNAS E TABELAS VÁLIDAS
# (Previne SQL Injection em queries dinâmicas)
# ===================================

# Mapeamento seguro de ciclo para nome de coluna
VALID_CYCLE_COLUMNS = {
    1: "count_cycle_1",
    2: "count_cycle_2",
    3: "count_cycle_3"
}

# Mapeamento seguro de ciclo para flag de necessidade
VALID_NEEDS_CYCLE_COLUMNS = {
    1: "needs_count_cycle_1",
    2: "needs_count_cycle_2",
    3: "needs_count_cycle_3"
}

# Tabelas válidas para sincronização Protheus
VALID_SYNC_TABLES = {
    "sbm010": {
        "code_field": "bm_grupo",
        "desc_field": "bm_desc",
        "filial_prefix": "bm"
    },
    "szd010": {
        "code_field": "zd_xcod",
        "desc_field": "zd_xdesc",
        "filial_prefix": "zd"
    },
    "sze010": {
        "code_field": "ze_xcod",
        "desc_field": "ze_xdesc",
        "filial_prefix": "ze"
    },
    "szf010": {
        "code_field": "zf_xcod",
        "desc_field": "zf_xdesc",
        "filial_prefix": "zf"
    }
}

# ===================================
# CONFIGURAÇÕES DE CORS
# ===================================

# Origens permitidas para desenvolvimento
CORS_ORIGINS_DEV = [
    "http://localhost",
    "http://localhost:8000",
    "http://localhost:3000",
    "http://127.0.0.1:8000"
]

# Origens permitidas para produção (devem ser configuradas via env)
CORS_ORIGINS_PROD = []  # Definir via variáveis de ambiente

# ===================================
# MENSAGENS DE ERRO PADRONIZADAS
# ===================================

ERROR_USER_NOT_FOUND = "Usuário não encontrado"
ERROR_INVALID_CREDENTIALS = "Credenciais inválidas"
ERROR_TOKEN_EXPIRED = "Token expirado"
ERROR_INSUFFICIENT_PERMISSIONS = "Permissões insuficientes"
ERROR_INVENTORY_NOT_FOUND = "Inventário não encontrado"
ERROR_PRODUCT_NOT_FOUND = "Produto não encontrado"
ERROR_ASSIGNMENT_NOT_FOUND = "Atribuição não encontrada"

# ===================================
# MENSAGENS DE SUCESSO PADRONIZADAS
# ===================================

SUCCESS_LOGIN = "Login realizado com sucesso"
SUCCESS_LOGOUT = "Logout realizado com sucesso"
SUCCESS_INVENTORY_CREATED = "Inventário criado com sucesso"
SUCCESS_COUNTING_SAVED = "Contagem salva com sucesso"
SUCCESS_ASSIGNMENT_CREATED = "Atribuição criada com sucesso"