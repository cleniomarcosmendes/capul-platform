import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { QUALQUER_PAPEL_DO_MODULO, ROLES, podeVerResultados } from '../common/roles-rh.js';
import { AvaliacaoService } from './avaliacao.service.js';
import type { ContextoAcesso } from './avaliacao-acesso.service.js';
import { MOTIVO_MINIMO } from '../common/motivo.js';
import { BooleanoEstrito } from '../common/booleano-estrito.js';

export class ResponderDto {
  @IsString() perguntaId!: string;
  @IsString() alternativaId!: string;
}
export class EnviarDto {
  @IsOptional() @IsString() observacao?: string;
}
export class ContestarDesignacaoDto {
  /** Por que não é da equipe dele — é o que o RH vai ler para decidir. */
  @IsString() @MinLength(MOTIVO_MINIMO) motivo!: string;
}
export class FaltaGenteDto {
  @IsString() cicloId!: string;
  /** Quem falta, com nome ou matrícula se ele souber. */
  @IsString() @MinLength(MOTIVO_MINIMO) texto!: string;
}
export class ReabrirDto {
  /** Ato de UMA linha — mínimo pequeno, e é o certo aqui. Ver `common/motivo.ts`. */
  @IsString() @MinLength(MOTIVO_MINIMO) motivo!: string;
  /**
   * ⭐ "Eu sei que esta pessoa JÁ VIU o resultado" — exigido só quando a
   * devolutiva foi liberada. Ver `reabrir`: a API recusa COM O DADO (a data em
   * que foi liberada) para a tela poder perguntar.
   */
  @IsOptional() @BooleanoEstrito() confirmarJaDevolvida?: boolean;
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

  /**
   * ⭐⭐ "Esta pessoa não é da minha equipe." NÃO muda a designação — registra.
   * A resposta traz a frase que a tela mostra, inclusive a parte que não pode
   * faltar: a avaliação continua com ele. Ver `contestacao.ts`.
   */
  @Post(':id/contestar-designacao') @HttpCode(200)
  contestarDesignacao(
    @Param('id') id: string,
    @Body() dto: ContestarDesignacaoDto,
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.avaliacoes.contestarDesignacao(
      this.contexto(user, colaboradorId, req),
      id,
      dto.motivo,
    );
  }

  /**
   * ⭐ A outra metade: "falta gente na minha equipe" — sobre quem NÃO está na
   * fila, e por isso não tem linha para clicar. Vive no ciclo.
   * ⚠️ Rota literal ANTES de `:id` não é problema aqui (uma só via POST), mas
   * fica antes por clareza de leitura.
   */
  @Post('falta-gente') @HttpCode(200)
  faltaGente(
    @Body() dto: FaltaGenteDto,
    @ColaboradorAtual('id') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.avaliacoes.relatarFaltaDeGente(
      this.contexto(user, colaboradorId, req),
      dto.cicloId,
      dto.texto,
    );
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
    return this.avaliacoes.reabrir(
      this.contexto(user, colaboradorId, req),
      id,
      dto.motivo,
      dto.confirmarJaDevolvida ?? false,
    );
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
