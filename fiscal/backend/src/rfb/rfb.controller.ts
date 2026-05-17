import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { RfbWebdavService } from './rfb-webdav.service.js';
import { RfbDeteccaoService } from './rfb-deteccao.service.js';
import { RfbImportacaoService } from './rfb-importacao.service.js';
import { RfbCruzamentoService } from './rfb-cruzamento.service.js';

// F1.2 — endpoints mínimos. `versoes` serve de smoke test E de base p/ a
// UI supervisionada da F1.4 (não é throwaway). Import (F1.3) e cron (F1.4)
// entram depois. Guard padrão do Fiscal.
// SkipThrottle: endpoints RFB são 100% locais (DB/WebDAV de share público) —
// NÃO tocam SEFAZ. O throttler global ('default' 200/60s) existe p/ proteger
// o certificado SEFAZ; aplicá-lo aqui não protege nada e quebrava o polling
// de 5s das abas (causava 429). Abuso dos POST pesados já é barrado por
// lock de status (IMPORTANDO/RODANDO), não pelo throttler.
@Controller('rfb')
@SkipThrottle({ default: true, sefaz: true }) // pula AMBOS os throttlers nomeados (v6)
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class RfbController {
  constructor(
    private readonly webdav: RfbWebdavService,
    private readonly deteccao: RfbDeteccaoService,
    private readonly importacao: RfbImportacaoService,
    private readonly cruzamento: RfbCruzamentoService,
  ) {}

  /** Estado local (SÓ-DB, pollável). Detecção (PROPFIND) só no cron +
   *  POST /rfb/detectar — não a cada chamada (era lento + dava 429). */
  @Get('versoes')
  @RoleMinima('GESTOR_FISCAL')
  async versoes() {
    return this.deteccao.statusDb();
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

  /** Dispara o cruzamento massa SA1+SA2 × base RFB local (assíncrono). */
  @Post('cruzamento')
  @RoleMinima('ADMIN_TI')
  async rodarCruzamento(@CurrentUser() user: FiscalAuthenticatedUser) {
    return this.cruzamento.iniciar(user.id);
  }

  /** Consulta o snapshot do cruzamento (paginado/filtrado) + execuções. */
  @Get('cruzamento')
  @RoleMinima('GESTOR_FISCAL')
  async consultarCruzamento(
    @Query() q: { alerta?: string; origem?: string; uf?: string; search?: string; page?: string; pageSize?: string },
  ) {
    return this.cruzamento.consultar({
      alerta: q.alerta, origem: q.origem, uf: q.uf, search: q.search,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 50,
    });
  }
}
