import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Guard simples: exige que o usuario tenha o modulo CONFIGURADOR com role
 * ADMIN no JWT. Usado nos endpoints administrativos de presenca/avisos.
 *
 * Auth-gateway nao tem RolesGuard generico ainda — esse guard cobre o caso
 * sem introduzir abstracao maior. Se outros endpoints administrativos
 * surgirem, refatorar pra um RolesGuard parametrizado.
 */
@Injectable()
export class ConfiguradorAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.modulos) {
      throw new ForbiddenException('Sem permissao — modulos ausentes no JWT.');
    }
    const configurador = user.modulos.find(
      (m: { codigo: string; role: string }) => m.codigo === 'CONFIGURADOR',
    );
    if (!configurador || configurador.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas ADMIN do modulo Configurador pode acessar esta operacao.',
      );
    }
    return true;
  }
}
