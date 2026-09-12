import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { IsArray, IsString, MaxLength, MinLength } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { ClassificacaoService } from './classificacao.service.js';

export class NomeDto {
  @IsString() @MinLength(2) @MaxLength(80) nome!: string;
}

export class OrdemDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
}

/**
 * CADASTRO das classificações — Etapa 5 do editor.
 *
 * ⭐ `RH_ADMIN` **e** `RH_MODELO`. A classificação é a peça que carrega o peso
 * no arranjo, e montar o instrumento é exatamente o que `RH_MODELO` faz
 * (`roles-rh.ts`: *"monta o INSTRUMENTO: perguntas, grupos, pesos"*). `RH_CICLO`
 * fica de fora: ele LÊ o instrumento para escolher, não o define.
 *
 * ⚠️ Diferente do cadastro de CRITÉRIOS, que é só `RH_ADMIN` — lá a régua vale
 * para todos os ciclos assim que muda. Aqui nada muda enquanto uma versão não
 * for publicada, e publicar continua sendo de `RH_ADMIN`.
 */
@Controller('classificacoes')
@Roles(ROLES.RH_ADMIN, ROLES.RH_MODELO)
export class ClassificacaoController {
  constructor(private readonly classificacoes: ClassificacaoService) {}

  @Get() listar() {
    return this.classificacoes.listar();
  }

  @Post() criar(@Body() dto: NomeDto, @CurrentUser() user: JwtPayload) {
    return this.classificacoes.criar(dto.nome, user.sub);
  }

  @Patch(':id') renomear(
    @Param('id') id: string,
    @Body() dto: NomeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.classificacoes.renomear(id, dto.nome, user.sub);
  }

  /** A lista INTEIRA — ver o comentário do serviço. */
  @Put('ordem') reordenar(@Body() dto: OrdemDto, @CurrentUser() user: JwtPayload) {
    return this.classificacoes.reordenar(dto.ids, user.sub);
  }

  @Post(':id/desativar') desativar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.classificacoes.desativar(id, user.sub);
  }

  @Post(':id/reativar') reativar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.classificacoes.reativar(id, user.sub);
  }

  @Delete(':id') apagar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.classificacoes.apagar(id, user.sub);
  }
}
