import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { ApuracaoService } from './apuracao.service.js';

export class ApurarDto {
  @IsIn(['CICLO', 'APLICACAO']) tipo!: 'CICLO' | 'APLICACAO';
  @IsOptional() @IsString() cicloId?: string;
  @IsOptional() @IsString() aplicacaoId?: string;
}

/**
 * ⭐ Só por CICLO ou por APLICAÇÃO. Não existe — e não pode passar a existir —
 * apuração recortada por colaborador: seria o caminho legítimo para alguém
 * isolar a própria linha e contornar a separação de funções.
 */
@Controller('apuracao')
@Roles(ROLES.RH_ADMIN)
export class ApuracaoController {
  constructor(private readonly apuracao: ApuracaoService) {}

  @Post()
  @HttpCode(200)
  apurar(@Body() dto: ApurarDto, @CurrentUser() user: JwtPayload) {
    const escopo =
      dto.tipo === 'CICLO'
        ? ({ tipo: 'CICLO', cicloId: dto.cicloId ?? '' } as const)
        : ({ tipo: 'APLICACAO', aplicacaoId: dto.aplicacaoId ?? '' } as const);
    return this.apuracao.apurar(escopo, user.sub);
  }
}
