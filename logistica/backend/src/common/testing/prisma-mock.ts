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
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

/** Mock do PrismaService da logística — modelos + $transaction (chama o cb com o
 *  próprio mock como tx) + $queryRaw. */
export function createPrismaMock(): Record<string, any> {
  const m: Record<string, any> = {
    viagem: modelMock(),
    parada: modelMock(),
    entrega: modelMock(),
    entregaCupom: modelMock(),
    veiculo: modelMock(),
    veiculoSupervisorHistorico: modelMock(),
    clienteLocal: modelMock(),
    enderecoEntrega: modelMock(),
    contadorSequencial: modelMock(),
    despesaVeiculo: modelMock(),
    tipoDespesa: modelMock(),
    supervisor: modelMock(),
    adiantamento: modelMock(),
    atividadeVisita: modelMock(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  m.$transaction = jest.fn((arg: any) => (typeof arg === 'function' ? arg(m) : Promise.all(arg)));
  return m;
}
