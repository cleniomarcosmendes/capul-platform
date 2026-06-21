import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SacTemplateService } from './sac-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

describe('SacTemplateService (SAC 4b)', () => {
  let service: SacTemplateService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [SacTemplateService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SacTemplateService);
  });

  it('listarAtivos: filtra ativo=true e ordena', async () => {
    await service.listarAtivos();
    expect(prisma.sacRespostaTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true } }),
    );
  });

  it('criar: default ativo=true + ordem=0, trima o título', async () => {
    await service.criar({ titulo: '  Saudação  ', corpo: 'Olá!' });
    expect(prisma.sacRespostaTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ titulo: 'Saudação', corpo: 'Olá!', ativo: true, ordem: 0 }) }),
    );
  });

  it('atualizar: inexistente → NotFound', async () => {
    prisma.sacRespostaTemplate.findUnique.mockResolvedValue(null);
    await expect(service.atualizar('x', { titulo: 'a' })).rejects.toThrow(NotFoundException);
  });

  it('remover: existente → deleta', async () => {
    prisma.sacRespostaTemplate.findUnique.mockResolvedValue({ id: 't1' });
    const r = await service.remover('t1');
    expect(r).toEqual({ deleted: true });
    expect(prisma.sacRespostaTemplate.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });
});
