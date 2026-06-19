import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Purga de retenção do rastro de GPS (LGPD, 19/06/2026).
 *
 * `posicao_veiculo` é o trail bruto do rastreamento ao vivo — cresce rápido e
 * não precisa ser mantido pra sempre. Mantemos só uma janela curta (default 7
 * dias, configurável em RASTREAMENTO_RETENCAO_DIAS) e apagamos o resto todo dia.
 * O GPS da BAIXA/entrega (lastro de cobrança) fica em outra tabela — não é
 * tocado aqui.
 *
 * Cron diário às 03:30. Atenção: em múltiplas réplicas, dispararia em cada uma
 * (idempotente — deleteMany por data não duplica efeito). Deploy atual é single.
 */
@Injectable()
export class RastreamentoPurgaService implements OnModuleInit {
  private readonly logger = new Logger(RastreamentoPurgaService.name);
  private readonly retencaoDias = Math.max(1, Number(process.env.RASTREAMENTO_RETENCAO_DIAS ?? 7) || 7);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log(
      `Purga de rastreamento ativa: posições > ${this.retencaoDias} dia(s) removidas diariamente (03:30). ` +
        `Ajuste via RASTREAMENTO_RETENCAO_DIAS.`,
    );
  }

  @Cron('0 30 3 * * *', { name: 'purga-rastreamento' })
  async purgaAgendada() {
    const n = await this.purgar();
    this.logger.log(`Purga de rastreamento: ${n} posição(ões) antiga(s) removida(s) (retenção ${this.retencaoDias}d).`);
  }

  /** Apaga pings de GPS além da janela de retenção. Retorna quantos removeu. */
  async purgar(): Promise<number> {
    const corte = new Date(Date.now() - this.retencaoDias * 86_400_000);
    const r = await this.prisma.posicaoVeiculo.deleteMany({ where: { capturadoEm: { lt: corte } } });
    return r.count;
  }

  get diasRetencao(): number {
    return this.retencaoDias;
  }
}
