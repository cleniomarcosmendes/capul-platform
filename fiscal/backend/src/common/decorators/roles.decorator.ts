import { SetMetadata } from '@nestjs/common';
import type { RoleFiscal } from '../constants/roles.constant.js';

export const ROLES_KEY = 'fiscal:roles';

/**
 * Define a role mínima para o endpoint.
 * Ex.: @RoleMinima('GESTOR_FISCAL')
 */
export const RoleMinima = (role: RoleFiscal) => SetMetadata(ROLES_KEY, role);
