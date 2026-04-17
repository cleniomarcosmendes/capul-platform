import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { temAcessoMinimo, type RoleFiscal } from '../constants/roles.constant.js';
import type { FiscalAuthenticatedUser } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<RoleFiscal | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) return true;

    const req = context.switchToHttp().getRequest<Request & { fiscalUser?: FiscalAuthenticatedUser }>();
    const fiscalUser = req.fiscalUser;

    if (!fiscalUser) {
      throw new ForbiddenException('FiscalGuard precisa rodar antes do RolesGuard.');
    }

    if (!temAcessoMinimo(fiscalUser.fiscalRole, requiredRole)) {
      throw new ForbiddenException(
        `Role mínima requerida: ${requiredRole}. Role do usuário: ${fiscalUser.fiscalRole}.`,
      );
    }

    return true;
  }
}
