-- Migration 17/05/2026: cron de detecção RFB configurável pelo admin.
--
-- Antes era constante fixa no código (seg 07:00). Pedido Clenio: admin
-- poder configurar/desligar. Vai pra ambiente_config (mesmo padrão de
-- cron_movimento_*), lido pelo SchedulerRegistry dinâmico. NULL/vazio =
-- detecção automática desativada. Idempotente.

ALTER TABLE "fiscal"."ambiente_config"
  ADD COLUMN IF NOT EXISTS "rfb_cron_deteccao" TEXT DEFAULT '0 7 * * 1';
