-- Migration: adiciona valor 'PENDENTE_USUARIO' ao enum gestao_ti.StatusChamado
--
-- Contexto: solicitação 28/04/2026 do setor — quando o técnico precisa de
-- mais informações do solicitante durante o atendimento, hoje só comenta
-- (comentário público dispara notificação genérica). Falta semântica clara
-- de "chamado parado aguardando o usuário responder". Status novo permite:
--   - SLA do técnico pausa enquanto está PENDENTE_USUARIO (não conta tempo de espera)
--   - Filtro dedicado para gestor monitorar chamados travados aguardando solicitante
--   - Banner visual destacado pro solicitante ver que precisa responder
--   - Auto-transição para EM_ATENDIMENTO quando solicitante responde (volta pra fila do técnico)
--
-- Decisão: ADITIVO (mantém PENDENTE genérico). Não renomeia o legado para evitar
-- migração de dados de chamados em PENDENTE existentes em PROD e preserva semântica
-- futura ("PENDENTE_FORNECEDOR", "PENDENTE_GESTOR" se aparecerem).
--
-- SQL idempotente — `ADD VALUE IF NOT EXISTS` (Postgres 12+).

ALTER TYPE "gestao_ti"."StatusChamado" ADD VALUE IF NOT EXISTS 'PENDENTE_USUARIO';

-- TipoHistorico ganha 2 valores correspondentes às transições do novo fluxo:
--   - SOLICITACAO_INFO: técnico pede info ao solicitante (status → PENDENTE_USUARIO)
--   - RETOMADA_USUARIO: solicitante respondeu (status → EM_ATENDIMENTO)
ALTER TYPE "gestao_ti"."TipoHistorico" ADD VALUE IF NOT EXISTS 'SOLICITACAO_INFO';
ALTER TYPE "gestao_ti"."TipoHistorico" ADD VALUE IF NOT EXISTS 'RETOMADA_USUARIO';
