/* eslint-disable @typescript-eslint/no-explicit-any */

function modelMock() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({ ultimoNumero: 1 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

/** Mock do PrismaService do gestao-pessoas (schema rh) — modelos + $transaction (chama o cb com o
 *  próprio mock como tx) + $queryRaw. */
export function createPrismaMock(): Record<string, any> {
  const m: Record<string, any> = {
    colaborador: modelMock(),
    cargo: modelMock(),
    colaboradorTreinamento: modelMock(),
    modelo: modelMock(),
    modeloVersao: modelMock(),
    grupo: modelMock(),
    criterio: modelMock(),
    criterioValorInformado: modelMock(),
    pergunta: modelMock(),
    perguntaAlternativa: modelMock(),
    criterioFaixa: modelMock(),
    conceitoFaixa: modelMock(),
    ciclo: modelMock(),
    aplicacao: modelMock(),
    aplicacaoCentroCusto: modelMock(),
    avaliacao: modelMock(),
    resposta: modelMock(),
    resultadoAvaliacao: modelMock(),
    resultadoCriterio: modelMock(),
    auditoria: modelMock(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  m.$transaction = jest.fn((arg: any) => (typeof arg === 'function' ? arg(m) : Promise.all(arg)));
  return m;
}
