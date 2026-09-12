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
 *   encontradas = entramNoPublico + jaNesta + emOutraAplicacao
 *   entramNoPublico = geramAvaliacao + barradosPelaRegua
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
    service = new AplicacaoService(prisma as never, { registrar: jest.fn() } as never,
      // A régua do cartão — não exercitada por estas specs, que testam
      // o público e a prévia, não a conciliação.
      { listar: jest.fn().mockResolvedValue([]) } as never);
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

    expect(p.encontradas).toBe(p.entramNoPublico + p.jaNesta + p.emOutraAplicacao.length);
    expect(p.entramNoPublico).toBe(p.geramAvaliacao + p.barradosPelaRegua.length);
    expect(p).toMatchObject({ encontradas: 4, entramNoPublico: 3, geramAvaliacao: 2 });
  });
});

/**
 * ⭐⭐ INVARIANTE — A PRÉVIA NUNCA PROMETE O QUE O ATO RECUSA.
 *
 * A prévia e `designar()` compartilhavam o classificador, e mesmo assim
 * divergiam: `designar()` rodava **mais duas guardas** que ele não conhecia — a
 * autoavaliação, inline antes; a troca de aplicação, em
 * `assertPodeTrocarDeAplicacao`, depois. A prévia não chamava nenhuma das duas.
 * Medido no Piloto em 08/09: prévia `{substituir: 1, recusar: 0}`, ato
 * *"Ninguém pode ser o avaliador da própria avaliação."*
 *
 * Isso é pior que contador errado: é a **tela autorizando o que a API vai
 * negar** — o botão fica armado, a pessoa clica e leva um erro que a prévia
 * tinha acabado de dizer que não viria.
 *
 * ⚠️ Este arquivo NÃO testa mensagens: testa que **os dois lados decidem
 * igual**. Uma guarda nova que alguém acrescente só ao ato — que é exatamente
 * como as duas anteriores nasceram — quebra estes casos, mesmo que ninguém se
 * lembre de vir aqui. É o par do teste de invariante da §5.9: a revisão caso a
 * caso é o que já falhou duas vezes.
 */
describe('invariante: prévia RECUSAR ⟺ designar recusa', () => {
  const AVALIADO = 'c-avaliado';
  const AVALIADOR = 'c-avaliador';
  const OUTRA_APP = 'app-origem';

  /** Os cenários que percorrem as cinco ações, incluindo as duas guardas. */
  const CENARIOS: {
    nome: string;
    avaliadorId: string;
    atual: { avaliadorId: string; status: string; respostas: number; aplicacaoId: string } | null;
    recusa: boolean;
  }[] = [
    { nome: 'primeira designação', avaliadorId: AVALIADOR, atual: null, recusa: false },
    {
      nome: 'troca comum de avaliador',
      avaliadorId: AVALIADOR,
      atual: { avaliadorId: 'c-outro', status: 'PENDENTE', respostas: 0, aplicacaoId: APP },
      recusa: false,
    },
    {
      nome: '⭐ autoavaliação sem avaliação (a prévia dizia CRIAR)',
      avaliadorId: AVALIADO,
      atual: null,
      recusa: true,
    },
    {
      nome: '⭐ autoavaliação com avaliação (a prévia dizia SUBSTITUIR)',
      avaliadorId: AVALIADO,
      atual: { avaliadorId: 'c-outro', status: 'PENDENTE', respostas: 0, aplicacaoId: APP },
      recusa: true,
    },
    {
      nome: '⭐ troca de aplicação de avaliação ENVIADA',
      avaliadorId: AVALIADOR,
      atual: { avaliadorId: 'c-outro', status: 'ENVIADA', respostas: 0, aplicacaoId: OUTRA_APP },
      recusa: true,
    },
    {
      nome: '⭐ troca de aplicação com respostas gravadas',
      avaliadorId: AVALIADOR,
      atual: { avaliadorId: 'c-outro', status: 'EM_ANDAMENTO', respostas: 4, aplicacaoId: OUTRA_APP },
      recusa: true,
    },
    {
      nome: 'troca de aplicação limpa',
      avaliadorId: AVALIADOR,
      atual: { avaliadorId: 'c-outro', status: 'PENDENTE', respostas: 0, aplicacaoId: OUTRA_APP },
      recusa: false,
    },
    {
      nome: 'avaliação CANCELADA',
      avaliadorId: AVALIADOR,
      atual: { avaliadorId: 'c-outro', status: 'CANCELADA', respostas: 0, aplicacaoId: APP },
      recusa: true,
    },
  ];

  const montar = (cenario: (typeof CENARIOS)[number]) => {
    const prisma = createPrismaMock();
    const service = new DesignacaoService(prisma as never, {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as never);

    prisma.aplicacao.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === APP
          ? { id: APP, nome: 'Operação de Loja', cicloId: CICLO, ciclo: { status: 'ABERTO', encerradoEm: null } }
          : { id: OUTRA_APP, nome: 'Aprendizes', cicloId: CICLO, ciclo: { status: 'ABERTO', encerradoEm: null } },
      ),
    );
    prisma.aplicacao.findMany.mockResolvedValue([{ id: OUTRA_APP, nome: 'Aprendizes' }]);
    prisma.colaborador.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, nome: where.id === AVALIADO ? 'JOAO' : 'MARIA', filial: '02', centroCusto: '21010101', cargoDescricao: 'REPOSITOR' }),
    );
    prisma.colaborador.findMany.mockResolvedValue([
      { id: AVALIADO, nome: 'JOAO', matricula: '001' },
    ]);
    prisma.avaliacao.upsert.mockResolvedValue({ id: 'aval-1' });

    const linha = cenario.atual && {
      id: 'aval-1',
      avaliadoId: AVALIADO,
      avaliadorId: cenario.atual.avaliadorId,
      aplicacaoId: cenario.atual.aplicacaoId,
      status: cenario.atual.status,
      _count: { respostas: cenario.atual.respostas },
    };
    prisma.avaliacao.findUnique.mockResolvedValue(linha);
    prisma.avaliacao.findMany.mockResolvedValue(linha ? [linha] : []);
    prisma.resposta.count.mockResolvedValue(cenario.atual?.respostas ?? 0);
    return service;
  };

  it.each(CENARIOS)('$nome', async (cenario) => {
    const service = montar(cenario);

    const previa = await service.previaDaDesignacao(APP, [AVALIADO], cenario.avaliadorId);
    const previaRecusa = previa.linhas[0].acao === 'RECUSAR';

    let atoRecusou = false;
    let mensagemDoAto: string | null = null;
    try {
      // `true` de propósito: confirmação levanta o EXIGE_CONFIRMACAO e NÃO
      // levanta recusa — se levantasse, a prévia estaria certa e o ato frouxo.
      await montar(cenario).designar(APP, AVALIADO, cenario.avaliadorId, 'user-rh', 'MANUAL', true);
    } catch (e) {
      atoRecusou = true;
      mensagemDoAto = (e as Error).message;
    }

    expect({ previa: previaRecusa, ato: atoRecusou }).toEqual({
      previa: cenario.recusa,
      ato: cenario.recusa,
    });
    // A frase que a tela mostraria é a MESMA que a API devolveria.
    if (cenario.recusa) expect(previa.linhas[0].frase).toBe(mensagemDoAto);
  });
});
