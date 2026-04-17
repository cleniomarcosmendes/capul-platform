import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CircuitState } from '@prisma/client';

/**
 * Circuit breaker por UF — mitigação 11.C do addendum v1.5.
 *
 * Comportamento:
 *   - FECHADO: requisições passam normalmente.
 *   - ABERTO: requisições são bloqueadas até `retomadaEm`.
 *   - MEIO_ABERTO: permite 1 requisição para testar; se sucesso → FECHADO,
 *     se falha → ABERTO novamente.
 *
 * Regras:
 *   - 3 erros consecutivos (429 Too Many Requests ou 503 Service Unavailable)
 *     numa UF → abre por 30 minutos.
 *   - Primeiro sucesso no MEIO_ABERTO → fecha.
 *
 * Persistência em `fiscal.uf_circuit_state` para sobreviver a restart do
 * container (diferente de Hystrix em memória).
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly THRESHOLD_ERROS = 3;
  private readonly TEMPO_ABERTO_MS = 30 * 60 * 1000; // 30 minutos

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica se pode fazer uma requisição para a UF. Lança exceção se
   * circuito está ABERTO. Retorna void se passa.
   */
  async assertCanRequest(uf: string): Promise<void> {
    const estado = await this.prisma.ufCircuitState.findUnique({ where: { uf } });
    if (!estado) return; // nunca registrou falha

    if (estado.estado === 'ABERTO') {
      if (estado.retomadaEm && estado.retomadaEm.getTime() < Date.now()) {
        // Tempo de bloqueio expirou → muda para MEIO_ABERTO
        await this.prisma.ufCircuitState.update({
          where: { uf },
          data: { estado: 'MEIO_ABERTO', errosRecentes: 0 },
        });
        this.logger.log(`Circuit breaker UF=${uf}: ABERTO → MEIO_ABERTO (tempo expirou)`);
        return;
      }
      const restante = estado.retomadaEm
        ? Math.round((estado.retomadaEm.getTime() - Date.now()) / 1000 / 60)
        : '?';
      throw new CircuitBreakerOpenError(
        `Circuit breaker ABERTO para UF ${uf}. Motivo: ${estado.motivoBloqueio}. Retoma em ~${restante} minuto(s).`,
        uf,
      );
    }
  }

  /**
   * Registra uma falha. Se atingir o threshold, abre o circuito.
   */
  async recordFailure(uf: string, motivo: string): Promise<void> {
    const now = new Date();
    const retomadaEm = new Date(now.getTime() + this.TEMPO_ABERTO_MS);
    const existente = await this.prisma.ufCircuitState.findUnique({ where: { uf } });

    if (!existente) {
      await this.prisma.ufCircuitState.create({
        data: {
          uf,
          estado: 'FECHADO',
          errosRecentes: 1,
          motivoBloqueio: motivo,
        },
      });
      return;
    }

    const novosErros = existente.errosRecentes + 1;
    if (novosErros >= this.THRESHOLD_ERROS && existente.estado !== 'ABERTO') {
      await this.prisma.ufCircuitState.update({
        where: { uf },
        data: {
          estado: 'ABERTO',
          errosRecentes: novosErros,
          abertoEm: now,
          retomadaEm,
          motivoBloqueio: motivo,
        },
      });
      this.logger.warn(
        `Circuit breaker UF=${uf}: FECHADO → ABERTO (${novosErros} erros consecutivos). Retoma ${retomadaEm.toISOString()}.`,
      );
      return;
    }

    // Ainda sob threshold ou já aberto
    await this.prisma.ufCircuitState.update({
      where: { uf },
      data: {
        errosRecentes: novosErros,
        motivoBloqueio: motivo,
      },
    });
  }

  /**
   * Registra um sucesso. Fecha o circuito se estava MEIO_ABERTO, ou reseta
   * o contador se estava FECHADO.
   */
  async recordSuccess(uf: string): Promise<void> {
    const existente = await this.prisma.ufCircuitState.findUnique({ where: { uf } });
    if (!existente) return;

    if (existente.estado === 'MEIO_ABERTO' || existente.errosRecentes > 0) {
      await this.prisma.ufCircuitState.update({
        where: { uf },
        data: {
          estado: 'FECHADO',
          errosRecentes: 0,
          abertoEm: null,
          retomadaEm: null,
          motivoBloqueio: null,
        },
      });
      if (existente.estado === 'MEIO_ABERTO') {
        this.logger.log(`Circuit breaker UF=${uf}: MEIO_ABERTO → FECHADO (sucesso)`);
      }
    }
  }

  /**
   * Estado atual de todas as UFs — para dashboard admin.
   */
  async getAllStates() {
    return this.prisma.ufCircuitState.findMany({ orderBy: { uf: 'asc' } });
  }

  /**
   * Força abertura/fechamento manual — para ADMIN_TI intervir em casos
   * excepcionais (ex.: SEFAZ específica em manutenção conhecida).
   */
  async forceState(uf: string, estado: CircuitState, motivo: string): Promise<void> {
    await this.prisma.ufCircuitState.upsert({
      where: { uf },
      create: {
        uf,
        estado,
        errosRecentes: 0,
        motivoBloqueio: motivo,
        retomadaEm: estado === 'ABERTO' ? new Date(Date.now() + this.TEMPO_ABERTO_MS) : null,
      },
      update: {
        estado,
        motivoBloqueio: motivo,
        retomadaEm: estado === 'ABERTO' ? new Date(Date.now() + this.TEMPO_ABERTO_MS) : null,
        errosRecentes: estado === 'FECHADO' ? 0 : undefined,
      },
    });
    this.logger.warn(`Circuit breaker UF=${uf}: forçado para ${estado} por admin. Motivo: ${motivo}`);
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string, public readonly uf: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
