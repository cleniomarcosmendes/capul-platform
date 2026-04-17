import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { CteParsed } from '../parsers/cte-parsed.interface.js';

/**
 * Geração do DACTE — Documento Auxiliar do Conhecimento de Transporte Eletrônico.
 *
 * Espelho do DanfeGeneratorService com o layout adaptado para os campos
 * específicos de CT-e (modalidade, origem/destino, carga, tomador, componentes
 * de valor, documentos transportados). Versão simplificada suficiente para
 * conferência interna; se o Setor Fiscal exigir o layout padrão ENCAT,
 * trocar por biblioteca especializada mantendo a mesma interface `generate()`.
 */
@Injectable()
export class DacteGeneratorService {
  private readonly logger = new Logger(DacteGeneratorService.name);

  async generate(parsed: CteParsed): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // ----- cabeçalho -----
    doc.fontSize(14).font('Helvetica-Bold').text('DACTE — Documento Auxiliar do CT-e', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').text(
      `Nº ${parsed.dadosGerais.numero.padStart(9, '0')}   Série ${parsed.dadosGerais.serie}   ${parsed.dadosGerais.tipoCteDescricao}`,
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

    // ----- modalidade + origem/destino -----
    doc.fontSize(10).font('Helvetica-Bold').text('PRESTAÇÃO DE SERVIÇO');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Natureza: ${parsed.dadosGerais.naturezaOperacao}`);
    doc.text(`Modalidade: ${parsed.dadosGerais.modalidadeDescricao}   Serviço: ${parsed.dadosGerais.tipoServicoDescricao}`);
    doc.text(`Trajeto: ${parsed.dadosGerais.ufInicio} → ${parsed.dadosGerais.ufFim}   CFOP: ${parsed.dadosGerais.cfop}`);
    doc.text(`Tomador: ${parsed.tomador}`);
    doc.moveDown(0.3);
    this.drawHr(doc);

    // ----- emitente (transportador) -----
    doc.font('Helvetica-Bold').fontSize(10).text('TRANSPORTADOR (EMITENTE)');
    doc.font('Helvetica').fontSize(9);
    doc.text(parsed.emitente.razaoSocial);
    doc.text(
      `CNPJ: ${this.formatCnpj(parsed.emitente.cnpj ?? parsed.emitente.cpf)}   IE: ${parsed.emitente.inscricaoEstadual ?? '-'}`,
    );
    if (parsed.emitente.endereco) {
      const e = parsed.emitente.endereco;
      doc.text(`${e.logradouro ?? ''}, ${e.numero ?? ''} - ${e.bairro ?? ''} - ${e.municipio ?? ''}/${e.uf ?? ''} - CEP ${this.formatCep(e.cep)}`);
    }
    doc.moveDown(0.3);

    // ----- remetente / destinatário -----
    doc.font('Helvetica-Bold').fontSize(10).text('REMETENTE');
    doc.font('Helvetica').fontSize(9);
    doc.text(parsed.remetente.razaoSocial);
    doc.text(
      `CNPJ: ${this.formatCnpj(parsed.remetente.cnpj ?? parsed.remetente.cpf)}   IE: ${parsed.remetente.inscricaoEstadual ?? '-'}`,
    );
    doc.moveDown(0.2);

    doc.font('Helvetica-Bold').fontSize(10).text('DESTINATÁRIO');
    doc.font('Helvetica').fontSize(9);
    doc.text(parsed.destinatario.razaoSocial);
    doc.text(
      `CNPJ: ${this.formatCnpj(parsed.destinatario.cnpj ?? parsed.destinatario.cpf)}   IE: ${parsed.destinatario.inscricaoEstadual ?? '-'}`,
    );
    if (parsed.destinatario.endereco) {
      const e = parsed.destinatario.endereco;
      doc.text(`${e.logradouro ?? ''}, ${e.numero ?? ''} - ${e.municipio ?? ''}/${e.uf ?? ''} - CEP ${this.formatCep(e.cep)}`);
    }
    doc.moveDown(0.3);
    this.drawHr(doc);

    // ----- carga -----
    doc.font('Helvetica-Bold').fontSize(10).text('CARGA');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Produto predominante: ${parsed.carga.produtoPredominante || '-'}`);
    if (parsed.carga.outrasCaracteristicas) {
      doc.text(`Outras características: ${parsed.carga.outrasCaracteristicas}`);
    }
    doc.text(`Valor da carga: R$ ${fmt(parsed.carga.valorCarga)}`);
    if (parsed.carga.quantidades.length > 0) {
      for (const q of parsed.carga.quantidades) {
        doc.text(`  ${q.descricao}: ${fmt(q.quantidade, 4)}`);
      }
    }
    doc.moveDown(0.3);
    this.drawHr(doc);

    // ----- componentes do valor -----
    doc.font('Helvetica-Bold').fontSize(10).text('COMPONENTES DO VALOR');
    doc.font('Helvetica').fontSize(9);
    if (parsed.valores.componentes.length > 0) {
      for (const c of parsed.valores.componentes) {
        const col1 = 30;
        const col2 = 400;
        const y = doc.y;
        doc.text(c.nome, col1, y);
        doc.text(`R$ ${fmt(c.valor)}`, col2, y, { width: 120, align: 'right' });
        doc.moveDown(0.15);
      }
    }
    doc.moveDown(0.2);

    if (parsed.valores.icmsValor !== null && parsed.valores.icmsValor !== undefined) {
      doc.text(
        `ICMS: base R$ ${fmt(parsed.valores.icmsBase ?? 0)}   Alíquota ${fmt(parsed.valores.icmsAliquota ?? 0, 2)}%   Valor R$ ${fmt(parsed.valores.icmsValor)}`,
      );
    }

    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`VALOR TOTAL DA PRESTAÇÃO: R$ ${fmt(parsed.valores.valorTotalPrestacao)}`);
    doc.text(`VALOR A RECEBER: R$ ${fmt(parsed.valores.valorReceber)}`);
    doc.moveDown(0.5);
    this.drawHr(doc);

    // ----- documentos transportados -----
    if (parsed.documentosTransportados.length > 0) {
      doc.font('Helvetica-Bold').fontSize(10).text('DOCUMENTOS TRANSPORTADOS');
      doc.font('Helvetica').fontSize(8);
      for (const d of parsed.documentosTransportados) {
        if (d.chaveNFe) {
          doc.text(`NF-e: ${d.chaveNFe.replace(/(\d{4})(?=\d)/g, '$1 ')}`);
        } else if (d.numeroNF) {
          doc.text(`NF nº ${d.numeroNF}${d.serie ? ` Série ${d.serie}` : ''}`);
        }
      }
      doc.moveDown(0.3);
    }

    // ----- observações -----
    if (parsed.observacoes) {
      this.drawHr(doc);
      doc.font('Helvetica-Bold').fontSize(10).text('OBSERVAÇÕES');
      doc.font('Helvetica').fontSize(8).text(parsed.observacoes);
    }

    // ----- rodapé -----
    doc.moveDown(1);
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#666').text(
      'DACTE gerado pela Plataforma Capul — Módulo Fiscal. Representação simplificada do XML autorizado, para conferência interna. Não substitui o DACTE oficial quando exigido por terceiros.',
      { align: 'center' },
    );
    doc.fillColor('#000');

    doc.end();
    return finished;
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
    if (cnpj.length === 14) return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (cnpj.length === 11) return cnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
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
