import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TipoNotificacao } from '@prisma/client';

@Injectable()
export class NotificacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(usuarioId: string, lida?: boolean) {
    return this.prisma.notificacao.findMany({
      where: {
        usuarioId,
        ...(lida !== undefined ? { lida } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countNaoLidas(usuarioId: string) {
    const count = await this.prisma.notificacao.count({
      where: { usuarioId, lida: false },
    });
    return { count };
  }

  async marcarLida(id: string, usuarioId: string) {
    const notif = await this.prisma.notificacao.findUnique({ where: { id } });
    if (!notif || notif.usuarioId !== usuarioId) {
      throw new NotFoundException('Notificacao nao encontrada');
    }
    return this.prisma.notificacao.update({
      where: { id },
      data: { lida: true },
    });
  }

  async marcarTodasLidas(usuarioId: string) {
    const result = await this.prisma.notificacao.updateMany({
      where: { usuarioId, lida: false },
      data: { lida: true },
    });
    return { marcadas: result.count };
  }

  async remover(id: string, usuarioId: string) {
    const notif = await this.prisma.notificacao.findUnique({ where: { id } });
    if (!notif || notif.usuarioId !== usuarioId) {
      throw new NotFoundException('Notificacao nao encontrada');
    }
    return this.prisma.notificacao.delete({ where: { id } });
  }

  async criarParaUsuario(
    usuarioId: string,
    tipo: TipoNotificacao,
    titulo: string,
    mensagem: string,
    dados?: Record<string, unknown>,
  ) {
    return this.prisma.notificacao.create({
      data: {
        tipo,
        titulo,
        mensagem,
        dadosJson: dados ? JSON.stringify(dados) : undefined,
        usuarioId,
      },
    });
  }

  async criarParaUsuarios(
    usuarioIds: string[],
    tipo: TipoNotificacao,
    titulo: string,
    mensagem: string,
    dados?: Record<string, unknown>,
  ) {
    if (usuarioIds.length === 0) return;
    const dadosJson = dados ? JSON.stringify(dados) : undefined;
    await this.prisma.notificacao.createMany({
      data: usuarioIds.map((usuarioId) => ({
        tipo,
        titulo,
        mensagem,
        dadosJson,
        usuarioId,
      })),
    });
  }
}
