import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class GestaoTiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const modulo = user.modulos?.find(
      (m: { codigo: string }) => m.codigo === 'GESTAO_TI',
    );
    if (!modulo) {
      throw new ForbiddenException('Sem acesso ao módulo Gestão de TI');
    }

    request.gestaoTiRole = modulo.role;
    return true;
  }
}
