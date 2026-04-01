import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { CreateMembroDto } from '../dto/create-membro.dto.js';
import { CreateUsuarioChaveDto } from '../dto/create-usuario-chave.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';

@Injectable()
export class ProjetoMembroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  async listMembros(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.membroProjeto.findMany({
      where: { projetoId },
      include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMembro(projetoId: string, dto: CreateMembroDto) {
    const projeto = await this.prisma.projeto.findUnique({ where: { id: projetoId } });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    const existing = await this.prisma.membroProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.usuarioId } },
    });
    if (existing) {
      throw new BadRequestException('Usuario ja e membro deste projeto');
    }

    const membro = await this.prisma.membroProjeto.create({
      data: {
        projetoId,
        usuarioId: dto.usuarioId,
        papel: dto.papel,
        observacoes: dto.observacoes,
      },
      include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
    });

    // Notificar o profissional adicionado
    const papelLabel: Record<string, string> = {
      RESPONSAVEL: 'Responsavel', APROVADOR: 'Aprovador',
      CONSULTADO: 'Consultado', INFORMADO: 'Informado',
    };
    this.notificacaoService.criarParaUsuario(
      dto.usuarioId,
      'PROJETO_ATUALIZADO',
      `Voce foi adicionado ao projeto #${projeto.numero}`,
      `Voce foi incluido na equipe do projeto "${projeto.nome}" com o papel de ${papelLabel[dto.papel] || dto.papel}.`,
      { projetoId, membroId: membro.id },
    ).catch((err) => console.error('Notificacao error:', err.message));

    return membro;
  }

  async removeMembro(projetoId: string, membroId: string) {
    const membro = await this.prisma.membroProjeto.findFirst({
      where: { id: membroId, projetoId },
    });
    if (!membro) throw new NotFoundException('Membro nao encontrado neste projeto');

    // Verifica se o membro tem registros de tempo no projeto
    const registros = await this.prisma.registroTempo.count({
      where: { usuarioId: membro.usuarioId, atividade: { projetoId } },
    });
    if (registros > 0) {
      throw new BadRequestException(
        `Nao e possivel remover membro com ${registros} registro(s) de tempo no projeto.`,
      );
    }

    await this.prisma.membroProjeto.delete({ where: { id: membroId } });
    return { deleted: true };
  }

  // --- Usuarios Chave ---

  async listUsuariosChave(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.usuarioChaveProjeto.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addUsuarioChave(projetoId: string, dto: CreateUsuarioChaveDto) {
    await this.helpers.ensureProjetoExists(projetoId);
    const usuario = await this.prisma.usuario.findUnique({ where: { id: dto.usuarioId } });
    if (!usuario) throw new BadRequestException('Usuario nao encontrado');

    const existente = await this.prisma.usuarioChaveProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.usuarioId } },
    });
    if (existente) {
      if (existente.ativo) throw new BadRequestException('Usuario ja e usuario-chave deste projeto');
      return this.prisma.usuarioChaveProjeto.update({
        where: { id: existente.id },
        data: { ativo: true, funcao: dto.funcao },
        include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
      });
    }

    return this.prisma.usuarioChaveProjeto.create({
      data: { projetoId, usuarioId: dto.usuarioId, funcao: dto.funcao },
      include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
    });
  }

  async removeUsuarioChave(projetoId: string, ucId: string) {
    const uc = await this.prisma.usuarioChaveProjeto.findFirst({
      where: { id: ucId, projetoId },
    });
    if (!uc) throw new NotFoundException('Usuario-chave nao encontrado neste projeto');
    return this.prisma.usuarioChaveProjeto.update({
      where: { id: ucId },
      data: { ativo: false },
    });
  }

  // --- Terceirizados ---

  async listTerceirizados(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.terceirizadoProjeto.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addTerceirizado(projetoId: string, dto: {
    usuarioId: string;
    funcao: string;
    empresa?: string;
    especialidade?: string;
    dataInicio?: Date;
    dataFim?: Date;
    observacoes?: string;
  }) {
    await this.helpers.ensureProjetoExists(projetoId);
    const usuario = await this.prisma.usuario.findUnique({ where: { id: dto.usuarioId } });
    if (!usuario) throw new BadRequestException('Usuario nao encontrado');

    const existente = await this.prisma.terceirizadoProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.usuarioId } },
    });

    if (existente) {
      if (existente.ativo) throw new BadRequestException('Usuario ja e terceirizado deste projeto');
      // Reativar vinculo existente
      return this.prisma.terceirizadoProjeto.update({
        where: { id: existente.id },
        data: {
          ativo: true,
          funcao: dto.funcao,
          empresa: dto.empresa,
          especialidade: dto.especialidade,
          dataInicio: dto.dataInicio,
          dataFim: dto.dataFim,
          observacoes: dto.observacoes,
        },
        include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
      });
    }

    return this.prisma.terceirizadoProjeto.create({
      data: {
        projetoId,
        usuarioId: dto.usuarioId,
        funcao: dto.funcao,
        empresa: dto.empresa,
        especialidade: dto.especialidade,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        observacoes: dto.observacoes,
      },
      include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
    });
  }

  async updateTerceirizado(projetoId: string, terceirizadoId: string, dto: {
    funcao?: string;
    empresa?: string;
    especialidade?: string;
    dataInicio?: Date;
    dataFim?: Date;
    observacoes?: string;
    ativo?: boolean;
  }) {
    await this.helpers.ensureProjetoExists(projetoId);
    const terceirizado = await this.prisma.terceirizadoProjeto.findUnique({
      where: { id: terceirizadoId },
    });
    if (!terceirizado || terceirizado.projetoId !== projetoId) {
      throw new NotFoundException('Terceirizado nao encontrado neste projeto');
    }

    return this.prisma.terceirizadoProjeto.update({
      where: { id: terceirizadoId },
      data: dto,
      include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
    });
  }

  async removeTerceirizado(projetoId: string, terceirizadoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const terceirizado = await this.prisma.terceirizadoProjeto.findUnique({
      where: { id: terceirizadoId },
    });
    if (!terceirizado || terceirizado.projetoId !== projetoId) {
      throw new NotFoundException('Terceirizado nao encontrado neste projeto');
    }

    // Soft delete - apenas desativa
    return this.prisma.terceirizadoProjeto.update({
      where: { id: terceirizadoId },
      data: { ativo: false },
    });
  }

  // --- Meus Projetos ---

  async meusProjetosChave(usuarioId: string) {
    const vinculos = await this.prisma.usuarioChaveProjeto.findMany({
      where: { usuarioId, ativo: true },
      include: {
        projeto: {
          select: {
            id: true, numero: true, nome: true, status: true, tipo: true, modo: true,
            dataInicio: true, dataFimPrevista: true,
            software: { select: { id: true, nome: true } },
            responsavel: { select: { id: true, nome: true } },
            _count: { select: { pendencias: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vinculos.map((v) => ({
      ...v.projeto,
      funcao: v.funcao,
    }));
  }

  async meusProjetosTerceirizado(usuarioId: string) {
    const vinculos = await this.prisma.terceirizadoProjeto.findMany({
      where: { usuarioId, ativo: true },
      include: {
        projeto: {
          select: {
            id: true, numero: true, nome: true, status: true, tipo: true, modo: true,
            dataInicio: true, dataFimPrevista: true,
            software: { select: { id: true, nome: true } },
            responsavel: { select: { id: true, nome: true } },
            _count: { select: { pendencias: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vinculos.map((v) => ({
      ...v.projeto,
      funcao: v.funcao,
      empresa: v.empresa,
      especialidade: v.especialidade,
      dataInicio: v.dataInicio,
      dataFim: v.dataFim,
    }));
  }
}
