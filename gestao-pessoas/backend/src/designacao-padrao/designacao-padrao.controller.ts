/**
 * ⚠️ Toda rota tem guard explícito. `@Roles` no controller inteiro: o cadastro
 * decide quem avalia quem, e quem avalia decide nota que tem consequência de
 * mérito. RH_ADMIN, e só.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { DesignacaoPadraoService } from './designacao-padrao.service.js';

export class DesignarDto {
  @IsString() avaliadorId!: string;
  @IsString() avaliadoId!: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
}

export class RevisarDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) ids!: string[];
}

export class PlanilhaDto {
  /** O CSV inteiro como texto — a tela lê o arquivo e manda o conteúdo. */
  @IsString() @MinLength(1) conteudo!: string;
  @IsOptional() @IsString() @MaxLength(255) arquivoNome?: string;
  /**
   * Sem isto, quem já tem designação MANUAL não é tocado: o conflito aparece na
   * prévia com nome e as duas pontas, para ela decidir. Ligar é dizer "pode
   * passar por cima do que foi ajustado à mão".
   */
  @IsOptional() @IsBoolean() substituirAjustesManuais?: boolean;
}

export class ImportarDto extends PlanilhaDto {
  /** A conferência que a PRÉVIA devolveu. Sem ela não grava. */
  @IsString() conferencia!: string;
  /**
   * Padrão `true`. Passar `false` é afirmar que esta lista é a decisão do RH
   * sobre quem avalia quem — não o palpite de quem conhece a estrutura.
   */
  @IsOptional() @IsBoolean() provisorio?: boolean;
}

@Controller('designacao-padrao')
@Roles(ROLES.RH_ADMIN)
export class DesignacaoPadraoController {
  constructor(private readonly servico: DesignacaoPadraoService) {}

  /** A visão principal: quem NÃO está na lista de ninguém. */
  @Get('pendencias')
  pendencias() {
    return this.servico.pendencias();
  }

  @Get('avaliadores')
  porAvaliador() {
    return this.servico.porAvaliador();
  }

  @Get('avaliadores/:avaliadorId')
  listaDe(@Param('avaliadorId') avaliadorId: string) {
    return this.servico.listaDe(avaliadorId);
  }

  @Post() @HttpCode(200)
  designar(@Body() dto: DesignarDto, @CurrentUser() user: JwtPayload) {
    return this.servico.designar(dto.avaliadorId, dto.avaliadoId, user.sub, dto.observacao);
  }

  @Delete(':id')
  remover(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.servico.remover(id, user.sub);
  }

  @Post('revisar') @HttpCode(200)
  revisar(@Body() dto: RevisarDto, @CurrentUser() user: JwtPayload) {
    return this.servico.revisar(dto.ids, user.sub);
  }

  /** Prévia obrigatória — não grava nada e devolve a conferência do arquivo. */
  @Post('importacao/previa') @HttpCode(200)
  previa(@Body() dto: PlanilhaDto) {
    return this.servico.previaDaImportacao(dto.conteudo, dto.substituirAjustesManuais ?? false);
  }

  @Post('importacao') @HttpCode(200)
  importar(@Body() dto: ImportarDto, @CurrentUser() user: JwtPayload) {
    return this.servico.importar(
      dto.conteudo,
      dto.arquivoNome ?? 'planilha.csv',
      dto.conferencia,
      dto.substituirAjustesManuais ?? false,
      user.sub,
      dto.provisorio ?? true,
    );
  }

  @Get('importacoes')
  listarImportacoes() {
    return this.servico.listarImportacoes();
  }

  @Post('importacoes/:id/desfazer') @HttpCode(200)
  desfazer(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.servico.desfazerImportacao(id, user.sub);
  }
}
