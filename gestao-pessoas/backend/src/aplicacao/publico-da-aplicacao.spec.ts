/**
 * O PÚBLICO DA APLICAÇÃO — atalhos de preenchimento, não regra.
 *
 * A tela escolhe um recorte (centro de custo, filial, ou pessoas), o sistema
 * traz as pessoas, ela ajusta e salva a lista resultante.
 *
 * ⭐ O que este arquivo protege é a PRÉVIA. `@@unique([cicloId, colaboradorId])`
 * recusa quem já está em outra aplicação do mesmo ciclo; sem prévia, escolher
 * um centro de custo que se sobrepõe a outro público falharia no INSERT, com o
 * erro do banco e sem dizer de quem se trata.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { AplicacaoService } from './aplicacao.service.js';

const APP = 'app-1';
const CICLO = 'ciclo-1';
const RH = 'user-rh';

const PESSOAS = [
  { id: 'c1', nome: 'ANA', matricula: '001', filial: '02', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c2', nome: 'BRUNO', matricula: '002', filial: '02', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c3', nome: 'CARLA', matricula: '003', filial: '02', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
];

describe('AplicacaoService — público nominal', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: AplicacaoService;

  const alvoCC = { origem: 'CENTRO_CUSTO' as const, referencia: '02|21010101', centrosCusto: [{ filial: '02', centroCusto: '21010101' }] };

  const montar = (ocupados: { colaboradorId: string; aplicacaoId: string; nome: string }[] = []) => {
    prisma.aplicacao.findUnique.mockResolvedValue({ id: APP, nome: 'Operação de Loja', cicloId: CICLO });
    prisma.colaborador.findMany.mockResolvedValue(PESSOAS);
    prisma.aplicacaoPublico.findMany.mockResolvedValue(
      ocupados.map((o) => ({
        colaboradorId: o.colaboradorId,
        aplicacaoId: o.aplicacaoId,
        aplicacao: { nome: o.nome },
      })),
    );
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new AplicacaoService(prisma as never, auditoria as never);
  });

  describe('prévia do atalho', () => {
    it('traz todo mundo do recorte quando ninguém está em aplicação nenhuma', async () => {
      montar();
      const p = await service.previaDoPublico(APP, alvoCC);
      expect(p).toMatchObject({ encontradas: 3, adicionar: 3, jaNesta: 0, emOutraAplicacao: [] });
    });

    it('⭐ AVISA quem já está em OUTRA aplicação, com nome e qual é', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: 'app-aprendizes', nome: 'Aprendizes' }]);
      const p = await service.previaDoPublico(APP, alvoCC);

      expect(p.adicionar).toBe(2);
      expect(p.emOutraAplicacao).toEqual([
        expect.objectContaining({ nome: 'ANA', aplicacao: 'Aprendizes' }),
      ]);
    });

    it('quem já está NESTA aplicação não conta como conflito', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: APP, nome: 'Operação de Loja' }]);
      const p = await service.previaDoPublico(APP, alvoCC);
      expect(p).toMatchObject({ adicionar: 2, jaNesta: 1, emOutraAplicacao: [] });
    });

    it('a prévia não grava nada', async () => {
      montar();
      await service.previaDoPublico(APP, alvoCC);
      expect(prisma.aplicacaoPublico.createMany).not.toHaveBeenCalled();
    });

    it('⚠️ recorte vazio é recusado — seria a empresa inteira', async () => {
      montar();
      await expect(service.previaDoPublico(APP, { origem: 'MANUAL' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('adicionar', () => {
    it('grava só quem não estava em aplicação nenhuma, com a origem do atalho', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: 'app-x', nome: 'Outra' }]);
      const r = await service.adicionarAoPublico(APP, alvoCC, true, RH);

      expect(r.adicionadas).toBe(2);
      expect(prisma.aplicacaoPublico.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ colaboradorId: 'c2', origem: 'CENTRO_CUSTO', origemReferencia: '02|21010101', provisorio: true }),
          expect.objectContaining({ colaboradorId: 'c3' }),
        ],
      });
    });

    it('⭐ provisório é o que a tela mandar — e a tela manda true por padrão', async () => {
      montar();
      await service.adicionarAoPublico(APP, alvoCC, false, RH);
      expect(prisma.aplicacaoPublico.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([expect.objectContaining({ provisorio: false })]),
      });
    });

    it('devolve o conflito que sobrou, sem uma segunda chamada', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: 'app-x', nome: 'Outra' }]);
      const r = await service.adicionarAoPublico(APP, alvoCC, true, RH);
      expect(r.emOutraAplicacao).toEqual([expect.objectContaining({ nome: 'ANA' })]);
    });

    it('nada a adicionar não grava nem audita', async () => {
      montar(PESSOAS.map((p) => ({ colaboradorId: p.id, aplicacaoId: APP, nome: 'Esta' })));
      const r = await service.adicionarAoPublico(APP, alvoCC, true, RH);
      expect(r.adicionadas).toBe(0);
      expect(prisma.aplicacaoPublico.createMany).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('remover', () => {
    it('⚠️ quem já tem avaliação não sai do público', async () => {
      // A `Avaliacao` ficaria órfã do recorte que a originou e sumiria da
      // contagem sem sumir do banco.
      prisma.aplicacaoPublico.findFirst.mockResolvedValue({ id: 'p1', origem: 'CENTRO_CUSTO' });
      prisma.avaliacao.count.mockResolvedValue(1);
      await expect(service.removerDoPublico(APP, 'c1', RH)).rejects.toThrow(/Cancele a avaliação antes/);
      expect(prisma.aplicacaoPublico.delete).not.toHaveBeenCalled();
    });

    it('sem avaliação, sai e fica registrado', async () => {
      prisma.aplicacaoPublico.findFirst.mockResolvedValue({ id: 'p1', origem: 'CENTRO_CUSTO' });
      prisma.avaliacao.count.mockResolvedValue(0);
      await service.removerDoPublico(APP, 'c1', RH);
      expect(prisma.aplicacaoPublico.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'PUBLICO_REMOVER' }));
    });
  });
});
