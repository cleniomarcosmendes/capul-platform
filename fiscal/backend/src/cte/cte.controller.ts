import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { CteService } from './cte.service.js';
import { DacteGeneratorService } from './pdf/dacte-generator.service.js';

@Controller('cte')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class CteController {
  constructor(
    private readonly cte: CteService,
    private readonly dacte: DacteGeneratorService,
  ) {}

  @Post('consulta')
  @RoleMinima('OPERADOR_ENTRADA')
  @Throttle({ sefaz: { ttl: 60_000, limit: 20 } })
  async consultar(
    @Body() body: { chave: string; filial?: string },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    const filial = body.filial ?? user.filialCodigo ?? '01';
    return this.cte.consultarPorChave(body.chave, filial, user);
  }

  /**
   * Re-executa a gravacao no Protheus (SZR010 + SZQ010) para um CT-e.
   */
  @Post(':chave/filial/:filial/regravar-protheus')
  @RoleMinima('OPERADOR_ENTRADA')
  async regravarProtheus(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.cte.regravarNoProtheus(chave, filial, user);
  }

  @Get(':chave/filial/:filial/xml')
  @RoleMinima('OPERADOR_ENTRADA')
  @Header('content-type', 'application/xml; charset=utf-8')
  async downloadXml(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
    @Res() res: Response,
  ) {
    const resultado = await this.cte.consultarPorChave(chave, filial, user);
    if (!resultado.xml) {
      res.status(404).json({
        erro: 'XML_NAO_DISPONIVEL',
        mensagem:
          'O XML completo deste CT-e não está no Protheus e o serviço SEFAZ não permite download por chave.',
      });
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="CTe_${chave}.xml"`);
    res.send(resultado.xml);
  }

  /**
   * Download do DACTE em PDF. Layout simplificado via pdfkit —
   * adequado para conferência interna.
   */
  @Get(':chave/filial/:filial/dacte')
  @RoleMinima('OPERADOR_ENTRADA')
  @Header('content-type', 'application/pdf')
  async downloadDacte(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
    @Res() res: Response,
  ) {
    const resultado = await this.cte.consultarPorChave(chave, filial, user);
    if (!resultado.parsed) {
      res.status(404).json({
        erro: 'XML_NAO_DISPONIVEL',
        mensagem:
          'Não é possível gerar o DACTE — o XML completo deste CT-e não está no Protheus.',
      });
      return;
    }
    const pdf = await this.dacte.generate(resultado.parsed);
    res.setHeader('Content-Disposition', `attachment; filename="DACTE_${chave}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  }

  @Get('health')
  @RoleMinima('OPERADOR_ENTRADA')
  async health() {
    return { ok: true, modulo: 'cte', etapas: [6, 9] };
  }
}
