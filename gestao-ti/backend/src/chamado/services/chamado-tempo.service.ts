import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChamadoHelpersService } from './chamado-helpers.service.js';
import { UpdateRegistroTempoChamadoDto } from '../dto/update-registro-tempo-chamado.dto.js';
import { isGestor } from '../../common/constants/roles.constant.js';

@Injectable()
export class ChamadoTempoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ChamadoHelpersService,
  ) {}

  async listarRegistrosTempo(chamadoId: string) {
    return this.prisma.registroTempoChamado.findMany({
      where: { chamadoId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { horaInicio: 'desc' },
    });
  }

  /** Encerra todos os timers abertos do usuario (chamados + projetos) */
  async encerrarTimersAbertos(userId: string) {
    const now = new Date();

    // Encerra timers abertos em chamados
    const abertosChamado = await this.prisma.registroTempoChamado.findMany({
      where: { usuarioId: userId, horaFim: null },
    });
    for (const reg of abertosChamado) {
      const duracao = Math.round((now.getTime() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempoChamado.update({
        where: { id: reg.id },
        data: { horaFim: now, duracaoMinutos: duracao },
      });
    }

    // Encerra timers abertos em atividades de projeto (cross-module)
    const abertosProjeto = await this.prisma.registroTempo.findMany({
      where: { usuarioId: userId, horaFim: null },
    });
    for (const reg of abertosProjeto) {
      const duracao = Math.round((now.getTime() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempo.update({
        where: { id: reg.id },
        data: { horaFim: now, duracaoMinutos: duracao },
      });
    }
  }

  async iniciarTempoChamado(chamadoId: string, userId: string, role: string) {
    await this.helpers.assertTecnicoOuColaborador(chamadoId, userId, role);

    const chamado = await this.helpers.getChamadoOrFail(chamadoId);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel registrar tempo em chamado finalizado');
    }

    await this.encerrarTimersAbertos(userId);

    return this.prisma.registroTempoChamado.create({
      data: { horaInicio: new Date(), chamadoId, usuarioId: userId },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async encerrarTempoChamado(chamadoId: string, userId: string) {
    const registro = await this.prisma.registroTempoChamado.findFirst({
      where: { chamadoId, usuarioId: userId, horaFim: null },
    });
    if (!registro) throw new NotFoundException('Nenhum registro ativo para este chamado');

    const duracao = Math.round((Date.now() - new Date(registro.horaInicio).getTime()) / 60000);
    return this.prisma.registroTempoChamado.update({
      where: { id: registro.id },
      data: { horaFim: new Date(), duracaoMinutos: duracao },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  private validarEdicaoRegistroChamado(registro: { horaFim: Date | null; horaInicio: Date; usuarioId: string }, userId: string, role: string) {
    // Regra 1: nao editar registro com timer ativo
    if (!registro.horaFim) {
      throw new BadRequestException('Nao e possivel editar um registro com cronometro ativo. Encerre o cronometro primeiro.');
    }

    // Regra 2: apenas o dono ou gestores
    if (registro.usuarioId !== userId && !isGestor(role)) {
      throw new ForbiddenException('Voce so pode editar seus proprios registros de tempo.');
    }

    // Regra 3: limite D-2
    const limite = new Date();
    limite.setDate(limite.getDate() - 2);
    limite.setHours(0, 0, 0, 0);
    if (new Date(registro.horaInicio) < limite && !isGestor(role)) {
      throw new BadRequestException('Nao e possivel editar registros com mais de 2 dias. Solicite ao gestor.');
    }
  }

  async ajustarRegistroTempoChamado(chamadoId: string, registroId: string, dto: UpdateRegistroTempoChamadoDto, userId?: string, role?: string) {
    const chamado = await this.helpers.getChamadoOrFail(chamadoId);
    if (chamado.status === 'CANCELADO') {
      throw new BadRequestException('Nao e possivel editar registros de tempo em chamado cancelado');
    }

    const registro = await this.prisma.registroTempoChamado.findFirst({
      where: { id: registroId, chamadoId },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');

    if (userId && role) {
      this.validarEdicaoRegistroChamado(registro, userId, role);
      if (registro.usuarioId !== userId) {
        this.prisma.$queryRaw`
          INSERT INTO core.system_logs (id, level, message, module, action, usuario_id, metadata, created_at)
          VALUES (gen_random_uuid()::text, 'AUDIT', 'REGISTRO_TEMPO_CHAMADO_EDITADO_POR_GESTOR', 'CHAMADO', 'REGISTRO_TEMPO_CHAMADO_EDITADO_POR_GESTOR', ${userId}, ${JSON.stringify({ registroId, donoId: registro.usuarioId, chamadoId })}, NOW())
        `.catch((err) => console.error('Audit log error:', err.message));
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.horaInicio) data.horaInicio = new Date(dto.horaInicio);
    if (dto.horaFim) data.horaFim = new Date(dto.horaFim);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    const inicio = dto.horaInicio ? new Date(dto.horaInicio) : new Date(registro.horaInicio);
    const fim = dto.horaFim ? new Date(dto.horaFim) : registro.horaFim ? new Date(registro.horaFim) : null;
    if (fim) {
      data.duracaoMinutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
    }

    return this.prisma.registroTempoChamado.update({
      where: { id: registroId },
      data,
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async removerRegistroTempoChamado(chamadoId: string, registroId: string, userId?: string, role?: string) {
    const chamado = await this.helpers.getChamadoOrFail(chamadoId);
    if (chamado.status === 'CANCELADO') {
      throw new BadRequestException('Nao e possivel remover registros de tempo em chamado cancelado');
    }

    const registro = await this.prisma.registroTempoChamado.findFirst({
      where: { id: registroId, chamadoId },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');
    if (userId && role) {
      this.validarEdicaoRegistroChamado(registro, userId, role);
      if (registro.usuarioId !== userId) {
        this.prisma.$queryRaw`
          INSERT INTO core.system_logs (id, level, message, module, action, usuario_id, metadata, created_at)
          VALUES (gen_random_uuid()::text, 'AUDIT', 'REGISTRO_TEMPO_CHAMADO_REMOVIDO_POR_GESTOR', 'CHAMADO', 'REGISTRO_TEMPO_CHAMADO_REMOVIDO_POR_GESTOR', ${userId}, ${JSON.stringify({ registroId, donoId: registro.usuarioId, chamadoId })}, NOW())
        `.catch((err) => console.error('Audit log error:', err.message));
      }
    }
    return this.prisma.registroTempoChamado.delete({ where: { id: registroId } });
  }
}
