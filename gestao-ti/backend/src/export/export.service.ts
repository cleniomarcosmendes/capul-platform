import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

const ENTIDADES_VALIDAS = ['ativos', 'chamados', 'contratos', 'softwares', 'licencas', 'paradas', 'projetos', 'ordens-servico', 'notas-fiscais'] as const;
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
      case 'notas-fiscais': await this.exportNotasFiscais(sheet); break;
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
      dataLimiteSla: d.dataLimiteSla ? new Date(d.dataLimiteSla).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
      createdAt: new Date(d.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
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
      dataInicio: new Date(d.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      dataFim: new Date(d.dataFim).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
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
      software: d.software?.nome || d.nome || 'Avulsa', modelo: d.modeloLicenca || '',
      quantidade: d.quantidade ?? '', valorTotal: d.valorTotal ? Number(d.valorTotal) : '',
      dataInicio: d.dataInicio ? new Date(d.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
      dataVencimento: d.dataVencimento ? new Date(d.dataVencimento).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
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
      inicio: new Date(d.inicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      fim: d.fim ? new Date(d.fim).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
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
        agendamento: d.dataAgendamento ? new Date(d.dataAgendamento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
        inicio: d.dataInicio ? new Date(d.dataInicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
        fim: d.dataFim ? new Date(d.dataFim).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
        duracao,
        observacoes: d.observacoes || '',
        createdAt: new Date(d.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
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
    const fmtDate = (d: Date | null | undefined) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

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
    const labelWidth = 80;
    const valueX = 130;
    const valueWidth = pageW - labelWidth - 10;

    // Helper: calcula altura do texto
    const calcTextHeight = (text: string, width: number, fontSize: number) => {
      doc.fontSize(fontSize);
      return doc.heightOfString(text, { width }) + 2;
    };

    // Helper: verifica se precisa nova pagina
    const checkPage = (needed: number) => {
      if (y + needed > doc.page.height - 60) {
        doc.addPage();
        y = 50;
      }
    };

    // ===== HEADER BAR =====
    doc.rect(40, 40, pageW, 40).fill(PRIMARY);
    doc.fontSize(14).fillColor(WHITE).text(`Relatorio — Ordem de Servico #${os.numero}`, 50, 50, { width: pageW - 20 });
    doc.fontSize(7).fillColor('#C7D2FE').text(`Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, 50, 66, { width: pageW - 20, align: 'right' });

    let y = 95;

    // ===== DADOS DA OS =====
    doc.rect(40, y, pageW, 18).fill(LIGHT_BG);
    doc.fontSize(8).fillColor(DARK).font('Helvetica-Bold').text('DADOS DA ORDEM DE SERVICO', 50, y + 5);
    y += 26;

    // Campos simples (uma linha)
    const camposSimples: [string, string][] = [
      ['Titulo', os.titulo],
      ['Status', statusLabel[os.status] || os.status],
      ['Filial', `${os.filial.codigo} — ${os.filial.nomeFantasia}`],
      ['Solicitante', os.solicitante.nome],
    ];

    camposSimples.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text(label, 50, y, { width: labelWidth });
      doc.font('Helvetica').fontSize(7).fillColor(DARK).text(value, valueX, y, { width: valueWidth });
      y += 12;
    });

    // Descricao (altura dinamica)
    const descricao = os.descricao || '—';
    const descHeight = calcTextHeight(descricao, valueWidth, 7);
    checkPage(descHeight + 10);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text('Descricao', 50, y, { width: labelWidth });
    doc.font('Helvetica').fontSize(7).fillColor(DARK).text(descricao, valueX, y, { width: valueWidth });
    y += Math.max(descHeight, 12) + 4;

    // Campos de data (em grid 2x2 para compactar)
    const camposDatas: [string, string][] = [
      ['Agendamento', fmtDate(os.dataAgendamento)],
      ['Inicio', fmtDate(os.dataInicio)],
      ['Encerramento', fmtDate(os.dataFim)],
      ['Duracao', duracao],
    ];

    for (let i = 0; i < camposDatas.length; i += 2) {
      const [l1, v1] = camposDatas[i];
      doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text(l1, 50, y, { width: 70 });
      doc.font('Helvetica').fontSize(7).fillColor(DARK).text(v1, 125, y, { width: 130 });
      if (camposDatas[i + 1]) {
        const [l2, v2] = camposDatas[i + 1];
        doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text(l2, 280, y, { width: 70 });
        doc.font('Helvetica').fontSize(7).fillColor(DARK).text(v2, 355, y, { width: 150 });
      }
      y += 12;
    }

    // Observacoes (altura dinamica)
    const observacoes = os.observacoes || '—';
    const obsHeight = calcTextHeight(observacoes, valueWidth, 7);
    checkPage(obsHeight + 10);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text('Observacoes', 50, y, { width: labelWidth });
    doc.font('Helvetica').fontSize(7).fillColor(DARK).text(observacoes, valueX, y, { width: valueWidth });
    y += Math.max(obsHeight, 12) + 8;

    // ===== TECNICOS =====
    checkPage(50);
    doc.rect(40, y, pageW, 18).fill(LIGHT_BG);
    doc.fontSize(8).fillColor(DARK).font('Helvetica-Bold').text(`TECNICOS PARTICIPANTES (${os.tecnicos.length})`, 50, y + 5);
    y += 24;

    if (os.tecnicos.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(7).fillColor(MUTED).text('Nenhum tecnico vinculado', 50, y);
      y += 12;
    } else {
      os.tecnicos.forEach((t: any, i: number) => {
        doc.font('Helvetica').fontSize(7).fillColor(DARK)
          .text(`${i + 1}. ${t.tecnico.nome}`, 50, y, { width: 180 });
        doc.fillColor(MUTED).text(t.tecnico.username, 240, y);
        y += 11;
      });
    }

    // ===== CHAMADOS =====
    y += 8;
    checkPage(60);

    doc.rect(40, y, pageW, 18).fill(LIGHT_BG);
    doc.fontSize(8).fillColor(DARK).font('Helvetica-Bold').text(`CHAMADOS VINCULADOS (${os.chamados.length})`, 50, y + 5);
    y += 24;

    if (os.chamados.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(7).fillColor(MUTED).text('Nenhum chamado vinculado', 50, y);
      y += 12;
    } else {
      // Table header
      const colX = [50, 80, 260, 330, 410];
      const colW = [30, 180, 70, 80, pageW - 370];
      doc.rect(40, y, pageW, 14).fill(PRIMARY);
      doc.font('Helvetica-Bold').fontSize(6).fillColor(WHITE);
      doc.text('#', colX[0], y + 4);
      doc.text('Titulo', colX[1], y + 4);
      doc.text('Status', colX[2], y + 4);
      doc.text('Prioridade', colX[3], y + 4);
      doc.text('Tecnico', colX[4], y + 4);
      y += 16;

      os.chamados.forEach((oc: any, i: number) => {
        checkPage(14);
        const c = oc.chamado;
        const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, y, pageW, 12).fill(bg);
        doc.font('Helvetica').fontSize(6).fillColor(DARK);
        doc.text(`#${c.numero}`, colX[0], y + 3);
        doc.text(c.titulo.length > 45 ? c.titulo.substring(0, 45) + '...' : c.titulo, colX[1], y + 3, { width: colW[1] });
        doc.text(statusChamadoLabel[c.status] || c.status, colX[2], y + 3);
        doc.text(c.prioridade, colX[3], y + 3);
        doc.text(c.tecnico?.nome || '—', colX[4], y + 3, { width: colW[4] });
        y += 12;
      });

      // Detalhes de cada chamado
      y += 8;
      checkPage(40);
      doc.rect(40, y, pageW, 18).fill(LIGHT_BG);
      doc.fontSize(8).fillColor(DARK).font('Helvetica-Bold').text('DETALHES DOS CHAMADOS', 50, y + 5);
      y += 22;

      os.chamados.forEach((oc: any) => {
        checkPage(70);
        const c = oc.chamado;
        doc.rect(40, y, pageW, 0.5).fill('#E2E8F0');
        y += 4;
        doc.font('Helvetica-Bold').fontSize(7).fillColor(PRIMARY).text(`#${c.numero} — ${c.titulo}`, 50, y, { width: pageW - 20 });
        y += 12;
        const detalhes: [string, string][] = [
          ['Status', statusChamadoLabel[c.status] || c.status],
          ['Prioridade', c.prioridade],
          ['Equipe', `${c.equipeAtual.sigla} — ${c.equipeAtual.nome}`],
          ['Tecnico', c.tecnico?.nome || '—'],
          ['Solicitante', c.solicitante.nome],
          ['Software', c.software?.nome || '—'],
          ['Aberto em', new Date(c.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
          ['Resolvido em', c.dataResolucao ? new Date(c.dataResolucao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'],
          ['Fechado em', c.dataFechamento ? new Date(c.dataFechamento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'],
        ];

        // 3 columns layout para compactar
        for (let i = 0; i < detalhes.length; i += 3) {
          const cols = [
            { x: 55, w: 55, vx: 110, vw: 100 },
            { x: 220, w: 55, vx: 275, vw: 100 },
            { x: 385, w: 50, vx: 435, vw: 80 },
          ];
          for (let j = 0; j < 3 && detalhes[i + j]; j++) {
            const [lbl, val] = detalhes[i + j];
            const col = cols[j];
            doc.font('Helvetica-Bold').fontSize(6).fillColor(MUTED).text(lbl, col.x, y, { width: col.w });
            doc.font('Helvetica').fontSize(6).fillColor(DARK).text(val, col.vx, y, { width: col.vw });
          }
          y += 10;
        }
        y += 4;
      });
    }

    // ===== RESUMO FINAL =====
    y += 8;
    checkPage(45);

    const totalChamados = os.chamados.length;
    const concluidos = os.chamados.filter((oc: any) => ['FECHADO', 'RESOLVIDO'].includes(oc.chamado.status)).length;
    const abertos = os.chamados.filter((oc: any) => !['FECHADO', 'CANCELADO', 'RESOLVIDO'].includes(oc.chamado.status)).length;
    const cancelados = os.chamados.filter((oc: any) => oc.chamado.status === 'CANCELADO').length;

    doc.rect(40, y, pageW, 38).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE).text('RESUMO', 50, y + 5);

    const col1 = 50; const col2 = 165; const col3 = 280; const col4 = 395;
    const ry = y + 17;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE);
    doc.text(`${totalChamados}`, col1, ry); doc.font('Helvetica').fontSize(6).fillColor('#C7D2FE').text('Total Chamados', col1, ry + 10);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE);
    doc.text(`${concluidos}`, col2, ry); doc.font('Helvetica').fontSize(6).fillColor('#C7D2FE').text('Concluidos', col2, ry + 10);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE);
    doc.text(`${abertos}`, col3, ry); doc.font('Helvetica').fontSize(6).fillColor('#C7D2FE').text('Em aberto', col3, ry + 10);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE);
    doc.text(`${cancelados}`, col4, ry); doc.font('Helvetica').fontSize(6).fillColor('#C7D2FE').text('Cancelados', col4, ry + 10);

    // Footer on all pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(6).fillColor(MUTED)
        .text(`Gestao de T.I. — OS #${os.numero} — Pagina ${i + 1} de ${pages.count}`, 40, doc.page.height - 25, {
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
        fornecedorRef: { select: { codigo: true, loja: true, nome: true } },
        produtoRef: { select: { codigo: true, descricao: true } },
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
      d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-';

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
    doc.fontSize(8).fillColor('#C7D2FE').text(`Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, 55, 68, { width: pageW - 30, align: 'right' });

    let y = 105;

    // ===== DADOS DO CONTRATO =====
    doc.rect(40, y, pageW, 22).fill(LIGHT_BG);
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('DADOS DO CONTRATO', 50, y + 6);
    y += 30;

    // Fornecedor: nome + codigo/loja
    let fornecedorStr = contrato.fornecedor || '-';
    if (contrato.fornecedorRef) {
      fornecedorStr = contrato.fornecedorRef.nome || contrato.fornecedor || '-';
      const parts: string[] = [];
      if (contrato.fornecedorRef.codigo) parts.push(`Cod: ${contrato.fornecedorRef.codigo}`);
      if (contrato.fornecedorRef.loja) parts.push(`Loja: ${contrato.fornecedorRef.loja}`);
      if (parts.length) fornecedorStr += ` (${parts.join(' / ')})`;
    } else if (contrato.codigoFornecedor) {
      const parts: string[] = [`Cod: ${contrato.codigoFornecedor}`];
      if (contrato.lojaFornecedor) parts.push(`Loja: ${contrato.lojaFornecedor}`);
      fornecedorStr += ` (${parts.join(' / ')})`;
    }

    // Produto: codigo + descricao
    let produtoStr = '-';
    if (contrato.produtoRef) {
      produtoStr = `${contrato.produtoRef.codigo} - ${contrato.produtoRef.descricao}`;
    } else if (contrato.codigoProduto) {
      produtoStr = contrato.descricaoProduto
        ? `${contrato.codigoProduto} - ${contrato.descricaoProduto}`
        : contrato.codigoProduto;
    }

    const camposContrato: [string, string][] = [
      ['Contrato', `#${contrato.numero} — ${contrato.titulo}`],
      ['Fornecedor', fornecedorStr],
      ['Tipo', contrato.tipoContrato ? contrato.tipoContrato.nome : '-'],
      ['Filial', contrato.filial ? `${contrato.filial.codigo} - ${contrato.filial.nomeFantasia}` : '-'],
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
      ['Nota Fiscal', parcela.notaFiscal || '-'],
    ];

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
    const colX = [50, 195, 380, 430];
    const colW = [140, 180, 45, pageW - 430 + 40];
    doc.rect(40, y, pageW, 18).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(WHITE);
    doc.text('Centro de Custo', colX[0], y + 5, { width: colW[0] });
    doc.text('Natureza Financeira', colX[1], y + 5, { width: colW[1] });
    doc.text('%', colX[2], y + 5, { width: colW[2], align: 'right' });
    doc.text('Valor (R$)', colX[3], y + 5, { width: colW[3], align: 'right' });
    y += 20;

    let somaValor = 0;
    rateioItens.forEach((ri, i) => {
      if (y > 750) { doc.addPage(); y = 50; }
      const ccText = `${ri.centroCusto.codigo} - ${ri.centroCusto.nome}`;
      const natText = ri.natureza ? `${ri.natureza.codigo} - ${ri.natureza.nome}` : '-';
      // Calcular altura necessaria (estimar se texto vai quebrar linha)
      const rowH = ccText.length > 28 || natText.length > 35 ? 22 : 16;
      const bg = i % 2 === 0 ? WHITE : '#F8FAFC';
      doc.rect(40, y, pageW, rowH).fill(bg);
      doc.font('Helvetica').fontSize(7).fillColor(DARK);
      doc.text(ccText, colX[0], y + 4, { width: colW[0], lineGap: 1 });
      doc.text(natText, colX[1], y + 4, { width: colW[1], lineGap: 1 });
      doc.text(ri.percentual != null ? `${Number(ri.percentual).toFixed(2)}%` : '-', colX[2], y + 4, { width: colW[2], align: 'right' });
      doc.font('Helvetica-Bold').text(fmtCurrency(Number(ri.valorCalculado)), colX[3], y + 4, { width: colW[3], align: 'right' });
      somaValor += Number(ri.valorCalculado);
      y += rowH;
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
      dataInicio: d.dataInicio ? new Date(d.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
      custoPrevisto: d.custoPrevisto ? Number(d.custoPrevisto) : '',
      custoRealizado: d.custoRealizado ? Number(d.custoRealizado) : '',
    }));
  }

  private async exportNotasFiscais(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { header: 'NF', key: 'numero' },
      { header: 'Data Lancamento', key: 'dataLancamento' },
      { header: 'Fornecedor', key: 'fornecedor' },
      { header: 'Status', key: 'status' },
      { header: 'Produto', key: 'produto' },
      { header: 'Tipo Produto', key: 'tipoProduto' },
      { header: 'Qtde', key: 'quantidade' },
      { header: 'Valor Unitario', key: 'valorUnitario' },
      { header: 'Valor Total Item', key: 'valorTotalItem' },
      { header: 'Centro de Custo', key: 'centroCusto' },
      { header: 'Projeto', key: 'projeto' },
      { header: 'Valor Total NF', key: 'valorTotalNF' },
    ];
    const dados = await this.prisma.notaFiscal.findMany({
      include: {
        fornecedor: true,
        itens: {
          include: {
            produto: { include: { tipoProduto: true } },
            centroCusto: true,
            projeto: { select: { numero: true, nome: true } },
          },
        },
      },
      orderBy: { dataLancamento: 'desc' },
    });
    dados.forEach((nf) => {
      nf.itens.forEach((item) => {
        sheet.addRow({
          numero: nf.numero,
          dataLancamento: new Date(nf.dataLancamento).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          fornecedor: `${nf.fornecedor.codigo} - ${nf.fornecedor.nome}`,
          status: nf.status,
          produto: `${item.produto.codigo} - ${item.produto.descricao}`,
          tipoProduto: item.produto.tipoProduto?.descricao || '',
          quantidade: item.quantidade,
          valorUnitario: Number(item.valorUnitario),
          valorTotalItem: Number(item.valorTotal),
          centroCusto: item.centroCusto ? `${item.centroCusto.codigo} - ${item.centroCusto.nome}` : '',
          projeto: item.projeto ? `#${item.projeto.numero} - ${item.projeto.nome}` : '',
          valorTotalNF: Number(nf.valorTotal),
        });
      });
    });
  }
}
