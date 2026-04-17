import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { FiscalAuthenticatedUser } from '../interfaces/jwt-payload.interface.js';

/**
 * Injeta o usuário autenticado no método do controller.
 * Requer FiscalGuard executado antes.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): FiscalAuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request & { fiscalUser?: FiscalAuthenticatedUser }>();
    if (!req.fiscalUser) {
      throw new Error('CurrentUser usado sem FiscalGuard — falha de configuração.');
    }
    return req.fiscalUser;
  },
);
