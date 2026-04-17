import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AmbienteSefaz } from '@prisma/client';

/**
 * Gerencia o registro singleton `ambiente_config` (id=1):
 * ambiente PROD/HOM, gate de bootstrap, freio de mão, janelas cron.
 */
@Injectable()
export class AmbienteService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate() {
    let cfg = await this.prisma.ambienteConfig.findUnique({ where: { id: 1 } });
    if (!cfg) {
      cfg = await this.prisma.ambienteConfig.create({ data: { id: 1 } });
    }
    return cfg;
  }

  async getStatus() {
    const cfg = await this.getOrCreate();
    return {
      ambienteAtivo: cfg.ambienteAtivo,
      bootstrapConcluido: cfg.bootstrapConcluidoEm !== null,
      bootstrapConcluidoEm: cfg.bootstrapConcluidoEm,
      pauseSync: cfg.pauseSync,
      janelaSemanalCron: cfg.janelaSemanalCron,
      janelaDiariaCron: cfg.janelaDiariaCron,
      ultimaAlteracaoEm: cfg.ultimaAlteracaoEm,
      ultimaAlteracaoPor: cfg.ultimaAlteracaoPor,
    };
  }

  async marcarBootstrapConcluido(usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: { bootstrapConcluidoEm: new Date(), ultimaAlteracaoPor: usuario },
    });
  }

  async alterarAmbiente(ambiente: AmbienteSefaz, usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: { ambienteAtivo: ambiente, ultimaAlteracaoPor: usuario },
    });
  }

  async pauseSync(usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: { pauseSync: true, ultimaAlteracaoPor: usuario },
    });
  }

  async resumeSync(usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: { pauseSync: false, ultimaAlteracaoPor: usuario },
    });
  }

  /**
   * Verificação usada por todos os endpoints de sincronização:
   * lança 409 BOOTSTRAP_PENDENTE se a primeira carga ainda não foi feita.
   * Pode ser bypassed por ADMIN_TI via header X-Fiscal-Override-Gate.
   */
  async assertBootstrapConcluido(allowOverride = false): Promise<void> {
    if (allowOverride) return;
    const cfg = await this.getOrCreate();
    if (!cfg.bootstrapConcluidoEm) {
      throw new ConflictException({
        erro: 'BOOTSTRAP_PENDENTE',
        mensagem:
          'A carga inicial (bootstrap) ainda não foi concluída. Botões manuais permanecem desabilitados até a finalização.',
      });
    }
  }
}
