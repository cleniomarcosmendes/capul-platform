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
      (m: { codigo: string }) => m.codigo === 'WORKSPACE',
    );
    if (!modulo) {
      throw new ForbiddenException('Sem acesso ao módulo Gestão de TI');
    }

    request.gestaoTiRole = modulo.role;
    // Workspace Multi-Departamento (Onda 1 Sub-fase 1.5)
    // Popula info departamental pra @RequiresFuncionalidade + futuros checks
    // departamentais em controllers. Vazio se JWT antigo (pré Sub-fase 1.4).
    request.gestaoTiDepartamentos = modulo.departamentos ?? [];
    return true;
  }
}
