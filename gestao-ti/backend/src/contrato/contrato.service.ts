import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusContrato, ModalidadeRateio } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as fs from 'fs';
import * as path from 'path';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
import { CreateParcelaDto } from './dto/create-parcela.dto';
import { UpdateParcelaDto } from './dto/update-parcela.dto';
import { PagarParcelaDto } from './dto/update-parcela.dto';
import { ConfigurarRateioTemplateDto, SimularRateioDto, RateioItemDto, GerarRateioParcelaDto, ConfigurarRateioDto } from './dto/rateio.dto';
import { RenovarContratoDto } from './dto/renovar-contrato.dto';
import { CreateNaturezaDto, UpdateNaturezaDto } from './dto/create-natureza.dto';
import { CreateTipoContratoDto, UpdateTipoContratoDto } from './dto/create-tipo-contrato.dto';

const UPLOADS_DIR = path.resolve('./uploads/contratos');

const contratoListInclude = {
  software: { select: { id: true, nome: true, fabricante: true } },
  tipoContrato: { select: { id: true, codigo: true, nome: true } },
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  equipe: { select: { id: true, nome: true, sigla: true } },
  rateioTemplate: { select: { id: true, modalidade: true } },
  _count: { select: { parcelas: true, licencas: true, anexos: true } },
};

const contratoDetailInclude = {
  software: { select: { id: true, nome: true, fabricante: true, tipo: true } },
  tipoContrato: { select: { id: true, codigo: true, nome: true } },
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  equipe: { select: { id: true, nome: true, sigla: true } },
  parcelas: {
    include: {
      rateioItens: {
        include: {
          centroCusto: { select: { id: true, codigo: true, nome: true } },
          natureza: { select: { id: true, codigo: true, nome: true } },
        },
      },
    },
    orderBy: { numero: 'asc' as const },
  },
  rateioTemplate: {
    include: {
      itens: {
        include: {
          centroCusto: { select: { id: true, codigo: true, nome: true } },
          natureza: { select: { id: true, codigo: true, nome: true } },
        },
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
  anexos: { orderBy: { createdAt: 'desc' as const } },
  contratosRenovados: {
    select: { id: true, numero: true, titulo: true, valorTotal: true, dataInicio: true, dataFim: true, status: true },
  },
  contratoOriginal: {
    select: { id: true, numero: true, titulo: true },
  },
  _count: { select: { parcelas: true, licencas: true, anexos: true } },
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
  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  /**
   * Verifica se o usuario tem permissao para gerenciar contratos de uma equipe.
   * ADMIN e GESTOR_TI sempre tem acesso. TECNICO precisa ser membro da equipe com podeGerirContratos.
   */
  private async ensureContratoPermission(equipeId: string | null | undefined, usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR_TI') return;
    if (!equipeId) {
      throw new ForbiddenException('Contrato sem equipe associada. Apenas ADMIN ou GESTOR_TI podem gerenciar.');
    }
    const membro = await this.prisma.membroEquipe.findUnique({
      where: { usuarioId_equipeId: { usuarioId, equipeId } },
    });
    if (!membro || membro.status !== 'ATIVO' || !membro.podeGerirContratos) {
      throw new ForbiddenException('Voce nao tem permissao para gerenciar contratos desta equipe.');
    }
  }

  async findAll(filters: {
    tipoContratoId?: string;
    status?: string;
    softwareId?: string;
    fornecedor?: string;
    vencendoEm?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.tipoContratoId) where.tipoContratoId = filters.tipoContratoId;
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

  async create(dto: CreateContratoDto, usuarioId: string, role: string = 'ADMIN') {
    await this.ensureContratoPermission(dto.equipeId, usuarioId, role);

    if (dto.softwareId) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!sw) throw new BadRequestException('Software nao encontrado');
    }

    const contrato = await this.prisma.contrato.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipoContratoId: dto.tipoContratoId,
        filialId: dto.filialId,
        numeroContrato: dto.numeroContrato,
        fornecedor: dto.fornecedor,
        codigoFornecedor: dto.codigoFornecedor,
        lojaFornecedor: dto.lojaFornecedor,
        valorTotal: dto.valorTotal,
        valorMensal: dto.valorMensal,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        dataAssinatura: dto.dataAssinatura ? new Date(dto.dataAssinatura) : undefined,
        modalidadeValor: (dto.modalidadeValor as 'FIXO' | 'VARIAVEL') || 'FIXO',
        renovacaoAutomatica: dto.renovacaoAutomatica,
        diasAlertaVencimento: dto.diasAlertaVencimento,
        softwareId: dto.softwareId,
        equipeId: dto.equipeId,
        observacoes: dto.observacoes,
      },
      include: contratoListInclude,
    });

    await this.criarHistorico(contrato.id, 'CRIACAO', 'Contrato criado', usuarioId);

    // Auto-generate parcelas if requested
    if (dto.gerarParcelas && dto.quantidadeParcelas && dto.quantidadeParcelas > 0) {
      await this.gerarParcelasAuto(contrato.id, dto.valorTotal, dto.quantidadeParcelas, dto.primeiroVencimento);
    }

    return contrato;
  }

  async update(id: string, dto: UpdateContratoDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(id);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    if (['RENOVADO', 'CANCELADO', 'ENCERRADO'].includes(contrato.status)) {
      throw new BadRequestException('Contrato finalizado nao pode ser alterado');
    }

    if (dto.softwareId) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!sw) throw new BadRequestException('Software nao encontrado');
    }

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.tipoContratoId !== undefined) data.tipoContratoId = dto.tipoContratoId;
    if (dto.filialId !== undefined) data.filialId = dto.filialId;
    if (dto.numeroContrato !== undefined) data.numeroContrato = dto.numeroContrato;
    if (dto.fornecedor !== undefined) data.fornecedor = dto.fornecedor;
    if (dto.codigoFornecedor !== undefined) data.codigoFornecedor = dto.codigoFornecedor;
    if (dto.lojaFornecedor !== undefined) data.lojaFornecedor = dto.lojaFornecedor;
    if (dto.valorTotal !== undefined) data.valorTotal = dto.valorTotal;
    if (dto.valorMensal !== undefined) data.valorMensal = dto.valorMensal;
    if (dto.dataInicio !== undefined) data.dataInicio = new Date(dto.dataInicio);
    if (dto.dataFim !== undefined) data.dataFim = new Date(dto.dataFim);
    if (dto.dataAssinatura !== undefined) data.dataAssinatura = dto.dataAssinatura ? new Date(dto.dataAssinatura) : null;
    if (dto.modalidadeValor !== undefined) data.modalidadeValor = dto.modalidadeValor;
    if (dto.renovacaoAutomatica !== undefined) data.renovacaoAutomatica = dto.renovacaoAutomatica;
    if (dto.diasAlertaVencimento !== undefined) data.diasAlertaVencimento = dto.diasAlertaVencimento;
    if (dto.softwareId !== undefined) data.softwareId = dto.softwareId || null;
    if (dto.equipeId !== undefined) data.equipeId = dto.equipeId || null;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    const updated = await this.prisma.contrato.update({
      where: { id },
      data,
      include: contratoDetailInclude,
    });

    await this.criarHistorico(id, 'ALTERACAO', 'Contrato atualizado', usuarioId);

    return updated;
  }

  async alterarStatus(id: string, novoStatus: StatusContrato, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(id);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const permitidos = TRANSICOES_VALIDAS[contrato.status];
    if (!permitidos.includes(novoStatus)) {
      throw new BadRequestException(
        `Transicao de ${contrato.status} para ${novoStatus} nao e permitida`,
      );
    }

    if (novoStatus === 'CANCELADO') {
      const parcelasPagas = await this.prisma.parcelaContrato.count({
        where: { contratoId: id, status: 'PAGA' },
      });
      if (parcelasPagas > 0) {
        throw new BadRequestException(
          `Nao e possivel cancelar contrato com ${parcelasPagas} parcela(s) paga(s).`,
        );
      }
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

  async renovar(id: string, dto: RenovarContratoDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(id);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    if (!['ATIVO', 'VENCIDO'].includes(contrato.status)) {
      throw new BadRequestException('Somente contratos ativos ou vencidos podem ser renovados');
    }

    // Calculate new value
    const valorAnterior = Number(contrato.valorTotal);
    let novoValor: number;
    if (dto.novoValorTotal !== undefined) {
      novoValor = dto.novoValorTotal;
    } else if (dto.percentualReajuste !== undefined) {
      novoValor = valorAnterior * (1 + dto.percentualReajuste / 100);
    } else {
      novoValor = valorAnterior;
    }

    // Calculate dates
    const duracaoMs = new Date(contrato.dataFim).getTime() - new Date(contrato.dataInicio).getTime();
    const novaDataInicio = dto.novaDataInicio ? new Date(dto.novaDataInicio) : new Date(contrato.dataFim);
    const novaDataFim = dto.novaDataFim ? new Date(dto.novaDataFim) : new Date(novaDataInicio.getTime() + duracaoMs);

    const [, novoContrato] = await this.prisma.$transaction([
      this.prisma.contrato.update({
        where: { id },
        data: { status: 'RENOVADO' },
      }),
      this.prisma.contrato.create({
        data: {
          titulo: contrato.titulo,
          descricao: contrato.descricao,
          tipoContratoId: contrato.tipoContratoId,
          filialId: contrato.filialId,
          numeroContrato: contrato.numeroContrato,
          fornecedor: contrato.fornecedor,
          codigoFornecedor: contrato.codigoFornecedor,
          lojaFornecedor: contrato.lojaFornecedor,
          valorTotal: novoValor,
          valorMensal: contrato.valorMensal,
          dataInicio: novaDataInicio,
          dataFim: novaDataFim,
          modalidadeValor: contrato.modalidadeValor,
          renovacaoAutomatica: contrato.renovacaoAutomatica,
          diasAlertaVencimento: contrato.diasAlertaVencimento,
          softwareId: contrato.softwareId,
          observacoes: contrato.observacoes,
          dataRenovacao: new Date(),
          status: 'ATIVO',
          contratoOriginalId: contrato.id,
        },
        include: contratoListInclude,
      }),
    ]);

    // Create renovation record
    await this.prisma.contratoRenovacaoReg.create({
      data: {
        contratoAnteriorId: contrato.id,
        contratoNovoId: novoContrato.id,
        indiceReajuste: dto.indiceReajuste,
        percentualReajuste: dto.percentualReajuste,
        valorAnterior: valorAnterior,
        valorNovo: novoValor,
      },
    });

    await this.criarHistorico(id, 'RENOVACAO', `Renovado. Novo contrato #${novoContrato.numero}`, usuarioId);
    await this.criarHistorico(novoContrato.id, 'CRIACAO', `Renovacao do contrato #${contrato.numero}`, usuarioId);

    // Auto-generate parcelas if requested
    if (dto.gerarParcelas && dto.quantidadeParcelas && dto.quantidadeParcelas > 0) {
      await this.gerarParcelasAuto(novoContrato.id, novoValor, dto.quantidadeParcelas, dto.primeiroVencimento);
    }

    // Copy rateio template from old contract
    if (contrato.rateioTemplate) {
      await this.prisma.rateioTemplate.create({
        data: {
          contratoId: novoContrato.id,
          modalidade: contrato.rateioTemplate.modalidade,
          criterio: contrato.rateioTemplate.criterio,
          itens: {
            create: contrato.rateioTemplate.itens.map((item) => ({
              centroCustoId: item.centroCustoId,
              percentual: item.percentual,
              valorFixo: item.valorFixo,
              parametro: item.parametro,
              naturezaId: item.naturezaId,
            })),
          },
        },
      });
    }

    return novoContrato;
  }

  // --- Auto-generate parcelas helper ---

  private async gerarParcelasAuto(contratoId: string, valorTotal: number, quantidade: number, primeiroVencimento?: string) {
    const valorParcela = +(valorTotal / quantidade).toFixed(2);
    const baseDate = primeiroVencimento ? new Date(primeiroVencimento) : new Date();

    for (let i = 0; i < quantidade; i++) {
      const dataVenc = new Date(baseDate);
      dataVenc.setMonth(dataVenc.getMonth() + i);
      const valor = i === quantidade - 1
        ? +(valorTotal - valorParcela * (quantidade - 1)).toFixed(2)
        : valorParcela;

      await this.prisma.parcelaContrato.create({
        data: {
          numero: i + 1,
          descricao: `Parcela ${i + 1}/${quantidade}`,
          valor,
          dataVencimento: dataVenc,
          contrato: { connect: { id: contratoId } },
        },
      });
    }
  }

  // --- Parcelas ---

  async listarParcelas(contratoId: string) {
    await this.findOne(contratoId);
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
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

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

  async pagarParcela(contratoId: string, parcelaId: string, dto: PagarParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

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

  async cancelarParcela(contratoId: string, parcelaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

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

    await this.criarHistorico(
      contratoId,
      'OBSERVACAO',
      `Parcela #${parcela.numero} cancelada`,
      usuarioId,
    );

    return updated;
  }

  // --- Rateio Template ---

  async obterRateioTemplate(contratoId: string) {
    await this.findOne(contratoId);
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
    const contrato = await this.findOne(contratoId);
    return this.computeRateio(dto.modalidade, dto.itens, new Decimal(contrato.valorTotal.toString()));
  }

  async configurarRateioTemplate(contratoId: string, dto: ConfigurarRateioTemplateDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    if (['RENOVADO', 'CANCELADO'].includes(contrato.status)) {
      throw new BadRequestException('Contrato finalizado nao permite alteracao de rateio');
    }

    // Validate items (don't need to compute values for template, just store config)
    if (dto.itens.length === 0) {
      throw new BadRequestException('Rateio deve ter pelo menos 1 item');
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

    await this.criarHistorico(
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
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (['PAGA', 'CANCELADA'].includes(parcela.status)) {
      throw new BadRequestException(`Nao e possivel alterar rateio de parcela ${parcela.status.toLowerCase()}`);
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

      await this.criarHistorico(contratoId, 'RATEIO_ALTERADO', `Rateio gerado para parcela #${parcela.numero} via template`, usuarioId);
    }

    return this.obterRateioParcela(contratoId, parcelaId);
  }

  async configurarRateioParcela(contratoId: string, parcelaId: string, dto: ConfigurarRateioDto, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada neste contrato');
    }
    if (['PAGA', 'CANCELADA'].includes(parcela.status)) {
      throw new BadRequestException(`Nao e possivel alterar rateio de parcela ${parcela.status.toLowerCase()}`);
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

    await this.criarHistorico(contratoId, 'RATEIO_ALTERADO', `Rateio manual configurado para parcela #${parcela.numero}`, usuarioId);

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

    await this.criarHistorico(contratoId, 'RATEIO_ALTERADO', `Rateio da parcela #${parcelaOrigem.numero} copiado para ${parcelasPendentes.length} parcelas pendentes`, usuarioId);

    return { parcelasCopied: parcelasPendentes.length };
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

  // --- Licencas ---

  async vincularLicenca(contratoId: string, licencaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);
    if (['RENOVADO', 'CANCELADO', 'ENCERRADO'].includes(contrato.status)) {
      throw new BadRequestException('Nao e possivel vincular licencas a contrato finalizado');
    }

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

  async desvincularLicenca(contratoId: string, licencaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.findOne(contratoId);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);
    if (['RENOVADO', 'CANCELADO', 'ENCERRADO'].includes(contrato.status)) {
      throw new BadRequestException('Nao e possivel desvincular licencas de contrato finalizado');
    }

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

  // --- Anexos ---

  async listarAnexos(contratoId: string) {
    await this.findOne(contratoId);
    return this.prisma.anexoContrato.findMany({
      where: { contratoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadAnexo(contratoId: string, file: Express.Multer.File) {
    await this.findOne(contratoId);

    return this.prisma.anexoContrato.create({
      data: {
        contratoId,
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
      },
    });
  }

  async downloadAnexo(contratoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoContrato.findFirst({
      where: { id: anexoId, contratoId },
    });
    if (!anexo) {
      throw new NotFoundException('Anexo nao encontrado neste contrato');
    }

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }

    return { anexo, filePath };
  }

  async excluirAnexo(contratoId: string, anexoId: string, usuarioId: string) {
    const anexo = await this.prisma.anexoContrato.findFirst({
      where: { id: anexoId, contratoId },
    });
    if (!anexo) {
      throw new NotFoundException('Anexo nao encontrado neste contrato');
    }

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.anexoContrato.delete({ where: { id: anexoId } });

    await this.criarHistorico(contratoId, 'OBSERVACAO', `Anexo removido: ${anexo.nomeOriginal}`, usuarioId);

    return { deleted: true };
  }

  // --- Renovacoes ---

  async listarRenovacoes(contratoId: string) {
    await this.findOne(contratoId);

    const renovacoes = await this.prisma.contratoRenovacaoReg.findMany({
      where: {
        OR: [
          { contratoAnteriorId: contratoId },
          { contratoNovoId: contratoId },
        ],
      },
      include: {
        contratoAnterior: { select: { id: true, numero: true, titulo: true, valorTotal: true, status: true } },
        contratoNovo: { select: { id: true, numero: true, titulo: true, valorTotal: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return renovacoes;
  }

  // --- Naturezas ---

  async findAllNaturezas(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.naturezaContrato.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async createNatureza(dto: CreateNaturezaDto) {
    return this.prisma.naturezaContrato.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
      },
    });
  }

  async updateNatureza(id: string, dto: UpdateNaturezaDto) {
    const existing = await this.prisma.naturezaContrato.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Natureza nao encontrada');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.naturezaContrato.update({
      where: { id },
      data,
    });
  }

  // --- Tipos de Contrato ---

  async findAllTiposContrato(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.tipoContratoConfig.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async createTipoContrato(dto: CreateTipoContratoDto) {
    return this.prisma.tipoContratoConfig.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
      },
    });
  }

  async updateTipoContrato(id: string, dto: UpdateTipoContratoDto) {
    const existing = await this.prisma.tipoContratoConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de contrato nao encontrado');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.tipoContratoConfig.update({
      where: { id },
      data,
    });
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
