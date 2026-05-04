import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { NfeParsed } from '../parsers/nfe-parsed.interface.js';

/**
 * Geração do "Resumo NF-e" — relatório de impressão estilo portal SEFAZ
 * (botão "Preparar documento para impressão" do portal nacional NFe).
 *
 * Diferente do DANFE (documento fiscal oficial ABNT/ENCAT), este resumo é
 * uma ferramenta operacional do escritório fiscal: cabe em uma página A4,
 * traz Dados/Emitente/Destinatário/Produtos/Eventos/Digest e é usado para
 * arquivamento de pasta, conferência rápida e auditoria interna.
 *
 * Layout retrato A4, margem ~10mm, paleta SEFAZ (bege #fffaf0 + dourado #8b6508)
 * com cor sempre presente (PDFKit ignora restrição "print colors" do navegador).
 *
 * Caller fornece um `NfeParsed` já com eventos sincronizados via
 * /atualizar-eventos-protheus — esta service não chama Protheus nem SEFAZ.
 */
@Injectable()
export class ResumoSefazGeneratorService {
  private readonly logger = new Logger(ResumoSefazGeneratorService.name);

  // ----- Layout (pontos: 1pt = 1/72 polegada). A4 = 595 × 842. -----
  private readonly PAGE_W = 595;
  private readonly PAGE_H = 842;
  private readonly MARGIN = 28; // ~10mm
  private readonly INNER_W = this.PAGE_W - 2 * this.MARGIN;

  // Paleta SEFAZ
  private readonly COR_TITULO = '#8b6508';      // dourado escuro — h1 e h2
  private readonly COR_BORDA = '#b5925a';       // marrom claro — bordas das caixas
  private readonly COR_BG_CAMPO = '#fffaf0';    // creme — fundo das caixas
  private readonly COR_BG_HEADER = '#f4e4c1';   // bege — header de tabela e valor total
  private readonly COR_LABEL = '#5a4500';       // marrom — labels das caixas
  private readonly COR_TEXTO = '#000';

  // Tipografia
  private readonly F_DEFAULT = 'Helvetica';
  private readonly F_BOLD = 'Helvetica-Bold';
  private readonly F_ITALIC = 'Helvetica-Oblique';
  private readonly FS_LABEL = 7;
  private readonly FS_VALOR = 9;
  private readonly FS_H1 = 14;
  private readonly FS_H2 = 11;
  private readonly FS_TABELA = 8.5;
  private readonly FS_RODAPE = 7;

  // Alturas
  private readonly H_LINHA_CAMPO = 22; // altura padrão de cada campo (label+valor)
  private readonly H_LINHA_TABELA = 14; // altura padrão de cada linha de tabela

  async generate(parsed: NfeParsed, filial: string): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0, // margens manuais — coordenada absoluta
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    let y = this.MARGIN;

    // === 1. Cabeçalho "Consultar NF-e" + situação ===
    y = this.renderH1(doc, 'Consultar NF-e', y);
    y = this.renderSituacao(doc, parsed, y);
    y += 4;

    // === 2. Dados da NFe ===
    y = this.renderH2(doc, 'Dados da NFe', y);
    y = this.renderLinhaCampos(doc, y, [
      { label: 'Natureza da operação', valor: parsed.dadosGerais.naturezaOperacao, peso: 38 },
      {
        label: 'Tipo da operação',
        valor: `${parsed.dadosGerais.tipoOperacao} - ${parsed.dadosGerais.tipoOperacaoDescricao}`,
        peso: 14,
      },
      {
        label: 'Chave de acesso',
        valor: this.fmtChaveSefaz(parsed.dadosGerais.chave),
        peso: 48,
        mono: true,
      },
    ]);
    y = this.renderLinhaCampos(doc, y, [
      { label: 'Modelo', valor: parsed.dadosGerais.modelo, peso: 10 },
      { label: 'Série', valor: parsed.dadosGerais.serie, peso: 10 },
      { label: 'Número', valor: parsed.dadosGerais.numero, peso: 20 },
      {
        label: 'Data/Hora da emissão',
        valor: this.fmtDataHora(parsed.dadosGerais.dataEmissao),
        peso: 60,
      },
    ]);

    // === 3. Emitente ===
    y += 4;
    y = this.renderH2(doc, 'Emitente', y);
    y = this.renderLinhaCampos(doc, y, [
      { label: 'CNPJ', valor: this.fmtCnpj(parsed.emitente.cnpj ?? parsed.emitente.cpf), peso: 18 },
      { label: 'IE', valor: parsed.emitente.inscricaoEstadual ?? '-', peso: 18 },
      { label: 'Nome/Razão Social', valor: parsed.emitente.razaoSocial, peso: 40 },
      { label: 'Município', valor: parsed.emitente.endereco.municipio ?? '-', peso: 18 },
      { label: 'UF', valor: parsed.emitente.endereco.uf ?? '-', peso: 6 },
    ]);

    // === 4. Destinatário ===
    y += 4;
    y = this.renderH2(doc, 'Destinatário', y);
    y = this.renderLinhaCampos(doc, y, [
      { label: 'CNPJ', valor: this.fmtCnpj(parsed.destinatario.cnpj ?? parsed.destinatario.cpf), peso: 18 },
      { label: 'IE', valor: parsed.destinatario.inscricaoEstadual ?? '-', peso: 14 },
      { label: 'Nome/Razão Social', valor: parsed.destinatario.razaoSocial, peso: 34 },
      { label: 'Município', valor: parsed.destinatario.endereco.municipio ?? '-', peso: 18 },
      { label: 'UF', valor: parsed.destinatario.endereco.uf ?? '-', peso: 6 },
      { label: 'País', valor: parsed.destinatario.endereco.pais ?? 'BRASIL', peso: 10 },
    ]);

    // === 5. Produtos ===
    y += 4;
    y = this.renderH2(doc, 'Produtos', y);
    y = this.renderTabelaProdutos(doc, parsed, y);

    // === 6. Eventos e Serviços ===
    y += 4;
    y = this.renderH2(doc, 'Eventos e Serviços', y);
    y = this.renderTabelaEventos(doc, parsed, y);

    // === 7. Digest Value ===
    if (parsed.dadosGerais.digestValue) {
      y += 4;
      y = this.renderH2(doc, 'Digest Value', y);
      y = this.renderLinhaCampos(doc, y, [
        {
          label: 'Digest Value da NF-e',
          valor: parsed.dadosGerais.digestValue,
          peso: 100,
          mono: true,
        },
      ]);
    }

    // === Rodapé ===
    this.renderRodape(doc, parsed, filial);

    doc.end();
    return finished;
  }

  // ============================================================
  // Blocos
  // ============================================================

  private renderH1(doc: PDFKit.PDFDocument, texto: string, y: number): number {
    doc
      .fillColor(this.COR_TITULO)
      .font(this.F_BOLD)
      .fontSize(this.FS_H1)
      .text(texto, this.MARGIN, y);
    const novoY = y + this.FS_H1 + 2;
    doc
      .moveTo(this.MARGIN, novoY)
      .lineTo(this.PAGE_W - this.MARGIN, novoY)
      .lineWidth(1.5)
      .strokeColor(this.COR_TITULO)
      .stroke();
    return novoY + 4;
  }

  private renderSituacao(doc: PDFKit.PDFDocument, parsed: NfeParsed, y: number): number {
    const situacao =
      parsed.dadosGerais.ambiente === '1'
        ? 'AUTORIZADA (Ambiente: produção)'
        : 'AUTORIZADA (Ambiente: homologação)';
    doc
      .fillColor(this.COR_LABEL)
      .font(this.F_BOLD)
      .fontSize(this.FS_VALOR)
      .text('Situação atual: ', this.MARGIN, y, { continued: true })
      .font(this.F_DEFAULT)
      .text(situacao);
    return y + this.FS_VALOR + 4;
  }

  private renderH2(doc: PDFKit.PDFDocument, texto: string, y: number): number {
    doc
      .fillColor(this.COR_TITULO)
      .font(this.F_BOLD)
      .fontSize(this.FS_H2)
      .text(texto, this.MARGIN, y);
    const novoY = y + this.FS_H2 + 1;
    doc
      .moveTo(this.MARGIN, novoY)
      .lineTo(this.PAGE_W - this.MARGIN, novoY)
      .lineWidth(0.7)
      .strokeColor(this.COR_TITULO)
      .stroke();
    return novoY + 3;
  }

  private renderLinhaCampos(
    doc: PDFKit.PDFDocument,
    y: number,
    campos: Array<{ label: string; valor: string; peso: number; mono?: boolean }>,
  ): number {
    const totalPeso = campos.reduce((s, c) => s + c.peso, 0);
    const gap = 2;
    const totalGap = gap * (campos.length - 1);
    const larguraDisp = this.INNER_W - totalGap;
    let x = this.MARGIN;
    let alturaMaxima = this.H_LINHA_CAMPO;

    // Primeira passada: descobre altura necessária (texto pode quebrar)
    for (const campo of campos) {
      const w = (campo.peso / totalPeso) * larguraDisp;
      const fontFam = campo.mono ? 'Courier' : this.F_DEFAULT;
      doc.font(fontFam).fontSize(this.FS_VALOR);
      const alturaTextoValor = doc.heightOfString(campo.valor || '-', {
        width: w - 8,
        lineGap: 0,
      });
      const alturaTotal = this.FS_LABEL + 3 + alturaTextoValor + 5;
      if (alturaTotal > alturaMaxima) alturaMaxima = alturaTotal;
    }

    // Segunda passada: desenha
    for (const campo of campos) {
      const w = (campo.peso / totalPeso) * larguraDisp;
      // Caixa
      doc
        .rect(x, y, w, alturaMaxima)
        .fillColor(this.COR_BG_CAMPO)
        .fill()
        .rect(x, y, w, alturaMaxima)
        .lineWidth(0.5)
        .strokeColor(this.COR_BORDA)
        .stroke();
      // Label
      doc
        .fillColor(this.COR_LABEL)
        .font(this.F_DEFAULT)
        .fontSize(this.FS_LABEL)
        .text(campo.label, x + 4, y + 2, { width: w - 8, lineBreak: false, ellipsis: true });
      // Valor
      const fontFam = campo.mono ? 'Courier' : this.F_DEFAULT;
      doc
        .fillColor(this.COR_TEXTO)
        .font(fontFam)
        .fontSize(this.FS_VALOR)
        .text(campo.valor || '-', x + 4, y + 2 + this.FS_LABEL + 2, {
          width: w - 8,
          lineGap: 0,
        });
      x += w + gap;
    }

    return y + alturaMaxima + 2;
  }

  private renderTabelaProdutos(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    y: number,
  ): number {
    // Colunas: # | Descrição | Qtd | Unid | V.Unit | V.Prod
    const cols = [
      { label: '#', peso: 4, align: 'right' as const },
      { label: 'Descrição', peso: 40, align: 'left' as const },
      { label: 'Quantidade', peso: 11, align: 'right' as const },
      { label: 'Unid. Com.', peso: 9, align: 'center' as const },
      { label: 'Valor Unit.', peso: 11, align: 'right' as const },
      { label: 'Valor Prod.', peso: 13, align: 'right' as const },
    ];
    const totalPeso = cols.reduce((s, c) => s + c.peso, 0);
    const larguras = cols.map((c) => (c.peso / totalPeso) * this.INNER_W);

    let yAtual = y;

    // Header
    yAtual = this.renderTabelaHeader(doc, yAtual, cols, larguras);

    // Body
    if (parsed.produtos.length === 0) {
      yAtual = this.renderTabelaLinha(doc, yAtual, ['—', 'Sem produtos', '', '', '', ''], cols, larguras);
    } else {
      for (const p of parsed.produtos) {
        const decUnit = p.valorUnitarioComercial < 1 ? 4 : 2;
        yAtual = this.renderTabelaLinha(
          doc,
          yAtual,
          [
            String(p.item),
            p.descricao,
            this.fmtNum(p.quantidadeComercial, 4),
            p.unidadeComercial,
            this.fmtNum(p.valorUnitarioComercial, decUnit),
            this.fmtNum(p.valorTotalBruto, 2),
          ],
          cols,
          larguras,
        );
      }
    }

    // Linha de total
    yAtual = this.renderTabelaLinha(
      doc,
      yAtual,
      ['', '', '', '', 'Valor total', this.fmtNum(parsed.totais.valorNota, 2)],
      cols,
      larguras,
      { totalRow: true },
    );

    return yAtual;
  }

  private renderTabelaEventos(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    y: number,
  ): number {
    const cols = [
      { label: 'Evento', peso: 30, align: 'left' as const },
      { label: 'Protocolo', peso: 17, align: 'left' as const },
      { label: 'Data autorização', peso: 26, align: 'left' as const },
      { label: 'Data Inclusão AN', peso: 27, align: 'left' as const },
    ];
    const totalPeso = cols.reduce((s, c) => s + c.peso, 0);
    const larguras = cols.map((c) => (c.peso / totalPeso) * this.INNER_W);

    let yAtual = this.renderTabelaHeader(doc, y, cols, larguras);

    // Monta lista deduplicada
    const eventos = this.dedupeEventos(parsed);
    if (eventos.length === 0) {
      yAtual = this.renderTabelaLinha(
        doc,
        yAtual,
        ['Sem eventos', '', '', ''],
        cols,
        larguras,
      );
    } else {
      for (const ev of eventos) {
        yAtual = this.renderTabelaLinha(
          doc,
          yAtual,
          [
            ev.descricao,
            ev.protocolo ?? '-',
            this.fmtDataHoraEvento(ev.dataAutorizacao),
            this.fmtDataHoraEvento(ev.dataInclusaoAn),
          ],
          cols,
          larguras,
        );
      }
    }

    return yAtual;
  }

  private renderTabelaHeader(
    doc: PDFKit.PDFDocument,
    y: number,
    cols: Array<{ label: string; peso: number; align: 'left' | 'right' | 'center' }>,
    larguras: number[],
  ): number {
    const altura = this.H_LINHA_TABELA;
    let x = this.MARGIN;
    // Fundo bege do header
    doc
      .rect(this.MARGIN, y, this.INNER_W, altura)
      .fillColor(this.COR_BG_HEADER)
      .fill();
    // Texto e bordas
    cols.forEach((col, i) => {
      const w = larguras[i];
      doc
        .rect(x, y, w, altura)
        .lineWidth(0.5)
        .strokeColor(this.COR_BORDA)
        .stroke();
      doc
        .fillColor(this.COR_LABEL)
        .font(this.F_BOLD)
        .fontSize(this.FS_TABELA)
        .text(col.label, x + 4, y + 3, {
          width: w - 8,
          align: col.align,
          lineBreak: false,
          ellipsis: true,
        });
      x += w;
    });
    return y + altura;
  }

  private renderTabelaLinha(
    doc: PDFKit.PDFDocument,
    y: number,
    valores: string[],
    cols: Array<{ label: string; peso: number; align: 'left' | 'right' | 'center' }>,
    larguras: number[],
    opts: { totalRow?: boolean } = {},
  ): number {
    // Mede altura necessária da linha (texto pode quebrar)
    let alturaCalc = this.H_LINHA_TABELA;
    cols.forEach((col, i) => {
      const w = larguras[i];
      doc.font(this.F_DEFAULT).fontSize(this.FS_TABELA);
      const h = doc.heightOfString(valores[i] || '-', {
        width: w - 8,
        lineGap: 0,
      });
      const total = h + 6;
      if (total > alturaCalc) alturaCalc = total;
    });

    let x = this.MARGIN;
    if (opts.totalRow) {
      doc
        .rect(this.MARGIN, y, this.INNER_W, alturaCalc)
        .fillColor(this.COR_BG_HEADER)
        .fill();
    }
    cols.forEach((col, i) => {
      const w = larguras[i];
      doc
        .rect(x, y, w, alturaCalc)
        .lineWidth(0.4)
        .strokeColor(this.COR_BORDA)
        .stroke();
      doc
        .fillColor(this.COR_TEXTO)
        .font(opts.totalRow ? this.F_BOLD : this.F_DEFAULT)
        .fontSize(this.FS_TABELA)
        .text(valores[i] || '-', x + 4, y + 3, {
          width: w - 8,
          align: col.align,
          lineGap: 0,
        });
      x += w;
    });

    return y + alturaCalc;
  }

  private renderRodape(doc: PDFKit.PDFDocument, _parsed: NfeParsed, filial: string): void {
    const yRodape = this.PAGE_H - this.MARGIN + 6;
    const texto = `Resumo gerado em ${new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    })} · Plataforma Capul · Filial ${filial}`;
    doc
      .fillColor('#666')
      .font(this.F_ITALIC)
      .fontSize(this.FS_RODAPE)
      .text(texto, this.MARGIN, yRodape, {
        width: this.INNER_W,
        align: 'right',
      });
  }

  // ============================================================
  // Helpers de formatação
  // ============================================================

  private dedupeEventos(parsed: NfeParsed): Array<{
    descricao: string;
    protocolo: string | null;
    dataAutorizacao: string | null;
    dataInclusaoAn: string | null;
  }> {
    const lista: Array<{
      descricao: string;
      protocolo: string | null;
      dataAutorizacao: string | null;
      dataInclusaoAn: string | null;
    }> = [];
    const protocolosVistos = new Set<string>();
    const ehAutorizacao = (descr: string) => /autoriz/i.test(descr);

    if (parsed.protocoloAutorizacao?.protocolo) {
      lista.push({
        descricao: 'Autorização de Uso',
        protocolo: parsed.protocoloAutorizacao.protocolo,
        dataAutorizacao: parsed.protocoloAutorizacao.dataRecebimento ?? null,
        dataInclusaoAn: parsed.protocoloAutorizacao.dataRecebimento ?? null,
      });
      protocolosVistos.add(parsed.protocoloAutorizacao.protocolo);
    }
    const jaTemAutorizacao = lista.some((e) => ehAutorizacao(e.descricao));
    for (const ev of parsed.eventos) {
      if (ev.protocolo && protocolosVistos.has(ev.protocolo)) continue;
      if (jaTemAutorizacao && ehAutorizacao(ev.descricao)) continue;
      if (ev.protocolo) protocolosVistos.add(ev.protocolo);
      lista.push({
        descricao: ev.descricao,
        protocolo: ev.protocolo ?? null,
        dataAutorizacao: ev.dataEvento ?? null,
        dataInclusaoAn: ev.dataEvento ?? null,
      });
    }
    return lista;
  }

  private fmtChaveSefaz(chave: string): string {
    const d = (chave ?? '').replace(/\D/g, '');
    if (d.length !== 44) return chave ?? '-';
    return [
      d.slice(0, 2),
      d.slice(2, 6),
      d.slice(6, 20),
      d.slice(20, 22),
      d.slice(22, 25),
      d.slice(25, 34),
      d.slice(34, 43),
      d.slice(43, 44),
    ].join('-');
  }

  private fmtCnpj(s: string | null | undefined): string {
    if (!s) return '-';
    const d = s.replace(/\D/g, '');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return s;
  }

  private fmtDataHora(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const offsetMatch = iso.match(/[+-]\d{2}:?\d{2}$/);
    const offset = offsetMatch ? offsetMatch[0] : '';
    const dataLocal = d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${dataLocal}${offset}`;
  }

  private fmtDataHoraEvento(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const offsetMatch = iso.match(/[+-]\d{2}:?\d{2}$/);
    const offset = offsetMatch ? offsetMatch[0] : '';
    const dataLocal = d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const horaLocal = d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${dataLocal} às ${horaLocal}${offset}`;
  }

  private fmtNum(v: number | null | undefined, dec: number): string {
    if (v == null || isNaN(v)) return '-';
    return v.toLocaleString('pt-BR', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }
}
