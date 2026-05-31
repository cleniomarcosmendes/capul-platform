import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Payload do JWT (mesma forma emitida pelo Auth Gateway). */
export interface JwtPayload {
  sub: string;
  email?: string;
  nome?: string;
  empresaId?: string;
  filialId?: string;
  modulos?: { codigo: string; role: string }[];
}

/**
 * Injeta o usuário autenticado (payload do JWT) no handler.
 * `@CurrentUser()` → payload inteiro; `@CurrentUser('sub')` → campo.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;
    return data ? user?.[data] : user;
  },
);
