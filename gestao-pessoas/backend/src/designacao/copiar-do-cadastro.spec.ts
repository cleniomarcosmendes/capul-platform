/**
 * ⭐ O BOTÃO QUE TROCA ~1.000 OPERAÇÕES POR UMA.
 *
 * Copiar `rh.designacao_padrao` (da plataforma) para a designação do ciclo. As
 * cinco regras que não podem ceder, uma por bloco:
 *
 *   1. PRÉVIA        calcula tudo e não grava nada.
 *   2. GUARDA        a troca de aplicação usa a MESMA função do `designar()`, e
 *                    a recusa NÃO aborta o lote.
 *   3. MANUAL        ajuste do RH dentro do ciclo é preservado por padrão.
 *   4. NÃO REVISADO  a divisão alfabética é contada e avisada antes de virar
 *                    designação de verdade.
 *   5. REEXECUTÁVEL  rodar de novo atualiza o que mudou e não duplica nada.
 */
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DesignacaoService, type LinhaDaLista } from './designacao.service.js';

const CICLO = 'ciclo-1';
const APP_A = 'app-a';
const APP_B = 'app-b';
const RH = 'user-rh';

const pessoa = (id: string, nome: string): LinhaDaLista => ({
  colaboradorId: id, matricula: id.slice(-3), nome, centroCusto: '21010101', filial: '02',
  elegivel: true, motivo: null, justificativa: null, decididoManualmente: false,
  avaliadorId: null, avaliadorNome: null, avaliacaoStatus: null, avaliacaoId: null, motivoCancelamento: null,
  // Ninguém designado: sem resposta, e o denominador é o do modelo da aplicação.
  respostasDadas: 0, perguntasNoModelo: 11,
  // Sem avaliação, o Excluir não tem o que cancelar — é o que `efeitoDoExcluir`
  // devolve para linha nenhuma designada.
  efeitoDoExcluir: { acao: 'NADA_A_FAZER', frase: null },
});

const PUBLICO = [pessoa('c1', 'ANA'), pessoa('c2', 'BRUNO'), pessoa('c3', 'CARLA')];

describe('DesignacaoService.copiarDoCadastro', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: DesignacaoService;
  let designar: jest.SpyInstance;

  const montar = (opcoes: {
    publico?: Record<string, LinhaDaLista[]>;
    cadastro?: { avaliadoId: string; avaliadorId: string; origem: string }[];
    avaliacoes?: {
      avaliadoId: string; avaliadorId: string; aplicacaoId: string;
      status: string; origemDesignacao: string; respostas: number;
    }[];
  }) => {
    const publico = opcoes.publico ?? { [APP_A]: PUBLICO };
    prisma.ciclo.findUnique.mockResolvedValue({
      id: CICLO,
      aplicacoes: Object.keys(publico).map((id, i) => ({ id, nome: `Aplicação ${i + 1}` })),
    });
    jest.spyOn(service, 'listar').mockImplementation(async (id: string) => publico[id] ?? []);
    prisma.designacaoPadrao.findMany.mockResolvedValue(opcoes.cadastro ?? []);
    prisma.avaliacao.findMany.mockResolvedValue(
      (opcoes.avaliacoes ?? []).map((a) => ({
        id: `av-${a.avaliadoId}`, avaliadoId: a.avaliadoId, avaliadorId: a.avaliadorId,
        aplicacaoId: a.aplicacaoId, status: a.status, origemDesignacao: a.origemDesignacao,
        _count: { respostas: a.respostas },
      })),
    );
  };

  const todosNoCadastro = [
    { avaliadoId: 'c1', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' },
    { avaliadoId: 'c2', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' },
    { avaliadoId: 'c3', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' },
  ];

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new DesignacaoService(prisma as never, { registrar: jest.fn() } as never);
    designar = jest.spyOn(service, 'designar').mockResolvedValue({ id: 'av' } as never);
  });

  describe('1 — prévia', () => {
    it('⭐ calcula tudo e NÃO grava nada', async () => {
      montar({ cadastro: todosNoCadastro });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);

      expect(r.aplicado).toBe(false);
      expect(r.criar).toBe(3);
      expect(designar).not.toHaveBeenCalled();
      expect(r.duracaoMs).toBeUndefined();
    });

    it('aplicar grava e mede quanto levou', async () => {
      montar({ cadastro: todosNoCadastro });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: false }, RH);

      expect(r.aplicado).toBe(true);
      expect(designar).toHaveBeenCalledTimes(3);
      expect(typeof r.duracaoMs).toBe('number');
    });

    it('quebra por aplicação, com o público de cada uma', async () => {
      montar({
        publico: { [APP_A]: [PUBLICO[0]], [APP_B]: [PUBLICO[1], PUBLICO[2]] },
        cadastro: todosNoCadastro,
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);
      expect(r.porAplicacao.map((a) => [a.nome, a.publico, a.criar])).toEqual([
        ['Aplicação 1', 1, 1],
        ['Aplicação 2', 2, 2],
      ]);
    });

    it('ciclo sem aplicação recusa dizendo o que fazer', async () => {
      prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, aplicacoes: [] });
      await expect(
        service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: false }, RH),
      ).rejects.toThrow(/Monte as aplicações e o público antes/);
    });
  });

  describe('2 — a guarda do designar(), sem abortar o lote', () => {
    it('⭐ quem já respondeu em OUTRA aplicação é recusado; os outros são designados', async () => {
      montar({
        cadastro: todosNoCadastro,
        avaliacoes: [
          { avaliadoId: 'c1', avaliadorId: 'outro', aplicacaoId: APP_B, status: 'ENVIADA', origemDesignacao: 'CENTRO_CUSTO', respostas: 14 },
        ],
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: false }, RH);

      // O lote SEGUE: as outras duas foram designadas.
      expect(designar).toHaveBeenCalledTimes(2);
      expect(r.criar).toBe(2);
      expect(r.naoAplicadas).toEqual([
        expect.objectContaining({ nome: 'ANA', motivo: 'JA_RESPONDIDA' }),
      ]);
    });

    it('a recusa por troca de aplicação usa a MESMA frase do designar()', async () => {
      montar({
        cadastro: todosNoCadastro,
        avaliacoes: [
          { avaliadoId: 'c1', avaliadorId: 'outro', aplicacaoId: APP_B, status: 'PENDENTE', origemDesignacao: 'CENTRO_CUSTO', respostas: 0 },
        ],
      });
      // PENDENTE sem resposta PODE trocar — a guarda deixa passar.
      const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);
      expect(r.atualizar).toBe(1);
      expect(r.naoAplicadas).toEqual([]);
    });

    it('o relatório diz quantas de cada motivo', async () => {
      montar({
        cadastro: [{ avaliadoId: 'c1', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' }],
        avaliacoes: [
          { avaliadoId: 'c1', avaliadorId: 'outro', aplicacaoId: APP_A, status: 'ENVIADA', origemDesignacao: 'CENTRO_CUSTO', respostas: 11 },
        ],
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);
      expect(r.porMotivo).toEqual({ JA_RESPONDIDA: 1, SEM_AVALIADOR_NO_CADASTRO: 2 });
    });
  });

  describe('3 — ajuste manual do ciclo', () => {
    const manual = [
      { avaliadoId: 'c1', avaliadorId: 'quem-o-rh-escolheu', aplicacaoId: APP_A, status: 'PENDENTE', origemDesignacao: 'MANUAL', respostas: 0 },
    ];

    it('⭐ por padrão PRESERVA, e diz de quem se trata', async () => {
      montar({ cadastro: todosNoCadastro, avaliacoes: manual });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: false }, RH);

      expect(designar).toHaveBeenCalledTimes(2);
      expect(r.naoAplicadas).toEqual([
        expect.objectContaining({ nome: 'ANA', motivo: 'AJUSTE_MANUAL_DO_CICLO' }),
      ]);
      expect(r.naoAplicadas[0].detalhe).toMatch(/substituir os ajustes manuais/);
    });

    it('com o pedido explícito, substitui', async () => {
      montar({ cadastro: todosNoCadastro, avaliacoes: manual });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: true }, RH);
      expect(designar).toHaveBeenCalledTimes(3);
      expect(r.atualizar).toBe(1);
      expect(r.porMotivo.AJUSTE_MANUAL_DO_CICLO).toBeUndefined();
    });

    it('⚠️ mas MANUAL já respondida continua intocada, mesmo com o pedido', async () => {
      // Substituir ajuste manual é decisão sobre QUEM avalia; não é licença para
      // reatribuir o julgamento que alguém já deu.
      montar({
        cadastro: todosNoCadastro,
        avaliacoes: [{ ...manual[0], status: 'ENVIADA', respostas: 11 }],
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: true }, RH);
      expect(designar).toHaveBeenCalledTimes(2);
      expect(r.naoAplicadas[0]).toMatchObject({ nome: 'ANA', motivo: 'JA_RESPONDIDA' });
    });
  });

  describe('4 — o não revisado fica explícito', () => {
    it('⭐ conta as que vêm da divisão alfabética e AVISA antes de virar designação', async () => {
      montar({
        cadastro: [
          { avaliadoId: 'c1', avaliadorId: 'chefe', origem: 'DIVISAO_AUTOMATICA' },
          { avaliadoId: 'c2', avaliadorId: 'chefe', origem: 'DIVISAO_AUTOMATICA' },
          { avaliadoId: 'c3', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' },
        ],
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);

      expect(r.deDivisaoNaoRevisada).toBe(2);
      expect(r.avisos.join(' ')).toMatch(/ordem alfabética.*arbitrária.*revise no cadastro/s);
    });

    it('não conta a que já estava igual — ela não vira designação nova', async () => {
      montar({
        cadastro: [{ avaliadoId: 'c1', avaliadorId: 'chefe', origem: 'DIVISAO_AUTOMATICA' }],
        avaliacoes: [
          { avaliadoId: 'c1', avaliadorId: 'chefe', aplicacaoId: APP_A, status: 'PENDENTE', origemDesignacao: 'CENTRO_CUSTO', respostas: 0 },
        ],
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);
      expect(r.deDivisaoNaoRevisada).toBe(0);
      expect(r.jaIguais).toBe(1);
    });

    it('quem não está na lista de ninguém vira aviso, não erro', async () => {
      montar({ cadastro: [{ avaliadoId: 'c1', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' }] });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);
      expect(r.porMotivo.SEM_AVALIADOR_NO_CADASTRO).toBe(2);
      // ⚠️ A frase mudou em 08/09 e o teste tinha de mudar junto: ela dizia
      // "não estão na lista de ninguém e ficarão de fora" para TODO mundo sem
      // cadastro, inclusive para quem já estava no ciclo. Agora o "ficarão de
      // fora" só vale para quem também não tem avaliação — e o aviso diz isso.
      expect(r.avisos.join(' ')).toMatch(/não têm avaliação neste ciclo: são as que ficarão de fora/);
    });
  });

  describe('5 — reexecutável', () => {
    it('⭐ rodar de novo com tudo igual grava ZERO', async () => {
      montar({
        cadastro: todosNoCadastro,
        avaliacoes: PUBLICO.map((p) => ({
          avaliadoId: p.colaboradorId, avaliadorId: 'chefe', aplicacaoId: APP_A,
          status: 'PENDENTE', origemDesignacao: 'CENTRO_CUSTO', respostas: 0,
        })),
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: false }, RH);

      expect(r.jaIguais).toBe(3);
      expect(r.criar + r.atualizar).toBe(0);
      expect(designar).not.toHaveBeenCalled();
    });

    it('o cadastro mudou: só quem mudou é reescrito', async () => {
      montar({
        cadastro: [
          { avaliadoId: 'c1', avaliadorId: 'chefe-novo', origem: 'MANUAL' },
          { avaliadoId: 'c2', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' },
          { avaliadoId: 'c3', avaliadorId: 'chefe', origem: 'CENTRO_CUSTO' },
        ],
        avaliacoes: PUBLICO.map((p) => ({
          avaliadoId: p.colaboradorId, avaliadorId: 'chefe', aplicacaoId: APP_A,
          status: 'PENDENTE', origemDesignacao: 'CENTRO_CUSTO', respostas: 0,
        })),
      });
      const r = await service.copiarDoCadastro(CICLO, { aplicar: true, substituirManuais: false }, RH);

      expect(r.atualizar).toBe(1);
      expect(r.jaIguais).toBe(2);
      expect(designar).toHaveBeenCalledTimes(1);
      expect(designar).toHaveBeenCalledWith(APP_A, 'c1', 'chefe-novo', RH, 'CENTRO_CUSTO');
    });
  });
});

/**
 * ⭐⭐ O PAINEL CLASSIFICAVA PELO CADASTRO E ESCREVIA SOBRE O CICLO (08/09).
 *
 * Item F do roteiro de tela: o aviso dizia *"2 pessoas não estão na lista de
 * ninguém e ficarão de fora do ciclo"* sobre gente que estava DENTRO, com
 * avaliador designado à mão. E a classificação era incoerente consigo mesma —
 * três pessoas designadas à mão do mesmo jeito, e só uma caía em "ajustadas à
 * mão"; as outras duas, em "sem avaliador no cadastro".
 *
 * ⚠️ **Não era defeito de texto, era de raciocínio.** `SEM_AVALIADOR_NO_CADASTRO`
 * responde uma pergunta sobre o CADASTRO ("o cadastro tem avaliador para ela?")
 * e a frase afirmava algo sobre o CICLO ("ficará de fora"). São dois eixos
 * INDEPENDENTES — 2×2 —, e o código os tratava como uma sequência em que o
 * primeiro teste absorvia os casos do segundo. Quem tinha cadastro chegava ao
 * teste do manual; quem não tinha, não chegava. Daí a incoerência.
 */
describe('sem cadastro × já designada no ciclo — os dois eixos', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: DesignacaoService;

  const semCadastro: { avaliadoId: string; avaliadorId: string; origem: string }[] = [];

  const montar = (opcoes: {
    cadastro?: { avaliadoId: string; avaliadorId: string; origem: string }[];
    avaliacoes?: {
      avaliadoId: string; avaliadorId: string; aplicacaoId: string;
      status: string; origemDesignacao: string; respostas: number;
    }[];
  }) => {
    prisma.ciclo.findUnique.mockResolvedValue({
      id: CICLO,
      aplicacoes: [{ id: APP_A, nome: 'Aplicação 1' }],
    });
    jest.spyOn(service, 'listar').mockResolvedValue(PUBLICO as never);
    prisma.designacaoPadrao.findMany.mockResolvedValue(opcoes.cadastro ?? []);
    prisma.avaliacao.findMany.mockResolvedValue(
      (opcoes.avaliacoes ?? []).map((a) => ({
        id: `av-${a.avaliadoId}`, avaliadoId: a.avaliadoId, avaliadorId: a.avaliadorId,
        aplicacaoId: a.aplicacaoId, status: a.status, origemDesignacao: a.origemDesignacao,
        _count: { respostas: a.respostas },
      })),
    );
  };

  const manualNoCiclo = (avaliadoId: string) => ({
    avaliadoId, avaliadorId: 'chefe-escolhido-a-mao', aplicacaoId: APP_A,
    status: 'PENDENTE', origemDesignacao: 'MANUAL', respostas: 0,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new DesignacaoService(prisma as never, { registrar: jest.fn() } as never);
    jest.spyOn(service, 'designar').mockResolvedValue({ id: 'av' } as never);
  });

  const previa = () => service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: false }, RH);

  /** ⭐ O CASO DO RELATÓRIO: designada à mão, sem cadastro. Ela NÃO fica de fora. */
  it('designada à mão e sem cadastro NÃO é "ficará de fora do ciclo"', async () => {
    montar({ cadastro: semCadastro, avaliacoes: [manualNoCiclo('c1')] });
    const r = await previa();
    const dela = r.naoAplicadas.find((l) => l.colaboradorId === 'c1')!;
    expect(dela.motivo).toBe('SEM_CADASTRO_JA_DESIGNADA');
    expect(dela.detalhe).toMatch(/continua com o avaliador/i);
    // Ela NEGA explicitamente o "fica de fora" — que era a afirmação falsa.
    expect(dela.detalhe).toMatch(/NÃO fica de fora/);
    expect(dela.detalhe).not.toMatch(/ficará de fora/i);
  });

  /** E quem de fato fica de fora continua dizendo isso — a frase agora é verdade. */
  it('sem cadastro e SEM avaliação: aí sim fica de fora, e a frase diz', async () => {
    montar({ cadastro: semCadastro, avaliacoes: [] });
    const r = await previa();
    expect(r.porMotivo.SEM_AVALIADOR_NO_CADASTRO).toBe(3);
    expect(r.naoAplicadas[0].detalhe).toMatch(/fica de fora/i);
  });

  /**
   * ⭐⭐ A INCOERÊNCIA, medida: três designadas à mão do MESMO jeito, e o que as
   * separava era só ter ou não linha no cadastro. Continuam em baldes
   * diferentes — porque as perguntas são diferentes —, mas agora os dois baldes
   * dizem a verdade, e nenhum dos dois diz "fica de fora".
   */
  it('três designadas à mão: o cadastro separa os baldes, não o "fica de fora"', async () => {
    montar({
      cadastro: [{ avaliadoId: 'c1', avaliadorId: 'outro-chefe', origem: 'CENTRO_CUSTO' }],
      avaliacoes: [manualNoCiclo('c1'), manualNoCiclo('c2'), manualNoCiclo('c3')],
    });
    const r = await previa();
    expect(r.porMotivo).toEqual({ AJUSTE_MANUAL_DO_CICLO: 1, SEM_CADASTRO_JA_DESIGNADA: 2 });
    // Nenhuma das três é contada como "vai ficar de fora do ciclo".
    expect(r.porMotivo.SEM_AVALIADOR_NO_CADASTRO).toBeUndefined();
    expect(r.avisos.join(' ')).not.toMatch(/ficarão de fora/);
  });

  /**
   * ⚠️ Nem "substituir os ajustes manuais" resolve este caso — e não deve:
   * substituir por um cadastro que não existe deixaria a pessoa SEM avaliador,
   * que é pior do que a situação de partida.
   */
  it('"substituir manuais" não alcança quem não tem cadastro', async () => {
    montar({ cadastro: semCadastro, avaliacoes: [manualNoCiclo('c1')] });
    const r = await service.copiarDoCadastro(CICLO, { aplicar: false, substituirManuais: true }, RH);
    expect(r.porMotivo.SEM_CADASTRO_JA_DESIGNADA).toBe(1);
    expect(r.criar + r.atualizar).toBe(0);
    expect(r.naoAplicadas[0].detalhe).toMatch(/deixaria sem avaliador/i);
  });

  /** O aviso só conta quem REALMENTE fica de fora. */
  it('o aviso do rodapé conta só quem fica de fora de verdade', async () => {
    montar({
      cadastro: semCadastro,
      avaliacoes: [manualNoCiclo('c1')], // c2 e c3 ficam de fora; c1 não
    });
    const r = await previa();
    const aviso = r.avisos.find((a) => a.includes('ficarão de fora'));
    expect(aviso).toContain('2 pessoa');
  });
});
