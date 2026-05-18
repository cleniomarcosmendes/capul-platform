import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { RfbCronService } from './rfb-cron.service.js';
import { RfbConsultaService } from './rfb-consulta.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';

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
    private readonly rfbCron: RfbCronService,
    private readonly rfbConsulta: RfbConsultaService,
    private readonly ambiente: AmbienteService,
  ) {}

  /** Estado local (SÓ-DB, pollável) + agenda de detecção configurada.
   *  Detecção (PROPFIND) só no cron + POST /rfb/detectar. */
  @Get('versoes')
  @RoleMinima('GESTOR_FISCAL')
  async versoes() {
    const st = await this.deteccao.statusDb();
    const cfg = await this.ambiente.getOrCreate();
    return { ...st, cronDeteccao: cfg.rfbCronDeteccao ?? null };
  }

  /** Configura (ou desativa) a agenda de detecção automática. Vazio/null
   *  = desativada. ADMIN_TI. Reaplica sem restart. */
  @Post('cron')
  @RoleMinima('ADMIN_TI')
  async configurarCron(
    @Body() body: { cron?: string | null },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    const cfg = await this.ambiente.atualizarRfbCron(body?.cron, user.email);
    await this.rfbCron.registrar();
    return { cronDeteccao: cfg.rfbCronDeteccao ?? null };
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

  /** Limiar de similaridade de razão social (F1.8). ADMIN_TI. Aplica no
   *  próximo run do cruzamento. */
  @Post('cruzamento/limiar')
  @RoleMinima('ADMIN_TI')
  async configurarLimiarRazao(
    @Body() body: { valor: number },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    const cfg = await this.ambiente.atualizarRfbSimRazao(body?.valor, user.email);
    return { limiarRazao: cfg.rfbSimRazaoMin ?? 80 };
  }

  /** Consulta o snapshot do cruzamento (paginado/filtrado) + execuções. */
  @Get('cruzamento')
  @RoleMinima('GESTOR_FISCAL')
  async consultarCruzamento(
    @Query() q: { alerta?: string; origem?: string; uf?: string; situacao?: string; porte?: string; simples?: string; soRecente?: string; search?: string; divergencia?: string; acao?: string; sort?: string; dir?: string; page?: string; pageSize?: string },
  ) {
    return this.cruzamento.consultar({
      alerta: q.alerta, origem: q.origem, uf: q.uf,
      situacao: q.situacao, porte: q.porte, simples: q.simples,
      soRecente: q.soRecente, search: q.search, divergencia: q.divergencia, acao: q.acao,
      sort: q.sort, dir: q.dir,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 50,
    });
  }

  /** Facetas agregadas (counts por dimensão) — Inteligência Cadastral (F3). */
  @Get('cruzamento/facetas')
  @RoleMinima('GESTOR_FISCAL')
  async facetasCruzamento(
    @Query() q: { alerta?: string; origem?: string; uf?: string; situacao?: string; porte?: string; simples?: string; soRecente?: string; search?: string; divergencia?: string; acao?: string },
  ) {
    return this.cruzamento.facetas(q);
  }

  /** Export CSV do snapshot filtrado (Inteligência Cadastral / estratégia). */
  @Get('cruzamento/export')
  @RoleMinima('GESTOR_FISCAL')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="cruzamento-cnpj.csv"')
  async exportCruzamento(
    @Query() q: { alerta?: string; origem?: string; uf?: string; situacao?: string; porte?: string; simples?: string; soRecente?: string; search?: string; divergencia?: string; acao?: string },
  ) {
    return this.cruzamento.exportarCsv(q);
  }

  /** Busca reversa: nome do sócio → empresas vinculadas (base RFB local,
   *  dado público Dados Abertos). Min 3 chars; paginado por hasMore. */
  @Get('socios/busca')
  @RoleMinima('GESTOR_FISCAL')
  async buscarPorSocio(
    @Query() q: { nome?: string; page?: string; pageSize?: string },
  ) {
    return this.rfbConsulta.buscarPorSocio(
      q.nome ?? '',
      q.page ? Number(q.page) : 1,
      q.pageSize ? Number(q.pageSize) : 30,
    );
  }
}
