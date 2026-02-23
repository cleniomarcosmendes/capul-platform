-- =============================================
-- Migration 001 — Criar tabelas do Schema Core
-- Executar apos init-schemas.sql
-- =============================================

-- Enum compartilhado
CREATE TYPE core.status_geral AS ENUM ('ATIVO', 'INATIVO');

-- Empresas
CREATE TABLE core.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255) NOT NULL,
    cnpj_matriz VARCHAR(20) UNIQUE,
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(10),
    telefone VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Filiais
CREATE TABLE core.filiais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(10) NOT NULL UNIQUE,
    razao_social VARCHAR(255),
    nome_fantasia VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20) UNIQUE,
    descricao TEXT,
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(10),
    telefone VARCHAR(20),
    email VARCHAR(255),
    status core.status_geral NOT NULL DEFAULT 'ATIVO',
    empresa_id UUID NOT NULL REFERENCES core.empresas(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_filiais_empresa ON core.filiais(empresa_id);
CREATE INDEX idx_filiais_status ON core.filiais(status);

-- Departamentos
CREATE TABLE core.departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    status core.status_geral NOT NULL DEFAULT 'ATIVO',
    filial_id UUID NOT NULL REFERENCES core.filiais(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(filial_id, nome)
);

-- Centros de Custo
CREATE TABLE core.centros_custo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    status core.status_geral NOT NULL DEFAULT 'ATIVO',
    filial_id UUID NOT NULL REFERENCES core.filiais(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(filial_id, codigo)
);

-- Usuarios
CREATE TABLE core.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    nome VARCHAR(255) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    cargo VARCHAR(100),
    avatar_url TEXT,
    status core.status_geral NOT NULL DEFAULT 'ATIVO',
    primeiro_acesso BOOLEAN NOT NULL DEFAULT true,
    ultimo_login TIMESTAMPTZ,
    filial_principal_id UUID REFERENCES core.filiais(id),
    departamento_id UUID REFERENCES core.departamentos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_status ON core.usuarios(status);
CREATE INDEX idx_usuarios_filial ON core.usuarios(filial_principal_id);

-- Usuario x Filial (N:N)
CREATE TABLE core.usuario_filiais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES core.usuarios(id) ON DELETE CASCADE,
    filial_id UUID NOT NULL REFERENCES core.filiais(id),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    UNIQUE(usuario_id, filial_id)
);

-- Modulos do Sistema
CREATE TABLE core.modulos_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    icone VARCHAR(50),
    cor VARCHAR(10),
    url_frontend TEXT,
    url_backend TEXT,
    ordem INT NOT NULL DEFAULT 0,
    status core.status_geral NOT NULL DEFAULT 'ATIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles por Modulo
CREATE TABLE core.roles_modulo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    modulo_id UUID NOT NULL REFERENCES core.modulos_sistema(id),
    UNIQUE(modulo_id, codigo)
);

-- Permissoes de Modulo por Usuario
CREATE TABLE core.permissoes_modulo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES core.usuarios(id) ON DELETE CASCADE,
    modulo_id UUID NOT NULL REFERENCES core.modulos_sistema(id),
    role_modulo_id UUID NOT NULL REFERENCES core.roles_modulo(id),
    status core.status_geral NOT NULL DEFAULT 'ATIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id, modulo_id)
);

-- Refresh Tokens
CREATE TABLE core.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_id UUID NOT NULL REFERENCES core.usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_usuario ON core.refresh_tokens(usuario_id);
CREATE INDEX idx_refresh_tokens_token ON core.refresh_tokens(token);

-- System Config
CREATE TABLE core.system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    descricao TEXT,
    categoria VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Logs
CREATE TABLE core.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    module VARCHAR(100),
    action VARCHAR(100),
    usuario_id UUID,
    ip_address VARCHAR(45),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_logs_created ON core.system_logs(created_at DESC);
CREATE INDEX idx_system_logs_level ON core.system_logs(level);
CREATE INDEX idx_system_logs_module ON core.system_logs(module);
