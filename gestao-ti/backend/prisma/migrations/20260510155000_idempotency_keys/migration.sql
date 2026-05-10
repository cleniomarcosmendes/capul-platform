-- Auditoria 10/05/2026 #M3 (Robustez) — tabela de idempotency keys
--
-- Defesa em profundidade contra duplicação por retry de cliente após
-- timeout/network glitch. Cliente envia header `Idempotency-Key: <uuid>`,
-- backend cacheia resposta por 24h.
--
-- Schema unique em (usuario_id, key) — isola entre usuários para evitar
-- conluio. Index em expires_at para cleanup eficiente.

CREATE TABLE IF NOT EXISTS gestao_ti.idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             VARCHAR(128) NOT NULL,
  usuario_id      UUID NOT NULL,
  method          VARCHAR(10) NOT NULL,
  path            VARCHAR(255) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body   JSONB,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP(3) NOT NULL,

  CONSTRAINT idempotency_user_key UNIQUE (usuario_id, key)
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
  ON gestao_ti.idempotency_keys (expires_at);
