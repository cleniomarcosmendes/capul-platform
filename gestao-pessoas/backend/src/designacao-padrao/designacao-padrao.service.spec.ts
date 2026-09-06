/**
 * O CADASTRO — a parte que toca o banco.
 *
 * Três garantias que só existem aqui:
 *   1. gravar exige a CONFERÊNCIA que a prévia devolveu;
 *   2. desfazer ENCERRA a vigência do lote, nunca apaga linha;
 *   3. revisar transforma a linha arbitrada em decisão de gente.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { conferenciaDe } from './planilha.js';
import { DesignacaoPadraoService } from './designacao-padrao.service.js';

const CSV = 'centro_custo;avaliador_matricula\n21010101;000010\n';
const RH = 'user-rh';

describe('DesignacaoPadraoService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: DesignacaoPadraoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new DesignacaoPadraoService(prisma as never, auditoria as never);
    prisma.colaborador.findMany.mockResolvedValue([
      { id: 'c-a', filial: '02', matricula: '000001', nome: 'ANA', centroCusto: '21010101', centroCustoDescricao: 'S', cargoDescricao: null },
      { id: 'c-chefe', filial: '02', matricula: '000010', nome: 'CHEFE', centroCusto: '21010101', centroCustoDescricao: 'S', cargoDescricao: 'GERENTE' },
    ]);
  });

  describe('⭐ gravar exige a conferência da prévia', () => {
    it('recusa quando o arquivo mudou depois da pré-visualização', async () => {
      await expect(
        service.importar(CSV, 'planilha.csv', conferenciaDe('outro conteudo'), false, RH),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.importacaoDesignacao.create).not.toHaveBeenCalled();
    });

    it('a mensagem diz o que fazer, e nada é gravado', async () => {
      await expect(service.importar(CSV, 'p.csv', 'sha-de-mentira', false, RH)).rejects.toThrow(
        /arquivo mudou depois da pré-visualização.*prévia de novo/s,
      );
      expect(prisma.designacaoPadrao.createMany).not.toHaveBeenCalled();
    });

    it('com a conferência certa, grava o lote e as linhas', async () => {
      prisma.importacaoDesignacao.create.mockResolvedValue({ id: 'lote-1' });
      const resultado = await service.importar(CSV, 'p.csv', conferenciaDe(CSV), false, RH);

      expect(resultado.importacaoId).toBe('lote-1');
      expect(prisma.designacaoPadrao.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ avaliadorId: 'c-chefe', avaliadoId: 'c-a', importacaoId: 'lote-1' })],
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'IMPORTAR' }));
    });

    it('a prévia não grava nada', async () => {
      const p = await service.previaDaImportacao(CSV, false);
      expect(p.conferencia).toBe(conferenciaDe(CSV));
      expect(p.pares.total).toBe(1);
      expect(prisma.importacaoDesignacao.create).not.toHaveBeenCalled();
      expect(prisma.designacaoPadrao.createMany).not.toHaveBeenCalled();
    });
  });

  describe('⭐ desfazer encerra a vigência, não apaga', () => {
    beforeEach(() => {
      prisma.importacaoDesignacao.findUnique.mockResolvedValue({ id: 'lote-1', desfeitoEm: null });
      prisma.designacaoPadrao.findMany.mockResolvedValue([
        { id: 'd1', origem: 'DIVISAO_AUTOMATICA' },
        { id: 'd2', origem: 'MANUAL' },
      ]);
    });

    it('encerra as vigentes do lote sem chamar delete', async () => {
      const r = await service.desfazerImportacao('lote-1', RH);
      expect(r.encerradas).toBe(2);
      expect(prisma.designacaoPadrao.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d1', 'd2'] } },
        data: { vigenciaFim: expect.any(Date) },
      });
      expect(prisma.designacaoPadrao.delete).not.toHaveBeenCalled();
      expect(prisma.designacaoPadrao.deleteMany).not.toHaveBeenCalled();
    });

    it('⭐ diz quantas já tinham sido REVISADAS à mão — é o trabalho que se perde', () => {
      return expect(service.desfazerImportacao('lote-1', RH)).resolves.toMatchObject({ revisadasAMao: 1 });
    });

    it('avisa que o que a importação substituiu não volta sozinho', async () => {
      const r = await service.desfazerImportacao('lote-1', RH);
      expect(r.aviso).toMatch(/não voltam automaticamente/);
    });

    it('desfazer duas vezes é recusado', async () => {
      prisma.importacaoDesignacao.findUnique.mockResolvedValue({
        id: 'lote-1',
        desfeitoEm: new Date('2026-09-06'),
      });
      await expect(service.desfazerImportacao('lote-1', RH)).rejects.toThrow(/já foi desfeita/);
    });
  });

  describe('⭐ revisar — a linha arbitrada vira decisão de gente', () => {
    it('DIVISAO_AUTOMATICA passa a MANUAL', async () => {
      prisma.designacaoPadrao.findMany.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);
      const r = await service.revisar(['d1', 'd2'], RH);

      expect(r).toEqual({ revisadas: 2, pedidas: 2 });
      expect(prisma.designacaoPadrao.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d1', 'd2'] } },
        data: { origem: 'MANUAL' },
      });
    });

    it('só alcança linha vigente e ainda não revisada', async () => {
      prisma.designacaoPadrao.findMany.mockResolvedValue([{ id: 'd1' }]);
      await service.revisar(['d1', 'd2'], RH);
      expect(prisma.designacaoPadrao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vigenciaFim: null, origem: 'DIVISAO_AUTOMATICA' }),
        }),
      );
    });

    it('nada a revisar é recusa explicada, não sucesso silencioso', async () => {
      prisma.designacaoPadrao.findMany.mockResolvedValue([]);
      await expect(service.revisar(['d1'], RH)).rejects.toThrow(/já foram revisadas.*encerradas/s);
    });
  });

  describe('designar à mão', () => {
    it('autoavaliação é barrada', async () => {
      await expect(service.designar('c-a', 'c-a', RH)).rejects.toThrow(/própria avaliação/);
    });

    it('encerra a designação anterior em vez de sobrescrever', async () => {
      prisma.colaborador.findUnique.mockResolvedValue({ id: 'x', nome: 'X' });
      prisma.designacaoPadrao.findFirst.mockResolvedValue({ id: 'antiga', avaliadorId: 'c-velho', origem: 'CENTRO_CUSTO' });
      prisma.designacaoPadrao.create.mockResolvedValue({ id: 'nova' });

      await service.designar('c-chefe', 'c-a', RH);
      expect(prisma.designacaoPadrao.update).toHaveBeenCalledWith({
        where: { id: 'antiga' },
        data: { vigenciaFim: expect.any(Date) },
      });
      expect(prisma.designacaoPadrao.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ origem: 'MANUAL' }) }),
      );
    });
  });

  describe('remover', () => {
    it('encerra a vigência e nunca apaga', async () => {
      prisma.designacaoPadrao.findUnique.mockResolvedValue({
        id: 'd1', vigenciaFim: null, avaliadorId: 'a', avaliadoId: 'b', origem: 'MANUAL',
      });
      await service.remover('d1', RH);
      expect(prisma.designacaoPadrao.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { vigenciaFim: expect.any(Date) },
      });
      expect(prisma.designacaoPadrao.delete).not.toHaveBeenCalled();
    });

    it('remover o que já estava encerrado é recusado', async () => {
      prisma.designacaoPadrao.findUnique.mockResolvedValue({ id: 'd1', vigenciaFim: new Date() });
      await expect(service.remover('d1', RH)).rejects.toThrow(/já estava encerrada/);
    });
  });
});
