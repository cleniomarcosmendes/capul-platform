import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { FiliaisService } from './filiais.service.js';

@Controller('filiais')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class FiliaisController {
  constructor(private readonly filiais: FiliaisService) {}

  /**
   * Lista filiais ATIVAS que o usuario autenticado tem acesso (via
   * core.usuario_filiais). Fonte para o dropdown de filial consulente.
   *
   * OPERADOR_ENTRADA basta — todos os endpoints NF-e ja exigem essa role
   * ou superior, entao quem chega aqui sempre pode consultar.
   */
  @Get()
  @RoleMinima('OPERADOR_ENTRADA')
  async listar(@CurrentUser() user: FiscalAuthenticatedUser) {
    return this.filiais.listarDoUsuario(user.id);
  }
}
