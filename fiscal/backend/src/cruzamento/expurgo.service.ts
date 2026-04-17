import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Expurgo conforme política de retenção LGPD (Seção 11.5 do addendum v1.5).
 *
 * Tabelas e janelas:
 *   - fiscal.documento_consulta    — 5 anos (valor fiscal)
 *   - fiscal.documento_xml         — 5 anos
 *   - fiscal.cadastro_historico    — 5 anos
 *   - fiscal.cadastro_sincronizacao — 2 anos (metadados operacionais)
 *   - fiscal.alerta_enviado        — 2 anos
 *   - fiscal.audit_log             — 5 anos
 *   - fiscal.protheus_snapshot     — 90 dias (reproduzível)
 *
 * Executa diariamente às 03:30 (fora da janela de carga diária às 01:00).
 * Endpoint manual `DELETE /api/v1/fiscal/cruzamento/expurgo` também dispara.
 *
 * Usa deleteMany com where em createdAt — para volumes grandes pode bloquear
 * o schema; para o volume atual (116k contribuintes, poucos milhares de
 * consultas/mês) é aceitável. Se virar problema, migrar para DELETE em
 * batches ou usar partitioning.
 */
@Injectable()
export class ExpurgoService {
  private readonly logger = new Logger(ExpurgoService.name);

  private readonly JANELA = {
    documentoConsulta: 5 * 365,
    documentoXml: 5 * 365,
    cadastroHistorico: 5 * 365,
    cadastroSincronizacao: 2 * 365,
    alertaEnviado: 2 * 365,
    auditLog: 5 * 365,
    protheusSnapshot: 90,
  };

  constructor(private readonly prisma: PrismaService) {}

  @Cron('30 3 * * *', { timeZone: 'America/Sao_Paulo', name: 'fiscal:expurgo' })
  async executar(): Promise<void> {
    this.logger.log('Iniciando expurgo LGPD diário...');
    try {
      const resultado = await this.expurgar();
      this.logger.log(`Expurgo concluído: ${JSON.stringify(resultado)}`);
    } catch (err) {
      this.logger.error(`Expurgo falhou: ${(err as Error).message}`);
    }
  }

  async expurgar(): Promise<Record<string, number>> {
    const cutoffs: Record<keyof typeof this.JANELA, Date> = {
      documentoConsulta: this.cutoff(this.JANELA.documentoConsulta),
      documentoXml: this.cutoff(this.JANELA.documentoXml),
      cadastroHistorico: this.cutoff(this.JANELA.cadastroHistorico),
      cadastroSincronizacao: this.cutoff(this.JANELA.cadastroSincronizacao),
      alertaEnviado: this.cutoff(this.JANELA.alertaEnviado),
      auditLog: this.cutoff(this.JANELA.auditLog),
      protheusSnapshot: this.cutoff(this.JANELA.protheusSnapshot),
    };

    const resultado: Record<string, number> = {};

    const r1 = await this.prisma.documentoConsulta.deleteMany({
      where: { createdAt: { lt: cutoffs.documentoConsulta } },
    });
    resultado.documento_consulta = r1.count;

    const r2 = await this.prisma.documentoXmlIndex.deleteMany({
      where: { createdAt: { lt: cutoffs.documentoXml } },
    });
    resultado.documento_xml = r2.count;

    const r3 = await this.prisma.cadastroHistorico.deleteMany({
      where: { detectadoEm: { lt: cutoffs.cadastroHistorico } },
    });
    resultado.cadastro_historico = r3.count;

    // cadastro_sincronizacao depende de alerta_enviado (FK) — apaga alertas primeiro
    const r4 = await this.prisma.alertaEnviado.deleteMany({
      where: { enviadoEm: { lt: cutoffs.alertaEnviado } },
    });
    resultado.alerta_enviado = r4.count;

    const r5 = await this.prisma.cadastroSincronizacao.deleteMany({
      where: {
        createdAt: { lt: cutoffs.cadastroSincronizacao },
        alertas: { none: {} },
      },
    });
    resultado.cadastro_sincronizacao = r5.count;

    const r6 = await this.prisma.protheusSnapshot.deleteMany({
      where: { capturadoEm: { lt: cutoffs.protheusSnapshot } },
    });
    resultado.protheus_snapshot = r6.count;

    const r7 = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoffs.auditLog } },
    });
    resultado.audit_log = r7.count;

    return resultado;
  }

  private cutoff(dias: number): Date {
    return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  }
}
