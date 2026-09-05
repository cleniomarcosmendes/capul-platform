import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ColaboradorResumo } from '../../identidade/identidade.service.js';

/**
 * O COLABORADOR de quem está logado, resolvido uma vez por requisição pelo
 * `IdentidadeGuard` (ver identidade.service.ts).
 *
 * `@ColaboradorAtual()` → o resumo inteiro; `@ColaboradorAtual('id')` → o id,
 * que é o lado esquerdo da separação de funções.
 *
 * Nunca é undefined em rota protegida: sem resolver, o guard já negou o acesso
 * ao módulo (falha fechada).
 */
export const ColaboradorAtual = createParamDecorator(
  (campo: keyof ColaboradorResumo | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const colaborador = req.colaborador as ColaboradorResumo | undefined;
    return campo ? colaborador?.[campo] : colaborador;
  },
);
