import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StatusContrato } from '@prisma/client';
import { CreateContratoDto } from '../dto/create-contrato.dto.js';
import { UpdateContratoDto } from '../dto/update-contrato.dto.js';
import { RenovarContratoDto } from '../dto/renovar-contrato.dto.js';
import { contratoListInclude, contratoDetailInclude, TRANSICOES_VALIDAS } from './contrato.constants.js';

@Injectable()
export class ContratoCoreService {
  constructor(private readonly prisma: PrismaService) {}

  /** Converte string de data (YYYY-MM-DD) para Date sem offset de timezone */
  parseDate(dateStr: string): Date {
    // Se ja contem 'T', e um datetime completo
    if (dateStr.includes('T')) return new Date(dateStr);
    // Senao, tratar como data local adicionando T12:00:00 para evitar offset UTC-3
    return new Date(dateStr + 'T12:00:00');
  }

  /**
   * Verifica se o usuario tem permissao para gerenciar contratos de uma equipe.
   * ADMIN e GESTOR_TI sempre tem acesso. TECNICO precisa ser membro da equipe com podeGerirContratos.
   */
  async ensureContratoPermission(equipeId: string | null | undefined, usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR_TI') return;
    if (!equipeId) {
      throw new ForbiddenException('Contrato sem equipe associada. Associe uma equipe ao contrato ou solicite a um ADMIN/GESTOR_TI.');
    }
    const membro = await this.prisma.membroEquipe.findUnique({
      where: { usuarioId_equipeId: { usuarioId, equipeId } },
    });
    if (!membro || membro.status !== 'ATIVO' || !membro.podeGerirContratos) {
      throw new ForbiddenException('Voce nao tem permissao para gerenciar contratos desta equipe.');
    }
  }

  async criarHistorico(
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

  /**
   * Verifica se o usuario tem acesso ao modulo de contratos.
   * ADMIN e GESTOR_TI sempre tem acesso. Outros precisam ser membro de alguma equipe com podeGerirContratos.
   */
  async verificarAcessoContratos(usuarioId: string, role: string): Promise<boolean> {
    if (role === 'ADMIN' || role === 'GESTOR_TI') return true;
    const count = await this.prisma.membroEquipe.count({
      where: { usuarioId, status: 'ATIVO', podeGerirContratos: true },
    });
    return count > 0;
  }

  async findAll(filters: {
    tipoContratoId?: string;
    status?: string;
    softwareId?: string;
    fornecedor?: string;
    vencendoEm?: number;
  }, usuarioId?: string, role?: string) {
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

    // SUPORTE_TI e outros roles: filtrar por equipes com podeGerirContratos
    if (usuarioId && role && role !== 'ADMIN' && role !== 'GESTOR_TI') {
      const membrosComPermissao = await this.prisma.membroEquipe.findMany({
        where: { usuarioId, status: 'ATIVO', podeGerirContratos: true },
        select: { equipeId: true },
      });
      const equipeIds = membrosComPermissao.map(m => m.equipeId);
      if (equipeIds.length === 0) {
        return []; // Sem permissao em nenhuma equipe
      }
      where.equipeId = { in: equipeIds };
    }

    return this.prisma.contrato.findMany({
      where,
      include: contratoListInclude,
      orderBy: { numero: 'desc' },
    });
  }

  async findOneWithPermission(id: string, usuarioId: string, role: string) {
    const contrato = await this.findOne(id);
    await this.ensureContratoPermission(contrato.equipeId, usuarioId, role);
    return contrato;
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
        fornecedorId: dto.fornecedorId,
        codigoProduto: dto.codigoProduto,
        descricaoProduto: dto.descricaoProduto,
        produtoId: dto.produtoId,
        valorTotal: dto.valorTotal ?? 0,
        valorMensal: dto.valorMensal,
        dataInicio: this.parseDate(dto.dataInicio),
        dataFim: this.parseDate(dto.dataFim),
        dataAssinatura: dto.dataAssinatura ? this.parseDate(dto.dataAssinatura) : undefined,
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
      await this.gerarParcelasAuto(contrato.id, dto.valorTotal ?? 0, dto.quantidadeParcelas, dto.primeiroVencimento);
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
    if (dto.fornecedorId !== undefined) data.fornecedorId = dto.fornecedorId || null;
    if (dto.codigoProduto !== undefined) data.codigoProduto = dto.codigoProduto;
    if (dto.descricaoProduto !== undefined) data.descricaoProduto = dto.descricaoProduto;
    if (dto.produtoId !== undefined) data.produtoId = dto.produtoId || null;
    if (dto.valorTotal !== undefined) data.valorTotal = dto.valorTotal;
    if (dto.valorMensal !== undefined) data.valorMensal = dto.valorMensal;
    if (dto.dataInicio !== undefined) data.dataInicio = this.parseDate(dto.dataInicio);
    if (dto.dataFim !== undefined) data.dataFim = this.parseDate(dto.dataFim);
    if (dto.dataAssinatura !== undefined) data.dataAssinatura = dto.dataAssinatura ? this.parseDate(dto.dataAssinatura) : null;
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
    const novaDataInicio = dto.novaDataInicio ? this.parseDate(dto.novaDataInicio) : new Date(contrato.dataFim);
    const novaDataFim = dto.novaDataFim ? this.parseDate(dto.novaDataFim) : new Date(novaDataInicio.getTime() + duracaoMs);

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
}
