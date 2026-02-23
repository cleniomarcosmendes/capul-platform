import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusContrato, ModalidadeRateio } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
import { CreateParcelaDto } from './dto/create-parcela.dto';
import { UpdateParcelaDto } from './dto/update-parcela.dto';
import { PagarParcelaDto } from './dto/update-parcela.dto';
import { ConfigurarRateioDto, SimularRateioDto, RateioItemDto } from './dto/rateio.dto';

const contratoListInclude = {
  software: { select: { id: true, nome: true, fabricante: true } },
  _count: { select: { parcelas: true, licencas: true } },
};

const contratoDetailInclude = {
  software: { select: { id: true, nome: true, fabricante: true, tipo: true } },
  parcelas: { orderBy: { numero: 'asc' as const } },
  rateioConfig: {
    include: {
      itens: {
        include: { centroCusto: { select: { id: true, codigo: true, nome: true } } },
        orderBy: { centroCusto: { nome: 'asc' as const } },
      },
    },
  },
  historicos: {
    include: { usuario: { select: { id: true, nome: true, username: true } } },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
  licencas: {
    include: { software: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  _count: { select: { parcelas: true, licencas: true } },
};

const TRANSICOES_VALIDAS: Record<StatusContrato, StatusContrato[]> = {
  RASCUNHO: ['ATIVO', 'CANCELADO'],
  ATIVO: ['SUSPENSO', 'VENCIDO', 'RENOVADO', 'CANCELADO'],
  SUSPENSO: ['ATIVO', 'CANCELADO'],
  VENCIDO: ['RENOVADO'],
  RENOVADO: [],
  CANCELADO: [],
};

@Injectable()
export class ContratoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    tipo?: string;
    status?: string;
    softwareId?: string;
    fornecedor?: string;
    vencendoEm?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.status) where.status = filters.status;
    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.fornecedor) {
      where.fornecedor = { contains: filters.fornecedor, mode: 'insensitive' };
    }
    if (filters.vencendoEm) {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + filters.vencendoEm);
      where.dataFim = { lte: dataLimite };
      where.status = { in: ['ATIVO', 'SUSPENSO'] };
    }

    return this.prisma.contrato.findMany({
      where,
      include: contratoListInclude,
      orderBy: { numero: 'desc' },
    });
  }

  async findOne(id: string) {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id },
      include: contratoDetailInclude,
    });

    if (!contrato) {
      throw new NotFoundException('Contrato nao encontrado');
    }

    return contrato;
  }

  async create(dto: CreateContratoDto, usuarioId: string) {
    if (dto.softwareId) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!sw) throw new BadRequestException('Software nao encontrado');
    }

    const contrato = await this.prisma.contrato.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        fornecedor: dto.fornecedor,
        cnpjFornecedor: dto.cnpjFornecedor,
        valorTotal: dto.valorTotal,
        valorMensal: dto.valorMensal,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        dataAssinatura: dto.dataAssinatura ? new Date(dto.dataAssinatura) : undefined,
        indiceReajuste: dto.indiceReajuste,
        percentualReajuste: dto.percentualReajuste,
        renovacaoAutomatica: dto.renovacaoAutomatica,
        diasAlertaVencimento: dto.diasAlertaVencimento,
        softwareId: dto.softwareId,
        observacoes: dto.observacoes,
      },
      include: contratoListInclude,
    });

    await this.criarHistorico(contrato.id, 'CRIACAO', 'Contrato criado', usuarioId);

    return contrato;
  }

  async update(id: string, dto: UpdateContratoDto, usuarioId: string) {
    const contrato = await this.findOne(id);

    if (['RENOVADO', 'CANCELADO'].includes(contrato.status)) {
      throw new BadRequestException('Contrato finalizado nao pode ser alterado');
    }

    if (dto.softwareId) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!sw) throw new BadRequestException('Software nao encontrado');
    }

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.fornecedor !== undefined) data.fornecedor = dto.fornecedor;
    if (dto.cnpjFornecedor !== undefined) data.cnpjFornecedor = dto.cnpjFornecedor;
    if (dto.valorTotal !== undefined) data.valorTotal = dto.valorTotal;
    if (dto.valorMensal !== undefined) data.valorMensal = dto.valorMensal;
    if (dto.dataInicio !== undefined) data.dataInicio = new Date(dto.dataInicio);
    if (dto.dataFim !== undefined) data.dataFim = new Date(dto.dataFim);
    if (dto.dataAssinatura !== undefined) data.dataAssinatura = dto.dataAssinatura ? new Date(dto.dataAssinatura) : null;
    if (dto.indiceReajuste !== undefined) data.indiceReajuste = dto.indiceReajuste;
    if (dto.percentualReajuste !== undefined) data.percentualReajuste = dto.percentualReajuste;
    if (dto.renovacaoAutomatica !== undefined) data.renovacaoAutomatica = dto.renovacaoAutomatica;
    if (dto.diasAlertaVencimento !== undefined) data.diasAlertaVencimento = dto.diasAlertaVencimento;
    if (dto.softwareId !== undefined) data.softwareId = dto.softwareId || null;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    const updated = await this.prisma.contrato.update({
      where: { id },
      data,
      include: contratoDetailInclude,
    });

    await this.criarHistorico(id, 'ALTERACAO', 'Contrato atualizado', usuarioId);

    return updated;
  }

  async alterarStatus(id: string, novoStatus: StatusContrato, usuarioId: string) {
    const contrato = await this.findOne(id);

    const permitidos = TRANSICOES_VALIDAS[contrato.status];
    if (!permitidos.includes(novoStatus)) {
      throw new BadRequestException(
        `Transicao de ${contrato.status} para ${novoStatus} nao e permitida`,
      );
    }

    const tipoHistorico = {
      ATIVO: 'ATIVACAO' as const,
      SUSPENSO: 'SUSPENSAO' as const,
      VENCIDO: 'VENCIMENTO' as const,
      RENOVADO: 'RENOVACAO' as const,
      CANCELADO: 'CANCELAMENTO' as const,
    }[novoStatus] || ('ALTERACAO' as const);

    const updated = await this.prisma.contrato.update({
      where: { id },
      data: { status: novoStatus },
      include: contratoDetailInclude,
    });

    await this.criarHistorico(id, tipoHistorico, `Status alterado para ${novoStatus}`, usuarioId);

    return updated;
  }

  async renovar(id: string, usuarioId: string) {
    const contrato = await this.findOne(id);

    if (!['ATIVO', 'VENCIDO'].includes(contrato.status)) {
      throw new BadRequestException('Somente contratos ativos ou vencidos podem ser renovados');
    }

    const duracaoMs = new Date(contrato.dataFim).getTime() - new Date(contrato.dataInicio).getTime();
    const novaDataInicio = new Date(contrato.dataFim);
    const novaDataFim = new Date(novaDataInicio.getTime() + duracaoMs);

    const [, novoContrato] = await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: { status: 'RENOVADO' },
      }),
      this.prisma.contrato.create({
        data: {
          titulo: contrato.titulo,
          descricao: contrato.descricao,
          tipo: contrato.tipo,
          fornecedor: contrato.fornecedor,
          cnpjFornecedor: contrato.cnpjFornecedor,
          valorTotal: contrato.valorTotal,
          valorMensal: contrato.valorMensal,
          dataInicio: novaDataInicio,
          dataFim: novaDataFim,
          indiceReajuste: contrato.indiceReajuste,
          percentualReajuste: contrato.percentualReajuste,
          renovacaoAutomatica: contrato.renovacaoAutomatica,
          diasAlertaVencimento: contrato.diasAlertaVencimento,
          softwareId: contrato.softwareId,
          observacoes: contrato.observacoes,
          dataRenovacao: new Date(),
          status: 'ATIVO',
        },
        include: contratoListInclude,
      }),
    ]);

    await this.criarHistorico(id, 'RENOVACAO', `Renovado. Novo contrato #${novoContrato.numero}`, usuarioId);
    await this.criarHistorico(novoContrato.id, 'CRIACAO', `Renovacao do contrato #${contrato.numero}`, usuarioId);

    return novoContrato;
  }

  // --- Parcelas ---

  async listarParcelas(contratoId: string) {
    await this.findOne(contratoId);
    return this.prisma.parcelaContrato.findMany({
      where: { contratoId },
      orderBy: { numero: 'asc' },
    });
  }

  async criarParcela(contratoId: string, dto: CreateParcelaDto, usuarioId: string) {
    const contrato = await this.findOne(contratoId);

    if (['RENOVADO', 'CANCELADO'].includes(contrato.status)) {
      throw new BadRequestException('Contrato finalizado nao permite novas parcelas');
    }

    const existente = await this.prisma.parcelaContrato.findUnique({
      where: { contratoId_numero: { contratoId, numero: dto.numero } },
    });
    if (existente) {
      throw new ConflictException(`Parcela #${dto.numero} ja existe neste contrato`);
    }

    const parcela = await this.prisma.parcelaContrato.create({
      data: {
        numero: dto.numero,
        descricao: dto.descricao,
        valor: dto.valor,
        dataVencimento: new Date(dto.dataVencimento),
        notaFiscal: dto.notaFiscal,
        observacoes: dto.observacoes,
        contratoId,
      },
    });

    await this.criarHistorico(contratoId, 'OBSERVACAO', `Parcela #${dto.numero} criada`, usuarioId);

    return parcela;
  }

  async atualizarParcela(contratoId: string, parcelaId: string, dto: UpdateParcelaDto) {
    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (parcela.status === 'PAGA') {
      throw new BadRequestException('Parcela ja paga nao pode ser alterada');
    }

    const data: Record<string, unknown> = {};
    if (dto.numero !== undefined) data.numero = dto.numero;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.valor !== undefined) data.valor = dto.valor;
    if (dto.dataVencimento !== undefined) data.dataVencimento = new Date(dto.dataVencimento);
    if (dto.notaFiscal !== undefined) data.notaFiscal = dto.notaFiscal;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.parcelaContrato.update({
      where: { id: parcelaId },
      data,
    });
  }

  async pagarParcela(contratoId: string, parcelaId: string, dto: PagarParcelaDto, usuarioId: string) {
    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (parcela.status === 'PAGA') {
      throw new BadRequestException('Parcela ja foi paga');
    }
    if (parcela.status === 'CANCELADA') {
      throw new BadRequestException('Parcela cancelada nao pode ser paga');
    }

    const updated = await this.prisma.parcelaContrato.update({
      where: { id: parcelaId },
      data: {
        status: 'PAGA',
        dataPagamento: dto.dataPagamento ? new Date(dto.dataPagamento) : new Date(),
        notaFiscal: dto.notaFiscal ?? parcela.notaFiscal,
      },
    });

    await this.criarHistorico(
      contratoId,
      'PARCELA_PAGA',
      `Parcela #${parcela.numero} paga`,
      usuarioId,
    );

    return updated;
  }

  async cancelarParcela(contratoId: string, parcelaId: string, usuarioId: string) {
    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (parcela.status === 'PAGA') {
      throw new BadRequestException('Parcela ja paga nao pode ser cancelada');
    }

    const updated = await this.prisma.parcelaContrato.update({
      where: { id: parcelaId },
      data: { status: 'CANCELADA' },
    });

    await this.criarHistorico(
      contratoId,
      'OBSERVACAO',
      `Parcela #${parcela.numero} cancelada`,
      usuarioId,
    );

    return updated;
  }

  // --- Rateio ---

  async obterRateio(contratoId: string) {
    await this.findOne(contratoId);
    return this.prisma.contratoRateioConfig.findUnique({
      where: { contratoId },
      include: {
        itens: {
          include: { centroCusto: { select: { id: true, codigo: true, nome: true } } },
          orderBy: { centroCusto: { nome: 'asc' as const } },
        },
      },
    });
  }

  async simularRateio(contratoId: string, dto: SimularRateioDto) {
    const contrato = await this.findOne(contratoId);
    return this.computeRateio(dto.modalidade, dto.itens, new Decimal(contrato.valorTotal.toString()));
  }

  async configurarRateio(contratoId: string, dto: ConfigurarRateioDto, usuarioId: string) {
    const contrato = await this.findOne(contratoId);

    if (['RENOVADO', 'CANCELADO'].includes(contrato.status)) {
      throw new BadRequestException('Contrato finalizado nao permite alteracao de rateio');
    }

    const valorTotal = new Decimal(contrato.valorTotal.toString());
    const itensCalculados = this.computeRateio(dto.modalidade, dto.itens, valorTotal);

    await this.prisma.$transaction(async (tx) => {
      await tx.contratoRateioConfig.deleteMany({ where: { contratoId } });

      await tx.contratoRateioConfig.create({
        data: {
          contratoId,
          modalidade: dto.modalidade,
          criterio: dto.criterio,
          itens: {
            create: itensCalculados.map((item) => ({
              centroCustoId: item.centroCustoId,
              percentual: item.percentual,
              valorFixo: item.valorFixo,
              parametro: item.parametro,
              valorCalculado: item.valorCalculado,
            })),
          },
        },
      });
    });

    await this.criarHistorico(
      contratoId,
      'RATEIO_ALTERADO',
      `Rateio configurado: ${dto.modalidade}`,
      usuarioId,
    );

    return this.obterRateio(contratoId);
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
        }));
      }
    }
  }

  // --- Licencas ---

  async vincularLicenca(contratoId: string, licencaId: string, usuarioId: string) {
    await this.findOne(contratoId);

    const licenca = await this.prisma.softwareLicenca.findUnique({ where: { id: licencaId } });
    if (!licenca) {
      throw new NotFoundException('Licenca nao encontrada');
    }
    if (licenca.contratoId) {
      throw new ConflictException('Licenca ja esta vinculada a outro contrato');
    }

    const updated = await this.prisma.softwareLicenca.update({
      where: { id: licencaId },
      data: { contratoId },
      include: { software: { select: { id: true, nome: true } } },
    });

    await this.criarHistorico(contratoId, 'OBSERVACAO', `Licenca vinculada: ${updated.software.nome}`, usuarioId);

    return updated;
  }

  async desvincularLicenca(contratoId: string, licencaId: string, usuarioId: string) {
    const licenca = await this.prisma.softwareLicenca.findFirst({
      where: { id: licencaId, contratoId },
      include: { software: { select: { id: true, nome: true } } },
    });
    if (!licenca) {
      throw new NotFoundException('Licenca nao encontrada neste contrato');
    }

    const updated = await this.prisma.softwareLicenca.update({
      where: { id: licencaId },
      data: { contratoId: null },
    });

    await this.criarHistorico(contratoId, 'OBSERVACAO', `Licenca desvinculada: ${licenca.software.nome}`, usuarioId);

    return updated;
  }

  // --- Historico ---

  private async criarHistorico(
    contratoId: string,
    tipo: string,
    descricao: string,
    usuarioId: string,
  ) {
    await this.prisma.contratoHistorico.create({
      data: {
        contratoId,
        tipo: tipo as never,
        descricao,
        usuarioId,
      },
    });
  }
}
