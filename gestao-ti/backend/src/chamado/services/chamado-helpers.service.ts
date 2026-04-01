import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isGestor } from '../../common/constants/roles.constant.js';

@Injectable()
export class ChamadoHelpersService {
  constructor(private readonly prisma: PrismaService) {}

  async getChamadoOrFail(id: string) {
    const chamado = await this.prisma.chamado.findUnique({ where: { id } });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');
    return chamado;
  }

  async assertTecnicoOuColaborador(
    chamadoId: string,
    userId: string,
    role: string,
    { permitirSolicitante = false }: { permitirSolicitante?: boolean } = {},
  ) {
    if (isGestor(role)) return;

    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        tecnicoId: true,
        solicitanteId: true,
        colaboradores: { select: { usuarioId: true } },
      },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (chamado.tecnicoId === userId) return;
    if (chamado.colaboradores.some((c) => c.usuarioId === userId)) return;
    if (permitirSolicitante && chamado.solicitanteId === userId) return;

    throw new ForbiddenException('Apenas o tecnico atribuido ou colaboradores podem realizar esta acao');
  }
}
