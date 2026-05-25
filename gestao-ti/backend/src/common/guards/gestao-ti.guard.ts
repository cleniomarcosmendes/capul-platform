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

    // S15.1 (25/05) — Workspace ATIVO via header `X-Workspace-Id`.
    // Sem header → request.workspaceAtivoId = null (fallback: vê união de
    // todos os perfis, comportamento S13/S14).
    // Com header → valida que o ID está nos deptos do user no módulo
    // WORKSPACE; se inválido → null (não dá erro pra não quebrar sessão,
    // o frontend tenta de novo). UI multi-perfil define explicitamente
    // via WorkspaceSwitcher; single-perfil pode pular.
    const ativoHeader = request.headers?.['x-workspace-id'];
    if (typeof ativoHeader === 'string' && ativoHeader.length > 0) {
      const deptosUser = (modulo.departamentos ?? []).map((d: { id: string }) => d.id);
      request.workspaceAtivoId = deptosUser.includes(ativoHeader) ? ativoHeader : null;
    } else {
      request.workspaceAtivoId = null;
    }

    return true;
  }
}
