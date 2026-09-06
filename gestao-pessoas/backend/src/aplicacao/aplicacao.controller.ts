import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
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
}
