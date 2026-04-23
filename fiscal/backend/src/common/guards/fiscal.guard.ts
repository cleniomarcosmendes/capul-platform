import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { MODULO_FISCAL } from '../constants/modulo.constant.js';
import { ROLES_FISCAL, type RoleFiscal } from '../constants/roles.constant.js';
import type { JwtPayload, FiscalAuthenticatedUser } from '../interfaces/jwt-payload.interface.js';

/**
 * Guard que valida que o JWT do usuário possui acesso ao módulo FISCAL
 * e injeta `request.fiscalUser` para uso pelo @CurrentUser() decorator.
 *
 * Equivalente ao GestaoTiGuard do gestao-ti/backend.
 */
@Injectable()
export class FiscalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload; fiscalUser?: FiscalAuthenticatedUser }>();
    const payload = req.user as JwtPayload | undefined;

    if (!payload?.sub) {
      throw new UnauthorizedException('JWT ausente ou inválido.');
    }

    const moduloFiscal = payload.modulos?.find((m) => m.codigo === MODULO_FISCAL);
    if (!moduloFiscal) {
      throw new ForbiddenException('Usuário não possui acesso ao módulo FISCAL.');
    }

    if (!ROLES_FISCAL.includes(moduloFiscal.role as RoleFiscal)) {
      throw new ForbiddenException(`Role inválida no módulo FISCAL: ${moduloFiscal.role}`);
    }

    // `core.usuarios.email` é nullable no auth-gateway, mas várias tabelas do
    // fiscal (documento_consulta, audit_log, etc.) têm `usuario_email NOT NULL`.
    // Sem fallback, o upsert explode com erro Prisma → 500. Mantemos um valor
    // determinístico por usuário (sem-email+<id>@capul.local) para preservar
    // rastreabilidade + autor em queries por e-mail.
    const emailEfetivo = payload.email && payload.email.trim() !== ''
      ? payload.email
      : `sem-email+${payload.sub}@capul.local`;

    req.fiscalUser = {
      id: payload.sub,
      email: emailEfetivo,
      nome: payload.nome,
      filialId: payload.filialId,
      filialCodigo: payload.filialCodigo,
      fiscalRole: moduloFiscal.role,
    };

    return true;
  }
}
