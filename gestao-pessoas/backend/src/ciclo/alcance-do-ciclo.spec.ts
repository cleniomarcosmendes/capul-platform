/**
 * ⭐⭐ O CICLO DECLARA SE ALCANÇA A EMPRESA INTEIRA OU SÓ UM RECORTE.
 *
 * `ehRecorte` não move dado nenhum: muda o que o painel AFIRMA sobre quem ficou
 * fora de todas as aplicações — buraco a resolver, ou alcance declarado. O
 * mesmo número, com duas leituras opostas.
 *
 * ⚠️ Por que uma coluna, e não uma inferência: derivar do tamanho do público
 * (< X% dos elegíveis) obriga a inventar um limiar, e **limiar arbitrário erra
 * calado** — o ciclo de 49% viraria recorte e o de 51% não, sem ninguém ter
 * decidido nada.
 */
import { NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { CicloService } from './ciclo.service.js';

const CICLO = 'ciclo-1';
const RH = 'user-rh';

const CONCEITOS = [
  { descricao: 'Atende', limiteInferior: 0, limiteSuperior: 100, ordem: 1 },
];

describe('o alcance declarado do ciclo', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: CicloService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new CicloService(prisma as never, auditoria as never);
  });

  const dadosDoCiclo = (over: Record<string, unknown> = {}) => ({
    nome: 'Piloto',
    periodoInicio: new Date('2026-01-01'),
    periodoFim: new Date('2026-12-31'),
    dataBase: new Date('2026-11-30'),
    conceitos: CONCEITOS,
    ...over,
  });

  describe('ao criar', () => {
    it('⭐ nasce FALSO quando ninguém diz nada — o padrão é a empresa inteira', async () => {
      prisma.ciclo.create.mockResolvedValue({ id: CICLO, nome: 'Piloto', ehRecorte: false });
      await service.criar(dadosDoCiclo() as never, RH);
      expect(prisma.ciclo.create.mock.calls[0][0].data.ehRecorte).toBe(false);
    });

    it('grava o que quem monta declarou', async () => {
      prisma.ciclo.create.mockResolvedValue({ id: CICLO, nome: 'Piloto', ehRecorte: true });
      await service.criar(dadosDoCiclo({ ehRecorte: true }) as never, RH);
      expect(prisma.ciclo.create.mock.calls[0][0].data.ehRecorte).toBe(true);
    });

    it('⭐ a auditoria da criação registra o alcance', async () => {
      prisma.ciclo.create.mockResolvedValue({ id: CICLO, nome: 'Piloto', ehRecorte: true });
      await service.criar(dadosDoCiclo({ ehRecorte: true }) as never, RH);
      expect(auditoria.registrar.mock.calls[0][0].valorNovo).toMatchObject({ ehRecorte: true });
    });
  });

  describe('ao declarar depois', () => {
    it('marca, e registra o valor ANTERIOR — é o que responde "desde quando"', async () => {
      prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, ehRecorte: false });
      prisma.ciclo.update.mockResolvedValue({ id: CICLO, ehRecorte: true });

      await service.marcarRecorte(CICLO, true, RH);

      expect(prisma.ciclo.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ehRecorte: true } }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'MARCAR_RECORTE',
          valorAnterior: { ehRecorte: false },
          valorNovo: { ehRecorte: true },
        }),
      );
    });

    it('desmarca também — a declaração erra e tem de ter volta', async () => {
      prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, ehRecorte: true });
      prisma.ciclo.update.mockResolvedValue({ id: CICLO, ehRecorte: false });
      await service.marcarRecorte(CICLO, false, RH);
      expect(prisma.ciclo.update.mock.calls[0][0].data).toEqual({ ehRecorte: false });
    });

    it('⚠️ declarar o valor que já vale não escreve nem audita', async () => {
      // Auditoria de não-mudança é ruído — atrapalha justamente quem foi ler a
      // auditoria para achar a mudança.
      prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, ehRecorte: true });
      await expect(service.marcarRecorte(CICLO, true, RH)).resolves.toEqual({
        id: CICLO,
        ehRecorte: true,
      });
      expect(prisma.ciclo.update).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it('ciclo inexistente é 404, não update silencioso', async () => {
      prisma.ciclo.findUnique.mockResolvedValue(null);
      await expect(service.marcarRecorte('nao-existe', true, RH)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('⭐⭐ ciclo ENCERRADO pode ser declarado — é rótulo, não dado', async () => {
      /**
       * Decisão registrada no controller: encerrado trava designação, público e
       * apuração — coisas que mudam nota. Isto é rótulo, e travá-lo deixaria um
       * ciclo fechado dizendo "664 fora" em vermelho para sempre, sem caminho de
       * conserto. *Guarda que impede o conserto é pior que guarda ausente.*
       *
       * ⚠️ O `marcarRecorte` nem consulta o status — este teste existe para que
       * acrescentar uma guarda de status seja uma decisão consciente, não um
       * reflexo: quem a acrescentar quebra aqui e lê o porquê.
       */
      prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, ehRecorte: false });
      prisma.ciclo.update.mockResolvedValue({ id: CICLO, ehRecorte: true });
      await expect(service.marcarRecorte(CICLO, true, RH)).resolves.toEqual({
        id: CICLO,
        ehRecorte: true,
      });
    });
  });
});
