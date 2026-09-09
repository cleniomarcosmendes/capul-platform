import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ColaboradorAtual } from '../common/decorators/colaborador-atual.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { ResultadoService } from './resultado.service.js';

/**
 * Só RH_ADMIN. RH_CICLO monta e cobra a fila (painel), mas não lê nota de
 * terceiro — designar quem julga quem já é autoridade suficiente sem juntar a
 * ela o resultado do julgamento.
 */
@Controller('resultados')
@Roles(ROLES.RH_ADMIN)
export class ResultadoController {
  constructor(private readonly resultados: ResultadoService) {}

  @Get('ciclo/:cicloId')
  doCiclo(@Param('cicloId') cicloId: string, @ColaboradorAtual('id') colaboradorId?: string) {
    return this.resultados.doCiclo(cicloId, colaboradorId ?? null);
  }

  /**
   * ⭐⭐ A PLANILHA DA REUNIÃO. Duas, na verdade, e separadas de propósito:
   * quem TEM nota e quem NÃO tem e por quê. Ver `ResultadoService.csvDoCiclo`.
   *
   * ⚠️ As rotas vêm ANTES de `@Get(':id')` — sem isto, `/ciclo/x/csv` casaria
   * com a rota de memória de cálculo, que trata o caminho inteiro como id.
   *
   * ⚠️ A memória de cálculo NÃO entra no arquivo: é dado pessoal (grau de
   * instrução, tempo de casa) e sair por padrão numa planilha que circula por
   * e-mail seria decidir por omissão o que é decisão do RH.
   */
  @Get('ciclo/:cicloId/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(
    @Param('cicloId') cicloId: string,
    @ColaboradorAtual('id') colaboradorId: string | undefined,
    @Res() res: Response,
  ) {
    const { nome, csv } = await this.resultados.csvDoCiclo(cicloId, colaboradorId ?? null);
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.send(csv);
  }

  /** A que responde "por que fulano não tem nota" — com o motivo escrito. */
  @Get('ciclo/:cicloId/canceladas.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csvCanceladas(
    @Param('cicloId') cicloId: string,
    @ColaboradorAtual('id') colaboradorId: string | undefined,
    @Res() res: Response,
  ) {
    const { nome, csv } = await this.resultados.csvDeCanceladas(cicloId, colaboradorId ?? null);
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.send(csv);
  }

  /**
   * ⚠️ Passa o CONTEXTO porque a §8 da spec exige registrar em `rh.auditoria` o
   * acesso a resultado individual por quem não é o avaliador designado — e este
   * é o único lugar do módulo que mostra a observação escrita pelo avaliador.
   */
  @Get(':id') memoria(
    @Param('id') id: string,
    @ColaboradorAtual('id') colaboradorId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { ip?: string },
  ) {
    return this.resultados.memoria(id, {
      colaboradorId: colaboradorId ?? null,
      usuarioId: user.sub,
      ip: req.ip,
    });
  }
}
