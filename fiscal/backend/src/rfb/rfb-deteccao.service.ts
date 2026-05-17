import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RfbWebdavService } from './rfb-webdav.service.js';

// F1.2 — Detecção de nova versão. NÃO importa (import é manual — F1.3).
// O cron semanal que chama isto vem na F1.4; a lógica vive aqui.
@Injectable()
export class RfbDeteccaoService {
  private readonly logger = new Logger(RfbDeteccaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webdav: RfbWebdavService,
  ) {}

  /** Lista versões publicadas, marca a mais recente como DISPONIVEL se ainda
   *  não houver registro. Idempotente — seguro chamar via cron ou manual. */
  async detectar() {
    const versoes = await this.webdav.listarVersoes();
    if (versoes.length === 0) {
      throw new Error('RFB: nenhuma versão AAAA-MM encontrada (estrutura do share mudou?)');
    }
    const maisRecente = versoes[versoes.length - 1];
    const existente = await this.prisma.rfbControleImportacao.findUnique({
      where: { versaoRfb: maisRecente },
    });
    if (!existente) {
      await this.prisma.rfbControleImportacao.create({
        data: { versaoRfb: maisRecente, status: 'DISPONIVEL', dataDeteccao: new Date() },
      });
      this.logger.log(`RFB: nova versão ${maisRecente} marcada DISPONIVEL`);
    }
    const importada = existente?.status === 'CONCLUIDO';
    return { versoes, maisRecente, importada, novaDisponivel: !importada };
  }

  /** Histórico recente de importações (p/ UI F1.4). */
  async status() {
    const ultimas = await this.prisma.rfbControleImportacao.findMany({
      orderBy: { versaoRfb: 'desc' },
      take: 12,
    });
    return { ultimas };
  }
}
