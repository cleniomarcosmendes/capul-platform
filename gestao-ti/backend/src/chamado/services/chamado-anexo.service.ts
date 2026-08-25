import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChamadoHelpersService } from './chamado-helpers.service.js';
import { UPLOADS_DIR } from './chamado.constants.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ChamadoAnexoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ChamadoHelpersService,
  ) {}

  async listAnexos(chamadoId: string) {
    await this.helpers.getChamadoOrFail(chamadoId);
    return this.prisma.anexoChamado.findMany({
      where: { chamadoId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ⭐ 25/08 — anexar não tinha checagem NENHUMA (a rota nem `@Roles` tem): com o id do
   * chamado, qualquer usuário do Workspace anexava arquivo em chamado de qualquer
   * departamento. Agora vale a regra do resto do módulo — técnico, colaborador, quem
   * abriu (caso normal: o solicitante anexa a foto do problema), quem está em cópia, ou
   * quem manda NO DEPARTAMENTO DO CHAMADO.
   */
  async addAnexo(
    chamadoId: string,
    file: Express.Multer.File,
    user: JwtPayload,
    role: string,
    descricao?: string,
  ) {
    await this.helpers.assertTecnicoOuColaborador(chamadoId, user, role, {
      permitirSolicitante: true,
      permitirCopia: true,
    });
    const userId = user.sub;
    const chamado = await this.helpers.getChamadoOrFail(chamadoId);
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel anexar arquivos em chamado finalizado');
    }
    return this.prisma.anexoChamado.create({
      data: {
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        descricao,
        chamadoId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async getAnexoFile(chamadoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoChamado.findFirst({
      where: { id: anexoId, chamadoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste chamado');

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }
    return { filePath, anexo };
  }

  /** Idem: remover anexo decidia só pelo `@Roles` denormalizado do controller. */
  async removeAnexo(chamadoId: string, anexoId: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(chamadoId, user, role);
    const chamado = await this.helpers.getChamadoOrFail(chamadoId);
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel remover anexo de chamado finalizado');
    }

    const anexo = await this.prisma.anexoChamado.findFirst({
      where: { id: anexoId, chamadoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste chamado');

    // Remove do disco
    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.anexoChamado.delete({ where: { id: anexoId } });
    return { deleted: true };
  }
}
