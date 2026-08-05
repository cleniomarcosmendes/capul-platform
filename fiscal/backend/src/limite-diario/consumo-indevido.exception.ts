import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Lançada quando o freio de consumo indevido (cStat=656) está ativo — a SEFAZ
 * marcou o certificado consulente da CAPUL como abusivo e QUALQUER consulta
 * nova agrava o risco de bloqueio do CNPJ.
 *
 * Diferente de `LimiteDiarioAtingidoException`: aquela é cota estourada (expira
 * no reset das 00:05); esta é marcação da SEFAZ (expira por tempo). A mensagem
 * precisa ser diferente, senão o operador lê "limite diário" e acha que basta
 * esperar a virada do dia.
 *
 * HTTP 503 — espelha o que `nfe.service` já devolvia no 656 direto, para a UI
 * não precisar aprender um código novo.
 */
export class ConsumoIndevidoBloqueadoException extends HttpException {
  constructor(
    public readonly bloqueadoAte: Date,
    public readonly motivo: string | null,
  ) {
    const restanteMin = Math.max(1, Math.ceil((bloqueadoAte.getTime() - Date.now()) / 60_000));
    super(
      {
        erro: 'SEFAZ_CONSUMO_INDEVIDO_BLOQUEADO',
        mensagem:
          `Consultas SEFAZ estão PARADAS porque a SEFAZ acusou consumo indevido (cStat=656) ` +
          `do CNPJ da CAPUL. Liberação automática em ~${restanteMin} min. ` +
          `Enquanto isso, use o Protheus (SZR010) ou solicite o XML ao emitente. ` +
          `Insistir agora aumenta o risco de bloqueio do CNPJ.`,
        bloqueadoAte: bloqueadoAte.toISOString(),
        minutosRestantes: restanteMin,
        motivo,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
