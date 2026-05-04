import {
  Body,
  Controller,
  Get,
  NotFoundException,
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
import { CadastroService } from './cadastro.service.js';
import { ComprovanteIeGeneratorService } from './pdf/comprovante-ie-generator.service.js';

@Controller('cadastro')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class CadastroController {
  constructor(
    private readonly service: CadastroService,
    private readonly comprovanteIeGen: ComprovanteIeGeneratorService,
  ) {}

  /**
   * Consulta cadastral pontual via CadConsultaCadastro4 — serve DOIS use cases:
   *
   * 1. **Validação de novo cadastro**: antes de cadastrar um cliente/fornecedor
   *    no Protheus, o operador informa CNPJ + UF aqui. A resposta traz os
   *    dados oficiais do SEFAZ (razão social, IE, CNAE, endereço, situação
   *    cadastral) prontos para preencher o cadastro do ERP. A flag
   *    `jaCadastradoNoProtheus=false` indica que é um contribuinte novo —
   *    NÃO é erro.
   *
   * 2. **Verificação de contribuinte existente**: para ver status atual de
   *    um cliente/fornecedor já cadastrado. A flag `jaCadastradoNoProtheus=true`
   *    e os campos `origemProtheus`/`codigoProtheus`/`lojaProtheus` indicam
   *    o vínculo existente em SA1010 ou SA2010.
   *
   * Em ambos os casos, o contribuinte é persistido em
   * `fiscal.cadastro_contribuinte` + histórico de mudança de situação (se houver).
   */
  @Post('consulta')
  @RoleMinima('OPERADOR_ENTRADA')
  @Throttle({ sefaz: { ttl: 60_000, limit: 20 } })
  async consultar(@Body() body: { cnpj: string; uf?: string | null }) {
    return this.service.consultarPontual(body.cnpj, body.uf ?? null);
  }

  // === ROTAS COM PATH ESTÁTICO PRIMEIRO ===
  // Em Express/NestJS, as rotas são avaliadas na ordem de declaração. Rotas
  // com `@Get(':cnpj')` capturam QUALQUER GET de path único — incluindo
  // /comprovante-ie-pdf e /health — caindo em getPorCnpj() e retornando
  // null/erro silencioso. As rotas estáticas precisam vir ANTES das com
  // parâmetro pra serem alcançadas (descoberto em 29/04).

  /**
   * Comprovante CCC — Inscrição Estadual em PDF.
   *
   * Re-executa a consulta CCC para obter os dados frescos da IE específica
   * (CNPJ pode ter várias) e gera PDF estilo "comprovante" com paleta SEFAZ.
   * Setor fiscal usa para anexar em processos, conferir cadastro Protheus, etc.
   *
   * Não substitui o comprovante oficial da Receita Federal (gerado no portal
   * solucoes.receita.fazenda.gov.br) — é um relatório interno do consumo
   * que a plataforma faz do CCC.
   */
  @Get('comprovante-ie-pdf')
  @RoleMinima('OPERADOR_ENTRADA')
  @Throttle({ sefaz: { ttl: 60_000, limit: 20 } })
  async comprovanteIePdf(
    @Query('cnpj') cnpj: string,
    @Query('uf') uf: string,
    @Query('ie') ie: string,
    @Query('filial') filial: string,
    @Res() res: Response,
  ) {
    const consulta = await this.service.consultarPontual(cnpj, uf);
    const inscricaoSelecionada = consulta.inscricoesSefaz.find(
      (x) => x.uf === uf && x.inscricaoEstadual === ie,
    );
    if (!inscricaoSelecionada) {
      throw new NotFoundException(
        `Inscrição Estadual ${ie} (UF ${uf}) não encontrada para CNPJ ${cnpj} na consulta atual.`,
      );
    }
    const cruzamento =
      consulta.cruzamentoInscricoes.find((c) => c.inscricaoEstadual === ie) ?? null;
    const pdf = await this.comprovanteIeGen.generate({
      consultaResult: consulta,
      ie: inscricaoSelecionada,
      cruzamento,
      // dadosReceita já vem populado pelo consultarPontual (BrasilAPI/ReceitaWS)
      // — só CPF e indisponibilidades temporárias retornam null aqui.
      dadosReceita: consulta.dadosReceita,
      filialConsulente: filial || '-',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="ComprovanteIE_${cnpj}_${uf}_${ie}.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  }

  @Get('health')
  @RoleMinima('OPERADOR_ENTRADA')
  async health() {
    return { ok: true, modulo: 'cadastro', etapas: [10, 11] };
  }

  // === ROTAS COM PARÂMETRO `:cnpj` POR ÚLTIMO ===

  /**
   * Histórico de mudanças de situação.
   */
  @Get(':cnpj/historico')
  @RoleMinima('GESTOR_FISCAL')
  async historico(@Param('cnpj') cnpj: string) {
    return this.service.getHistorico(cnpj);
  }

  /**
   * Última foto salva do contribuinte (pode ser de qualquer UF).
   */
  @Get(':cnpj')
  @RoleMinima('OPERADOR_ENTRADA')
  async porCnpj(@Param('cnpj') cnpj: string) {
    return this.service.getPorCnpj(cnpj);
  }
}
