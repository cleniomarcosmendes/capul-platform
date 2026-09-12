/**
 * ⭐⭐ REABRIR UMA AVALIAÇÃO CUJA DEVOLUTIVA JÁ FOI LIBERADA.
 *
 * ⛔ **Não bloqueia, e isso é o ponto.** A razão de reabrir costuma ser
 * justamente que a nota estava errada — e o caso mais grave é o de alguém que
 * **já viu** um número errado. Guarda que impede o conserto é pior que guarda
 * ausente. Então: recusa UMA vez com o dado, e passa com a confirmação.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { AvaliacaoService } from './avaliacao.service.js';

const AV = 'aval-1';
const RH = { colaboradorId: 'col-rh', usuarioId: 'user-rh' };
const LIBERADA = new Date('2026-09-13T10:00:00Z');
const CONDUZIDA = new Date('2026-09-14T15:00:00Z');

describe('reabrir com a devolutiva já liberada', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: AvaliacaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new AvaliacaoService(
      prisma as never,
      { carregarParaAcao: jest.fn().mockResolvedValue({ id: AV, cicloId: 'c1' }) } as never,
      auditoria as never,
    );
    prisma.ciclo.findUniqueOrThrow.mockResolvedValue({ status: 'ABERTO', encerradoEm: null });
    prisma.resultadoAvaliacao.findUnique.mockResolvedValue(null);
  });

  const marcas = (liberada: Date | null, conduzida: Date | null = null) =>
    prisma.avaliacao.findUniqueOrThrow.mockResolvedValue({
      devolutivaLiberadaEm: liberada,
      devolutivaConduzidaEm: conduzida,
    });

  const reabrir = (confirmar = false) =>
    service.reabrir(RH as never, AV, 'corrigir a nota que saiu errada', confirmar);

  it('⛳ sem confirmação, RECUSA — e diz DESDE QUANDO está liberada', async () => {
    marcas(LIBERADA);
    await expect(reabrir()).rejects.toBeInstanceOf(BadRequestException);
    await expect(reabrir()).rejects.toThrow(/já foi liberada/);
    await expect(reabrir()).rejects.toThrow(/13\/09\/2026/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('⭐ e diz TAMBÉM se o avaliador declarou ter conversado — muda a decisão', async () => {
    marcas(LIBERADA, CONDUZIDA);
    await expect(reabrir()).rejects.toThrow(/já declarou ter conversado/);
  });

  it('⭐ a recusa ENSINA a consequência: apurar, liberar e conversar de novo', async () => {
    marcas(LIBERADA);
    await expect(reabrir()).rejects.toThrow(/apurar, liberar e conversar de novo/);
  });

  it('⛳ com confirmação PASSA — a guarda não impede o conserto', async () => {
    marcas(LIBERADA, CONDUZIDA);
    await reabrir(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('sem devolutiva liberada, nada muda: reabre sem pedir confirmação', async () => {
    marcas(null);
    await reabrir();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  describe('⛳ o que a reabertura faz com as duas marcas', () => {
    /** O `data` do update dentro da transação. */
    const dataDoUpdate = () => prisma.avaliacao.update.mock.calls[0][0].data;

    it('LIMPA a liberação — a nota nova não está liberada, e é correto que não esteja', async () => {
      marcas(LIBERADA, CONDUZIDA);
      await reabrir(true);
      expect(dataDoUpdate()).toMatchObject({
        devolutivaLiberadaEm: null,
        devolutivaLiberadaPorId: null,
      });
    });

    it('⭐⭐ NÃO limpa a conduzida — a conversa aconteceu, e apagar seria reescrever o passado', async () => {
      marcas(LIBERADA, CONDUZIDA);
      await reabrir(true);
      expect(dataDoUpdate()).not.toHaveProperty('devolutivaConduzidaEm');
      expect(dataDoUpdate()).not.toHaveProperty('devolutivaConduzidaPorId');
    });

    it('⭐ e o FATO sobrevive na auditoria, estruturado — não no texto do motivo', async () => {
      // A coluna acabou de ser limpa; é esta linha que responde depois
      // "ela viu o 72 antes de virar 68?". Estruturado porque quem procurar
      // vai filtrar, não ler.
      marcas(LIBERADA, CONDUZIDA);
      prisma.resultadoAvaliacao.findUnique.mockResolvedValue({ id: 'r1' });
      await reabrir(true);
      const evento = auditoria.registrar.mock.calls.find((c) => c[0].acao === 'REABRIR')?.[0];
      expect(evento.valorAnterior).toMatchObject({
        devolutivaLiberadaEm: LIBERADA,
        devolutivaConduzidaEm: CONDUZIDA,
      });
      expect(evento.justificativa).toBe('corrigir a nota que saiu errada');
    });
  });
});
