import { Body, Controller, Get, HttpCode, Param, Patch, Req } from '@nestjs/common';
import { BooleanoEstrito } from '../common/booleano-estrito.js';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { DevolutivaService } from './devolutiva.service.js';

export class MarcarConduzidaDto {
  @BooleanoEstrito() conduzida!: boolean;
}

/**
 * ⭐⭐ A DEVOLUTIVA DO LADO DO AVALIADOR — controller SEPARADO, de propósito.
 *
 * O `DevolutivaController` é `@Roles(RH_ADMIN)` na classe, e é o do RH. Pôr a
 * rota do avaliador debaixo dele a deixaria inalcançável — que é exatamente
 * como o `ResultadoController` acabou fechado para quem mais precisa dela: a
 * memória de cálculo existe desde sempre e o avaliador nunca pôde abrir uma.
 *
 * ⚠️ `@Roles(AVALIADOR)` é o portão de PAPEL, e ele não basta. Quem decide o que
 * cada avaliador alcança é o **REGISTRO** (`avaliadorId`, `avaliadoId` e a marca
 * de liberação), verificado no service — inclusive para o **ADMIN**, que passa
 * o RolesGuard por bypass e mesmo assim não vê avaliação que não designou.
 */
@Controller('devolutiva')
@Roles(ROLES.AVALIADOR)
export class DevolutivaDoAvaliadorController {
  constructor(private readonly devolutiva: DevolutivaService) {}

  /**
   * Pela chave que o avaliador TEM — `avaliacaoId`, o que a fila dele carrega.
   * A tradução para `resultadoId` é do service; ver `paraOAvaliador`.
   */
  @Get('avaliacao/:avaliacaoId')
  minha(
    @Param('avaliacaoId') avaliacaoId: string,
    @ColaboradorAtual('id') colaboradorId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.devolutiva.paraOAvaliador(avaliacaoId, {
      colaboradorId: colaboradorId ?? null,
      usuarioId: user.sub,
      ip: req.ip,
    });
  }

  /**
   * ⭐ "Já conversei com esta pessoa" — DECLARAÇÃO do avaliador, e reversível.
   *
   * ⚠️ O sistema não tem como saber se a conversa aconteceu, e não finge que
   * sabe: o número que o RH lê é **"avaliadores que declararam ter
   * conversado"**. Marcar por engano tem volta — e sem trava de status de
   * ciclo, porque a devolutiva vive num ciclo já encerrado.
   */
  @Patch('avaliacao/:avaliacaoId/conduzida') @HttpCode(200)
  conduzida(
    @Param('avaliacaoId') avaliacaoId: string,
    @Body() dto: MarcarConduzidaDto,
    @ColaboradorAtual('id') colaboradorId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.devolutiva.marcarConduzida(avaliacaoId, dto.conduzida, {
      colaboradorId: colaboradorId ?? null,
      usuarioId: user.sub,
    });
  }
}
