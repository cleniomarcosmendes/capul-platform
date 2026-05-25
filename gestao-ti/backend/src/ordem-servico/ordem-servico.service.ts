import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOsDto } from './dto/create-os.dto.js';
import { UpdateOsDto } from './dto/update-os.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusOS } from '@prisma/client';
import { isGestor, hasStaffPerfilEmTI, getDeptosOndeStaff } from '../common/constants/roles.constant.js';
import { paginate } from '../common/prisma/paginate.helper.js';
import { resolveDepartamento } from '../common/helpers/resolve-departamento.helper.js';
import { getDeptoIdsDoUser, assertDepartamentoDoUser } from '../common/helpers/departamento-filter.helper.js';
import { hasCapability } from '../common/helpers/capability.helper.js';

const osListInclude = {
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  solicitante: { select: { id: true, nome: true, username: true } },
  tecnicos: {
    include: { tecnico: { select: { id: true, nome: true, username: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  chamados: {
    include: { chamado: { select: { id: true, numero: true, titulo: true, status: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  historicos: {
    include: { usuario: { select: { id: true, nome: true, username: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { chamados: true, tecnicos: true } },
};

@Injectable()
export class OrdemServicoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    status?: StatusOS,
    filialId?: string,
    page?: number,
    pageSize?: number,
    user?: JwtPayload,
    role?: string,
    workspaceAtivoId?: string | null,
  ) {
    const where: Record<string, unknown> = {
      ...(status ? { status } : {}),
      ...(filialId ? { filialId } : {}),
    };
    // Workspace Onda 2 C2.7 + refino S14.2 (25/05) — análogo a projeto/chamado:
    // visão "ampla por depto" só pra deptos onde o user é STAFF. Pra Juliana
    // (USUARIO_FINAL/T.I. + GESTOR/CTL): vê todas OSs de CTL via depto + suas
    // OSs em TI (como solicitante OU técnica). Sem este refino, ela via TODAS
    // OSs de TI também por causa do perfil USUARIO_FINAL/T.I.
    const deptoIds = getDeptoIdsDoUser(user, role);
    const deptosStaff = getDeptosOndeStaff(user);
    const whereFiltrado: Record<string, unknown> =
      deptoIds === null
        ? where
        : {
            AND: [
              where,
              {
                OR: [
                  { solicitanteId: user?.sub ?? '' },
                  { tecnicos: { some: { tecnicoId: user?.sub ?? '' } } },
                  ...(deptosStaff.length > 0 ? [{ departamentoId: { in: deptosStaff } }] : []),
                ],
              },
            ],
          };
    // S15.2 — Intersect com workspace ATIVO (sem ativo: fallback S14.2).
    const whereFinal = workspaceAtivoId
      ? { AND: [whereFiltrado, { departamentoId: workspaceAtivoId }] }
      : whereFiltrado;

    return paginate(this.prisma, this.prisma.ordemServico, {
      where: whereFinal,
      include: osListInclude,
      orderBy: { createdAt: 'desc' },
      page,
      pageSize,
    });
  }

  async findOne(id: string) {
    const os = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: osListInclude,
    });
    if (!os) throw new NotFoundException('Ordem de servico nao encontrada');
    return os;
  }

  async create(dto: CreateOsDto, user: JwtPayload) {
    // Onda 1 Sub-fase 1.6.1 — resolveDepartamento em cascata.
    const departamentoId = await resolveDepartamento(
      this.prisma,
      user,
      'WORKSPACE',
      dto.departamentoId,
    );

    // Onda 3 S10 fix (ultrareview bug_011) — gate IDOR cross-depto.
    assertDepartamentoDoUser(user, null, departamentoId);

    const os = await this.prisma.ordemServico.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        filialId: dto.filialId,
        solicitanteId: user.sub,
        dataAgendamento: dto.dataAgendamento ? new Date(dto.dataAgendamento) : null,
        observacoes: dto.observacoes,
        departamentoId,
        tecnicos: dto.tecnicoId
          ? { create: { tecnicoId: dto.tecnicoId } }
          : undefined,
      },
      include: osListInclude,
    });
    return os;
  }

  async update(id: string, dto: UpdateOsDto, userId?: string, role?: string, user?: JwtPayload) {
    if (userId && role) await this.assertAlocadoOuGestor(id, userId, role, user);
    await this.findOne(id);
    return this.prisma.ordemServico.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        dataAgendamento: dto.dataAgendamento ? new Date(dto.dataAgendamento) : undefined,
        observacoes: dto.observacoes,
      },
      include: osListInclude,
    });
  }

  // --- Workflow: Iniciar / Encerrar / Cancelar ---

  async iniciar(id: string, userId?: string, role?: string, user?: JwtPayload) {
    if (userId && role) await this.assertAlocadoOuGestor(id, userId, role, user);
    const os = await this.findOne(id);
    if (os.status !== 'ABERTA') throw new BadRequestException('Somente OS com status ABERTA pode ser iniciada');
    if (os.tecnicos.length === 0) throw new BadRequestException('Adicione pelo menos um tecnico antes de iniciar');
    const updated = await this.prisma.ordemServico.update({
      where: { id },
      data: { status: 'EM_EXECUCAO', dataInicio: new Date() },
      include: osListInclude,
    });
    if (userId) await this.registrarHistorico(id, 'INICIADA', 'Execucao iniciada', userId);
    return updated;
  }

  async encerrar(id: string, observacoes?: string, userId?: string, role?: string, user?: JwtPayload) {
    if (userId && role) await this.assertAlocadoOuGestor(id, userId, role, user);
    const os = await this.findOne(id);
    if (os.status !== 'EM_EXECUCAO') throw new BadRequestException('Somente OS em execucao pode ser encerrada');

    const statusFinalizados = ['RESOLVIDO', 'FECHADO', 'CANCELADO'];
    const chamadosAbertos = os.chamados.filter(
      (oc) => !statusFinalizados.includes(oc.chamado.status),
    );
    if (chamadosAbertos.length > 0) {
      const nums = chamadosAbertos.map((oc) => `#${oc.chamado.numero}`).join(', ');
      throw new BadRequestException(
        `Nao e possivel encerrar a OS. Os chamados ${nums} ainda estao em aberto. Desvincule ou finalize-os antes de encerrar.`,
      );
    }

    const updated = await this.prisma.ordemServico.update({
      where: { id },
      data: {
        status: 'CONCLUIDA',
        dataFim: new Date(),
        observacoes: observacoes || os.observacoes,
      },
      include: osListInclude,
    });
    if (userId) await this.registrarHistorico(id, 'CONCLUIDA', observacoes || 'OS concluida', userId);
    return updated;
  }

  async cancelar(id: string, userId?: string, role?: string, user?: JwtPayload) {
    if (userId && role) await this.assertAlocadoOuGestor(id, userId, role, user);
    const os = await this.findOne(id);
    if (['CONCLUIDA', 'CANCELADA'].includes(os.status)) throw new BadRequestException('OS ja encerrada');
    const updated = await this.prisma.ordemServico.update({
      where: { id },
      data: { status: 'CANCELADA', dataFim: os.status === 'EM_EXECUCAO' ? new Date() : undefined },
      include: osListInclude,
    });
    if (userId) await this.registrarHistorico(id, 'CANCELADA', 'OS cancelada', userId);
    return updated;
  }

  // --- Chamados N:N ---

  async vincularChamado(osId: string, chamadoId: string, userId?: string, role?: string, user?: JwtPayload) {
    if (userId && role) await this.assertAlocadoOuGestor(osId, userId, role, user);
    await this.findOne(osId);
    const chamado = await this.prisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamado) throw new BadRequestException('Chamado nao encontrado');
    try {
      await this.prisma.osChamado.create({ data: { osId, chamadoId } });
    } catch {
      throw new BadRequestException('Chamado ja vinculado a esta OS');
    }
    return this.findOne(osId);
  }

  async desvincularChamado(osId: string, chamadoId: string, userId?: string, role?: string, user?: JwtPayload) {
    if (userId && role) await this.assertAlocadoOuGestor(osId, userId, role, user);
    const item = await this.prisma.osChamado.findUnique({
      where: { osId_chamadoId: { osId, chamadoId } },
    });
    if (!item) throw new NotFoundException('Vinculo nao encontrado');
    await this.prisma.osChamado.delete({ where: { id: item.id } });
    return this.findOne(osId);
  }

  // --- Tecnicos N:N ---

  async adicionarTecnico(osId: string, tecnicoId: string) {
    await this.findOne(osId);
    const user = await this.prisma.usuario.findUnique({ where: { id: tecnicoId } });
    if (!user) throw new BadRequestException('Usuario nao encontrado');
    try {
      await this.prisma.osTecnico.create({ data: { osId, tecnicoId } });
    } catch {
      throw new BadRequestException('Tecnico ja vinculado a esta OS');
    }
    return this.findOne(osId);
  }

  async removerTecnico(osId: string, tecnicoId: string) {
    const item = await this.prisma.osTecnico.findUnique({
      where: { osId_tecnicoId: { osId, tecnicoId } },
    });
    if (!item) throw new NotFoundException('Vinculo nao encontrado');
    await this.prisma.osTecnico.delete({ where: { id: item.id } });
    return this.findOne(osId);
  }

  async comentar(osId: string, descricao: string, userId: string, role?: string, user?: JwtPayload) {
    if (role) await this.assertAlocadoOuGestor(osId, userId, role, user);
    await this.getOsOrFail(osId);
    await this.prisma.historicoOrdemServico.create({
      data: { tipo: 'COMENTARIO', descricao, osId, usuarioId: userId },
    });
    return this.findOne(osId);
  }

  async editarComentario(osId: string, historicoId: string, descricao: string, userId: string, role: string, user?: JwtPayload) {
    const historico = await this.prisma.historicoOrdemServico.findFirst({
      where: { id: historicoId, osId, tipo: 'COMENTARIO' },
    });
    if (!historico) throw new NotFoundException('Comentario nao encontrado');

    // S14.2 — `hasStaffPerfilEmTI(user)` substitui `isGestor(role)` quando
    // disponível. Sem user (legacy), cai no antigo (preserva retrocompat).
    const isAdmin = user ? hasStaffPerfilEmTI(user) : isGestor(role);
    if (historico.usuarioId !== userId && !isAdmin) {
      throw new ForbiddenException('Voce so pode editar seus proprios comentarios');
    }

    await this.prisma.historicoOrdemServico.update({
      where: { id: historicoId },
      data: { descricao },
    });
    return this.findOne(osId);
  }

  async registrarHistorico(osId: string, tipo: string, descricao: string, userId: string) {
    await this.prisma.historicoOrdemServico.create({
      data: { tipo, descricao, osId, usuarioId: userId },
    });
  }

  private async getOsOrFail(id: string) {
    const os = await this.prisma.ordemServico.findUnique({ where: { id } });
    if (!os) throw new NotFoundException('Ordem de servico nao encontrada');
    return os;
  }

  /**
   * Verifica se o usuario pode editar/operar a OS.
   *
   * S14.2 (25/05) — antes era `isGestor(role)` → qualquer GESTOR passava
   * (incluso GESTOR de outro depto, como Juliana GESTOR/CTL podendo mexer
   * em OS de TI). Agora: solicitante OU técnico OU staff do depto da OS
   * OU OVERSIGHT. Mantém retrocompat aceitando `user` opcional — call-sites
   * pré-S14.2 (sem `user`) caem no fallback antigo `isGestor(role)`.
   */
  private async assertAlocadoOuGestor(osId: string, userId: string, role: string, user?: JwtPayload) {
    // Fallback retrocompat: se não veio user, usa isGestor antigo (bug Juliana
    // persiste pra callers não migrados, mas a maior parte é admin/script).
    if (!user) {
      if (isGestor(role)) return;
    } else if (user && hasCapability(user, 'OVERSIGHT_PLATAFORMA')) {
      return;
    }

    const os = await this.prisma.ordemServico.findUnique({
      where: { id: osId },
      select: {
        solicitanteId: true,
        departamentoId: true,
        tecnicos: { select: { tecnicoId: true } },
      },
    });
    if (!os) throw new NotFoundException('Ordem de servico nao encontrada');

    if (os.solicitanteId === userId) return;
    if (os.tecnicos.some((t) => t.tecnicoId === userId)) return;
    // Staff do depto da OS — gestor/suporte do mesmo workspace
    if (user) {
      const deptosStaff = getDeptosOndeStaff(user);
      if (deptosStaff.includes(os.departamentoId)) return;
    }

    throw new ForbiddenException('Somente tecnicos alocados na OS, o solicitante ou staff do departamento podem realizar esta acao');
  }
}
