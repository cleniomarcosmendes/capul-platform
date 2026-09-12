import { Body, Controller, Get, HttpCode, Param, Post, Delete } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { DesignacaoService } from './designacao.service.js';
import { MOTIVO_MINIMO } from '../common/motivo.js';

export class DecidirDto {
  @IsString() colaboradorId!: string;
  @IsIn(['INCLUIR', 'EXCLUIR']) decisao!: 'INCLUIR' | 'EXCLUIR';
  // Sem motivo, a linha vira "alguém decidiu algo" — inútil na contestação.
  // Ato de UMA linha (um `colaboradorId`) — mínimo pequeno. Ver `common/motivo.ts`.
  @IsString() @MinLength(MOTIVO_MINIMO) justificativa!: string;
}

export class DesignarDto {
  @IsString() avaliadoId!: string;
  @IsString() avaliadorId!: string;
  /** Trocar o avaliador de avaliação já respondida — só com confirmação. */
  @IsOptional() @IsBoolean() confirmarTrocaDeAvaliador?: boolean;
}

export class PreviaDaDesignacaoDto {
  @IsArray() @IsString({ each: true }) @ArrayMinSize(1) avaliadoIds!: string[];
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

  /**
   * ⭐ DESFAZER a designação — tira o avaliador, mantém a pessoa no ciclo.
   * Não confundir com o EXCLUIR (`/decisao`), que declara que ela está fora.
   *
   * `DELETE` porque o que sai é a designação; a pessoa continua onde estava.
   */
  @Delete('ciclo/:cicloId/designacao/:avaliadoId') @HttpCode(200)
  desfazerDesignacao(
    @Param('cicloId') cicloId: string,
    @Param('avaliadoId') avaliadoId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.designacao.desfazerDesignacao(cicloId, avaliadoId, user.sub);
  }

  @Post('aplicacao/:aplicacaoId/designar') @HttpCode(200)
  designar(@Param('aplicacaoId') id: string, @Body() dto: DesignarDto, @CurrentUser() user: JwtPayload) {
    return this.designacao.designar(
      id, dto.avaliadoId, dto.avaliadorId, user.sub, 'MANUAL',
      dto.confirmarTrocaDeAvaliador ?? false,
    );
  }

  /**
   * Copia o cadastro da plataforma para a designação do ciclo. `aplicar: false`
   * (o padrão) é a prévia — a tela mostra o que VAI acontecer e só então grava.
   */
  /**
   * ⭐ O que o "Definir avaliador" vai fazer com cada um dos selecionados —
   * lido ANTES do clique valer. A conta é do serviço, não da tela.
   */
  @Post('aplicacao/:aplicacaoId/designar/previa') @HttpCode(200)
  previaDaDesignacao(
    @Param('aplicacaoId') aplicacaoId: string,
    @Body() dto: PreviaDaDesignacaoDto,
  ) {
    return this.designacao.previaDaDesignacao(aplicacaoId, dto.avaliadoIds, dto.avaliadorId);
  }

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
