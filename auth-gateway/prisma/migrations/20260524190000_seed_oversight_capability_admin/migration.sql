-- ============================================================================
-- Workspace Onda 3 S0 — Capability OVERSIGHT_PLATAFORMA
-- ============================================================================
-- Sub-fase 1 da Onda 3 (cadastros operacionais multi-depto). Substitui o
-- bypass automático que ADMIN tinha em cadastros operacionais (D36) por uma
-- capability EXPLÍCITA por usuário.
--
-- Semântica:
--   - User com OVERSIGHT_PLATAFORMA ativa: bypass de leitura + escrita em
--     entidades operacionais (Software/Licença/Contrato/NF/Ativo/Parada).
--   - Sem a capability: regra normal (vê + opera só nos deptos do perfil).
--
-- Quem ganha agora: apenas user "admin" (status quo — único user com role
-- ADMIN no Workspace de produção). Demais users com role ADMIN em outros
-- módulos (ex: Clenio em CONFIGURADOR/FISCAL) NÃO ganham — operam como
-- GESTOR normal no Workspace conforme o perfil cadastrado.
--
-- Idempotente via ON CONFLICT (PK composta usuario_id + capability).
-- ============================================================================

DO $$
DECLARE
  v_admin_id text;
BEGIN
  SELECT id INTO v_admin_id
  FROM core.usuarios
  WHERE username = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Migration abortada: user "admin" não encontrado em core.usuarios. Verificar seed do auth-gateway.';
  END IF;

  INSERT INTO core.usuario_capability
    (id, usuario_id, capability, ativo, motivo, concedido_por, concedido_em)
  VALUES
    (gen_random_uuid()::text, v_admin_id, 'OVERSIGHT_PLATAFORMA', true,
     'Seed Onda 3 S0 — substitui bypass D36 por capability explícita. User admin é olho fiscalizador da plataforma (auditoria + operação cross-depto).',
     v_admin_id, NOW())
  ON CONFLICT (usuario_id, capability) DO NOTHING;
END $$;
