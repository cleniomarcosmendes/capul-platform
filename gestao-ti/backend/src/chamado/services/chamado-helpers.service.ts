import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ehGestorNoDepto } from '../../common/constants/roles.constant.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class ChamadoHelpersService {
  constructor(private readonly prisma: PrismaService) {}

  async getChamadoOrFail(id: string) {
    const chamado = await this.prisma.chamado.findUnique({ where: { id } });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');
    return chamado;
  }

  /**
   * Quem pode agir neste chamado: o técnico atribuído, um colaborador — ou quem manda
   * NO DEPARTAMENTO DO CHAMADO.
   *
   * ⭐ 25/08: o atalho era `isGestor(role)`, com a role DENORMALIZADA do JWT (uma só
   * para o módulo inteiro). Como o Workspace atende vários departamentos, um GESTOR do
   * Fiscal saía por esse atalho num chamado do T.I., onde ele é usuário final. Agora
   * quem decide é o papel NO departamento do chamado (`ehGestorNoDepto`), com o ADMIN
   * seguindo global por D36.
   */
  async assertTecnicoOuColaborador(
    chamadoId: string,
    user: JwtPayload,
    role: string,
    {
      permitirSolicitante = false,
      permitirCopia = false,
    }: { permitirSolicitante?: boolean; permitirCopia?: boolean } = {},
  ) {
    const userId = user.sub;
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        departamentoId: true,
        tecnicoId: true,
        solicitanteId: true,
        colaboradores: { select: { usuarioId: true } },
        copias: permitirCopia ? { select: { usuarioId: true } } : false,
      },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (ehGestorNoDepto(user, chamado.departamentoId, role)) return;

    if (chamado.tecnicoId === userId) return;
    if (chamado.colaboradores.some((c) => c.usuarioId === userId)) return;
    if (permitirSolicitante && chamado.solicitanteId === userId) return;
    if (permitirCopia && chamado.copias && chamado.copias.some((c) => c.usuarioId === userId)) return;

    throw new ForbiddenException('Apenas o tecnico atribuido ou colaboradores podem realizar esta acao');
  }

}
