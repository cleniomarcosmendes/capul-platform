import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProjetoDto } from '../dto/create-projeto.dto.js';
import { UpdateProjetoDto } from '../dto/update-projeto.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';
import { projetoListInclude, projetoDetailInclude } from './projeto.constants.js';
import { isGestor } from '../../common/constants/roles.constant.js';

@Injectable()
export class ProjetoCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

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
      await this.helpers.checkProjetoAccessChave(id, userId, role);

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

    // Calcular se usuario e membro/responsavel do projeto
    let isMembro = false;
    if (userId) {
      if (isGestor(role || '')) {
        isMembro = true;
      } else if (projeto.responsavel?.id === userId) {
        isMembro = true;
      } else {
        isMembro = projeto.membros.some((m) => m.usuarioId === userId);
      }
    }

    return { ...projeto, isMembro };
  }

  async visaoGeral(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);

    const [fases, atividades, pendencias] = await Promise.all([
      this.prisma.faseProjeto.findMany({
        where: { projetoId },
        select: { id: true, nome: true, ordem: true, status: true, dataInicio: true, dataFimPrevista: true, dataFimReal: true },
        orderBy: { ordem: 'asc' },
      }),
      this.prisma.atividadeProjeto.findMany({
        where: { projetoId },
        select: {
          id: true, titulo: true, status: true, faseId: true,
          dataInicio: true, dataFimPrevista: true,
          responsaveis: { include: { usuario: { select: { id: true, nome: true } } } },
        },
        orderBy: { dataAtividade: 'asc' },
      }),
      this.prisma.pendenciaProjeto.findMany({
        where: { projetoId, status: { notIn: ['CONCLUIDA', 'CANCELADA'] } },
        select: {
          id: true, numero: true, titulo: true, status: true, prioridade: true,
          dataLimite: true, faseId: true,
          responsavel: { select: { id: true, nome: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { fases, atividades, pendencias };
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
        tipoProjetoId: dto.tipoProjetoId || undefined,
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
    if (dto.tipoProjetoId !== undefined) data.tipoProjetoId = dto.tipoProjetoId || null;
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

        // Validar registros de tempo abertos — encerrar automaticamente
        const registrosAbertos = await this.prisma.registroTempo.findMany({
          where: { atividade: { projetoId: id }, horaFim: null },
        });
        if (registrosAbertos.length > 0) {
          const agora = new Date();
          for (const reg of registrosAbertos) {
            const duracao = Math.round((agora.getTime() - new Date(reg.horaInicio).getTime()) / 60000);
            await this.prisma.registroTempo.update({
              where: { id: reg.id },
              data: { horaFim: agora, duracaoMinutos: duracao },
            });
          }
        }

        // Validar atividades pendentes/em andamento
        const atividadesPendentes = await this.prisma.atividadeProjeto.count({
          where: { projetoId: id, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
        });
        if (atividadesPendentes > 0) {
          throw new BadRequestException(
            `Nao e possivel concluir projeto com ${atividadesPendentes} atividade(s) pendente(s) ou em andamento. Conclua ou cancele as atividades antes.`,
          );
        }

        // Validar fases pendentes/em andamento
        const fasesPendentes = await this.prisma.faseProjeto.count({
          where: { projetoId: id, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
        });
        if (fasesPendentes > 0) {
          throw new BadRequestException(
            `Nao e possivel concluir projeto com ${fasesPendentes} fase(s) pendente(s) ou em andamento. Aprove ou rejeite as fases antes.`,
          );
        }

        // Validar pendencias abertas
        const pendenciasAbertas = await this.prisma.pendenciaProjeto.count({
          where: { projetoId: id, status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO'] } },
        });
        if (pendenciasAbertas > 0) {
          throw new BadRequestException(
            `Nao e possivel concluir projeto com ${pendenciasAbertas} pendencia(s) aberta(s). Conclua ou cancele as pendencias antes.`,
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

  async duplicar(id: string, userId: string) {
    const original = await this.prisma.projeto.findUnique({
      where: { id },
      include: {
        membros: true,
        fases: { orderBy: { ordem: 'asc' } },
        atividades: { include: { comentarios: true } },
        cotacoes: true,
        custos: true,
        riscos: true,
        usuariosChave: true,
        terceirizados: true,
        pendencias: { include: { interacoes: true } },
      },
    });
    if (!original) throw new NotFoundException('Projeto nao encontrado');

    // Criar projeto duplicado
    const novoProjeto = await this.prisma.projeto.create({
      data: {
        nome: `${original.nome} (Copia)`,
        descricao: original.descricao,
        tipo: original.tipo,
        tipoProjetoId: original.tipoProjetoId,
        modo: original.modo,
        status: 'PLANEJAMENTO',
        nivel: original.nivel,
        custoPrevisto: original.custoPrevisto,
        custoRealizado: null,
        dataInicio: null,
        dataFimPrevista: original.dataFimPrevista,
        dataFimReal: null,
        observacoes: original.observacoes,
        responsavelId: userId,
        softwareId: original.softwareId,
        contratoId: original.contratoId,
        projetoPaiId: original.projetoPaiId,
      },
    });

    // Duplicar membros
    if (original.membros.length > 0) {
      await this.prisma.membroProjeto.createMany({
        data: original.membros.map((m) => ({
          projetoId: novoProjeto.id,
          usuarioId: m.usuarioId,
          papel: m.papel,
          observacoes: m.observacoes,
        })),
        skipDuplicates: true,
      });
    }

    // Duplicar fases (status resetado para PENDENTE)
    if (original.fases.length > 0) {
      await this.prisma.faseProjeto.createMany({
        data: original.fases.map((f) => ({
          projetoId: novoProjeto.id,
          nome: f.nome,
          descricao: f.descricao,
          ordem: f.ordem,
          status: 'PENDENTE',
          dataInicio: null,
          dataFimPrevista: f.dataFimPrevista,
          dataFimReal: null,
          observacoes: f.observacoes,
        })),
      });
    }

    // Duplicar cotações (status resetado para RASCUNHO)
    if (original.cotacoes.length > 0) {
      await this.prisma.cotacaoProjeto.createMany({
        data: original.cotacoes.map((c) => ({
          projetoId: novoProjeto.id,
          fornecedor: c.fornecedor,
          descricao: c.descricao,
          valor: c.valor,
          moeda: c.moeda,
          status: 'RASCUNHO',
          observacoes: c.observacoes,
        })),
      });
    }

    // Duplicar custos (realizado zerado)
    if (original.custos.length > 0) {
      await this.prisma.custoProjeto.createMany({
        data: original.custos.map((c) => ({
          projetoId: novoProjeto.id,
          descricao: c.descricao,
          categoria: c.categoria,
          valorPrevisto: c.valorPrevisto,
          valorRealizado: null,
          observacoes: c.observacoes,
        })),
      });
    }

    // Duplicar riscos (status resetado para IDENTIFICADO)
    if (original.riscos.length > 0) {
      await this.prisma.riscoProjeto.createMany({
        data: original.riscos.map((r) => ({
          projetoId: novoProjeto.id,
          titulo: r.titulo,
          descricao: r.descricao,
          probabilidade: r.probabilidade,
          impacto: r.impacto,
          status: 'IDENTIFICADO',
          planoMitigacao: r.planoMitigacao,
          observacoes: r.observacoes,
          responsavelId: r.responsavelId,
        })),
      });
    }

    // Duplicar usuarios-chave
    if (original.usuariosChave.length > 0) {
      await this.prisma.usuarioChaveProjeto.createMany({
        data: original.usuariosChave.map((u) => ({
          projetoId: novoProjeto.id,
          usuarioId: u.usuarioId,
          funcao: u.funcao,
          ativo: true,
        })),
        skipDuplicates: true,
      });
    }

    // Duplicar terceirizados
    if (original.terceirizados.length > 0) {
      await this.prisma.terceirizadoProjeto.createMany({
        data: original.terceirizados.map((t) => ({
          projetoId: novoProjeto.id,
          usuarioId: t.usuarioId,
          empresa: t.empresa,
          funcao: t.funcao,
          especialidade: t.especialidade,
          ativo: true,
          observacoes: t.observacoes,
        })),
        skipDuplicates: true,
      });
    }

    // Mapear IDs das fases originais para as novas (para vincular atividades)
    const faseMap = new Map<string, string>();
    if (original.fases.length > 0) {
      const novasFases = await this.prisma.faseProjeto.findMany({
        where: { projetoId: novoProjeto.id },
        orderBy: { ordem: 'asc' },
      });
      for (let i = 0; i < original.fases.length && i < novasFases.length; i++) {
        faseMap.set(original.fases[i].id, novasFases[i].id);
      }
    }

    // Duplicar atividades (status resetado para PENDENTE, sem registros de tempo)
    if (original.atividades.length > 0) {
      for (const a of original.atividades) {
        const novaAtividade = await this.prisma.atividadeProjeto.create({
          data: {
            projetoId: novoProjeto.id,
            titulo: a.titulo,
            descricao: a.descricao,
            status: 'PENDENTE',
            dataAtividade: new Date(),
            dataInicio: null,
            dataFimPrevista: a.dataFimPrevista,
            usuarioId: a.usuarioId,
            faseId: a.faseId ? faseMap.get(a.faseId) || null : null,
          },
        });

        // Duplicar comentários/notas da atividade
        if (a.comentarios && a.comentarios.length > 0) {
          await this.prisma.comentarioTarefa.createMany({
            data: a.comentarios.map((c) => ({
              atividadeId: novaAtividade.id,
              usuarioId: c.usuarioId,
              texto: c.texto,
            })),
          });
        }
      }
    }

    // Duplicar pendências (status resetado para ABERTA) + interações
    if (original.pendencias.length > 0) {
      for (const p of original.pendencias) {
        const novaPendencia = await this.prisma.pendenciaProjeto.create({
          data: {
            projetoId: novoProjeto.id,
            titulo: p.titulo,
            descricao: p.descricao,
            status: 'ABERTA',
            prioridade: p.prioridade,
            dataLimite: p.dataLimite,
            responsavelId: p.responsavelId,
            criadorId: userId,
            faseId: p.faseId ? faseMap.get(p.faseId) || null : null,
          },
        });

        // Duplicar interações da pendência (sem anexos)
        if (p.interacoes && p.interacoes.length > 0) {
          await this.prisma.interacaoPendencia.createMany({
            data: p.interacoes.map((i) => ({
              pendenciaId: novaPendencia.id,
              tipo: i.tipo,
              descricao: i.descricao,
              publica: i.publica,
              usuarioId: i.usuarioId,
            })),
          });
        }
      }
    }

    return this.findOne(novoProjeto.id);
  }
}
