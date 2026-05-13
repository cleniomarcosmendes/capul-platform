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
    // Buscar dados do projeto para usar na notificação. Usa findUnique direto
    // (em vez de ensureProjetoExists) para já ter numero+nome em mãos.
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { id: true, numero: true, nome: true },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    const usuario = await this.prisma.usuario.findUnique({ where: { id: dto.usuarioId } });
    if (!usuario) throw new BadRequestException('Usuario nao encontrado');

    const existente = await this.prisma.usuarioChaveProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.usuarioId } },
    });

    let resultado;
    let isNovoVinculo = false;
    if (existente) {
      if (existente.ativo) throw new BadRequestException('Usuario ja e usuario-chave deste projeto');
      // Reativação — notifica do mesmo jeito (gap pode ser longo, ele esqueceu)
      resultado = await this.prisma.usuarioChaveProjeto.update({
        where: { id: existente.id },
        data: { ativo: true, funcao: dto.funcao },
        include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
      });
      isNovoVinculo = true;
    } else {
      resultado = await this.prisma.usuarioChaveProjeto.create({
        data: { projetoId, usuarioId: dto.usuarioId, funcao: dto.funcao },
        include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
      });
      isNovoVinculo = true;
    }

    // Notificar o usuário-chave da inclusão. Antes (até 28/04) este método
    // simplesmente persistia sem avisar — gap reportado pelo Marco em 29/04
    // ("usuário-chave não recebeu notificação quanto à criação do projeto").
    if (isNovoVinculo) {
      const funcaoTrecho = dto.funcao ? ` como "${dto.funcao}"` : '';
      this.notificacaoService.criarParaUsuario(
        dto.usuarioId,
        'PROJETO_ATUALIZADO',
        `Voce foi adicionado ao projeto #${projeto.numero}`,
        `Voce foi incluido${funcaoTrecho} no projeto "${projeto.nome}". Acesse o projeto pelo modulo Gestao TI > Projetos para acompanhar pendencias e atualizacoes.`,
        { projetoId, usuarioChaveId: resultado.id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return resultado;
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

}
