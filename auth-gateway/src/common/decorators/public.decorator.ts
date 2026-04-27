import { SetMetadata } from '@nestjs/common';

/**
 * Marca um endpoint (ou controller inteiro) como público — sem autenticação JWT.
 *
 * Uso obrigatório quando o `JwtAuthGuard` está registrado globalmente
 * (`APP_GUARD` em `app.module.ts`). Sem esta marcação, todo endpoint
 * exige token válido.
 *
 * Aplicar em endpoints estritamente públicos (login, refresh, health, etc.).
 *
 * Auditoria 25/04/2026 #4 — defesa em profundidade.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
