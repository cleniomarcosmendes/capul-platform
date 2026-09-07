import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsDate, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { CicloService } from './ciclo.service.js';

export class ConceitoDto {
  @IsString() descricao!: string;
  @IsNumber() limiteInferior!: number;
  @IsNumber() limiteSuperior!: number;
  @IsOptional() @IsString() cor?: string;
  @IsInt() ordem!: number;
}

export class CriarCicloDto {
  @IsString() nome!: string;
  @Type(() => Date) @IsDate() periodoInicio!: Date;
  @Type(() => Date) @IsDate() periodoFim!: Date;
  @Type(() => Date) @IsDate() dataBase!: Date;
  @IsOptional() @IsInt() @Min(1) janelaTreinamentoMeses?: number;
  @IsOptional() @IsBoolean() incluirAfastados?: boolean;
  @IsOptional() @IsBoolean() valeParaMerito?: boolean;
  @ValidateNested({ each: true }) @Type(() => ConceitoDto) @ArrayMinSize(1) conceitos!: ConceitoDto[];
}

/** Montar o ciclo é de RH_CICLO; abrir e encerrar, só de RH_ADMIN. */
export class ReabrirCicloDto {
  /** Como no reabrir avaliação: sem motivo não há reabertura. */
  @IsString() @MinLength(3) motivo!: string;
}

export class AjustarPeriodoDto {
  @Type(() => Date) @IsDate() periodoInicio!: Date;
  @Type(() => Date) @IsDate() periodoFim!: Date;
}

@Controller('ciclos')
@Roles(ROLES.RH_ADMIN, ROLES.RH_CICLO)
export class CicloController {
  constructor(private readonly ciclos: CicloService) {}

  @Get() listar() { return this.ciclos.listar(); }

  @Get(':id') obter(@Param('id') id: string) { return this.ciclos.obter(id); }

  @Post() criar(@Body() dto: CriarCicloDto, @CurrentUser() user: JwtPayload) {
    return this.ciclos.criar(dto, user.sub);
  }

  // Abrir gera nota: é ato de quem responde pelo ciclo, não de quem o monta.
  /**
   * Só o PERÍODO. Data-base e janela de treinamento não entram: mudá-las moveria
   * a nota de quem já respondeu, em silêncio. Ver `ajustarPeriodo`.
   */
  @Patch(':id/periodo') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  ajustarPeriodo(
    @Param('id') id: string,
    @Body() dto: AjustarPeriodoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ciclos.ajustarPeriodo(id, dto.periodoInicio, dto.periodoFim, user.sub);
  }

  @Post(':id/abrir') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  abrir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ciclos.abrir(id, user.sub);
  }

  /** Reabrir é do RH_ADMIN, como encerrar — e exige motivo. */
  @Post(':id/reabrir') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  reabrir(@Param('id') id: string, @Body() dto: ReabrirCicloDto, @CurrentUser() user: JwtPayload) {
    return this.ciclos.reabrir(id, dto.motivo, user.sub);
  }

  @Post(':id/encerrar') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  encerrar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ciclos.encerrar(id, user.sub);
  }
}
