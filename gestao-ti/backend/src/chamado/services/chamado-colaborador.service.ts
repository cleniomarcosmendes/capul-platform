import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChamadoHelpersService } from './chamado-helpers.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class ChamadoColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly helpers: ChamadoHelpersService,
  ) {}

  async listarColaboradores(chamadoId: string) {
    return this.prisma.chamadoColaborador.findMany({
      where: { chamadoId },
      include: { usuario: { select: { id: true, nome: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async adicionarColaborador(chamadoId: string, usuarioId: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(chamadoId, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(chamadoId);
    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario que um tecnico assuma o chamado antes de adicionar colaboradores');
    }
    if (chamado.tecnicoId === usuarioId) {
      throw new BadRequestException('O tecnico responsavel pelo chamado nao pode ser adicionado como colaborador');
    }
    if (chamado.solicitanteId === usuarioId) {
      throw new BadRequestException('O solicitante do chamado nao pode ser adicionado como colaborador');
    }
    const jaExiste = await this.prisma.chamadoColaborador.findFirst({
      where: { chamadoId, usuarioId },
    });
    if (jaExiste) {
      throw new BadRequestException('Usuario ja e colaborador deste chamado');
    }
    const colaborador = await this.prisma.chamadoColaborador.create({
      data: { chamadoId, usuarioId },
      include: { usuario: { select: { id: true, nome: true, username: true } } },
    });

    // Notificar o colaborador adicionado
    this.notificacaoService.criarParaUsuario(
      usuarioId, 'CHAMADO_ATRIBUIDO',
      `Voce foi adicionado ao chamado #${chamado.numero}`,
      `Voce foi adicionado como colaborador no chamado "${chamado.titulo}".`,
      { chamadoId },
    ).catch((err) => console.error('Notificacao error:', err.message));

    return colaborador;
  }

  async removerColaborador(chamadoId: string, colaboradorId: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(chamadoId, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(chamadoId);
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel remover colaborador de chamado finalizado');
    }

    const reg = await this.prisma.chamadoColaborador.findFirst({
      where: { id: colaboradorId, chamadoId },
    });
    if (!reg) throw new NotFoundException('Colaborador nao encontrado neste chamado');
    const temRegistros = await this.prisma.registroTempoChamado.count({
      where: { chamadoId, usuarioId: reg.usuarioId },
    });
    if (temRegistros > 0) {
      throw new BadRequestException('Colaborador possui registros de tempo neste chamado e nao pode ser removido');
    }

    await this.prisma.chamadoColaborador.delete({ where: { id: colaboradorId } });

    // Notificar o colaborador removido
    this.notificacaoService.criarParaUsuario(
      reg.usuarioId, 'CHAMADO_ATUALIZADO',
      `Voce foi removido do chamado #${chamado.numero}`,
      `Voce foi removido como colaborador do chamado "${chamado.titulo}".`,
      { chamadoId },
    ).catch((err) => console.error('Notificacao error:', err.message));

    return { deleted: true };
  }
}
