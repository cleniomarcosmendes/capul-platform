import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import ExcelJS from 'exceljs';
import { TipoAtivo, TipoSoftware } from '@prisma/client';

export interface LinhaPreview {
  linha: number;
  dados: Record<string, unknown>;
  valida: boolean;
  erros: string[];
}

export interface PreviewResult {
  entidade: string;
  totalLinhas: number;
  validas: number;
  invalidas: number;
  linhas: LinhaPreview[];
}

const ENTIDADES_IMPORTAVEIS = ['ativos', 'softwares'] as const;

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(entidade: string, file: Express.Multer.File): Promise<PreviewResult> {
    if (!ENTIDADES_IMPORTAVEIS.includes(entidade as 'ativos' | 'softwares')) {
      throw new BadRequestException(`Entidade invalida para import. Validas: ${ENTIDADES_IMPORTAVEIS.join(', ')}`);
    }

    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Planilha vazia');

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? '').trim().toLowerCase();
    });

    const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const key = headers[colNumber];
        if (key) obj[key] = cell.value;
      });
      if (Object.keys(obj).length > 0) rows.push(obj);
    });

    let linhas: LinhaPreview[];
    if (entidade === 'ativos') {
      linhas = await this.previewAtivos(rows);
    } else {
      linhas = await this.previewSoftwares(rows);
    }

    return {
      entidade,
      totalLinhas: linhas.length,
      validas: linhas.filter((l) => l.valida).length,
      invalidas: linhas.filter((l) => !l.valida).length,
      linhas,
    };
  }

  async executar(entidade: string, dados: Record<string, unknown>[]) {
    if (entidade === 'ativos') return this.executarAtivos(dados);
    if (entidade === 'softwares') return this.executarSoftwares(dados);
    throw new BadRequestException('Entidade invalida');
  }

  // ── Preview Ativos ──

  private async previewAtivos(rows: Record<string, unknown>[]): Promise<LinhaPreview[]> {
    const filiais = await this.prisma.filial.findMany({ select: { id: true, codigo: true } });
    const filialMap = new Map(filiais.map((f) => [f.codigo.toLowerCase(), f.id]));

    const tagsExistentes = new Set(
      (await this.prisma.ativo.findMany({ select: { tag: true } })).map((a) => a.tag.toLowerCase()),
    );

    const tiposValidos = new Set(Object.values(TipoAtivo));
    const tagsNoArquivo = new Set<string>();

    return rows.map((row, idx) => {
      const erros: string[] = [];
      const tag = String(row['tag'] ?? '').trim();
      const nome = String(row['nome'] ?? '').trim();
      const tipo = String(row['tipo'] ?? '').trim().toUpperCase();
      const filialCodigo = String(row['filialcodigo'] ?? row['filial_codigo'] ?? row['filial'] ?? '').trim();

      if (!tag) erros.push('Tag obrigatoria');
      if (!nome) erros.push('Nome obrigatorio');
      if (!tipo || !tiposValidos.has(tipo as TipoAtivo)) erros.push(`Tipo invalido: ${tipo}`);
      if (!filialCodigo) erros.push('Filial obrigatoria');
      else if (!filialMap.has(filialCodigo.toLowerCase())) erros.push(`Filial nao encontrada: ${filialCodigo}`);

      if (tag && tagsExistentes.has(tag.toLowerCase())) erros.push(`Tag ja existe: ${tag}`);
      if (tag && tagsNoArquivo.has(tag.toLowerCase())) erros.push(`Tag duplicada no arquivo: ${tag}`);
      if (tag) tagsNoArquivo.add(tag.toLowerCase());

      return {
        linha: idx + 2,
        dados: {
          tag, nome, tipo,
          filialId: filialMap.get(filialCodigo.toLowerCase()) || null,
          fabricante: row['fabricante'] || null,
          modelo: row['modelo'] || null,
          sistemaOperacional: row['so'] || row['sistema_operacional'] || null,
          ip: row['ip'] || null,
          hostname: row['hostname'] || null,
        },
        valida: erros.length === 0,
        erros,
      };
    });
  }

  private async executarAtivos(dados: Record<string, unknown>[]) {
    let criados = 0;
    const erros: { linha: number; erro: string }[] = [];

    for (let i = 0; i < dados.length; i++) {
      const d = dados[i];
      try {
        await this.prisma.ativo.create({
          data: {
            tag: String(d['tag']),
            nome: String(d['nome']),
            tipo: d['tipo'] as TipoAtivo,
            filialId: String(d['filialId']),
            fabricante: d['fabricante'] ? String(d['fabricante']) : undefined,
            modelo: d['modelo'] ? String(d['modelo']) : undefined,
            sistemaOperacional: d['sistemaOperacional'] ? String(d['sistemaOperacional']) : undefined,
            ip: d['ip'] ? String(d['ip']) : undefined,
            hostname: d['hostname'] ? String(d['hostname']) : undefined,
          },
        });
        criados++;
      } catch (err) {
        erros.push({ linha: i + 2, erro: String(err instanceof Error ? err.message : err) });
      }
    }

    return { criados, erros };
  }

  // ── Preview Softwares ──

  private async previewSoftwares(rows: Record<string, unknown>[]): Promise<LinhaPreview[]> {
    const nomesExistentes = new Set(
      (await this.prisma.software.findMany({ select: { nome: true } })).map((s) => s.nome.toLowerCase()),
    );

    const tiposValidos = new Set(Object.values(TipoSoftware));
    const nomesNoArquivo = new Set<string>();

    return rows.map((row, idx) => {
      const erros: string[] = [];
      const nome = String(row['nome'] ?? '').trim();
      const tipo = String(row['tipo'] ?? '').trim().toUpperCase();

      if (!nome) erros.push('Nome obrigatorio');
      if (!tipo || !tiposValidos.has(tipo as TipoSoftware)) erros.push(`Tipo invalido: ${tipo}`);

      if (nome && nomesExistentes.has(nome.toLowerCase())) erros.push(`Software ja existe: ${nome}`);
      if (nome && nomesNoArquivo.has(nome.toLowerCase())) erros.push(`Nome duplicado no arquivo: ${nome}`);
      if (nome) nomesNoArquivo.add(nome.toLowerCase());

      return {
        linha: idx + 2,
        dados: {
          nome, tipo,
          fabricante: row['fabricante'] || null,
          versaoAtual: row['versao_atual'] || row['versaoatual'] || row['versao'] || null,
        },
        valida: erros.length === 0,
        erros,
      };
    });
  }

  private async executarSoftwares(dados: Record<string, unknown>[]) {
    let criados = 0;
    const erros: { linha: number; erro: string }[] = [];

    for (let i = 0; i < dados.length; i++) {
      const d = dados[i];
      try {
        await this.prisma.software.create({
          data: {
            nome: String(d['nome']),
            tipo: d['tipo'] as TipoSoftware,
            fabricante: d['fabricante'] ? String(d['fabricante']) : undefined,
            versaoAtual: d['versaoAtual'] ? String(d['versaoAtual']) : undefined,
          },
        });
        criados++;
      } catch (err) {
        erros.push({ linha: i + 2, erro: String(err instanceof Error ? err.message : err) });
      }
    }

    return { criados, erros };
  }
}
