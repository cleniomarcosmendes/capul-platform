import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { DesignacaoService } from './designacao.service.js';

export class DecidirDto {
  @IsString() colaboradorId!: string;
  @IsIn(['INCLUIR', 'EXCLUIR']) decisao!: 'INCLUIR' | 'EXCLUIR';
  // Sem motivo, a linha vira "alguém decidiu algo" — inútil na contestação.
  @IsString() @MinLength(3) justificativa!: string;
}

export class DesignarDto {
  @IsString() avaliadoId!: string;
  @IsString() avaliadorId!: string;
}

@Controller('designacao')
@Roles(ROLES.RH_ADMIN, ROLES.RH_CICLO)
export class DesignacaoController {
  constructor(private readonly designacao: DesignacaoService) {}

  /** Lista da aplicação: incluídos E excluídos, com motivo. Nada é filtrado. */
  @Get('aplicacao/:aplicacaoId')
  listar(@Param('aplicacaoId') aplicacaoId: string) {
    return this.designacao.listar(aplicacaoId);
  }

  @Post('ciclo/:cicloId/decisao') @HttpCode(200)
  decidir(@Param('cicloId') cicloId: string, @Body() dto: DecidirDto, @CurrentUser() user: JwtPayload) {
    return this.designacao.decidir(cicloId, dto.colaboradorId, dto.decisao, dto.justificativa, user.sub);
  }

  @Post('aplicacao/:aplicacaoId/designar') @HttpCode(200)
  designar(@Param('aplicacaoId') id: string, @Body() dto: DesignarDto, @CurrentUser() user: JwtPayload) {
    return this.designacao.designar(id, dto.avaliadoId, dto.avaliadorId, user.sub, 'MANUAL');
  }
}
