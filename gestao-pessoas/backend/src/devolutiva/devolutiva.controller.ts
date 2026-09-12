import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { DevolutivaService } from './devolutiva.service.js';

export class LiberarDevolutivaDto {
  /**
   * ⭐ Os ids que a PRÉVIA mostrou — não um filtro para o servidor reexecutar.
   * Ver o comentário de `previaDaLiberacao`: recalcular o alvo no clique já fez
   * a tela conferir um recorte e gravar outro (07/09).
   */
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  avaliacaoIds!: string[];
}

/**
 * ⭐ LIBERAR A DEVOLUTIVA — **só RH_ADMIN**, e a razão é a mesma do
 * `ResultadoController`, um degrau acima.
 *
 * O RH_CICLO monta o ciclo e cobra a fila, mas não lê nota de terceiro. Liberar
 * é mais que ler: é **decidir que outras pessoas passam a ler** — e o efeito não
 * volta atrás no mundo, ainda que a coluna volte.
 *
 * ⚠️ Este controller é o do RH. A rota que o AVALIADOR usa para VER a devolutiva
 * é da etapa 2 e **não mora aqui**: pôr as duas sob o mesmo `@Roles` de classe é
 * exatamente como o `ResultadoController` acabou inalcançável para o avaliador.
 */
@Controller('devolutiva')
@Roles(ROLES.RH_ADMIN)
export class DevolutivaController {
  constructor(private readonly devolutiva: DevolutivaService) {}

  /** A prévia do lote. `aplicacaoId` recorta; sem ele, o ciclo inteiro. */
  @Get('previa/:cicloId')
  previa(
    @Param('cicloId') cicloId: string,
    @Query('aplicacaoId') aplicacaoId: string | undefined,
    @ColaboradorAtual('id') colaboradorId?: string,
  ) {
    return this.devolutiva.previaDaLiberacao(
      { cicloId, aplicacaoId: aplicacaoId ?? null },
      colaboradorId ?? null,
    );
  }

  @Post('liberar') @HttpCode(200)
  liberar(
    @Body() dto: LiberarDevolutivaDto,
    @ColaboradorAtual('id') colaboradorId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.devolutiva.liberar(dto.avaliacaoIds, {
      colaboradorId: colaboradorId ?? null,
      usuarioId: user.sub,
    });
  }
}
