import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { LimiteDiarioService } from '../limite-diario/limite-diario.service.js';
import { SchedulerService } from '../cruzamento/scheduler.service.js';
import { CertificadoService } from '../certificado/certificado.service.js';

/**
 * Agrega em uma unica chamada todas as metricas que o DashboardPage precisa,
 * evitando 6+ requests paralelos do frontend. Cada componente ainda pode
 * consultar seu endpoint dedicado para detalhes — este endpoint e so overview.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ambiente: AmbienteService,
    private readonly limiteDiario: LimiteDiarioService,
    private readonly scheduler: SchedulerService,
    private readonly certificado: CertificadoService,
  ) {}

  async getOverview() {
    const [ambiente, consumo, circuits, certs, divergenciasAgrupadas, ultimasExecucoes] =
      await Promise.all([
        this.ambiente.getStatus(),
        this.limiteDiario.getStatus(),
        this.prisma.ufCircuitState.findMany({
          where: { estado: { in: ['ABERTO', 'MEIO_ABERTO'] } },
          select: { uf: true, estado: true, retomadaEm: true },
        }),
        this.certificado.listar(),
        this.prisma.cadastroDivergencia.groupBy({
          by: ['criticidade'],
          where: { status: 'ABERTA' },
          _count: { _all: true },
        }),
        this.prisma.cadastroSincronizacao.findMany({
          orderBy: { iniciadoEm: 'desc' },
          take: 5,
          select: {
            id: true,
            tipo: true,
            status: true,
            iniciadoEm: true,
            finalizadoEm: true,
            totalContribuintes: true,
            sucessos: true,
            erros: true,
          },
        }),
      ]);

    const schedulerStatus = this.scheduler.getStatus();

    const certAtivo = certs.find((c) => c.ativo) ?? null;

    const divergencias = {
      abertasTotal: divergenciasAgrupadas.reduce((acc, g) => acc + g._count._all, 0),
      porCriticidade: {
        CRITICA: 0,
        ALTA: 0,
        MEDIA: 0,
        BAIXA: 0,
      } as Record<'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA', number>,
    };
    for (const g of divergenciasAgrupadas) {
      divergencias.porCriticidade[g.criticidade] = g._count._all;
    }

    const nivelConsumo: 'ok' | 'amarelo' | 'vermelho' | 'critico' = consumo.pausadoAutomatico
      ? 'critico'
      : consumo.contadorHoje >= consumo.alertaVermelho
        ? 'vermelho'
        : consumo.contadorHoje >= consumo.alertaAmarelo
          ? 'amarelo'
          : 'ok';

    return {
      ambiente: {
        ativo: ambiente.ambienteAtivo,
        pauseSync: ambiente.pauseSync,
      },
      consumoDiario: {
        contador: consumo.contadorHoje,
        limite: consumo.limiteDiario,
        alertaAmarelo: consumo.alertaAmarelo,
        alertaVermelho: consumo.alertaVermelho,
        percentual: consumo.percentualConsumido,
        nivel: nivelConsumo,
        pausadoAutomatico: consumo.pausadoAutomatico,
      },
      divergencias,
      certificado: certAtivo
        ? {
            cnpj: certAtivo.cnpjMascarado,
            validoAte: certAtivo.validoAte,
            diasParaVencer: certAtivo.diasParaVencer,
            vencendoEmMenosDe60Dias: certAtivo.vencendoEmMenosDe60Dias,
          }
        : null,
      ufsBloqueadas: circuits.map((c) => ({
        uf: c.uf,
        estado: c.estado,
        retomadaEm: c.retomadaEm,
      })),
      scheduler: schedulerStatus,
      ultimasExecucoes,
    };
  }
}
