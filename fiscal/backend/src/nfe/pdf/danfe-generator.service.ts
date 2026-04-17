import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { NfeParsed } from '../parsers/nfe-parsed.interface.js';

/**
 * Geração do DANFE — Documento Auxiliar da NF-e.
 *
 * Layout compacto em 1 página usando pdfkit nativo. NÃO é a versão certificada
 * do DANFE padrão (que exige código de barras, cabeçalhos específicos do
 * manual NFe e layout fixo) — é uma representação fiel mas simplificada
 * suficiente para conferência interna do Setor Fiscal.
 *
 * Se a CAPUL precisar do DANFE padrão para apresentar a fornecedor/cliente,
 * a troca para `node-danfe-pdf` (ou microsserviço Python com
 * `brasil-fiscal-report`) é feita trocando apenas esta classe — o
 * NfeController chama `danfe.generate(parsed)` independente da implementação.
 *
 * @TODO v2: integrar biblioteca especializada se o Setor Fiscal exigir layout
 * padrão ABRASF/ENCAT.
 */
@Injectable()
export class DanfeGeneratorService {
  private readonly logger = new Logger(DanfeGeneratorService.name);

  async generate(parsed: NfeParsed): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (c) => chunks.push(c));
    const finishedPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // ----- cabeçalho -----
    doc.fontSize(14).font('Helvetica-Bold').text('DANFE — Documento Auxiliar da NF-e', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').text(
      `Nº ${parsed.dadosGerais.numero.padStart(9, '0')}   Série ${parsed.dadosGerais.serie}   ${parsed.dadosGerais.tipoOperacaoDescricao}`,
      { align: 'center' },
    );
    doc.text(`Chave: ${this.formatChave(parsed.dadosGerais.chave)}`, { align: 'center' });
    doc.text(`Emissão: ${this.formatDate(parsed.dadosGerais.dataEmissao)}`, { align: 'center' });
    doc.moveDown(0.5);
    this.drawHr(doc);

    // ----- protocolo -----
    if (parsed.protocoloAutorizacao) {
      doc.fontSize(8).font('Helvetica').text(
        `Protocolo autorização: ${parsed.protocoloAutorizacao.protocolo} — ${this.formatDate(parsed.protocoloAutorizacao.dataRecebimento)} — ${parsed.protocoloAutorizacao.motivo}`,
      );
      doc.moveDown(0.3);
      this.drawHr(doc);
    }

    // ----- emitente -----
    doc.fontSize(10).font('Helvetica-Bold').text('EMITENTE');
    doc.font('Helvetica').fontSize(9);
    doc.text(`${parsed.emitente.razaoSocial}`);
    if (parsed.emitente.nomeFantasia) doc.text(`Nome fantasia: ${parsed.emitente.nomeFantasia}`);
    doc.text(
      `CNPJ: ${this.formatCnpj(parsed.emitente.cnpj)}   IE: ${parsed.emitente.inscricaoEstadual ?? '-'}`,
    );
    const e = parsed.emitente.endereco;
    doc.text(
      `${e.logradouro ?? ''}, ${e.numero ?? ''} ${e.complemento ?? ''} - ${e.bairro ?? ''} - ${e.municipio ?? ''}/${e.uf ?? ''} - CEP ${this.formatCep(e.cep)}`,
    );
    doc.moveDown(0.3);

    // ----- destinatário -----
    doc.font('Helvetica-Bold').fontSize(10).text('DESTINATÁRIO');
    doc.font('Helvetica').fontSize(9);
    doc.text(parsed.destinatario.razaoSocial);
    doc.text(
      `CNPJ/CPF: ${this.formatCnpj(parsed.destinatario.cnpj ?? parsed.destinatario.cpf)}   IE: ${parsed.destinatario.inscricaoEstadual ?? '-'}`,
    );
    const d = parsed.destinatario.endereco;
    doc.text(
      `${d.logradouro ?? ''}, ${d.numero ?? ''} ${d.complemento ?? ''} - ${d.bairro ?? ''} - ${d.municipio ?? ''}/${d.uf ?? ''} - CEP ${this.formatCep(d.cep)}`,
    );
    doc.moveDown(0.3);
    this.drawHr(doc);

    // ----- natureza + operação -----
    doc.fontSize(9).font('Helvetica');
    doc.text(`Natureza da operação: ${parsed.dadosGerais.naturezaOperacao}`);
    doc.text(`Finalidade: ${parsed.dadosGerais.finalidadeDescricao}   Ambiente: ${parsed.dadosGerais.ambiente === '1' ? 'Produção' : 'Homologação'}`);
    doc.moveDown(0.3);
    this.drawHr(doc);

    // ----- produtos -----
    doc.font('Helvetica-Bold').fontSize(10).text('PRODUTOS / SERVIÇOS');
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(8);
    const headerY = doc.y;
    doc.text('Item', 30, headerY, { width: 25 });
    doc.text('Cód.', 55, headerY, { width: 50 });
    doc.text('Descrição', 105, headerY, { width: 200 });
    doc.text('UN', 305, headerY, { width: 25 });
    doc.text('Qtd.', 330, headerY, { width: 45, align: 'right' });
    doc.text('VL Unit.', 375, headerY, { width: 60, align: 'right' });
    doc.text('VL Total', 435, headerY, { width: 60, align: 'right' });
    doc.text('CFOP', 495, headerY, { width: 35, align: 'right' });
    doc.text('ICMS', 530, headerY, { width: 35, align: 'right' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8);
    for (const p of parsed.produtos) {
      const y = doc.y;
      doc.text(String(p.item), 30, y, { width: 25 });
      doc.text(p.codigo.slice(0, 12), 55, y, { width: 50 });
      doc.text(p.descricao.slice(0, 55), 105, y, { width: 200 });
      doc.text(p.unidadeComercial, 305, y, { width: 25 });
      doc.text(fmt(p.quantidadeComercial, 4), 330, y, { width: 45, align: 'right' });
      doc.text(fmt(p.valorUnitarioComercial, 4), 375, y, { width: 60, align: 'right' });
      doc.text(fmt(p.valorTotalBruto, 2), 435, y, { width: 60, align: 'right' });
      doc.text(p.cfop, 495, y, { width: 35, align: 'right' });
      doc.text(fmt(p.impostos.icmsValor ?? 0, 2), 530, y, { width: 35, align: 'right' });
      doc.moveDown(0.15);
      if (doc.y > 700) {
        doc.addPage();
      }
    }
    doc.moveDown(0.3);
    this.drawHr(doc);

    // ----- totais -----
    doc.font('Helvetica-Bold').fontSize(10).text('TOTAIS DA NOTA');
    doc.font('Helvetica').fontSize(9);
    const t = parsed.totais;
    const col1 = 30;
    const col2 = 310;
    let ty = doc.y;
    doc.text(`BC ICMS: ${fmt(t.baseCalculoIcms)}`, col1, ty);
    doc.text(`VL ICMS: ${fmt(t.valorIcms)}`, col2, ty);
    ty = doc.y + 2;
    doc.text(`Produtos: ${fmt(t.valorProdutos)}`, col1, ty);
    doc.text(`Frete: ${fmt(t.valorFrete)}`, col2, ty);
    ty = doc.y + 2;
    doc.text(`Seguro: ${fmt(t.valorSeguro)}`, col1, ty);
    doc.text(`Desconto: ${fmt(t.valorDesconto)}`, col2, ty);
    ty = doc.y + 2;
    doc.text(`IPI: ${fmt(t.valorIpi)}`, col1, ty);
    doc.text(`Outros: ${fmt(t.valorOutros)}`, col2, ty);
    ty = doc.y + 4;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`VALOR TOTAL DA NOTA: ${fmt(t.valorNota)}`, col1, ty);
    doc.moveDown(0.5);
    this.drawHr(doc);

    // ----- transporte -----
    doc.font('Helvetica-Bold').fontSize(10).text('TRANSPORTE');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Modalidade: ${parsed.transporte.modalidadeFreteDescricao}`);
    if (parsed.transporte.transportador?.razaoSocial) {
      doc.text(
        `Transportador: ${parsed.transporte.transportador.razaoSocial} — CNPJ ${this.formatCnpj(parsed.transporte.transportador.cnpj)}`,
      );
    }
    if (parsed.transporte.veiculo?.placa) {
      doc.text(`Veículo: placa ${parsed.transporte.veiculo.placa} - UF ${parsed.transporte.veiculo.uf}`);
    }

    // ----- rodapé -----
    doc.moveDown(1);
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#666').text(
      'DANFE gerado pela Plataforma Capul — Módulo Fiscal. Representação simplificada do XML autorizado, para conferência interna. Não substitui o DANFE oficial quando exigido por terceiros.',
      { align: 'center' },
    );
    doc.fillColor('#000');

    doc.end();
    return finishedPromise;
  }

  private drawHr(doc: PDFKit.PDFDocument): void {
    const y = doc.y + 2;
    doc.moveTo(30, y).lineTo(565, y).strokeColor('#888').lineWidth(0.5).stroke();
    doc.moveDown(0.3);
  }

  private formatChave(chave: string): string {
    return chave.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  private formatCnpj(cnpj: string | null | undefined): string {
    if (!cnpj) return '-';
    if (cnpj.length === 14) {
      return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (cnpj.length === 11) {
      return cnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
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
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '-';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
