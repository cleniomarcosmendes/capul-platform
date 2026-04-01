import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateRegistroTempoDto } from '../dto/update-registro-tempo.dto.js';
import { CreateApontamentoDto } from '../dto/create-apontamento.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';

@Injectable()
export class ProjetoTempoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  async listarRegistrosTempo(projetoId: string, atividadeId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.registroTempo.findMany({
      where: { atividadeId, atividade: { projetoId } },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { horaInicio: 'desc' },
    });
  }

  async iniciarRegistroTempo(projetoId: string, atividadeId: string, userId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Atividade nao encontrada neste projeto');

    // Encerra qualquer registro aberto do usuario em QUALQUER atividade/projeto
    const abertos = await this.prisma.registroTempo.findMany({
      where: { usuarioId: userId, horaFim: null },
    });
    for (const reg of abertos) {
      const duracao = Math.round((Date.now() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempo.update({
        where: { id: reg.id },
        data: { horaFim: new Date(), duracaoMinutos: duracao },
      });
    }

    // Encerra timers abertos em chamados (cross-module)
    const abertosChamado = await this.prisma.registroTempoChamado.findMany({
      where: { usuarioId: userId, horaFim: null },
    });
    for (const reg of abertosChamado) {
      const duracao = Math.round((Date.now() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempoChamado.update({
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
    await this.helpers.ensureProjetoExists(projetoId);
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

  async ajustarRegistroTempo(projetoId: string, registroId: string, dto: UpdateRegistroTempoDto, userId?: string, role?: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const registro = await this.prisma.registroTempo.findFirst({
      where: { id: registroId, atividade: { projetoId } },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');

    if (userId && role) {
      this.helpers.validarEdicaoRegistro(registro, userId, role);
      // Audit log: gestor editando registro de outro usuario
      if (registro.usuarioId !== userId) {
        this.prisma.$queryRaw`
          INSERT INTO core.system_logs (id, level, message, module, action, usuario_id, metadata, created_at)
          VALUES (gen_random_uuid()::text, 'AUDIT', 'REGISTRO_TEMPO_EDITADO_POR_GESTOR', 'PROJETO', 'REGISTRO_TEMPO_EDITADO_POR_GESTOR', ${userId}, ${JSON.stringify({ registroId, donoId: registro.usuarioId, projetoId })}, NOW())
        `.catch((err) => console.error('Audit log error:', err.message));
      }
    }

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

  async removerRegistroTempo(projetoId: string, registroId: string, userId?: string, role?: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const registro = await this.prisma.registroTempo.findFirst({
      where: { id: registroId, atividade: { projetoId } },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');
    if (userId && role) {
      this.helpers.validarEdicaoRegistro(registro, userId, role);
      if (registro.usuarioId !== userId) {
        this.prisma.$queryRaw`
          INSERT INTO core.system_logs (id, level, message, module, action, usuario_id, metadata, created_at)
          VALUES (gen_random_uuid()::text, 'AUDIT', 'REGISTRO_TEMPO_REMOVIDO_POR_GESTOR', 'PROJETO', 'REGISTRO_TEMPO_REMOVIDO_POR_GESTOR', ${userId}, ${JSON.stringify({ registroId, donoId: registro.usuarioId, projetoId })}, NOW())
        `.catch((err) => console.error('Audit log error:', err.message));
      }
    }
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

  // --- Apontamento de Horas ---

  async listApontamentos(projetoId: string) {
    const projeto = await this.helpers.ensureProjetoExists(projetoId);
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
    const projeto = await this.helpers.ensureProjetoExists(projetoId);
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
}
