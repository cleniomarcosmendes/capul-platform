import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ContratoCoreService } from './contrato-core.service.js';
import { CreateParcelaDto } from '../dto/create-parcela.dto.js';
import { UpdateParcelaDto } from '../dto/update-parcela.dto.js';
import { PagarParcelaDto } from '../dto/update-parcela.dto.js';

@Injectable()
export class ContratoParcelaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: ContratoCoreService,
  ) {}

  async listarParcelas(contratoId: string) {
    await this.core.findOne(contratoId);
    return this.prisma.parcelaContrato.findMany({
      where: { contratoId },
      include: {
        rateioItens: {
          include: {
            centroCusto: { select: { id: true, codigo: true, nome: true } },
            natureza: { select: { id: true, codigo: true, nome: true } },
          },
        },
      },
      orderBy: { numero: 'asc' },
    });
  }

  async criarParcela(contratoId: string, dto: CreateParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    if (['RENOVADO', 'CANCELADO', 'ENCERRADO'].includes(contrato.status)) {
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
        dataVencimento: this.core.parseDate(dto.dataVencimento),
        notaFiscal: dto.notaFiscal,
        observacoes: dto.observacoes,
        contratoId,
      },
    });

    await this.core.criarHistorico(contratoId, 'OBSERVACAO', `Parcela #${dto.numero} criada`, usuarioId);

    return parcela;
  }

  async atualizarParcela(contratoId: string, parcelaId: string, dto: UpdateParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }

    const data: Record<string, unknown> = {};

    if (parcela.status === 'PAGA') {
      // Parcela paga: permite alterar apenas NF, observacoes e data de envio
      if (dto.notaFiscal !== undefined) data.notaFiscal = dto.notaFiscal;
      if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;
      if (dto.dataPagamento !== undefined) data.dataPagamento = this.core.parseDate(dto.dataPagamento);
      if (Object.keys(data).length === 0) {
        throw new BadRequestException('Parcela paga: apenas Nota Fiscal, Data de Envio e Observacoes podem ser alterados');
      }
    } else {
      if (dto.numero !== undefined) data.numero = dto.numero;
      if (dto.descricao !== undefined) data.descricao = dto.descricao;
      if (dto.valor !== undefined) data.valor = dto.valor;
      if (dto.dataVencimento !== undefined) data.dataVencimento = this.core.parseDate(dto.dataVencimento);
      if (dto.notaFiscal !== undefined) data.notaFiscal = dto.notaFiscal;
      if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;
      if (dto.dataPagamento !== undefined) data.dataPagamento = this.core.parseDate(dto.dataPagamento);
    }

    return this.prisma.parcelaContrato.update({
      where: { id: parcelaId },
      data,
    });
  }

  async pagarParcela(contratoId: string, parcelaId: string, dto: PagarParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

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
        dataPagamento: dto.dataPagamento ? this.core.parseDate(dto.dataPagamento) : new Date(),
        notaFiscal: dto.notaFiscal ?? parcela.notaFiscal,
      },
    });

    await this.core.criarHistorico(
      contratoId,
      'PARCELA_PAGA',
      `Parcela #${parcela.numero} paga`,
      usuarioId,
    );

    return updated;
  }

  async estornarParcela(contratoId: string, parcelaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (parcela.status !== 'PAGA') {
      throw new BadRequestException('Somente parcelas pagas podem ser estornadas');
    }

    const updated = await this.prisma.parcelaContrato.update({
      where: { id: parcelaId },
      data: {
        status: 'PENDENTE',
        dataPagamento: null,
      },
    });

    await this.core.criarHistorico(
      contratoId,
      'OBSERVACAO',
      `Parcela #${parcela.numero} estornada (voltou para pendente)`,
      usuarioId,
    );

    return updated;
  }

  async cancelarParcela(contratoId: string, parcelaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (parcela.status === 'PAGA') {
      throw new BadRequestException('Parcela ja paga nao pode ser cancelada');
    }
    if (parcela.status === 'CANCELADA') {
      throw new BadRequestException('Parcela ja esta cancelada');
    }

    const updated = await this.prisma.parcelaContrato.update({
      where: { id: parcelaId },
      data: { status: 'CANCELADA' },
    });

    await this.core.criarHistorico(
      contratoId,
      'OBSERVACAO',
      `Parcela #${parcela.numero} cancelada`,
      usuarioId,
    );

    return updated;
  }
}
