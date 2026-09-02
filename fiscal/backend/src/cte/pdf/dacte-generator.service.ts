import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import type { CteParsed, CteParticipante } from '../parsers/cte-parsed.interface.js';
import { formatCpfCnpj } from '../../common/helpers/cnpj.helper.js';

/**
 * Geração do DACTE — Documento Auxiliar do CT-e.
 *
 * Layout ENCAT (manual CT-e 4.00) próximo ao padrão do portal SEFAZ
 * Nacional. Espelha visualmente o DANFE da Plataforma Capul: uma única
 * folha A4 retrato, organizada em blocos de bordas pretas com label em
 * 5pt no topo e valor em bold abaixo.
 *
 * Organização (sequencial, top-down):
 *
 *   1. Cabeçalho — emitente (transportador) | "DACTE" + nº/série | barcode + chave
 *   2. Protocolo de autorização SEFAZ
 *   3. Identificação fiscal — modal | tipo CT-e | serviço | tomador | emissão | CFOP
 *   4. Início/Término da prestação + natureza da operação
 *   5. Tomador do serviço (quem paga — destacado)
 *   6. Remetente | Destinatário (2 colunas)
 *   7. Expedidor | Recebedor (2 colunas — opcional, omitido se não houver)
 *   8. Produto predominante + outras características
 *   9. Componentes do valor da prestação (tabela)
 *  10. Informações do ICMS
 *  11. Documentos originários — chaves de NF-e referenciadas
 *  12. Observações gerais
 *  13. Reservado ao fisco
 *
 * Código de barras CODE-128C da chave (44 dígitos) gerado por bwip-js.
 */
@Injectable()
export class DacteGeneratorService {
  private readonly logger = new Logger(DacteGeneratorService.name);

  // ----- Layout constants -----
  private readonly PAGE_W = 595;
  private readonly PAGE_H = 842;
  private readonly MARGIN = 28;

  private readonly LINE_COLOR = '#000';
  private readonly LABEL_COLOR = '#000';

  private readonly F_DEFAULT = 'Helvetica';
  private readonly F_BOLD = 'Helvetica-Bold';
  private readonly F_ITALIC = 'Helvetica-Oblique';

  async generate(parsed: CteParsed): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const barcodePng = await this.gerarBarcode(parsed.dadosGerais.chave);

    let y = this.MARGIN;
    y = this.renderHeader(doc, parsed, barcodePng, y);
    y = this.renderProtocolo(doc, parsed, y);
    y = this.renderIdentificacaoFiscal(doc, parsed, y);
    y = this.renderInicioFimPrestacao(doc, parsed, y);
    y = this.renderTomador(doc, parsed, y);
    y = this.renderRemetenteDestinatario(doc, parsed, y);
    y = this.renderExpedidorRecebedor(doc, parsed, y);
    y = this.renderProdutoCarga(doc, parsed, y);
    y = this.renderComponentesValor(doc, parsed, y);
    y = this.renderImposto(doc, parsed, y);
    y = this.renderDocumentosOriginarios(doc, parsed, y);
    y = this.renderObservacoes(doc, parsed, y);
    this.renderReservadoFisco(doc, y);
    this.renderFooter(doc, parsed);

    doc.end();
    return finished;
  }

  // ============================================================
  //  BLOCOS
  // ============================================================

  private renderHeader(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    barcodePng: Buffer,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 110;
    this.rect(doc, x, y0, w, h);

    // Coluna 1: emitente (transportador)
    const xEmit = x;
    const wEmit = 240;
    this.rect(doc, xEmit, y0, wEmit, h);
    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text('TRANSPORTADOR / EMITENTE', xEmit + 4, y0 + 3);
    doc.font(this.F_BOLD).fontSize(10).fillColor('#000')
      .text(parsed.emitente.razaoSocial, xEmit + 4, y0 + 12, {
        width: wEmit - 8,
        height: 28,
        ellipsis: true,
      });

    const e = parsed.emitente.endereco;
    if (e) {
      const linhas: string[] = [];
      const l1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
      if (l1) linhas.push(l1);
      const l2 = [e.bairro, [e.municipio, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ');
      if (l2) linhas.push(l2);
      if (e.cep) linhas.push(`CEP: ${this.formatCep(e.cep)}`);

      doc.font(this.F_DEFAULT).fontSize(7).fillColor('#000')
        .text(linhas.join('\n'), xEmit + 4, y0 + 42, {
          width: wEmit - 8,
          height: 36,
        });
    }

    doc.font(this.F_DEFAULT).fontSize(7)
      .text(
        `CNPJ: ${this.formatCnpj(parsed.emitente.cnpj ?? parsed.emitente.cpf)}     IE: ${parsed.emitente.inscricaoEstadual ?? '-'}`,
        xEmit + 4,
        y0 + h - 16,
        { width: wEmit - 8 },
      );

    // Coluna 2: DACTE box
    const xDacte = xEmit + wEmit;
    const wDacte = 90;
    this.rect(doc, xDacte, y0, wDacte, h);
    doc.font(this.F_BOLD).fontSize(13)
      .text('DACTE', xDacte, y0 + 6, { width: wDacte, align: 'center' });
    doc.font(this.F_DEFAULT).fontSize(6)
      .text('Documento Auxiliar do', xDacte, y0 + 22, { width: wDacte, align: 'center' });
    doc.font(this.F_DEFAULT).fontSize(6)
      .text('Conhecimento de Transporte', xDacte, y0 + 30, { width: wDacte, align: 'center' });
    doc.font(this.F_DEFAULT).fontSize(6)
      .text('Eletrônico', xDacte, y0 + 38, { width: wDacte, align: 'center' });

    doc.font(this.F_DEFAULT).fontSize(6).fillColor('#333')
      .text('MODELO', xDacte + 4, y0 + 50);
    doc.font(this.F_BOLD).fontSize(9).fillColor('#000')
      .text(parsed.dadosGerais.modelo, xDacte + 4, y0 + 58, { width: 30 });

    doc.font(this.F_DEFAULT).fontSize(6).fillColor('#333')
      .text('SÉRIE', xDacte + 38, y0 + 50);
    doc.font(this.F_BOLD).fontSize(9).fillColor('#000')
      .text(parsed.dadosGerais.serie, xDacte + 38, y0 + 58, { width: 25 });

    doc.font(this.F_DEFAULT).fontSize(6).fillColor('#333')
      .text('FOLHA', xDacte + 64, y0 + 50);
    doc.font(this.F_BOLD).fontSize(9).fillColor('#000')
      .text('1/1', xDacte + 64, y0 + 58, { width: 22 });

    doc.font(this.F_DEFAULT).fontSize(6).fillColor('#333')
      .text('NÚMERO', xDacte + 4, y0 + 74);
    doc.font(this.F_BOLD).fontSize(9).fillColor('#000')
      .text(this.formatNumero(parsed.dadosGerais.numero), xDacte + 4, y0 + 82, {
        width: wDacte - 8,
      });

    // Coluna 3: barcode + chave + dados
    const xBar = xDacte + wDacte;
    const wBar = w - wEmit - wDacte;
    this.rect(doc, xBar, y0, wBar, h);

    if (barcodePng.length > 0) {
      try {
        doc.image(barcodePng, xBar + 6, y0 + 6, {
          width: wBar - 12,
          height: 30,
        });
      } catch (err) {
        this.logger.warn(`Falha ao embutir barcode: ${(err as Error).message}`);
      }
    }

    doc.font(this.F_DEFAULT).fontSize(6).fillColor('#333')
      .text('CHAVE DE ACESSO', xBar + 6, y0 + 40);
    doc.font(this.F_BOLD).fontSize(8).fillColor('#000')
      .text(this.formatChave(parsed.dadosGerais.chave), xBar + 6, y0 + 48, {
        width: wBar - 12,
      });

    doc.font(this.F_DEFAULT).fontSize(7).fillColor('#000')
      .text(
        'Consulta de autenticidade no portal nacional do CT-e, no site da Sefaz Autorizadora ou em www.cte.fazenda.gov.br',
        xBar + 6,
        y0 + 64,
        { width: wBar - 12, height: 20 },
      );

    // CFOP + tipo CT-e na faixa final
    const yFaixa = y0 + 86;
    this.drawCelula(doc, xBar, yFaixa, 70, 24, 'CFOP', parsed.dadosGerais.cfop ?? '-');
    this.drawCelula(
      doc,
      xBar + 70,
      yFaixa,
      wBar - 70,
      24,
      'NATUREZA DA OPERAÇÃO',
      parsed.dadosGerais.naturezaOperacao ?? '-',
    );

    return y0 + h;
  }

  private renderProtocolo(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 22;
    this.rect(doc, x, y0, w, h);

    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text('PROTOCOLO DE AUTORIZAÇÃO DE USO', x + 4, y0 + 2);

    if (parsed.protocoloAutorizacao) {
      const p = parsed.protocoloAutorizacao;
      const txt = `${p.protocolo}  -  ${this.formatDate(p.dataRecebimento)}  -  ${p.cStat} ${p.motivo}`;
      doc.font(this.F_BOLD).fontSize(8).fillColor('#000')
        .text(txt, x + 4, y0 + 10, { width: w - 8, ellipsis: true, lineBreak: false });
    } else {
      doc.font(this.F_ITALIC).fontSize(8).fillColor('#888')
        .text('— sem protocolo registrado —', x + 4, y0 + 10);
    }

    return y0 + h;
  }

  private renderIdentificacaoFiscal(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 26;
    const cols = [
      { w: 82,  label: 'MODAL',           value: parsed.dadosGerais.modalidadeDescricao },
      { w: 70,  label: 'TIPO DO CT-E',    value: parsed.dadosGerais.tipoCteDescricao },
      { w: 95,  label: 'TIPO DO SERVIÇO', value: parsed.dadosGerais.tipoServicoDescricao },
      { w: 80,  label: 'TOMADOR',         value: parsed.tomador },
      { w: 100, label: 'DATA DE EMISSÃO', value: this.formatDate(parsed.dadosGerais.dataEmissao) },
      { w: w - (82 + 70 + 95 + 80 + 100), label: 'AMBIENTE', value: parsed.dadosGerais.ambiente === '1' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO' },
    ];
    let cx = x;
    for (const c of cols) {
      this.drawCelula(doc, cx, y0, c.w, h, c.label, c.value);
      cx += c.w;
    }

    return y0 + h;
  }

  private renderInicioFimPrestacao(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 24;
    const wMeio = (w - 60) / 2;
    let cx = x;

    this.drawCelula(doc, cx, y0, 60, h, 'UF INÍCIO', parsed.dadosGerais.ufInicio ?? '-', 'center');
    cx += 60;

    this.drawCelula(doc, cx, y0, wMeio, h, 'MUNICÍPIO DE INÍCIO',
      this.extractMunicipio(parsed.remetente?.endereco) || '-');
    cx += wMeio;

    this.drawCelula(doc, cx, y0, 60, h, 'UF FIM', parsed.dadosGerais.ufFim ?? '-', 'center');
    cx += 60;

    this.drawCelula(doc, cx, y0, w - (60 + wMeio + 60), h, 'MUNICÍPIO DE TÉRMINO',
      this.extractMunicipio(parsed.destinatario?.endereco) || '-');

    return y0 + h;
  }

  private renderTomador(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const tomadorPart = this.resolveTomadorParticipante(parsed);
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    // h=44 (era 36): com 3 linhas de conteúdo (razão social + endereço +
    // CNPJ/IE), 36px não dava espaço suficiente — endereço (y+22) e CNPJ/IE
    // (y+25) ficavam a 3px de distância e o texto sobrepunha (fonte 7 ocupa
    // ~9px de altura). Layout atual: header y+2, razão y+10, endereço y+22,
    // CNPJ/IE y+33. Espaçamento consistente com renderParticipanteBox.
    const h = 44;
    this.rect(doc, x, y0, w, h);

    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text(`TOMADOR DO SERVIÇO  (${parsed.tomador})`, x + 4, y0 + 2);

    if (!tomadorPart) {
      const msg = parsed.tomador === 'Outros'
        ? '— Tomador "Outros": pagador externo (vide <toma4> no XML — não é remetente, expedidor, recebedor nem destinatário) —'
        : '— tomador não identificado —';
      doc.font(this.F_ITALIC).fontSize(7).fillColor('#666')
        .text(msg, x + 4, y0 + 14, { width: w - 8 });
      return y0 + h;
    }

    doc.font(this.F_BOLD).fontSize(9).fillColor('#000')
      .text(tomadorPart.razaoSocial, x + 4, y0 + 10, { width: w - 8, ellipsis: true, lineBreak: false });

    const tEnd = tomadorPart.endereco;
    const linhaEndereco = tEnd
      ? [
          [tEnd.logradouro, tEnd.numero].filter(Boolean).join(', '),
          tEnd.bairro,
          [tEnd.municipio, tEnd.uf].filter(Boolean).join('/'),
          tEnd.cep ? `CEP ${this.formatCep(tEnd.cep)}` : null,
        ].filter(Boolean).join(' - ')
      : '-';
    doc.font(this.F_DEFAULT).fontSize(7)
      .text(linhaEndereco, x + 4, y0 + 22, { width: w - 8, ellipsis: true, lineBreak: false });

    doc.font(this.F_DEFAULT).fontSize(7)
      .text(
        `CNPJ: ${this.formatCnpj(tomadorPart.cnpj ?? tomadorPart.cpf)}     IE: ${tomadorPart.inscricaoEstadual ?? '-'}`,
        x + 4,
        y0 + 33,
        { width: w - 8, ellipsis: true, lineBreak: false },
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
    const h = 50;
    const wCol = w / 2;

    this.renderParticipanteBox(doc, x, y0, wCol, h, 'REMETENTE', parsed.remetente);
    this.renderParticipanteBox(doc, x + wCol, y0, wCol, h, 'DESTINATÁRIO', parsed.destinatario);
    return y0 + h;
  }

  private renderExpedidorRecebedor(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    if (!parsed.expedidor && !parsed.recebedor) return y0;
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 40;
    const wCol = w / 2;

    this.renderParticipanteBox(doc, x, y0, wCol, h, 'EXPEDIDOR', parsed.expedidor);
    this.renderParticipanteBox(doc, x + wCol, y0, wCol, h, 'RECEBEDOR', parsed.recebedor);
    return y0 + h;
  }

  private renderProdutoCarga(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;

    // Linha 1: produto predominante + outras características
    const h1 = 24;
    this.drawCelula(
      doc,
      x,
      y0,
      w * 0.5,
      h1,
      'PRODUTO PREDOMINANTE',
      parsed.carga.produtoPredominante || '-',
    );
    this.drawCelula(
      doc,
      x + w * 0.5,
      y0,
      w * 0.5,
      h1,
      'OUTRAS CARACTERÍSTICAS',
      parsed.carga.outrasCaracteristicas || '-',
    );

    // Linha 2: quantidades + valor total da carga
    const h2 = 24;
    const qts = parsed.carga.quantidades.slice(0, 3); // mostra até 3 medidas
    const cQ = w * 0.7 / Math.max(qts.length || 1, 1);
    let cx = x;
    if (qts.length === 0) {
      this.drawCelula(doc, cx, y0 + h1, w * 0.7, h2, 'QUANTIDADE', '-');
      cx += w * 0.7;
    } else {
      for (const q of qts) {
        this.drawCelula(doc, cx, y0 + h1, cQ, h2, q.descricao.toUpperCase(), fmt(q.quantidade, 4));
        cx += cQ;
      }
    }
    this.drawCelula(doc, cx, y0 + h1, w - (cx - x), h2,
      'VALOR TOTAL DA CARGA (R$)', fmt(parsed.carga.valorCarga), 'right');

    return y0 + h1 + h2;
  }

  private renderComponentesValor(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const labelOffset = 10;     // espaco do label "COMPONENTES..." no topo do bloco
    const headerH = 14;          // altura do cabecalho da tabela ("NOME / VALOR")
    const lineH = 14;            // altura de cada linha de componente (aumentado de 12 pra evitar colisao com "VALOR TOTAL")
    const componentes = parsed.valores.componentes;
    const linhas = Math.max(componentes.length, 1);
    const tableH = labelOffset + headerH + linhas * lineH;
    const totalH = 20;
    const h = tableH + totalH;

    // Box externo
    this.rect(doc, x, y0, w, h);

    // Header
    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text('COMPONENTES DO VALOR DA PRESTAÇÃO DO SERVIÇO', x + 4, y0 + 2);

    const wDescr = w - 110;
    const wValor = 110;

    // Linha de cabeçalho da tabela
    const yHead = y0 + labelOffset;
    doc.lineWidth(0.3).strokeColor('#999')
      .moveTo(x, yHead).lineTo(x + w, yHead).stroke();
    doc.lineWidth(0.3).strokeColor('#999')
      .moveTo(x + wDescr, yHead).lineTo(x + wDescr, y0 + tableH).stroke();

    doc.font(this.F_BOLD).fontSize(6).fillColor('#000')
      .text('NOME', x + 4, yHead + 2, { width: wDescr - 6 });
    doc.font(this.F_BOLD).fontSize(6)
      .text('VALOR (R$)', x + wDescr + 2, yHead + 2, { width: wValor - 4, align: 'right' });

    // Linhas
    let cy = yHead + headerH;
    if (componentes.length === 0) {
      doc.font(this.F_ITALIC).fontSize(7).fillColor('#888')
        .text('— sem componentes detalhados —', x + 4, cy + 3, { width: wDescr - 6 });
    } else {
      for (const c of componentes) {
        doc.font(this.F_DEFAULT).fontSize(7).fillColor('#000')
          .text(c.nome, x + 4, cy + 3, { width: wDescr - 6, ellipsis: true, lineBreak: false });
        doc.font(this.F_DEFAULT).fontSize(7)
          .text(fmt(c.valor), x + wDescr + 2, cy + 3, { width: wValor - 6, align: 'right' });
        cy += lineH;
      }
    }

    // Linha total
    const yTotal = y0 + tableH;
    doc.lineWidth(0.5).strokeColor('#000')
      .moveTo(x, yTotal).lineTo(x + w, yTotal).stroke();

    doc.font(this.F_BOLD).fontSize(8).fillColor('#000')
      .text('VALOR TOTAL DA PRESTAÇÃO', x + 4, yTotal + 6, { width: wDescr - 6 });
    doc.font(this.F_BOLD).fontSize(10)
      .text(`R$ ${fmt(parsed.valores.valorTotalPrestacao)}`, x + wDescr + 2, yTotal + 5, {
        width: wValor - 6,
        align: 'right',
      });

    return y0 + h;
  }

  private renderImposto(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 26;
    const v = parsed.valores;

    const cols = [
      { w: 60,                        label: 'CST',                value: v.icmsCst ?? '-' , align: 'center' as const },
      { w: 110,                       label: 'BC ICMS (R$)',       value: fmt(v.icmsBase),    align: 'right'  as const },
      { w: 70,                        label: 'ALÍQ. (%)',          value: fmt(v.icmsAliquota, 2), align: 'right' as const },
      { w: 110,                       label: 'VALOR ICMS (R$)',    value: fmt(v.icmsValor),   align: 'right'  as const },
      { w: w - (60 + 110 + 70 + 110), label: 'VALOR A RECEBER (R$)', value: fmt(v.valorReceber), align: 'right' as const },
    ];
    let cx = x;
    for (const c of cols) {
      this.drawCelula(doc, cx, y0, c.w, h, c.label, c.value, c.align);
      cx += c.w;
    }

    return y0 + h;
  }

  private renderDocumentosOriginarios(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    const docs = parsed.documentosTransportados;
    if (docs.length === 0) return y0;

    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const labelOffset = 10;
    const headerH = 12;
    const lineH = 12;            // aumentado pra evitar colisao com cabecalho
    const linhas = Math.min(docs.length, 8); // limita 8 linhas
    const h = labelOffset + headerH + linhas * lineH + 4;

    this.rect(doc, x, y0, w, h);
    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text(`DOCUMENTOS ORIGINÁRIOS  (${docs.length} ${docs.length === 1 ? 'documento' : 'documentos'})`,
        x + 4, y0 + 2);

    // Cabeçalho da tabela
    const yHead = y0 + labelOffset;
    const colW = [50, 50, 70, w - 50 - 50 - 70 - 8];
    let cx = x + 4;
    const headers = ['SÉRIE', 'NÚMERO', 'TIPO', 'CHAVE 44'];
    doc.font(this.F_BOLD).fontSize(6).fillColor('#000');
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], cx, yHead + 2, { width: colW[i] });
      cx += colW[i];
    }

    // Linha separadora ABAIXO do cabecalho (separando header das linhas)
    const ySep = yHead + headerH;
    doc.lineWidth(0.3).strokeColor('#999')
      .moveTo(x, ySep).lineTo(x + w, ySep).stroke();

    // Linhas
    let cy = ySep;
    doc.font(this.F_DEFAULT).fontSize(7).fillColor('#000');
    for (const d of docs.slice(0, linhas)) {
      cx = x + 4;
      doc.text(d.serie ?? '-', cx, cy + 2, { width: colW[0] });
      cx += colW[0];
      doc.text(d.numeroNF ?? '-', cx, cy + 2, { width: colW[1] });
      cx += colW[1];
      doc.text(d.chaveNFe ? 'NF-e' : 'NF', cx, cy + 2, { width: colW[2] });
      cx += colW[2];
      doc.font(this.F_DEFAULT).fontSize(6)
        .text(d.chaveNFe ? this.formatChave(d.chaveNFe) : '-', cx, cy + 3, {
          width: colW[3],
          ellipsis: true,
          lineBreak: false,
        });
      doc.font(this.F_DEFAULT).fontSize(7);
      cy += lineH;
    }

    if (docs.length > linhas) {
      doc.font(this.F_ITALIC).fontSize(6).fillColor('#666')
        .text(`+ ${docs.length - linhas} documento(s) não exibido(s) — ver detalhes no XML`,
          x + 4, cy + 1, { width: w - 8 });
    }

    return y0 + h;
  }

  private renderObservacoes(
    doc: PDFKit.PDFDocument,
    parsed: CteParsed,
    y0: number,
  ): number {
    if (!parsed.observacoes) return y0;
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = 50;

    this.rect(doc, x, y0, w, h);
    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text('OBSERVAÇÕES GERAIS', x + 4, y0 + 2);
    doc.font(this.F_DEFAULT).fontSize(7).fillColor('#000')
      .text(parsed.observacoes, x + 4, y0 + 12, {
        width: w - 8,
        height: h - 14,
      });

    return y0 + h;
  }

  private renderReservadoFisco(doc: PDFKit.PDFDocument, y0: number): void {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    // Calcula altura disponível até o footer
    const footerY = this.PAGE_H - this.MARGIN - 14;
    let h = footerY - y0 - 4;
    if (h < 30) h = 30;
    if (h > 60) h = 60;

    this.rect(doc, x, y0, w, h);
    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text('RESERVADO AO FISCO', x + 4, y0 + 2);
  }

  private renderFooter(doc: PDFKit.PDFDocument, _parsed: CteParsed): void {
    const yFooter = this.PAGE_H - this.MARGIN - 8;
    doc.font(this.F_ITALIC).fontSize(6).fillColor('#666')
      .text(
        `Impresso em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}    |    Plataforma Capul — Módulo Fiscal`,
        this.MARGIN,
        yFooter,
        { width: this.PAGE_W - 2 * this.MARGIN, align: 'center' },
      );
    doc.fillColor('#000');
  }

  // ============================================================
  //  HELPERS — boxes de participante
  // ============================================================

  private renderParticipanteBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    p: CteParticipante | null | undefined,
  ): void {
    this.rect(doc, x, y, w, h);
    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text(label, x + 4, y + 2);

    if (!p) {
      doc.font(this.F_ITALIC).fontSize(8).fillColor('#888')
        .text('— não informado —', x + 4, y + 14);
      return;
    }

    doc.font(this.F_BOLD).fontSize(8).fillColor('#000')
      .text(p.razaoSocial, x + 4, y + 10, { width: w - 8, ellipsis: true, lineBreak: false });

    const e = p.endereco;
    const linhas: string[] = [];
    if (e) {
      const l1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
      if (l1) linhas.push(l1);
      const l2 = [e.bairro, [e.municipio, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ');
      if (l2) linhas.push(l2);
      if (e.cep) linhas.push(`CEP ${this.formatCep(e.cep)}`);
    }
    doc.font(this.F_DEFAULT).fontSize(6).fillColor('#000')
      .text(linhas.join('\n'), x + 4, y + 20, { width: w - 8, height: h - 30 });

    doc.font(this.F_DEFAULT).fontSize(6)
      .text(
        `CNPJ: ${this.formatCnpj(p.cnpj ?? p.cpf)}     IE: ${p.inscricaoEstadual ?? '-'}`,
        x + 4,
        y + h - 9,
        { width: w - 8, ellipsis: true, lineBreak: false },
      );
  }

  // ============================================================
  //  HELPERS — desenho, formatação, barcode
  // ============================================================

  private rect(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    doc.lineWidth(0.5).strokeColor(this.LINE_COLOR).rect(x, y, w, h).stroke();
  }

  private drawCelula(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    valor: string,
    align: 'left' | 'right' | 'center' = 'left',
    destaque: boolean = false,
  ): void {
    this.rect(doc, x, y, w, h);
    doc.font(this.F_DEFAULT).fontSize(5).fillColor('#333')
      .text(label, x + 2, y + 1, {
        width: w - 4,
        height: 6,
        ellipsis: true,
        lineBreak: false,
      });
    doc.font(this.F_BOLD).fontSize(destaque ? 9 : 8).fillColor(this.LABEL_COLOR)
      .text(valor, x + 2, y + 8, {
        width: w - 4,
        align,
        height: h - 8,
        ellipsis: true,
        lineBreak: false,
      });
  }

  private async gerarBarcode(chave44: string): Promise<Buffer> {
    try {
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: chave44,
        scale: 2,
        height: 10,
        includetext: false,
        backgroundcolor: 'FFFFFF',
      });
      return png;
    } catch (err) {
      this.logger.warn(
        `Falha ao gerar barcode para chave ${chave44}: ${(err as Error).message}`,
      );
      return Buffer.alloc(0);
    }
  }

  private formatChave(chave: string): string {
    return chave.replace(/(\d{4})(?=\d)/g, '$1 ');
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

  private formatNumero(numero: string): string {
    const n = numero.padStart(9, '0');
    return n.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  }

  private extractMunicipio(
    end: CteParticipante['endereco'] | null | undefined,
  ): string | null {
    if (!end) return null;
    return end.municipio ?? null;
  }

  private resolveTomadorParticipante(parsed: CteParsed): CteParticipante | null {
    switch (parsed.tomador) {
      case 'Remetente': return parsed.remetente;
      case 'Expedidor': return parsed.expedidor ?? null;
      case 'Recebedor': return parsed.recebedor ?? null;
      case 'Destinatário': return parsed.destinatario;
      default: return null;
    }
  }
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '-';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
