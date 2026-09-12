import { BadRequestException } from '@nestjs/common';
import { CriterioService } from './criterio.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

function servico() {
  const prisma = createPrismaMock();
  prisma.criterio.findUnique.mockResolvedValue(null);
  prisma.criterio.create.mockImplementation(({ data }: never) => Promise.resolve({ id: 'c1', ...(data as object) }));
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { svc: new CriterioService(prisma as never, auditoria as never), prisma };
}

const base = {
  codigo: 'ZZ',
  nome: 'Zé',
  origem: 'INFORMADO' as const,
  tipoValor: 'NUMERICO' as const,
};

describe('CriterioService — o que a casca não pode desfazer', () => {
  /**
   * ⭐⭐ REGRESSÃO de um defeito real (11/09): a primeira versão zerava o
   * `codigoCalculo` por origem ANTES de validar —
   * `origem === 'CALCULADO' ? dto.codigoCalculo : null`. Com isso a regra
   * escrita em `criterio.validator` ("INFORMADO com código de cálculo: recuse")
   * **nunca era alcançada**: o service limpava o campo e o validador não via
   * nada errado.
   *
   * Sanitizar em silêncio o que a regra manda recusar é pior que não validar —
   * some com o sintoma e deixa quem trocou a origem achando que o cálculo
   * continua valendo. Pego exercitando o serviço contra o banco, não pela suíte.
   */
  it('INFORMADO com codigoCalculo preenchido é RECUSADO, não silenciosamente limpo', async () => {
    const { svc, prisma } = servico();
    await expect(
      svc.criar({ ...base, codigoCalculo: 'TEMPO_EMPRESA' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.criterio.create).not.toHaveBeenCalled();
  });

  it('CALCULADO com código que não existe no registry é recusado', async () => {
    const { svc, prisma } = servico();
    await expect(
      svc.criar({ ...base, origem: 'CALCULADO', codigoCalculo: 'NAO_EXISTE' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.criterio.create).not.toHaveBeenCalled();
  });

  it('CALCULADO com código registrado passa', async () => {
    const { svc } = servico();
    await expect(
      svc.criar({ ...base, origem: 'CALCULADO', codigoCalculo: 'TEMPO_EMPRESA' }, 'u1'),
    ).resolves.toMatchObject({ codigoCalculo: 'TEMPO_EMPRESA' });
  });

  /** INFORMADO grava `null`, mesmo tendo passado pela validação com o cru. */
  it('INFORMADO sem código de cálculo grava null', async () => {
    const { svc } = servico();
    await expect(svc.criar(base, 'u1')).resolves.toMatchObject({ codigoCalculo: null });
  });

  it('o código é normalizado para MAIÚSCULA — é identificador, não texto', async () => {
    const { svc } = servico();
    await expect(svc.criar({ ...base, codigo: 'meta_mensal' }, 'u1')).resolves.toMatchObject({
      codigo: 'META_MENSAL',
    });
  });
});

describe('faixas — o ato destrutivo silencioso', () => {
  function comCriterio(over: Record<string, unknown> = {}) {
    const prisma = createPrismaMock();
    prisma.criterio.findUnique.mockResolvedValue({
      id: 'c1',
      nome: 'Escolaridade',
      tipoValor: 'DOMINIO',
      ativo: true,
      faixas: [{ id: 'f1' }, { id: 'f2' }],
      _count: { aplicacoes: 5 },
      ...over,
    });
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    return {
      svc: new CriterioService(prisma as never, auditoria as never),
      prisma,
    };
  }

  /**
   * ⭐⭐ Apagar todas as faixas de um critério EM USO é destrutivo e silencioso:
   * ele para de pontuar todo mundo e sai da nota pela renormalização, sem erro.
   * Até 11/09 passava sem uma palavra — e a conferência respondia
   * `{problemas: []}`, isto é, AFIRMAVA que estava tudo certo.
   */
  it('recusa deixar sem faixa um critério em uso, e diz o que se perde', async () => {
    const { svc, prisma } = comCriterio();
    await expect(svc.salvarFaixas('c1', { faixas: [] }, 'u1')).rejects.toThrow(
      /par(a|ar) de pontuar todo mundo/,
    );
    expect(prisma.criterioFaixa.deleteMany).not.toHaveBeenCalled();
  });

  it('a recusa traz os NÚMEROS — quantas faixas e quantas aplicações', async () => {
    const { svc } = comCriterio();
    await expect(svc.salvarFaixas('c1', { faixas: [] }, 'u1')).rejects.toThrow(/2[\s\S]*5|5[\s\S]*2/);
  });

  it('com a confirmação explícita, passa', async () => {
    const { svc, prisma } = comCriterio();
    prisma.$transaction.mockImplementation(async (cb: never) => (cb as unknown as (tx: unknown) => unknown)(prisma));
    prisma.criterio.findMany.mockResolvedValue([]);
    await svc.salvarFaixas('c1', { faixas: [], confirmarSemFaixas: true }, 'u1');
    expect(prisma.criterioFaixa.deleteMany).toHaveBeenCalled();
  });

  it('critério que NÃO está em uso não precisa de confirmação', async () => {
    const { svc, prisma } = comCriterio({ _count: { aplicacoes: 0 } });
    prisma.$transaction.mockImplementation(async (cb: never) => (cb as unknown as (tx: unknown) => unknown)(prisma));
    prisma.criterio.findMany.mockResolvedValue([]);
    await svc.salvarFaixas('c1', { faixas: [] }, 'u1');
    expect(prisma.criterioFaixa.deleteMany).toHaveBeenCalled();
  });

  it('a conferência AVISA antes do clique, sem bloquear', async () => {
    const { svc } = comCriterio();
    const r = await svc.conferirFaixas('c1', { faixas: [] });
    expect(r.problemas).toEqual([]);
    expect(r.avisos[0]).toMatch(/par(a|ar) de pontuar todo mundo/);
  });

  it('com faixas, não há aviso', async () => {
    const { svc } = comCriterio();
    const r = await svc.conferirFaixas('c1', {
      faixas: [{ valorDominio: '45', pontuacao: 50 } as never],
    });
    expect(r.avisos).toEqual([]);
  });
});
