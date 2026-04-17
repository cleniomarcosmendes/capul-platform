import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ProtheusHttpClient } from './protheus-http.client.js';
import type {
  CadastroFiscalCnpjResponse,
  CadastroFiscalListResponse,
  CadastroFiscalQuery,
} from './interfaces/cadastro-fiscal.interface.js';

/**
 * Adapter da frente `cadastroFiscal` (Especificação API v2.0 §3.3 e §3.4).
 *
 * Não há mock aqui — a frente cadastroFiscal já estava na v1.1 do contrato e
 * o time Protheus já avaliou o escopo. O endpoint pode estar em homologação na
 * segunda-feira; até lá, este service retorna ProtheusHttpError quando chamado.
 */
@Injectable()
export class ProtheusCadastroService {
  private readonly logger = new Logger(ProtheusCadastroService.name);

  constructor(private readonly http: ProtheusHttpClient) {}

  async listar(query: CadastroFiscalQuery): Promise<CadastroFiscalListResponse> {
    return this.http.get<CadastroFiscalListResponse>('/cadastroFiscal', {
      tipo: query.tipo,
      ativo: query.ativo,
      filial: query.filial,
      desdeData: query.desdeData,
      comMovimentoDesde: query.comMovimentoDesde,
      pagina: query.pagina,
      porPagina: query.porPagina,
    });
  }

  async porCnpj(cnpj: string): Promise<CadastroFiscalCnpjResponse> {
    if (!/^\d{14}$/.test(cnpj)) {
      throw new BadRequestException(`CNPJ inválido: esperado 14 dígitos, recebido "${cnpj}"`);
    }
    return this.http.get<CadastroFiscalCnpjResponse>(`/cadastroFiscal/${cnpj}`);
  }

  async health(): Promise<{ status: string; versao: string; timestamp: string }> {
    return this.http.get('/cadastroFiscal/health');
  }
}
