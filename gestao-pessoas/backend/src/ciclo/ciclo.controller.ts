import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsDate, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
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
  @Post(':id/abrir') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  abrir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ciclos.abrir(id, user.sub);
  }

  @Post(':id/encerrar') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  encerrar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ciclos.encerrar(id, user.sub);
  }
}
