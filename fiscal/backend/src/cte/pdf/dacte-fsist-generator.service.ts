import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import type {
  CteParsed,
  CteParticipante,
  CteModalRodoviario,
} from '../parsers/cte-parsed.interface.js';
import { formatCpfCnpj } from '../../common/helpers/cnpj.helper.js';

/**
 * Gerador DACTE — modelo "fsist" (densidade alta, fiel ao manual SEFAZ).
 * Layout espelha o site fsist.com.br/converter-xml-nfe-para-danfe, padrão
 * com o qual o setor fiscal já está familiarizado.
 *
 * Roda paralelo ao DacteGeneratorService — selecionável via ?modelo=fsist
 * nas rotas /cte/.../dacte e /cte/recebidos/:id/dacte.
 *
 * Implementação atual cobre modal Rodoviário (95% dos CT-es Capul).
 * Outros modais caem no mesmo template mas a aba "DADOS ESPECÍFICOS DO
 * MODAL" fica genérica.
 */
@Injectable()
export class DacteFsistGeneratorService {
  private readonly logger = new Logger(DacteFsistGeneratorService.name);

  // A4 portrait, margem apertada pra densidade fsist
  private readonly PAGE_W = 595;
  private readonly PAGE_H = 842;
  private readonly MARGIN = 14;

  private readonly F = 'Helvetica';
  private readonly FB = 'Helvetica-Bold';
  private readonly FI = 'Helvetica-Oblique';

  async generate(parsed: CteParsed): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const barcodePng = await this.gerarBarcode(parsed.dadosGerais.chave);

    let y = this.MARGIN;
    y = this.renderCabecalhoRecebimento(doc, parsed, y);
    y = this.renderBlocoPrincipal(doc, parsed, barcodePng, y);
    y = this.renderTipoServicoChave(doc, parsed, y);
    y = this.renderTomadorLinha(doc, parsed, y);
    y = this.renderCfopProtocolo(doc, parsed, y);
    y = this.renderInicioFimPrestacao(doc, parsed, y);
    y = this.renderRemetenteDestinatario(doc, parsed, y);
    y = this.renderExpedidorRecebedor(doc, parsed, y);
    y = this.renderTomadorCompleto(doc, parsed, y);
    y = this.renderProdutoCarga(doc, parsed, y);
    y = this.renderQuantidadesSeguro(doc, parsed, y);
    y = this.renderComponentesValor(doc, parsed, y);
    y = this.renderImposto(doc, parsed, y);
    y = this.renderDocumentosOriginarios(doc, parsed, y);
    y = this.renderObservacoes(doc, parsed, y);
    y = this.renderDadosRodoviario(doc, parsed, y);
    // Última atribuição da cadeia: `y` não é lido depois, mas manter o `y =`
    // faz a PRÓXIMA seção acrescentada aqui herdar o offset certo. Sem ele,
    // quem adicionar um render depois parte de um `y` velho e a seção sai
    // sobreposta — por isso a regra é dispensada em vez de a linha ser "limpa".
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    y = this.renderUsoEmissorReservadoFisco(doc, y);
    this.renderRodape(doc);

    doc.end();
    return finished;
  }

  // ============================================================
  //  BLOCOS
  // ============================================================

  private renderCabecalhoRecebimento(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 42;
    const xRight = x + w - 88;
    const wLeft = w - 88;

    // Linha topo: declaração
    doc.font(this.F).fontSize(5).fillColor('#000')
      .text(
        'DECLARO QUE RECEBI OS VOLUMES DESTE CONHECIMENTO EM PERFEITO ESTADO PELO QUE DOU POR CUMPRIDO O PRESENTE CONTRATO DE TRANSPORTE',
        x + 2, y0 + 1,
        { width: wLeft - 4, lineBreak: false, ellipsis: true },
      );

    // Caixa CT-E à direita
    this.rect(doc, xRight, y0, 88, h);
    doc.font(this.F).fontSize(5).text('', xRight, y0); // reset
    doc.font(this.FB).fontSize(10).fillColor('#000')
      .text('CT-E', xRight + 4, y0 + 4, { width: 80, align: 'center' });
    doc.font(this.F).fontSize(6)
      .text('Nº DOCUMENTO', xRight + 4, y0 + 16, { width: 80, align: 'center' });
    doc.font(this.FB).fontSize(8)
      .text(parsed.dadosGerais.numero || '-', xRight + 4, y0 + 22, { width: 80, align: 'center' });
    doc.font(this.F).fontSize(5)
      .text('SÉRIE', xRight + 4, y0 + 31, { width: 80, align: 'center' });
    doc.font(this.FB).fontSize(7)
      .text(parsed.dadosGerais.serie || '-', xRight + 4, y0 + 35, { width: 80, align: 'center' });

    // Sub-células esquerda: NOME | TÉRMINO + RG | ASSINATURA | INÍCIO
    this.rect(doc, x, y0 + 8, wLeft / 2, 16);
    doc.font(this.F).fontSize(5).text('NOME', x + 2, y0 + 9);
    this.rect(doc, x + wLeft / 2, y0 + 8, wLeft / 2, 16);
    doc.font(this.F).fontSize(5).text('TÉRMINO DA PRESTAÇÃO - DATA/HORA', x + wLeft / 2 + 2, y0 + 9);

    this.rect(doc, x, y0 + 24, wLeft / 4, 18);
    doc.font(this.F).fontSize(5).text('RG', x + 2, y0 + 25);
    this.rect(doc, x + wLeft / 4, y0 + 24, wLeft / 4, 18);
    doc.font(this.F).fontSize(5).text('ASSINATURA / CARIMBO', x + wLeft / 4 + 2, y0 + 25);
    this.rect(doc, x + wLeft / 2, y0 + 24, wLeft / 2, 18);
    doc.font(this.F).fontSize(5).text('INÍCIO DA PRESTAÇÃO - DATA/HORA', x + wLeft / 2 + 2, y0 + 25);

    return y0 + h;
  }

  private renderBlocoPrincipal(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    barcodePng: Buffer,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 110;

    const wEmit = 260;
    const wCenter = 220;
    const wRight = w - wEmit - wCenter;

    // ---- Coluna 1: Emitente ----
    this.rect(doc, x, y0, wEmit, h);
    doc.font(this.FB).fontSize(11).fillColor('#000')
      .text(parsed.emitente.razaoSocial, x + 4, y0 + 6, { width: wEmit - 8, ellipsis: true, lineBreak: false });

    const e = parsed.emitente.endereco;
    const linhas: string[] = [];
    if (e) {
      const l1 = [e.logradouro, e.numero].filter(Boolean).join(',');
      if (l1) linhas.push(l1);
      const l2 = [e.cep ? `CEP: ${this.formatCep(e.cep)}` : null, [e.municipio, e.uf].filter(Boolean).join(' - ')].filter(Boolean).join(' - ');
      if (l2) linhas.push(l2);
      const foneFmt = this.formatFone(e.fone);
      if (foneFmt !== '-') linhas.push(`Fone/Fax: ${foneFmt}`);
    }
    doc.font(this.F).fontSize(7)
      .text(linhas.join('\n'), x + 4, y0 + 24, { width: wEmit - 8, height: 40 });

    doc.font(this.F).fontSize(7)
      .text(
        `CNPJ/CPF: ${this.formatCnpj(parsed.emitente.cnpj ?? parsed.emitente.cpf)}     Insc.Estadual: ${parsed.emitente.inscricaoEstadual ?? '-'}`,
        x + 4, y0 + h - 14,
        { width: wEmit - 8, ellipsis: true, lineBreak: false },
      );

    // ---- Coluna 2: DACTE + identificação ----
    const xC = x + wEmit;
    this.rect(doc, xC, y0, wCenter, h);
    doc.font(this.FB).fontSize(11).fillColor('#000')
      .text('DACTE', xC, y0 + 4, { width: wCenter, align: 'center' });
    doc.font(this.F).fontSize(6)
      .text('Documento Auxiliar do Conhecimento\nde Transporte Eletrônico', xC + 4, y0 + 16, { width: wCenter - 8, align: 'center' });

    // Linha Modelo | Série | Número | FL
    const yId = y0 + 36;
    const cw = wCenter / 4;
    this.rect(doc, xC, yId, cw, 18);
    this.rect(doc, xC + cw, yId, cw, 18);
    this.rect(doc, xC + 2 * cw, yId, cw, 18);
    this.rect(doc, xC + 3 * cw, yId, cw, 18);
    doc.font(this.F).fontSize(5).text('MODELO', xC + 2, yId + 1, { width: cw - 4, align: 'center' });
    doc.font(this.F).fontSize(5).text('SÉRIE', xC + cw + 2, yId + 1, { width: cw - 4, align: 'center' });
    doc.font(this.F).fontSize(5).text('NÚMERO', xC + 2 * cw + 2, yId + 1, { width: cw - 4, align: 'center' });
    doc.font(this.F).fontSize(5).text('FL', xC + 3 * cw + 2, yId + 1, { width: cw - 4, align: 'center' });
    doc.font(this.FB).fontSize(9)
      .text(parsed.dadosGerais.modelo || '-', xC + 2, yId + 8, { width: cw - 4, align: 'center' });
    doc.font(this.FB).fontSize(9)
      .text(parsed.dadosGerais.serie || '-', xC + cw + 2, yId + 8, { width: cw - 4, align: 'center' });
    doc.font(this.FB).fontSize(9)
      .text(parsed.dadosGerais.numero || '-', xC + 2 * cw + 2, yId + 8, { width: cw - 4, align: 'center' });
    doc.font(this.FB).fontSize(9)
      .text('1/1', xC + 3 * cw + 2, yId + 8, { width: cw - 4, align: 'center' });

    // Linha Data emissão | SUFRAMA
    const yDt = yId + 18;
    this.rect(doc, xC, yDt, wCenter / 2, 18);
    this.rect(doc, xC + wCenter / 2, yDt, wCenter / 2, 18);
    doc.font(this.F).fontSize(5).text('DATA E HORA DE EMISSÃO', xC + 2, yDt + 1, { width: wCenter / 2 - 4 });
    doc.font(this.F).fontSize(5).text('INSC. SUFRAMA DO DESTINATÁRIO', xC + wCenter / 2 + 2, yDt + 1, { width: wCenter / 2 - 4 });
    doc.font(this.FB).fontSize(7)
      .text(this.formatDate(parsed.dadosGerais.dataEmissao), xC + 2, yDt + 8, { width: wCenter / 2 - 4, align: 'center' });
    doc.font(this.FB).fontSize(7)
      .text(parsed.destinatario.inscricaoSUFRAMA ?? '', xC + wCenter / 2 + 2, yDt + 8, { width: wCenter / 2 - 4, align: 'center' });

    // Código de barras
    if (barcodePng.length > 0) {
      const yBc = yDt + 22;
      try {
        doc.image(barcodePng, xC + 4, yBc, { width: wCenter - 8, height: h - (yBc - y0) - 4 });
      } catch { /* ignora se barcode falhar */ }
    }

    // ---- Coluna 3: Modal ----
    const xR = xC + wCenter;
    this.rect(doc, xR, y0, wRight, h);
    doc.font(this.F).fontSize(5).text('MODAL', xR + 2, y0 + 2, { width: wRight - 4, align: 'center' });
    doc.font(this.FB).fontSize(10)
      .text(parsed.dadosGerais.modalidadeDescricao || '-', xR + 2, y0 + 12, { width: wRight - 4, align: 'center' });

    return y0 + h;
  }

  private renderTipoServicoChave(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 30;
    const w1 = 120, w2 = 120;
    const w3 = w - w1 - w2;

    this.rect(doc, x, y0, w1, h);
    this.rect(doc, x + w1, y0, w2, h);
    this.rect(doc, x + w1 + w2, y0, w3, h);

    doc.font(this.F).fontSize(5).text('TIPO DO CTE', x + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(parsed.dadosGerais.tipoCteDescricao || '-', x + 4, y0 + 12, { width: w1 - 8 });

    doc.font(this.F).fontSize(5).text('TIPO DO SERVIÇO', x + w1 + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(parsed.dadosGerais.tipoServicoDescricao || '-', x + w1 + 4, y0 + 12, { width: w2 - 8 });

    doc.font(this.F).fontSize(5).text('CHAVE DE ACESSO', x + w1 + w2 + 4, y0 + 2);
    doc.font(this.FB).fontSize(8)
      .text(
        this.formatChavePontuada(parsed.dadosGerais.chave),
        x + w1 + w2 + 4, y0 + 10,
        { width: w3 - 8, align: 'center' },
      );
    doc.font(this.F).fontSize(6)
      .text(
        'Consulta de autenticidade no portal nacional do CT-e, no site da Sefaz Autorizadora,\nou em http://www.cte.fazenda.gov.br',
        x + w1 + w2 + 4, y0 + 19,
        { width: w3 - 8, align: 'center' },
      );

    return y0 + h;
  }

  private renderTomadorLinha(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 24;
    const w1 = 120, w2 = 120;
    const w3 = w - w1 - w2;

    this.rect(doc, x, y0, w1, h);
    this.rect(doc, x + w1, y0, w2, h);
    this.rect(doc, x + w1 + w2, y0, w3, h);

    doc.font(this.F).fontSize(5).text('TOMADOR DO SERVIÇO', x + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(parsed.tomador || '-', x + 4, y0 + 10, { width: w1 - 8 });

    // Coluna do meio fica em branco (espelhando o fsist)

    // Coluna direita repete o texto de consulta
    doc.font(this.F).fontSize(6)
      .text(
        'Consulta de autenticidade no portal nacional do CT-e, no site da Sefaz Autorizadora,\nou em http://www.cte.fazenda.gov.br',
        x + w1 + w2 + 4, y0 + 5,
        { width: w3 - 8, align: 'center' },
      );

    return y0 + h;
  }

  private renderCfopProtocolo(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 24;
    const wL = w * 0.55;
    const wR = w - wL;

    this.rect(doc, x, y0, wL, h);
    this.rect(doc, x + wL, y0, wR, h);

    doc.font(this.F).fontSize(5).text('CFOP - NATUREZA DA PRESTAÇÃO', x + 4, y0 + 2);
    doc.font(this.FB).fontSize(8)
      .text(
        `${parsed.dadosGerais.cfop || '-'} - ${parsed.dadosGerais.naturezaOperacao || '-'}`,
        x + 4, y0 + 11,
        { width: wL - 8, ellipsis: true, lineBreak: false },
      );

    doc.font(this.F).fontSize(5).text('PROTOCOLO DE AUTORIZAÇÃO DE USO', x + wL + 4, y0 + 2);
    const prot = parsed.protocoloAutorizacao;
    const txt = prot ? `${prot.protocolo} - ${this.formatDate(prot.dataRecebimento)}` : '-';
    doc.font(this.FB).fontSize(8)
      .text(txt, x + wL + 4, y0 + 11, { width: wR - 8, ellipsis: true, lineBreak: false });

    return y0 + h;
  }

  private renderInicioFimPrestacao(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 22;
    const wC = w / 2;

    this.rect(doc, x, y0, wC, h);
    this.rect(doc, x + wC, y0, wC, h);

    doc.font(this.F).fontSize(5).text('INÍCIO DA PRESTAÇÃO', x + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(
        [parsed.dadosGerais.municipioInicioNome, parsed.dadosGerais.ufInicio].filter(Boolean).join(' - ') || '-',
        x + 4, y0 + 10,
        { width: wC - 8 },
      );

    doc.font(this.F).fontSize(5).text('TÉRMINO DA PRESTAÇÃO', x + wC + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(
        [parsed.dadosGerais.municipioFimNome, parsed.dadosGerais.ufFim].filter(Boolean).join(' - ') || '-',
        x + wC + 4, y0 + 10,
        { width: wC - 8 },
      );

    return y0 + h;
  }

  private renderRemetenteDestinatario(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 72;
    const wC = w / 2;

    this.renderParticipantePortalBox(doc, x, y0, wC, h, 'REMETENTE', parsed.remetente);
    this.renderParticipantePortalBox(doc, x + wC, y0, wC, h, 'DESTINATÁRIO', parsed.destinatario);

    return y0 + h;
  }

  private renderExpedidorRecebedor(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 60;
    const wC = w / 2;

    // Sempre presentes — caixas vazias se não houver
    this.renderParticipantePortalBox(doc, x, y0, wC, h, 'EXPEDIDOR', parsed.expedidor ?? null);
    this.renderParticipantePortalBox(doc, x + wC, y0, wC, h, 'RECEBEDOR', parsed.recebedor ?? null);

    return y0 + h;
  }

  private renderTomadorCompleto(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 44;
    this.rect(doc, x, y0, w, h);
    doc.font(this.F).fontSize(5).fillColor('#000')
      .text('TOMADOR DO SERVIÇO', x + 4, y0 + 2);

    const tom = this.resolveTomadorParticipante(parsed);
    if (!tom) {
      doc.font(this.FI).fontSize(7).fillColor('#666')
        .text(`— Tomador "${parsed.tomador}" sem dados detalhados —`, x + 4, y0 + 14);
      return y0 + h;
    }

    doc.font(this.FB).fontSize(9).fillColor('#000')
      .text(tom.razaoSocial, x + 100, y0 + 2, { width: w - 110, ellipsis: true, lineBreak: false });

    const te = tom.endereco;
    // Linha 1: ENDEREÇO ROD MG... - BAIRRO    MUNICÍPIO UNAI    UF MG   CEP 38621-250
    doc.font(this.F).fontSize(5).text('ENDEREÇO', x + 4, y0 + 14);
    const enderecoStr = te
      ? [
          [te.logradouro, te.numero].filter(Boolean).join(', '),
          te.bairro,
        ].filter(Boolean).join(' - ')
      : '-';
    doc.font(this.FB).fontSize(7)
      .text(enderecoStr, x + 4, y0 + 20, { width: 280, ellipsis: true, lineBreak: false });

    doc.font(this.F).fontSize(5).text('MUNICÍPIO', x + 290, y0 + 14);
    doc.font(this.FB).fontSize(7)
      .text(te?.municipio ?? '-', x + 290, y0 + 20, { width: 110, ellipsis: true, lineBreak: false });

    doc.font(this.F).fontSize(5).text('UF', x + 405, y0 + 14);
    doc.font(this.FB).fontSize(7)
      .text(te?.uf ?? '-', x + 405, y0 + 20);

    doc.font(this.F).fontSize(5).text('CEP', x + 430, y0 + 14);
    doc.font(this.FB).fontSize(7)
      .text(this.formatCep(te?.cep), x + 430, y0 + 20, { width: w - 434, lineBreak: false });

    // Linha 2: CNPJ/CPF | INSCRIÇÃO ESTADUAL | PAÍS | FONE
    doc.font(this.F).fontSize(5).text('CNPJ/CPF', x + 4, y0 + 30);
    doc.font(this.FB).fontSize(7)
      .text(this.formatCnpj(tom.cnpj ?? tom.cpf), x + 4, y0 + 36, { width: 130 });

    doc.font(this.F).fontSize(5).text('INSCRIÇÃO ESTADUAL', x + 140, y0 + 30);
    doc.font(this.FB).fontSize(7)
      .text(tom.inscricaoEstadual ?? '-', x + 140, y0 + 36, { width: 140 });

    doc.font(this.F).fontSize(5).text('PAÍS', x + 290, y0 + 30);
    doc.font(this.FB).fontSize(7)
      .text(te?.pais ?? '-', x + 290, y0 + 36, { width: 110 });

    doc.font(this.F).fontSize(5).text('FONE', x + 405, y0 + 30);
    doc.font(this.FB).fontSize(7)
      .text(this.formatFone(te?.fone), x + 405, y0 + 36, { width: w - 410, lineBreak: false });

    return y0 + h;
  }

  private renderProdutoCarga(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 24;
    const w1 = w * 0.45;
    const w2 = w * 0.30;
    const w3 = w - w1 - w2;

    this.rect(doc, x, y0, w1, h);
    this.rect(doc, x + w1, y0, w2, h);
    this.rect(doc, x + w1 + w2, y0, w3, h);

    doc.font(this.F).fontSize(5).text('PRODUTO PREDOMINANTE', x + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(parsed.carga.produtoPredominante || '-', x + 4, y0 + 10, { width: w1 - 8, ellipsis: true, lineBreak: false });

    doc.font(this.F).fontSize(5).text('OUTRAS CARACTERÍSTICAS DA CARGA', x + w1 + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(parsed.carga.outrasCaracteristicas ?? '-', x + w1 + 4, y0 + 10, { width: w2 - 8, ellipsis: true, lineBreak: false });

    doc.font(this.F).fontSize(5).text('VALOR TOTAL DA MERCADORIA', x + w1 + w2 + 4, y0 + 2);
    doc.font(this.FB).fontSize(9)
      .text(this.formatMoney(parsed.carga.valorCarga), x + w1 + w2 + 4, y0 + 10, { width: w3 - 8, align: 'right' });

    return y0 + h;
  }

  private renderQuantidadesSeguro(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 40;

    // 3 quantidades + cubagem + qtde vol + nome seguradora + responsavel + apolice + averbacao
    // Pra simplificar: pegamos as 2 primeiras quantidades (tipo/unid) e exibimos
    const quantidades = parsed.carga.quantidades || [];
    const q1 = quantidades[0];
    const q2 = quantidades[1];
    const q3 = quantidades[2];

    // Cubagem (M3) vem do tipo 00 ou 04 normalmente
    const cubagem = quantidades.find((q) => q.tipoMedida === '00' || /m3|metro/i.test(q.descricao));
    // QTDE Volume vem do tipo 03 (UNIDADE)
    const qVol = quantidades.find((q) => q.tipoMedida === '03');

    // Linha 1: TP MED 1 | TP MED 2 | TP MED 3 | CUBAGEM | QTDE(VOL) | SEGURADORA | RESPONSÁVEL | APOLICE | AVERBAÇÃO
    const cols = [
      { label: 'TP MED /UN. MED', value: q1 ? `${q1.descricao}\n${this.formatNum(q1.quantidade)} ${q1.descricao}`.slice(0, 60) : '', w: 55 },
      { label: 'TP MED /UN. MED', value: q2 ? `${q2.descricao}\n${this.formatNum(q2.quantidade)} ${q2.descricao}`.slice(0, 60) : '', w: 55 },
      { label: 'TP MED /UN. MED', value: q3 ? `${q3.descricao}\n${this.formatNum(q3.quantidade)} ${q3.descricao}`.slice(0, 60) : '', w: 55 },
      { label: 'CUBAGEM(M3)', value: cubagem ? this.formatNum(cubagem.quantidade) : '', w: 45 },
      { label: 'QTDE(VOL)', value: qVol ? this.formatNum(qVol.quantidade) : '', w: 45 },
      { label: 'NOME DA SEGURADORA', value: parsed.seguro?.nomeSeguradora ?? '', w: 95 },
      { label: 'RESPONSÁVEL', value: parsed.seguro?.responsavelDescricao ?? '', w: 65 },
      { label: 'NÚMERO DA APOLICE', value: parsed.seguro?.numeroApolice ?? '', w: 75 },
      { label: 'NÚMERO DA AVERBAÇÃO', value: parsed.seguro?.numeroAverbacao ?? '', w: w - 490 },
    ];

    let cx = x;
    for (const c of cols) {
      this.rect(doc, cx, y0, c.w, h);
      doc.font(this.F).fontSize(5).fillColor('#000')
        .text(c.label, cx + 2, y0 + 1, { width: c.w - 4, ellipsis: true, lineBreak: false });
      doc.font(this.FB).fontSize(7)
        .text(c.value, cx + 2, y0 + 8, { width: c.w - 4, height: h - 10, ellipsis: true });
      cx += c.w;
    }

    return y0 + h;
  }

  private renderComponentesValor(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;

    // Header
    const hHeader = 12;
    this.rect(doc, x, y0, w, hHeader);
    doc.font(this.F).fontSize(6).fillColor('#000')
      .text('COMPONENTES DO VALOR DA PRESTAÇÃO DO SERVIÇO', x, y0 + 3, { width: w, align: 'center' });

    const yC = y0 + hHeader;
    const h = 50;
    const wRight = 110; // largura coluna direita (totais)
    const wLeft = w - wRight;
    const wCol = wLeft / 3;

    // 3 colunas: NOME | VALOR  (repetidas)
    const componentes = parsed.valores.componentes || [];
    for (let i = 0; i < 3; i++) {
      const xCol = x + i * wCol;
      this.rect(doc, xCol, yC, wCol * 0.5, h);
      this.rect(doc, xCol + wCol * 0.5, yC, wCol * 0.5, h);
      doc.font(this.F).fontSize(5).text('NOME', xCol + 2, yC + 1);
      doc.font(this.F).fontSize(5).text('VALOR', xCol + wCol * 0.5 + 2, yC + 1);
    }
    // Preenche os componentes (max 3 visíveis no fsist)
    componentes.slice(0, 3).forEach((c, i) => {
      const xCol = x + i * wCol;
      doc.font(this.FB).fontSize(7)
        .text(c.nome, xCol + 2, yC + 10, { width: wCol * 0.5 - 4, ellipsis: true, lineBreak: false });
      doc.font(this.FB).fontSize(7)
        .text(this.formatNum(c.valor), xCol + wCol * 0.5 + 2, yC + 10, { width: wCol * 0.5 - 4, align: 'right', lineBreak: false });
    });

    // Coluna direita: Valor Total + Valor a Receber
    const xR = x + wLeft;
    this.rect(doc, xR, yC, wRight, h / 2);
    this.rect(doc, xR, yC + h / 2, wRight, h / 2);
    doc.font(this.F).fontSize(5).text('VALOR TOTAL DO SERVIÇO', xR + 2, yC + 1);
    doc.font(this.FB).fontSize(10)
      .text(this.formatMoney(parsed.valores.valorTotalPrestacao), xR + 2, yC + 10, { width: wRight - 4, align: 'right' });

    doc.font(this.F).fontSize(5).text('VALOR A RECEBER', xR + 2, yC + h / 2 + 1);
    doc.font(this.FB).fontSize(10)
      .text(this.formatMoney(parsed.valores.valorReceber), xR + 2, yC + h / 2 + 10, { width: wRight - 4, align: 'right' });

    return yC + h;
  }

  private renderImposto(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;

    // Header
    const hHeader = 12;
    this.rect(doc, x, y0, w, hHeader);
    doc.font(this.F).fontSize(6).fillColor('#000')
      .text('INFORMAÇÕES RELATIVAS AO IMPOSTO', x, y0 + 3, { width: w, align: 'center' });

    const yI = y0 + hHeader;
    const h = 28;
    const icms = parsed.valores.icms;

    const cstOrCsosn = icms?.cst ?? icms?.csosn ?? null;
    const cstDesc = this.descricaoCstCte(cstOrCsosn);
    const cstLabel = !cstOrCsosn ? '-' : cstDesc ? `${cstOrCsosn} - ${cstDesc}` : cstOrCsosn;
    const cols = [
      { label: 'SITUAÇÃO TRIBUTÁRIA', value: cstLabel, w: 130 },
      { label: 'BASE DE CALCULO', value: icms ? this.formatNum(icms.vBC ?? 0) : '-', w: 80 },
      { label: 'ALÍQ ICMS', value: icms ? this.formatNum(icms.pICMS ?? 0) : '-', w: 60 },
      { label: 'VALOR ICMS', value: icms ? this.formatNum(icms.vICMS ?? 0) : '-', w: 80 },
      { label: '% RED. BC ICMS', value: icms?.pRedBC != null ? this.formatNum(icms.pRedBC) : '-', w: 80 },
      { label: 'ICMS ST', value: icms?.vICMSSTRet != null ? this.formatNum(icms.vICMSSTRet) : '-', w: w - 430 },
    ];

    let cx = x;
    for (const c of cols) {
      this.rect(doc, cx, yI, c.w, h);
      doc.font(this.F).fontSize(5).text(c.label, cx + 2, yI + 1, { width: c.w - 4, ellipsis: true, lineBreak: false });
      doc.font(this.FB).fontSize(8)
        .text(c.value, cx + 2, yI + 10, { width: c.w - 4, ellipsis: true, lineBreak: false });
      cx += c.w;
    }

    return yI + h;
  }

  private renderDocumentosOriginarios(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;

    // Header
    const hHeader = 12;
    this.rect(doc, x, y0, w, hHeader);
    doc.font(this.F).fontSize(6).fillColor('#000')
      .text('DOCUMENTOS ORIGINÁRIOS', x, y0 + 3, { width: w, align: 'center' });

    const yD = y0 + hHeader;
    const h = 70;
    const wCol = w / 2;

    // Cada coluna: TIPO DOC | CNPJ/CHAVE | SÉRIE/NRO. DOCUMENTO
    this.rect(doc, x, yD, wCol, h);
    this.rect(doc, x + wCol, yD, wCol, h);

    // Header das colunas
    const drawHeader = (cx: number) => {
      doc.font(this.F).fontSize(5)
        .text('TIPO DOC', cx + 4, yD + 1);
      doc.font(this.F).fontSize(5)
        .text('CNPJ/CHAVE', cx + 40, yD + 1);
      doc.font(this.F).fontSize(5)
        .text('SÉRIE/NRO. DOCUMENTO', cx + wCol - 90, yD + 1);
    };
    drawHeader(x);
    drawHeader(x + wCol);

    // Documentos: 2 colunas, distribuímos
    const docs = parsed.documentosTransportados || [];
    const half = Math.ceil(docs.length / 2);
    const colA = docs.slice(0, half);
    const colB = docs.slice(half);

    const drawDocList = (cx: number, list: typeof docs) => {
      let yy = yD + 10;
      for (const d of list) {
        const tipo = d.chaveNFe ? 'NFE' : d.numeroNF ? 'NF' : (d.tipoOutro ?? 'OUT');
        const chave = d.chaveNFe ?? d.numeroOutro ?? '';
        // Posições na chave NF-e 44 dígitos:
        //   UF(2) + AAMM(4) + CNPJ(14) + mod(2) + série(3, pos 22-25) +
        //   nNF(9, pos 25-34) + tpEmis(1) + cNF(8) + DV(1).
        const serieFromChave = d.chaveNFe ? d.chaveNFe.slice(22, 25).replace(/^0+/, '') || '0' : '';
        const numeroFromChave = d.chaveNFe ? d.chaveNFe.slice(25, 34).replace(/^0+/, '') : '';
        const serie = d.serie ?? serieFromChave;
        const numero = d.numeroNF
          ? `${serie}/${d.numeroNF}`
          : d.chaveNFe
            ? `${serie}/${numeroFromChave}`
            : '';
        doc.font(this.FB).fontSize(6).fillColor('#000')
          .text(tipo, cx + 4, yy, { width: 32, lineBreak: false });
        doc.font(this.F).fontSize(6)
          .text(chave, cx + 40, yy, { width: wCol - 132, ellipsis: true, lineBreak: false });
        doc.font(this.F).fontSize(6)
          .text(numero, cx + wCol - 90, yy, { width: 86, ellipsis: true, lineBreak: false });
        yy += 7;
        if (yy > yD + h - 4) break;
      }
    };
    drawDocList(x, colA);
    drawDocList(x + wCol, colB);

    return yD + h;
  }

  private renderObservacoes(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 50;

    // Header
    const hHeader = 12;
    this.rect(doc, x, y0, w, hHeader);
    doc.font(this.F).fontSize(6).fillColor('#000')
      .text('OBSERVAÇÕES', x, y0 + 3, { width: w, align: 'center' });

    const yO = y0 + hHeader;
    this.rect(doc, x, yO, w, h);

    const obs = [
      parsed.infoAdicionais.observacoes,
      parsed.infoAdicionais.infCpl,
      parsed.infoAdicionais.infAdFisco,
    ].filter(Boolean).join('\n');

    doc.font(this.F).fontSize(7).fillColor('#000')
      .text(obs || '-', x + 4, yO + 3, { width: w - 8, height: h - 6, ellipsis: true });

    return yO + h;
  }

  private renderDadosRodoviario(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;

    // Header
    const hHeader = 12;
    this.rect(doc, x, y0, w, hHeader);
    doc.font(this.F).fontSize(6).fillColor('#000')
      .text('DADOS ESPECÍFICOS DO MODAL RODOVIÁRIO - CARGA FRACIONADA', x, y0 + 3, { width: w, align: 'center' });

    const yD = y0 + hHeader;
    const h = 26;

    const w1 = 110, w2 = 110, w3 = 120;
    const w4 = w - w1 - w2 - w3;

    this.rect(doc, x, yD, w1, h);
    this.rect(doc, x + w1, yD, w2, h);
    this.rect(doc, x + w1 + w2, yD, w3, h);
    this.rect(doc, x + w1 + w2 + w3, yD, w4, h);

    const rodo = parsed.modal && parsed.modal.modalidade === '01'
      ? (parsed.modal as CteModalRodoviario)
      : null;

    doc.font(this.F).fontSize(5).text('RNTRC DA EMPRESA', x + 4, yD + 2);
    doc.font(this.FB).fontSize(8)
      .text(rodo?.rntrc ?? '-', x + 4, yD + 10, { width: w1 - 8 });

    doc.font(this.F).fontSize(5).text('CIOT', x + w1 + 4, yD + 2);
    doc.font(this.FB).fontSize(8)
      .text('-', x + w1 + 4, yD + 10, { width: w2 - 8 });

    doc.font(this.F).fontSize(5).text('DATA PREVISTA DE ENTREGA', x + w1 + w2 + 4, yD + 2);
    doc.font(this.FB).fontSize(8)
      .text('-', x + w1 + w2 + 4, yD + 10, { width: w3 - 8 });

    doc.font(this.F).fontSize(5)
      .text(
        'ESTE CONHECIMENTO DE TRANSPORTE ATENDE\nÀ LEGISLAÇÃO DE TRANSPORTE RODOVIÁRIO EM VIGOR',
        x + w1 + w2 + w3 + 4, yD + 5,
        { width: w4 - 8, align: 'center' },
      );

    return yD + h;
  }

  private renderUsoEmissorReservadoFisco(
    doc: PDFKit.PDFDocument,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 28;
    const wC = w / 2;

    this.rect(doc, x, y0, wC, h);
    this.rect(doc, x + wC, y0, wC, h);

    doc.font(this.F).fontSize(5).fillColor('#000')
      .text('USO EXCLUSIVO DO EMISSOR DO CT-E', x + 4, y0 + 1, { width: wC - 8, align: 'center' });
    doc.font(this.F).fontSize(5)
      .text('RESERVADO AO FISCO', x + wC + 4, y0 + 1, { width: wC - 8, align: 'center' });

    return y0 + h;
  }

  private renderRodape(doc: PDFKit.PDFDocument): void {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const y = this.PAGE_H - this.MARGIN - 8;
    doc.font(this.F).fontSize(6).fillColor('#666')
      .text(`Impresso em ${this.formatDate(new Date().toISOString())}`, x, y, { width: w / 2 });
    doc.font(this.F).fontSize(6).fillColor('#666')
      .text('Plataforma Capul — Módulo Fiscal (modelo Fsist)', x + w / 2, y, { width: w / 2, align: 'right' });
  }

  // ============================================================
  //  AUXILIARES
  // ============================================================

  private renderParticipantePortalBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    p: CteParticipante | null | undefined,
  ): void {
    this.rect(doc, x, y, w, h);
    doc.font(this.F).fontSize(5).fillColor('#000')
      .text(label, x + 4, y + 1);

    if (!p) {
      doc.font(this.FI).fontSize(7).fillColor('#888')
        .text('— não informado —', x + 4, y + 14);
      return;
    }

    // Razão social ao lado da label
    doc.font(this.FB).fontSize(8).fillColor('#000')
      .text(p.razaoSocial, x + 80, y + 1, { width: w - 84, ellipsis: true, lineBreak: false });

    const e = p.endereco;
    // Endereço
    doc.font(this.F).fontSize(5).text('ENDEREÇO', x + 4, y + 12);
    const endStr = e
      ? [[e.logradouro, e.numero].filter(Boolean).join(', '), e.bairro].filter(Boolean).join(' - ')
      : '-';
    doc.font(this.FB).fontSize(7)
      .text(endStr, x + 60, y + 12, { width: w - 64, ellipsis: true, lineBreak: false });

    // Município | CEP
    doc.font(this.F).fontSize(5).text('MUNICÍPIO', x + 4, y + 22);
    doc.font(this.FB).fontSize(7)
      .text(e?.municipio ?? '-', x + 60, y + 22, { width: w - 130, ellipsis: true, lineBreak: false });
    doc.font(this.F).fontSize(5).text('CEP', x + w - 70, y + 22);
    doc.font(this.FB).fontSize(7)
      .text(this.formatCep(e?.cep), x + w - 56, y + 22, { width: 52, lineBreak: false });

    // CNPJ/CPF | INSCRIÇÃO ESTADUAL
    doc.font(this.F).fontSize(5).text('CNPJ/CPF', x + 4, y + 32);
    doc.font(this.FB).fontSize(7)
      .text(this.formatCnpj(p.cnpj ?? p.cpf), x + 60, y + 32, { width: w - 64, lineBreak: false });

    doc.font(this.F).fontSize(5).text('INSCRIÇÃO ESTADUAL', x + 4, y + 42);
    doc.font(this.FB).fontSize(7)
      .text(p.inscricaoEstadual ?? '-', x + 80, y + 42, { width: w - 84, lineBreak: false });

    // País | Fone
    doc.font(this.F).fontSize(5).text('PAÍS', x + 4, y + 52);
    doc.font(this.FB).fontSize(7)
      .text(e?.pais ?? '-', x + 60, y + 52, { width: w - 200, lineBreak: false });
    doc.font(this.F).fontSize(5).text('FONE', x + w - 130, y + 52);
    doc.font(this.FB).fontSize(7)
      .text(this.formatFone(e?.fone), x + w - 110, y + 52, { width: 106, lineBreak: false });
  }

  private resolveTomadorParticipante(parsed: CteParsed): CteParticipante | null {
    switch (parsed.tomador) {
      case 'Remetente': return parsed.remetente;
      case 'Expedidor': return parsed.expedidor ?? null;
      case 'Recebedor': return parsed.recebedor ?? null;
      case 'Destinatário': return parsed.destinatario;
      case 'Outros': return parsed.tomadorOutros ?? null;
      default: return null;
    }
  }

  private descricaoCstCte(cst?: string | null): string {
    if (!cst) return '';
    const map: Record<string, string> = {
      '00': 'Tributação normal ICMS',
      '20': 'Tributação com BC reduzida ICMS',
      '40': 'Isenção ICMS',
      '41': 'Não tributada ICMS',
      '51': 'Diferimento ICMS',
      '60': 'ICMS cobrado por substituição tributária',
      '90': 'ICMS outros',
      // CSOSN — Simples Nacional
      '101': 'Tributada SN com permissão de crédito',
      '102': 'Tributada SN sem permissão de crédito',
      '103': 'Isenção SN para faixa de receita bruta',
      '201': 'Tributada SN com permissão de crédito e cobrança ICMS-ST',
      '202': 'Tributada SN sem permissão de crédito e cobrança ICMS-ST',
      '203': 'Isenção SN para faixa de RB e cobrança ICMS-ST',
      '300': 'Imune SN',
      '400': 'Não tributada SN',
      '500': 'ICMS cobrado anteriormente por ST',
      '900': 'Outros SN',
    };
    return map[cst] ?? '';
  }

  private rect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number): void {
    doc.lineWidth(0.5).strokeColor('#000').rect(x, y, w, h).stroke();
  }

  private async gerarBarcode(chave44: string): Promise<Buffer> {
    try {
      return await bwipjs.toBuffer({
        bcid: 'code128',
        text: chave44,
        scale: 2,
        height: 10,
        includetext: false,
        backgroundcolor: 'FFFFFF',
      });
    } catch (err) {
      this.logger.warn(`Falha ao gerar barcode para chave ${chave44}: ${(err as Error).message}`);
      return Buffer.alloc(0);
    }
  }

  private formatChavePontuada(c: string): string {
    // Estilo fsist: 31.2605.26.866.501/0001-49-57-001-000.001.191-122.488.243-5
    if (!c || c.length !== 44) return c ?? '-';
    return `${c.slice(0, 2)}.${c.slice(2, 6)}.${c.slice(6, 8)}.${c.slice(8, 11)}.${c.slice(11, 14)}/${c.slice(14, 18)}-${c.slice(18, 20)}-${c.slice(20, 22)}-${c.slice(22, 23)}${c.slice(23, 25)}.${c.slice(25, 28)}.${c.slice(28, 31)}-${c.slice(31, 34)}.${c.slice(34, 37)}.${c.slice(37, 40)}-${c.slice(40)}`;
  }

  private formatCnpj(cnpj: string | null | undefined): string {
    if (!cnpj) return '-';
    return formatCpfCnpj(cnpj);
  }

  private formatCep(cep: string | null | undefined): string {
    if (!cep) return '-';
    const d = cep.replace(/\D/g, '');
    if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, '$1-$2');
    return cep;
  }

  private formatDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  /**
   * Formata telefone brasileiro com defensiva contra placeholders comuns
   * em XMLs CT-e (0XXX0000000000, todos zeros, 6+ zeros consecutivos).
   */
  private formatFone(fone: string | null | undefined): string {
    if (!fone) return '-';
    let d = String(fone).replace(/\D/g, '');
    if (!d) return '-';
    if (/^0+$/.test(d) || /0{6,}/.test(d)) return '-';
    while (d.length > 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    if (d.length === 8) return d.replace(/(\d{4})(\d{4})/, '$1-$2');
    return d;
  }

  private formatMoney(n: number | null | undefined): string {
    if (n == null) return '-';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatNum(n: number | null | undefined): string {
    if (n == null) return '-';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
}
