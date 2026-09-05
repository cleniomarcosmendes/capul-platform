import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Trilha de `rh.auditoria`. A especificação §8 exige registro em: alteração de
 * nota, reabertura de avaliação, exclusão, publicação de modelo e **acesso a
 * resultado individual por quem não é o avaliador designado**.
 *
 * ⚠️ Gravar auditoria NUNCA derruba a operação: se a trilha falhar, o erro vai
 * para o log e a ação segue. O contrário — recusar uma leitura legítima porque
 * o insert de auditoria falhou — trocaria um problema de observabilidade por um
 * de disponibilidade.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(evento: {
    entidade: string;
    entidadeId: string;
    acao: string;
    usuarioId: string;
    valorAnterior?: unknown;
    valorNovo?: unknown;
    justificativa?: string;
    ip?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditoria.create({
        data: {
          entidade: evento.entidade,
          entidadeId: evento.entidadeId,
          acao: evento.acao,
          usuarioId: evento.usuarioId,
          valorAnterior: (evento.valorAnterior ?? undefined) as never,
          valorNovo: (evento.valorNovo ?? undefined) as never,
          justificativa: evento.justificativa,
          ip: evento.ip,
        },
      });
    } catch (e) {
      this.logger.error(
        `Falha ao gravar auditoria (${evento.entidade}/${evento.acao}): ${(e as Error).message}`,
      );
    }
  }
}
