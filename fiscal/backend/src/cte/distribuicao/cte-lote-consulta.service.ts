import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CteLoteConsulta, StatusLoteConsulta } from '@prisma/client';

export type OrigemLote = 'manual' | 'cron' | 'retry';

export interface AbrirLoteParams {
  cnpjConsulente: string;
  ambiente: 1 | 2;
  ultNsuInicial: string;
  origem: OrigemLote;
  dryRun: boolean;
}

export interface FecharLoteParams {
  loteId: number;
  iteracoes: number;
  ultNsuFinal: string;
  maxNsuFinal: string;
  docsPersistidos: number;
  docsDuplicados: number;
  status: StatusLoteConsulta;
  cStatUltimo?: string;
  xMotivoUltimo?: string;
  motivoStop?: string;
  duracaoMs: number;
  erroDetalhe?: string;
}

/**
 * Auditoria histórica de cada execução de `consultarFilial`. Cada chamada
 * (manual via endpoint admin OU automática via cron) gera 1 registro em
 * `fiscal.cte_lote_consulta` — abre quando inicia, fecha quando termina.
 *
 * Permite debug histórico ("o que rodou às 14h05 sexta?") e métricas
 * agregadas (taxa de sucesso, tempo médio, docs novos por execução).
 */
@Injectable()
export class CteLoteConsultaService {
  private readonly logger = new Logger(CteLoteConsultaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Abre um lote — chama no início de `consultarFilial` */
  async abrir(params: AbrirLoteParams): Promise<CteLoteConsulta> {
    return this.prisma.client.cteLoteConsulta.create({
      data: {
        cnpjConsulente: params.cnpjConsulente.replace(/\D/g, ''),
        ambiente: params.ambiente,
        ultNsuInicial: params.ultNsuInicial,
        ultNsuFinal: params.ultNsuInicial, // mesmo valor inicial; atualiza no fechar
        maxNsuFinal: '000000000000000',
        status: 'OK', // valor inicial; sobrescrito no fechar
        origem: params.origem,
        dryRun: params.dryRun,
      },
    });
  }

  /** Fecha um lote — chama no final de `consultarFilial` */
  async fechar(params: FecharLoteParams): Promise<CteLoteConsulta> {
    return this.prisma.client.cteLoteConsulta.update({
      where: { id: params.loteId },
      data: {
        finalizadoEm: new Date(),
        iteracoes: params.iteracoes,
        ultNsuFinal: params.ultNsuFinal,
        maxNsuFinal: params.maxNsuFinal,
        docsPersistidos: params.docsPersistidos,
        docsDuplicados: params.docsDuplicados,
        status: params.status,
        cStatUltimo: params.cStatUltimo,
        xMotivoUltimo: params.xMotivoUltimo,
        motivoStop: params.motivoStop,
        duracaoMs: params.duracaoMs,
        erroDetalhe: params.erroDetalhe,
      },
    });
  }

  /**
   * Lista últimos N lotes (ordem decrescente). Útil pra debug/admin UI.
   */
  async listarUltimos(limit: number = 20) {
    return this.prisma.client.cteLoteConsulta.findMany({
      orderBy: { iniciadoEm: 'desc' },
      take: limit,
    });
  }
}
