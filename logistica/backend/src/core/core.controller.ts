import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { resolverFilialLeitura } from '../common/filial-scope.js';
import { CoreLookupService } from './core-lookup.service.js';

/**
 * Lookups do core expostos ao frontend da logística (read-only). Hoje:
 * motoristas elegíveis (usuários com acesso ao módulo Logística da filial),
 * evitando listar a base inteira de colaboradores no seletor de motorista.
 */
@Controller('motoristas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class CoreController {
  constructor(private readonly core: CoreLookupService) {}

  /** Motoristas da filial: usuários ATIVOS com papel ENTREGADOR no módulo
   *  Logística (não lista gestores/coordenadores/supervisores). */
  @Get()
  listar(@CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    const fil = resolverFilialLeitura(user, filialId) ?? user.filialId;
    return this.core.motoristasLogistica(fil ?? '');
  }
}
