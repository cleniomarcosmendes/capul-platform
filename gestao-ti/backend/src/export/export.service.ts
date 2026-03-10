import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

const ENTIDADES_VALIDAS = ['ativos', 'chamados', 'contratos', 'softwares', 'licencas', 'paradas', 'projetos', 'ordens-servico'] as const;
type Entidade = (typeof ENTIDADES_VALIDAS)[number];

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportar(entidade: string, res: Response) {
    if (!ENTIDADES_VALIDAS.includes(entidade as Entidade)) {
      throw new BadRequestException(`Entidade invalida. Validas: ${ENTIDADES_VALIDAS.join(', ')}`);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(entidade);

    switch (entidade as Entidade) {
      case 'ativos': await this.exportAtivos(sheet); break;
      case 'chamados': await this.exportChamados(sheet); break;
      case 'contratos': await this.exportContratos(sheet); break;
      case 'softwares': await this.exportSoftwares(sheet); break;
      case 'licencas': await this.exportLicencas(sheet); break;
      case 'paradas': await this.exportParadas(sheet); break;
      case 'projetos': await this.exportProjetos(sheet); break;
      case 'ordens-servico': await this.exportOrdensServico(sheet); break;
    }

    // Estilizar header
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    });

    // Auto-width colunas
    sheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 50);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${entidade}_${new Date().toISOString().slice(0, 10)}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }

  private async exportAtivos(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Tag', key: 'tag' },
      { header: 'Nome', key: 'nome' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Status', key: 'status' },
      { header: 'Filial', key: 'filial' },
      { header: 'Responsavel', key: 'responsavel' },
      { header: 'Departamento', key: 'departamento' },
      { header: 'SO', key: 'so' },
      { header: 'IP', key: 'ip' },
      { header: 'Hostname', key: 'hostname' },
      { header: 'Fabricante', key: 'fabricante' },
      { header: 'Modelo', key: 'modelo' },
    ];
    const dados = await this.prisma.ativo.findMany({
      include: {
        filial: { select: { codigo: true, nomeFantasia: true } },
        responsavel: { select: { nome: true } },
        departamento: { select: { nome: true } },
      },
      orderBy: { tag: 'asc' },
    });
    dados.forEach((d) => sheet.addRow({
      tag: d.tag, nome: d.nome, tipo: d.tipo, status: d.status,
      filial: `${d.filial.codigo} - ${d.filial.nomeFantasia}`,
      responsavel: d.responsavel?.nome || '', departamento: d.departamento?.nome || '',
      so: d.sistemaOperacional || '', ip: d.ip || '', hostname: d.hostname || '',
      fabricante: d.fabricante || '', modelo: d.modelo || '',
    }));
  }

  private async exportChamados(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Numero', key: 'numero' },
      { header: 'Titulo', key: 'titulo' },
      { header: 'Status', key: 'status' },
      { header: 'Prioridade', key: 'prioridade' },
      { header: 'Equipe', key: 'equipe' },
      { header: 'Tecnico', key: 'tecnico' },
      { header: 'Solicitante', key: 'solicitante' },
      { header: 'Filial', key: 'filial' },
      { header: 'Software', key: 'software' },
      { header: 'Data Limite SLA', key: 'dataLimiteSla' },
      { header: 'Criado Em', key: 'createdAt' },
    ];
    const dados = await this.prisma.chamado.findMany({
      include: {
        equipeAtual: { select: { sigla: true, nome: true } },
        tecnico: { select: { nome: true } },
        solicitante: { select: { nome: true } },
        filial: { select: { codigo: true } },
        software: { select: { nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    dados.forEach((d) => sheet.addRow({
      numero: d.numero, titulo: d.titulo, status: d.status, prioridade: d.prioridade,
      equipe: `${d.equipeAtual.sigla} - ${d.equipeAtual.nome}`,
      tecnico: d.tecnico?.nome || '', solicitante: d.solicitante.nome,
      filial: d.filial.codigo, software: d.software?.nome || '',
      dataLimiteSla: d.dataLimiteSla ? new Date(d.dataLimiteSla).toLocaleDateString('pt-BR') : '',
      createdAt: new Date(d.createdAt).toLocaleDateString('pt-BR'),
    }));
  }

  private async exportContratos(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Numero', key: 'numero' },
      { header: 'Titulo', key: 'titulo' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Status', key: 'status' },
      { header: 'Fornecedor', key: 'fornecedor' },
      { header: 'Valor Total', key: 'valorTotal' },
      { header: 'Data Inicio', key: 'dataInicio' },
      { header: 'Data Fim', key: 'dataFim' },
      { header: 'Software', key: 'software' },
    ];
    const dados = await this.prisma.contrato.findMany({
      include: {
        software: { select: { nome: true } },
        tipoContrato: { select: { nome: true } },
      },
      orderBy: { numero: 'desc' },
    });
    dados.forEach((d) => sheet.addRow({
      numero: d.numero, titulo: d.titulo, tipo: (d as any).tipoContrato?.nome || '', status: d.status,
      fornecedor: d.fornecedor, valorTotal: Number(d.valorTotal),
      dataInicio: new Date(d.dataInicio).toLocaleDateString('pt-BR'),
      dataFim: new Date(d.dataFim).toLocaleDateString('pt-BR'),
      software: d.software?.nome || '',
    }));
  }

  private async exportSoftwares(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Nome', key: 'nome' },
      { header: 'Fabricante', key: 'fabricante' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Criticidade', key: 'criticidade' },
      { header: 'Versao Atual', key: 'versaoAtual' },
      { header: 'Ambiente', key: 'ambiente' },
      { header: 'Status', key: 'status' },
      { header: 'Equipe', key: 'equipe' },
    ];
    const dados = await this.prisma.software.findMany({
      include: { equipeResponsavel: { select: { sigla: true } } },
      orderBy: { nome: 'asc' },
    });
    dados.forEach((d) => sheet.addRow({
      nome: d.nome, fabricante: d.fabricante || '', tipo: d.tipo,
      criticidade: d.criticidade, versaoAtual: d.versaoAtual || '',
      ambiente: d.ambiente || '', status: d.status,
      equipe: d.equipeResponsavel?.sigla || '',
    }));
  }

  private async exportLicencas(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Software', key: 'software' },
      { header: 'Modelo', key: 'modelo' },
      { header: 'Quantidade', key: 'quantidade' },
      { header: 'Valor Total', key: 'valorTotal' },
      { header: 'Data Inicio', key: 'dataInicio' },
      { header: 'Data Vencimento', key: 'dataVencimento' },
      { header: 'Fornecedor', key: 'fornecedor' },
      { header: 'Status', key: 'status' },
    ];
    const dados = await this.prisma.softwareLicenca.findMany({
      include: { software: { select: { nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
    dados.forEach((d) => sheet.addRow({
      software: d.software.nome, modelo: d.modeloLicenca || '',
      quantidade: d.quantidade ?? '', valorTotal: d.valorTotal ? Number(d.valorTotal) : '',
      dataInicio: d.dataInicio ? new Date(d.dataInicio).toLocaleDateString('pt-BR') : '',
      dataVencimento: d.dataVencimento ? new Date(d.dataVencimento).toLocaleDateString('pt-BR') : '',
      fornecedor: d.fornecedor || '', status: d.status,
    }));
  }

  private async exportParadas(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Titulo', key: 'titulo' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Impacto', key: 'impacto' },
      { header: 'Status', key: 'status' },
      { header: 'Software', key: 'software' },
      { header: 'Inicio', key: 'inicio' },
      { header: 'Fim', key: 'fim' },
      { header: 'Duracao (min)', key: 'duracao' },
    ];
    const dados = await this.prisma.registroParada.findMany({
      include: { software: { select: { nome: true } } },
      orderBy: { inicio: 'desc' },
    });
    dados.forEach((d) => sheet.addRow({
      titulo: d.titulo, tipo: d.tipo, impacto: d.impacto, status: d.status,
      software: d.software.nome,
      inicio: new Date(d.inicio).toLocaleDateString('pt-BR'),
      fim: d.fim ? new Date(d.fim).toLocaleDateString('pt-BR') : '',
      duracao: d.duracaoMinutos ?? '',
    }));
  }

  private async exportOrdensServico(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Numero', key: 'numero' },
      { header: 'Titulo', key: 'titulo' },
      { header: 'Status', key: 'status' },
      { header: 'Filial', key: 'filial' },
      { header: 'Solicitante', key: 'solicitante' },
      { header: 'Tecnicos', key: 'tecnicos' },
      { header: 'Chamados', key: 'chamados' },
      { header: 'Agendamento', key: 'agendamento' },
      { header: 'Inicio', key: 'inicio' },
      { header: 'Fim', key: 'fim' },
      { header: 'Duracao', key: 'duracao' },
      { header: 'Observacoes', key: 'observacoes' },
      { header: 'Criado Em', key: 'createdAt' },
    ];
    const dados = await this.prisma.ordemServico.findMany({
      include: {
        filial: { select: { codigo: true, nomeFantasia: true } },
        solicitante: { select: { nome: true } },
        tecnicos: { include: { tecnico: { select: { nome: true } } } },
        _count: { select: { chamados: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const statusLabel: Record<string, string> = {
      ABERTA: 'Aberta', EM_EXECUCAO: 'Em Execucao', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
    };
    dados.forEach((d) => {
      let duracao = '';
      if (d.dataInicio) {
        const fim = d.dataFim || new Date();
        const ms = new Date(fim).getTime() - new Date(d.dataInicio).getTime();
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        duracao = h > 0 ? `${h}h ${m}min` : `${m}min`;
      }
      sheet.addRow({
        numero: d.numero,
        titulo: d.titulo,
        status: statusLabel[d.status] || d.status,
        filial: `${d.filial.codigo} - ${d.filial.nomeFantasia}`,
        solicitante: d.solicitante.nome,
        tecnicos: d.tecnicos.map((t) => t.tecnico.nome).join(', ') || '-',
        chamados: d._count.chamados,
        agendamento: d.dataAgendamento ? new Date(d.dataAgendamento).toLocaleString('pt-BR') : '',
        inicio: d.dataInicio ? new Date(d.dataInicio).toLocaleString('pt-BR') : '',
        fim: d.dataFim ? new Date(d.dataFim).toLocaleString('pt-BR') : '',
        duracao,
        observacoes: d.observacoes || '',
        createdAt: new Date(d.createdAt).toLocaleDateString('pt-BR'),
      });
    });
  }

  async exportRelatorioOs(osId: string, res: Response) {
    const os: any = await this.prisma.ordemServico.findUnique({
      where: { id: osId },
      include: {
        filial: { select: { codigo: true, nomeFantasia: true } },
        solicitante: { select: { nome: true, username: true } },
        tecnicos: {
          include: { tecnico: { select: { nome: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
        chamados: {
          include: {
            chamado: {
              select: {
                numero: true, titulo: true, status: true, prioridade: true,
                createdAt: true, dataResolucao: true, dataFechamento: true,
                solicitante: { select: { nome: true } },
                tecnico: { select: { nome: true } },
                equipeAtual: { select: { sigla: true, nome: true } },
                software: { select: { nome: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!os) throw new BadRequestException('Ordem de servico nao encontrada');

    const statusLabel: Record<string, string> = {
      ABERTA: 'Aberta', EM_EXECUCAO: 'Em Execucao', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
    };
    const statusChamadoLabel: Record<string, string> = {
      ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento', PENDENTE: 'Pendente',
      RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado', REABERTO: 'Reaberto',
    };
    const fmtDate = (d: Date | null | undefined) => d ? new Date(d).toLocaleString('pt-BR') : '—';

    let duracao = '—';
    if (os.dataInicio) {
      const fim = os.dataFim || new Date();
      const ms = new Date(fim).getTime() - new Date(os.dataInicio).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      duracao = h > 0 ? `${h}h ${m}min` : `${m}min`;
    }

    // Colors
    const PRIMARY = '#4F46E5';
    const DARK = '#1E293B';
    const MUTED = '#64748B';
    const LIGHT_BG = '#F1F5F9';
    const WHITE = '#FFFFFF';

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

    const nomeArquivo = `OS_${os.numero}_relatorio_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}`);
    doc.pipe(res);

    const pageW = doc.page.width - 80; // margins

    // ===== HEADER BAR =====
    doc.rect(40, 40, pageW, 50).fill(PRIMARY);
    doc.fontSize(18).fillColor(WHITE).text(`Relatorio — Ordem de Servico #${os.numero}`, 55, 53, { width: pageW - 30 });
    doc.fontSize(8).fillColor('#C7D2FE').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 55, 73, { width: pageW - 30, align: 'right' });

    let y = 105;

    // ===== DADOS DA OS =====
    doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('DADOS DA ORDEM DE SERVICO', 50, y + 6);
    y += 30;

    const campos: [string, string][] = [
      ['Titulo', os.titulo],
      ['Status', statusLabel[os.status] || os.status],
      ['Filial', `${os.filial.codigo} — ${os.filial.nomeFantasia}`],
      ['Solicitante', os.solicitante.nome],
      ['Descricao', os.descricao || '—'],
      ['Agendamento', fmtDate(os.dataAgendamento)],
      ['Inicio', fmtDate(os.dataInicio)],
      ['Encerramento', fmtDate(os.dataFim)],
      ['Duracao', duracao],
      ['Observacoes', os.observacoes || '—'],
    ];

    campos.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(label, 50, y, { width: 100 });
      doc.font('Helvetica').fontSize(9).fillColor(DARK).text(value, 155, y, { width: pageW - 125 });
      y += 16;
    });

    // ===== TECNICOS =====
    y += 10;
    doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(`TECNICOS PARTICIPANTES (${os.tecnicos.length})`, 50, y + 6);
    y += 30;

    if (os.tecnicos.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text('Nenhum tecnico vinculado', 50, y);
      y += 16;
    } else {
      os.tecnicos.forEach((t: any, i: number) => {
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
          .text(`${i + 1}. ${t.tecnico.nome}`, 50, y, { width: 200 });
        doc.fillColor(MUTED).text(t.tecnico.username, 260, y);
        y += 15;
      });
    }

    // ===== CHAMADOS =====
    y += 10;
    if (y > 650) { doc.addPage(); y = 50; }

    doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(`CHAMADOS VINCULADOS (${os.chamados.length})`, 50, y + 6);
    y += 30;

    if (os.chamados.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text('Nenhum chamado vinculado', 50, y);
      y += 16;
    } else {
      // Table header
      const colX = [50, 85, 290, 370, 450];
      const colW = [35, 205, 80, 80, pageW - 410 - 50];
      doc.rect(40, y, pageW, 18).fill(PRIMARY);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE);
      doc.text('#', colX[0], y + 5);
      doc.text('Titulo', colX[1], y + 5);
      doc.text('Status', colX[2], y + 5);
      doc.text('Prioridade', colX[3], y + 5);
      doc.text('Tecnico', colX[4], y + 5);
      y += 22;

      os.chamados.forEach((oc: any, i: number) => {
        if (y > 750) { doc.addPage(); y = 50; }
        const c = oc.chamado;
        const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, y, pageW, 16).fill(bg);
        doc.font('Helvetica').fontSize(8).fillColor(DARK);
        doc.text(`#${c.numero}`, colX[0], y + 4);
        doc.text(c.titulo.length > 40 ? c.titulo.substring(0, 40) + '...' : c.titulo, colX[1], y + 4, { width: colW[1] });
        doc.text(statusChamadoLabel[c.status] || c.status, colX[2], y + 4);
        doc.text(c.prioridade, colX[3], y + 4);
        doc.text(c.tecnico?.nome || '—', colX[4], y + 4, { width: colW[4] });
        y += 16;
      });

      // Detalhes de cada chamado
      y += 10;
      if (y > 680) { doc.addPage(); y = 50; }
      doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
      doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('DETALHES DOS CHAMADOS', 50, y + 6);
      y += 28;

      os.chamados.forEach((oc: any) => {
        if (y > 680) { doc.addPage(); y = 50; }
        const c = oc.chamado;
        doc.rect(40, y, pageW, 1).fill('#E2E8F0');
        y += 6;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(PRIMARY).text(`#${c.numero} — ${c.titulo}`, 50, y, { width: pageW - 20 });
        y += 14;
        const detalhes: [string, string][] = [
          ['Status', statusChamadoLabel[c.status] || c.status],
          ['Prioridade', c.prioridade],
          ['Equipe', `${c.equipeAtual.sigla} — ${c.equipeAtual.nome}`],
          ['Tecnico', c.tecnico?.nome || '—'],
          ['Solicitante', c.solicitante.nome],
          ['Software', c.software?.nome || '—'],
          ['Aberto em', new Date(c.createdAt).toLocaleString('pt-BR')],
          ['Resolvido em', c.dataResolucao ? new Date(c.dataResolucao).toLocaleString('pt-BR') : '—'],
          ['Fechado em', c.dataFechamento ? new Date(c.dataFechamento).toLocaleString('pt-BR') : '—'],
        ];

        // 2 columns layout
        for (let i = 0; i < detalhes.length; i += 2) {
          const [l1, v1] = detalhes[i];
          doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(l1, 60, y, { width: 75 });
          doc.font('Helvetica').fontSize(8).fillColor(DARK).text(v1, 138, y, { width: 140 });
          if (detalhes[i + 1]) {
            const [l2, v2] = detalhes[i + 1];
            doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(l2, 300, y, { width: 75 });
            doc.font('Helvetica').fontSize(8).fillColor(DARK).text(v2, 378, y, { width: 150 });
          }
          y += 13;
        }
        y += 6;
      });
    }

    // ===== RESUMO FINAL =====
    y += 10;
    if (y > 700) { doc.addPage(); y = 50; }

    const totalChamados = os.chamados.length;
    const concluidos = os.chamados.filter((oc: any) => ['FECHADO', 'RESOLVIDO'].includes(oc.chamado.status)).length;
    const abertos = os.chamados.filter((oc: any) => !['FECHADO', 'CANCELADO', 'RESOLVIDO'].includes(oc.chamado.status)).length;
    const cancelados = os.chamados.filter((oc: any) => oc.chamado.status === 'CANCELADO').length;

    doc.rect(40, y, pageW, 50).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text('RESUMO', 55, y + 8);
    doc.font('Helvetica').fontSize(9).fillColor('#C7D2FE');

    const col1 = 55; const col2 = 185; const col3 = 315; const col4 = 420;
    const ry = y + 26;
    doc.font('Helvetica-Bold').fillColor(WHITE);
    doc.text(`${totalChamados}`, col1, ry); doc.font('Helvetica').fillColor('#C7D2FE').text('Total Chamados', col1, ry + 11);
    doc.font('Helvetica-Bold').fillColor(WHITE);
    doc.text(`${concluidos}`, col2, ry); doc.font('Helvetica').fillColor('#C7D2FE').text('Concluidos', col2, ry + 11);
    doc.font('Helvetica-Bold').fillColor(WHITE);
    doc.text(`${abertos}`, col3, ry); doc.font('Helvetica').fillColor('#C7D2FE').text('Em aberto', col3, ry + 11);
    doc.font('Helvetica-Bold').fillColor(WHITE);
    doc.text(`${cancelados}`, col4, ry); doc.font('Helvetica').fillColor('#C7D2FE').text('Cancelados', col4, ry + 11);

    // Footer on all pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor(MUTED)
        .text(`Gestao de T.I. — OS #${os.numero} — Pagina ${i + 1} de ${pages.count}`, 40, doc.page.height - 30, {
          width: pageW, align: 'center',
        });
    }

    doc.end();
  }

  async exportRelatorioRateioParcela(contratoId: string, parcelaId: string, res: Response) {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      include: {
        tipoContrato: { select: { codigo: true, nome: true } },
        filial: { select: { codigo: true, nomeFantasia: true } },
        software: { select: { nome: true } },
      },
    });
    if (!contrato) throw new BadRequestException('Contrato nao encontrado');

    const parcela = await this.prisma.parcelaContrato.findFirst({
      where: { id: parcelaId, contratoId },
    });
    if (!parcela) throw new BadRequestException('Parcela nao encontrada neste contrato');

    const rateioItens = await this.prisma.parcelaRateioItem.findMany({
      where: { parcelaId },
      include: {
        centroCusto: { select: { codigo: true, nome: true } },
        natureza: { select: { codigo: true, nome: true } },
      },
    });
    if (rateioItens.length === 0) throw new BadRequestException('Parcela nao possui rateio configurado');

    const fmtCurrency = (v: number | null | undefined) =>
      `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d: Date | null | undefined) =>
      d ? new Date(d).toLocaleDateString('pt-BR') : '-';

    const PRIMARY = '#4F46E5';
    const DARK = '#1E293B';
    const MUTED = '#64748B';
    const LIGHT_BG = '#F1F5F9';
    const WHITE = '#FFFFFF';

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const nomeArquivo = `Rateio_Contrato${contrato.numero}_Parcela${parcela.numero}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}`);
    doc.pipe(res);

    const pageW = doc.page.width - 80;

    // ===== HEADER =====
    doc.rect(40, 40, pageW, 50).fill(PRIMARY);
    doc.fontSize(16).fillColor(WHITE).text(`Relatorio de Rateio`, 55, 48, { width: pageW - 30 });
    doc.fontSize(9).fillColor('#C7D2FE').text(`Contrato #${contrato.numero} — Parcela #${parcela.numero}`, 55, 68, { width: pageW - 30 });
    doc.fontSize(8).fillColor('#C7D2FE').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 55, 68, { width: pageW - 30, align: 'right' });

    let y = 105;

    // ===== DADOS DO CONTRATO =====
    doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('DADOS DO CONTRATO', 50, y + 6);
    y += 30;

    const camposContrato: [string, string][] = [
      ['Contrato', `#${contrato.numero} — ${contrato.titulo}`],
      ['Fornecedor', contrato.fornecedor || '-'],
      ['Tipo', contrato.tipoContrato ? `${contrato.tipoContrato.codigo} - ${contrato.tipoContrato.nome}` : '-'],
      ['Filial', contrato.filial ? `${contrato.filial.codigo} - ${contrato.filial.nomeFantasia}` : '-'],
      ['Software', contrato.software?.nome || '-'],
      ['Valor Total', fmtCurrency(Number(contrato.valorTotal))],
      ['Vigencia', `${fmtDate(contrato.dataInicio)} a ${fmtDate(contrato.dataFim)}`],
    ];

    camposContrato.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(label, 50, y, { width: 100 });
      doc.font('Helvetica').fontSize(9).fillColor(DARK).text(value, 155, y, { width: pageW - 125 });
      y += 16;
    });

    // ===== DADOS DA PARCELA =====
    y += 10;
    doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('DADOS DA PARCELA', 50, y + 6);
    y += 30;

    const camposParcela: [string, string][] = [
      ['Parcela', `#${parcela.numero}`],
      ['Descricao', parcela.descricao || '-'],
      ['Valor', fmtCurrency(Number(parcela.valor))],
      ['Vencimento', fmtDate(parcela.dataVencimento)],
      ['Status', parcela.status],
      ['Nota Fiscal', parcela.notaFiscal || '-'],
    ];
    if (parcela.dataPagamento) {
      camposParcela.push(['Pago em', fmtDate(parcela.dataPagamento)]);
    }

    camposParcela.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(label, 50, y, { width: 100 });
      doc.font('Helvetica').fontSize(9).fillColor(DARK).text(value, 155, y, { width: pageW - 125 });
      y += 16;
    });

    // ===== TABELA DE RATEIO =====
    y += 10;
    doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(`DISTRIBUICAO DO RATEIO (${rateioItens.length} centro(s) de custo)`, 50, y + 6);
    y += 28;

    // Table header — columns: CC | Natureza Financeira | % | Valor
    const colX = [50, 190, 370, 420];
    const colW = [135, 175, 45, pageW - 420 + 40];
    doc.rect(40, y, pageW, 20).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE);
    doc.text('Centro de Custo', colX[0], y + 6, { width: colW[0] });
    doc.text('Natureza Financeira', colX[1], y + 6, { width: colW[1] });
    doc.text('%', colX[2], y + 6, { width: colW[2], align: 'right' });
    doc.text('Valor (R$)', colX[3], y + 6, { width: colW[3], align: 'right' });
    y += 24;

    let somaValor = 0;
    rateioItens.forEach((ri, i) => {
      if (y > 750) { doc.addPage(); y = 50; }
      const bg = i % 2 === 0 ? WHITE : '#F8FAFC';
      doc.rect(40, y, pageW, 18).fill(bg);
      doc.font('Helvetica').fontSize(8).fillColor(DARK);
      doc.text(`${ri.centroCusto.codigo} - ${ri.centroCusto.nome}`, colX[0], y + 5, { width: colW[0] });
      doc.text(ri.natureza ? `${ri.natureza.codigo} - ${ri.natureza.nome}` : '-', colX[1], y + 5, { width: colW[1] });
      doc.text(ri.percentual != null ? `${Number(ri.percentual).toFixed(2)}%` : '-', colX[2], y + 5, { width: colW[2], align: 'right' });
      doc.font('Helvetica-Bold').text(fmtCurrency(Number(ri.valorCalculado)), colX[3], y + 5, { width: colW[3], align: 'right' });
      somaValor += Number(ri.valorCalculado);
      y += 18;
    });

    // Total row
    doc.rect(40, y, pageW, 22).fill(DARK);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE);
    doc.text('TOTAL', colX[0], y + 6);
    doc.text(fmtCurrency(somaValor), colX[3], y + 6, { width: colW[3], align: 'right' });
    y += 32;

    // ===== CAMPO ASSINATURA (para contabilidade) =====
    if (y > 700) { doc.addPage(); y = 50; }
    y += 20;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Responsavel pelo lancamento:', 50, y);
    y += 25;
    doc.rect(50, y, 200, 0.5).fill(MUTED);
    doc.fontSize(8).fillColor(MUTED).text('Nome / Assinatura', 50, y + 4);
    doc.rect(300, y, 150, 0.5).fill(MUTED);
    doc.text('Data', 300, y + 4);

    // Footer on all pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 30;
      doc.fontSize(7).fillColor(MUTED)
        .text(`Gestao de T.I. — Rateio Contrato #${contrato.numero} Parcela #${parcela.numero} — Pagina ${i + 1} de ${pages.count}`, 40, footerY, {
          width: pageW, align: 'center', lineBreak: false,
        });
    }

    doc.end();
  }

  private async exportProjetos(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'Numero', key: 'numero' },
      { header: 'Nome', key: 'nome' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Modo', key: 'modo' },
      { header: 'Status', key: 'status' },
      { header: 'Responsavel', key: 'responsavel' },
      { header: 'Data Inicio', key: 'dataInicio' },
      { header: 'Custo Previsto', key: 'custoPrevisto' },
      { header: 'Custo Realizado', key: 'custoRealizado' },
    ];
    const dados = await this.prisma.projeto.findMany({
      include: { responsavel: { select: { nome: true } } },
      orderBy: { numero: 'desc' },
    });
    dados.forEach((d) => sheet.addRow({
      numero: d.numero, nome: d.nome, tipo: d.tipo, modo: d.modo, status: d.status,
      responsavel: d.responsavel.nome,
      dataInicio: d.dataInicio ? new Date(d.dataInicio).toLocaleDateString('pt-BR') : '',
      custoPrevisto: d.custoPrevisto ? Number(d.custoPrevisto) : '',
      custoRealizado: d.custoRealizado ? Number(d.custoRealizado) : '',
    }));
  }
}
