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
import { NfeService } from './nfe.service.js';
import { DanfeGeneratorService } from './pdf/danfe-generator.service.js';

@Controller('nfe')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class NfeController {
  constructor(
    private readonly nfe: NfeService,
    private readonly danfe: DanfeGeneratorService,
  ) {}

  /**
   * Consulta principal — chave + filial no body. Retorna abas estruturadas.
   *
   * O campo `xml` do retorno contém o XML autorizado completo — o frontend
   * pode ignorar na maior parte dos casos (usa apenas `parsed`), mas está
   * disponível para download ou re-parse eventual.
   */
  @Post('consulta')
  @RoleMinima('OPERADOR_ENTRADA')
  @Throttle({ sefaz: { ttl: 60_000, limit: 20 } })
  async consultar(
    @Body() body: { chave: string; filial?: string },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    const filial = body.filial ?? user.filialCodigo ?? '01';
    return this.nfe.consultarPorChave(body.chave, filial, user);
  }

  /**
   * Re-executa a gravacao no Protheus (SZR010 + SZQ010) quando a tentativa
   * inicial falhou — botao "Tentar gravar novamente" no frontend.
   *
   * Estrategia atual: re-executa `consultarPorChave` (gasta uma chamada SEFAZ
   * adicional). Retorna apenas o `protheusStatus` atualizado.
   */
  @Post(':chave/filial/:filial/regravar-protheus')
  @RoleMinima('GESTOR_FISCAL')
  async regravarProtheus(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.nfe.regravarNoProtheus(chave, filial, user);
  }

  /**
   * Atualiza o status da NF-e no SEFAZ (cancelamento, CC-e, manifestação).
   * Não baixa XML de novo — só consulta o protocolo atual.
   *
   * Requer que a chave já tenha sido consultada ao menos uma vez (existe
   * registro em `fiscal.documento_consulta`).
   */
  @Post(':chave/filial/:filial/atualizar-status')
  @RoleMinima('GESTOR_FISCAL')
  async atualizarStatus(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.nfe.atualizarStatus(chave, filial, user);
  }

  /**
   * Timeline consolidada de eventos da NF-e (SPED150/SPED156/SZR010), com
   * SF1010 separado em bloco `alertasEntrada`. Consome `/eventosNfe` da API
   * Protheus (contrato recebido 18/04/2026).
   */
  @Get(':chave/timeline')
  @RoleMinima('OPERADOR_ENTRADA')
  async timeline(@Param('chave') chave: string) {
    return this.nfe.timeline(chave);
  }

  /**
   * Atualiza a timeline persistida em fiscal.documento_evento lendo os
   * eventos do Protheus (SPED156/SPED150) — sem consumir slot SEFAZ.
   *
   * Diferente de `/atualizar-status` (que chama SEFAZ direto e consome
   * rate-limit). Use este quando o SEFAZ não devolver eventos (cenário
   * comum quando Monitor Protheus já consumiu via distDFe).
   */
  @Post(':chave/filial/:filial/atualizar-eventos-protheus')
  @RoleMinima('OPERADOR_ENTRADA')
  async atualizarEventosProtheus(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.nfe.atualizarEventosProtheus(chave, filial, user);
  }

  /**
   * Download do XML cru (application/xml). Faz a mesma consulta completa
   * mas devolve o conteúdo bruto para o usuário salvar localmente.
   */
  @Get(':chave/filial/:filial/xml')
  @RoleMinima('OPERADOR_ENTRADA')
  @Header('content-type', 'application/xml; charset=utf-8')
  async downloadXml(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
    @Res() res: Response,
  ) {
    const resultado = await this.nfe.consultarPorChave(chave, filial, user);
    res.setHeader('Content-Disposition', `attachment; filename="NFe_${chave}.xml"`);
    res.send(resultado.xml);
  }

  /**
   * Download do DANFE em PDF — geração local via pdfkit.
   * Layout simplificado; se o Setor Fiscal exigir o layout padrão ENCAT,
   * trocar DanfeGeneratorService por uma implementação via
   * `node-danfe-pdf` (API idêntica).
   */
  @Get(':chave/filial/:filial/danfe')
  @RoleMinima('OPERADOR_ENTRADA')
  @Header('content-type', 'application/pdf')
  async downloadDanfe(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
    @Res() res: Response,
  ) {
    const resultado = await this.nfe.consultarPorChave(chave, filial, user);
    const pdf = await this.danfe.generate(resultado.parsed);
    res.setHeader('Content-Disposition', `attachment; filename="DANFE_${chave}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  }

  /**
   * Detalhe de um evento da timeline — equivale à tela de detalhe que o
   * portal SEFAZ abre quando o usuário clica no protocolo de um evento.
   * Não dispara nenhuma chamada SEFAZ — apenas lê o xmlEvento já persistido.
   */
  @Get(':chave/filial/:filial/eventos/:eventoId')
  @RoleMinima('OPERADOR_ENTRADA')
  async obterEventoDetalhe(
    @Param('chave') chave: string,
    @Param('filial') filial: string,
    @Param('eventoId') eventoId: string,
  ) {
    return this.nfe.obterEventoDetalhe(chave, filial, eventoId);
  }

  @Get('health')
  @RoleMinima('OPERADOR_ENTRADA')
  async health() {
    return { ok: true, modulo: 'nfe', etapas_implementadas: [4, 5, 7, 8] };
  }
}
