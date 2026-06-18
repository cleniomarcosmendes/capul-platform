import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConhecimentoService } from './conhecimento.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

describe('ConhecimentoService', () => {
  let service: ConhecimentoService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        ConhecimentoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ConhecimentoService);
  });

  describe('findAll', () => {
    it('retorna lista (sem user → só globais publicados) e pagina', async () => {
      const artigos = [{ id: '1', titulo: 'Artigo 1' }];
      prisma.artigoConhecimento.findMany.mockResolvedValue(artigos);

      const result = await service.findAll({});

      const call = prisma.artigoConhecimento.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ updatedAt: 'desc' });
      // S16.2: sem user, a visibilidade restringe a globais publicados.
      expect(call.where.OR).toEqual([{ equipeTiId: null, publica: true, status: 'PUBLICADO' }]);
      // paginate retorna { items, total, page, pageSize }.
      expect(result.items).toEqual(artigos);
    });

    it('aplica busca por search com OR (composta com a visibilidade via AND)', async () => {
      prisma.artigoConhecimento.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'teste' });

      const call = prisma.artigoConhecimento.findMany.mock.calls[0][0];
      // search vira where.AND[0].OR; a visibilidade entra como AND[1].OR.
      const searchOr = call.where.AND[0].OR;
      expect(searchOr).toHaveLength(3);
      expect(searchOr[0]).toEqual({ titulo: { contains: 'teste', mode: 'insensitive' } });
    });
  });

  describe('create', () => {
    it('cria artigo com autorId correto', async () => {
      const dto = { titulo: 'Novo', conteudo: 'Conteudo', categoria: 'TUTORIAL' };
      prisma.artigoConhecimento.create.mockResolvedValue({ id: '1', ...dto, autorId: 'user-1' });

      await service.create(dto as any, 'user-1');

      expect(prisma.artigoConhecimento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ autorId: 'user-1', titulo: 'Novo' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('atualiza campos parciais', async () => {
      prisma.artigoConhecimento.findUnique.mockResolvedValue({ id: '1', titulo: 'Antigo' });
      prisma.artigoConhecimento.update.mockResolvedValue({ id: '1', titulo: 'Novo' });

      await service.update('1', { titulo: 'Novo' } as any);

      expect(prisma.artigoConhecimento.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { titulo: 'Novo' },
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('seta publicadoEm ao publicar', async () => {
      prisma.artigoConhecimento.findUnique.mockResolvedValue({ id: '1', status: 'RASCUNHO', publicadoEm: null });
      prisma.artigoConhecimento.update.mockResolvedValue({ id: '1', status: 'PUBLICADO' });

      await service.updateStatus('1', 'PUBLICADO' as any);

      const call = prisma.artigoConhecimento.update.mock.calls[0][0];
      expect(call.data.status).toBe('PUBLICADO');
      expect(call.data.publicadoEm).toBeInstanceOf(Date);
    });

    it('nao sobrescreve publicadoEm se ja existe', async () => {
      const existing = new Date('2025-01-01');
      prisma.artigoConhecimento.findUnique.mockResolvedValue({ id: '1', status: 'ARQUIVADO', publicadoEm: existing });
      prisma.artigoConhecimento.update.mockResolvedValue({});

      await service.updateStatus('1', 'PUBLICADO' as any);

      const call = prisma.artigoConhecimento.update.mock.calls[0][0];
      expect(call.data.publicadoEm).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deleta artigo por id', async () => {
      prisma.artigoConhecimento.findUnique.mockResolvedValue({ id: '1' });

      await service.delete('1');

      expect(prisma.artigoConhecimento.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('lanca NotFoundException se artigo nao existe', async () => {
      prisma.artigoConhecimento.findUnique.mockResolvedValue(null);

      await expect(service.delete('999')).rejects.toThrow(NotFoundException);
    });
  });
});
