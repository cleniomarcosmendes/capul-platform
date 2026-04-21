import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { QUEUE_CRUZAMENTO } from '../bullmq/bullmq.module.js';
import type { CruzamentoJobData } from './execucao.service.js';

/**
 * Varredura ao iniciar o fiscal-backend: busca execucoes com status
 * EM_EXECUCAO cujos jobs no BullMQ nao existem mais e marca como FALHADA.
 *
 * Motivo: quando o container e reconstruido/reiniciado abruptamente
 * (SIGKILL, crash, docker compose up -d com recreate), o CruzamentoWorker
 * morre sem oportunidade de atualizar o registro no banco. Fica
 * "pendurado" em EM_EXECUCAO para sempre.
 *
 * Politica:
 *   1. Busca todas as execucoes em EM_EXECUCAO (finalizado_em IS NULL).
 *   2. Lista jobs ativos/esperando/delayed na fila BullMQ.
 *   3. Se nenhuma execucao tem job correspondente (data.sincronizacaoId),
 *      e uma execucao em EM_EXECUCAO NAO aparece em nenhum job -> zumbi.
 *   4. Marca como FALHADA com observacao explicando.
 *
 * Seguranca: so marca execucoes que ja completaram o tempo de grace
 * (GRACE_MS = 60s) desde o iniciado_em. Isso evita condicao de corrida
 * onde esta rodina roda enquanto o worker ainda esta subindo os primeiros
 * jobs de uma execucao que acabou de ser criada.
 */
@Injectable()
export class StartupCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupCleanupService.name);
  private readonly GRACE_MS = 60_000;

  constructor(
    @Inject(QUEUE_CRUZAMENTO) private readonly queue: Queue<CruzamentoJobData>,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.limparZumbis();
    } catch (err) {
      // Nao queremos que uma falha aqui impeca o app de subir.
      this.logger.error(
        `Falha na limpeza de execucoes orfas no boot: ${(err as Error).message}`,
      );
    }
  }

  private async limparZumbis(): Promise<void> {
    const emExecucao = await this.prisma.cadastroSincronizacao.findMany({
      where: { status: 'EM_EXECUCAO', finalizadoEm: null },
      select: { id: true, tipo: true, iniciadoEm: true },
    });

    if (emExecucao.length === 0) {
      this.logger.log('Startup cleanup: nenhuma execucao EM_EXECUCAO pendente.');
      return;
    }

    // Lista IDs de execucao que tem jobs ativos/esperando na fila
    const jobs = await this.queue.getJobs(
      ['active', 'waiting', 'delayed', 'paused', 'wait'],
      0,
      100_000,
    );
    const idsComJobs = new Set<string>();
    for (const job of jobs) {
      const id = job.data?.sincronizacaoId;
      if (id) idsComJobs.add(id);
    }

    const agora = Date.now();
    const orfas = emExecucao.filter(
      (e) =>
        !idsComJobs.has(e.id) &&
        agora - e.iniciadoEm.getTime() >= this.GRACE_MS,
    );

    if (orfas.length === 0) {
      this.logger.log(
        `Startup cleanup: ${emExecucao.length} execucao(oes) EM_EXECUCAO com jobs ativos na fila — nada a marcar.`,
      );
      return;
    }

    const observacao =
      `[${new Date().toISOString()}] Marcada como FALHADA no boot do fiscal-backend — ` +
      'execucao orfa: sem job correspondente na fila BullMQ. Provavel causa: ' +
      'container reiniciado/recriado enquanto a execucao estava em andamento.';

    for (const o of orfas) {
      await this.prisma.cadastroSincronizacao.update({
        where: { id: o.id },
        data: {
          status: 'FALHADA',
          finalizadoEm: new Date(),
          observacoes: observacao,
        },
      });
      this.logger.warn(
        `Startup cleanup: execucao ${o.id.slice(0, 8)} (${o.tipo}) marcada como FALHADA ` +
          `(iniciada ha ${Math.round((agora - o.iniciadoEm.getTime()) / 1000)}s, sem job na fila).`,
      );
    }

    this.logger.log(
      `Startup cleanup concluido: ${orfas.length} execucao(oes) orfas limpas de ${emExecucao.length} encontradas.`,
    );
  }
}
