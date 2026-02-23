import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';
import { CreateFaseDto } from './dto/create-fase.dto';
import { CreateMembroDto } from './dto/create-membro.dto';
import { CreateCotacaoDto } from './dto/create-cotacao.dto';
import { CreateCustoDto } from './dto/create-custo.dto';
import { CreateRiscoDto } from './dto/create-risco.dto';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';
import { CreateAnexoDto } from './dto/create-anexo.dto';
import { CreateApontamentoDto } from './dto/create-apontamento.dto';

const projetoListInclude = {
  software: { select: { id: true, nome: true, tipo: true } },
  contrato: { select: { id: true, numero: true, titulo: true } },
  responsavel: { select: { id: true, nome: true, username: true } },
  _count: {
    select: {
      subProjetos: true, membros: true, fases: true, atividades: true,
      cotacoes: true, custos: true, riscos: true, anexos: true,
      apontamentos: true, dependenciasOrigem: true,
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
  }) {
    const where: Record<string, unknown> = {};

    if (filters.status) where.status = filters.status;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.modo) where.modo = filters.modo;
    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.contratoId) where.contratoId = filters.contratoId;

    if (filters.apenasRaiz === 'true') {
      where.nivel = 1;
    }

    if (filters.search) {
      where.OR = [
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { descricao: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.projeto.findMany({
      where,
      include: projetoListInclude,
      orderBy: { numero: 'desc' },
    });
  }

  async findOne(id: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      include: projetoDetailInclude,
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');
    return projeto;
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
        modo: dto.modo || 'SIMPLES',
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
      if (dto.status === 'CONCLUIDO' && !projeto.dataFimReal) {
        data.dataFimReal = new Date();
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
      include: { _count: { select: { subProjetos: true } } },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    if (projeto._count.subProjetos > 0) {
      throw new BadRequestException(
        'Nao e possivel excluir projeto que possui sub-projetos',
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

    if (projeto.modo === 'SIMPLES' && projeto.nivel > 1) {
      throw new BadRequestException(
        'Sub-projetos em modo SIMPLES herdam membros do pai. Altere para modo COMPLETO para gerenciar membros.',
      );
    }

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

  async updateFase(projetoId: string, faseId: string, dto: CreateFaseDto) {
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
      },
      orderBy: { dataAtividade: 'desc' },
    });
  }

  async addAtividade(
    projetoId: string,
    dto: { titulo: string; descricao?: string; faseId?: string },
    userId: string,
  ) {
    await this.ensureProjetoExists(projetoId);

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({
        where: { id: dto.faseId, projetoId },
      });
      if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');
    }

    return this.prisma.atividadeProjeto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
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

  async removeAnexo(projetoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoProjeto.findFirst({
      where: { id: anexoId, projetoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste projeto');
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
}
