import { Controller, Get, Param } from '@nestjs/common';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
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

  @Get(':id') memoria(@Param('id') id: string) {
    return this.resultados.memoria(id);
  }
}
