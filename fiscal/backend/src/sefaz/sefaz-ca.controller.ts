import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { SefazCaService } from './sefaz-ca.service.js';
import { SefazAgentService } from './sefaz-agent.service.js';

/**
 * Endpoints para consulta e atualização da cadeia TLS ICP-Brasil usada para
 * validar as conexões SEFAZ. Usado pelo Header/Dashboard/AdminPage do frontend.
 */
@Controller('sefaz/ca')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class SefazCaController {
  constructor(
    private readonly ca: SefazCaService,
    private readonly agent: SefazAgentService,
  ) {}

  /**
   * Status completo da cadeia. Aberto para qualquer role com acesso ao Fiscal
   * (inclusive OPERADOR_ENTRADA) — informação não-sensível, útil para contexto.
   */
  @Get('status')
  @RoleMinima('OPERADOR_ENTRADA')
  status() {
    return this.ca.getStatus();
  }

  /**
   * Dispara refresh manual da cadeia. Restrito a ADMIN_TI — é uma operação
   * que modifica arquivos no disco do servidor e consome rede externa.
   * Após o refresh, invalida o cache do agent para que o próximo POST SEFAZ
   * use a nova cadeia.
   */
  @Post('refresh')
  @RoleMinima('ADMIN_TI')
  async refresh(@CurrentUser() user: FiscalAuthenticatedUser) {
    const result = await this.ca.refresh('MANUAL', user.email);
    // Força o próximo getAgent() a reconstruir o https.Agent com a nova cadeia
    this.agent.invalidate();
    return result;
  }
}
