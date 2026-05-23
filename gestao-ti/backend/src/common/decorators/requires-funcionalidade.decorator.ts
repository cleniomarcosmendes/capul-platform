import { SetMetadata } from '@nestjs/common';

export const REQUIRES_FUNCIONALIDADE_KEY = 'requiresFuncionalidade';

/**
 * Marca um endpoint que exige uma funcionalidade ativa do Workspace
 * para o módulo do usuário. Usado junto com `FuncionalidadeGuard`.
 *
 * Workspace Multi-Departamento (Onda 1 Sub-fase 1.5).
 *
 * @example
 *   @Get()
 *   @RequiresFuncionalidade('CHAMADO')
 *   @UseGuards(FuncionalidadeGuard)
 *   async listChamados() { ... }
 *
 * Em DEV todos os usuários têm o depto T.I. (com todas as 12 funcionalidades
 * ativas), então o guard sempre passa. Valor real aparece na Onda 2 quando
 * outros deptos forem cadastrados com funcionalidades parciais.
 */
export const RequiresFuncionalidade = (funcionalidade: string) =>
  SetMetadata(REQUIRES_FUNCIONALIDADE_KEY, funcionalidade);
