import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuloService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.moduloSistema.findMany({
      where: { status: 'ATIVO' },
      include: {
        rolesDisponiveis: {
          select: { id: true, codigo: true, nome: true, descricao: true },
        },
      },
      orderBy: { ordem: 'asc' },
    });
  }

  async findRoles(moduloId: string) {
    return this.prisma.roleModulo.findMany({
      where: { moduloId },
      orderBy: { codigo: 'asc' },
    });
  }
}
