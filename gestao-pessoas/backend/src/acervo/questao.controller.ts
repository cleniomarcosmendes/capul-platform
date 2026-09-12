import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { QuestaoService } from './questao.service.js';

export class AncoraDto {
  @IsString() @MinLength(3) @MaxLength(400) descricao!: string;
  /** Omitido = usa o valor da escala do acervo naquela posição. */
  @IsOptional() @IsNumber() valor?: number;
}

export class QuestaoDto {
  @IsString() @MinLength(3) @MaxLength(300) enunciado!: string;
  @IsString() classificacaoId!: string;
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => AncoraDto)
  ancoras!: AncoraDto[];
}

/**
 * CRIAR e EDITAR questão do acervo — Etapa 6.
 *
 * ⭐ `RH_ADMIN` e `RH_MODELO`, os mesmos do resto do editor. `RH_MODELO` é o
 * papel que `roles-rh.ts` descreve como *"monta o INSTRUMENTO: perguntas,
 * grupos, pesos"* — esta é literalmente a rota dele.
 *
 * ⚠️ Fica em `/acervo/...` de propósito: a questão é do ACERVO, não de um
 * modelo. Pendurá-la em `/modelos/:id/questoes` sugeriria que ela pertence a um
 * perfil, que é exatamente o que a unificação de 11/09 desfez.
 */
@Controller('acervo/questoes')
@Roles(ROLES.RH_ADMIN, ROLES.RH_MODELO)
export class QuestaoController {
  constructor(private readonly questoes: QuestaoService) {}

  /** A escala vigente — o formulário pré-preenche os valores com ela. */
  @Get('escala') escala() {
    return this.questoes.escala();
  }

  /**
   * ⚠️ Não existe `GET :id/efeitos`. Existiu por meio dia, buscado no hover do
   * cartão, e foi o defeito da §3.1.104: estado de bloqueio que chega depois do
   * primeiro render mostra o oposto da verdade no intervalo. Os efeitos vêm com
   * a LISTA, em `GET /acervo`.
   */

  @Post() criar(@Body() dto: QuestaoDto, @CurrentUser() user: JwtPayload) {
    return this.questoes.criar(dto, user.sub);
  }

  @Patch(':id') editar(
    @Param('id') id: string,
    @Body() dto: QuestaoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.questoes.editar(id, dto, user.sub);
  }

  @Post(':id/desativar') desativar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.questoes.desativar(id, user.sub);
  }

  @Post(':id/reativar') reativar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.questoes.reativar(id, user.sub);
  }

  @Delete(':id') apagar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.questoes.apagar(id, user.sub);
  }
}
