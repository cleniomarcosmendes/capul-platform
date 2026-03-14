import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MonitorService {
  constructor(private prisma: PrismaService) {}

  async getMeusItens(userId: string) {
    // Chamados em atendimento (como técnico ou colaborador)
    const [chamadosTecnico, chamadosColaborador] = await Promise.all([
      this.prisma.chamado.findMany({
        where: {
          tecnicoId: userId,
          status: { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'REABERTO'] },
        },
        select: {
          id: true,
          numero: true,
          titulo: true,
          status: true,
          prioridade: true,
          createdAt: true,
          equipeAtual: { select: { id: true, sigla: true, nome: true } },
          filial: { select: { id: true, codigo: true } },
          solicitante: { select: { id: true, nome: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chamadoColaborador.findMany({
        where: { usuarioId: userId },
        select: {
          chamado: {
            select: {
              id: true,
              numero: true,
              titulo: true,
              status: true,
              prioridade: true,
              createdAt: true,
              tecnicoId: true,
              equipeAtual: { select: { id: true, sigla: true, nome: true } },
              filial: { select: { id: true, codigo: true } },
              solicitante: { select: { id: true, nome: true } },
            },
          },
        },
      }),
    ]);

    // Unificar chamados (técnico + colaborador), sem duplicatas
    const chamadoIds = new Set(chamadosTecnico.map((c) => c.id));
    const chamadosColab = chamadosColaborador
      .map((cc) => cc.chamado)
      .filter((c) => !chamadoIds.has(c.id) && ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'REABERTO'].includes(c.status));

    const chamados = [...chamadosTecnico, ...chamadosColab];

    // Atividades de projeto (minhas, ativas)
    const atividades = await this.prisma.atividadeProjeto.findMany({
      where: {
        usuarioId: userId,
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
        projeto: { status: { in: ['EM_ANDAMENTO', 'PLANEJAMENTO'] } },
      },
      select: {
        id: true,
        titulo: true,
        status: true,
        createdAt: true,
        projeto: { select: { id: true, numero: true, nome: true, status: true } },
        fase: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Timers ativos do usuário (chamados + atividades)
    const [timersChamado, timersAtividade] = await Promise.all([
      this.prisma.registroTempoChamado.findMany({
        where: { usuarioId: userId, horaFim: null },
        select: {
          id: true,
          horaInicio: true,
          chamadoId: true,
        },
      }),
      this.prisma.registroTempo.findMany({
        where: { usuarioId: userId, horaFim: null },
        select: {
          id: true,
          horaInicio: true,
          atividadeId: true,
          atividade: { select: { projetoId: true } },
        },
      }),
    ]);

    return {
      chamados,
      atividades,
      timers: {
        chamados: timersChamado,
        atividades: timersAtividade,
      },
    };
  }

  /**
   * Encerra todos os timers ativos do usuário (chamados + atividades)
   */
  async encerrarTodosTimers(userId: string) {
    const agora = new Date();

    const [timersChamado, timersAtividade] = await Promise.all([
      this.prisma.registroTempoChamado.findMany({
        where: { usuarioId: userId, horaFim: null },
      }),
      this.prisma.registroTempo.findMany({
        where: { usuarioId: userId, horaFim: null },
      }),
    ]);

    const encerrados: string[] = [];

    for (const reg of timersChamado) {
      const duracao = Math.round((agora.getTime() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempoChamado.update({
        where: { id: reg.id },
        data: { horaFim: agora, duracaoMinutos: duracao },
      });
      encerrados.push(`chamado:${reg.chamadoId}`);
    }

    for (const reg of timersAtividade) {
      const duracao = Math.round((agora.getTime() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempo.update({
        where: { id: reg.id },
        data: { horaFim: agora, duracaoMinutos: duracao },
      });
      encerrados.push(`atividade:${reg.atividadeId}`);
    }

    return { encerrados: encerrados.length };
  }

  /**
   * Inicia timer em chamado, encerrando qualquer outro timer ativo (chamado ou atividade)
   */
  async iniciarTimerChamado(chamadoId: string, userId: string) {
    // Encerrar todos timers ativos primeiro
    await this.encerrarTodosTimers(userId);

    // Iniciar novo timer no chamado
    return this.prisma.registroTempoChamado.create({
      data: { horaInicio: new Date(), chamadoId, usuarioId: userId },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  /**
   * Inicia timer em atividade de projeto, encerrando qualquer outro timer ativo
   */
  async iniciarTimerAtividade(atividadeId: string, userId: string) {
    // Verificar se atividade existe
    const atividade = await this.prisma.atividadeProjeto.findUnique({
      where: { id: atividadeId },
    });
    if (!atividade) return null;

    // Encerrar todos timers ativos primeiro
    await this.encerrarTodosTimers(userId);

    // Iniciar novo timer na atividade
    return this.prisma.registroTempo.create({
      data: { horaInicio: new Date(), atividadeId, usuarioId: userId },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }
}
