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
    delete: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  };
}

/** Mock do PrismaService do auth-gateway. $transaction aceita array (Promise.all)
 *  ou callback (recebe o próprio mock como tx). */
export function createPrismaMock(): Record<string, any> {
  const m: Record<string, any> = {
    dispositivoSessao: modelMock(),
    refreshToken: modelMock(),
    usuario: modelMock(),
  };
  m.$transaction = jest.fn((arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(m)));
  return m;
}
