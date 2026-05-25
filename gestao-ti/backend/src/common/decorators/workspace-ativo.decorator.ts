import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * S15.1 (25/05) — workspace ATIVO da sessão (depto escolhido pelo user no
 * WorkspaceSwitcher do frontend).
 *
 * Lido pelo GestaoTiGuard a partir do header `X-Workspace-Id`. Pode ser
 * `null` (fallback: user vê união de todos os perfis — comportamento
 * S13/S14 pré-S15).
 *
 * Uso em controllers:
 *   findAll(@WorkspaceAtivo() workspaceAtivoId: string | null, ...)
 *
 * Em services, o helper `getDeptoIdAtivo(req)` extrai do request — ver
 * departamento-filter.helper.
 */
export const WorkspaceAtivo = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspaceAtivoId ?? null;
  },
);
