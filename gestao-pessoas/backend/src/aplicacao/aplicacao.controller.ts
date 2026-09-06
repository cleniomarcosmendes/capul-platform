import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { AplicacaoService } from './aplicacao.service.js';

export class CriterioDaAplicacaoDto {
  @IsString() criterioId!: string;
  @IsNumber() @Min(0) peso!: number;
  @IsOptional() @IsInt() ordem?: number;
}

export class CentroCustoDto {
  @IsOptional() @IsString() filial?: string;
  @IsString() centroCusto!: string;
}

export class CriarAplicacaoDto {
  @IsString() cicloId!: string;
  @IsString() modeloVersaoId!: string;
  @IsString() nome!: string;
  @IsNumber() @Min(0) pesoAvaliacao!: number;
  @IsOptional() @IsInt() ordem?: number;
  // Lista vazia é válida: perfil que usa só o questionário (aprendizes).
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CriterioDaAplicacaoDto)
  criterios?: CriterioDaAplicacaoDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CentroCustoDto)
  centrosCusto?: CentroCustoDto[];
}

export class AlvoDoPublicoDto {
  /** Como a tela montou o recorte — vira `origem` em cada linha do público. */
  @IsIn(['CENTRO_CUSTO', 'FILIAL', 'MANUAL']) origem!: 'CENTRO_CUSTO' | 'FILIAL' | 'MANUAL';
  /** O texto que explica o recorte, para o painel dizer de onde a linha veio. */
  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CentroCustoDto)
  centrosCusto?: CentroCustoDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) filiais?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) colaboradorIds?: string[];
  /**
   * Padrão `true`, como na importação de avaliadores: recorte montado por quem
   * conhece a estrutura não é o público que o RH confirmou.
   */
  @IsOptional() @IsBoolean() provisorio?: boolean;
}

@Controller('aplicacoes')
@Roles(ROLES.RH_ADMIN, ROLES.RH_CICLO)
export class AplicacaoController {
  constructor(private readonly aplicacoes: AplicacaoService) {}

  @Get('ciclo/:cicloId') listar(@Param('cicloId') cicloId: string) {
    return this.aplicacoes.listarDoCiclo(cicloId);
  }

  @Post() criar(@Body() dto: CriarAplicacaoDto, @CurrentUser() user: JwtPayload) {
    return this.aplicacoes.criar(dto, user.sub);
  }

  /** O público NOMINAL da aplicação — uma linha por pessoa. */
  @Get(':aplicacaoId/publico')
  publico(@Param('aplicacaoId') aplicacaoId: string) {
    return this.aplicacoes.publicoDe(aplicacaoId);
  }

  /**
   * O que o atalho VAI trazer — sem gravar. É onde a tela descobre quem já está
   * em outra aplicação do ciclo, em vez de falhar no INSERT.
   */
  @Post(':aplicacaoId/publico/previa') @HttpCode(200)
  previaDoPublico(@Param('aplicacaoId') aplicacaoId: string, @Body() dto: AlvoDoPublicoDto) {
    return this.aplicacoes.previaDoPublico(aplicacaoId, dto);
  }

  @Post(':aplicacaoId/publico') @HttpCode(200)
  adicionarAoPublico(
    @Param('aplicacaoId') aplicacaoId: string,
    @Body() dto: AlvoDoPublicoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.aplicacoes.adicionarAoPublico(aplicacaoId, dto, dto.provisorio ?? true, user.sub);
  }

  @Delete(':aplicacaoId/publico/:colaboradorId')
  removerDoPublico(
    @Param('aplicacaoId') aplicacaoId: string,
    @Param('colaboradorId') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.aplicacoes.removerDoPublico(aplicacaoId, colaboradorId, user.sub);
  }
}
