-- Onboard do módulo LOGISTICA como consumidor de integrações Protheus.
-- Idempotente (ADD VALUE IF NOT EXISTS) — em DEV o valor já foi adicionado
-- ad-hoc; em HOM/PROD esta migration o cria. Enum não é coberto pelo
-- check-migrations (que audita tabelas), por isso a forma explícita.
ALTER TYPE "core"."ModuloConsumidor" ADD VALUE IF NOT EXISTS 'LOGISTICA';
