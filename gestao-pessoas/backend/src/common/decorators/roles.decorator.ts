import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'rhRoles';

/**
 * Papéis exigidos na rota, checados pelo RolesGuard contra o módulo
 * GESTAO_PESSOAS no JWT. Ex.: @Roles('RH_ADMIN', 'RH_CICLO').
 *
 * ⚠️ Rota sem @Roles fica aberta a QUALQUER usuário autenticado da plataforma —
 * inclusive quem não tem o módulo. Declare sempre, nem que seja na classe.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
