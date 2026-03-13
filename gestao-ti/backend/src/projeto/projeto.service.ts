import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';
import { CreateFaseDto } from './dto/create-fase.dto';
import { UpdateFaseDto } from './dto/update-fase.dto';
import { CreateMembroDto } from './dto/create-membro.dto';
import { CreateCotacaoDto } from './dto/create-cotacao.dto';
import { CreateCustoDto } from './dto/create-custo.dto';
import { CreateRiscoDto } from './dto/create-risco.dto';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';
import { CreateAnexoDto } from './dto/create-anexo.dto';
import { CreateApontamentoDto } from './dto/create-apontamento.dto';
import { UpdateRegistroTempoDto } from './dto/update-registro-tempo.dto';
import { CreateUsuarioChaveDto } from './dto/create-usuario-chave.dto';
import { CreatePendenciaDto } from './dto/create-pendencia.dto';
import { UpdatePendenciaDto } from './dto/update-pendencia.dto';
import { CreateInteracaoPendenciaDto } from './dto/create-interacao-pendencia.dto';

const PROJETO_UPLOADS_DIR = path.resolve('./uploads/projetos');
if (!fs.existsSync(PROJETO_UPLOADS_DIR)) {
  fs.mkdirSync(PROJETO_UPLOADS_DIR, { recursive: true });
}

const PENDENCIA_UPLOADS_DIR = path.resolve('./uploads/pendencias');

const projetoListInclude = {
  software: { select: { id: true, nome: true, tipo: true } },
  contrato: { select: { id: true, numero: true, titulo: true } },
  responsavel: { select: { id: true, nome: true, username: true } },
  projetoPai: { select: { id: true, numero: true, nome: true } },
  _count: {
    select: {
      subProjetos: true, membros: true, fases: true, atividades: true,
      cotacoes: true, custos: true, riscos: true, anexos: true,
      apontamentos: true, dependenciasOrigem: true,
      usuariosChave: true, pendencias: true,
    },
  },
};

const projetoDetailInclude = {
  software: { select: { id: true, nome: true, tipo: true } },
  contrato: { select: { id: true, numero: true, titulo: true } },
  responsavel: { select: { id: true, nome: true, username: true } },
  subProjetos: {
    select: { id: true, numero: true, nome: true, status: true, modo: true, nivel: true },
    orderBy: { numero: 'asc' as const },
  },
  membros: {
    include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  fases: { orderBy: { ordem: 'asc' as const } },
  atividades: {
    include: {
      usuario: { select: { id: true, nome: true } },
      fase: { select: { id: true, nome: true } },
    },
    orderBy: { dataAtividade: 'desc' as const },
    take: 50,
  },
  cotacoes: { orderBy: { createdAt: 'desc' as const } },
  custos: { orderBy: { createdAt: 'desc' as const } },
  riscos: {
    include: { responsavel: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  dependenciasOrigem: {
    include: {
      projetoDestino: { select: { id: true, numero: true, nome: true, status: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  dependenciasDestino: {
    include: {
      projetoOrigem: { select: { id: true, numero: true, nome: true, status: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  anexos: {
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  apontamentos: {
    include: {
      usuario: { select: { id: true, nome: true } },
      fase: { select: { id: true, nome: true } },
    },
    orderBy: { data: 'desc' as const },
    take: 100,
  },
  _count: {
    select: {
      subProjetos: true, membros: true, fases: true, atividades: true,
      cotacoes: true, custos: true, riscos: true, anexos: true,
      apontamentos: true, dependenciasOrigem: true,
      usuariosChave: true, pendencias: true,
    },
  },
};

@Injectable()
export class ProjetoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    status?: string;
    tipo?: string;
    modo?: string;
    softwareId?: string;
    contratoId?: string;
    search?: string;
    apenasRaiz?: string;
    meusProjetos?: string;
    usuarioId?: string;
    role?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.status) {
      const statuses = filters.status.split(',');
      where.status = statuses.length > 1 ? { in: statuses } : filters.status;
    }
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.modo) where.modo = filters.modo;
    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.contratoId) where.contratoId = filters.contratoId;

    if (filters.apenasRaiz === 'true') {
      where.nivel = 1;
    }

    // USUARIO_CHAVE e TERCEIRIZADO so veem projetos vinculados
    if (filters.role === 'USUARIO_CHAVE' && filters.usuarioId) {
      where.usuariosChave = { some: { usuarioId: filters.usuarioId, ativo: true } };
    } else if (filters.role === 'TERCEIRIZADO' && filters.usuarioId) {
      where.terceirizados = { some: { usuarioId: filters.usuarioId, ativo: true } };
    } else if (filters.meusProjetos === 'true' && filters.usuarioId) {
      where.OR = [
        { responsavelId: filters.usuarioId },
        { membros: { some: { usuarioId: filters.usuarioId } } },
      ];
    }

    if (filters.search) {
      const searchCondition = [
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { descricao: { contains: filters.search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchCondition }];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    return this.prisma.projeto.findMany({
      where,
      include: projetoListInclude,
      orderBy: { numero: 'desc' },
    });
  }

  async findOne(id: string, userId?: string, role?: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      include: projetoDetailInclude,
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    // Validar acesso para USUARIO_CHAVE e TERCEIRIZADO
    if (userId && role) {
      await this.checkProjetoAccessChave(id, userId, role);

      // Filtrar subProjetos pelos quais o usuario esta vinculado
      if (role === 'USUARIO_CHAVE' || role === 'TERCEIRIZADO') {
        const subProjetosVinculados = await this.getSubProjetosVinculados(
          projeto.subProjetos.map((s) => s.id),
          userId,
          role,
        );
        projeto.subProjetos = projeto.subProjetos.filter((s) =>
          subProjetosVinculados.includes(s.id),
        );
      }
    }

    return projeto;
  }

  /**
   * Retorna IDs dos sub-projetos aos quais o usuario esta vinculado
   */
  private async getSubProjetosVinculados(subProjetoIds: string[], userId: string, role: string): Promise<string[]> {
    if (subProjetoIds.length === 0) return [];

    if (role === 'USUARIO_CHAVE') {
      const vinculos = await this.prisma.usuarioChaveProjeto.findMany({
        where: { projetoId: { in: subProjetoIds }, usuarioId: userId, ativo: true },
        select: { projetoId: true },
      });
      return vinculos.map((v) => v.projetoId);
    }

    if (role === 'TERCEIRIZADO') {
      const vinculos = await this.prisma.terceirizadoProjeto.findMany({
        where: { projetoId: { in: subProjetoIds }, usuarioId: userId, ativo: true },
        select: { projetoId: true },
      });
      return vinculos.map((v) => v.projetoId);
    }

    return [];
  }

  async create(dto: CreateProjetoDto) {
    let nivel = 1;
    let contratoId = dto.contratoId;

    if (dto.projetoPaiId) {
      const pai = await this.prisma.projeto.findUnique({
        where: { id: dto.projetoPaiId },
      });
      if (!pai) throw new NotFoundException('Projeto pai nao encontrado');
      if (pai.nivel >= 3) {
        throw new BadRequestException('Maximo de 3 niveis de hierarquia atingido');
      }
      nivel = pai.nivel + 1;

      if (!contratoId && pai.contratoId) {
        contratoId = pai.contratoId;
      }
    }

    if (dto.softwareId) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!sw) throw new NotFoundException('Software nao encontrado');
    }

    if (contratoId) {
      const ct = await this.prisma.contrato.findUnique({ where: { id: contratoId } });
      if (!ct) throw new NotFoundException('Contrato nao encontrado');
    }

    return this.prisma.projeto.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        tipo: dto.tipo,
        modo: dto.modo || 'COMPLETO',
        nivel,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : undefined,
        custoPrevisto: dto.custoPrevisto,
        observacoes: dto.observacoes,
        projetoPaiId: dto.projetoPaiId,
        softwareId: dto.softwareId,
        contratoId,
        responsavelId: dto.responsavelId,
      },
      include: projetoDetailInclude,
    });
  }

  async update(id: string, dto: UpdateProjetoDto) {
    const projeto = await this.prisma.projeto.findUnique({ where: { id } });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    if (dto.softwareId) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!sw) throw new NotFoundException('Software nao encontrado');
    }

    if (dto.contratoId) {
      const ct = await this.prisma.contrato.findUnique({ where: { id: dto.contratoId } });
      if (!ct) throw new NotFoundException('Contrato nao encontrado');
    }

    const data: Record<string, unknown> = {};

    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.modo !== undefined) data.modo = dto.modo;
    if (dto.softwareId !== undefined) data.softwareId = dto.softwareId;
    if (dto.contratoId !== undefined) data.contratoId = dto.contratoId;
    if (dto.responsavelId !== undefined) data.responsavelId = dto.responsavelId;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;
    if (dto.custoPrevisto !== undefined) data.custoPrevisto = dto.custoPrevisto;
    if (dto.custoRealizado !== undefined) data.custoRealizado = dto.custoRealizado;
    if (dto.dataInicio !== undefined) data.dataInicio = new Date(dto.dataInicio);
    if (dto.dataFimPrevista !== undefined) data.dataFimPrevista = new Date(dto.dataFimPrevista);

    if (dto.status !== undefined) {
      data.status = dto.status;

      // Validar dependencias antes de concluir
      if (dto.status === 'CONCLUIDO') {
        const dependenciasBloqueantes = await this.prisma.dependenciaProjeto.findMany({
          where: {
            projetoOrigemId: id,
            tipo: { in: ['BLOQUEIO', 'PREDECESSOR'] },
          },
          include: {
            projetoDestino: { select: { id: true, nome: true, numero: true, status: true } },
          },
        });

        const pendentes = dependenciasBloqueantes.filter(
          (d) => d.projetoDestino.status !== 'CONCLUIDO' && d.projetoDestino.status !== 'CANCELADO',
        );

        if (pendentes.length > 0) {
          const nomes = pendentes.map((d) => `#${d.projetoDestino.numero} ${d.projetoDestino.nome}`).join(', ');
          throw new BadRequestException(
            `Nao e possivel concluir projeto com dependencias pendentes: ${nomes}`,
          );
        }

        // Validar sub-projetos antes de concluir
        const subProjetos = await this.prisma.projeto.findMany({
          where: { projetoPaiId: id },
          select: { id: true, nome: true, numero: true, status: true },
        });
        const subPendentes = subProjetos.filter(
          (sp) => sp.status !== 'CONCLUIDO' && sp.status !== 'CANCELADO',
        );
        if (subPendentes.length > 0) {
          const nomes = subPendentes.map((sp) => `#${sp.numero} ${sp.nome}`).join(', ');
          throw new BadRequestException(
            `Nao e possivel concluir projeto com sub-projetos pendentes: ${nomes}`,
          );
        }

        if (!projeto.dataFimReal) {
          data.dataFimReal = new Date();
        }
      }
    }

    return this.prisma.projeto.update({
      where: { id },
      data,
      include: projetoDetailInclude,
    });
  }

  async remove(id: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subProjetos: true,
            chamados: true,
          },
        },
      },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    if (projeto._count.subProjetos > 0) {
      throw new BadRequestException(
        'Nao e possivel excluir projeto que possui sub-projetos.',
      );
    }

    if (projeto._count.chamados > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir projeto com ${projeto._count.chamados} chamado(s) vinculado(s).`,
      );
    }

    // Verifica registros de tempo em atividades
    const registrosTempo = await this.prisma.registroTempo.count({
      where: { atividade: { projetoId: id } },
    });
    if (registrosTempo > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir projeto com ${registrosTempo} registro(s) de tempo em atividades.`,
      );
    }

    await this.prisma.projeto.delete({ where: { id } });
    return { deleted: true };
  }

  // --- Membros ---

  async listMembros(projetoId: string) {
    await this.ensureProjetoExists(projetoId);
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

    return this.prisma.membroProjeto.create({
      data: {
        projetoId,
        usuarioId: dto.usuarioId,
        papel: dto.papel,
        observacoes: dto.observacoes,
      },
      include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
    });
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

  // --- Fases ---

  async listFases(projetoId: string) {
    await this.ensureProjetoExists(projetoId);
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

  // --- Atividades ---

  async listAtividades(projetoId: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.atividadeProjeto.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
        _count: { select: { registrosTempo: true, comentarios: true } },
        registrosTempo: {
          where: { horaFim: null },
          select: { id: true, usuarioId: true, horaInicio: true },
        },
      },
      orderBy: { dataAtividade: 'desc' },
    });
  }

  async addAtividade(
    projetoId: string,
    dto: { titulo: string; descricao?: string; faseId?: string; pendenciaId?: string; dataInicio?: string; dataFimPrevista?: string },
    userId: string,
  ) {
    await this.ensureProjetoExists(projetoId);

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({
        where: { id: dto.faseId, projetoId },
      });
      if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');
    }

    // Valida pendencia se informada
    if (dto.pendenciaId) {
      const pendencia = await this.prisma.pendenciaProjeto.findFirst({
        where: { id: dto.pendenciaId, projetoId },
      });
      if (!pendencia) throw new NotFoundException('Pendencia nao encontrada neste projeto');
    }

    return this.prisma.atividadeProjeto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        projetoId,
        usuarioId: userId,
        faseId: dto.faseId,
        pendenciaId: dto.pendenciaId,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : undefined,
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
      },
    });
  }

  async updateAtividade(
    projetoId: string,
    atividadeId: string,
    dto: { titulo?: string; descricao?: string; faseId?: string; status?: string; dataInicio?: string; dataFimPrevista?: string },
  ) {
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Atividade nao encontrada neste projeto');

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({
        where: { id: dto.faseId, projetoId },
      });
      if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');
    }

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.faseId !== undefined) data.faseId = dto.faseId || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dataInicio !== undefined) data.dataInicio = dto.dataInicio ? new Date(dto.dataInicio) : null;
    if (dto.dataFimPrevista !== undefined) data.dataFimPrevista = dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : null;

    return this.prisma.atividadeProjeto.update({
      where: { id: atividadeId },
      data,
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
      },
    });
  }

  async removeAtividade(projetoId: string, atividadeId: string) {
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
      include: { _count: { select: { registrosTempo: true } } },
    });
    if (!atividade) throw new NotFoundException('Atividade nao encontrada neste projeto');

    if (atividade._count.registrosTempo > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir atividade com ${atividade._count.registrosTempo} registro(s) de tempo. Remova os registros antes.`,
      );
    }

    await this.prisma.atividadeProjeto.delete({ where: { id: atividadeId } });
    return { deleted: true };
  }

  // --- Registro de Tempo ---

  async listarRegistrosTempo(projetoId: string, atividadeId: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.registroTempo.findMany({
      where: { atividadeId, atividade: { projetoId } },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { horaInicio: 'desc' },
    });
  }

  async iniciarRegistroTempo(projetoId: string, atividadeId: string, userId: string) {
    await this.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Atividade nao encontrada neste projeto');

    // Encerra qualquer registro aberto do usuario (em qualquer atividade do projeto)
    const abertos = await this.prisma.registroTempo.findMany({
      where: {
        usuarioId: userId,
        horaFim: null,
        atividade: { projetoId },
      },
    });
    for (const reg of abertos) {
      const duracao = Math.round((Date.now() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempo.update({
        where: { id: reg.id },
        data: { horaFim: new Date(), duracaoMinutos: duracao },
      });
    }

    return this.prisma.registroTempo.create({
      data: {
        horaInicio: new Date(),
        atividadeId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async encerrarRegistroTempo(projetoId: string, atividadeId: string, userId: string) {
    await this.ensureProjetoExists(projetoId);
    const registro = await this.prisma.registroTempo.findFirst({
      where: {
        atividadeId,
        usuarioId: userId,
        horaFim: null,
        atividade: { projetoId },
      },
    });
    if (!registro) throw new NotFoundException('Nenhum registro ativo para esta atividade');

    const duracao = Math.round((Date.now() - new Date(registro.horaInicio).getTime()) / 60000);
    return this.prisma.registroTempo.update({
      where: { id: registro.id },
      data: { horaFim: new Date(), duracaoMinutos: duracao },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async ajustarRegistroTempo(projetoId: string, registroId: string, dto: UpdateRegistroTempoDto) {
    await this.ensureProjetoExists(projetoId);
    const registro = await this.prisma.registroTempo.findFirst({
      where: { id: registroId, atividade: { projetoId } },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');

    const data: Record<string, unknown> = {};
    if (dto.horaInicio) data.horaInicio = new Date(dto.horaInicio);
    if (dto.horaFim) data.horaFim = new Date(dto.horaFim);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    // Recalculate duration if both times are present
    const inicio = dto.horaInicio ? new Date(dto.horaInicio) : new Date(registro.horaInicio);
    const fim = dto.horaFim ? new Date(dto.horaFim) : registro.horaFim ? new Date(registro.horaFim) : null;
    if (fim) {
      data.duracaoMinutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
    }

    return this.prisma.registroTempo.update({
      where: { id: registroId },
      data,
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async removerRegistroTempo(projetoId: string, registroId: string) {
    await this.ensureProjetoExists(projetoId);
    const registro = await this.prisma.registroTempo.findFirst({
      where: { id: registroId, atividade: { projetoId } },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');
    return this.prisma.registroTempo.delete({ where: { id: registroId } });
  }

  async obterRegistroAtivo(projetoId: string, userId: string) {
    return this.prisma.registroTempo.findFirst({
      where: {
        usuarioId: userId,
        horaFim: null,
        atividade: { projetoId },
      },
      include: {
        atividade: { select: { id: true, titulo: true } },
        usuario: { select: { id: true, nome: true } },
      },
    });
  }

  // --- Chamados (vincular/desvincular) ---

  async vincularChamado(projetoId: string, chamadoId: string) {
    await this.ensureProjetoExists(projetoId);

    const chamado = await this.prisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (chamado.projetoId) {
      throw new BadRequestException('Chamado ja esta vinculado a um projeto');
    }

    return this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { projetoId },
      select: { id: true, numero: true, titulo: true, status: true, prioridade: true },
    });
  }

  async desvincularChamado(projetoId: string, chamadoId: string) {
    const chamado = await this.prisma.chamado.findFirst({
      where: { id: chamadoId, projetoId },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado neste projeto');

    return this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { projetoId: null },
      select: { id: true, numero: true, titulo: true, status: true },
    });
  }

  // --- Cotacoes ---

  async listCotacoes(projetoId: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.cotacaoProjeto.findMany({
      where: { projetoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCotacao(projetoId: string, dto: CreateCotacaoDto) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.cotacaoProjeto.create({
      data: {
        fornecedor: dto.fornecedor,
        descricao: dto.descricao,
        valor: dto.valor,
        moeda: dto.moeda || 'BRL',
        dataRecebimento: dto.dataRecebimento ? new Date(dto.dataRecebimento) : undefined,
        validade: dto.validade ? new Date(dto.validade) : undefined,
        status: dto.status || 'RASCUNHO',
        observacoes: dto.observacoes,
        projetoId,
      },
    });
  }

  async updateCotacao(projetoId: string, cotacaoId: string, dto: CreateCotacaoDto) {
    const cotacao = await this.prisma.cotacaoProjeto.findFirst({
      where: { id: cotacaoId, projetoId },
    });
    if (!cotacao) throw new NotFoundException('Cotacao nao encontrada neste projeto');

    const data: Record<string, unknown> = {};
    if (dto.fornecedor !== undefined) data.fornecedor = dto.fornecedor;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.valor !== undefined) data.valor = dto.valor;
    if (dto.moeda !== undefined) data.moeda = dto.moeda;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dataRecebimento !== undefined) data.dataRecebimento = new Date(dto.dataRecebimento);
    if (dto.validade !== undefined) data.validade = new Date(dto.validade);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.cotacaoProjeto.update({ where: { id: cotacaoId }, data });
  }

  async removeCotacao(projetoId: string, cotacaoId: string) {
    const cotacao = await this.prisma.cotacaoProjeto.findFirst({
      where: { id: cotacaoId, projetoId },
    });
    if (!cotacao) throw new NotFoundException('Cotacao nao encontrada neste projeto');
    await this.prisma.cotacaoProjeto.delete({ where: { id: cotacaoId } });
    return { deleted: true };
  }

  // --- Custos Detalhados ---

  async listCustosDetalhados(projetoId: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.custoProjeto.findMany({
      where: { projetoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCusto(projetoId: string, dto: CreateCustoDto) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.custoProjeto.create({
      data: {
        descricao: dto.descricao,
        categoria: dto.categoria,
        valorPrevisto: dto.valorPrevisto,
        valorRealizado: dto.valorRealizado,
        data: dto.data ? new Date(dto.data) : undefined,
        observacoes: dto.observacoes,
        projetoId,
      },
    });
  }

  async updateCusto(projetoId: string, custoId: string, dto: CreateCustoDto) {
    const custo = await this.prisma.custoProjeto.findFirst({
      where: { id: custoId, projetoId },
    });
    if (!custo) throw new NotFoundException('Custo nao encontrado neste projeto');

    const data: Record<string, unknown> = {};
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.valorPrevisto !== undefined) data.valorPrevisto = dto.valorPrevisto;
    if (dto.valorRealizado !== undefined) data.valorRealizado = dto.valorRealizado;
    if (dto.data !== undefined) data.data = new Date(dto.data);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.custoProjeto.update({ where: { id: custoId }, data });
  }

  async removeCusto(projetoId: string, custoId: string) {
    const custo = await this.prisma.custoProjeto.findFirst({
      where: { id: custoId, projetoId },
    });
    if (!custo) throw new NotFoundException('Custo nao encontrado neste projeto');
    await this.prisma.custoProjeto.delete({ where: { id: custoId } });
    return { deleted: true };
  }

  // --- Riscos ---

  async listRiscos(projetoId: string) {
    const projeto = await this.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Riscos so estao disponiveis em projetos modo COMPLETO');
    }
    return this.prisma.riscoProjeto.findMany({
      where: { projetoId },
      include: { responsavel: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addRisco(projetoId: string, dto: CreateRiscoDto) {
    const projeto = await this.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Riscos so estao disponiveis em projetos modo COMPLETO');
    }
    return this.prisma.riscoProjeto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        probabilidade: dto.probabilidade,
        impacto: dto.impacto,
        status: dto.status || 'IDENTIFICADO',
        planoMitigacao: dto.planoMitigacao,
        responsavelId: dto.responsavelId,
        observacoes: dto.observacoes,
        projetoId,
      },
      include: { responsavel: { select: { id: true, nome: true } } },
    });
  }

  async updateRisco(projetoId: string, riscoId: string, dto: CreateRiscoDto) {
    const risco = await this.prisma.riscoProjeto.findFirst({
      where: { id: riscoId, projetoId },
    });
    if (!risco) throw new NotFoundException('Risco nao encontrado neste projeto');

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.probabilidade !== undefined) data.probabilidade = dto.probabilidade;
    if (dto.impacto !== undefined) data.impacto = dto.impacto;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.planoMitigacao !== undefined) data.planoMitigacao = dto.planoMitigacao;
    if (dto.responsavelId !== undefined) data.responsavelId = dto.responsavelId;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.riscoProjeto.update({
      where: { id: riscoId },
      data,
      include: { responsavel: { select: { id: true, nome: true } } },
    });
  }

  async removeRisco(projetoId: string, riscoId: string) {
    const risco = await this.prisma.riscoProjeto.findFirst({
      where: { id: riscoId, projetoId },
    });
    if (!risco) throw new NotFoundException('Risco nao encontrado neste projeto');
    await this.prisma.riscoProjeto.delete({ where: { id: riscoId } });
    return { deleted: true };
  }

  // --- Dependencias ---

  async listDependencias(projetoId: string) {
    const projeto = await this.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Dependencias so estao disponiveis em projetos modo COMPLETO');
    }

    const [origem, destino] = await Promise.all([
      this.prisma.dependenciaProjeto.findMany({
        where: { projetoOrigemId: projetoId },
        include: {
          projetoDestino: { select: { id: true, numero: true, nome: true, status: true } },
        },
      }),
      this.prisma.dependenciaProjeto.findMany({
        where: { projetoDestinoId: projetoId },
        include: {
          projetoOrigem: { select: { id: true, numero: true, nome: true, status: true } },
        },
      }),
    ]);

    return { origem, destino };
  }

  async addDependencia(projetoId: string, dto: CreateDependenciaDto) {
    const projeto = await this.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Dependencias so estao disponiveis em projetos modo COMPLETO');
    }

    if (dto.projetoDestinoId === projetoId) {
      throw new BadRequestException('Um projeto nao pode depender de si mesmo');
    }

    const destino = await this.prisma.projeto.findUnique({
      where: { id: dto.projetoDestinoId },
    });
    if (!destino) throw new NotFoundException('Projeto destino nao encontrado');

    const existing = await this.prisma.dependenciaProjeto.findUnique({
      where: {
        projetoOrigemId_projetoDestinoId_tipo: {
          projetoOrigemId: projetoId,
          projetoDestinoId: dto.projetoDestinoId,
          tipo: dto.tipo,
        },
      },
    });
    if (existing) throw new BadRequestException('Esta dependencia ja existe');

    return this.prisma.dependenciaProjeto.create({
      data: {
        projetoOrigemId: projetoId,
        projetoDestinoId: dto.projetoDestinoId,
        tipo: dto.tipo,
        descricao: dto.descricao,
      },
      include: {
        projetoDestino: { select: { id: true, numero: true, nome: true, status: true } },
      },
    });
  }

  async removeDependencia(projetoId: string, depId: string) {
    const dep = await this.prisma.dependenciaProjeto.findFirst({
      where: {
        id: depId,
        OR: [{ projetoOrigemId: projetoId }, { projetoDestinoId: projetoId }],
      },
    });
    if (!dep) throw new NotFoundException('Dependencia nao encontrada neste projeto');
    await this.prisma.dependenciaProjeto.delete({ where: { id: depId } });
    return { deleted: true };
  }

  // --- Anexos ---

  async listAnexos(projetoId: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.anexoProjeto.findMany({
      where: { projetoId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAnexo(projetoId: string, dto: CreateAnexoDto, userId: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.anexoProjeto.create({
      data: {
        titulo: dto.titulo,
        url: dto.url,
        tipo: dto.tipo || 'DOCUMENTO',
        tamanho: dto.tamanho,
        descricao: dto.descricao,
        projetoId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async uploadAnexo(projetoId: string, file: Express.Multer.File, userId: string, descricao?: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.anexoProjeto.create({
      data: {
        titulo: file.originalname,
        url: file.filename,
        tipo: 'ARQUIVO',
        nomeArquivo: file.filename,
        nomeOriginal: file.originalname,
        mimeType: file.mimetype,
        tamanhoBytes: file.size,
        tamanho: file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${(file.size / 1024).toFixed(0)} KB`,
        descricao,
        projetoId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async getAnexoFile(projetoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoProjeto.findFirst({
      where: { id: anexoId, projetoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste projeto');
    if (anexo.tipo !== 'ARQUIVO' || !anexo.nomeArquivo) {
      throw new BadRequestException('Este anexo nao e um arquivo para download');
    }
    const filePath = path.join(PROJETO_UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }
    return { filePath, anexo };
  }

  async removeAnexo(projetoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoProjeto.findFirst({
      where: { id: anexoId, projetoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste projeto');

    // Remove file from disk if it's a file attachment
    if (anexo.tipo === 'ARQUIVO' && anexo.nomeArquivo) {
      const filePath = path.join(PROJETO_UPLOADS_DIR, anexo.nomeArquivo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.prisma.anexoProjeto.delete({ where: { id: anexoId } });
    return { deleted: true };
  }

  // --- Apontamento de Horas ---

  async listApontamentos(projetoId: string) {
    const projeto = await this.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Apontamento de horas so esta disponivel em projetos modo COMPLETO');
    }
    return this.prisma.apontamentoHoras.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
      },
      orderBy: { data: 'desc' },
    });
  }

  async addApontamento(projetoId: string, dto: CreateApontamentoDto, userId: string) {
    const projeto = await this.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Apontamento de horas so esta disponivel em projetos modo COMPLETO');
    }

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({
        where: { id: dto.faseId, projetoId },
      });
      if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');
    }

    return this.prisma.apontamentoHoras.create({
      data: {
        data: new Date(dto.data),
        horas: dto.horas,
        descricao: dto.descricao,
        observacoes: dto.observacoes,
        projetoId,
        usuarioId: userId,
        faseId: dto.faseId,
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
      },
    });
  }

  async removeApontamento(projetoId: string, apontamentoId: string) {
    const ap = await this.prisma.apontamentoHoras.findFirst({
      where: { id: apontamentoId, projetoId },
    });
    if (!ap) throw new NotFoundException('Apontamento nao encontrado neste projeto');
    await this.prisma.apontamentoHoras.delete({ where: { id: apontamentoId } });
    return { deleted: true };
  }

  // --- Chamados vinculados ---

  async getChamadosProjeto(projetoId: string) {
    await this.ensureProjetoExists(projetoId);
    return this.prisma.chamado.findMany({
      where: { projetoId },
      include: {
        solicitante: { select: { id: true, nome: true, username: true } },
        tecnico: { select: { id: true, nome: true, username: true } },
        equipeAtual: { select: { id: true, nome: true, sigla: true, cor: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Custos Consolidados ---

  async getCustosConsolidados(id: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        nivel: true,
        custoPrevisto: true,
        custoRealizado: true,
      },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    const [custosDetalhados, totalHoras, subProjetos] = await Promise.all([
      this.prisma.custoProjeto.aggregate({
        where: { projetoId: id },
        _sum: { valorPrevisto: true, valorRealizado: true },
        _count: true,
      }),
      this.prisma.apontamentoHoras.aggregate({
        where: { projetoId: id },
        _sum: { horas: true },
        _count: true,
      }),
      this.getSubProjetosRecursivo(id),
    ]);

    let custoPrevistoFilhos = 0;
    let custoRealizadoFilhos = 0;
    for (const sub of subProjetos) {
      custoPrevistoFilhos += Number(sub.custoPrevisto || 0);
      custoRealizadoFilhos += Number(sub.custoRealizado || 0);
    }

    const subIds = subProjetos.map((s) => s.id);
    if (subIds.length > 0) {
      const aggrFilhos = await this.prisma.custoProjeto.aggregate({
        where: { projetoId: { in: subIds } },
        _sum: { valorPrevisto: true, valorRealizado: true },
      });
      custoPrevistoFilhos += Number(aggrFilhos._sum.valorPrevisto || 0);
      custoRealizadoFilhos += Number(aggrFilhos._sum.valorRealizado || 0);
    }

    const custoPrevistoProprio =
      Number(projeto.custoPrevisto || 0) + Number(custosDetalhados._sum.valorPrevisto || 0);
    const custoRealizadoProprio =
      Number(projeto.custoRealizado || 0) + Number(custosDetalhados._sum.valorRealizado || 0);

    return {
      projeto: { id: projeto.id, nome: projeto.nome, nivel: projeto.nivel },
      custoPrevistoProprio,
      custoRealizadoProprio,
      custoPrevistoFilhos,
      custoRealizadoFilhos,
      custoPrevistoTotal: custoPrevistoProprio + custoPrevistoFilhos,
      custoRealizadoTotal: custoRealizadoProprio + custoRealizadoFilhos,
      totalSubProjetos: subProjetos.length,
      custosDetalhados: custosDetalhados._count,
      totalHoras: Number(totalHoras._sum.horas || 0),
      totalApontamentos: totalHoras._count,
    };
  }

  // --- Comentarios de Tarefa ---

  async listComentarios(projetoId: string, atividadeId: string) {
    await this.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Tarefa nao encontrada neste projeto');

    return this.prisma.comentarioTarefa.findMany({
      where: { atividadeId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addComentario(projetoId: string, atividadeId: string, texto: string, userId: string) {
    await this.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Tarefa nao encontrada neste projeto');

    return this.prisma.comentarioTarefa.create({
      data: {
        texto,
        atividadeId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async removeComentario(projetoId: string, comentarioId: string, userId: string, role?: string) {
    await this.ensureProjetoExists(projetoId);
    const comentario = await this.prisma.comentarioTarefa.findFirst({
      where: { id: comentarioId, atividade: { projetoId } },
    });
    if (!comentario) throw new NotFoundException('Comentario nao encontrado');
    const isAdmin = ['ADMIN', 'GESTOR_TI'].includes(role || '');
    if (comentario.usuarioId !== userId && !isAdmin) {
      throw new ForbiddenException('Somente o autor pode remover esta nota');
    }
    await this.prisma.comentarioTarefa.delete({ where: { id: comentarioId } });
    return { deleted: true };
  }

  async updateComentario(projetoId: string, comentarioId: string, texto: string, userId: string, role?: string) {
    await this.ensureProjetoExists(projetoId);
    const comentario = await this.prisma.comentarioTarefa.findFirst({
      where: { id: comentarioId, atividade: { projetoId } },
    });
    if (!comentario) throw new NotFoundException('Comentario nao encontrado');
    const isAdmin = ['ADMIN', 'GESTOR_TI'].includes(role || '');
    if (comentario.usuarioId !== userId && !isAdmin) {
      throw new ForbiddenException('Somente o autor pode editar esta nota');
    }
    return this.prisma.comentarioTarefa.update({
      where: { id: comentarioId },
      data: { texto },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async buscarComentarios(query: string) {
    if (!query || query.trim().length < 2) return [];

    const termo = query.trim();
    const comentarios = await this.prisma.comentarioTarefa.findMany({
      where: {
        texto: { contains: termo, mode: 'insensitive' },
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        atividade: {
          select: {
            id: true,
            titulo: true,
            projetoId: true,
            projeto: { select: { id: true, numero: true, nome: true } },
            fase: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return comentarios;
  }

  // --- Helpers ---

  private async ensureProjetoExists(id: string) {
    const projeto = await this.prisma.projeto.findUnique({ where: { id } });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');
    return projeto;
  }

  private async getSubProjetosRecursivo(projetoId: string) {
    const diretos = await this.prisma.projeto.findMany({
      where: { projetoPaiId: projetoId },
      select: { id: true, custoPrevisto: true, custoRealizado: true },
    });

    const todos = [...diretos];
    for (const sub of diretos) {
      const netos = await this.getSubProjetosRecursivo(sub.id);
      todos.push(...netos);
    }

    return todos;
  }

  // ============================================================
  // USUARIOS-CHAVE
  // ============================================================

  private static TI_ROLES = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];

  /**
   * Verifica se usuario tem acesso ao projeto (USUARIO_CHAVE ou TERCEIRIZADO)
   */
  async checkProjetoAccessChave(projetoId: string, userId: string, role: string) {
    if (ProjetoService.TI_ROLES.includes(role)) return;

    if (role === 'USUARIO_CHAVE') {
      const uc = await this.prisma.usuarioChaveProjeto.findUnique({
        where: { projetoId_usuarioId: { projetoId, usuarioId: userId } },
      });
      if (uc && uc.ativo) return;
    }

    if (role === 'TERCEIRIZADO') {
      const terc = await this.prisma.terceirizadoProjeto.findUnique({
        where: { projetoId_usuarioId: { projetoId, usuarioId: userId } },
      });
      if (terc && terc.ativo) return;
    }

    throw new ForbiddenException('Sem acesso a este projeto');
  }

  async listUsuariosChave(projetoId: string) {
    await this.findOne(projetoId);
    return this.prisma.usuarioChaveProjeto.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addUsuarioChave(projetoId: string, dto: CreateUsuarioChaveDto) {
    await this.findOne(projetoId);
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

  // ============================================================
  // PENDENCIAS
  // ============================================================

  async listPendencias(projetoId: string, filters: {
    status?: string; prioridade?: string; responsavelId?: string; search?: string; incluirSubProjetos?: boolean;
  }, userId: string, role: string) {
    await this.checkProjetoAccessChave(projetoId, userId, role);

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
    await this.checkProjetoAccessChave(projetoId, userId, role);

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

  async gerarAtividadeFromPendencia(
    projetoId: string,
    pendenciaId: string,
    dto: { titulo?: string; descricao?: string; dataFimPrevista?: string },
    userId: string,
  ) {
    await this.ensureProjetoExists(projetoId);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada neste projeto');

    // Cria atividade com dados da pendencia (permite override)
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
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
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

    return atividade;
  }

  async createPendencia(projetoId: string, dto: CreatePendenciaDto, criadorId: string, role: string) {
    await this.checkProjetoAccessChave(projetoId, criadorId, role);
    const projeto = await this.findOne(projetoId);

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

    return pendencia;
  }

  async updatePendencia(projetoId: string, pendenciaId: string, dto: UpdatePendenciaDto, userId: string, role: string) {
    await this.checkProjetoAccessChave(projetoId, userId, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');

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

  // ============================================================
  // INTERACOES PENDENCIA
  // ============================================================

  async addInteracaoPendencia(projetoId: string, pendenciaId: string, dto: CreateInteracaoPendenciaDto, userId: string, role: string) {
    await this.checkProjetoAccessChave(projetoId, userId, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');
    if (['CONCLUIDA', 'CANCELADA'].includes(pendencia.status)) {
      throw new BadRequestException('Nao e possivel comentar em pendencia finalizada');
    }

    // USUARIO_CHAVE e TERCEIRIZADO: always public
    const publica = (role === 'USUARIO_CHAVE' || role === 'TERCEIRIZADO') ? true : (dto.publica ?? true);

    return this.prisma.interacaoPendencia.create({
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
  }

  // ============================================================
  // ANEXOS PENDENCIA
  // ============================================================

  async addAnexoPendencia(projetoId: string, pendenciaId: string, file: Express.Multer.File, userId: string, role: string) {
    await this.checkProjetoAccessChave(projetoId, userId, role);

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
    await this.checkProjetoAccessChave(projetoId, userId, role);

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

  // ============================================================
  // MEUS PROJETOS (USUARIO CHAVE)
  // ============================================================

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

  // ============================================================
  // TERCEIRIZADOS
  // ============================================================

  /**
   * Retorna projetos onde o usuario terceirizado esta vinculado
   */
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

  /**
   * Lista terceirizados vinculados a um projeto
   */
  async listTerceirizados(projetoId: string) {
    await this.findOne(projetoId);
    return this.prisma.terceirizadoProjeto.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Adiciona terceirizado a um projeto
   */
  async addTerceirizado(projetoId: string, dto: {
    usuarioId: string;
    funcao: string;
    empresa?: string;
    especialidade?: string;
    dataInicio?: Date;
    dataFim?: Date;
    observacoes?: string;
  }) {
    await this.findOne(projetoId);
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

  /**
   * Atualiza terceirizado em um projeto
   */
  async updateTerceirizado(projetoId: string, terceirizadoId: string, dto: {
    funcao?: string;
    empresa?: string;
    especialidade?: string;
    dataInicio?: Date;
    dataFim?: Date;
    observacoes?: string;
    ativo?: boolean;
  }) {
    await this.findOne(projetoId);
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

  /**
   * Remove (desativa) terceirizado de um projeto
   */
  async removeTerceirizado(projetoId: string, terceirizadoId: string) {
    await this.findOne(projetoId);
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
}
