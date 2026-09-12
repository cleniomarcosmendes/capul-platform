import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';
import { ROLES, rolesRh } from '../roles-rh.js';

/**
 * Autorização por PAPEL no módulo GESTAO_PESSOAS. ADMIN passa sempre — é o
 * escape hatch de suporte da plataforma, igual aos outros módulos.
 *
 * ⚠️ O bypass do ADMIN vale só aqui, para AUTORIZAÇÃO. Ele NÃO alcança a
 * separação de funções (`avaliacao/separacao-funcoes.ts`), que é verificada por
 * registro: nem ADMIN abre a avaliação em que é o avaliado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const exigidas = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!exigidas || exigidas.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as JwtPayload | undefined;
    const roles = rolesRh(user);
    if (roles.length === 0) throw new ForbiddenException('Sem acesso ao módulo Gestão de Pessoas.');
    if (roles.includes(ROLES.ADMIN) || roles.some((r) => exigidas.includes(r))) return true;
    /**
     * ⚠️ A recusa DIZ de quem é a permissão. "Perfil insuficiente" sozinho
     * manda a pessoa adivinhar — e quem lê é o RH, que não conhece a tabela de
     * papéis. Achado na varredura de 12/09: o `RH_MODELO` tomou 403 ao publicar
     * e a mensagem não dizia quem poderia.
     */
    const seu = roles.length ? roles.join(', ') : 'nenhum papel no módulo';
    throw new ForbiddenException(
      `Esta operação é de ${exigidas.join(' ou ')}. Seu acesso ao Gestão de Pessoas é: ${seu}. ` +
        'Peça a quem administra o módulo.',
    );
  }
}
