import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpsertHorarioDto } from './dto/horario.dto.js';
import { assertStaffEmDepto } from '../common/helpers/departamento-filter.helper.js';
import { hasCapability } from '../common/helpers/capability.helper.js';
import { getDeptosOndeStaff } from '../common/constants/roles.constant.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class HorarioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * S15.6 (27/05) — Resolve o depto do usuário-alvo pra gate de STAFF.
   * Usado nos write paths (upsert/remove) e no getByUsuario público.
   */
  private async assertCallerPodeMexerHorarioDe(
    targetUsuarioId: string,
    caller: JwtPayload,
  ) {
    if (hasCapability(caller, 'OVERSIGHT_PLATAFORMA')) return;
    const target = await this.prisma.usuario.findUnique({
      where: { id: targetUsuarioId },
      select: { departamentoId: true },
    });
    assertStaffEmDepto(caller, target?.departamentoId);
  }

  async getDefault() {
    let def = await this.prisma.horarioTrabalho.findFirst({
      where: { isDefault: true },
    });
    if (!def) {
      def = await this.prisma.horarioTrabalho.create({
        data: {
          horaInicioExpediente: '08:00',
          horaFimExpediente: '17:00',
          horaInicioAlmoco: '12:00',
          horaFimAlmoco: '13:00',
          isDefault: true,
        },
      });
    }
    return def;
  }

  async updateDefault(dto: UpsertHorarioDto) {
    const existing = await this.prisma.horarioTrabalho.findFirst({
      where: { isDefault: true },
    });
    if (existing) {
      return this.prisma.horarioTrabalho.update({
        where: { id: existing.id },
        data: {
          horaInicioExpediente: dto.horaInicioExpediente,
          horaFimExpediente: dto.horaFimExpediente,
          horaInicioAlmoco: dto.horaInicioAlmoco,
          horaFimAlmoco: dto.horaFimAlmoco,
        },
      });
    }
    return this.prisma.horarioTrabalho.create({
      data: {
        horaInicioExpediente: dto.horaInicioExpediente,
        horaFimExpediente: dto.horaFimExpediente,
        horaInicioAlmoco: dto.horaInicioAlmoco,
        horaFimAlmoco: dto.horaFimAlmoco,
        isDefault: true,
      },
    });
  }

  /**
   * S15.6 (27/05) — Restringe lista de horários a usuários dos deptos onde o
   * caller é STAFF. Bypass via OVERSIGHT_PLATAFORMA. Tela "Horários de
   * Trabalho" é MANAGERS-only (sidebar), mas antes vazava horários de
   * usuários de todos os departamentos.
   */
  async findAll(caller?: JwtPayload) {
    const isOversight = caller ? hasCapability(caller, 'OVERSIGHT_PLATAFORMA') : false;
    const deptosStaff = getDeptosOndeStaff(caller);

    return this.prisma.horarioTrabalho.findMany({
      where: {
        isDefault: false,
        ...(caller && !isOversight
          ? { usuario: { departamentoId: { in: deptosStaff } } }
          : {}),
      },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getByUsuario(usuarioId: string, caller?: JwtPayload) {
    // S15.6 — Gate STAFF-no-depto-do-alvo (bypass OVERSIGHT). Endpoint público
    // só. Callers internos (dashboard.getHorarioParaUsuario) seguem outro caminho.
    if (caller) await this.assertCallerPodeMexerHorarioDe(usuarioId, caller);

    const horario = await this.prisma.horarioTrabalho.findUnique({
      where: { usuarioId },
    });
    if (horario) return horario;
    return this.getDefault();
  }

  async upsertByUsuario(dto: UpsertHorarioDto, caller?: JwtPayload) {
    if (!dto.usuarioId) {
      return this.updateDefault(dto);
    }
    // S15.6 — Gate STAFF do depto do usuário-alvo.
    if (caller) await this.assertCallerPodeMexerHorarioDe(dto.usuarioId, caller);

    return this.prisma.horarioTrabalho.upsert({
      where: { usuarioId: dto.usuarioId },
      create: {
        usuarioId: dto.usuarioId,
        horaInicioExpediente: dto.horaInicioExpediente,
        horaFimExpediente: dto.horaFimExpediente,
        horaInicioAlmoco: dto.horaInicioAlmoco,
        horaFimAlmoco: dto.horaFimAlmoco,
      },
      update: {
        horaInicioExpediente: dto.horaInicioExpediente,
        horaFimExpediente: dto.horaFimExpediente,
        horaInicioAlmoco: dto.horaInicioAlmoco,
        horaFimAlmoco: dto.horaFimAlmoco,
      },
    });
  }

  async remove(usuarioId: string, caller?: JwtPayload) {
    // S15.6 — Gate STAFF do depto do usuário-alvo.
    if (caller) await this.assertCallerPodeMexerHorarioDe(usuarioId, caller);
    const horario = await this.prisma.horarioTrabalho.findUnique({
      where: { usuarioId },
    });
    if (!horario) {
      throw new NotFoundException('Horario nao encontrado para este usuario');
    }
    return this.prisma.horarioTrabalho.delete({
      where: { id: horario.id },
    });
  }

  async getHorarioParaUsuario(usuarioId: string): Promise<{
    inicioExpediente: number;
    fimExpediente: number;
    inicioAlmoco: number;
    fimAlmoco: number;
    horasUteis: number;
  }> {
    const horario = await this.getByUsuario(usuarioId);
    const parseHora = (h: string) => {
      const [hh, mm] = h.split(':').map(Number);
      return hh + mm / 60;
    };
    const ini = parseHora(horario.horaInicioExpediente);
    const fim = parseHora(horario.horaFimExpediente);
    const almocoIni = parseHora(horario.horaInicioAlmoco);
    const almocoFim = parseHora(horario.horaFimAlmoco);
    const horasUteis = (fim - ini) - (almocoFim - almocoIni);
    return {
      inicioExpediente: ini,
      fimExpediente: fim,
      inicioAlmoco: almocoIni,
      fimAlmoco: almocoFim,
      horasUteis,
    };
  }
}
