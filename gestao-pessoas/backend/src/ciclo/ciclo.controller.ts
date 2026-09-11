import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsDate, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { CicloService } from './ciclo.service.js';

import { MOTIVO_MINIMO, MOTIVO_MINIMO_EM_MASSA } from '../common/motivo.js';

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
  /**
   * ⭐ ATO EM MASSA, e por isso o mínimo é o GRANDE (09/09).
   *
   * Nasceu com o mínimo de uma linha ("como no reabrir avaliação") — e reabrir
   * o CICLO não se parece com reabrir UMA avaliação: devolve designação,
   * público e apuração do ciclo inteiro, e quem estava fora volta a poder
   * entrar. É exatamente o alcance que `MOTIVO_MINIMO_EM_MASSA` descreve.
   * Ver `common/motivo.ts`.
   *
   * ⚠️ **Piso do DTO, não a regra** — mesmo arranjo do `EncerrarCicloDto`. Quem
   * exige `MOTIVO_MINIMO_EM_MASSA` é o service, porque a mensagem dele ENSINA
   * ("é o que responde, meses depois, por que um ciclo encerrado voltou a
   * aceitar mudança" + quantos caracteres faltam). Com o mínimo grande aqui, o
   * class-validator responde primeiro com *"motivo must be longer than or equal
   * to 15 characters"* e a frase útil vira código morto.
   */
  @IsString() @MinLength(MOTIVO_MINIMO) motivo!: string;
}

/**
 * ⭐ Encerrar com pendência: confirmação EXPLÍCITA + motivo. Mesmo contrato do
 * `confirmarPendentes` do RDV na Logística — a API recusa e diz quantas são, e
 * a tela só reenvia depois de perguntar.
 */
export class EncerrarCicloDto {
  @IsOptional() @IsBoolean() confirmarPendentes?: boolean;
  /**
   * ⚠️ Piso do DTO, não a regra. Encerrar SEM pendência não cancela nada e o
   * motivo é dispensável; com pendência, quem exige `MOTIVO_MINIMO_EM_MASSA` é
   * o service, que é o único lugar que sabe quantas são.
   */
  @IsOptional() @IsString() @MinLength(MOTIVO_MINIMO) motivo?: string;
}

/**
 * ⭐ Devolver as canceladas pelo ENCERRAMENTO. Ato em massa: o mínimo grande
 * quem exige é o service, que é o único que sabe quantas são — aqui é só o piso
 * do DTO, como no `EncerrarCicloDto` e no `ReabrirCicloDto`.
 */
export class DevolverCanceladasDto {
  @IsString() @MinLength(MOTIVO_MINIMO) motivo!: string;
}

export class AjustarConceitosDto {
  @ValidateNested({ each: true }) @Type(() => ConceitoDto) @ArrayMinSize(1) conceitos!: ConceitoDto[];
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

  /**
   * ⭐ A régua de conceitos — o "ajuste fino" que o modal de criar ciclo promete.
   * RH_ADMIN e RH_CICLO: quem monta o ciclo monta a régua dele. Quem decide ATÉ
   * QUANDO é o service, que é o único que sabe se já houve apuração.
   */
  @Patch(':id/conceitos') @HttpCode(200) @Roles(ROLES.RH_ADMIN, ROLES.RH_CICLO)
  ajustarConceitos(
    @Param('id') id: string,
    @Body() dto: AjustarConceitosDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ciclos.ajustarConceitos(id, dto.conceitos, user.sub);
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

  /** ⚠️ RH_ADMIN só — inclusive para o encerramento com pendência, que é o
      mesmo degrau do reabrir: os dois desfazem ou atropelam uma regra do ciclo. */
  /**
   * ⭐⭐ O DESFAZER DO ENCERRAMENTO — e ele NÃO é o Incluir.
   *
   * A granularidade da reversão é a do ato que causou: o encerramento com
   * pendência foi UM ato sobre N avaliações, com UM motivo, então desfaz em
   * massa e por ciclo. O "Excluir" da Designação foi ato por linha e se desfaz
   * pelo **Incluir**, que desde 11/09 reverte cancelamento e elegibilidade na
   * mesma transação.
   *
   * A prévia é `@Get` e responde **mesmo com o ciclo encerrado**: ela existe
   * para ajudar a decidir SE vale reabrir. Quem exige ABERTO é o ato.
   */
  @Get(':id/devolucao/previa')
  previaDaDevolucao(@Param('id') id: string) {
    return this.ciclos.previaDaDevolucao(id);
  }

  @Post(':id/devolucao') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  devolverCanceladas(
    @Param('id') id: string,
    @Body() dto: DevolverCanceladasDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ciclos.devolverCanceladasDoEncerramento(id, dto.motivo, user.sub);
  }

  @Post(':id/encerrar') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  encerrar(
    @Param('id') id: string,
    @Body() dto: EncerrarCicloDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ciclos.encerrar(id, user.sub, dto ?? {});
  }
}
