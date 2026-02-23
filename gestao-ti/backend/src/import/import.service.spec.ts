import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ImportService } from './import.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../common/testing/prisma-mock';
import ExcelJS from 'exceljs';

async function createXlsxBuffer(headers: string[], rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(row);
  }
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function mockFile(buffer: Buffer): Express.Multer.File {
  return { buffer } as Express.Multer.File;
}

describe('ImportService', () => {
  let service: ImportService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ImportService);
  });

  describe('preview', () => {
    it('lanca BadRequestException para entidade invalida', async () => {
      const buffer = await createXlsxBuffer(['nome'], [['teste']]);
      await expect(service.preview('invalida', mockFile(buffer))).rejects.toThrow(BadRequestException);
    });

    it('preview ativos - marca linhas validas', async () => {
      prisma.filial.findMany.mockResolvedValue([{ id: 'f1', codigo: 'F01' }]);
      prisma.ativo.findMany.mockResolvedValue([]);

      const buffer = await createXlsxBuffer(
        ['tag', 'nome', 'tipo', 'filialcodigo'],
        [['TAG001', 'Notebook HP', 'NOTEBOOK', 'F01']],
      );

      const result = await service.preview('ativos', mockFile(buffer));

      expect(result.entidade).toBe('ativos');
      expect(result.totalLinhas).toBe(1);
      expect(result.validas).toBe(1);
      expect(result.invalidas).toBe(0);
      expect(result.linhas[0].valida).toBe(true);
    });

    it('preview ativos - detecta tag duplicada no banco', async () => {
      prisma.filial.findMany.mockResolvedValue([{ id: 'f1', codigo: 'F01' }]);
      prisma.ativo.findMany.mockResolvedValue([{ tag: 'TAG001' }]);

      const buffer = await createXlsxBuffer(
        ['tag', 'nome', 'tipo', 'filialcodigo'],
        [['TAG001', 'Notebook HP', 'NOTEBOOK', 'F01']],
      );

      const result = await service.preview('ativos', mockFile(buffer));

      expect(result.invalidas).toBe(1);
      expect(result.linhas[0].erros).toContain('Tag ja existe: TAG001');
    });

    it('preview ativos - marca filial invalida', async () => {
      prisma.filial.findMany.mockResolvedValue([{ id: 'f1', codigo: 'F01' }]);
      prisma.ativo.findMany.mockResolvedValue([]);

      const buffer = await createXlsxBuffer(
        ['tag', 'nome', 'tipo', 'filialcodigo'],
        [['TAG002', 'Server', 'SERVIDOR', 'INVALIDA']],
      );

      const result = await service.preview('ativos', mockFile(buffer));

      expect(result.linhas[0].valida).toBe(false);
      expect(result.linhas[0].erros.some((e: string) => e.includes('Filial nao encontrada'))).toBe(true);
    });

    it('preview softwares - linhas validas', async () => {
      prisma.software.findMany.mockResolvedValue([]);

      const buffer = await createXlsxBuffer(
        ['nome', 'tipo', 'fabricante'],
        [['VS Code', 'ERP', 'Microsoft']],
      );

      const result = await service.preview('softwares', mockFile(buffer));

      expect(result.validas).toBe(1);
      expect(result.linhas[0].dados).toEqual(
        expect.objectContaining({ nome: 'VS Code', tipo: 'ERP' }),
      );
    });

    it('preview softwares - detecta nome duplicado no banco', async () => {
      prisma.software.findMany.mockResolvedValue([{ nome: 'VS Code' }]);

      const buffer = await createXlsxBuffer(
        ['nome', 'tipo'],
        [['VS Code', 'ERP']],
      );

      const result = await service.preview('softwares', mockFile(buffer));

      expect(result.invalidas).toBe(1);
      expect(result.linhas[0].erros).toContain('Software ja existe: VS Code');
    });
  });

  describe('executar', () => {
    it('cria ativos validos', async () => {
      prisma.ativo.create.mockResolvedValue({ id: 'a1' });

      const result = await service.executar('ativos', [
        { tag: 'TAG001', nome: 'Notebook', tipo: 'NOTEBOOK', filialId: 'f1' },
      ]);

      expect(result.criados).toBe(1);
      expect(result.erros).toHaveLength(0);
    });
  });
});
