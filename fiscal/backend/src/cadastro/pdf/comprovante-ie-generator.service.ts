import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type {
  CadastroConsultaPontualResult,
  InscricaoEstadualSefaz,
  CruzamentoIeProtheusSefaz,
} from '../cadastro.service.js';
import type { ReceitaFederalData } from '../receita.client.js';

/**
 * Geração do "Comprovante CCC — Inscrição Estadual" — relatório textual
 * simples (sem layout gráfico) com Dados do Contribuinte (Receita Federal)
 * + Dados da IE selecionada (CCC/SEFAZ) + Cruzamento Protheus.
 *
 * Implementação usa **fluxo contínuo** do PDFKit (sem gestão manual de `y`)
 * — `moveDown()` entre seções e `text(continued: true)` para "label: valor"
 * na mesma linha. Page break é automático.
 *
 * Versão anterior tentava controlar `y` manualmente e gerou PDF com 22 páginas
 * vazias quando o conteúdo cresceu — refatorada em 29/04/2026.
 */
@Injectable()
export class ComprovanteIeGeneratorService {
  private readonly logger = new Logger(ComprovanteIeGeneratorService.name);

  async generate(params: {
    consultaResult: CadastroConsultaPontualResult;
    ie: InscricaoEstadualSefaz;
    cruzamento: CruzamentoIeProtheusSefaz | null;
    dadosReceita: ReceitaFederalData | null;
    filialConsulente: string;
  }): Promise<Buffer> {
    const { consultaResult, ie, cruzamento, dadosReceita, filialConsulente } = params;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40, // PDFKit gerencia margens e auto-pagebreak sozinho
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // === TÍTULO ===
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(13);
    doc.text('COMPROVANTE CCC — INSCRIÇÃO ESTADUAL');
    doc.font('Helvetica').fontSize(10);
    doc.moveDown(0.2);
    doc.text(
      `CNPJ ${this.fmtCnpj(consultaResult.cnpj)}  |  UF ${ie.uf}  |  IE ${ie.inscricaoEstadual}`,
    );
    this.linhaHr(doc);

    // === DADOS DO CONTRIBUINTE (Receita Federal) ===
    this.tituloSecao(doc, 'DADOS DO CONTRIBUINTE (Receita Federal)');
    if (dadosReceita) {
      this.campo(doc, 'Razão Social', dadosReceita.razaoSocial);
      this.campo(doc, 'Nome Fantasia', dadosReceita.nomeFantasia);
      this.campo(
        doc,
        'Situação na Receita',
        this.situacaoComData(dadosReceita.situacao, dadosReceita.dataSituacao),
      );
      this.campo(doc, 'Motivo da Situação', dadosReceita.motivoSituacao);
      this.campo(doc, 'Data de Abertura', dadosReceita.dataAbertura);
      this.campo(doc, 'Natureza Jurídica', dadosReceita.naturezaJuridica);
      this.campo(doc, 'Porte', dadosReceita.porte);
      this.campo(
        doc,
        'Capital Social',
        dadosReceita.capitalSocial != null
          ? `R$ ${dadosReceita.capitalSocial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : null,
      );
      this.campo(
        doc,
        'CNAE Principal',
        dadosReceita.cnaeFiscal
          ? `${dadosReceita.cnaeFiscal}${dadosReceita.cnaeFiscalDescricao ? ' — ' + dadosReceita.cnaeFiscalDescricao : ''}`
          : null,
      );

      if (dadosReceita.cnaesSecundarios.length > 0) {
        this.campo(
          doc,
          'CNAEs Secundários',
          `${dadosReceita.cnaesSecundarios.length} registro(s):`,
        );
        for (const cnae of dadosReceita.cnaesSecundarios) {
          doc.font('Helvetica').fontSize(9).fillColor('#000');
          doc.text(`    • ${cnae.codigo} — ${cnae.descricao}`);
        }
        doc.fontSize(10);
      }

      // Endereço RFB
      if (dadosReceita.endereco) {
        const e = dadosReceita.endereco;
        doc.moveDown(0.2);
        const logradouro =
          [e.logradouro ?? '', e.numero ? `, ${e.numero}` : '', e.complemento ? ` — ${e.complemento}` : '']
            .join('')
            .trim() || null;
        this.campo(doc, 'Endereço (RFB)', logradouro);
        this.campo(doc, 'Bairro', e.bairro);
        if (e.municipio || e.uf) {
          this.campo(doc, 'Município/UF', `${e.municipio ?? '-'} / ${e.uf ?? '-'}`);
        }
        this.campo(doc, 'CEP', e.cep);
      }
      this.campo(doc, 'Telefone', dadosReceita.telefone);
      this.campo(doc, 'E-mail', dadosReceita.email);

      doc.moveDown(0.3);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666');
      doc.text(
        `Fonte: ${dadosReceita.fonte === 'BRASILAPI' ? 'BrasilAPI' : 'ReceitaWS'} (consultado em ${new Date(dadosReceita.consultadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
      );
      doc.fillColor('#000').fontSize(10);
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#666');
      doc.text(
        'Dados da Receita Federal não disponíveis (CPF não suportado por APIs públicas, ou indisponibilidade temporária).',
      );
      doc.fillColor('#000');
    }

    doc.moveDown(0.8);

    // === DADOS DA INSCRIÇÃO ESTADUAL ===
    this.tituloSecao(doc, `DADOS DA INSCRIÇÃO ESTADUAL (SEFAZ-${ie.uf})`);
    this.campo(doc, 'Número da IE', ie.inscricaoEstadual);
    this.campo(doc, 'UF', ie.uf);
    this.campo(doc, 'Razão Social', ie.razaoSocial);
    this.campo(doc, 'Nome Fantasia', ie.nomeFantasia);
    this.campo(doc, 'Situação na SEFAZ', this.fmtSituacao(ie.situacaoRaw, ie.situacao));
    this.campo(doc, 'cSit (código)', ie.cSit);
    this.campo(doc, 'Data da Situação', ie.dataSituacao);
    this.campo(doc, 'Início de Atividade', ie.inicioAtividade);
    this.campo(doc, 'Fim de Atividade', ie.dataFimAtividade);
    this.campo(
      doc,
      'IE Atual (CCC v4)',
      ie.ieAtual && ie.ieAtual !== ie.inscricaoEstadual
        ? `${ie.ieAtual} (substituição registrada)`
        : '(igual à consultada — sem substituição)',
    );
    this.campo(doc, 'Regime de Apuração', ie.regimeApuracao);
    this.campo(doc, 'IE Destinatário (NF-e)', ie.ieDestinatario);
    this.campo(doc, 'IE Destinatário (CT-e)', ie.ieDestinatarioCTe);
    this.campo(doc, 'CNAE Fiscal', ie.cnae);
    this.campo(
      doc,
      'DF-e Habilitados',
      ie.dfeHabilitados.length > 0 ? ie.dfeHabilitados.join(', ') : null,
    );

    if (ie.endereco) {
      const e = ie.endereco;
      doc.moveDown(0.2);
      const logradouro =
        [e?.logradouro ?? '', e?.numero ? `, ${e.numero}` : '', e?.complemento ? ` — ${e.complemento}` : '']
          .join('')
          .trim() || null;
      this.campo(doc, 'Endereço (SEFAZ)', logradouro);
      this.campo(doc, 'Bairro', e?.bairro);
      this.campo(doc, 'Município', e?.municipio);
      this.campo(doc, 'CEP', e?.cep);
    }

    doc.moveDown(0.8);

    // === CRUZAMENTO COM PROTHEUS ===
    if (cruzamento && cruzamento.vinculosProtheus.length > 0) {
      this.tituloSecao(doc, 'CRUZAMENTO COM PROTHEUS');
      const statusTexto =
        cruzamento.status === 'AMBOS'
          ? 'AMBOS — IE existe no SEFAZ e no Protheus'
          : cruzamento.status === 'APENAS_PROTHEUS'
            ? 'APENAS PROTHEUS — IE não retorna no SEFAZ (verificar se foi baixada)'
            : 'APENAS SEFAZ — IE existe no SEFAZ mas não há vínculo no Protheus';
      this.campo(doc, 'Status do Cruzamento', statusTexto);

      cruzamento.vinculosProtheus.forEach((v, i) => {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
        doc.text(`Vínculo ${i + 1}:`);
        this.campo(
          doc,
          '  Origem',
          v.origem === 'SA1010' ? 'Cliente (SA1010)' : 'Fornecedor (SA2010)',
        );
        this.campo(doc, '  Código/Loja', `${v.codigo ?? '-'}/${v.loja ?? '-'}`);
        this.campo(doc, '  Razão (Protheus)', v.razaoSocial);
        if (v.filial) this.campo(doc, '  Filial Protheus', v.filial);
      });

      doc.moveDown(0.5);
    }

    // === ALERTAS ===
    if (cruzamento && cruzamento.alertas.length > 0) {
      this.tituloSecao(doc, 'ALERTAS DETECTADOS');
      for (const a of cruzamento.alertas) {
        doc.font('Helvetica').fontSize(10).fillColor('#000');
        doc.text(`• ${a}`);
      }
      doc.moveDown(0.5);
    }

    // === RODAPÉ ===
    doc.moveDown(1);
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .lineWidth(0.5)
      .strokeColor('#999')
      .stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666');
    doc.text(
      `Comprovante gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} | Plataforma Capul | Filial ${filialConsulente} | Dados oficiais constam no portal SEFAZ-${ie.uf} e no portal da Receita Federal (solucoes.receita.fazenda.gov.br).`,
    );

    doc.end();
    return finished;
  }

  // ============================================================
  // Helpers de renderização — usam fluxo contínuo do PDFKit
  // ============================================================

  /** Título de seção em negrito + linha horizontal abaixo. */
  private tituloSecao(doc: PDFKit.PDFDocument, titulo: string): void {
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(11);
    doc.text(titulo);
    doc
      .moveTo(40, doc.y + 1)
      .lineTo(555, doc.y + 1)
      .lineWidth(0.5)
      .strokeColor('#000')
      .stroke();
    doc.moveDown(0.3);
  }

  /** Linha horizontal preta no Y atual. */
  private linhaHr(doc: PDFKit.PDFDocument): void {
    doc.moveDown(0.2);
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .lineWidth(1)
      .strokeColor('#000')
      .stroke();
    doc.moveDown(0.3);
  }

  /**
   * Renderiza linha "Campo: Valor". Label em negrito, valor após. Pula se
   * valor é null/empty/'-' (não polui o PDF). Usa `continued: true` pra
   * label e valor ficarem na mesma linha, com auto-wrap se valor for longo.
   */
  private campo(
    doc: PDFKit.PDFDocument,
    label: string,
    valor: string | null | undefined,
  ): void {
    if (valor == null || valor === '' || valor === '-') return;
    doc.fillColor('#000').fontSize(10);
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(String(valor));
  }

  // ============================================================
  // Helpers de formatação
  // ============================================================

  private fmtCnpj(s: string | null | undefined): string {
    if (!s) return '-';
    const d = s.replace(/\D/g, '');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return s;
  }

  private fmtSituacao(situacaoRaw: string, situacaoEnum: string): string {
    if (!situacaoRaw && !situacaoEnum) return '-';
    if (situacaoRaw && situacaoEnum && situacaoRaw !== situacaoEnum) {
      return `${situacaoEnum} (${situacaoRaw})`;
    }
    return situacaoEnum || situacaoRaw || '-';
  }

  private situacaoComData(
    situacao: string | null,
    dataSituacao: string | null,
  ): string | null {
    if (!situacao) return null;
    return dataSituacao ? `${situacao} desde ${dataSituacao}` : situacao;
  }
}
