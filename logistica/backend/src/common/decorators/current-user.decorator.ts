import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Payload do JWT (mesma forma emitida pelo Auth Gateway). */
export interface JwtPayload {
  sub: string;
  email?: string;
  nome?: string;
  empresaId?: string;
  filialId?: string;
  departamentoId?: string;
  // Tipo do usuário: INDIVIDUAL (pessoa) ou PADRAO (login genérico/compartilhado).
  tipo?: 'INDIVIDUAL' | 'PADRAO';
  modulos?: ModuloPayload[];
}

/** Um departamento onde o usuário tem permissão no módulo, com a role de LÁ. */
export interface ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades?: string[];
  isTI?: boolean;
}

/**
 * Módulo no JWT. A permissão é (usuário × módulo × DEPARTAMENTO × role) —
 * `core.permissoes_modulo` tem UNIQUE nessa tripla, então a mesma pessoa pode ter
 * papéis diferentes em departamentos diferentes do MESMO módulo.
 *
 * ⚠️ `role` é DENORMALIZADA: é a role do PRIMEIRO item de `departamentos[]`, mantida
 * pelo Auth Gateway só por retrocompatibilidade (`build-modulos-payload.ts`). Ler
 * `role` faz o módulo enxergar UM papel e ignorar os demais, calado. Use sempre
 * `rolesLogistica(user)` (../roles-logistica.js) — nunca este campo direto.
 */
export interface ModuloPayload {
  codigo: string;
  /** @deprecated Legado — role do 1º depto. Use `rolesLogistica(user)`. */
  role: string;
  /** Ausente em tokens antigos → os helpers caem em `role`. */
  departamentos?: ModuloDepartamentoPayload[];
}

/**
 * Injeta o usuário autenticado (payload do JWT) no handler.
 * `@CurrentUser()` → payload inteiro; `@CurrentUser('sub')` → campo.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;
    return data ? user?.[data] : user;
  },
);
