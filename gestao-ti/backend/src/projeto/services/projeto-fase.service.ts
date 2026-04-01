import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateFaseDto } from '../dto/create-fase.dto.js';
import { UpdateFaseDto } from '../dto/update-fase.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';

@Injectable()
export class ProjetoFaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  async listFases(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.faseProjeto.findMany({
      where: { projetoId },
      orderBy: { ordem: 'asc' },
    });
  }

  async addFase(projetoId: string, dto: CreateFaseDto) {
    const projeto = await this.prisma.projeto.findUnique({ where: { id: projetoId } });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Fases so podem ser gerenciadas em projetos modo COMPLETO');
    }

    return this.prisma.faseProjeto.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        ordem: dto.ordem,
        status: dto.status,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : undefined,
        dataFimReal: dto.dataFimReal ? new Date(dto.dataFimReal) : undefined,
        observacoes: dto.observacoes,
        projetoId,
      },
    });
  }

  async updateFase(projetoId: string, faseId: string, dto: UpdateFaseDto) {
    const fase = await this.prisma.faseProjeto.findFirst({
      where: { id: faseId, projetoId },
    });
    if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');

    const data: Record<string, unknown> = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'APROVADA' && !fase.dataFimReal) {
        data.dataFimReal = new Date();
      }
    }
    if (dto.dataInicio !== undefined) data.dataInicio = new Date(dto.dataInicio);
    if (dto.dataFimPrevista !== undefined) data.dataFimPrevista = new Date(dto.dataFimPrevista);
    if (dto.dataFimReal !== undefined) data.dataFimReal = new Date(dto.dataFimReal);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.faseProjeto.update({
      where: { id: faseId },
      data,
    });
  }

  async removeFase(projetoId: string, faseId: string) {
    const fase = await this.prisma.faseProjeto.findFirst({
      where: { id: faseId, projetoId },
    });
    if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');

    // Verifica se ha atividades com registros de tempo
    const atividadesComRegistros = await this.prisma.atividadeProjeto.count({
      where: { faseId, registrosTempo: { some: {} } },
    });
    if (atividadesComRegistros > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir fase com atividades que possuem registros de tempo (${atividadesComRegistros} atividade(s) com apontamentos).`,
      );
    }

    // Desvincula atividades da fase (move para "sem fase") em vez de deletar
    await this.prisma.atividadeProjeto.updateMany({
      where: { faseId },
      data: { faseId: null },
    });

    await this.prisma.faseProjeto.delete({ where: { id: faseId } });
    return { deleted: true };
  }
}
