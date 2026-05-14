import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateChamadoDto } from '../dto/create-chamado.dto.js';
import { UpdateChamadoHeaderDto } from '../dto/update-chamado-header.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from '../dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from '../dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from '../dto/resolver-chamado.dto.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { ChamadoHelpersService } from './chamado-helpers.service.js';
import { ChamadoAgrupamentoService } from './chamado-agrupamento.service.js';
import { ChamadoTempoService } from './chamado-tempo.service.js';
import { chamadoInclude } from './chamado.constants.js';
import { isGestor, isTI } from '../../common/constants/roles.constant.js';
import { StatusChamado, Visibilidade } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ChamadoCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly helpers: ChamadoHelpersService,
    private readonly tempo: ChamadoTempoService,
    private readonly agrupamento: ChamadoAgrupamentoService,
  ) {}

  // ─── Coletar todos os envolvidos no chamado (para notificacoes) ───
  // Inclui solicitante, tecnico atual, colaboradores (T.I.) e copias (extras).
  // Copias entraram em 13/05/2026 — ver feature "Em copia" no chamado.
  private async getDestinatariosChamado(
    chamadoId: string,
    excluirIds: string[],
  ): Promise<string[]> {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        solicitanteId: true,
        tecnicoId: true,
        colaboradores: { select: { usuarioId: true } },
        copias: { select: { usuarioId: true } },
      },
    });
    if (!chamado) return [];

    const ids = new Set<string>();
    ids.add(chamado.solicitanteId);
    if (chamado.tecnicoId) ids.add(chamado.tecnicoId);
    for (const c of chamado.colaboradores) ids.add(c.usuarioId);
    for (const c of chamado.copias) ids.add(c.usuarioId);

    for (const id of excluirIds) ids.delete(id);
    return Array.from(ids);
  }

  async findAll(user: JwtPayload, role: string, filters: {
    status?: StatusChamado | string;
    equipeId?: string;
    visibilidade?: Visibilidade;
    meusChamados?: boolean;
    projetoId?: string;
    filialId?: string;
    departamentoId?: string;
    pendentesAvaliacao?: boolean;
    search?: string;
    tecnicoId?: string;
    dataInicio?: string;
    dataFim?: string;
    /**
     * Paginação (introduzida em 23/04/2026 após chamados passarem de 500 em
     * produção). Padrão: página 1, 50 por página. `pageSize` aceita até 200
     * para permitir export/visualização consolidada, mas o client padrão fica
     * em 50 para manter a UI ágil.
     */
    page?: number;
    pageSize?: number;
    /**
     * Ordenação por clique no header (10/05/2026). Whitelist de colunas
     * impede SQL injection via query param. Default mantido: createdAt desc.
     */
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    /**
     * Inclui chamados em status AGRUPADO na listagem. Default false
     * (filhos ficam "escondidos" — operacao acontece no agrupador).
     * Decidido em 13/05/2026.
     */
    incluirAgrupados?: boolean;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.pendentesAvaliacao) {
      where.solicitanteId = user.sub;
      where.status = { in: ['RESOLVIDO', 'FECHADO'] };
      where.notaSatisfacao = null;
    } else {
      if (filters.status) {
        if ((filters.status as string) === 'ATIVOS') {
          where.status = { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'PENDENTE_USUARIO', 'REABERTO'] };
        } else {
          where.status = filters.status;
        }
      } else if (!filters.incluirAgrupados) {
        // Sem filtro de status: por default excluir AGRUPADO (filho fica escondido).
        where.NOT = { status: 'AGRUPADO' };
      }
      if (filters.equipeId) where.equipeAtualId = filters.equipeId;
      if (filters.visibilidade) where.visibilidade = filters.visibilidade;
      if (filters.projetoId) where.projetoId = filters.projetoId;
      if (filters.filialId) where.filialId = filters.filialId;
      if (filters.departamentoId) where.departamentoId = filters.departamentoId;
      if (filters.tecnicoId) where.tecnicoId = filters.tecnicoId;

      if (filters.dataInicio || filters.dataFim) {
        const range: Record<string, Date> = {};
        if (filters.dataInicio) range.gte = new Date(filters.dataInicio);
        if (filters.dataFim) {
          const fim = new Date(filters.dataFim);
          fim.setHours(23, 59, 59, 999);
          range.lte = fim;
        }
        // Filtro por "atividade no período" (decisão 14/05/2026): inclui
        // chamado aberto E chamados com qualquer movimento (reabertura,
        // comentário, transferência) dentro do range, mesmo que abertos antes.
        // Caso real: chamado #152 aberto 13/05, reaberto 14/05 — sumia ao
        // filtrar 14/05 porque o filtro olhava só createdAt. Agora aparece.
        const dateCondition = { OR: [{ createdAt: range }, { updatedAt: range }] };
        if (where.AND) {
          (where.AND as object[]).push(dateCondition);
        } else if (where.OR) {
          where.AND = [{ OR: where.OR }, dateCondition];
          delete where.OR;
        } else {
          where.AND = [dateCondition];
        }
      }

      // Para roles nao-staff, restringir as filiais vinculadas ao usuario
      const isStaff = isGestor(role) || isTI(role);
      if (!isStaff && !filters.filialId) {
        const userFiliais = await this.prisma.$queryRaw<{ filial_id: string }[]>`
          SELECT filial_id FROM core.usuario_filiais WHERE usuario_id = ${user.sub}
        `;
        const filialIds = userFiliais.map((f) => f.filial_id);
        if (filialIds.length > 0) {
          where.filialId = { in: filialIds };
        } else if (user.filialId) {
          // Fallback: filial do JWT
          where.filialId = user.filialId;
        }
      }

      if (role === 'USUARIO_FINAL') {
        where.solicitanteId = user.sub;
        where.visibilidade = 'PUBLICO';
      } else if (['USUARIO_CHAVE', 'TERCEIRIZADO'].includes(role)) {
        where.OR = [
          { solicitanteId: user.sub },
          { tecnicoId: user.sub },
          { colaboradores: { some: { usuarioId: user.sub } } },
        ];
        // Cinto-e-suspensório (14/05/2026): chamado PRIVADO é staff-only.
        // Mesmo que TI vincule um USUARIO_CHAVE/TERCEIRIZADO por engano,
        // ele não enxerga PRIVADO na listagem. Criação já é restrita a
        // ROLES_PODE_PRIVADO; este é o filtro de leitura espelhado.
        where.visibilidade = 'PUBLICO';
      } else if (filters.meusChamados) {
        where.OR = [
          { solicitanteId: user.sub },
          { tecnicoId: user.sub },
          { colaboradores: { some: { usuarioId: user.sub } } },
        ];
      } else if (!filters.equipeId && !isTI(role)) {
        // Staff sem filtro "meus chamados" e sem equipe selecionada:
        // mostrar chamados das equipes que o tecnico faz parte + seus proprios
        const minhasEquipes = await this.prisma.membroEquipe.findMany({
          where: { usuarioId: user.sub, status: 'ATIVO' },
          select: { equipeId: true },
        });
        const equipeIds = minhasEquipes.map((e) => e.equipeId);
        if (equipeIds.length > 0) {
          where.OR = [
            { equipeAtualId: { in: equipeIds } },
            { tecnicoId: user.sub },
            { colaboradores: { some: { usuarioId: user.sub } } },
          ];
        }
      }
    }

    if (filters.search) {
      const term = filters.search.trim();
      const numero = parseInt(term, 10);
      // Busca cobre: numero exato (se numerico) + titulo + descricao + nome
      // do solicitante. Pedido suporte 13/05/2026 — "achar pelo nome de
      // quem abriu e por texto do chamado".
      const orClauses: Record<string, unknown>[] = [
        { titulo: { contains: term, mode: 'insensitive' } },
        { descricao: { contains: term, mode: 'insensitive' } },
        { solicitante: { nome: { contains: term, mode: 'insensitive' } } },
      ];
      if (numero) orClauses.unshift({ numero });
      const searchCondition = { OR: orClauses };

      // Compat com filtro de data acima (que pode ter criado where.AND).
      if (where.AND) {
        (where.AND as object[]).push(searchCondition);
      } else if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition];
        delete where.OR;
      } else {
        Object.assign(where, searchCondition);
      }
    }

    // Paginação: default 1 × 50; teto 200 para proteger contra payloads
    // muito grandes. count e findMany no mesmo $transaction para consistência
    // (evita total que não bate com a página retornada se houver insert entre
    // as duas queries).
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

    // Whitelist de ordenação (10/05/2026): protege contra SQL injection via
    // query param e mapeia colunas amigáveis pra estrutura Prisma (alguns
    // campos são em relations, ex.: filial.nome via JOIN).
    const SORT_MAP: Record<string, Record<string, unknown>> = {
      numero: { numero: filters.sortOrder ?? 'asc' },
      titulo: { titulo: filters.sortOrder ?? 'asc' },
      status: { status: filters.sortOrder ?? 'asc' },
      prioridade: { prioridade: filters.sortOrder ?? 'asc' },
      createdAt: { createdAt: filters.sortOrder ?? 'desc' },
      updatedAt: { updatedAt: filters.sortOrder ?? 'desc' },
      filial: { filial: { nome: filters.sortOrder ?? 'asc' } },
      equipe: { equipeAtual: { nome: filters.sortOrder ?? 'asc' } },
      tecnico: { tecnico: { nome: filters.sortOrder ?? 'asc' } },
      solicitante: { solicitante: { nome: filters.sortOrder ?? 'asc' } },
      departamento: { departamento: { nome: filters.sortOrder ?? 'asc' } },
    };
    // Default: ordenar por ultima atividade (updatedAt) — chamado reaberto,
    // comentado ou transferido sobe ao topo. Decidido em 13/05/2026 pos
    // feedback do Clenio: chamado reaberto antigo nao aparecia no topo.
    const orderBy = (filters.sortBy && SORT_MAP[filters.sortBy])
      ? SORT_MAP[filters.sortBy]
      : { updatedAt: 'desc' as const };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.chamado.count({ where }),
      this.prisma.chamado.findMany({
        where,
        include: chamadoInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string, user: JwtPayload, role: string) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id },
      include: {
        ...chamadoInclude,
        historicos: {
          include: {
            usuario: { select: { id: true, nome: true, username: true } },
            equipeOrigem: { select: { id: true, nome: true, sigla: true } },
            equipeDestino: { select: { id: true, nome: true, sigla: true } },
          },
          // Mais recente em cima (chat-style TOTVS — decisao 13/05/2026).
          orderBy: { createdAt: 'desc' },
        },
        colaboradores: {
          include: { usuario: { select: { id: true, nome: true, username: true } } },
        },
        copias: {
          include: {
            usuario: { select: { id: true, nome: true, username: true } },
            adicionadoPor: { select: { id: true, nome: true, username: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        chamadoAgrupador: {
          select: { id: true, numero: true, titulo: true, status: true },
        },
        chamadosAgrupados: {
          select: {
            id: true, numero: true, titulo: true, status: true,
            statusAnteriorAgrupamento: true, slaPausadoEm: true,
            solicitante: { select: { id: true, nome: true } },
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        registrosTempo: {
          where: { horaFim: null },
          select: { id: true, usuarioId: true, horaInicio: true },
        },
      },
    });

    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (role === 'USUARIO_FINAL') {
      // Copiados tem papel de solicitante: leem o chamado mesmo nao sendo
      // dono. Decidido em 13/05/2026 (feature "Em copia").
      const isCopiado = chamado.copias.some((c) => c.usuarioId === user.sub);
      if (chamado.solicitanteId !== user.sub && !isCopiado) {
        throw new ForbiddenException('Sem acesso a este chamado');
      }
    }

    // Cinto-e-suspensório (14/05/2026): PRIVADO é staff-only no detalhe
    // também. Criação já é restrita a ROLES_PODE_PRIVADO; aqui bloqueia
    // acesso via link direto caso TI vincule non-staff por engano.
    if (chamado.visibilidade === 'PRIVADO' && !isTI(role)) {
      throw new ForbiddenException('Chamado privado — acesso restrito a equipe de TI');
    }

    // Filtro de comentário interno (14/05/2026 — fix): qualquer role
    // NÃO-staff só vê comentários públicos. Antes só filtrava USUARIO_FINAL
    // — USUARIO_CHAVE e TERCEIRIZADO podiam virar solicitante/em-cópia/
    // colaborador e enxergavam comentários internos da equipe T.I.
    // (vazamento). Regra única: staff = ADMIN/GESTOR_TI/SUPORTE_TI (isTI).
    if (!isTI(role)) {
      chamado.historicos = chamado.historicos.filter((h) => h.publico);
    }

    return chamado;
  }

  async create(dto: CreateChamadoDto, user: JwtPayload, role: string) {
    const equipe = await this.prisma.equipeTI.findUnique({
      where: { id: dto.equipeAtualId },
    });
    if (!equipe) throw new BadRequestException('Equipe nao encontrada');

    if (role === 'USUARIO_FINAL' && !equipe.aceitaChamadoExterno) {
      throw new ForbiddenException('Esta equipe nao aceita chamados externos');
    }

    // Visibilidade PRIVADO restrita a equipe de TI (ROLES_TI). Outros roles
    // (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA, USUARIO_CHAVE,
    // TERCEIRIZADO) só podem criar PUBLICO — solicitante tem direito de
    // acompanhar. Defesa em profundidade — frontend já oculta a opção,
    // backend valida pra defender contra request manipulado.
    const ROLES_PODE_PRIVADO = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
    const visibilidade = dto.visibilidade ?? 'PUBLICO';

    if (visibilidade === 'PRIVADO' && !ROLES_PODE_PRIVADO.includes(role)) {
      throw new ForbiddenException(
        'Apenas equipe de TI (ADMIN/GESTOR_TI/SUPORTE_TI) pode criar chamados PRIVADOS',
      );
    }

    const sla = await this.prisma.slaDefinicao.findUnique({
      where: {
        equipeId_prioridade: {
          equipeId: dto.equipeAtualId,
          prioridade: dto.prioridade ?? 'MEDIA',
        },
      },
    });

    const dataLimiteSla = sla
      ? new Date(Date.now() + sla.horasResolucao * 60 * 60 * 1000)
      : null;

    // Auto-preencher nomes a partir do portfolio (integracao retroativa)
    let softwareNome = dto.softwareNome;
    let moduloNome = dto.moduloNome;

    if (dto.softwareId && !softwareNome) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId }, select: { nome: true } });
      if (sw) softwareNome = sw.nome;
    }
    if (dto.softwareModuloId && !moduloNome) {
      const mod = await this.prisma.softwareModulo.findUnique({ where: { id: dto.softwareModuloId }, select: { nome: true } });
      if (mod) moduloNome = mod.nome;
    }

    // Determinar filial, departamento e centro de custo:
    // Tecnicos podem informar valores diferentes (abertura em nome de outro setor)
    let filialId = user.filialId;
    let departamentoId: string | undefined = user.departamentoId;

    if (role !== 'USUARIO_FINAL') {
      if (dto.filialId) {
        const filial = await this.prisma.filial.findUnique({ where: { id: dto.filialId } });
        if (!filial) throw new BadRequestException('Filial nao encontrada');
        filialId = dto.filialId;
      }
      if (dto.departamentoId) {
        const depto = await this.prisma.departamento.findUnique({ where: { id: dto.departamentoId } });
        if (!depto) throw new BadRequestException('Departamento nao encontrado');
        departamentoId = dto.departamentoId;
      }
    }

    // Se tecnico/gestor/admin, auto-assumir o chamado
    // USUARIO_CHAVE e TERCEIRIZADO nao auto-assumem (mesmo perfil que usuario final)
    const rolesNaoAssumem = ['USUARIO_FINAL', 'USUARIO_CHAVE', 'TERCEIRIZADO'];
    const autoAssumir = !rolesNaoAssumem.includes(role);

    const chamado = await this.prisma.chamado.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        visibilidade,
        prioridade: dto.prioridade ?? 'MEDIA',
        status: autoAssumir ? 'EM_ATENDIMENTO' : 'ABERTO',
        solicitanteId: user.sub,
        tecnicoId: autoAssumir ? user.sub : undefined,
        equipeAtualId: dto.equipeAtualId,
        filialId,
        departamentoId,
        softwareNome,
        moduloNome,
        softwareId: dto.softwareId,
        softwareModuloId: dto.softwareModuloId,
        catalogoServicoId: dto.catalogoServicoId,
        projetoId: dto.projetoId,
        ativoId: dto.ativoId,
        ipMaquina: dto.ipMaquina,
        matriculaColaborador: dto.matriculaColaborador,
        nomeColaborador: dto.nomeColaborador?.trim() || undefined,
        slaDefinicaoId: sla?.id,
        dataLimiteSla,
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'ABERTURA',
        descricao: 'Chamado aberto',
        publico: true,
        chamadoId: chamado.id,
        usuarioId: user.sub,
      },
    });

    // Adicionar usuarios em copia (se informados). Validacao isTI + criacao
    // dos registros + notificacao individual aos copiados ocorrem aqui para
    // que o solicitante so receba uma resposta apos o chamado estar 100%
    // configurado. Se algum copiado falhar validacao, o chamado ja foi
    // criado — copiados validos ainda sao processados.
    if (dto.copiasUsuariosIds && dto.copiasUsuariosIds.length > 0) {
      await this.adicionarCopias(chamado.id, dto.copiasUsuariosIds, user, { silenciarErrosIndividuais: false });
    }

    return chamado;
  }

  /**
   * Adiciona usuarios em copia ao chamado. Valida isTI em cada um.
   * Notifica cada copiado da inclusao (mensagem dedicada).
   */
  async adicionarCopias(
    chamadoId: string,
    usuariosIds: string[],
    user: JwtPayload,
    opts: { silenciarErrosIndividuais?: boolean } = {},
  ) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: { id: true, numero: true, titulo: true, copias: { select: { usuarioId: true } } },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    const jaCopiados = new Set(chamado.copias.map((c) => c.usuarioId));
    const novos: string[] = [];
    const erros: { usuarioId: string; motivo: string }[] = [];

    for (const usuarioId of usuariosIds) {
      if (jaCopiados.has(usuarioId)) continue;
      try {
        await this.helpers.assertNaoSeTI(usuarioId);
        // Garantir que o usuario existe (defensive)
        const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
        if (!u) {
          erros.push({ usuarioId, motivo: 'Usuario nao encontrado' });
          continue;
        }
        await this.prisma.chamadoCopia.create({
          data: { chamadoId, usuarioId, adicionadoPorId: user.sub },
        });
        novos.push(usuarioId);
      } catch (err) {
        const msg = (err as { message?: string })?.message ?? 'Erro';
        erros.push({ usuarioId, motivo: msg });
      }
    }

    // Erros: na criacao do chamado (silenciarErrosIndividuais=false) lancamos
    // BadRequest se NENHUM copiado entrou (mas chamado ja existe — UI mostra
    // mensagem amigavel). Em adicao via endpoint dedicado, retornamos relatorio.
    if (!opts.silenciarErrosIndividuais && novos.length === 0 && erros.length > 0) {
      throw new BadRequestException({
        message: 'Nenhum usuario foi adicionado em copia',
        erros,
      });
    }

    // Notificar copiados novos da inclusao (somente novos, nao reativados)
    if (novos.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        novos,
        'CHAMADO_ATUALIZADO',
        `Voce foi adicionado em copia no chamado #${chamado.numero}`,
        `${this.prefixoAutor(user)}adicionou voce em copia no chamado "${chamado.titulo}". Voce recebera atualizacoes e pode comentar.`,
        { chamadoId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return { adicionados: novos, erros };
  }

  /**
   * Versao com check de "quem pode adicionar copia" para endpoint dedicado
   * (POST /chamados/:id/copias). Aceita gestor, tecnico, colaborador,
   * solicitante e ate copiados existentes — qualquer envolvido pode
   * trazer mais gente. Erros individuais sao retornados em vez de
   * lancar (silenciarErrosIndividuais=true).
   */
  async adicionarCopiasComCheck(chamadoId: string, usuariosIds: string[], user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(chamadoId, user.sub, role, {
      permitirSolicitante: true,
      permitirCopia: true,
    });
    return this.adicionarCopias(chamadoId, usuariosIds, user, { silenciarErrosIndividuais: true });
  }

  async listarCopias(chamadoId: string) {
    await this.helpers.getChamadoOrFail(chamadoId);
    return this.prisma.chamadoCopia.findMany({
      where: { chamadoId },
      include: {
        usuario: { select: { id: true, nome: true, username: true, email: true } },
        adicionadoPor: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private prefixoAutor(user: JwtPayload): string {
    const nome = (user as { nome?: string }).nome || (user as { username?: string }).username;
    return nome ? `${nome} ` : '';
  }

  async updateHeader(id: string, dto: UpdateChamadoHeaderDto, user: JwtPayload, role: string) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    // Apenas o solicitante ou gestores podem editar o cabecalho
    const isCriador = chamado.solicitanteId === user.sub;
    if (!isCriador && !isGestor(role)) {
      throw new ForbiddenException('Apenas o solicitante ou gestores podem editar o cabecalho');
    }

    const data: Record<string, string> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar');
    }

    return this.prisma.chamado.update({
      where: { id },
      data,
      include: chamadoInclude,
    });
  }

  async assumir(id: string, user: JwtPayload) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    if (!['ABERTO', 'PENDENTE', 'PENDENTE_USUARIO', 'REABERTO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado nao pode ser assumido neste status');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { tecnicoId: user.sub, status: 'EM_ATENDIMENTO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'ASSUMIDO',
        descricao: 'Chamado assumido',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Auto-iniciar cronometro ao assumir (fecha timers anteriores)
    await this.tempo.encerrarTimersAbertos(user.sub);
    await this.prisma.registroTempoChamado.create({
      data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
    });

    // Notificar envolvidos (solicitante + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} assumido`,
          `O chamado "${chamado.titulo}" foi assumido por um tecnico.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Propaga para filhos agrupados (13/05/2026)
    this.agrupamento.propagarEventoNoFilho(id, 'Chamado assumido por um tecnico', user.sub)
      .catch((err) => console.error('Propagacao assumir error:', err.message));

    return updated;
  }

  async transferirEquipe(id: string, dto: TransferirEquipeDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado finalizado nao pode ser transferido. Reabra o chamado primeiro.');
    }

    const equipeDestino = await this.prisma.equipeTI.findUnique({
      where: { id: dto.equipeDestinoId },
    });
    if (!equipeDestino) throw new BadRequestException('Equipe destino nao encontrada');

    // Se indicou tecnico destino, validar que pertence a equipe destino
    if (dto.tecnicoDestinoId) {
      const membro = await this.prisma.membroEquipe.findUnique({
        where: { usuarioId_equipeId: { usuarioId: dto.tecnicoDestinoId, equipeId: dto.equipeDestinoId } },
      });
      if (!membro || membro.status !== 'ATIVO') {
        throw new BadRequestException('Tecnico informado nao pertence a equipe destino');
      }
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        equipeAtualId: dto.equipeDestinoId,
        tecnicoId: dto.tecnicoDestinoId || null,
        status: dto.tecnicoDestinoId ? 'EM_ATENDIMENTO' : 'ABERTO',
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'TRANSFERENCIA_EQUIPE',
        descricao: dto.motivo || `Chamado transferido para outra equipe${dto.tecnicoDestinoId ? ' com tecnico indicado' : ''}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
        equipeOrigemId: chamado.equipeAtualId,
        equipeDestinoId: dto.equipeDestinoId,
      },
    });

    // Notificar lideres da equipe destino
    this.prisma.membroEquipe.findMany({
      where: { equipeId: dto.equipeDestinoId, isLider: true, status: 'ATIVO' },
      select: { usuarioId: true },
    }).then((lideres) => {
      const ids = lideres.map((l) => l.usuarioId).filter((uid) => uid !== user.sub);
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATRIBUIDO',
          `Chamado #${chamado.numero} transferido`,
          `Chamado "${chamado.titulo}" foi transferido para sua equipe.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Notificar envolvidos (solicitante + tecnico anterior + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} transferido de equipe`,
          `O chamado "${chamado.titulo}" foi transferido para a equipe ${equipeDestino.nome}.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Propaga para filhos agrupados (13/05/2026)
    this.agrupamento.propagarEventoNoFilho(id, `Transferido para a equipe ${equipeDestino.nome}`, user.sub)
      .catch((err) => console.error('Propagacao transferir equipe error:', err.message));

    return updated;
  }

  async transferirTecnico(id: string, dto: TransferirTecnicoDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado finalizado nao pode ser transferido. Reabra o chamado primeiro.');
    }

    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario assumir o chamado antes de transferir para outro tecnico');
    }

    const tecnico = await this.prisma.usuario.findUnique({ where: { id: dto.tecnicoId } });
    if (!tecnico) throw new BadRequestException('Tecnico nao encontrado');

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { tecnicoId: dto.tecnicoId, status: 'EM_ATENDIMENTO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'TRANSFERENCIA_TECNICO',
        descricao: dto.motivo || `Chamado transferido para ${tecnico.nome}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar tecnico destino
    this.notificacaoService.criarParaUsuario(
      dto.tecnicoId, 'CHAMADO_ATRIBUIDO',
      `Chamado #${chamado.numero} atribuido a voce`,
      `O chamado "${chamado.titulo}" foi atribuido a voce.`,
      { chamadoId: id },
    ).catch((err) => console.error('Notificacao error:', err.message));

    // Notificar demais envolvidos (solicitante + colaboradores)
    this.getDestinatariosChamado(id, [user.sub, dto.tecnicoId]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} transferido`,
          `O chamado "${chamado.titulo}" foi transferido para ${tecnico.nome}.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Propaga para filhos agrupados (13/05/2026)
    this.agrupamento.propagarEventoNoFilho(id, `Transferido para o tecnico ${tecnico.nome}`, user.sub)
      .catch((err) => console.error('Propagacao transferir tecnico error:', err.message));

    return updated;
  }

  async comentar(id: string, dto: ComentarioChamadoDto, user: JwtPayload, role: string) {
    // Solicitante e copiados tambem podem comentar (copiado tem "papel de
    // solicitante" — decidido em 13/05/2026).
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role, {
      permitirSolicitante: true,
      permitirCopia: true,
    });

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel comentar em chamado finalizado. Reabra o chamado para adicionar comentarios.');
    }

    // Se chamado nao tem tecnico atribuido, podem comentar:
    // - Solicitante (sempre)
    // - Copiados (tem "papel de solicitante" — decidido em 13/05/2026)
    // - Gestor (override)
    if (!chamado.tecnicoId && chamado.solicitanteId !== user.sub && !isGestor(role)) {
      const isCopia = await this.prisma.chamadoCopia.findUnique({
        where: { chamadoId_usuarioId: { chamadoId: id, usuarioId: user.sub } },
        select: { id: true },
      });
      if (!isCopia) {
        throw new BadRequestException('E necessario assumir o chamado antes de comentar');
      }
    }

    // ----- Validações específicas do "Solicitar info ao usuário" -----
    // Apenas técnico/colaborador/gestor pode marcar como PENDENTE_USUARIO
    // (não faz sentido o solicitante "solicitar info de si mesmo").
    const isSolicitarInfo = dto.solicitarInfoUsuario === true;
    if (isSolicitarInfo) {
      if (chamado.solicitanteId === user.sub && !isGestor(role)) {
        throw new BadRequestException(
          'Apenas o tecnico/colaborador/gestor pode solicitar informacoes ao solicitante.',
        );
      }
      if (chamado.status !== 'EM_ATENDIMENTO' && chamado.status !== 'PENDENTE_USUARIO') {
        throw new BadRequestException(
          'So e possivel solicitar info ao usuario quando o chamado esta em atendimento.',
        );
      }
    }

    // ----- Auto-transição PENDENTE_USUARIO → EM_ATENDIMENTO -----
    // Quando solicitante comenta em chamado PENDENTE_USUARIO, o chamado
    // volta para EM_ATENDIMENTO (sai da fila "aguardando usuário" e volta
    // ao radar do técnico). Notificação dedicada.
    const isRespostaSolicitante =
      chamado.status === 'PENDENTE_USUARIO' && chamado.solicitanteId === user.sub;

    // ----- Anexos vinculados (decisao 13/05/2026 — chat-style) -----
    // Cada anexosIds eh um AnexoChamado ja gravado (upload prévio do front).
    // Apos validar que pertencem a este chamado, anexa marcadores
    // `[anexo:<uuid>]` no fim da descricao. Front parseia em chip clicavel.
    let descricaoFinal = dto.descricao;
    if (dto.anexosIds && dto.anexosIds.length > 0) {
      const anexosValidos = await this.prisma.anexoChamado.findMany({
        where: { id: { in: dto.anexosIds }, chamadoId: id },
        select: { id: true },
      });
      if (anexosValidos.length !== dto.anexosIds.length) {
        throw new BadRequestException('Um ou mais anexos nao pertencem a este chamado');
      }
      const marcadores = anexosValidos.map((a) => `[anexo:${a.id}]`).join(' ');
      descricaoFinal = `${dto.descricao}\n\n${marcadores}`;
    }

    // ----- Persistência -----
    // Comentário sempre é registrado. Se for solicitação de info ou resposta
    // do solicitante, registra também uma entrada MUDANCA_STATUS para que
    // a timeline reflita a transição claramente.
    const historico = await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: descricaoFinal,
        // Defesa em profundidade (14/05/2026): non-staff sempre grava
        // publico=true (mesmo se enviar publico=false no DTO). Frontend não
        // mostra checkbox pra não-staff, mas evita bypass por API direto.
        // "Solicitar info" também força publico=true (solicitante PRECISA ver).
        publico: !isTI(role) || isSolicitarInfo ? true : (dto.publico ?? true),
        chamadoId: id,
        usuarioId: user.sub,
      },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });

    if (isSolicitarInfo) {
      await this.prisma.chamado.update({
        where: { id },
        data: { status: 'PENDENTE_USUARIO' },
      });
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'SOLICITACAO_INFO',
          descricao: 'Aguardando informacoes do solicitante',
          publico: true,
          chamadoId: id,
          usuarioId: user.sub,
        },
      });
    } else if (isRespostaSolicitante) {
      await this.prisma.chamado.update({
        where: { id },
        data: { status: 'EM_ATENDIMENTO' },
      });
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'RETOMADA_USUARIO',
          descricao: 'Solicitante respondeu — chamado retomado em atendimento',
          publico: true,
          chamadoId: id,
          usuarioId: user.sub,
        },
      });
    }

    // ----- Notificações -----
    const destinatarios = await this.getDestinatariosChamado(id, [user.sub]);

    // Processar @mencoes para notificacao diferenciada
    const mencionadoIds = new Set<string>();
    if (dto.descricao) {
      const regex = /@(\S+)/g;
      const usernames: string[] = [];
      let match;
      while ((match = regex.exec(dto.descricao)) !== null) {
        usernames.push(match[1].toLowerCase());
      }
      if (usernames.length > 0) {
        const mencionados = await this.prisma.usuario.findMany({
          where: { username: { in: usernames, mode: 'insensitive' } },
          select: { id: true },
        });
        for (const m of mencionados) {
          if (m.id !== user.sub) mencionadoIds.add(m.id);
        }
      }
    }

    // Caso especial 1: solicitação de info — notificação destacada SOMENTE pro solicitante,
    // demais envolvidos recebem notificação regular de comentário.
    if (isSolicitarInfo && chamado.solicitanteId) {
      this.notificacaoService.criarParaUsuario(
        chamado.solicitanteId,
        'CHAMADO_ATUALIZADO',
        `🔔 Tecnico precisa da sua resposta no chamado #${chamado.numero}`,
        `O tecnico solicitou mais informacoes para continuar o atendimento de "${chamado.titulo}". Acesse e responda assim que possivel.`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Caso especial 2: solicitante respondeu chamado PENDENTE_USUARIO —
    // notificação destacada pro técnico (chamado voltou pra fila dele).
    if (isRespostaSolicitante && chamado.tecnicoId) {
      this.notificacaoService.criarParaUsuario(
        chamado.tecnicoId,
        'CHAMADO_ATUALIZADO',
        `↩ Solicitante respondeu o chamado #${chamado.numero}`,
        `O solicitante respondeu o chamado "${chamado.titulo}". Status voltou para Em Atendimento.`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Mencionados recebem notificacao de mencao (não dispara para solicitante
    // se já recebeu a destacada acima — evita duplicação)
    if (isSolicitarInfo) mencionadoIds.delete(chamado.solicitanteId ?? '');
    if (isRespostaSolicitante) mencionadoIds.delete(chamado.tecnicoId ?? '');
    if (mencionadoIds.size > 0) {
      this.notificacaoService.criarParaUsuarios(
        Array.from(mencionadoIds), 'CHAMADO_ATUALIZADO',
        `Voce foi mencionado no chamado #${chamado.numero}`,
        `Voce foi mencionado em um comentario no chamado "${chamado.titulo}".`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Demais envolvidos (que nao foram mencionados nem receberam destacada)
    let idsComentario = destinatarios.filter((uid) => !mencionadoIds.has(uid));
    if (isSolicitarInfo) {
      idsComentario = idsComentario.filter((uid) => uid !== chamado.solicitanteId);
    }
    if (isRespostaSolicitante) {
      idsComentario = idsComentario.filter((uid) => uid !== chamado.tecnicoId);
    }
    if (idsComentario.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        idsComentario, 'CHAMADO_ATUALIZADO',
        `Novo comentario no chamado #${chamado.numero}`,
        `Novo comentario no chamado "${chamado.titulo}".`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Propagar para filhos (se este chamado for agrupador).
    // Apenas comentarios publicos sao propagados — comentario interno fica
    // restrito ao agrupador. Decidido em 13/05/2026 (item 3).
    if (historico.publico) {
      this.agrupamento.propagarComentario(id, dto.descricao, user).catch((err) =>
        console.error('Propagacao comentario error:', err.message),
      );
    }

    return historico;
  }

  async editarComentario(chamadoId: string, historicoId: string, descricao: string, user: JwtPayload, role: string) {
    const historico = await this.prisma.historicoChamado.findFirst({
      where: { id: historicoId, chamadoId, tipo: 'COMENTARIO' },
    });
    if (!historico) throw new NotFoundException('Comentario nao encontrado');

    // Somente o autor ou gestores pode editar
    if (historico.usuarioId !== user.sub && !isGestor(role)) {
      throw new ForbiddenException('Voce so pode editar seus proprios comentarios');
    }

    return this.prisma.historicoChamado.update({
      where: { id: historicoId },
      data: { descricao },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });
  }

  async resolver(id: string, dto: ResolverChamadoDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado ja encerrado');
    }

    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario assumir o chamado antes de finaliza-lo');
    }

    // Verificar se ha registro de tempo
    const totalRegistros = await this.prisma.registroTempoChamado.count({
      where: { chamadoId: id },
    });
    if (totalRegistros === 0) {
      throw new BadRequestException('E necessario iniciar o tempo de atendimento antes de finalizar o chamado');
    }

    // Encerrar todos os cronometros ativos
    const timersAtivos = await this.prisma.registroTempoChamado.findMany({
      where: { chamadoId: id, horaFim: null },
    });
    const agora = new Date();
    for (const timer of timersAtivos) {
      const duracao = Math.round((agora.getTime() - new Date(timer.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempoChamado.update({
        where: { id: timer.id },
        data: { horaFim: agora, duracaoMinutos: duracao },
      });
    }

    const dataResolucao = new Date();
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'RESOLVIDO', dataResolucao },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'RESOLVIDO',
        descricao: dto.descricao || 'Chamado finalizado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} finalizado`,
          `O chamado "${chamado.titulo}" foi finalizado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Cascata para filhos agrupados (decidido em 13/05/2026)
    this.agrupamento.cascataResolverFechar(id, 'RESOLVIDO', dataResolucao, user)
      .catch((err) => console.error('Cascata resolver error:', err.message));

    return updated;
  }

  async fechar(id: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status !== 'RESOLVIDO') {
      throw new BadRequestException('Apenas chamados resolvidos podem ser fechados');
    }

    const dataFechamento = new Date();
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'FECHADO', dataFechamento },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'FECHADO',
        descricao: 'Chamado fechado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Cascata para filhos agrupados (decidido em 13/05/2026)
    this.agrupamento.cascataResolverFechar(id, 'FECHADO', dataFechamento, user)
      .catch((err) => console.error('Cascata fechar error:', err.message));

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} fechado`,
          `O chamado "${chamado.titulo}" foi fechado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async reabrir(id: string, dto: ReabrirChamadoDto, user: JwtPayload, role: string) {
    // Solicitante tambem pode reabrir
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role, { permitirSolicitante: true });

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado cancelado nao pode ser reaberto');
    }
    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Apenas chamados resolvidos ou fechados podem ser reabertos');
    }

    // Se quem reabre e um tecnico de TI, ele automaticamente assume o chamado
    // USUARIO_CHAVE e TERCEIRIZADO nao auto-assumem
    const rolesNaoAssumem = ['USUARIO_FINAL', 'USUARIO_CHAVE', 'TERCEIRIZADO'];
    const isTecnicoTI = !rolesNaoAssumem.includes(role);
    const novoTecnicoId = isTecnicoTI ? user.sub : null;
    const novoStatus = isTecnicoTI ? 'EM_ATENDIMENTO' : 'REABERTO';

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        status: novoStatus,
        tecnicoId: novoTecnicoId,
        dataResolucao: null,
        dataFechamento: null,
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'REABERTO',
        descricao: dto.motivo || 'Chamado reaberto',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Se tecnico assumiu ao reabrir, criar historico de assumido tambem
    if (isTecnicoTI) {
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'ASSUMIDO',
          descricao: 'Chamado assumido ao reabrir',
          publico: true,
          chamadoId: id,
          usuarioId: user.sub,
        },
      });

      // Auto-iniciar cronometro ao assumir (fecha timers anteriores)
      await this.tempo.encerrarTimersAbertos(user.sub);
      await this.prisma.registroTempoChamado.create({
        data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
      });
    }

    // Notificar envolvidos (solicitante + tecnico anterior + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} reaberto`,
          `O chamado "${chamado.titulo}" foi reaberto.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async vincularProjeto(chamadoId: string, projetoId: string) {
    return this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { projetoId },
      select: { id: true, projetoId: true },
    });
  }

  async cancelar(id: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado ja encerrado');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'CANCELADO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'CANCELADO',
        descricao: 'Chamado cancelado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} cancelado`,
          `O chamado "${chamado.titulo}" foi cancelado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async avaliar(id: string, dto: CsatDto, user: JwtPayload) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.solicitanteId !== user.sub) {
      throw new ForbiddenException('Apenas o solicitante pode avaliar');
    }

    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Chamado precisa estar resolvido ou fechado para avaliar');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        notaSatisfacao: dto.nota,
        comentarioSatisfacao: dto.comentario,
      },
      include: chamadoInclude,
    });

    // Historico de avaliacao
    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'AVALIADO',
        descricao: `Avaliacao: ${dto.nota}/5${dto.comentario ? ` - "${dto.comentario}"` : ''}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} avaliado`,
          `O chamado "${chamado.titulo}" recebeu avaliacao ${dto.nota}/5.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async excluir(id: string, user: JwtPayload, role: string) {
    const rolesPermitidas = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
    if (!rolesPermitidas.includes(role)) {
      throw new ForbiddenException('Sem permissao para excluir chamados');
    }

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status !== 'ABERTO') {
      throw new BadRequestException('Somente chamados com status ABERTO podem ser excluidos');
    }

    // Remover anexos do disco
    const anexos = await this.prisma.anexoChamado.findMany({ where: { chamadoId: id } });
    const uploadsDir = path.join(process.cwd(), 'uploads', 'chamados');
    for (const anexo of anexos) {
      const filePath = path.join(uploadsDir, anexo.nomeArquivo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Deletar registros dependentes e o chamado (cascade cuida de historicos, anexos, colaboradores, registros tempo)
    await this.prisma.chamado.delete({ where: { id } });

    return { deleted: true, numero: chamado.numero };
  }
}
