/**
 * ⭐⭐ ETAPA 4 — CONDUZIR, e a guarda do reabrir.
 *
 * ⛳ O PORTÃO: só o avaliador daquela avaliação marca; reabrir uma liberada
 * exige confirmação, limpa a liberação e **preserva** a conduzida; e o fato
 * sobrevive na auditoria.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DevolutivaService } from './devolutiva.service.js';

const EU = 'col-chefe';
const USUARIO = 'user-chefe';
const AV = 'aval-1';
const LIBERADA = new Date('2026-09-13T10:00:00Z');

describe('conduzir a devolutiva — declaração do avaliador', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: DevolutivaService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new DevolutivaService(prisma as never, auditoria as never, { memoria: jest.fn() } as never);
  });

  const cenario = (over: Record<string, unknown> = {}) =>
    prisma.avaliacao.findUnique.mockResolvedValue({
      id: AV,
      avaliadoId: 'col-subordinado',
      avaliadorId: EU,
      devolutivaLiberadaEm: LIBERADA,
      devolutivaConduzidaEm: null,
      ...over,
    });

  const marcar = (v: boolean) =>
    service.marcarConduzida(AV, v, { colaboradorId: EU, usuarioId: USUARIO });

  describe('⛳ quem pode marcar', () => {
    it('o avaliador daquela avaliação marca, e a auditoria registra', async () => {
      cenario();
      const r = await marcar(true);
      expect(r.conduzida).toBe(true);
      expect(prisma.avaliacao.update.mock.calls[0][0].data.devolutivaConduzidaEm).toBeInstanceOf(Date);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'DEVOLUTIVA_CONDUZIDA', entidadeId: AV }),
      );
    });

    it('⛔ OUTRO avaliador não marca', async () => {
      cenario({ avaliadorId: 'col-outro' });
      await expect(marcar(true)).rejects.toThrow(/não é sua/);
      expect(prisma.avaliacao.update).not.toHaveBeenCalled();
    });

    it('⛔ e a própria avaliação é barrada COM auditoria, na mesma ordem da leitura', async () => {
      // Não deveria acontecer — ninguém é designado para avaliar a si mesmo —
      // mas a garantia não pode depender disso.
      cenario({ avaliadoId: EU, avaliadorId: 'col-superior' });
      await expect(marcar(true)).rejects.toThrow(/sua própria avaliação/);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'ACESSO_NEGADO_PROPRIO_AVALIADO:conduzir' }),
      );
    });
  });

  describe('⛳ a ORDEM: não se conduz o que não foi liberado', () => {
    it('⛔ sem liberação, recusa — e a frase diz o que falta', async () => {
      cenario({ devolutivaLiberadaEm: null });
      await expect(marcar(true)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(marcar(true)).rejects.toThrow(/ainda não liberou/);
      // Senão o número do RH contaria conversas sobre notas que ninguém viu.
      expect(prisma.avaliacao.update).not.toHaveBeenCalled();
    });
  });

  describe('⭐ REVERSÍVEL, e sem trava de status de ciclo', () => {
    it('desmarcar limpa a data e audita o ato oposto', async () => {
      cenario({ devolutivaConduzidaEm: new Date('2026-09-14') });
      const r = await marcar(false);
      expect(r.conduzida).toBe(false);
      expect(prisma.avaliacao.update.mock.calls[0][0].data).toEqual({
        devolutivaConduzidaEm: null,
        devolutivaConduzidaPorId: null,
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'DEVOLUTIVA_DESMARCADA' }),
      );
    });

    /**
     * ⚠️ A trava intuitiva seria "enquanto o ciclo não fechar" — e ela tornaria
     * o desfazer IMPOSSÍVEL no caso normal: a devolutiva acontece com o ciclo
     * JÁ ENCERRADO (§3.1.157). O service nem consulta o status; este teste
     * existe para que acrescentar essa trava seja decisão consciente.
     */
    it('⭐⭐ o service NÃO consulta o status do ciclo — e isso é decisão', async () => {
      cenario({ devolutivaConduzidaEm: new Date('2026-09-14') });
      await marcar(false);
      expect(prisma.ciclo.findUnique).not.toHaveBeenCalled();
      expect(prisma.ciclo.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('marcar o que já vale não escreve nem audita', async () => {
      const quando = new Date('2026-09-14');
      cenario({ devolutivaConduzidaEm: quando });
      await expect(marcar(true)).resolves.toEqual({ conduzida: true, devolutivaConduzidaEm: quando });
      expect(prisma.avaliacao.update).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it('avaliação inexistente é 404', async () => {
      prisma.avaliacao.findUnique.mockResolvedValue(null);
      await expect(marcar(true)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('⭐⭐ conduzida ANTES da liberação atual = conversa sobre a nota anterior', () => {
    const memoria = { id: 'res-1', notaFinal: 70 };

    const paraLer = (conduzidaEm: Date | null, liberadaEm: Date) => {
      prisma.avaliacao.findUnique.mockResolvedValue({
        id: AV,
        avaliadoId: 'col-subordinado',
        avaliadorId: EU,
        devolutivaLiberadaEm: liberadaEm,
        devolutivaConduzidaEm: conduzidaEm,
      });
      prisma.resultadoAvaliacao.findUnique.mockResolvedValue({ id: 'res-1' });
      service = new DevolutivaService(
        prisma as never,
        auditoria as never,
        { memoria: jest.fn().mockResolvedValue(memoria) } as never,
      );
      return service.paraOAvaliador(AV, { colaboradorId: EU, usuarioId: USUARIO });
    };

    it('conduzida DEPOIS da liberação: a conversa vale', async () => {
      const r = await paraLer(new Date('2026-09-14'), LIBERADA);
      expect(r.conversaSobreNotaAnterior).toBe(false);
    });

    it('⭐ conduzida ANTES: reaberta e liberada de novo — a conversa é sobre a nota velha', async () => {
      // A marca de conduzida NÃO é apagada na reabertura (a conversa aconteceu;
      // apagar seria reescrever o passado). Guardar as DUAS datas é o que
      // responde isto sem coluna nova.
      const r = await paraLer(new Date('2026-09-12'), new Date('2026-09-15'));
      expect(r.conversaSobreNotaAnterior).toBe(true);
    });

    it('nunca conduzida: não há conversa anterior a sinalizar', async () => {
      const r = await paraLer(null, LIBERADA);
      expect(r.conversaSobreNotaAnterior).toBe(false);
      expect(r.devolutivaConduzidaEm).toBeNull();
    });
  });
});
