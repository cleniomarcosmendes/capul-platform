import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_FUNCIONALIDADE_KEY } from '../decorators/requires-funcionalidade.decorator.js';

interface DepartamentoFuncs {
  funcionalidades?: string[];
}

/**
 * Guard que valida se o usuário tem a funcionalidade marcada via
 * `@RequiresFuncionalidade(X)` ativa em ao menos um dos seus departamentos
 * do módulo Gestão TI (= Workspace).
 *
 * Workspace Multi-Departamento (Onda 1 Sub-fase 1.5).
 *
 * Pré-requisitos:
 * - `GestaoTiGuard` deve ter rodado antes (popula `request.gestaoTiDepartamentos`)
 * - Endpoint deve usar `@RequiresFuncionalidade('NOME')`
 *
 * Comportamento sem o decorator: passa direto (no-op).
 * Comportamento com JWT antigo (pré Sub-fase 1.4): `gestaoTiDepartamentos`
 * é `[]` → bloqueia. Em DEV não acontece porque todos os tokens após login
 * são gerados pelo novo formato.
 */
@Injectable()
export class FuncionalidadeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const funcionalidade = this.reflector.get<string | undefined>(
      REQUIRES_FUNCIONALIDADE_KEY,
      context.getHandler(),
    );
    if (!funcionalidade) return true;

    const req = context.switchToHttp().getRequest();
    const departamentos: DepartamentoFuncs[] = req.gestaoTiDepartamentos ?? [];

    const tem = departamentos.some((d) =>
      d.funcionalidades?.includes(funcionalidade),
    );

    if (!tem) {
      throw new ForbiddenException(
        `Funcionalidade "${funcionalidade}" não habilitada nos departamentos do usuário no módulo Gestão de TI.`,
      );
    }

    return true;
  }
}
