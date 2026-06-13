import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'logisticaRoles';

/**
 * Roles do módulo Logística exigidas na rota (checadas pelo RolesGuard contra
 * o módulo 'LOGISTICA' no JWT). Ex.: @Roles('OPERADOR_ENTREGA','GESTOR_ENTREGA').
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
