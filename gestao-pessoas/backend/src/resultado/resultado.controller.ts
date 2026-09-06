import { Controller, Get, Param, Req } from '@nestjs/common';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { ResultadoService } from './resultado.service.js';

/**
 * Só RH_ADMIN. RH_CICLO monta e cobra a fila (painel), mas não lê nota de
 * terceiro — designar quem julga quem já é autoridade suficiente sem juntar a
 * ela o resultado do julgamento.
 */
@Controller('resultados')
@Roles(ROLES.RH_ADMIN)
export class ResultadoController {
  constructor(private readonly resultados: ResultadoService) {}

  @Get('ciclo/:cicloId')
  doCiclo(@Param('cicloId') cicloId: string, @ColaboradorAtual('id') colaboradorId?: string) {
    return this.resultados.doCiclo(cicloId, colaboradorId ?? null);
  }

  /**
   * ⚠️ Passa o CONTEXTO porque a §8 da spec exige registrar em `rh.auditoria` o
   * acesso a resultado individual por quem não é o avaliador designado — e este
   * é o único lugar do módulo que mostra a observação escrita pelo avaliador.
   */
  @Get(':id') memoria(
    @Param('id') id: string,
    @ColaboradorAtual('id') colaboradorId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.resultados.memoria(id, {
      colaboradorId: colaboradorId ?? null,
      usuarioId: user.sub,
      ip: req.ip,
    });
  }
}
