import {
  Injectable,
  BadRequestException,
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
    {
      permitirSolicitante = false,
      permitirCopia = false,
    }: { permitirSolicitante?: boolean; permitirCopia?: boolean } = {},
  ) {
    if (isGestor(role)) return;

    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        tecnicoId: true,
        solicitanteId: true,
        colaboradores: { select: { usuarioId: true } },
        copias: permitirCopia ? { select: { usuarioId: true } } : false,
      },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (chamado.tecnicoId === userId) return;
    if (chamado.colaboradores.some((c) => c.usuarioId === userId)) return;
    if (permitirSolicitante && chamado.solicitanteId === userId) return;
    if (permitirCopia && chamado.copias && chamado.copias.some((c) => c.usuarioId === userId)) return;

    throw new ForbiddenException('Apenas o tecnico atribuido ou colaboradores podem realizar esta acao');
  }

  /**
   * Valida que o usuario nao eh "pessoal T.I." para adicionar em copia.
   * Regra (decidida em 13/05/2026): copia eh para usuarios externos ao T.I.
   * — se for membro ativo de qualquer EquipeTI, ja eh elegivel para virar
   * ChamadoColaborador (conceito T.I.-only); adicionar como copia burlaria
   * a regra "TI escolhe quem atende".
   *
   * Defense in depth: o frontend ja filtra TI no select de adicao, mas o
   * service revalida para defender contra request manipulado.
   */
  async assertNaoSeTI(usuarioId: string) {
    const membroAtivo = await this.prisma.membroEquipe.findFirst({
      where: { usuarioId, status: 'ATIVO' },
      select: { id: true },
    });
    if (membroAtivo) {
      throw new BadRequestException(
        'Membros de Equipe T.I. nao podem ser adicionados em copia (usar Colaboradores).',
      );
    }
  }
}
