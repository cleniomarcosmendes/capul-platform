import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { CreatePendenciaDto } from '../dto/create-pendencia.dto.js';
import { UpdatePendenciaDto } from '../dto/update-pendencia.dto.js';
import { CreateInteracaoPendenciaDto } from '../dto/create-interacao-pendencia.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';
import { PENDENCIA_UPLOADS_DIR } from './projeto.constants.js';
import { isGestor } from '../../common/constants/roles.constant.js';

@Injectable()
export class ProjetoPendenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  async listPendencias(projetoId: string, filters: {
    status?: string; prioridade?: string; responsavelId?: string; search?: string; incluirSubProjetos?: boolean;
  }, userId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, userId, role);

    // Se incluirSubProjetos, busca IDs do projeto e todos seus sub-projetos
    let projetoIds = [projetoId];
    if (filters.incluirSubProjetos) {
      const subProjetos = await this.prisma.projeto.findMany({
        where: { projetoPaiId: projetoId },
        select: { id: true },
      });
      projetoIds = [projetoId, ...subProjetos.map((s) => s.id)];
    }

    const where: Record<string, unknown> = { projetoId: { in: projetoIds } };
    if (filters.status) where.status = filters.status;
    if (filters.prioridade) where.prioridade = filters.prioridade;
    if (filters.responsavelId) where.responsavelId = filters.responsavelId;
    if (filters.search) {
      where.OR = [
        { titulo: { contains: filters.search, mode: 'insensitive' } },
        { descricao: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.pendenciaProjeto.findMany({
      where,
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
        projeto: { select: { id: true, numero: true, nome: true } },
        _count: { select: { interacoes: true, anexos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendencia(projetoId: string, pendenciaId: string, userId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, userId, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
        interacoes: {
          include: {
            usuario: { select: { id: true, nome: true, username: true } },
            anexo: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        anexos: {
          include: { usuario: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'desc' },
        },
        atividades: {
          include: {
            usuario: { select: { id: true, nome: true } },
            comentarios: {
              where: { visivelPendencia: true },
              include: { usuario: { select: { id: true, nome: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada neste projeto');

    // USUARIO_CHAVE e TERCEIRIZADO: filter internal interactions
    if (role === 'USUARIO_CHAVE' || role === 'TERCEIRIZADO') {
      pendencia.interacoes = pendencia.interacoes.filter((i) => i.publica);
    }

    return pendencia;
  }

  async createPendencia(projetoId: string, dto: CreatePendenciaDto, criadorId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, criadorId, role);
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { id: true, status: true, responsavelId: true, nome: true, numero: true },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    if (['CONCLUIDO', 'CANCELADO'].includes(projeto.status)) {
      throw new BadRequestException('Nao e possivel criar pendencias em projeto finalizado');
    }

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({ where: { id: dto.faseId, projetoId } });
      if (!fase) throw new BadRequestException('Fase nao encontrada neste projeto');
    }

    // Validate responsavel is member or usuario-chave
    const isMembro = await this.prisma.membroProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.responsavelId } },
    });
    const isChave = await this.prisma.usuarioChaveProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.responsavelId } },
    });
    const isResponsavel = projeto.responsavelId === dto.responsavelId;
    if (!isMembro && !isChave && !isResponsavel) {
      throw new BadRequestException('Responsavel deve ser membro ou usuario-chave do projeto');
    }

    const pendencia = await this.prisma.pendenciaProjeto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        prioridade: dto.prioridade || 'MEDIA',
        projetoId,
        faseId: dto.faseId,
        responsavelId: dto.responsavelId,
        criadorId,
        dataLimite: dto.dataLimite ? new Date(dto.dataLimite) : undefined,
      },
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
      },
    });

    // Create opening interaction
    await this.prisma.interacaoPendencia.create({
      data: {
        tipo: 'STATUS_ALTERADO',
        descricao: 'Pendencia criada',
        pendenciaId: pendencia.id,
        usuarioId: criadorId,
      },
    });

    // Notificar responsavel (se diferente do criador)
    if (dto.responsavelId !== criadorId) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuario(
        dto.responsavelId,
        'PENDENCIA_ATRIBUIDA',
        `Nova pendencia: ${dto.titulo}`,
        `Voce foi atribuido como responsavel da pendencia "${dto.titulo}" no projeto "${proj?.nome}".`,
        { projetoId, pendenciaId: pendencia.id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return pendencia;
  }

  async updatePendencia(projetoId: string, pendenciaId: string, dto: UpdatePendenciaDto, userId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, userId, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');

    // Apenas responsavel ou gestor pode editar dados da pendencia
    const isResponsavel = pendencia.responsavelId === userId;
    const hasDadosAlterados = dto.titulo !== undefined || dto.descricao !== undefined || dto.prioridade !== undefined || dto.responsavelId !== undefined || dto.dataLimite !== undefined || dto.faseId !== undefined;
    if (hasDadosAlterados && !isGestor(role) && !isResponsavel) {
      throw new ForbiddenException('Apenas o responsavel pela pendencia ou gestores podem editar os dados');
    }

    if (['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && !dto.status) {
      throw new BadRequestException('Pendencia finalizada nao pode ser alterada');
    }

    // USUARIO_CHAVE e TERCEIRIZADO: restricted status transitions
    if ((role === 'USUARIO_CHAVE' || role === 'TERCEIRIZADO') && dto.status) {
      const permitidos = ['AGUARDANDO_VALIDACAO', 'CONCLUIDA', 'EM_ANDAMENTO'];
      if (!permitidos.includes(dto.status)) {
        throw new ForbiddenException('Usuario externo so pode alterar status para Em Andamento, Aguardando Validacao ou Concluida');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.prioridade !== undefined) data.prioridade = dto.prioridade;
    if (dto.faseId !== undefined) data.faseId = dto.faseId || null;
    if (dto.dataLimite !== undefined) data.dataLimite = dto.dataLimite ? new Date(dto.dataLimite) : null;

    if (dto.responsavelId !== undefined && dto.responsavelId !== pendencia.responsavelId) {
      data.responsavelId = dto.responsavelId;
      await this.prisma.interacaoPendencia.create({
        data: {
          tipo: 'RESPONSAVEL_ALTERADO',
          descricao: `Responsavel alterado`,
          pendenciaId,
          usuarioId: userId,
        },
      });
      // Notificar novo responsavel
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuario(
        dto.responsavelId,
        'PENDENCIA_ATRIBUIDA',
        `Pendencia transferida: ${pendencia.titulo}`,
        `Voce foi atribuido como responsavel da pendencia "${pendencia.titulo}" no projeto "${proj?.nome}".`,
        { projetoId, pendenciaId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    if (dto.status !== undefined && dto.status !== pendencia.status) {
      data.status = dto.status;
      await this.prisma.interacaoPendencia.create({
        data: {
          tipo: 'STATUS_ALTERADO',
          descricao: `Status alterado de ${pendencia.status} para ${dto.status}`,
          pendenciaId,
          usuarioId: userId,
        },
      });

      // Notificar envolvidos sobre mudanca de status
      const statusLabels: Record<string, string> = {
        ABERTA: 'Aberta', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO_VALIDACAO: 'Aguardando Validacao',
        CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
      };
      const idsNotificar = new Set<string>();
      if (pendencia.responsavelId && pendencia.responsavelId !== userId) idsNotificar.add(pendencia.responsavelId);
      if (pendencia.criadorId && pendencia.criadorId !== userId) idsNotificar.add(pendencia.criadorId);
      if (idsNotificar.size > 0) {
        const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
        this.notificacaoService.criarParaUsuarios(
          Array.from(idsNotificar), 'PROJETO_ATUALIZADO',
          `Pendencia "${pendencia.titulo}" — ${statusLabels[dto.status] || dto.status}`,
          `A pendencia "${pendencia.titulo}" do projeto "${proj?.nome}" teve o status alterado para ${statusLabels[dto.status] || dto.status}.`,
          { projetoId, pendenciaId },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }

    return this.prisma.pendenciaProjeto.update({
      where: { id: pendenciaId },
      data,
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
      },
    });
  }

  async gerarAtividadeFromPendencia(
    projetoId: string,
    pendenciaId: string,
    dto: { titulo?: string; descricao?: string; dataFimPrevista?: string },
    userId: string,
  ) {
    await this.helpers.ensureProjetoExists(projetoId);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada neste projeto');

    // Cria atividade com dados da pendencia (permite override)
    // Responsaveis: quem gerou + responsavel da pendencia (se diferente)
    const responsaveisIds = new Set([userId]);
    if (pendencia.responsavelId) responsaveisIds.add(pendencia.responsavelId);

    const atividade = await this.prisma.atividadeProjeto.create({
      data: {
        titulo: dto.titulo || `[P#${pendencia.numero}] ${pendencia.titulo}`,
        descricao: dto.descricao || pendencia.descricao,
        projetoId,
        usuarioId: userId,
        faseId: pendencia.faseId,
        pendenciaId: pendencia.id,
        dataInicio: new Date(),
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : pendencia.dataLimite,
        responsaveis: {
          createMany: {
            data: Array.from(responsaveisIds).map((uid) => ({ usuarioId: uid })),
          },
        },
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
        responsaveis: { include: { usuario: { select: { id: true, nome: true } } } },
      },
    });

    // Registra interacao na pendencia
    await this.prisma.interacaoPendencia.create({
      data: {
        pendenciaId: pendencia.id,
        usuarioId: userId,
        tipo: 'COMENTARIO',
        descricao: `Atividade gerada: ${atividade.titulo}`,
        publica: true,
      },
    });

    // Notificar responsaveis atribuidos (exceto o criador)
    const idsNotificar = Array.from(responsaveisIds).filter((uid) => uid !== userId);
    if (idsNotificar.length > 0) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuarios(
        idsNotificar, 'ATIVIDADE_ATRIBUIDA',
        `Nova atividade: ${atividade.titulo}`,
        `Voce foi atribuido a atividade "${atividade.titulo}" no projeto "${proj?.nome}".`,
        { projetoId, atividadeId: atividade.id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return atividade;
  }

  // --- Interacoes Pendencia ---

  async addInteracaoPendencia(projetoId: string, pendenciaId: string, dto: CreateInteracaoPendenciaDto, userId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, userId, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');
    if (['CONCLUIDA', 'CANCELADA'].includes(pendencia.status)) {
      throw new BadRequestException('Nao e possivel comentar em pendencia finalizada');
    }

    // USUARIO_CHAVE e TERCEIRIZADO: always public
    const publica = (role === 'USUARIO_CHAVE' || role === 'TERCEIRIZADO') ? true : (dto.publica ?? true);

    const interacao = await this.prisma.interacaoPendencia.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: dto.descricao,
        publica,
        pendenciaId,
        usuarioId: userId,
      },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });

    // Processar @mencoes
    const mencionadoIds: string[] = [];
    if (dto.descricao) {
      const ids = await this.helpers.processarMencoes(dto.descricao, projetoId, userId, `um comentario na pendencia #${pendencia.numero}`, { pendenciaId });
      mencionadoIds.push(...ids);
    }

    // Notificar responsavel e criador da pendencia (exceto autor e ja mencionados)
    const idsNotificar = new Set<string>();
    if (pendencia.responsavelId && pendencia.responsavelId !== userId && !mencionadoIds.includes(pendencia.responsavelId)) {
      idsNotificar.add(pendencia.responsavelId);
    }
    const pendenciaFull = await this.prisma.pendenciaProjeto.findUnique({
      where: { id: pendenciaId },
      select: { criadorId: true },
    });
    if (pendenciaFull?.criadorId && pendenciaFull.criadorId !== userId && !mencionadoIds.includes(pendenciaFull.criadorId)) {
      idsNotificar.add(pendenciaFull.criadorId);
    }
    if (idsNotificar.size > 0) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuarios(
        Array.from(idsNotificar), 'PROJETO_ATUALIZADO',
        `Novo comentario na pendencia #${pendencia.numero}`,
        `Novo comentario na pendencia "${pendencia.titulo}" do projeto "${proj?.nome}".`,
        { projetoId, pendenciaId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return interacao;
  }

  async editarInteracaoPendencia(projetoId: string, pendenciaId: string, interacaoId: string, descricao: string, userId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, userId, role);

    const interacao = await this.prisma.interacaoPendencia.findFirst({
      where: { id: interacaoId, pendenciaId, tipo: 'COMENTARIO' },
    });
    if (!interacao) throw new NotFoundException('Comentario nao encontrado');

    if (interacao.usuarioId !== userId && !isGestor(role)) {
      throw new ForbiddenException('Voce so pode editar seus proprios comentarios');
    }

    return this.prisma.interacaoPendencia.update({
      where: { id: interacaoId },
      data: { descricao },
      include: { usuario: { select: { id: true, nome: true, username: true } } },
    });
  }

  // --- Anexos Pendencia ---

  async addAnexoPendencia(projetoId: string, pendenciaId: string, file: Express.Multer.File, userId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, userId, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');

    // Create interaction entry
    const interacao = await this.prisma.interacaoPendencia.create({
      data: {
        tipo: 'ANEXO',
        descricao: `Anexo adicionado: ${file.originalname}`,
        pendenciaId,
        usuarioId: userId,
      },
    });

    return this.prisma.anexoPendencia.create({
      data: {
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        pendenciaId,
        interacaoId: interacao.id,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async downloadAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string, userId: string, role: string) {
    await this.helpers.checkProjetoAccessChave(projetoId, userId, role);

    const anexo = await this.prisma.anexoPendencia.findFirst({
      where: { id: anexoId, pendenciaId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');

    const filePath = path.join(PENDENCIA_UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Arquivo nao encontrado no disco');

    return { anexo, filePath };
  }

  async removeAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string) {
    const anexo = await this.prisma.anexoPendencia.findFirst({
      where: { id: anexoId, pendenciaId, pendencia: { projetoId } },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');

    const filePath = path.join(PENDENCIA_UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await this.prisma.anexoPendencia.delete({ where: { id: anexoId } });
    return { deleted: true };
  }
}
