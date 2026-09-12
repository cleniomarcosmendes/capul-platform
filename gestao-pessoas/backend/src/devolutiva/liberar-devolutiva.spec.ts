/**
 * ⭐⭐ ETAPA 1 DA DEVOLUTIVA — o ato de LIBERAR.
 *
 * ⛳ O PORTÃO desta etapa é uma CONTA, não uma revisão:
 *
 *     liberadas + não liberadas = apuradas
 *
 * É a contramedida que o módulo já provou funcionar: *conta que não bate detecta
 * furo de guarda melhor que ler código* (§3.1.79). Se um dia a liberação passar
 * a pegar avaliação sem resultado, ou a deixar alguém fora em silêncio, os dois
 * lados param de bater aqui.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DevolutivaService } from './devolutiva.service.js';

const CICLO = 'ciclo-1';
const RH = 'user-rh';
/** O colaborador da pessoa logada no RH — ela também é avaliada. */
const EU = 'col-arielly';

/** Uma avaliação ENVIADA. `com` = tem resultado apurado. */
const av = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  avaliadoId: `avaliado-${id}`,
  avaliadorId: `avaliador-${id}`,
  cicloId: CICLO,
  status: 'ENVIADA',
  devolutivaLiberadaEm: null,
  ...over,
});

describe('liberar a devolutiva', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  /** A memória é do `ResultadoService` — aqui só se prova que NÃO é chamada. */
  let resultados: { memoria: jest.Mock };
  let service: DevolutivaService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    resultados = { memoria: jest.fn() };
    service = new DevolutivaService(prisma as never, auditoria as never, resultados as never);
    prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, nome: 'ENSAIO', status: 'ABERTO' });
    prisma.colaborador.findMany.mockResolvedValue([]);
  });

  /** Monta o cenário da prévia: avaliações + quais têm resultado. */
  const cenario = (avaliacoes: ReturnType<typeof av>[], comResultado: string[]) => {
    prisma.avaliacao.findMany.mockResolvedValue(avaliacoes);
    prisma.resultadoAvaliacao.findMany.mockResolvedValue(
      comResultado.map((id) => ({ avaliacaoId: id, notaFinal: 69.9, conceitoDescricao: 'Atende' })),
    );
  };

  describe('⛳ O PORTÃO — a conta fecha', () => {
    it('liberadas + não liberadas = apuradas', async () => {
      cenario(
        [
          av('a'), // apurada, a liberar
          av('b'), // apurada, a liberar
          av('c', { devolutivaLiberadaEm: new Date('2026-09-13') }), // já liberada
          av('d'), // SEM resultado
        ],
        ['a', 'b', 'c'],
      );

      const { conta } = await service.previaDaLiberacao({ cicloId: CICLO }, null);

      expect(conta.liberadas + conta.naoLiberadas).toBe(conta.apuradas);
      expect(conta).toEqual({
        enviadas: 4,
        apuradas: 3,
        liberadas: 1,
        naoLiberadas: 2,
        naoApuradas: 1,
        conduzidasDeclaradas: 0,
      });
    });

    it('⚠️ `naoApuradas` fica FORA da conta — não é parte do mesmo todo', async () => {
      // §3.1.109: dois números verdadeiros precisam do termo que os concilia.
      // Somar as não apuradas ao total de apuradas daria 4 onde há 3.
      cenario([av('a'), av('d')], ['a']);
      const { conta } = await service.previaDaLiberacao({ cicloId: CICLO }, null);
      expect(conta.apuradas).toBe(1);
      expect(conta.enviadas).toBe(conta.apuradas + conta.naoApuradas);
    });

    it('⭐ conta as CONDUZIDAS — e o nome do campo carrega que é declaração', async () => {
      // "conversas realizadas" faria o numero afirmar o que o sistema nao sabe:
      // o avaliador marca, e pode marcar sem ter conversado.
      cenario(
        [av('a', { devolutivaLiberadaEm: new Date(), devolutivaConduzidaEm: new Date() }), av('b')],
        ['a', 'b'],
      );
      const { conta } = await service.previaDaLiberacao({ cicloId: CICLO }, null);
      expect(conta.conduzidasDeclaradas).toBe(1);
    });

    it('a conta fecha também quando não há nada a liberar', async () => {
      cenario([av('c', { devolutivaLiberadaEm: new Date() })], ['c']);
      const { conta } = await service.previaDaLiberacao({ cicloId: CICLO }, null);
      expect(conta.liberadas + conta.naoLiberadas).toBe(conta.apuradas);
      expect(conta.naoLiberadas).toBe(0);
    });
  });

  describe('a prévia separa os três conjuntos', () => {
    it('cada avaliação cai em exatamente um deles', async () => {
      cenario([av('a'), av('c', { devolutivaLiberadaEm: new Date() }), av('d')], ['a', 'c']);
      const p = await service.previaDaLiberacao({ cicloId: CICLO }, null);
      expect(p.liberaveis.map((l) => l.avaliacaoId)).toEqual(['a']);
      expect(p.jaLiberadas.map((l) => l.avaliacaoId)).toEqual(['c']);
      expect(p.naoApuradas.map((l) => l.avaliacaoId)).toEqual(['d']);
      expect(p.minhas).toEqual([]);
    });

    it('⭐ a própria avaliação aparece MARCADA e fora do lote, nunca filtrada', async () => {
      // Filtrar em silêncio faria o total não fechar, e o RH procuraria alguém
      // que sumiu da lista.
      cenario([av('a'), av('minha', { avaliadoId: EU })], ['a', 'minha']);
      const p = await service.previaDaLiberacao({ cicloId: CICLO }, EU);

      expect(p.liberaveis.map((l) => l.avaliacaoId)).toEqual(['a']);
      expect(p.minhas.map((l) => l.avaliacaoId)).toEqual(['minha']);
      expect(p.minhas[0].ehMinha).toBe(true);
      // E continua dentro da conta: 1 liberável + 1 minha = 2 não liberadas.
      expect(p.conta.naoLiberadas).toBe(2);
      expect(p.conta.liberadas + p.conta.naoLiberadas).toBe(p.conta.apuradas);
    });

    it('ciclo inexistente é 404', async () => {
      prisma.ciclo.findUnique.mockResolvedValue(null);
      await expect(service.previaDaLiberacao({ cicloId: 'x' }, null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('o ato grava os IDS que a prévia mostrou', () => {
    const paraLiberar = (avaliacoes: ReturnType<typeof av>[], comResultado: string[]) => {
      prisma.avaliacao.findMany.mockResolvedValue(avaliacoes);
      prisma.resultadoAvaliacao.findMany.mockResolvedValue(
        comResultado.map((id) => ({ avaliacaoId: id })),
      );
    };

    it('grava exatamente os recebidos, e audita UMA linha por avaliação', async () => {
      paraLiberar([av('a'), av('b')], ['a', 'b']);
      const r = await service.liberar(['a', 'b'], { colaboradorId: EU, usuarioId: RH });

      expect(r).toEqual({ liberadas: 2, jaEstavam: 0, recebidas: 2 });
      expect(prisma.avaliacao.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['a', 'b'] } } }),
      );
      // ⭐ Uma por avaliação: "42 liberadas" numa linha só não responde
      // "quando a devolutiva DESTA pessoa foi liberada?".
      expect(auditoria.registrar).toHaveBeenCalledTimes(2);
      expect(auditoria.registrar.mock.calls[0][0]).toMatchObject({
        entidade: 'Avaliacao',
        entidadeId: 'a',
        acao: 'LIBERAR_DEVOLUTIVA',
      });
    });

    it('já liberada não é erro: fica de fora da escrita e aparece na resposta', async () => {
      paraLiberar([av('a'), av('c', { devolutivaLiberadaEm: new Date() })], ['a', 'c']);
      const r = await service.liberar(['a', 'c'], { colaboradorId: EU, usuarioId: RH });
      expect(r).toEqual({ liberadas: 1, jaEstavam: 1, recebidas: 2 });
      expect(prisma.avaliacao.updateMany.mock.calls[0][0].where).toEqual({ id: { in: ['a'] } });
    });

    it('⚠️ id que não existe DERRUBA o lote — não grava o resto em silêncio', async () => {
      // Gravar 1 de 2 faria a tela dizer "liberada 1" sobre um clique de 2, e
      // ninguém procuraria a que faltou.
      paraLiberar([av('a')], ['a']);
      await expect(
        service.liberar(['a', 'sumiu'], { colaboradorId: EU, usuarioId: RH }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.avaliacao.updateMany).not.toHaveBeenCalled();
    });

    it('⛔ a própria avaliação no lote derruba o lote inteiro', async () => {
      paraLiberar([av('a'), av('minha', { avaliadoId: EU })], ['a', 'minha']);
      await expect(
        service.liberar(['a', 'minha'], { colaboradorId: EU, usuarioId: RH }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.avaliacao.updateMany).not.toHaveBeenCalled();
    });

    it('⛔ avaliação sem apuração não tem nota para mostrar — recusa dizendo quantas', async () => {
      paraLiberar([av('a'), av('d')], ['a']);
      await expect(
        service.liberar(['a', 'd'], { colaboradorId: EU, usuarioId: RH }),
        // ⚠️ Cobra o NÚMERO, não a redação inteira: o texto foi reescrito em
        //    13/09 para não flexionar com 1, e um spec preso à frase teria de
        //    ser reescrito junto — vira ruído em vez de guarda.
      ).rejects.toThrow(/Sem apuração: 1 · selecionadas: 2/);
      expect(prisma.avaliacao.updateMany).not.toHaveBeenCalled();
    });

    it('lista vazia é recusa, não sucesso silencioso', async () => {
      await expect(service.liberar([], { colaboradorId: EU, usuarioId: RH })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('⚠️ id repetido conta uma vez só — clique duplo não vira duas auditorias', async () => {
      paraLiberar([av('a')], ['a']);
      const r = await service.liberar(['a', 'a'], { colaboradorId: EU, usuarioId: RH });
      expect(r.recebidas).toBe(1);
      expect(auditoria.registrar).toHaveBeenCalledTimes(1);
    });
  });
});
