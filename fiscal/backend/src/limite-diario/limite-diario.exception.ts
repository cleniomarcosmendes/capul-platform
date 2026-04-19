import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lançada quando o limite diário de consultas SEFAZ é atingido ou quando o
 * corte automático está ativo (Plano v2.0 §6.2 — camada 4).
 *
 * Mapeia para HTTP 429 (Too Many Requests) — a UI traduz para a mensagem
 * "Limite diário atingido. Nova tentativa após 00:00".
 */
export class LimiteDiarioAtingidoException extends HttpException {
  constructor(
    public readonly contadorHoje: number,
    public readonly limiteDiario: number,
  ) {
    super(
      {
        erro: 'LIMITE_DIARIO_ATINGIDO',
        mensagem:
          'O limite diário de consultas SEFAZ foi atingido. A plataforma retomará as consultas automaticamente a partir de 00:00. Admin T.I. pode liberar manualmente em caso de urgência.',
        contadorHoje,
        limiteDiario,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
