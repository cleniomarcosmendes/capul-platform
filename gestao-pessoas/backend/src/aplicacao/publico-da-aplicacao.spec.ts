/**
 * O PÚBLICO DA APLICAÇÃO — atalhos de preenchimento, não regra.
 *
 * A tela escolhe um recorte (centro de custo, filial, ou pessoas), o sistema
 * traz as pessoas, ela ajusta e salva a lista resultante.
 *
 * ⭐ O que este arquivo protege é a PRÉVIA. `@@unique([cicloId, colaboradorId])`
 * recusa quem já está em outra aplicação do mesmo ciclo; sem prévia, escolher
 * um centro de custo que se sobrepõe a outro público falharia no INSERT, com o
 * erro do banco e sem dizer de quem se trata.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { AplicacaoService } from './aplicacao.service.js';
import { avaliarElegibilidade } from '../designacao/elegibilidade-ciclo.js';

const APP = 'app-1';
const CICLO = 'ciclo-1';
const RH = 'user-rh';

const PESSOAS = [
  { id: 'c1', nome: 'ANA', matricula: '001', filial: '02', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c2', nome: 'BRUNO', matricula: '002', filial: '02', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c3', nome: 'CARLA', matricula: '003', filial: '02', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
];

describe('AplicacaoService — público nominal', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: AplicacaoService;

  const alvoCC = { origem: 'CENTRO_CUSTO' as const, referencia: '02|21010101', centrosCusto: [{ filial: '02', centroCusto: '21010101' }] };

  const montar = (ocupados: { colaboradorId: string; aplicacaoId: string; nome: string }[] = []) => {
    // ⚠️ `ciclo.incluirAfastados` entrou no select em 08/09: a prévia passou a
    // responder "quantos GERAM AVALIAÇÃO", e quem decide isso é a régua do ciclo.
    prisma.aplicacao.findUnique.mockResolvedValue({
      id: APP, nome: 'Operação de Loja', cicloId: CICLO, ciclo: { incluirAfastados: false },
    });
    prisma.colaborador.findMany.mockResolvedValue(PESSOAS);
    prisma.aplicacaoPublico.findMany.mockResolvedValue(
      ocupados.map((o) => ({
        colaboradorId: o.colaboradorId,
        aplicacaoId: o.aplicacaoId,
        aplicacao: { nome: o.nome },
      })),
    );
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new AplicacaoService(prisma as never, auditoria as never,
      // A régua do cartão — não exercitada aqui.
      { listar: jest.fn().mockResolvedValue([]) } as never);
  });

  describe('prévia do atalho', () => {
    it('traz todo mundo do recorte quando ninguém está em aplicação nenhuma', async () => {
      montar();
      const p = await service.previaDoPublico(APP, alvoCC);
      expect(p).toMatchObject({ encontradas: 3, entramNoPublico: 3, jaNesta: 0, emOutraAplicacao: [] });
    });

    it('⭐ AVISA quem já está em OUTRA aplicação, com nome e qual é', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: 'app-aprendizes', nome: 'Aprendizes' }]);
      const p = await service.previaDoPublico(APP, alvoCC);

      expect(p.entramNoPublico).toBe(2);
      expect(p.emOutraAplicacao).toEqual([
        expect.objectContaining({ nome: 'ANA', aplicacao: 'Aprendizes' }),
      ]);
    });

    it('quem já está NESTA aplicação não conta como conflito', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: APP, nome: 'Operação de Loja' }]);
      const p = await service.previaDoPublico(APP, alvoCC);
      expect(p).toMatchObject({ entramNoPublico: 2, jaNesta: 1, emOutraAplicacao: [] });
    });

    it('a prévia não grava nada', async () => {
      montar();
      await service.previaDoPublico(APP, alvoCC);
      expect(prisma.aplicacaoPublico.createMany).not.toHaveBeenCalled();
    });

    it('⚠️ recorte vazio é recusado — seria a empresa inteira', async () => {
      montar();
      await expect(service.previaDoPublico(APP, { origem: 'MANUAL' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('adicionar', () => {
    it('grava só quem não estava em aplicação nenhuma, com a origem do atalho', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: 'app-x', nome: 'Outra' }]);
      const r = await service.adicionarAoPublico(APP, alvoCC, true, RH);

      expect(r.adicionadas).toBe(2);
      expect(prisma.aplicacaoPublico.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ colaboradorId: 'c2', origem: 'CENTRO_CUSTO', origemReferencia: '02|21010101', provisorio: true }),
          expect.objectContaining({ colaboradorId: 'c3' }),
        ],
      });
    });

    it('⭐ provisório é o que a tela mandar — e a tela manda true por padrão', async () => {
      montar();
      await service.adicionarAoPublico(APP, alvoCC, false, RH);
      expect(prisma.aplicacaoPublico.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([expect.objectContaining({ provisorio: false })]),
      });
    });

    it('devolve o conflito que sobrou, sem uma segunda chamada', async () => {
      montar([{ colaboradorId: 'c1', aplicacaoId: 'app-x', nome: 'Outra' }]);
      const r = await service.adicionarAoPublico(APP, alvoCC, true, RH);
      expect(r.emOutraAplicacao).toEqual([expect.objectContaining({ nome: 'ANA' })]);
    });

    it('nada a adicionar não grava nem audita', async () => {
      montar(PESSOAS.map((p) => ({ colaboradorId: p.id, aplicacaoId: APP, nome: 'Esta' })));
      const r = await service.adicionarAoPublico(APP, alvoCC, true, RH);
      expect(r.adicionadas).toBe(0);
      expect(prisma.aplicacaoPublico.createMany).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  /**
   * ⭐ A linha do próprio usuário no público — decisão de 06/09/2026. O público
   * diz por qual questionário a pessoa é avaliada, e a linha traz "Tirar".
   */
  describe('marca a própria linha, nunca filtra', () => {
    const montarPublico = () => {
      prisma.aplicacaoPublico.findMany.mockResolvedValue(
        PESSOAS.map((c, i) => ({
          id: `p${i}`, colaboradorId: c.id, origem: 'CENTRO_CUSTO',
          origemReferencia: null, provisorio: true,
        })),
      );
      prisma.colaborador.findMany.mockResolvedValue(
        PESSOAS.map((c) => ({ ...c, cargoDescricao: null, situacao: 'ATIVO' })),
      );
    };

    it('mantém as 3 linhas e marca só a de quem está logado', async () => {
      montarPublico();
      const lista = await service.publicoDe(APP, 'c2');
      expect(lista).toHaveLength(3);
      expect(lista.filter((l) => l.restrita)).toHaveLength(1);
      expect(lista.find((l) => l.colaboradorId === 'c2')).toMatchObject({
        restrita: true,
        motivoRestricao: expect.stringContaining('própria avaliação'),
      });
    });

    it('sem colaborador resolvido, ninguém fica marcado — e a lista sai inteira', async () => {
      montarPublico();
      const lista = await service.publicoDe(APP, null);
      expect(lista).toHaveLength(3);
      expect(lista.every((l) => !l.restrita)).toBe(true);
    });
  });

  describe('remover', () => {
    it('⚠️ quem já tem avaliação não sai do público', async () => {
      // A `Avaliacao` ficaria órfã do recorte que a originou e sumiria da
      // contagem sem sumir do banco.
      prisma.aplicacaoPublico.findFirst.mockResolvedValue({ id: 'p1', origem: 'CENTRO_CUSTO' });
      prisma.avaliacao.count.mockResolvedValue(1);
      await expect(service.removerDoPublico(APP, 'c1', RH)).rejects.toThrow(
        /já tem avaliação nesta aplicação/,
      );
      expect(prisma.aplicacaoPublico.delete).not.toHaveBeenCalled();
    });

    /**
     * ⭐⭐ A recusa APONTA UM CAMINHO QUE EXISTE (08/09). Ela mandava "Cancele a
     * avaliação antes" — ato que não existia em lugar nenhum do módulo, e que
     * por isso mandava a pessoa procurar sozinha uma porta inexistente. O ato
     * agora existe e tem endereço: Designação → Excluir.
     */
    it('a recusa diz ONDE se faz isso, e não um ato inexistente', async () => {
      prisma.aplicacaoPublico.findFirst.mockResolvedValue({ id: 'p1', origem: 'CENTRO_CUSTO' });
      prisma.avaliacao.count.mockResolvedValue(1);
      await expect(service.removerDoPublico(APP, 'c1', RH)).rejects.toThrow(/Designação → Excluir/);
    });

    /**
     * ⚠️ Cancelada já saiu de toda conta — segurar o público por causa dela
     * seria travar por um registro histórico.
     */
    it('avaliação CANCELADA não segura o público', async () => {
      prisma.aplicacaoPublico.findFirst.mockResolvedValue({ id: 'p1', origem: 'CENTRO_CUSTO' });
      prisma.avaliacao.count.mockResolvedValue(0);
      await service.removerDoPublico(APP, 'c1', RH);
      expect(prisma.avaliacao.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: 'CANCELADA' } }),
        }),
      );
      expect(prisma.aplicacaoPublico.delete).toHaveBeenCalled();
    });

    it('sem avaliação, sai e fica registrado', async () => {
      prisma.aplicacaoPublico.findFirst.mockResolvedValue({ id: 'p1', origem: 'CENTRO_CUSTO' });
      prisma.avaliacao.count.mockResolvedValue(0);
      await service.removerDoPublico(APP, 'c1', RH);
      expect(prisma.aplicacaoPublico.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'PUBLICO_REMOVER' }));
    });
  });
});

/**
 * ⭐⭐ A PRÉVIA RESPONDE DUAS PERGUNTAS (08/09, item H do roteiro).
 *
 * Ela prometeu 5, entraram 5 no público e só 4 geraram avaliação: uma afastada
 * na data-base, num ciclo configurado para não incluir afastados. *"5 pessoa(s)
 * entram"* estava CERTO sobre o público e era lido como "5 vão ser avaliadas".
 *
 * ⚠️ Estes testes afirmam a REGRA — os números e o vínculo com a régua —, não
 * as frases da tela. Ver a nota de método na §6: teste preso a texto fossiliza
 * o defeito junto com ele, e foi o que aconteceu no item F.
 */
describe('prévia: entrar no público ≠ gerar avaliação', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AplicacaoService;

  const alvo = { origem: 'MANUAL' as const, colaboradorIds: ['c1', 'c2', 'c3'] };

  const montar = (situacoes: string[], incluirAfastados = false) => {
    prisma.aplicacao.findUnique.mockResolvedValue({
      id: APP, nome: 'Operação de Loja', cicloId: CICLO, ciclo: { incluirAfastados },
    });
    prisma.colaborador.findMany.mockResolvedValue(
      PESSOAS.map((p, i) => ({ ...p, situacao: situacoes[i] })),
    );
    prisma.aplicacaoPublico.findMany.mockResolvedValue([]);
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AplicacaoService(prisma as never, { registrar: jest.fn() } as never,
      // A régua do cartão — não exercitada por estas specs, que testam
      // o público e a prévia, não a conciliação.
      { listar: jest.fn().mockResolvedValue([]) } as never);
  });

  it('todos ativos: os dois números batem', async () => {
    montar(['ATIVO', 'ATIVO', 'ATIVO']);
    const p = await service.previaDoPublico(APP, alvo);
    expect(p.entramNoPublico).toBe(3);
    expect(p.geramAvaliacao).toBe(3);
    expect(p.barradosPelaRegua).toEqual([]);
  });

  /** ⭐ O CASO DO RELATÓRIO: entra no público, não gera avaliação. */
  it('afastada num ciclo que não inclui afastados: entra no público e NÃO gera avaliação', async () => {
    montar(['ATIVO', 'AFASTADO', 'ATIVO']);
    const p = await service.previaDoPublico(APP, alvo);
    expect(p.entramNoPublico).toBe(3);
    expect(p.geramAvaliacao).toBe(2);
    expect(p.barradosPelaRegua).toHaveLength(1);
    expect(p.barradosPelaRegua[0].nome).toBe('BRUNO');
  });

  /**
   * ⚠️ A justificativa é a MESMA da régua — não um texto próprio da prévia.
   * O teste afirma a IGUALDADE com a função, não o conteúdo da frase: se o RH
   * reescrever o texto da régua, a prévia acompanha e o teste continua válido.
   */
  it('a justificativa vem da régua, não de um texto próprio da prévia', async () => {
    montar(['ATIVO', 'AFASTADO', 'ATIVO']);
    const p = await service.previaDoPublico(APP, alvo);
    const daRegua = avaliarElegibilidade(
      { colaboradorId: 'c2', matricula: '002', nome: 'BRUNO', categoriaFuncional: null, situacaoNaDataBase: 'AFASTADO' },
      { incluirAfastados: false },
    );
    expect(p.barradosPelaRegua[0].justificativa).toBe(daRegua.justificativa);
  });

  /** ⭐ A POLÍTICA DO CICLO manda: o mesmo público, o outro ciclo, outro número. */
  it('o mesmo público num ciclo que INCLUI afastados gera avaliação para todos', async () => {
    montar(['ATIVO', 'AFASTADO', 'ATIVO'], true);
    const p = await service.previaDoPublico(APP, alvo);
    expect(p.geramAvaliacao).toBe(3);
    expect(p.barradosPelaRegua).toEqual([]);
  });

  /** Férias entra — é transitório, e a régua já dizia isso. A prévia não redecide. */
  it('férias NÃO é barrada — a prévia não tem régua própria', async () => {
    montar(['ATIVO', 'FERIAS', 'ATIVO']);
    const p = await service.previaDoPublico(APP, alvo);
    expect(p.geramAvaliacao).toBe(3);
  });
});
