import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { VersaoService } from './versao.service.js';

/**
 * VERSÕES DO MODELO — duplicar para rascunho e descartar rascunho (Etapa 2).
 *
 * ⭐ `RH_ADMIN` e `RH_MODELO`, os mesmos das classificações e pela mesma razão:
 * criar um rascunho não muda nada para ninguém. **PUBLICAR** é que é o ato com
 * consequência, e ele é da Etapa 4 — só `RH_ADMIN`.
 */
@Controller('modelos')
@Roles(ROLES.RH_ADMIN, ROLES.RH_MODELO)
export class VersaoController {
  constructor(private readonly versoes: VersaoService) {}

  @Get(':modeloId/versoes') doModelo(@Param('modeloId') modeloId: string) {
    return this.versoes.doModelo(modeloId);
  }

  /** A prévia — a MESMA função que o ato consulta, para a tela não prometer o que ele recusa. */
  @Get('versoes/:versaoId/previa-duplicar') previa(@Param('versaoId') versaoId: string) {
    return this.versoes.previaDeDuplicar(versaoId);
  }

  @Post('versoes/:versaoId/duplicar')
  duplicar(@Param('versaoId') versaoId: string, @CurrentUser() user: JwtPayload) {
    return this.versoes.duplicar(versaoId, user.sub);
  }

  @Delete('versoes/:versaoId')
  descartar(@Param('versaoId') versaoId: string, @CurrentUser() user: JwtPayload) {
    return this.versoes.descartar(versaoId, user.sub);
  }
}
