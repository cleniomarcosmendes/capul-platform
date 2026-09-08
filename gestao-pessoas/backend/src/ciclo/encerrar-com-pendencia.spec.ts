/**
 * ⭐⭐ ENCERRAR COM PENDÊNCIA — a saída para o que não vai entrar (08/09).
 *
 * Exigir 100% enviado sem exceção trancava o ciclo para sempre no dia em que
 * alguém saísse da empresa: a avaliação ficava PENDENTE, ninguém podia
 * respondê-la, e o `encerrar` continuava contando-a. Piloto (891) e Geral (5)
 * estavam nesse estado. O desenho é o do RDV da Logística: a API recusa e diz
 * quantas; só encerra com confirmação e motivo; as pendentes viram CANCELADA
 * com o motivo escrito, e nada é apagado.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { CicloService } from './ciclo.service.js';

const CICLO = 'ciclo-1';
const RH = 'user-rh';

describe('CicloService.encerrar', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: CicloService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new CicloService(prisma as never, auditoria as never);
    prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, nome: 'Piloto', status: 'ABERTO' });
    prisma.ciclo.update.mockResolvedValue({ id: CICLO, status: 'ENCERRADO' });
  });

  const pendentes = (n: number) => prisma.avaliacao.count.mockResolvedValue(n);

  describe('sem pendência, nada muda', () => {
    it('encerra e não cancela nada', async () => {
      pendentes(0);
      const r = await service.encerrar(CICLO, RH);
      expect(r.avaliacoesCanceladas).toBe(0);
      expect(prisma.avaliacao.updateMany).not.toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'ENCERRAR' }));
    });
  });

  describe('com pendência e SEM confirmação', () => {
    it('recusa — e diz QUANTAS são', async () => {
      pendentes(891);
      await expect(service.encerrar(CICLO, RH)).rejects.toThrow(BadRequestException);
      await expect(service.encerrar(CICLO, RH)).rejects.toThrow(/891 avaliação/);
    });

    /**
     * ⭐ Recusa sem alternativa manda a pessoa procurar sozinha um caminho — e o
     * que ela acha é criar outro ciclo, que duplica resultado sem ninguém
     * decidir. Mesma regra da recusa do ciclo encerrado.
     */
    it('e a recusa DIZ A SAÍDA, não só que não pode', async () => {
      pendentes(891);
      await expect(service.encerrar(CICLO, RH)).rejects.toThrow(/encerre com pendência/);
      await expect(service.encerrar(CICLO, RH)).rejects.toThrow(/motivo/);
      await expect(service.encerrar(CICLO, RH)).rejects.toThrow(/nada é apagado/i);
    });

    /** ⚠️ Achado da bateria ao vivo de 08/09: com UMA pendência a frase dizia
     *  "e as 1 ficam registradas". O número já está no começo da mensagem. */
    it('a frase não quebra a concordância com pendência única', async () => {
      pendentes(1);
      await expect(service.encerrar(CICLO, RH)).rejects.toThrow(/1 avaliação/);
      await expect(service.encerrar(CICLO, RH)).rejects.not.toThrow(/as 1 ficam/);
    });

    it('nada é escrito quando recusa', async () => {
      pendentes(5);
      await expect(service.encerrar(CICLO, RH)).rejects.toThrow();
      expect(prisma.ciclo.update).not.toHaveBeenCalled();
      expect(prisma.avaliacao.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('com pendência e COM confirmação', () => {
    it('sem motivo, ainda recusa — o override não pode ser mudo', async () => {
      pendentes(5);
      await expect(service.encerrar(CICLO, RH, { confirmarPendentes: true })).rejects.toThrow(
        /Informe o motivo/,
      );
      await expect(
        service.encerrar(CICLO, RH, { confirmarPendentes: true, motivo: '  ' }),
      ).rejects.toThrow(/Informe o motivo/);
      expect(prisma.ciclo.update).not.toHaveBeenCalled();
    });

    it('cancela as pendentes e encerra, devolvendo o número', async () => {
      pendentes(5);
      const r = await service.encerrar(CICLO, RH, {
        confirmarPendentes: true,
        motivo: 'Desligados e afastados de longa duração',
      });
      expect(r.avaliacoesCanceladas).toBe(5);
      expect(prisma.avaliacao.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cicloId: CICLO, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
        }),
      );
    });

    /** ⭐ O motivo vai gravado em CADA avaliação, não só no ciclo: é o que
     *  responde, meses depois, por que aquela pessoa ficou sem nota. */
    it('o motivo escrito vai para dentro de cada avaliação cancelada', async () => {
      pendentes(5);
      await service.encerrar(CICLO, RH, { confirmarPendentes: true, motivo: 'Piloto encerrado' });
      const dados = prisma.avaliacao.updateMany.mock.calls[0][0].data;
      expect(dados.status).toBe('CANCELADA');
      expect(dados.canceladaPorId).toBe(RH);
      expect(dados.motivoCancelamento).toContain('Piloto encerrado');
      expect(dados.canceladaEm).toBeInstanceOf(Date);
    });

    /** ⚠️ "ENCERRAR" e "encerrar cancelando 891 avaliações" não podem ter o
     *  mesmo nome na auditoria — quem lê depois não distinguiria os dois. */
    it('a auditoria distingue o override, com o número e o motivo', async () => {
      pendentes(891);
      // ⚠️ 15+ caracteres: o mínimo do ato em massa subiu em 09/09 (`xpt` passava).
      await service.encerrar(CICLO, RH, { confirmarPendentes: true, motivo: 'Fim do piloto de 2026' });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'ENCERRAR_COM_PENDENCIA',
          valorNovo: { canceladas: 891, motivo: 'Fim do piloto de 2026' },
        }),
      );
    });

    /**
     * ⭐⭐ O MÍNIMO DO MOTIVO ACOMPANHA O ALCANCE DO ATO (09/09).
     *
     * Era 3 — `"xpt"` passava, e a regra existia só para o formulário poder
     * travar. Esta frase é a ÚNICA explicação que vai sobrar para dezenas de
     * pessoas ("por que estas 37 ficaram sem nota?"), e quem a lê meses depois
     * não estava na sala. 15 força uma oração em vez de um token.
     */
    it('⭐ motivo curto demais recusa — e a recusa diz quantos faltam', async () => {
      pendentes(37);
      await expect(
        service.encerrar(CICLO, RH, { confirmarPendentes: true, motivo: 'xpt' }),
      ).rejects.toThrow(/pelo menos 15 caracteres — faltam 12/);
    });

    it('uma frase curta e legítima passa — o mínimo não pode inviabilizar', async () => {
      pendentes(37);
      await service.encerrar(CICLO, RH, { confirmarPendentes: true, motivo: 'Pessoa desligada' });
      expect(prisma.avaliacao.updateMany).toHaveBeenCalled();
    });

    /** Confirmar sem haver pendência não inventa cancelamento nenhum. */
    it('confirmação sem pendência não cancela nada e volta a ser ENCERRAR', async () => {
      pendentes(0);
      await service.encerrar(CICLO, RH, { confirmarPendentes: true, motivo: 'por via das dúvidas' });
      expect(prisma.avaliacao.updateMany).not.toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'ENCERRAR' }));
    });
  });

  it('ciclo já encerrado continua recusando, com o caminho do reabrir', async () => {
    prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, status: 'ENCERRADO' });
    await expect(service.encerrar(CICLO, RH, { confirmarPendentes: true, motivo: 'x' })).rejects.toThrow(
      /reabra o ciclo/i,
    );
  });
});
