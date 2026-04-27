import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import type { NfeParsed, NfeProduto } from '../parsers/nfe-parsed.interface.js';

type ColunaProduto =
  | 'codigo'
  | 'descricao'
  | 'ncm'
  | 'ocst'
  | 'cfop'
  | 'un'
  | 'quant'
  | 'vUnit'
  | 'vTotal'
  | 'vDesc'
  | 'bcIcms'
  | 'vIcms'
  | 'vIpi'
  | 'aliqIcms'
  | 'aliqIpi';

/**
 * Geração do DANFE — Documento Auxiliar da NF-e.
 *
 * Layout ABNT/ENCAT próximo ao padrão Fsist, ajustado para a Plataforma Capul.
 *
 * Organização do PDF (retrato, A4, margem 10mm):
 *   - Folha 1: strip de recebimento + header DANFE + identificação + cálculo
 *     impostos + transportador + tabela de produtos (primeira página)
 *   - Folhas 2+: header DANFE compacto + continuação da tabela de produtos
 *   - Última folha: tabela de produtos + dados adicionais + reservado ao fisco
 *   - Footer em todas as folhas: "Impresso em..." | "Plataforma Capul — Módulo Fiscal"
 *
 * Paginação: a tabela de produtos é o único bloco que paginaa. Se os produtos
 * não couberem na folha 1 (após o cabeçalho), quebra automática para folha 2,
 * repetindo o header DANFE compacto e o cabeçalho da tabela. A tabela tenta
 * deixar ~10mm no rodapé da última folha para o bloco "dados adicionais".
 *
 * Código de barras CODE-128C da chave (44 dígitos) gerado por bwip-js —
 * biblioteca puramente JS, sem deps nativas.
 */
@Injectable()
export class DanfeGeneratorService {
  private readonly logger = new Logger(DanfeGeneratorService.name);

  // ----- Layout constants -----
  // Todas as medidas em pontos (1pt = 1/72 polegada). A4 = 595 × 842.
  private readonly PAGE_W = 595;
  private readonly PAGE_H = 842;
  private readonly MARGIN = 28; // ~10mm

  // Cores "papel" — cinza escuro para linhas, preto para texto.
  private readonly LINE_COLOR = '#000';
  private readonly LABEL_COLOR = '#000';

  // Altura do strip de recebimento (folha 1 apenas)
  private readonly RECEBIMENTO_H = 40;

  // Altura do bloco header DANFE (emitente + DANFE + chave)
  private readonly HEADER_DANFE_H = 118;

  // Altura reservada para dados adicionais na última folha
  private readonly DADOS_ADICIONAIS_H = 110;

  // Altura do footer (rodapé com "Impresso em" e "Plataforma Capul")
  private readonly FOOTER_H = 14;

  // Fonte default
  private readonly F_DEFAULT = 'Helvetica';
  private readonly F_BOLD = 'Helvetica-Bold';
  private readonly F_ITALIC = 'Helvetica-Oblique';

  async generate(parsed: NfeParsed): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0, // margem manual — todo layout é coordenada absoluta
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Gera barcode UMA vez — reusado em todas as folhas.
    const barcodePng = await this.gerarBarcode(parsed.dadosGerais.chave);

    // ---- Primeira passada: calcular paginação ----
    // Vamos reservar:
    //   folha 1: strip recebimento + header + bloco identificação + cálc imposto + transporte
    //   demais folhas: só header compacto
    // A tabela de produtos é o que paginaa.
    const larguraUtil = this.PAGE_W - 2 * this.MARGIN;
    const produtos = parsed.produtos;

    // Folha 1: distribui blocos verticalmente e calcula onde a tabela começa/termina
    const layoutFolha1 = this.planejarFolha1(parsed);
    // Produtos que cabem na folha 1
    const { produtosFolha1, produtosRestantes } = this.dividirProdutosPaginaInicial(
      produtos,
      layoutFolha1.tabelaInicioY,
      layoutFolha1.tabelaFimY,
      produtos.length === 0,
    );

    // Folhas seguintes
    const folhasSeguintes: NfeProduto[][] = [];
    if (produtosRestantes.length > 0) {
      // Último grupo precisa deixar espaço para "dados adicionais" no final
      // da última folha. Primeiras páginas de continuação usam espaço cheio.
      const linhasPorPagCheia = this.capacidadeTabelaFolhaContinua(false);
      const linhasPorPagUltima = this.capacidadeTabelaFolhaContinua(true);
      let restantes = [...produtosRestantes];
      while (restantes.length > 0) {
        // Se o que sobra cabe na última página (com dados adicionais reservado), encerra.
        if (restantes.length <= linhasPorPagUltima) {
          folhasSeguintes.push(restantes);
          restantes = [];
        } else {
          folhasSeguintes.push(restantes.slice(0, linhasPorPagCheia));
          restantes = restantes.slice(linhasPorPagCheia);
        }
      }
    }

    const totalFolhas = 1 + folhasSeguintes.length;

    // ---- Renderização ----
    // Folha 1
    this.renderStripRecebimento(doc, parsed);
    this.renderHeaderDanfe(
      doc,
      parsed,
      barcodePng,
      1,
      totalFolhas,
      this.MARGIN + this.RECEBIMENTO_H + 4,
    );
    const yAposHeader = this.MARGIN + this.RECEBIMENTO_H + 4 + this.HEADER_DANFE_H;
    this.renderBlocoIdentificacaoFiscal(doc, parsed, yAposHeader);
    const yAposFiscal = yAposHeader + 18; // 1 linha de dados fiscais
    this.renderBlocoDestinatario(doc, parsed, yAposFiscal);
    const yAposDest = yAposFiscal + 58; // 3 linhas do destinatário
    const yFatura = this.renderBlocoFatura(doc, parsed, yAposDest);
    const yCalcImposto = this.renderBlocoCalculoImposto(doc, parsed, yFatura);
    const yTransporte = this.renderBlocoTransporte(doc, parsed, yCalcImposto);

    // Tabela de produtos — folha 1
    // Cabeçalho ocupa yTransporte+10 (título) até yTransporte+24 (fim do box).
    // Produtos começam logo abaixo do box do cabeçalho.
    this.renderCabecalhoTabelaProdutos(doc, yTransporte);
    this.renderLinhasProdutos(
      doc,
      produtosFolha1,
      yTransporte + 24,
      larguraUtil,
    );

    // Se só tem 1 folha, desenha dados adicionais e footer dessa folha
    if (folhasSeguintes.length === 0) {
      const yDados = this.PAGE_H - this.MARGIN - this.DADOS_ADICIONAIS_H - this.FOOTER_H;
      this.renderDadosAdicionais(doc, parsed, yDados);
    }
    this.renderFooter(doc, 1, totalFolhas);

    // Folhas 2+
    for (let i = 0; i < folhasSeguintes.length; i++) {
      doc.addPage({ size: 'A4', margin: 0 });
      const folhaAtual = i + 2;
      const ehUltima = i === folhasSeguintes.length - 1;
      this.renderHeaderDanfe(doc, parsed, barcodePng, folhaAtual, totalFolhas, this.MARGIN);
      const yContTabela = this.MARGIN + this.HEADER_DANFE_H + 4;
      this.renderCabecalhoTabelaProdutos(doc, yContTabela);
      this.renderLinhasProdutos(
        doc,
        folhasSeguintes[i]!,
        yContTabela + 24,
        larguraUtil,
      );
      if (ehUltima) {
        const yDados =
          this.PAGE_H - this.MARGIN - this.DADOS_ADICIONAIS_H - this.FOOTER_H;
        this.renderDadosAdicionais(doc, parsed, yDados);
      }
      this.renderFooter(doc, folhaAtual, totalFolhas);
    }

    doc.end();
    return finished;
  }

  // ============================================================
  //  PRIMEIRA FAIXA (strip) — só na folha 1
  // ============================================================

  /**
   * Strip de recebimento no topo da folha 1. Caixa com texto de recebimento
   * à esquerda e dois sub-boxes "NF-e / Nº / Série" à direita.
   */
  private renderStripRecebimento(doc: PDFKit.PDFDocument, parsed: NfeParsed): void {
    const x = this.MARGIN;
    const y = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const h = this.RECEBIMENTO_H;

    // Caixa externa
    this.rect(doc, x, y, w, h);
    // Divisão vertical aos 80%
    const colDireitaW = 110;
    const colEsquerdaW = w - colDireitaW;
    doc.moveTo(x + colEsquerdaW, y).lineTo(x + colEsquerdaW, y + h).stroke();

    // Esquerda — 2 sub-linhas: texto informativo (topo) + DATA RECEBIMENTO | IDENTIFICAÇÃO
    const recebidoText =
      `RECEBEMOS DE ${parsed.emitente.razaoSocial.toUpperCase()} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO.\n` +
      `EMISSÃO: ${this.formatDateShort(parsed.dadosGerais.dataEmissao)}  VALOR TOTAL: R$ ${fmt(parsed.totais.valorNota)}  DESTINATÁRIO: ${parsed.destinatario.razaoSocial.toUpperCase()} — ${(parsed.destinatario.endereco.logradouro ?? '')}, ${parsed.destinatario.endereco.numero ?? ''}` +
      `\n${(parsed.destinatario.endereco.bairro ?? '')} ${(parsed.destinatario.endereco.municipio ?? '')}-${parsed.destinatario.endereco.uf ?? ''}`;
    doc
      .font(this.F_DEFAULT)
      .fontSize(6)
      .text(recebidoText, x + 3, y + 2, {
        width: colEsquerdaW - 6,
        height: h - 20,
      });

    // Linha horizontal separando texto de DATA/ASSINATURA
    const ySub = y + h - 16;
    doc.moveTo(x, ySub).lineTo(x + colEsquerdaW, ySub).stroke();
    // Divisão vertical para DATA RECEBIMENTO | IDENTIFICAÇÃO
    const colDataW = 120;
    doc.moveTo(x + colDataW, ySub).lineTo(x + colDataW, y + h).stroke();
    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .text('DATA DE RECEBIMENTO', x + 2, ySub + 2);
    doc
      .fontSize(5)
      .text('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', x + colDataW + 2, ySub + 2);

    // Direita — NF-e / Nº / Série
    const xR = x + colEsquerdaW;
    doc
      .font(this.F_BOLD)
      .fontSize(16)
      .text('NF-e', xR, y + 4, { width: colDireitaW, align: 'center' });
    doc
      .font(this.F_DEFAULT)
      .fontSize(8)
      .text(
        `Nº. ${this.formatNumero(parsed.dadosGerais.numero)}`,
        xR,
        y + 24,
        { width: colDireitaW, align: 'center' },
      );
    doc
      .fontSize(8)
      .text(
        `Série ${parsed.dadosGerais.serie.padStart(3, '0')}`,
        xR,
        y + 32,
        { width: colDireitaW, align: 'center' },
      );
  }

  // ============================================================
  //  HEADER DANFE — repetido em todas as folhas
  // ============================================================

  /**
   * Bloco "IDENTIFICAÇÃO DO EMITENTE": 3 colunas grandes + faixa de
   * natureza/protocolo abaixo.
   *
   *   ┌──────────────┬──────────────┬──────────────┐
   *   │ EMITENTE     │  DANFE       │ CHAVE/BARCODE│
   *   │ nome/end     │  0-E  1-S    │ ...          │
   *   │              │  Nº / Série  │ protocolo    │
   *   ├──────────────┴──────────────┴──────────────┤
   *   │ Natureza da operação | Protocolo autorização│
   *   └─────────────────────────────────────────────┘
   *   │ IE | Insc.Municipal | IE Subst.ST | CNPJ    │
   *   └─────────────────────────────────────────────┘
   *
   * Cada bloco com bordas pretas de 0.5pt.
   */
  private renderHeaderDanfe(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    barcodePng: Buffer,
    folha: number,
    totalFolhas: number,
    yInicio: number,
  ): void {
    const x = this.MARGIN;
    const y = yInicio;
    const w = this.PAGE_W - 2 * this.MARGIN;

    // Altura total do header = emitente box (80) + faixa natureza (18) + faixa IE (20)
    const hEmitente = 80;
    const hNatureza = 18;
    const hIE = 20;

    // Box principal (3 colunas)
    const colEsqW = Math.floor(w * 0.36);
    const colMidW = Math.floor(w * 0.22);
    const colDirW = w - colEsqW - colMidW;

    this.rect(doc, x, y, w, hEmitente);
    doc.moveTo(x + colEsqW, y).lineTo(x + colEsqW, y + hEmitente).stroke();
    doc
      .moveTo(x + colEsqW + colMidW, y)
      .lineTo(x + colEsqW + colMidW, y + hEmitente)
      .stroke();

    // --- Coluna esquerda (EMITENTE) ---
    const emit = parsed.emitente;
    doc
      .font(this.F_ITALIC)
      .fontSize(5)
      .fillColor('#333')
      .text('IDENTIFICAÇÃO DO EMITENTE', x + 4, y + 2, {
        width: colEsqW - 8,
        align: 'center',
      });
    doc.fillColor(this.LABEL_COLOR);

    doc
      .font(this.F_BOLD)
      .fontSize(13)
      .text(emit.razaoSocial.toUpperCase(), x + 4, y + 18, {
        width: colEsqW - 8,
        align: 'center',
        height: 20,
      });
    // Endereço + município + UF + fone/fax
    const end = emit.endereco;
    const enderecoText = [
      `${end.logradouro ?? ''}${end.numero ? ', ' + end.numero : ''}`,
      `${end.bairro ?? ''}${end.bairro && end.cep ? ' - ' : ''}${end.cep ? this.formatCep(end.cep) : ''}`,
      `${end.municipio ?? ''}${end.municipio && end.uf ? ' - ' + end.uf : ''}${end.telefone ? ' Fone/Fax: ' + end.telefone : ''}`,
    ]
      .filter((l) => l.trim())
      .join('\n');
    doc
      .font(this.F_DEFAULT)
      .fontSize(7)
      .text(enderecoText, x + 4, y + 44, {
        width: colEsqW - 8,
        align: 'center',
        lineGap: 1,
      });

    // --- Coluna central (DANFE + 0/1 + Nº/Série/Folha) ---
    const xMid = x + colEsqW;
    doc
      .font(this.F_BOLD)
      .fontSize(13)
      .text('DANFE', xMid, y + 4, { width: colMidW, align: 'center' });
    doc
      .font(this.F_DEFAULT)
      .fontSize(6)
      .text('Documento Auxiliar da Nota', xMid, y + 20, {
        width: colMidW,
        align: 'center',
      });
    doc.fontSize(6).text('Fiscal Eletrônica', xMid, y + 27, {
      width: colMidW,
      align: 'center',
    });
    // 0-ENTRADA  1-SAÍDA
    doc
      .font(this.F_DEFAULT)
      .fontSize(7)
      .text('0 - ENTRADA', xMid + 6, y + 38);
    doc.text('1 - SAÍDA', xMid + 6, y + 46);
    // Quadrado com tipoOperacao (direita)
    const xQuad = xMid + colMidW - 22;
    const yQuad = y + 37;
    this.rect(doc, xQuad, yQuad, 16, 16);
    doc
      .font(this.F_BOLD)
      .fontSize(11)
      .text(parsed.dadosGerais.tipoOperacao, xQuad, yQuad + 3, {
        width: 16,
        align: 'center',
      });

    // Nº + Série + Folha X/Y
    doc
      .font(this.F_BOLD)
      .fontSize(9)
      .text(
        `Nº. ${this.formatNumero(parsed.dadosGerais.numero)}`,
        xMid,
        y + 58,
        { width: colMidW, align: 'center' },
      );
    doc
      .fontSize(9)
      .text(`Série ${parsed.dadosGerais.serie.padStart(3, '0')}`, xMid, y + 66, {
        width: colMidW,
        align: 'center',
      });
    doc
      .font(this.F_ITALIC)
      .fontSize(7)
      .text(`Folha ${folha}/${totalFolhas}`, xMid, y + 74, {
        width: colMidW,
        align: 'center',
      });

    // --- Coluna direita (barcode + chave) ---
    const xDir = x + colEsqW + colMidW;
    // Barcode imagem (CODE-128C) ocupa a parte superior
    try {
      doc.image(barcodePng, xDir + 6, y + 4, {
        width: colDirW - 12,
        height: 28,
      });
    } catch (err) {
      this.logger.warn(`Falha ao embutir barcode: ${(err as Error).message}`);
    }
    // "CHAVE DE ACESSO" label + chave formatada
    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .text('CHAVE DE ACESSO', xDir + 4, y + 34, {
        width: colDirW - 8,
      });
    doc
      .font(this.F_BOLD)
      .fontSize(8)
      .text(this.formatChave(parsed.dadosGerais.chave), xDir + 4, y + 42, {
        width: colDirW - 8,
        align: 'center',
      });
    doc
      .font(this.F_DEFAULT)
      .fontSize(6)
      .text(
        'Consulta de autenticidade no portal nacional da NF-e',
        xDir + 4,
        y + 56,
        { width: colDirW - 8, align: 'center' },
      );
    doc
      .fontSize(6)
      .text(
        'www.nfe.fazenda.gov.br/portal ou no site da SEFAZ Autorizadora',
        xDir + 4,
        y + 64,
        { width: colDirW - 8, align: 'center' },
      );

    // --- Faixa NATUREZA / PROTOCOLO ---
    const yNat = y + hEmitente;
    this.rect(doc, x, yNat, w, hNatureza);
    const colNatW = Math.floor(w * 0.55);
    doc.moveTo(x + colNatW, yNat).lineTo(x + colNatW, yNat + hNatureza).stroke();
    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .text('NATUREZA DA OPERAÇÃO', x + 2, yNat + 1);
    doc
      .font(this.F_BOLD)
      .fontSize(8)
      .text(parsed.dadosGerais.naturezaOperacao, x + 2, yNat + 8, {
        width: colNatW - 4,
        height: 10,
        ellipsis: true,
      });
    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .text('PROTOCOLO DE AUTORIZAÇÃO DE USO', x + colNatW + 2, yNat + 1);
    const prot = parsed.protocoloAutorizacao;
    const protText = prot
      ? `${prot.protocolo} - ${this.formatDate(prot.dataRecebimento)}`
      : '-';
    doc
      .font(this.F_BOLD)
      .fontSize(8)
      .text(protText, x + colNatW + 2, yNat + 8, {
        width: w - colNatW - 4,
        align: 'center',
      });

    // --- Faixa IE / IM / IE-ST / CNPJ ---
    const yIE = yNat + hNatureza;
    this.rect(doc, x, yIE, w, hIE);
    const col1W = Math.floor(w * 0.25);
    const col2W = Math.floor(w * 0.25);
    const col3W = Math.floor(w * 0.25);
    // const col4W = w - col1W - col2W - col3W;
    doc.moveTo(x + col1W, yIE).lineTo(x + col1W, yIE + hIE).stroke();
    doc
      .moveTo(x + col1W + col2W, yIE)
      .lineTo(x + col1W + col2W, yIE + hIE)
      .stroke();
    doc
      .moveTo(x + col1W + col2W + col3W, yIE)
      .lineTo(x + col1W + col2W + col3W, yIE + hIE)
      .stroke();

    this.drawCelula(
      doc,
      x,
      yIE,
      col1W,
      hIE,
      'INSCRIÇÃO ESTADUAL',
      emit.inscricaoEstadual ?? '-',
    );
    this.drawCelula(
      doc,
      x + col1W,
      yIE,
      col2W,
      hIE,
      'INSCRIÇÃO MUNICIPAL',
      emit.inscricaoMunicipal ?? '-',
    );
    this.drawCelula(
      doc,
      x + col1W + col2W,
      yIE,
      col3W,
      hIE,
      'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.',
      emit.inscricaoEstadualSubstituto ?? '-',
    );
    this.drawCelula(
      doc,
      x + col1W + col2W + col3W,
      yIE,
      w - col1W - col2W - col3W,
      hIE,
      'CNPJ / CPF',
      this.formatCnpj(emit.cnpj ?? emit.cpf),
    );
  }

  // ============================================================
  //  Sub-bloco: "DESTINATÁRIO / REMETENTE" (só folha 1)
  // ============================================================

  private renderBlocoIdentificacaoFiscal(
    _doc: PDFKit.PDFDocument,
    _parsed: NfeParsed,
    _y: number,
  ): void {
    // Este bloco já é o "faixa IE / IM / IE-ST / CNPJ" do header DANFE.
    // Por compat, mantido como no-op para a ordem de chamadas ficar clara.
  }

  private renderBlocoDestinatario(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    yInicio: number,
  ): void {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const hLinha = 18;
    const hTotal = hLinha * 3 + 10;

    // Título da seção
    doc
      .font(this.F_BOLD)
      .fontSize(6)
      .fillColor(this.LABEL_COLOR)
      .text('DESTINATÁRIO / REMETENTE', x, yInicio + 1);

    const yBox = yInicio + 10;
    this.rect(doc, x, yBox, w, hTotal - 10);

    // Linha 1: Nome/Razão | CNPJ/CPF | Data da emissão
    const y1 = yBox;
    const c1_1W = Math.floor(w * 0.6);
    const c1_2W = Math.floor(w * 0.25);
    const c1_3W = w - c1_1W - c1_2W;
    doc.moveTo(x + c1_1W, y1).lineTo(x + c1_1W, y1 + hLinha).stroke();
    doc.moveTo(x + c1_1W + c1_2W, y1).lineTo(x + c1_1W + c1_2W, y1 + hLinha).stroke();
    this.drawCelula(
      doc,
      x,
      y1,
      c1_1W,
      hLinha,
      'NOME / RAZÃO SOCIAL',
      parsed.destinatario.razaoSocial,
    );
    this.drawCelula(
      doc,
      x + c1_1W,
      y1,
      c1_2W,
      hLinha,
      'CNPJ / CPF',
      this.formatCnpj(parsed.destinatario.cnpj ?? parsed.destinatario.cpf),
    );
    this.drawCelula(
      doc,
      x + c1_1W + c1_2W,
      y1,
      c1_3W,
      hLinha,
      'DATA DA EMISSÃO',
      this.formatDateShort(parsed.dadosGerais.dataEmissao),
    );

    // Linha 2: Endereço | Bairro | CEP | Data saída/entrada
    const y2 = y1 + hLinha;
    doc.moveTo(x, y2).lineTo(x + w, y2).stroke();
    const c2_1W = Math.floor(w * 0.45);
    const c2_2W = Math.floor(w * 0.2);
    const c2_3W = Math.floor(w * 0.2);
    const c2_4W = w - c2_1W - c2_2W - c2_3W;
    doc.moveTo(x + c2_1W, y2).lineTo(x + c2_1W, y2 + hLinha).stroke();
    doc.moveTo(x + c2_1W + c2_2W, y2).lineTo(x + c2_1W + c2_2W, y2 + hLinha).stroke();
    doc
      .moveTo(x + c2_1W + c2_2W + c2_3W, y2)
      .lineTo(x + c2_1W + c2_2W + c2_3W, y2 + hLinha)
      .stroke();
    const destEnd = parsed.destinatario.endereco;
    const enderecoLinha = `${destEnd.logradouro ?? ''}${destEnd.numero ? ', ' + destEnd.numero : ''}${destEnd.complemento ? ' ' + destEnd.complemento : ''}`;
    this.drawCelula(doc, x, y2, c2_1W, hLinha, 'ENDEREÇO', enderecoLinha);
    this.drawCelula(doc, x + c2_1W, y2, c2_2W, hLinha, 'BAIRRO / DISTRITO', destEnd.bairro ?? '-');
    this.drawCelula(
      doc,
      x + c2_1W + c2_2W,
      y2,
      c2_3W,
      hLinha,
      'CEP',
      this.formatCep(destEnd.cep),
    );
    this.drawCelula(
      doc,
      x + c2_1W + c2_2W + c2_3W,
      y2,
      c2_4W,
      hLinha,
      'DATA DA SAÍDA/ENTRADA',
      this.formatDateShort(parsed.dadosGerais.dataSaidaEntrada),
    );

    // Linha 3: Município | UF | Fone/Fax | IE | Hora saída/entrada
    const y3 = y2 + hLinha;
    doc.moveTo(x, y3).lineTo(x + w, y3).stroke();
    const c3_1W = Math.floor(w * 0.3);
    const c3_2W = Math.floor(w * 0.07);
    const c3_3W = Math.floor(w * 0.18);
    const c3_4W = Math.floor(w * 0.25);
    const c3_5W = w - c3_1W - c3_2W - c3_3W - c3_4W;
    doc.moveTo(x + c3_1W, y3).lineTo(x + c3_1W, y3 + hLinha).stroke();
    doc.moveTo(x + c3_1W + c3_2W, y3).lineTo(x + c3_1W + c3_2W, y3 + hLinha).stroke();
    doc
      .moveTo(x + c3_1W + c3_2W + c3_3W, y3)
      .lineTo(x + c3_1W + c3_2W + c3_3W, y3 + hLinha)
      .stroke();
    doc
      .moveTo(x + c3_1W + c3_2W + c3_3W + c3_4W, y3)
      .lineTo(x + c3_1W + c3_2W + c3_3W + c3_4W, y3 + hLinha)
      .stroke();
    this.drawCelula(doc, x, y3, c3_1W, hLinha, 'MUNICÍPIO', destEnd.municipio ?? '-');
    this.drawCelula(doc, x + c3_1W, y3, c3_2W, hLinha, 'UF', destEnd.uf ?? '-');
    this.drawCelula(
      doc,
      x + c3_1W + c3_2W,
      y3,
      c3_3W,
      hLinha,
      'FONE / FAX',
      destEnd.telefone ?? '-',
    );
    this.drawCelula(
      doc,
      x + c3_1W + c3_2W + c3_3W,
      y3,
      c3_4W,
      hLinha,
      'INSCRIÇÃO ESTADUAL',
      parsed.destinatario.inscricaoEstadual ?? '-',
    );
    this.drawCelula(
      doc,
      x + c3_1W + c3_2W + c3_3W + c3_4W,
      y3,
      c3_5W,
      hLinha,
      'HORA DA SAÍDA/ENTRADA',
      this.extractTime(parsed.dadosGerais.dataSaidaEntrada ?? parsed.dadosGerais.dataEmissao),
    );
  }

  // ============================================================
  //  FATURA / DUPLICATA (opcional — só se houver)
  // ============================================================

  private renderBlocoFatura(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    yInicio: number,
  ): number {
    const cob = parsed.cobranca;
    const temFatura = cob.fatura?.numero || cob.duplicatas.length > 0;
    if (!temFatura) return yInicio;

    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    doc
      .font(this.F_BOLD)
      .fontSize(6)
      .text('FATURA / DUPLICATA', x, yInicio + 1);
    const yBox = yInicio + 10;
    const hBox = 32;
    this.rect(doc, x, yBox, w, hBox);

    // Célula Num. + 3 duplicatas. Em cada duplicata stack Venc + Valor
    // verticalmente com espaço seguro (label 5pt + valor 7pt por linha).
    const colW = Math.floor(w / 4);
    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .text('Num.', x + 2, yBox + 2);
    doc
      .font(this.F_BOLD)
      .fontSize(8)
      .text(cob.fatura?.numero ?? '-', x + 2, yBox + 10, {
        width: colW - 4,
        height: 10,
        ellipsis: true,
        lineBreak: false,
      });

    const duplicatas = cob.duplicatas.slice(0, 3);
    duplicatas.forEach((d, idx) => {
      const xd = x + colW * (idx + 1);
      doc.moveTo(xd, yBox).lineTo(xd, yBox + hBox).stroke();
      // Linha 1: Venc.
      doc
        .font(this.F_DEFAULT)
        .fontSize(5)
        .text('Venc.', xd + 2, yBox + 2);
      doc
        .font(this.F_BOLD)
        .fontSize(7)
        .text(
          this.formatDateShort(d.vencimento),
          xd + 2,
          yBox + 9,
          { width: colW - 4, height: 8, ellipsis: true, lineBreak: false },
        );
      // Linha 2: Valor (label 5pt a y+18, valor 7pt a y+23 — gap seguro)
      doc
        .font(this.F_DEFAULT)
        .fontSize(5)
        .text('Valor', xd + 2, yBox + 18);
      doc
        .font(this.F_BOLD)
        .fontSize(7)
        .text(
          d.valor != null ? `R$ ${fmt(d.valor)}` : '-',
          xd + 2,
          yBox + 25,
          { width: colW - 4, height: 8, ellipsis: true, lineBreak: false },
        );
    });

    return yInicio + 10 + hBox + 3;
  }

  // ============================================================
  //  CÁLCULO DO IMPOSTO — grid 2×9
  // ============================================================

  private renderBlocoCalculoImposto(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    yInicio: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const t = parsed.totais;

    doc
      .font(this.F_BOLD)
      .fontSize(6)
      .text('CÁLCULO DO IMPOSTO', x, yInicio + 1);

    const yBox = yInicio + 10;
    const hLinha = 18;
    const hTotal = hLinha * 2;
    this.rect(doc, x, yBox, w, hTotal);

    // Labels encurtados para caber em 1 linha a 5pt numa célula de ~56pt de
    // largura útil (9 células em 539pt). Ellipsis ativo se ainda passar.
    const linha1 = [
      { label: 'BASE CÁLC. ICMS', valor: fmt(t.baseCalculoIcms) },
      { label: 'VALOR DO ICMS', valor: fmt(t.valorIcms) },
      { label: 'BASE CÁLC. ICMS ST', valor: fmt(t.baseCalculoIcmsSt) },
      { label: 'VALOR ICMS ST', valor: fmt(t.valorIcmsSt) },
      { label: 'V. IMP. IMPORT.', valor: fmt(t.valorII) },
      { label: 'V. ICMS REMET.', valor: fmt(t.valorIcmsDesonerado) },
      { label: 'V. FCP UF DEST.', valor: fmt(t.valorFcp) },
      { label: 'VALOR DO PIS', valor: fmt(t.valorPis) },
      { label: 'V. TOT. PRODUTOS', valor: fmt(t.valorProdutos) },
    ];
    const linha2 = [
      { label: 'VALOR DO FRETE', valor: fmt(t.valorFrete) },
      { label: 'VALOR DO SEGURO', valor: fmt(t.valorSeguro) },
      { label: 'DESCONTO', valor: fmt(t.valorDesconto) },
      { label: 'OUTRAS DESPESAS', valor: fmt(t.valorOutros) },
      { label: 'VALOR TOTAL IPI', valor: fmt(t.valorIpi) },
      { label: 'V. ICMS UF DEST.', valor: fmt(0) },
      { label: 'V. TOT. TRIB.', valor: fmt(t.valorTotalTributos ?? 0) },
      { label: 'VALOR DA COFINS', valor: fmt(t.valorCofins) },
      { label: 'V. TOTAL DA NOTA', valor: fmt(t.valorNota) },
    ];

    const colW = w / 9;
    for (let i = 0; i < 9; i++) {
      const xc = x + colW * i;
      if (i > 0) {
        doc.moveTo(xc, yBox).lineTo(xc, yBox + hTotal).stroke();
      }
      // Destaque do "V. TOTAL DA NOTA" (última célula) em bold
      const destaque = i === 8;
      this.drawCelula(
        doc,
        xc,
        yBox,
        colW,
        hLinha,
        linha1[i]!.label,
        linha1[i]!.valor,
        'right',
      );
      this.drawCelula(
        doc,
        xc,
        yBox + hLinha,
        colW,
        hLinha,
        linha2[i]!.label,
        linha2[i]!.valor,
        'right',
        destaque,
      );
    }
    // Linha horizontal dividindo as 2 fileiras
    doc.moveTo(x, yBox + hLinha).lineTo(x + w, yBox + hLinha).stroke();

    return yInicio + 10 + hTotal + 3;
  }

  // ============================================================
  //  TRANSPORTADOR / VOLUMES
  // ============================================================

  private renderBlocoTransporte(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    yInicio: number,
  ): number {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const t = parsed.transporte;

    doc
      .font(this.F_BOLD)
      .fontSize(6)
      .text('TRANSPORTADOR / VOLUMES TRANSPORTADOS', x, yInicio + 1);

    const yBox = yInicio + 10;
    const hLinha = 18;
    const hTotal = hLinha * 3;
    this.rect(doc, x, yBox, w, hTotal);

    // Linha 1: Nome/razão | FRETE | Código ANTT | Placa Veíc | UF | CNPJ/CPF
    const y1 = yBox;
    const l1c1W = Math.floor(w * 0.38);
    const l1c2W = Math.floor(w * 0.12);
    const l1c3W = Math.floor(w * 0.13);
    const l1c4W = Math.floor(w * 0.12);
    const l1c5W = Math.floor(w * 0.05);
    const l1c6W = w - l1c1W - l1c2W - l1c3W - l1c4W - l1c5W;
    const colsL1 = [l1c1W, l1c2W, l1c3W, l1c4W, l1c5W, l1c6W];
    let xAcc = x;
    for (let i = 1; i < colsL1.length; i++) {
      xAcc += colsL1[i - 1]!;
      doc.moveTo(xAcc, y1).lineTo(xAcc, y1 + hLinha).stroke();
    }
    this.drawCelula(
      doc,
      x,
      y1,
      l1c1W,
      hLinha,
      'NOME / RAZÃO SOCIAL',
      t.transportador?.razaoSocial ?? '-',
    );
    // Modalidade frete: só o código numérico (0-9) — descrição completa
    // não cabe no box de ~65pt. O operador que conhece o padrão reconhece o
    // código; a descrição completa está no XML consultável pelo fiscal.
    const modFrete = `${t.modalidadeFrete}-${this.abreviarFrete(t.modalidadeFrete)}`;
    this.drawCelula(doc, x + l1c1W, y1, l1c2W, hLinha, 'FRETE', modFrete);
    this.drawCelula(doc, x + l1c1W + l1c2W, y1, l1c3W, hLinha, 'CÓDIGO ANTT', '-');
    this.drawCelula(
      doc,
      x + l1c1W + l1c2W + l1c3W,
      y1,
      l1c4W,
      hLinha,
      'PLACA DO VEÍCULO',
      t.veiculo?.placa ?? '-',
    );
    this.drawCelula(
      doc,
      x + l1c1W + l1c2W + l1c3W + l1c4W,
      y1,
      l1c5W,
      hLinha,
      'UF',
      t.veiculo?.uf ?? '-',
    );
    this.drawCelula(
      doc,
      x + l1c1W + l1c2W + l1c3W + l1c4W + l1c5W,
      y1,
      l1c6W,
      hLinha,
      'CNPJ / CPF',
      this.formatCnpj(t.transportador?.cnpj ?? t.transportador?.cpf),
    );

    // Linha 2: Endereço | Município | UF | Inscrição Estadual
    const y2 = y1 + hLinha;
    doc.moveTo(x, y2).lineTo(x + w, y2).stroke();
    const l2c1W = Math.floor(w * 0.45);
    const l2c2W = Math.floor(w * 0.25);
    const l2c3W = Math.floor(w * 0.05);
    const l2c4W = w - l2c1W - l2c2W - l2c3W;
    doc.moveTo(x + l2c1W, y2).lineTo(x + l2c1W, y2 + hLinha).stroke();
    doc.moveTo(x + l2c1W + l2c2W, y2).lineTo(x + l2c1W + l2c2W, y2 + hLinha).stroke();
    doc
      .moveTo(x + l2c1W + l2c2W + l2c3W, y2)
      .lineTo(x + l2c1W + l2c2W + l2c3W, y2 + hLinha)
      .stroke();
    this.drawCelula(
      doc,
      x,
      y2,
      l2c1W,
      hLinha,
      'ENDEREÇO',
      t.transportador?.endereco ?? '-',
    );
    this.drawCelula(
      doc,
      x + l2c1W,
      y2,
      l2c2W,
      hLinha,
      'MUNICÍPIO',
      t.transportador?.municipio ?? '-',
    );
    this.drawCelula(
      doc,
      x + l2c1W + l2c2W,
      y2,
      l2c3W,
      hLinha,
      'UF',
      t.transportador?.uf ?? '-',
    );
    this.drawCelula(
      doc,
      x + l2c1W + l2c2W + l2c3W,
      y2,
      l2c4W,
      hLinha,
      'INSCRIÇÃO ESTADUAL',
      t.transportador?.inscricaoEstadual ?? '-',
    );

    // Linha 3: Qtde | Espécie | Marca | Numeração | Peso bruto | Peso líquido
    const y3 = y2 + hLinha;
    doc.moveTo(x, y3).lineTo(x + w, y3).stroke();
    const volumes = t.volumes[0] ?? {};
    const l3c1W = Math.floor(w * 0.11);
    const l3c2W = Math.floor(w * 0.22);
    const l3c3W = Math.floor(w * 0.15);
    const l3c4W = Math.floor(w * 0.18);
    const l3c5W = Math.floor(w * 0.17);
    const l3c6W = w - l3c1W - l3c2W - l3c3W - l3c4W - l3c5W;
    const colsL3 = [l3c1W, l3c2W, l3c3W, l3c4W, l3c5W, l3c6W];
    xAcc = x;
    for (let i = 1; i < colsL3.length; i++) {
      xAcc += colsL3[i - 1]!;
      doc.moveTo(xAcc, y3).lineTo(xAcc, y3 + hLinha).stroke();
    }
    this.drawCelula(
      doc,
      x,
      y3,
      l3c1W,
      hLinha,
      'QUANTIDADE',
      volumes.quantidade != null ? String(volumes.quantidade) : '-',
      'right',
    );
    this.drawCelula(
      doc,
      x + l3c1W,
      y3,
      l3c2W,
      hLinha,
      'ESPÉCIE',
      volumes.especie ?? '-',
    );
    this.drawCelula(
      doc,
      x + l3c1W + l3c2W,
      y3,
      l3c3W,
      hLinha,
      'MARCA',
      volumes.marca ?? '-',
    );
    this.drawCelula(
      doc,
      x + l3c1W + l3c2W + l3c3W,
      y3,
      l3c4W,
      hLinha,
      'NUMERAÇÃO',
      volumes.numeracao ?? '-',
    );
    this.drawCelula(
      doc,
      x + l3c1W + l3c2W + l3c3W + l3c4W,
      y3,
      l3c5W,
      hLinha,
      'PESO BRUTO',
      volumes.pesoBruto != null ? fmt(volumes.pesoBruto, 3) : '-',
      'right',
    );
    this.drawCelula(
      doc,
      x + l3c1W + l3c2W + l3c3W + l3c4W + l3c5W,
      y3,
      l3c6W,
      hLinha,
      'PESO LÍQUIDO',
      volumes.pesoLiquido != null ? fmt(volumes.pesoLiquido, 3) : '-',
      'right',
    );

    return yInicio + 10 + hTotal + 3;
  }

  // ============================================================
  //  TABELA DE PRODUTOS
  // ============================================================

  /**
   * Colunas da tabela de produtos — largura relativa que soma 1.
   * Ordem: CÓDIGO | DESCRIÇÃO | NCM/SH | O/CST | CFOP | UN | QUANT | V.UNIT | V.TOTAL | V.DESC | B.C.ICMS | V.ICMS | V.IPI | ALIQ ICMS | ALIQ IPI
   */
  private readonly colunas: Record<ColunaProduto, number> = {
    codigo: 0.08,
    descricao: 0.25,
    ncm: 0.06,
    ocst: 0.04,
    cfop: 0.035,
    un: 0.025,
    quant: 0.055,
    vUnit: 0.055,
    vTotal: 0.06,
    vDesc: 0.04,
    bcIcms: 0.06,
    vIcms: 0.055,
    vIpi: 0.05,
    aliqIcms: 0.04,
    aliqIpi: 0.04,
  };

  private renderCabecalhoTabelaProdutos(
    doc: PDFKit.PDFDocument,
    yInicio: number,
  ): void {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;

    doc
      .font(this.F_BOLD)
      .fontSize(6)
      .text('DADOS DOS PRODUTOS / SERVIÇOS', x, yInicio + 1);

    const yCab = yInicio + 10;
    const hCab = 14;
    this.rect(doc, x, yCab, w, hCab);
    doc.fillColor('#ddd').rect(x, yCab, w, hCab).fill();
    doc.fillColor(this.LABEL_COLOR);

    const labels: Array<{ key: ColunaProduto; label: string }> = [
      { key: 'codigo', label: 'CÓDIGO PRODUTO' },
      { key: 'descricao', label: 'DESCRIÇÃO DO PRODUTO / SERVIÇO' },
      { key: 'ncm', label: 'NCM/SH' },
      { key: 'ocst', label: 'O/CST' },
      { key: 'cfop', label: 'CFOP' },
      { key: 'un', label: 'UN' },
      { key: 'quant', label: 'QUANT' },
      { key: 'vUnit', label: 'VALOR UNIT' },
      { key: 'vTotal', label: 'VALOR TOTAL' },
      { key: 'vDesc', label: 'VALOR DESC' },
      { key: 'bcIcms', label: 'B.CÁLC ICMS' },
      { key: 'vIcms', label: 'VALOR ICMS' },
      { key: 'vIpi', label: 'VALOR IPI' },
      { key: 'aliqIcms', label: 'ALÍQ ICMS' },
      { key: 'aliqIpi', label: 'ALÍQ IPI' },
    ] as const;

    let xAcc = x;
    for (const col of labels) {
      const colW = this.colunas[col.key] * w;
      if (xAcc > x) doc.moveTo(xAcc, yCab).lineTo(xAcc, yCab + hCab).stroke();
      doc
        .font(this.F_BOLD)
        .fontSize(5)
        .fillColor(this.LABEL_COLOR)
        .text(col.label, xAcc + 2, yCab + 4, {
          width: colW - 4,
          align: 'center',
        });
      xAcc += colW;
    }
  }

  private renderLinhasProdutos(
    doc: PDFKit.PDFDocument,
    produtos: NfeProduto[],
    yInicio: number,
    _larguraUtil: number,
  ): void {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    let y = yInicio;

    for (const p of produtos) {
      const descricaoComImpostos = this.montarDescricaoProdutoExtendida(p);
      const hLinha = this.calcularAlturaLinha(doc, descricaoComImpostos, w * this.colunas.descricao - 4);
      // Box da linha
      this.rect(doc, x, y, w, hLinha);

      const colsOrdem: Array<{ key: ColunaProduto; valor: string; align: 'left' | 'right' | 'center' }> = [
        { key: 'codigo', valor: p.codigo, align: 'left' },
        { key: 'descricao', valor: descricaoComImpostos, align: 'left' },
        { key: 'ncm', valor: p.ncm ?? '-', align: 'center' },
        { key: 'ocst', valor: `${p.impostos.icms.orig ?? '0'}${this.padCst(p.impostos.icms.cst)}`, align: 'center' },
        { key: 'cfop', valor: p.cfop, align: 'center' },
        { key: 'un', valor: p.unidadeComercial, align: 'center' },
        { key: 'quant', valor: fmt(p.quantidadeComercial, 4), align: 'right' },
        { key: 'vUnit', valor: fmt(p.valorUnitarioComercial, 4), align: 'right' },
        { key: 'vTotal', valor: fmt(p.valorTotalBruto), align: 'right' },
        { key: 'vDesc', valor: fmt(p.valorDesconto ?? 0), align: 'right' },
        { key: 'bcIcms', valor: fmt(p.impostos.icms.base ?? 0), align: 'right' },
        { key: 'vIcms', valor: fmt(p.impostos.icms.valor ?? 0), align: 'right' },
        { key: 'vIpi', valor: fmt(p.impostos.ipiValor ?? 0), align: 'right' },
        { key: 'aliqIcms', valor: p.impostos.icms.aliquota != null ? fmt(p.impostos.icms.aliquota) : '-', align: 'right' },
        { key: 'aliqIpi', valor: p.impostos.ipiAliquota != null ? fmt(p.impostos.ipiAliquota) : '-', align: 'right' },
      ];

      let xAcc = x;
      for (const col of colsOrdem) {
        const colW = this.colunas[col.key] * w;
        if (xAcc > x) doc.moveTo(xAcc, y).lineTo(xAcc, y + hLinha).stroke();
        const align = col.align;
        doc
          .font(this.F_DEFAULT)
          .fontSize(6)
          .fillColor(this.LABEL_COLOR);
        if (col.key === 'descricao') {
          doc.text(col.valor, xAcc + 2, y + 2, {
            width: colW - 4,
            align,
            height: hLinha - 2,
          });
        } else {
          doc.text(col.valor, xAcc + 2, y + 2, {
            width: colW - 4,
            align,
            ellipsis: true,
            height: hLinha - 2,
          });
        }
        xAcc += colW;
      }

      y += hLinha;
    }
  }

  /**
   * Monta a descrição extendida do produto com linhas secundárias trazendo
   * detalhes tributários (base/aliquota/valor) — mesmo padrão do fsist.
   */
  private montarDescricaoProdutoExtendida(p: NfeProduto): string {
    const linhas: string[] = [p.descricao];

    // Linha ICMS: redutor + IVA/MVA + plcmsSt + BclcmsSt + vlcmsSt (quando houver)
    const icms = p.impostos.icms;
    const icmsExtra: string[] = [];
    if (icms.percentualReducaoBCST != null && icms.percentualReducaoBCST > 0) {
      icmsExtra.push(`pRedBC=${fmt(icms.percentualReducaoBCST)}%`);
    }
    if (icms.percentualMvaST != null && icms.percentualMvaST > 0) {
      icmsExtra.push(`IVA/MVA=${fmt(icms.percentualMvaST)}%`);
    }
    if (icms.aliquotaST != null && icms.aliquotaST > 0) {
      icmsExtra.push(`pIcmsSt=${fmt(icms.aliquotaST)}%`);
    }
    if (icms.baseST != null && icms.baseST > 0) {
      icmsExtra.push(`BcIcmsSt=${fmt(icms.baseST)}`);
    }
    if (icms.valorST != null && icms.valorST > 0) {
      icmsExtra.push(`vIcmsSt=${fmt(icms.valorST)}`);
    }
    if (icmsExtra.length > 0) linhas.push(icmsExtra.join(' '));

    // Info adicional do item (infAdProd) — apenas 1a linha para não explodir altura
    if (p.informacoesAdicionais) {
      const info = p.informacoesAdicionais.slice(0, 120);
      linhas.push(info);
    }
    return linhas.join('\n');
  }

  private calcularAlturaLinha(
    doc: PDFKit.PDFDocument,
    descricaoMultilinha: string,
    larguraDescricao: number,
  ): number {
    doc.font(this.F_DEFAULT).fontSize(6);
    const h = doc.heightOfString(descricaoMultilinha, {
      width: larguraDescricao,
    });
    return Math.max(14, h + 4);
  }

  private capacidadeTabelaFolhaContinua(ehUltima: boolean): number {
    // Heurística: em uma folha continuação, a tabela começa após header (~150pt
    // da margem superior) e termina no rodapé. Altura média de linha = 18pt.
    const yInicio = this.MARGIN + this.HEADER_DANFE_H + 4 + 24; // +24 = título + box cabeçalho
    const yFim = ehUltima
      ? this.PAGE_H - this.MARGIN - this.DADOS_ADICIONAIS_H - this.FOOTER_H
      : this.PAGE_H - this.MARGIN - this.FOOTER_H;
    const altMediaLinha = 18;
    return Math.floor((yFim - yInicio) / altMediaLinha);
  }

  /**
   * Planejamento da folha 1: calcula em que Y a tabela de produtos começa e
   * onde termina, para saber quantas linhas cabem.
   */
  private planejarFolha1(parsed: NfeParsed): {
    tabelaInicioY: number;
    tabelaFimY: number;
  } {
    // Replica a sequência de render e soma as alturas conhecidas.
    let y = this.MARGIN + this.RECEBIMENTO_H + 4;
    y += this.HEADER_DANFE_H;
    // Faixa fiscal já faz parte do HEADER_DANFE_H — não duplicar
    y += 18; // no-op do renderBlocoIdentificacaoFiscal
    y += 58; // bloco destinatário (3 linhas)
    // Fatura opcional
    const temFatura = parsed.cobranca.fatura?.numero || parsed.cobranca.duplicatas.length > 0;
    if (temFatura) y += 10 + 32 + 3;
    // Cálculo do imposto: 10 + 36 + 3
    y += 10 + 36 + 3;
    // Transporte: 10 + 54 + 3
    y += 10 + 54 + 3;
    // Aqui começa o "DADOS DOS PRODUTOS" label + cabeçalho tabela
    // +10 (título) + 14 (box cabeçalho) = 24pt
    const tabelaInicioY = y + 24;
    const tabelaFimY = this.PAGE_H - this.MARGIN - this.FOOTER_H;
    return { tabelaInicioY, tabelaFimY };
  }

  /**
   * Divide os produtos entre "cabem na folha 1" vs "vão pras folhas seguintes".
   * Usa altura média de 18pt por linha (bom enough para heurística — o loop
   * de render ajusta a altura real). Se nenhum produto → volta tudo.
   */
  private dividirProdutosPaginaInicial(
    produtos: NfeProduto[],
    tabelaInicioY: number,
    tabelaFimY: number,
    semProdutos: boolean,
  ): { produtosFolha1: NfeProduto[]; produtosRestantes: NfeProduto[] } {
    if (semProdutos) {
      return { produtosFolha1: [], produtosRestantes: [] };
    }
    const espaco = tabelaFimY - tabelaInicioY;
    const altMediaLinha = 18;
    const cabem = Math.max(1, Math.floor(espaco / altMediaLinha));
    // Se todos cabem E sobra espaço >= DADOS_ADICIONAIS_H, a folha 1 é a única.
    const espacoSobra = espaco - cabem * altMediaLinha;
    const cabeDadosAdicionais = espacoSobra >= this.DADOS_ADICIONAIS_H;
    if (produtos.length <= cabem) {
      if (cabeDadosAdicionais) {
        return { produtosFolha1: produtos, produtosRestantes: [] };
      }
      // Cabem mas sem espaço pro rodapé — manda uma parte pra folha 2 forçando
      // que a última folha tenha espaço.
      const cabeComRodape = Math.max(
        1,
        Math.floor((espaco - this.DADOS_ADICIONAIS_H) / altMediaLinha),
      );
      if (produtos.length <= cabeComRodape) {
        return { produtosFolha1: produtos, produtosRestantes: [] };
      }
      return {
        produtosFolha1: produtos.slice(0, cabeComRodape),
        produtosRestantes: produtos.slice(cabeComRodape),
      };
    }
    return {
      produtosFolha1: produtos.slice(0, cabem),
      produtosRestantes: produtos.slice(cabem),
    };
  }

  // ============================================================
  //  DADOS ADICIONAIS — bloco inferior da última folha
  // ============================================================

  private renderDadosAdicionais(
    doc: PDFKit.PDFDocument,
    parsed: NfeParsed,
    yInicio: number,
  ): void {
    const x = this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;

    doc.font(this.F_BOLD).fontSize(6).text('DADOS ADICIONAIS', x, yInicio + 1);
    const yBox = yInicio + 10;
    const h = this.DADOS_ADICIONAIS_H - 10;
    this.rect(doc, x, yBox, w, h);

    // 70% INFORMAÇÕES COMPLEMENTARES | 30% RESERVADO AO FISCO
    const colEsqW = Math.floor(w * 0.7);
    doc.moveTo(x + colEsqW, yBox).lineTo(x + colEsqW, yBox + h).stroke();

    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .text('INFORMAÇÕES COMPLEMENTARES', x + 2, yBox + 2);
    const info = parsed.informacoesAdicionais?.informacoesComplementares ?? '-';
    doc
      .font(this.F_DEFAULT)
      .fontSize(6)
      .text(info, x + 2, yBox + 10, {
        width: colEsqW - 4,
        height: h - 12,
      });

    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .text('RESERVADO AO FISCO', x + colEsqW + 2, yBox + 2);
    if (parsed.informacoesAdicionais?.informacoesFisco) {
      doc
        .fontSize(6)
        .text(parsed.informacoesAdicionais.informacoesFisco, x + colEsqW + 2, yBox + 10, {
          width: w - colEsqW - 4,
          height: h - 12,
        });
    }
  }

  // ============================================================
  //  FOOTER
  // ============================================================

  private renderFooter(
    doc: PDFKit.PDFDocument,
    folha: number,
    totalFolhas: number,
  ): void {
    const x = this.MARGIN;
    const y = this.PAGE_H - this.MARGIN;
    const w = this.PAGE_W - 2 * this.MARGIN;
    const impressoEm = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    doc
      .font(this.F_ITALIC)
      .fontSize(6)
      .fillColor('#666')
      .text(`Impresso em ${impressoEm}`, x, y - 10);
    doc
      .font(this.F_ITALIC)
      .fontSize(6)
      .fillColor('#666')
      .text(
        `Plataforma Capul — Módulo Fiscal  ·  Folha ${folha}/${totalFolhas}`,
        x,
        y - 10,
        { width: w, align: 'right' },
      );
    doc.fillColor(this.LABEL_COLOR);
  }

  // ============================================================
  //  HELPERS — desenho, formatação, barcode
  // ============================================================

  /** Desenha um retângulo sem preenchimento. */
  private rect(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    doc.lineWidth(0.5).strokeColor(this.LINE_COLOR).rect(x, y, w, h).stroke();
  }

  /**
   * Desenha uma célula no grid: pequeno label no topo e valor em bold embaixo.
   * Usado em todos os boxes de identificação.
   */
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
    // Label em 5pt — força altura de 1 linha via `height: 6` + `ellipsis`.
    // Isso evita o caso de labels longos ("BASE DE CÁLC. DO ICMS") quebrarem
    // em 2 linhas e colidirem com o valor logo abaixo.
    doc
      .font(this.F_DEFAULT)
      .fontSize(5)
      .fillColor('#333')
      .text(label, x + 2, y + 1, {
        width: w - 4,
        height: 6,
        ellipsis: true,
        lineBreak: false,
      });
    doc
      .font(this.F_BOLD)
      .fontSize(destaque ? 9 : 8)
      .fillColor(this.LABEL_COLOR)
      .text(valor, x + 2, y + 8, {
        width: w - 4,
        align,
        height: h - 8,
        ellipsis: true,
        lineBreak: false,
      });
  }

  private async gerarBarcode(chave44: string): Promise<Buffer> {
    // CODE-128C subconjunto (numérico) — padrão DANFE.
    // Fallback para PNG em branco se algo falhar (ex: chave mal formada).
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
    const d = cnpj.replace(/\D/g, '');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return cnpj;
  }

  private formatCep(cep: string | null | undefined): string {
    if (!cep) return '-';
    return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  private formatDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private formatDateShort(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private extractTime(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private formatNumero(numero: string): string {
    const n = numero.padStart(9, '0');
    // 000.000.000 padrão DANFE
    return n.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  }

  /**
   * Versão curta da modalidade de frete (NF-e modFrete 0-9).
   * Evita que a descrição oficial ("Contratação do Frete por conta do
   * Remetente (CIF)") quebre palavra no meio da célula estreita (~66pt).
   */
  private abreviarFrete(codigo: string): string {
    const map: Record<string, string> = {
      '0': 'Remet.',
      '1': 'Dest.',
      '2': 'Terceiros',
      '3': 'Próprio/Rem.',
      '4': 'Próprio/Dest.',
      '9': 'Sem frete',
    };
    return map[codigo] ?? '-';
  }

  /**
   * Garante que o CST/CSOSN sempre tem 3 dígitos (O/CST: origem + código).
   * CST tem 2 dígitos → mantém 2; CSOSN tem 3 dígitos → mantém 3.
   */
  private padCst(cst: string | null | undefined): string {
    if (!cst) return '000';
    const d = cst.replace(/\D/g, '');
    if (d.length >= 3) return d.slice(0, 3);
    return d.padStart(3, '0');
  }
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '-';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
