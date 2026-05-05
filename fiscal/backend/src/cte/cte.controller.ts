import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
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
import { DistribuicaoNsuService } from './distribuicao/distribuicao-nsu.service.js';
import { CteEnriquecimentoService } from './distribuicao/cte-enriquecimento.service.js';
import { PapelDetectorService } from './distribuicao/papel-detector.service.js';
import { CteDocumentoService } from './distribuicao/cte-documento.service.js';
import { SincronizacaoFiliaisService } from './distribuicao/sincronizacao-filiais.service.js';
import { NotFoundException } from '@nestjs/common';

@Controller('cte')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class CteController {
  constructor(
    private readonly cte: CteService,
    private readonly dacte: DacteGeneratorService,
    private readonly distribuicao: DistribuicaoNsuService,
    private readonly enriquecimento: CteEnriquecimentoService,
    private readonly papelDetector: PapelDetectorService,
    private readonly documento: CteDocumentoService,
    private readonly sincronizacao: SincronizacaoFiliaisService,
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
  @RoleMinima('GESTOR_FISCAL')
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

  /**
   * Endpoint manual de teste — Fase 1 do CTeDistribuicaoDFe (distNSU).
   *
   * Dispara a varredura sequencial NSU para o CNPJ informado contra o
   * ambiente atual da plataforma (PROD/HOM resolvido via AmbienteConfig).
   * Apenas ADMIN_TI por ora — Fase 2 promove pra scheduler automático.
   *
   * Query params:
   *   - dryRun=true (opcional): não persiste docZips em disco/banco; apenas
   *     loga preview. Útil pra smoke test sem afetar dados.
   *
   * Ambiente é resolvido pelo `DistribuicaoNsuService` via
   * `fiscal.ambiente_config.cte_distribuicao_ambiente` (independente do global).
   * Mudança de ambiente é feita via PUT /ambiente/cte-distribuicao/ambiente
   * (ADMIN_TI) ou pela aba "CT-e Distribuição" do Controle Operacional.
   *
   * Resposta inclui sumário (iteracoes, ultNSU/maxNSU, docs recebidos,
   * status final) sem expor XMLs completos pra não inflar response.
   */
  @Post('distribuicao/consultar-filial/:cnpj')
  @RoleMinima('ADMIN_TI')
  @Throttle({ sefaz: { ttl: 60_000, limit: 5 } })
  async consultarFilial(
    @Param('cnpj') cnpj: string,
    @Query('dryRun') dryRun?: string,
  ) {
    return this.distribuicao.consultarFilial(cnpj, {
      dryRun: dryRun === 'true' || dryRun === '1',
    });
  }

  /**
   * Endpoint admin — Fase 3 do CT-e Distribuição.
   *
   * Dispara o `CteEnriquecimentoService` manualmente: varre `cte_documento`
   * com `processado_em IS NULL` e aplica `PapelDetectorService` pra popular
   * `papel_capul`. Usado pra:
   *   - Re-processar histórico após melhoria do detector (zerar processado_em
   *     via SQL e chamar este endpoint)
   *   - Forçar enriquecimento entre os ciclos do cron (que roda hh:30)
   *   - Smoke test pós-deploy
   *
   * Resposta: sumário com varridos/enriquecidos/semPapel/comAnomalia/erros/duracaoMs.
   *
   * Idempotente — chamar várias vezes em sequência só processa pendentes
   * (que ficam = 0 após o primeiro run).
   */
  @Post('distribuicao/enriquecer')
  @RoleMinima('ADMIN_TI')
  async enriquecer() {
    return this.enriquecimento.processarPendentes();
  }

  /**
   * Endpoint admin — recarrega cache de CNPJs Capul do `PapelDetectorService`
   * (lê de `core.filiais`). Chamar quando uma filial nova for cadastrada
   * para que o detector a reconheça sem precisar reiniciar o backend.
   */
  /**
   * Sincronização imediata pós-cadastro de filial Capul.
   *
   * Antes só recarregava cache do PapelDetector — agora sincroniza tudo:
   *   1. Cache `PapelDetector` (CNPJs reconhecidos no enriquecimento)
   *   2. Cursores em `cte_controle_nsu` (filiais novas ganham cursor pra
   *      o scheduler começar a varrer; inativadas têm cursor desativado)
   *
   * Mesma lógica que o scheduler aplica a cada 15min — endpoint serve pra
   * forçar sync imediato após cadastro/edição de filial no Configurador.
   */
  @Post('distribuicao/recarregar-cnpjs-capul')
  @RoleMinima('ADMIN_TI')
  async recarregarCnpjsCapul() {
    const r = await this.sincronizacao.sincronizar();
    return { ok: true, ...r };
  }

  /**
   * Lista CT-es recebidos via distNSU — Fase 3 frontend.
   *
   * Query params (todos opcionais):
   *   page, limit (default 1, 20 — máx 100)
   *   search        - chave parcial
   *   papel         - DEST/TOMA/REM/EXPED/RECEB/AUTXML/TERCEIRO
   *   schema        - procCTe/procCTeSimp/resCTe/...
   *   ambiente      - 1 (PROD) ou 2 (HOM)
   *   cnpjConsulente - CNPJ Capul que recebeu (matriz/filial)
   *   dataInicio, dataFim - range de dh_emi (ISO 8601)
   *
   * Retorno: { items, total, page, limit, totalPages }.
   * Sumário leve — XML completo via /cte/recebidos/:id.
   */
  @Get('recebidos')
  @RoleMinima('OPERADOR_ENTRADA')
  async listarRecebidos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('papel') papel?: string,
    @Query('schema') schema?: string,
    @Query('ambiente') ambiente?: string,
    @Query('cnpjConsulente') cnpjConsulente?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.documento.listarPaginado({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      papel,
      schema,
      ambiente: ambiente ? Number(ambiente) : undefined,
      cnpjConsulente,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  /**
   * Detalhe de 1 CT-e recebido — inclui XML completo + eventos vinculados.
   */
  @Get('recebidos/:id')
  @RoleMinima('OPERADOR_ENTRADA')
  async detalheRecebido(@Param('id') id: string) {
    const idNum = Number(id);
    if (isNaN(idNum)) throw new NotFoundException('ID inválido');
    const r = await this.documento.detalhe(idNum);
    if (!r) throw new NotFoundException('CT-e não encontrado');
    return r;
  }
}
