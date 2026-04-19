import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ProtheusHttpClient, ProtheusHttpError } from './protheus-http.client.js';
import type { EventosNfeResponse } from './interfaces/eventos-nfe.interface.js';

/**
 * Adapter da frente `eventosNfe` da API Protheus (contrato recebido 18/04/2026).
 *
 * Observações sobre o contrato:
 *   - Parâmetro na query string é `CHAVENFEE` (duplo E — decisão da equipe Protheus)
 *   - 400 quando a chave não tem exatamente 44 dígitos numéricos
 *   - 200 com `quantidade: 0, eventos: []` quando a chave é válida mas sem eventos
 *   - Campo `quando` vem em `YYYYMMDD HH:MM:SS` (timezone America/Sao_Paulo)
 *
 * A regra interna da CAPUL de filtrar SF1010 para fora da timeline (memory
 * `feedback_fiscal_timeline_so_sped`) é aplicada no CALLER deste service,
 * não aqui. Este service apenas retorna o payload cru da API.
 */
@Injectable()
export class ProtheusEventosService {
  private readonly logger = new Logger(ProtheusEventosService.name);

  constructor(private readonly http: ProtheusHttpClient) {}

  /**
   * Consulta timeline de eventos de uma NF-e.
   *
   * @param chave chave de 44 dígitos (apenas números)
   * @returns `{ chave, quantidade, eventos[] }` — `quantidade=0` quando não há eventos
   * @throws BadRequestException se a chave tiver formato inválido
   * @throws ProtheusHttpError em erros de rede ou 5xx do Protheus
   */
  async listar(chave: string): Promise<EventosNfeResponse> {
    if (!/^\d{44}$/.test(chave)) {
      throw new BadRequestException(
        `Chave inválida: esperado 44 dígitos numéricos, recebido "${chave}".`,
      );
    }

    try {
      return await this.http.request<EventosNfeResponse>({
        operacao: 'eventosNfe',
        method: 'GET',
        query: { CHAVENFEE: chave },
      });
    } catch (err) {
      if (err instanceof ProtheusHttpError && err.statusCode === 400) {
        const body = err.body as { message?: string } | null;
        throw new BadRequestException(body?.message ?? 'Chave rejeitada pela API Protheus.');
      }
      throw err;
    }
  }
}
