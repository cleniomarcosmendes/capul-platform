-- =============================================
-- Migration 002 — Migrar stores -> filiais
-- Preserva UUIDs para compatibilidade
-- =============================================

-- Primeiro, criar empresa padrao
INSERT INTO core.empresas (id, razao_social, nome_fantasia, cnpj_matriz, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Grupo Capul Ltda',
    'Grupo Capul',
    '00.000.000/0001-00',
    NOW(), NOW()
);

-- Migrar stores para filiais
INSERT INTO core.filiais (
    id, codigo, nome_fantasia, descricao, endereco, telefone, email,
    status, empresa_id, created_at, updated_at
)
SELECT
    s.id,
    s.code,
    s.name,
    s.description,
    s.address,
    s.phone,
    s.email,
    CASE WHEN s.is_active THEN 'ATIVO' ELSE 'INATIVO' END,
    (SELECT id FROM core.empresas LIMIT 1),
    COALESCE(s.created_at, NOW()),
    COALESCE(s.updated_at, NOW())
FROM inventario.stores s;
