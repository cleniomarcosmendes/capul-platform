import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ModalidadeRateio } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ContratoCoreService } from './contrato-core.service.js';
import { ConfigurarRateioTemplateDto, SimularRateioDto, RateioItemDto, GerarRateioParcelaDto, ConfigurarRateioDto } from '../dto/rateio.dto.js';

@Injectable()
export class ContratoRateioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: ContratoCoreService,
  ) {}

  async obterRateioTemplate(contratoId: string) {
    await this.core.findOne(contratoId);
    return this.prisma.rateioTemplate.findUnique({
      where: { contratoId },
      include: {
        itens: {
          include: {
            centroCusto: { select: { id: true, codigo: true, nome: true } },
            natureza: { select: { id: true, codigo: true, nome: true } },
          },
          orderBy: { centroCusto: { nome: 'asc' as const } },
        },
      },
    });
  }

  async simularRateioTemplate(contratoId: string, dto: SimularRateioDto) {
    const contrato = await this.core.findOne(contratoId);
    return this.computeRateio(dto.modalidade, dto.itens, new Decimal(contrato.valorTotal.toString()));
  }

  async configurarRateioTemplate(contratoId: string, dto: ConfigurarRateioTemplateDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    if (['RENOVADO', 'CANCELADO'].includes(contrato.status)) {
      throw new BadRequestException('Contrato finalizado nao permite alteracao de rateio');
    }

    // Validate items (don't need to compute values for template, just store config)
    if (dto.itens.length === 0) {
      throw new BadRequestException('Rateio deve ter pelo menos 1 item');
    }

    // Validar centros de custo duplicados
    const ccIds = dto.itens.map((i) => i.centroCustoId);
    const duplicados = ccIds.filter((id, idx) => ccIds.indexOf(id) !== idx);
    if (duplicados.length > 0) {
      throw new BadRequestException('Existem centros de custo duplicados no rateio. Remova as duplicidades antes de salvar.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rateioTemplate.deleteMany({ where: { contratoId } });

      await tx.rateioTemplate.create({
        data: {
          contratoId,
          modalidade: dto.modalidade,
          criterio: dto.criterio,
          itens: {
            create: dto.itens.map((item) => ({
              centroCustoId: item.centroCustoId,
              percentual: item.percentual,
              valorFixo: item.valorFixo,
              parametro: item.parametro,
              naturezaId: item.naturezaId,
            })),
          },
        },
      });
    });

    await this.core.criarHistorico(
      contratoId,
      'RATEIO_ALTERADO',
      `Rateio template configurado: ${dto.modalidade}`,
      usuarioId,
    );

    return this.obterRateioTemplate(contratoId);
  }

  // --- Rateio per Parcela ---

  async obterRateioParcela(contratoId: string, parcelaId: string) {
    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }

    return this.prisma.parcelaRateioItem.findMany({
      where: { parcelaId },
      include: {
        centroCusto: { select: { id: true, codigo: true, nome: true } },
        natureza: { select: { id: true, codigo: true, nome: true } },
      },
    });
  }

  async gerarRateioParcela(contratoId: string, parcelaId: string, dto: GerarRateioParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (parcela.status === 'CANCELADA') {
      throw new BadRequestException('Nao e possivel alterar rateio de parcela cancelada');
    }

    if (dto.usarTemplate) {
      const template = await this.prisma.rateioTemplate.findUnique({
        where: { contratoId },
        include: { itens: true },
      });
      if (!template) {
        throw new BadRequestException('Contrato nao possui rateio template configurado');
      }

      const valorParcela = new Decimal(parcela.valor.toString());
      const itensTemplate = template.itens.map((item) => ({
        centroCustoId: item.centroCustoId,
        percentual: item.percentual ? Number(item.percentual) : undefined,
        valorFixo: item.valorFixo ? Number(item.valorFixo) : undefined,
        parametro: item.parametro ? Number(item.parametro) : undefined,
        naturezaId: item.naturezaId || undefined,
      }));

      const itensCalculados = this.computeRateio(template.modalidade, itensTemplate, valorParcela);

      await this.prisma.$transaction(async (tx) => {
        await tx.parcelaRateioItem.deleteMany({ where: { parcelaId } });

        for (const item of itensCalculados) {
          await tx.parcelaRateioItem.create({
            data: {
              parcelaId,
              centroCustoId: item.centroCustoId,
              percentual: item.percentual,
              valorCalculado: item.valorCalculado,
              naturezaId: item.naturezaId,
            },
          });
        }
      });

      await this.core.criarHistorico(contratoId, 'RATEIO_ALTERADO', `Rateio gerado para parcela #${parcela.numero} via template`, usuarioId);
    }

    return this.obterRateioParcela(contratoId, parcelaId);
  }

  async configurarRateioParcela(contratoId: string, parcelaId: string, dto: ConfigurarRateioDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (parcela.status === 'CANCELADA') {
      throw new BadRequestException('Nao e possivel alterar rateio de parcela cancelada');
    }

    const valorParcela = new Decimal(parcela.valor.toString());
    const itensCalculados = this.computeRateio(dto.modalidade, dto.itens, valorParcela);

    await this.prisma.$transaction(async (tx) => {
      await tx.parcelaRateioItem.deleteMany({ where: { parcelaId } });

      for (const item of itensCalculados) {
        await tx.parcelaRateioItem.create({
          data: {
            parcelaId,
            centroCustoId: item.centroCustoId,
            percentual: item.percentual,
            valorCalculado: item.valorCalculado,
            naturezaId: item.naturezaId,
          },
        });
      }
    });

    await this.core.criarHistorico(contratoId, 'RATEIO_ALTERADO', `Rateio manual configurado para parcela #${parcela.numero}`, usuarioId);

    return this.obterRateioParcela(contratoId, parcelaId);
  }

  async copiarRateioParaPendentes(contratoId: string, parcelaId: string, usuarioId: string) {
    const parcelaOrigem = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcelaOrigem) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }

    const itensOrigem = await this.prisma.parcelaRateioItem.findMany({
      where: { parcelaId },
    });
    if (itensOrigem.length === 0) {
      throw new BadRequestException('Parcela de origem nao possui rateio configurado');
    }

    const parcelasPendentes = await this.prisma.parcelaContrato.findMany({
      where: { contratoId, status: 'PENDENTE', id: { not: parcelaId } },
    });

    for (const parcela of parcelasPendentes) {
      const valorParcela = Number(parcela.valor);

      await this.prisma.$transaction(async (tx) => {
        await tx.parcelaRateioItem.deleteMany({ where: { parcelaId: parcela.id } });

        for (const item of itensOrigem) {
          const percentual = item.percentual ? Number(item.percentual) : null;
          const valorCalculado = percentual !== null
            ? valorParcela * percentual / 100
            : Number(item.valorCalculado);

          await tx.parcelaRateioItem.create({
            data: {
              parcelaId: parcela.id,
              centroCustoId: item.centroCustoId,
              percentual: item.percentual,
              valorCalculado,
              naturezaId: item.naturezaId,
            },
          });
        }
      });
    }

    await this.core.criarHistorico(contratoId, 'RATEIO_ALTERADO', `Rateio da parcela #${parcelaOrigem.numero} copiado para ${parcelasPendentes.length} parcelas pendentes`, usuarioId);

    return { parcelasCopied: parcelasPendentes.length };
  }

  // --- Rateio por Projeto ---

  async obterRateioProjeto(contratoId: string, parcelaId: string) {
    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) throw new NotFoundException('Parcela nao encontrada neste contrato');

    return this.prisma.parcelaRateioProjeto.findMany({
      where: { parcelaId },
      include: {
        projeto: { select: { id: true, numero: true, nome: true, status: true } },
      },
      orderBy: { projeto: { numero: 'asc' } },
    });
  }

  async configurarRateioProjeto(
    contratoId: string,
    parcelaId: string,
    itens: { projetoId: string; percentual?: number; valorCalculado: number }[],
    usuarioId: string,
    role: string = 'ADMIN',
  ) {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) throw new NotFoundException('Parcela nao encontrada neste contrato');
    if (parcela.status === 'CANCELADA') {
      throw new BadRequestException('Nao e possivel alterar rateio de parcela cancelada');
    }

    if (itens.length === 0) {
      throw new BadRequestException('Rateio deve ter pelo menos 1 item');
    }

    // Validar projetos duplicados
    const projetoIds = itens.map((i) => i.projetoId);
    const duplicados = projetoIds.filter((id, idx) => projetoIds.indexOf(id) !== idx);
    if (duplicados.length > 0) {
      throw new BadRequestException('Existem projetos duplicados no rateio');
    }

    // Validar soma <= valor da parcela
    const somaValores = itens.reduce((s, i) => s + i.valorCalculado, 0);
    const valorParcela = Number(parcela.valor);
    if (somaValores > valorParcela + 0.01) {
      throw new BadRequestException(
        `Soma dos valores (R$ ${somaValores.toFixed(2)}) excede o valor da parcela (R$ ${valorParcela.toFixed(2)})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.parcelaRateioProjeto.deleteMany({ where: { parcelaId } });

      for (const item of itens) {
        await tx.parcelaRateioProjeto.create({
          data: {
            parcelaId,
            projetoId: item.projetoId,
            percentual: item.percentual ?? null,
            valorCalculado: item.valorCalculado,
          },
        });
      }
    });

    await this.core.criarHistorico(
      contratoId,
      'RATEIO_ALTERADO',
      `Rateio por projeto configurado para parcela #${parcela.numero} (${itens.length} projeto(s))`,
      usuarioId,
    );

    return this.obterRateioProjeto(contratoId, parcelaId);
  }

  async removerRateioProjeto(contratoId: string, parcelaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) throw new NotFoundException('Parcela nao encontrada neste contrato');

    await this.prisma.parcelaRateioProjeto.deleteMany({ where: { parcelaId } });

    await this.core.criarHistorico(
      contratoId,
      'RATEIO_ALTERADO',
      `Rateio por projeto removido da parcela #${parcela.numero}`,
      usuarioId,
    );

    return { success: true };
  }

  private computeRateio(
    modalidade: ModalidadeRateio,
    itens: RateioItemDto[],
    valorTotal: Decimal,
  ) {
    if (itens.length === 0) {
      throw new BadRequestException('Rateio deve ter pelo menos 1 item');
    }

    switch (modalidade) {
      case 'PERCENTUAL_CUSTOMIZADO': {
        const somaPercentual = itens.reduce((s, i) => s + (i.percentual || 0), 0);
        if (Math.abs(somaPercentual - 100) > 0.01) {
          throw new BadRequestException(`Soma dos percentuais deve ser 100%. Atual: ${somaPercentual}%`);
        }
        return itens.map((item) => ({
          centroCustoId: item.centroCustoId,
          percentual: item.percentual,
          valorFixo: null as number | null,
          parametro: null as number | null,
          valorCalculado: Number(valorTotal) * (item.percentual || 0) / 100,
          naturezaId: item.naturezaId || null,
        }));
      }

      case 'VALOR_FIXO': {
        const somaFixo = itens.reduce((s, i) => s + (i.valorFixo || 0), 0);
        if (Math.abs(somaFixo - Number(valorTotal)) > 0.01) {
          throw new BadRequestException(
            `Soma dos valores fixos (${somaFixo}) deve ser igual ao valor total (${valorTotal})`,
          );
        }
        return itens.map((item) => ({
          centroCustoId: item.centroCustoId,
          percentual: null as number | null,
          valorFixo: item.valorFixo,
          parametro: null as number | null,
          valorCalculado: item.valorFixo || 0,
          naturezaId: item.naturezaId || null,
        }));
      }

      case 'PROPORCIONAL_CRITERIO': {
        const somaParametros = itens.reduce((s, i) => s + (i.parametro || 0), 0);
        if (somaParametros === 0) {
          throw new BadRequestException('Soma dos parametros nao pode ser zero');
        }
        return itens.map((item) => ({
          centroCustoId: item.centroCustoId,
          percentual: null as number | null,
          valorFixo: null as number | null,
          parametro: item.parametro,
          valorCalculado: ((item.parametro || 0) / somaParametros) * Number(valorTotal),
          naturezaId: item.naturezaId || null,
        }));
      }

      case 'IGUALITARIO': {
        const valorPorItem = Number(valorTotal) / itens.length;
        return itens.map((item) => ({
          centroCustoId: item.centroCustoId,
          percentual: null as number | null,
          valorFixo: null as number | null,
          parametro: null as number | null,
          valorCalculado: valorPorItem,
          naturezaId: item.naturezaId || null,
        }));
      }

      case 'SEM_RATEIO': {
        if (itens.length !== 1) {
          throw new BadRequestException('SEM_RATEIO deve ter exatamente 1 item');
        }
        return itens.map((item) => ({
          centroCustoId: item.centroCustoId,
          percentual: null as number | null,
          valorFixo: null as number | null,
          parametro: null as number | null,
          valorCalculado: Number(valorTotal),
          naturezaId: item.naturezaId || null,
        }));
      }
    }
  }
}
