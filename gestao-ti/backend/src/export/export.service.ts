import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import ExcelJS from 'exceljs';
import type { Response } from 'express';

const ENTIDADES_VALIDAS = ['ativos', 'chamados', 'contratos', 'softwares', 'licencas', 'paradas', 'projetos'] as const;
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
      include: { software: { select: { nome: true } } },
      orderBy: { numero: 'desc' },
    });
    dados.forEach((d) => sheet.addRow({
      numero: d.numero, titulo: d.titulo, tipo: d.tipo, status: d.status,
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
