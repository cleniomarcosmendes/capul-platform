import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { QUALQUER_PAPEL_DO_MODULO, ROLES, podeVerResultados } from '../common/roles-rh.js';
import { AvaliacaoService } from './avaliacao.service.js';
import type { ContextoAcesso } from './avaliacao-acesso.service.js';

export class ResponderDto {
  @IsString() perguntaId!: string;
  @IsString() alternativaId!: string;
}
export class EnviarDto {
  @IsOptional() @IsString() observacao?: string;
}
export class ReabrirDto {
  @IsString() @MinLength(3) motivo!: string;
}

/**
 * ⚠️ `QUALQUER_PAPEL_DO_MODULO`, e não `AVALIADOR, RH_ADMIN`: ser avaliador é
 * FATO DO DADO. Quem abre, responde e envia é decidido pela DESIGNAÇÃO, dentro
 * do `AvaliacaoAcessoService` — o papel aqui só responde "tem acesso ao módulo?".
 */
@Controller('avaliacoes')
@Roles(...QUALQUER_PAPEL_DO_MODULO)
export class AvaliacaoController {
  constructor(private readonly avaliacoes: AvaliacaoService) {}

  /** A fila do avaliador. A própria avaliação, se aparecer, vem MARCADA. */
  @Get('minhas')
  minhas(
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
    @Query('cicloId') cicloId?: string,
  ) {
    return this.avaliacoes.minhasAvaliacoes(this.contexto(user, colaboradorId, req), cicloId);
  }

  @Get(':id')
  abrir(
    @Param('id') id: string,
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.avaliacoes.abrirParaResponder(this.contexto(user, colaboradorId, req), id);
  }

  @Post(':id/respostas') @HttpCode(200)
  responder(
    @Param('id') id: string,
    @Body() dto: ResponderDto,
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.avaliacoes.responder(this.contexto(user, colaboradorId, req), id, dto.perguntaId, dto.alternativaId);
  }

  @Post(':id/enviar') @HttpCode(200)
  enviar(
    @Param('id') id: string,
    @Body() dto: EnviarDto,
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.avaliacoes.enviar(this.contexto(user, colaboradorId, req), id, dto.observacao);
  }

  /**
   * ⭐ O que a reabertura vai apagar — para o diálogo dizer com o número.
   * Mesmo papel e mesma porta do ato: quem não pode reabrir não fica sabendo a
   * nota de ninguém por este caminho.
   */
  @Get(':id/efeito-da-reabertura') @Roles(ROLES.RH_ADMIN)
  efeitoDaReabertura(
    @Param('id') id: string,
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.avaliacoes.efeitoDaReabertura(this.contexto(user, colaboradorId, req), id);
  }

  /** Reabrir é ato do RH — e continua barrado na própria avaliação. */
  @Post(':id/reabrir') @HttpCode(200) @Roles(ROLES.RH_ADMIN)
  reabrir(
    @Param('id') id: string,
    @Body() dto: ReabrirDto,
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.avaliacoes.reabrir(this.contexto(user, colaboradorId, req), id, dto.motivo);
  }

  /**
   * ⚠️ `podeLerDeTerceiro` sai de `podeVerResultados` — a MESMA função que
   * governa quem vê resultado alheio. Duas definições de "o RH pode ler" seriam
   * duas para manter em sincronia, e a segunda envelheceria errada.
   */
  private contexto(user: JwtPayload, colaboradorId: string, req: { ip?: string }): ContextoAcesso {
    return {
      usuarioId: user.sub,
      colaboradorId,
      ip: req.ip,
      podeLerDeTerceiro: podeVerResultados(user),
    };
  }
}
