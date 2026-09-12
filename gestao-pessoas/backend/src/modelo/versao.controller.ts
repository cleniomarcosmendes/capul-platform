import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { VersaoService } from './versao.service.js';
import { ArranjoService } from './arranjo.service.js';
import { PublicacaoService } from './publicacao.service.js';

export class GrupoDoArranjoDto {
  @IsString() classificacaoId!: string;
  @IsNumber() peso!: number;
}
export class QuestaoDoArranjoDto {
  @IsString() perguntaId!: string;
}
export class ArranjoDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => GrupoDoArranjoDto)
  grupos!: GrupoDoArranjoDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuestaoDoArranjoDto)
  questoes!: QuestaoDoArranjoDto[];
}

/**
 * VERSÕES DO MODELO — duplicar para rascunho e descartar rascunho (Etapa 2).
 *
 * ⭐ `RH_ADMIN` e `RH_MODELO`, os mesmos das classificações e pela mesma razão:
 * criar um rascunho não muda nada para ninguém. **PUBLICAR** é que é o ato com
 * consequência, e ele é da Etapa 4 — só `RH_ADMIN`.
 */
@Controller('modelos')
@Roles(ROLES.RH_ADMIN, ROLES.RH_MODELO)
export class VersaoController {
  constructor(
    private readonly versoes: VersaoService,
    private readonly arranjos: ArranjoService,
    private readonly publicacoes: PublicacaoService,
  ) {}

  @Get(':modeloId/versoes') doModelo(@Param('modeloId') modeloId: string) {
    return this.versoes.doModelo(modeloId);
  }

  /** A prévia — a MESMA função que o ato consulta, para a tela não prometer o que ele recusa. */
  @Get('versoes/:versaoId/previa-duplicar') previa(@Param('versaoId') versaoId: string) {
    return this.versoes.previaDeDuplicar(versaoId);
  }

  @Post('versoes/:versaoId/duplicar')
  duplicar(@Param('versaoId') versaoId: string, @CurrentUser() user: JwtPayload) {
    return this.versoes.duplicar(versaoId, user.sub);
  }

  @Delete('versoes/:versaoId')
  descartar(@Param('versaoId') versaoId: string, @CurrentUser() user: JwtPayload) {
    return this.versoes.descartar(versaoId, user.sub);
  }

  // ── Etapa 3: montar o arranjo ───────────────────────────────────────────────

  @Get('versoes/:versaoId/arranjo') lerArranjo(@Param('versaoId') versaoId: string) {
    return this.arranjos.ler(versaoId);
  }

  /** ⚠️ O arranjo INTEIRO. Ver a trava 2 do `arranjo.service`. */
  @Put('versoes/:versaoId/arranjo')
  gravarArranjo(
    @Param('versaoId') versaoId: string,
    @Body() dto: ArranjoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.arranjos.gravar(versaoId, dto, user.sub);
  }

  // ── Etapa 4: publicar ───────────────────────────────────────────────────────

  /**
   * A prévia é de quem MONTA (lê os papéis do controller), mas o ATO é só de
   * `RH_ADMIN` — ver o `@Roles` do método abaixo.
   */
  @Get('versoes/:versaoId/previa-publicar') previaPublicar(@Param('versaoId') versaoId: string) {
    return this.publicacoes.previa(versaoId);
  }

  /**
   * ⭐⭐ PUBLICAR — `RH_ADMIN` **e `RH_MODELO`**, decidido em 12/09.
   *
   * ⚠️ Nasceu só `RH_ADMIN`, com o argumento "monta, não publica". A varredura
   * mostrou o que esse desenho produz: o `RH_MODELO` percorre o editor inteiro
   * — duplicar, montar, mudar peso, ler a análise de impacto — e **toma 403 no
   * confirmar**. E não havia para quem entregar o rascunho: o papel que
   * apertaria o botão é o `RH_ADMIN`, que é quem monta CICLO, não instrumento.
   *
   * ⭐ **Papel que produz rascunho para outra pessoa apertar o botão precisa
   * dessa outra pessoa no fluxo.** Sem ela, a separação não separa nada — só
   * interrompe. O papel se chama "monta o instrumento", o menu lhe dá
   * Questionários, Acervo e Classificações, e a tela oferece o botão.
   */
  @Post('versoes/:versaoId/publicar')
  publicar(@Param('versaoId') versaoId: string, @CurrentUser() user: JwtPayload) {
    return this.publicacoes.publicar(versaoId, user.sub);
  }
}
