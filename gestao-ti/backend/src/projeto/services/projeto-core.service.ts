import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProjetoDto } from '../dto/create-projeto.dto.js';
import { UpdateProjetoDto } from '../dto/update-projeto.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { projetoListInclude, projetoDetailInclude } from './projeto.constants.js';
import { isGestor, isTI, hasStaffPerfilEmTI, getDeptosOndeStaff } from '../../common/constants/roles.constant.js';
import { ROLES_EXTERNOS } from '../../common/constants/roles.constant.js';
import { paginate } from '../../common/prisma/paginate.helper.js';
import { resolveDepartamento } from '../../common/helpers/resolve-departamento.helper.js';
import { getDeptoIdsDoUser, assertDepartamentoDoUser } from '../../common/helpers/departamento-filter.helper.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { Prisma } from '@prisma/client';

/** Origem de um match da busca profunda em Projeto (PR3) — badge + snippet. */
interface BuscaMatchProjeto {
  campo: 'atividade' | 'comentario' | 'pendencia';
  trecho: string;
}

/**
 * Janela de ~`contexto` chars em volta da 1ª ocorrência do termo, com
 * reticências nas pontas. O frontend destaca o termo dentro do trecho.
 */
function extrairTrecho(texto: string, termo: string, contexto = 60): string {
  const idx = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (idx < 0) {
    return texto.length > contexto * 2 ? texto.slice(0, contexto * 2) + '…' : texto;
  }
  const ini = Math.max(0, idx - contexto);
  const fim = Math.min(texto.length, idx + termo.length + contexto);
  return (ini > 0 ? '…' : '') + texto.slice(ini, fim) + (fim < texto.length ? '…' : '');
}

/** Dado titulo + descricao, devolve o campo que contém o termo (p/ o snippet). */
function campoComTermo(titulo: string, descricao: string | null, termo: string): string {
  const t = termo.toLowerCase();
  if (titulo.toLowerCase().includes(t)) return titulo;
  if (descricao && descricao.toLowerCase().includes(t)) return descricao;
  return descricao || titulo;
}

@Injectable()
export class ProjetoCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
    private readonly notificacaoService: NotificacaoService,
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
    page?: number;
    pageSize?: number;
    user?: JwtPayload;
    // S15.2 (25/05) — workspace ATIVO da sessão (header X-Workspace-Id).
    workspaceAtivoId?: string | null;
  }) {
    const where: Record<string, unknown> = {};
    // Termo de busca — no escopo do metodo: o filtro "Meus Projetos" e o
    // enriquecimento pos-query (anexarMatchProjeto) tambem usam.
    const searchTerm = filters.search?.trim();

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
    // Ambos compartilham `usuariosChave` desde 13/05/2026.
    if ((filters.role === 'USUARIO_CHAVE' || filters.role === 'TERCEIRIZADO') && filters.usuarioId) {
      where.usuariosChave = { some: { usuarioId: filters.usuarioId, ativo: true } };
    } else if (filters.meusProjetos === 'true' && filters.usuarioId && !searchTerm) {
      // `!searchTerm`: com termo digitado a busca e GLOBAL (decisao 22/05) —
      // ignora "Meus Projetos" p/ achar o termo em qualquer projeto. A
      // restricao de seguranca de USUARIO_CHAVE/TERCEIRIZADO (acima) segue.
      where.OR = [
        { responsavelId: filters.usuarioId },
        { membros: { some: { usuarioId: filters.usuarioId } } },
      ];
    }

    // Busca: nome + descricao do projeto + busca profunda nas atividades,
    // comentarios de tarefa e pendencias (PR3 — pg_trgm). `comentVisib`
    // reusado no enriquecimento pos-query (anexarMatchProjeto).
    // Visibilidade D29: comentario de tarefa interno (publica=false) so casa
    // p/ staff TI — sem isto a busca varreria nota interna (vazamento).
    // S13a (25/05) — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    // Multi-perfil (Juliana) precisa ser detectado pelo JWT.departamentos[].
    const comentVisib: Prisma.ComentarioTarefaWhereInput = hasStaffPerfilEmTI(filters.user)
      ? {}
      : { publica: true };

    if (searchTerm) {
      const contains = { contains: searchTerm, mode: 'insensitive' as const };
      const searchCondition = [
        { nome: contains },
        { descricao: contains },
        // Atividade do projeto: titulo OU descricao.
        { atividades: { some: { OR: [{ titulo: contains }, { descricao: contains }] } } },
        // Comentario de tarefa (texto) — visibilidade D29 via comentVisib.
        { atividades: { some: { comentarios: { some: { texto: contains, ...comentVisib } } } } },
        // Pendencia do projeto: titulo OU descricao.
        { pendencias: { some: { OR: [{ titulo: contains }, { descricao: contains }] } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchCondition }];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    // Workspace Onda 2 C2.10 (25/05) — análogo ao C2.9 dos chamados.
    // S13a (25/05) refino — depto-dono restrito a deptos onde user é staff
    // (não todos deptos do perfil). Antes Juliana (USUARIO_FINAL/T.I.) via
    // todos os projetos de T.I. via departamentoId IN [T.I., CTL]; agora só
    // vê via responsavel/membro/usuárioChave pra T.I. (mas vê todos de CTL
    // onde é GESTOR).
    const deptoIds = getDeptoIdsDoUser(filters.user, filters.role);
    const deptosStaff = getDeptosOndeStaff(filters.user);
    const isUCouTerc = filters.role === 'USUARIO_CHAVE' || filters.role === 'TERCEIRIZADO';
    let whereFiltrado: Record<string, unknown> = where;
    if (deptoIds !== null && !isUCouTerc) {
      const userId = filters.usuarioId ?? '';
      whereFiltrado = {
        AND: [
          where,
          {
            OR: [
              ...(deptosStaff.length > 0 ? [{ departamentoId: { in: deptosStaff } }] : []),
              { responsavelId: userId },
              { membros: { some: { usuarioId: userId } } },
              { usuariosChave: { some: { usuarioId: userId, ativo: true } } },
            ],
          },
        ],
      };
    } else if (deptoIds !== null && isUCouTerc) {
      // Mantém o filtro de depto pra USUARIO_CHAVE/TERC (escopa workspace).
      whereFiltrado = { AND: [where, { departamentoId: { in: deptoIds } }] };
    }

    // S15.2 — Intersect com workspace ATIVO (sem ativo: fallback S13a).
    const whereFinal = filters.workspaceAtivoId
      ? { AND: [whereFiltrado, { departamentoId: filters.workspaceAtivoId }] }
      : whereFiltrado;

    const resultado = await paginate(this.prisma, this.prisma.projeto, {
      where: whereFinal,
      include: projetoListInclude,
      orderBy: { numero: 'desc' },
      page: filters.page,
      pageSize: filters.pageSize,
    });
    if (!searchTerm) return resultado;
    // Enriquecimento pos-busca: anexa a origem do match (badge + snippet).
    resultado.items = await this.anexarMatchProjeto(
      resultado.items as { id: string }[],
      searchTerm,
      comentVisib,
    );
    return resultado;
  }

  /**
   * Enriquecimento pos-busca profunda (PR3): para os projetos da pagina,
   * anexa `buscaMatch` quando o termo casou numa atividade, comentario de
   * tarefa ou pendencia — com o trecho para o badge + snippet do frontend.
   * 3 queries (uma por fonte), todas com IN dos ids da pagina e aceleradas
   * pelos indices GIN trgm do PR1. Prioridade do snippet: atividade >
   * comentario > pendencia (qualquer um serve — so decide qual trecho mostrar).
   */
  private async anexarMatchProjeto(
    items: { id: string }[],
    termo: string,
    comentVisib: Prisma.ComentarioTarefaWhereInput,
  ): Promise<unknown[]> {
    if (items.length === 0) return items;
    const ids = items.map((p) => p.id);
    const contains = { contains: termo, mode: 'insensitive' as const };
    const [atividades, comentarios, pendencias] = await this.prisma.$transaction([
      this.prisma.atividadeProjeto.findMany({
        where: { projetoId: { in: ids }, OR: [{ titulo: contains }, { descricao: contains }] },
        select: { projetoId: true, titulo: true, descricao: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.comentarioTarefa.findMany({
        where: { texto: contains, ...comentVisib, atividade: { projetoId: { in: ids } } },
        select: { texto: true, atividade: { select: { projetoId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pendenciaProjeto.findMany({
        where: { projetoId: { in: ids }, OR: [{ titulo: contains }, { descricao: contains }] },
        select: { projetoId: true, titulo: true, descricao: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    // 1 match por projeto (prioridade atividade > comentario > pendencia).
    const matches = new Map<string, BuscaMatchProjeto>();
    for (const a of atividades) {
      if (!matches.has(a.projetoId)) {
        matches.set(a.projetoId, {
          campo: 'atividade',
          trecho: extrairTrecho(campoComTermo(a.titulo, a.descricao, termo), termo),
        });
      }
    }
    for (const c of comentarios) {
      const pid = c.atividade?.projetoId;
      if (pid && !matches.has(pid)) {
        matches.set(pid, { campo: 'comentario', trecho: extrairTrecho(c.texto, termo) });
      }
    }
    for (const p of pendencias) {
      if (!matches.has(p.projetoId)) {
        matches.set(p.projetoId, {
          campo: 'pendencia',
          trecho: extrairTrecho(campoComTermo(p.titulo, p.descricao, termo), termo),
        });
      }
    }
    return items.map((p) => {
      const m = matches.get(p.id);
      return m ? { ...p, buscaMatch: m } : p;
    });
  }

  async findOne(id: string, user?: JwtPayload, role?: string) {
    // S13a — `user` substitui `userId` p/ propagar hasStaffPerfilEmTI ao helper.
    const userId = user?.sub;
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      include: projetoDetailInclude,
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    // Validar acesso para USUARIO_CHAVE e TERCEIRIZADO
    if (user && role) {
      await this.helpers.checkProjetoAccessChave(id, user, role);

      // 29/05 — avaliar role no DEPTO DO PROJETO (não a role principal).
      // Multi-perfil GESTOR/Fiscal + USUARIO_CHAVE/T.I. acessando projeto T.I.:
      // role principal = GESTOR; role no depto do projeto = USUARIO_CHAVE.
      // Sem isso, o filtro de subprojetos abaixo não dispara → vazamento.
      const roleNoDeptoProjeto = user.modulos
        ?.find((m) => m.codigo === 'WORKSPACE')
        ?.departamentos?.find((d) => d.id === projeto.departamentoId)?.role;
      const roleEfetiva = roleNoDeptoProjeto ?? role;

      // Filtrar subProjetos pelos quais o usuario esta vinculado
      if (roleEfetiva === 'USUARIO_CHAVE' || roleEfetiva === 'TERCEIRIZADO') {
        const subProjetosVinculados = await this.getSubProjetosVinculados(
          projeto.subProjetos.map((s) => s.id),
          userId!,  // user existe (guard `if(user && role)` acima)
          roleEfetiva,
        );
        projeto.subProjetos = projeto.subProjetos.filter((s) =>
          subProjetosVinculados.includes(s.id),
        );
      }
    }

    // Calcular se usuario e membro/responsavel do projeto.
    // 29/05 — roleEfetiva (role NO DEPTO DO PROJETO) substitui role principal.
    // Multi-perfil GESTOR/Fiscal + UC/T.I. NÃO deve receber isMembro=true em
    // projeto T.I. só porque a role principal é GESTOR (ela é UC nesse depto).
    // Memory feedback_workspace_role_por_depto. Já computamos `roleEfetiva`
    // alguns blocos acima (no filtro de subprojetos) — vamos recomputar aqui
    // por clareza local; fallback p/ `role` se sem user/projeto.
    let isMembro = false;
    if (userId) {
      const roleEfetivaParaIsMembro = user?.modulos
        ?.find((m) => m.codigo === 'WORKSPACE')
        ?.departamentos?.find((d) => d.id === projeto.departamentoId)?.role
        ?? role
        ?? '';
      if (isGestor(roleEfetivaParaIsMembro)) {
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
   * Retorna IDs dos sub-projetos aos quais o usuario esta vinculado.
   * USUARIO_CHAVE e TERCEIRIZADO compartilham `usuarioChaveProjeto` desde 13/05/2026.
   */
  private async getSubProjetosVinculados(subProjetoIds: string[], userId: string, role: string): Promise<string[]> {
    if (subProjetoIds.length === 0) return [];

    if (role === 'USUARIO_CHAVE' || role === 'TERCEIRIZADO') {
      const vinculos = await this.prisma.usuarioChaveProjeto.findMany({
        where: { projetoId: { in: subProjetoIds }, usuarioId: userId, ativo: true },
        select: { projetoId: true },
      });
      return vinculos.map((v) => v.projetoId);
    }

    return [];
  }

  async create(dto: CreateProjetoDto, userId?: string, role?: string, user?: JwtPayload) {
    // === Workspace Multi-Depto (fix bug 29/05 — Tatiane GESTOR/Fiscal) ===
    // A role do user VARIA por depto (ex.: GESTOR no Fiscal + USUARIO_CHAVE em T.I.).
    // Antes da Onda 1, T.I. era o único workspace e a `role` (principal do JWT)
    // bastava. Agora precisamos avaliar a role NO DEPTO DA OPERAÇÃO antes de
    // decidir se ela conta como "externa". Caso contrário, GESTOR num workspace
    // não-T.I. seria bloqueado por causa do papel USUARIO_CHAVE em outro workspace.
    let deptoAlvo: string | null = null;
    let paiCache: { departamentoId: string; nivel: number; contratoId: string | null } | null = null;
    if (dto.projetoPaiId) {
      const pai = await this.prisma.projeto.findUnique({
        where: { id: dto.projetoPaiId },
        select: { departamentoId: true, nivel: true, contratoId: true },
      });
      if (!pai) throw new NotFoundException('Projeto pai nao encontrado');
      paiCache = pai;
      deptoAlvo = pai.departamentoId;
    } else if (user) {
      deptoAlvo = await resolveDepartamento(this.prisma, user, 'WORKSPACE', dto.departamentoId);
    }
    const roleNoDepto = deptoAlvo
      ? user?.modulos?.find((m) => m.codigo === 'WORKSPACE')
          ?.departamentos?.find((d) => d.id === deptoAlvo)?.role
      : undefined;
    // Fallback p/ role principal preserva compat com JWT pré-Onda 1.4 (sem departamentos[]).
    const roleEfetiva = roleNoDepto ?? role;
    const isExterno = roleEfetiva && (ROLES_EXTERNOS as readonly string[]).includes(roleEfetiva);

    // Roles externos so podem criar subprojetos (exigem projetoPaiId)
    if (isExterno) {
      if (!dto.projetoPaiId) {
        throw new ForbiddenException('Usuarios externos so podem criar sub-projetos');
      }
      // S13a — usar `user` (mais completo) ao invés de userId.
      // roleEfetiva aqui é a role no depto-alvo (que = pai.departamentoId pra subprojeto)
      await this.helpers.checkProjetoAccessChave(dto.projetoPaiId, user!, roleEfetiva!);
    }

    let nivel = 1;
    let contratoId = dto.contratoId;

    if (dto.projetoPaiId) {
      // Reusa paiCache resolvido acima (poupa 1 query).
      const pai = paiCache!;
      // Hierarquia limitada a 2 niveis (PROJETO + SUBPROJETO) — decisao 26/04/2026.
      // Razao: simplifica indicadores, navegacao e modelo mental. Casos N3 existentes
      // continuam funcionais (apenas novas criacoes sao bloqueadas).
      if (pai.nivel >= 2) {
        throw new BadRequestException('Hierarquia limitada a 2 niveis: PROJETO e SUBPROJETO. Nao e permitido criar subprojeto de subprojeto.');
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

    // Roles externos: forcar tipo STAKEHOLDER e responsavel = usuario logado
    const tipo = isExterno ? 'STAKEHOLDER' : dto.tipo;
    const responsavelId = isExterno ? userId! : dto.responsavelId;

    // FKs validadas explicitamente para evitar P2003 (FK violation) virar 500
    // generico. Cenario real: incidente 12/05/2026 com julianamarques — frontend
    // mandou tipoProjetoId stale (do DEV) que nao existia em HOM, gerando 500
    // sem mensagem util pro operador.
    if (dto.tipoProjetoId) {
      const tp = await this.prisma.tipoProjetoConfig.findUnique({ where: { id: dto.tipoProjetoId } });
      if (!tp) throw new NotFoundException('Tipo de projeto nao encontrado');
    }
    if (responsavelId) {
      const resp = await this.prisma.usuario.findUnique({ where: { id: responsavelId } });
      if (!resp) throw new NotFoundException('Usuario responsavel nao encontrado');
    }

    // Onda 1 Sub-fase 1.6.1 — D14 subprojeto herda do pai;
    // se projeto novo (sem pai), resolveDepartamento em cascata.
    // Já calculado em `deptoAlvo` no topo da função (fix 29/05 evita query dupla
    // do pai e garante mesmo depto pra checagem de role e pra persistência).
    const departamentoId: string = deptoAlvo!;
    // Onda 3 S10 fix (ultrareview bug_011) — gate IDOR cross-depto pra
    // projetos NOVOS (sem pai). Subprojetos herdam do pai (resolveDepartamento
    // não foi chamado, mas o depto vem do pai — caminho seguro por construção).
    if (!dto.projetoPaiId && user) {
      assertDepartamentoDoUser(user, null, departamentoId);
    }

    const projeto = await this.prisma.projeto.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        tipo,
        modo: dto.modo || 'COMPLETO',
        nivel,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : undefined,
        custoPrevisto: dto.custoPrevisto,
        observacoes: dto.observacoes,
        projetoPaiId: dto.projetoPaiId,
        softwareId: isExterno ? undefined : dto.softwareId,
        contratoId: isExterno ? undefined : contratoId,
        responsavelId,
        tipoProjetoId: dto.tipoProjetoId || undefined,
        departamentoId,
      },
      include: projetoDetailInclude,
    });

    // Vincular o criador externo ao subprojeto.
    // USUARIO_CHAVE e TERCEIRIZADO compartilham UsuarioChaveProjeto desde 13/05/2026.
    if (isExterno && userId) {
      const funcao = role === 'TERCEIRIZADO' ? 'Analista' : 'Responsavel';
      await this.prisma.usuarioChaveProjeto.create({
        data: { projetoId: projeto.id, usuarioId: userId, funcao, ativo: true },
      }).catch(() => {}); // ignora se ja existe
    }

    // Workspace Onda 2 (25/05) — garante consistência responsável ↔ usuarios-chave.
    // Antes desta data, projetos criados por staff (não-externo) deixavam
    // a aba Usuários-Chave vazia mesmo com responsavel_id definido. Agora
    // SEMPRE que tem responsável definido, garante entrada ativa com
    // função "Responsavel". Idempotente via upsert (PK composta).
    if (responsavelId && !isExterno) {
      await this.prisma.usuarioChaveProjeto
        .upsert({
          where: { projetoId_usuarioId: { projetoId: projeto.id, usuarioId: responsavelId } },
          create: { projetoId: projeto.id, usuarioId: responsavelId, funcao: 'Responsavel', ativo: true },
          update: { ativo: true },
        })
        .catch(() => {}); // não bloqueia o create — só tenta espelhar.
    }

    return projeto;
  }

  /**
   * Transições de status do ciclo HOM → PROD (29/04/2026):
   *   EM_ANDAMENTO → EM_HOMOLOGACAO → LIBERADO_PARA_PRODUCAO → CONCLUIDO
   *
   * Cada transição é endpoint dedicado pra:
   *  - Validação explícita de status de origem
   *  - Notificação direcionada (público diferente em cada etapa)
   *  - Auditoria clara no histórico (vs update genérico)
   *
   * Permissão: ADMIN/GESTOR_TI sempre; SUPORTE_TI se for membro do projeto.
   * Verificação feita pelo controller via `assertMembroOuGestor`.
   */

  async liberarHomologacao(id: string, userId: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      select: this.transicaoSelect,
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');
    if (projeto.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException(
        `Transicao invalida: projeto deve estar EM_ANDAMENTO para liberar para homologacao (status atual: ${projeto.status}).`,
      );
    }
    const atualizado = await this.prisma.projeto.update({
      where: { id },
      data: { status: 'EM_HOMOLOGACAO' },
      include: projetoDetailInclude,
    });
    this.notificarTransicao(
      projeto,
      userId,
      `🧪 Projeto #${projeto.numero} disponivel para validacao em HOM`,
      `O projeto "${projeto.nome}" foi liberado para validacao em ambiente de homologacao. Valide antes de aprovar o envio para producao.`,
    );
    return atualizado;
  }

  async liberarProducao(id: string, userId: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      select: this.transicaoSelect,
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');
    if (projeto.status !== 'EM_HOMOLOGACAO') {
      throw new BadRequestException(
        `Transicao invalida: projeto deve estar EM_HOMOLOGACAO para liberar para producao (status atual: ${projeto.status}).`,
      );
    }
    const atualizado = await this.prisma.projeto.update({
      where: { id },
      data: { status: 'LIBERADO_PARA_PRODUCAO' },
      include: projetoDetailInclude,
    });
    this.notificarTransicao(
      projeto,
      userId,
      `🚀 Projeto #${projeto.numero} liberado para PRODUCAO`,
      `O projeto "${projeto.nome}" foi validado em HOM e esta liberado para a equipe Protheus aplicar em producao.`,
    );
    return atualizado;
  }

  async concluirProducao(id: string, userId: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      select: this.transicaoSelect,
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');
    if (projeto.status !== 'LIBERADO_PARA_PRODUCAO') {
      throw new BadRequestException(
        `Transicao invalida: projeto deve estar LIBERADO_PARA_PRODUCAO para concluir (status atual: ${projeto.status}).`,
      );
    }
    const atualizado = await this.prisma.projeto.update({
      where: { id },
      data: { status: 'CONCLUIDO', dataFimReal: new Date() },
      include: projetoDetailInclude,
    });
    this.notificarTransicao(
      projeto,
      userId,
      `✅ Projeto #${projeto.numero} concluido em PRODUCAO`,
      `O projeto "${projeto.nome}" foi aplicado em producao e esta concluido.`,
    );
    return atualizado;
  }

  async voltarParaAndamento(id: string, userId: string, motivo?: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      select: this.transicaoSelect,
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');
    if (projeto.status !== 'EM_HOMOLOGACAO' && projeto.status !== 'LIBERADO_PARA_PRODUCAO') {
      throw new BadRequestException(
        `Transicao invalida: projeto deve estar EM_HOMOLOGACAO ou LIBERADO_PARA_PRODUCAO para voltar a EM_ANDAMENTO (status atual: ${projeto.status}).`,
      );
    }
    const atualizado = await this.prisma.projeto.update({
      where: { id },
      data: { status: 'EM_ANDAMENTO' },
      include: projetoDetailInclude,
    });
    const motivoTrecho = motivo ? ` Motivo: ${motivo}` : '';
    this.notificarTransicao(
      projeto,
      userId,
      `↩ Projeto #${projeto.numero} voltou para EM ANDAMENTO`,
      `O projeto "${projeto.nome}" foi reaberto para correcoes/ajustes.${motivoTrecho}`,
    );
    return atualizado;
  }

  /** Select compartilhado pelos métodos de transição — só os campos necessários
   *  para validação + notificação. Evita carregar relations grandes. */
  private readonly transicaoSelect = {
    id: true,
    numero: true,
    nome: true,
    status: true,
    responsavelId: true,
    membros: { select: { usuarioId: true } },
    usuariosChave: { where: { ativo: true }, select: { usuarioId: true } },
  } as const;

  /** Notifica todos os envolvidos no projeto (responsável, membros,
   *  usuários-chave ativos), exceto quem disparou a ação. */
  private notificarTransicao(
    projeto: {
      id: string;
      responsavelId: string;
      membros: { usuarioId: string }[];
      usuariosChave: { usuarioId: string }[];
    },
    autorId: string,
    titulo: string,
    mensagem: string,
  ) {
    const ids = new Set<string>();
    if (projeto.responsavelId) ids.add(projeto.responsavelId);
    for (const m of projeto.membros) ids.add(m.usuarioId);
    for (const uc of projeto.usuariosChave) ids.add(uc.usuarioId);
    ids.delete(autorId);
    if (ids.size === 0) return;
    this.notificacaoService.criarParaUsuarios(
      Array.from(ids),
      'PROJETO_ATUALIZADO',
      titulo,
      mensagem,
      { projetoId: projeto.id },
    ).catch((err) => console.error('Notificacao error:', err.message));
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

    const atualizado = await this.prisma.projeto.update({
      where: { id },
      data,
      include: projetoDetailInclude,
    });

    // Workspace Onda 2 (25/05) — sincroniza responsavel ↔ usuarios-chave.
    // Quando o responsavelId muda (ou é definido pela primeira vez),
    // garante entrada ativa em `usuarios_chave_projeto`. NÃO desativa o
    // responsável anterior — ele pode continuar como stakeholder se quiser
    // (admin decide manualmente via aba Usuários-Chave).
    if (
      dto.responsavelId !== undefined &&
      dto.responsavelId &&
      dto.responsavelId !== projeto.responsavelId
    ) {
      await this.prisma.usuarioChaveProjeto
        .upsert({
          where: { projetoId_usuarioId: { projetoId: id, usuarioId: dto.responsavelId } },
          create: { projetoId: id, usuarioId: dto.responsavelId, funcao: 'Responsavel', ativo: true },
          update: { ativo: true },
        })
        .catch(() => {});
    }

    return atualizado;
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
        pendencias: { include: { interacoes: true } },
      },
    });
    if (!original) throw new NotFoundException('Projeto nao encontrado');

    // Criar projeto duplicado
    // Onda 1 Sub-fase 1.1 — duplicata herda departamentoId do original.
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
        departamentoId: original.departamentoId,
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
