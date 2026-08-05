-- Freio automático de consumo indevido SEFAZ (cStat=656).
--
-- Por que separado do corte diário (`pausado_automatico`):
--   * semântica diferente — o corte diário expira no reset das 00:05; o 656
--     expira por TEMPO (a marcação da SEFAZ costuma normalizar em ~1h);
--   * mensagem diferente na UI — "limite diário atingido" seria enganoso;
--   * o reset diário NÃO pode limpar o 656 (um 656 às 23:50 tem que seguir
--     bloqueando depois da virada).
--
-- O bloqueio é global de propósito: a SEFAZ marca o CERTIFICADO consulente,
-- e o mTLS usa o mesmo certificado para todas as filiais (SefazAgentService
-- carrega um único `certReader.loadActive()`), então trocar de filial não
-- troca a identidade vista pela SEFAZ.
ALTER TABLE "fiscal"."limite_diario" ADD COLUMN     "bloqueio_656_ate" TIMESTAMP(3),
ADD COLUMN     "bloqueio_656_em" TIMESTAMP(3),
ADD COLUMN     "bloqueio_656_motivo" TEXT;
