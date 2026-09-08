/**
 * ⭐⭐ INVARIANTE — TODA PRÉVIA FECHA A CONTA.
 *
 * Uma prévia existe para dizer o que o botão vai fazer ANTES de ele fazer. Se
 * os baldes que ela publica não somam o total, existe um efeito sem nome: a
 * tela imprime os baldes, o botão age sobre as linhas, e os dois divergem sem
 * que nada acuse.
 *
 * Foi o que aconteceu com `designar/previa` em 08/09. `efeitoDeDesignar`
 * devolve CINCO ações e a prévia publicava QUATRO contadores —
 * `EXIGE_CONFIRMACAO` só aparecia derretido dentro da frase
 * `avisoDeRespondidas`. Trocar o avaliador de quem já respondeu devolvia
 * `criar: 0, substituir: 0, nadaAFazer: 0, recusar: 0, total: 1`: o resumo
 * dizia "0 ganham · 0 SUBSTITUÍDO" e o botão logo abaixo aplicava 1. O buraco
 * saía do servidor pronto — a tela não calculava nada.
 *
 * ⚠️ Este arquivo cobra a SOMA, não os valores. Um balde novo (uma sexta ação)
 * que ninguém publique quebra estes testes por construção, que é o ponto: a
 * revisão caso a caso é justamente o que falhou aqui, porque a quinta ação
 * existia desde que `EXIGE_CONFIRMACAO` foi criada e ninguém notou a falta.
 *
 * A prévia do público já fechava a conta e entra aqui como caso que PASSA —
 * para não regredir, e para deixar escrito qual é o padrão da casa.
 */
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DesignacaoService } from './designacao.service.js';
import { AplicacaoService } from '../aplicacao/aplicacao.service.js';

const APP = 'app-1';
const CICLO = 'ciclo-1';
const NOVO = 'av-novo';

describe('invariante: designar/previa — os baldes somam o total', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: DesignacaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new DesignacaoService(prisma as never, { registrar: jest.fn() } as never);
    prisma.aplicacao.findUnique.mockResolvedValue({ id: APP, cicloId: CICLO });
    prisma.colaborador.findUnique.mockResolvedValue({ nome: 'NOVO AVALIADOR' });
  });

  /**
   * Monta a prévia para um conjunto de avaliados, cada um com (ou sem) a
   * avaliação que ele já tem no ciclo.
   */
  const previaCom = (
    casos: {
      id: string;
      nome: string;
      atual?: { avaliadorId: string; status: string; respostas: number; aplicacaoId?: string };
    }[],
  ) => {
    prisma.colaborador.findMany
      // 1ª chamada: os avaliados.
      .mockResolvedValueOnce(casos.map((c) => ({ id: c.id, nome: c.nome, matricula: c.id })))
      // 2ª chamada: os nomes dos avaliadores que eles já têm.
      .mockResolvedValueOnce([
        { id: 'av-antigo', nome: 'AVALIADOR ANTIGO' },
        { id: NOVO, nome: 'NOVO AVALIADOR' },
      ]);
    prisma.avaliacao.findMany.mockResolvedValue(
      casos
        .filter((c) => c.atual)
        .map((c) => ({
          avaliadoId: c.id,
          avaliadorId: c.atual!.avaliadorId,
          aplicacaoId: c.atual!.aplicacaoId ?? APP,
          status: c.atual!.status,
          _count: { respostas: c.atual!.respostas },
        })),
    );
    return service.previaDaDesignacao(
      APP,
      casos.map((c) => c.id),
      NOVO,
    );
  };

  /** ⭐ A invariante, em uma função — os testes abaixo só variam o cenário. */
  const fechaAConta = (p: Awaited<ReturnType<typeof previaCom>>) => {
    expect(p.criar + p.substituir + p.nadaAFazer + p.recusar + p.exigeConfirmacao).toBe(p.total);
    expect(p.total).toBe(p.linhas.length);
  };

  /**
   * ⭐⭐ O CASO QUE ESTAVA QUEBRADO. Uma linha só, já ENVIADA, trocando de
   * avaliador: antes devolvia quatro zeros e `total: 1`.
   */
  it('EXIGE_CONFIRMACAO tem balde próprio — quatro zeros e total 1 era o defeito', async () => {
    const p = await previaCom([
      { id: 'c1', nome: 'ANA', atual: { avaliadorId: 'av-antigo', status: 'ENVIADA', respostas: 10 } },
    ]);

    expect(p.exigeConfirmacao).toBe(1);
    expect(p.total).toBe(1);
    fechaAConta(p);
  });

  /**
   * ⚠️ E NÃO somado dentro de `substituir`: é a distinção de que o bloco
   * vermelho e a flag `confirmar` dependem. Dobrar o número apagaria a
   * diferença entre "troca comum" e "troca sobre julgamento de outro".
   */
  it('não dobra dentro de substituir — as duas trocas continuam distintas', async () => {
    const p = await previaCom([
      { id: 'c1', nome: 'ANA', atual: { avaliadorId: 'av-antigo', status: 'ENVIADA', respostas: 10 } },
      { id: 'c2', nome: 'BRUNO', atual: { avaliadorId: 'av-antigo', status: 'PENDENTE', respostas: 0 } },
    ]);

    expect(p.exigeConfirmacao).toBe(1);
    expect(p.substituir).toBe(1);
    fechaAConta(p);
  });

  it('fecha a conta com as CINCO ações no mesmo lote', async () => {
    const p = await previaCom([
      { id: 'c1', nome: 'ANA' }, // CRIAR
      { id: 'c2', nome: 'BRUNO', atual: { avaliadorId: 'av-antigo', status: 'PENDENTE', respostas: 0 } }, // SUBSTITUIR
      { id: 'c3', nome: 'CARLA', atual: { avaliadorId: NOVO, status: 'PENDENTE', respostas: 0 } }, // NADA_A_FAZER
      { id: 'c4', nome: 'DINO', atual: { avaliadorId: 'av-antigo', status: 'ENVIADA', respostas: 3 } }, // EXIGE_CONFIRMACAO
      { id: 'c5', nome: 'ELIS', atual: { avaliadorId: 'av-antigo', status: 'CANCELADA', respostas: 0 } }, // RECUSAR
    ]);

    expect(p).toMatchObject({
      total: 5, criar: 1, substituir: 1, nadaAFazer: 1, exigeConfirmacao: 1, recusar: 1,
    });
    fechaAConta(p);
  });

  it('fecha a conta também quando não há nada a fazer', async () => {
    fechaAConta(await previaCom([]));
  });
});

/**
 * ⭐ O CASO QUE JÁ PASSAVA — o padrão da casa, agora escrito.
 *
 * A prévia do público publica DUAS contas encadeadas, e as duas fecham:
 *   encontradas = adicionar + jaNesta + emOutraAplicacao
 *   adicionar   = geramAvaliacao + barradosPelaRegua
 * A segunda existe porque entrar no público e gerar avaliação são coisas
 * diferentes — e é por isso que ela não pode ser um número só.
 */
describe('invariante: publico/previa — as duas contas encadeadas fecham', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AplicacaoService;

  const alvoCC = {
    origem: 'CENTRO_CUSTO' as const,
    referencia: '02|21010101',
    centrosCusto: [{ filial: '02', centroCusto: '21010101' }],
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AplicacaoService(prisma as never, { registrar: jest.fn() } as never);
    prisma.aplicacao.findUnique.mockResolvedValue({
      id: APP, nome: 'Operação de Loja', cicloId: CICLO, ciclo: { incluirAfastados: false },
    });
  });

  it('fecha as duas contas com gente barrada pela régua E gente em outra aplicação', async () => {
    prisma.colaborador.findMany.mockResolvedValue([
      { id: 'c1', nome: 'ANA', matricula: '001', filial: '02', centroCusto: '21010101', situacao: 'ATIVO' },
      { id: 'c2', nome: 'BRUNO', matricula: '002', filial: '02', centroCusto: '21010101', situacao: 'ATIVO' },
      // Barrada pela régua: entra no público e NÃO gera avaliação.
      { id: 'c3', nome: 'CARLA', matricula: '003', filial: '02', centroCusto: '21010101', situacao: 'AFASTADO' },
      // Já está em outra aplicação do ciclo: nem entra.
      { id: 'c4', nome: 'DINO', matricula: '004', filial: '02', centroCusto: '21010101', situacao: 'ATIVO' },
    ]);
    prisma.aplicacaoPublico.findMany.mockResolvedValue([
      { colaboradorId: 'c4', aplicacaoId: 'app-aprendizes', aplicacao: { nome: 'Aprendizes' } },
    ]);

    const p = await service.previaDoPublico(APP, alvoCC);

    expect(p.encontradas).toBe(p.adicionar + p.jaNesta + p.emOutraAplicacao.length);
    expect(p.adicionar).toBe(p.geramAvaliacao + p.barradosPelaRegua.length);
    expect(p).toMatchObject({ encontradas: 4, adicionar: 3, geramAvaliacao: 2 });
  });
});
