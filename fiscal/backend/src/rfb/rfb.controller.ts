import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { RfbWebdavService } from './rfb-webdav.service.js';
import { RfbDeteccaoService } from './rfb-deteccao.service.js';
import { RfbImportacaoService } from './rfb-importacao.service.js';

// F1.2 — endpoints mínimos. `versoes` serve de smoke test E de base p/ a
// UI supervisionada da F1.4 (não é throwaway). Import (F1.3) e cron (F1.4)
// entram depois. Guard padrão do Fiscal.
@Controller('rfb')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class RfbController {
  constructor(
    private readonly webdav: RfbWebdavService,
    private readonly deteccao: RfbDeteccaoService,
    private readonly importacao: RfbImportacaoService,
  ) {}

  /** Versões publicadas na RFB + estado local das importações. */
  @Get('versoes')
  @RoleMinima('GESTOR_FISCAL')
  async versoes() {
    const det = await this.deteccao.detectar();
    const st = await this.deteccao.status();
    return { ...det, ...st };
  }

  /** Lista arquivos de uma versão (debug/inspeção; tamanhos em bytes). */
  @Get('versoes/atual/arquivos')
  @RoleMinima('GESTOR_FISCAL')
  async arquivosAtual() {
    const versoes = await this.webdav.listarVersoes();
    const versao = versoes[versoes.length - 1];
    return { versao, arquivos: await this.webdav.listarArquivos(versao) };
  }

  /** Detecção manual (o cron semanal vem na F1.4). */
  @Post('detectar')
  @RoleMinima('ADMIN_TI')
  async detectar() {
    return this.deteccao.detectar();
  }

  /** Dispara importação supervisionada (assíncrona). SEMPRE manual/ADMIN_TI.
   *  body.versao opcional (default = mais recente); body.tabelas opcional. */
  @Post('importar')
  @RoleMinima('ADMIN_TI')
  async importar(
    @Body() body: { versao?: string; tabelas?: string[] },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.importacao.iniciar(body?.versao, user.id, body?.tabelas);
  }

  /** Reimporta UMA tabela (operacional + smoke). Ex.: cnaes (tiny). */
  @Post('importar/:tabela')
  @RoleMinima('ADMIN_TI')
  async importarTabela(
    @Param('tabela') tabela: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.importacao.iniciar(undefined, user.id, [tabela]);
  }
}
