import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpsertHorarioDto } from './dto/horario.dto.js';

@Injectable()
export class HorarioService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAll() {
    return this.prisma.horarioTrabalho.findMany({
      where: { isDefault: false },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getByUsuario(usuarioId: string) {
    const horario = await this.prisma.horarioTrabalho.findUnique({
      where: { usuarioId },
    });
    if (horario) return horario;
    return this.getDefault();
  }

  async upsertByUsuario(dto: UpsertHorarioDto) {
    if (!dto.usuarioId) {
      return this.updateDefault(dto);
    }
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

  async remove(usuarioId: string) {
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
