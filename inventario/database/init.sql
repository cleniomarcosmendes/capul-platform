-- =================================
-- SISTEMA DE INVENTÁRIO PROTHEUS
-- Inicialização do Banco PostgreSQL
-- =================================

-- Configurações iniciais
SET client_encoding = 'UTF8';
SET default_with_oids = false;
SET timezone = 'America/Sao_Paulo';

-- =================================
-- EXTENSÕES
-- =================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Para busca de texto

-- =================================
-- SCHEMA PRINCIPAL
-- =================================
CREATE SCHEMA IF NOT EXISTS inventario;
SET search_path TO inventario, public;

-- =================================
-- TIPOS PERSONALIZADOS
-- =================================

-- Enum para roles de usuário
CREATE TYPE user_role AS ENUM ('ADMIN', 'SUPERVISOR', 'OPERATOR');

-- Enum para status de inventário
CREATE TYPE inventory_status AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- Enum para status de contagem
CREATE TYPE counting_status AS ENUM ('PENDING', 'COUNTED', 'REVIEWED', 'APPROVED');

-- =================================
-- TABELA DE LOJAS
-- =================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    address VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índices para stores
CREATE INDEX idx_stores_code ON stores(code);
CREATE INDEX idx_stores_active ON stores(is_active);

-- =================================
-- TABELA DE USUÁRIOS
-- =================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role user_role NOT NULL DEFAULT 'OPERATOR',
    store_id UUID REFERENCES stores(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índices para users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_store ON users(store_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- =================================
-- TABELA DE PRODUTOS
-- =================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(10) NOT NULL,
    cost_price DECIMAL(15,4),
    sale_price DECIMAL(15,4),
    current_stock DECIMAL(15,4) DEFAULT 0,
    has_serial BOOLEAN NOT NULL DEFAULT false,
    has_lot BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    store_id UUID NOT NULL REFERENCES stores(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraint de código único por loja
    CONSTRAINT uk_products_code_store UNIQUE (code, store_id),
    CONSTRAINT uk_products_barcode_store UNIQUE (barcode, store_id)
);

-- Índices para products
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_code_name ON products(code, name);

-- =================================
-- TABELA DE LISTAS DE INVENTÁRIO
-- =================================
CREATE TABLE inventory_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    reference_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    count_deadline TIMESTAMP WITH TIME ZONE,
    status inventory_status NOT NULL DEFAULT 'DRAFT',
    store_id UUID NOT NULL REFERENCES stores(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índices para inventory_lists
CREATE INDEX idx_inventory_lists_store ON inventory_lists(store_id);
CREATE INDEX idx_inventory_lists_status ON inventory_lists(status);
CREATE INDEX idx_inventory_lists_date ON inventory_lists(reference_date);
CREATE INDEX idx_inventory_lists_created_by ON inventory_lists(created_by);

-- =================================
-- TABELA DE ITENS DE INVENTÁRIO
-- =================================
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_list_id UUID NOT NULL REFERENCES inventory_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    sequence INTEGER NOT NULL,
    expected_quantity DECIMAL(15,4),
    status counting_status NOT NULL DEFAULT 'PENDING',
    last_counted_at TIMESTAMP WITH TIME ZONE,
    last_counted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraint para evitar produto duplicado na mesma lista
    CONSTRAINT uk_inventory_items_list_product UNIQUE (inventory_list_id, product_id)
);

-- Índices para inventory_items
CREATE INDEX idx_inventory_items_list ON inventory_items(inventory_list_id);
CREATE INDEX idx_inventory_items_product ON inventory_items(product_id);
CREATE INDEX idx_inventory_items_status ON inventory_items(status);
CREATE INDEX idx_inventory_items_sequence ON inventory_items(inventory_list_id, sequence);

-- =================================
-- TABELA DE CONTAGENS
-- =================================
CREATE TABLE countings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,4) NOT NULL,
    lot_number VARCHAR(50),
    serial_number VARCHAR(50),
    observation TEXT,
    counted_by UUID NOT NULL REFERENCES users(id),
    count_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índices para countings
CREATE INDEX idx_countings_item ON countings(inventory_item_id);
CREATE INDEX idx_countings_user ON countings(counted_by);
CREATE INDEX idx_countings_date ON countings(created_at);
CREATE INDEX idx_countings_lot ON countings(lot_number);
CREATE INDEX idx_countings_serial ON countings(serial_number);

-- =================================
-- TABELA DE DIVERGÊNCIAS
-- =================================
CREATE TABLE discrepancies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    variance_quantity DECIMAL(15,4) NOT NULL,
    variance_percentage DECIMAL(8,4) NOT NULL,
    tolerance_exceeded BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    observation TEXT,
    resolution TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Índices para discrepancies
CREATE INDEX idx_discrepancies_item ON discrepancies(inventory_item_id);
CREATE INDEX idx_discrepancies_status ON discrepancies(status);
CREATE INDEX idx_discrepancies_created_by ON discrepancies(created_by);
CREATE INDEX idx_discrepancies_resolved_by ON discrepancies(resolved_by);

-- =================================
-- TABELA DE LOGS DE SISTEMA
-- =================================
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    module VARCHAR(50),
    function VARCHAR(50),
    user_id UUID REFERENCES users(id),
    store_id UUID REFERENCES stores(id),
    ip_address INET,
    user_agent TEXT,
    additional_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para system_logs
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_module ON system_logs(module);
CREATE INDEX idx_system_logs_user ON system_logs(user_id);
CREATE INDEX idx_system_logs_date ON system_logs(created_at);
CREATE INDEX idx_system_logs_additional_data ON system_logs USING gin(additional_data);

-- =================================
-- TABELA DE CONFIGURAÇÕES
-- =================================
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    category VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índices para system_config
CREATE INDEX idx_system_config_key ON system_config(key);
CREATE INDEX idx_system_config_category ON system_config(category);

-- =================================
-- VIEWS ÚTEIS
-- =================================

-- View de produtos com informações da loja
CREATE VIEW v_products_with_store AS
SELECT 
    p.*,
    s.code as store_code,
    s.name as store_name
FROM products p
JOIN stores s ON p.store_id = s.id;

-- View de inventários com estatísticas
CREATE VIEW v_inventory_stats AS
SELECT 
    il.*,
    s.code as store_code,
    s.name as store_name,
    u.full_name as created_by_name,
    COUNT(ii.id) as total_items,
    COUNT(CASE WHEN ii.status = 'COUNTED' THEN 1 END) as counted_items,
    ROUND(
        (COUNT(CASE WHEN ii.status = 'COUNTED' THEN 1 END)::decimal / 
         NULLIF(COUNT(ii.id), 0) * 100), 2
    ) as progress_percentage
FROM inventory_lists il
JOIN stores s ON il.store_id = s.id
JOIN users u ON il.created_by = u.id
LEFT JOIN inventory_items ii ON il.id = ii.inventory_list_id
GROUP BY il.id, s.code, s.name, u.full_name;

-- =================================
-- TRIGGERS
-- =================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas relevantes
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_lists_updated_at BEFORE UPDATE ON inventory_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_countings_updated_at BEFORE UPDATE ON countings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================
-- DADOS INICIAIS
-- =================================

-- Configurações padrão do sistema
INSERT INTO system_config (key, value, description, category) VALUES
('SYSTEM_NAME', 'Sistema de Inventário Protheus', 'Nome do sistema', 'GENERAL'),
('SYSTEM_VERSION', '2.0.0', 'Versão do sistema', 'GENERAL'),
('DEFAULT_LANGUAGE', 'pt-BR', 'Idioma padrão', 'GENERAL'),
('TIMEZONE', 'America/Sao_Paulo', 'Fuso horário padrão', 'GENERAL'),
('MAX_UPLOAD_SIZE', '10485760', 'Tamanho máximo de upload em bytes (10MB)', 'UPLOADS'),
('SESSION_TIMEOUT', '3600', 'Timeout de sessão em segundos', 'SECURITY'),
('PASSWORD_MIN_LENGTH', '6', 'Tamanho mínimo da senha', 'SECURITY'),
('BACKUP_RETENTION_DAYS', '30', 'Dias de retenção de backup', 'BACKUP'),
('ENABLE_NOTIFICATIONS', 'true', 'Habilitar notificações', 'NOTIFICATIONS');

-- Loja padrão para desenvolvimento
INSERT INTO stores (id, code, name, description, address, phone, email) VALUES
(uuid_generate_v4(), '001', 'Loja Matriz', 'Loja principal da empresa', 'Rua Principal, 123 - Centro', '(11) 1234-5678', 'matriz@empresa.com.br');

-- Usuário admin padrão (apenas para desenvolvimento)
-- Senha: admin123 (hash bcrypt)
INSERT INTO users (id, username, password_hash, full_name, email, role, store_id) VALUES
(uuid_generate_v4(), 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyUkPP7O7XQqEm', 'Administrador do Sistema', 'admin@inventario.local', 'ADMIN', (SELECT id FROM stores WHERE code = '001'));

-- =================================
-- COMENTÁRIOS NAS TABELAS
-- =================================

COMMENT ON TABLE stores IS 'Cadastro de lojas/filiais da empresa';
COMMENT ON TABLE users IS 'Usuários do sistema com controle de acesso por loja';
COMMENT ON TABLE products IS 'Cadastro de produtos por loja';
COMMENT ON TABLE inventory_lists IS 'Listas de inventário físico';
COMMENT ON TABLE inventory_items IS 'Itens que compõem cada lista de inventário';
COMMENT ON TABLE countings IS 'Registros de contagem física dos itens';
COMMENT ON TABLE discrepancies IS 'Divergências encontradas entre esperado e contado';
COMMENT ON TABLE system_logs IS 'Logs de auditoria do sistema';
COMMENT ON TABLE system_config IS 'Configurações gerais do sistema';

-- =================================
-- PERMISSÕES
-- =================================

-- Criar role para aplicação
CREATE ROLE inventario_app WITH LOGIN PASSWORD 'inventario_app_2024!';

-- Conceder permissões ao schema
GRANT USAGE ON SCHEMA inventario TO inventario_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA inventario TO inventario_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA inventario TO inventario_app;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA inventario TO inventario_app;

-- Permissões futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA inventario GRANT ALL ON TABLES TO inventario_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA inventario GRANT ALL ON SEQUENCES TO inventario_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA inventario GRANT ALL ON FUNCTIONS TO inventario_app;

-- =================================
-- TABELA DE ATRIBUIÇÕES DE CONTAGEM
-- =================================
CREATE TABLE counting_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES users(id),
    assigned_by UUID NOT NULL REFERENCES users(id),
    count_number INTEGER NOT NULL CHECK (count_number >= 1 AND count_number <= 3),
    reason TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Constraint para evitar atribuição duplicada
    CONSTRAINT uk_counting_assignments_item_count UNIQUE (inventory_item_id, count_number)
);

-- Índices para counting_assignments
CREATE INDEX idx_counting_assignments_assigned_to ON counting_assignments(assigned_to);
CREATE INDEX idx_counting_assignments_assigned_by ON counting_assignments(assigned_by);
CREATE INDEX idx_counting_assignments_status ON counting_assignments(status);
CREATE INDEX idx_counting_assignments_count_number ON counting_assignments(count_number);
CREATE INDEX idx_counting_assignments_deadline ON counting_assignments(deadline);
CREATE INDEX idx_counting_assignments_item ON counting_assignments(inventory_item_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_counting_assignments_updated_at BEFORE UPDATE ON counting_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentário na tabela
COMMENT ON TABLE counting_assignments IS 'Atribuições de contadores para itens específicos de inventário';

-- =================================
-- FINALIZAÇÃO
-- =================================

-- Resetar search_path
SET search_path TO public;

-- Estatísticas iniciais
ANALYZE;

COMMENT ON DATABASE inventario_protheus IS 'Sistema de Inventário Físico integrado ao ERP Protheus v2.0';

-- Fim do script de inicialização