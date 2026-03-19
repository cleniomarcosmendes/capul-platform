import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  log(params: {
    action: string;
    usuarioId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    // Fire-and-forget — nao bloqueia o fluxo
    this.prisma.systemLog.create({
      data: {
        level: 'AUDIT',
        message: params.action,
        module: 'AUTH',
        action: params.action,
        usuarioId: params.usuarioId,
        ipAddress: params.ipAddress,
        metadata: {
          ...params.metadata,
          userAgent: params.userAgent,
        },
      },
    }).catch(() => { /* silencioso */ });
  }
}
