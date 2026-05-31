import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

/**
 * Exige que o usuário tenha o módulo 'LOGISTICA' no JWT com uma das roles
 * declaradas via @Roles(). ADMIN passa sempre. Sem @Roles na rota, só exige
 * estar autenticado (o JwtAuthGuard já cobre).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as JwtPayload | undefined;
    const mod = user?.modulos?.find((m) => m.codigo === 'LOGISTICA');
    if (!mod) throw new ForbiddenException('Sem acesso ao módulo Logística.');
    if (mod.role === 'ADMIN' || required.includes(mod.role)) return true;
    throw new ForbiddenException('Perfil insuficiente para esta operação no módulo Logística.');
  }
}
