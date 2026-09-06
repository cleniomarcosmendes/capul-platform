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
  avaliadorId: null, avaliadorNome: null, avaliacaoStatus: null,
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
      expect(r.avisos.join(' ')).toMatch(/não estão na lista de ninguém e ficarão de fora/);
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
