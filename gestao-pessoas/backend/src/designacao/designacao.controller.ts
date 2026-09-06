import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
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

export class CopiarDoCadastroDto {
  /**
   * false (padrão) = PRÉVIA: calcula tudo e não grava nada. Mesmo padrão da
   * importação da planilha — mil linhas conferidas depois de gravadas não são
   * conferidas.
   */
  @IsOptional() @IsBoolean() aplicar?: boolean;
  /**
   * Sem isto, quem o RH já designou À MÃO dentro do ciclo não é tocado: a linha
   * vira `AJUSTE_MANUAL_DO_CICLO` no relatório, com nome. O padrão PRESERVA.
   */
  @IsOptional() @IsBoolean() substituirManuais?: boolean;
}

@Controller('designacao')
@Roles(ROLES.RH_ADMIN, ROLES.RH_CICLO)
export class DesignacaoController {
  constructor(private readonly designacao: DesignacaoService) {}

  /** Lista da aplicação: incluídos E excluídos, com motivo. Nada é filtrado. */
  @Get('aplicacao/:aplicacaoId')
  listar(
    @Param('aplicacaoId') aplicacaoId: string,
    @ColaboradorAtual('id') colaboradorId?: string,
  ) {
    return this.designacao.listar(aplicacaoId, colaboradorId ?? null);
  }

  @Post('ciclo/:cicloId/decisao') @HttpCode(200)
  decidir(@Param('cicloId') cicloId: string, @Body() dto: DecidirDto, @CurrentUser() user: JwtPayload) {
    return this.designacao.decidir(cicloId, dto.colaboradorId, dto.decisao, dto.justificativa, user.sub);
  }

  @Post('aplicacao/:aplicacaoId/designar') @HttpCode(200)
  designar(@Param('aplicacaoId') id: string, @Body() dto: DesignarDto, @CurrentUser() user: JwtPayload) {
    return this.designacao.designar(id, dto.avaliadoId, dto.avaliadorId, user.sub, 'MANUAL');
  }

  /**
   * Copia o cadastro da plataforma para a designação do ciclo. `aplicar: false`
   * (o padrão) é a prévia — a tela mostra o que VAI acontecer e só então grava.
   */
  @Post('ciclo/:cicloId/copiar-do-cadastro') @HttpCode(200)
  copiarDoCadastro(
    @Param('cicloId') cicloId: string,
    @Body() dto: CopiarDoCadastroDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.designacao.copiarDoCadastro(
      cicloId,
      { aplicar: dto.aplicar ?? false, substituirManuais: dto.substituirManuais ?? false },
      user.sub,
    );
  }
}
