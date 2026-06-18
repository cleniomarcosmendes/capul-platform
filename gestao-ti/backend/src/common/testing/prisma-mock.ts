/* eslint-disable @typescript-eslint/no-explicit-any */

function modelMock() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findUniqueOrThrow: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
    findFirstOrThrow: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: {}, _avg: {}, _min: {}, _max: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

/**
 * Mock do PrismaService para testes (Jest). Usa Proxy: QUALQUER modelo acessado
 * (`prisma.chamado`, `prisma.departamento`, …) devolve um modelMock estável
 * (cacheado por nome), então não é preciso listar cada modelo — evita o
 * whack-a-mole de "Cannot read properties of undefined" quando um service novo
 * toca um modelo ainda não listado. Métodos de topo do Prisma client
 * ($transaction/$queryRaw/etc.) têm tratamento próprio.
 */
export function createPrismaMock(): Record<string, any> {
  const cache: Record<string, any> = {};

  const proxy: any = new Proxy(
    {},
    {
      get(_t, prop: string | symbol) {
        if (typeof prop !== 'string') return undefined;
        // Não é thenable (evita que `await prisma` ou libs tratem como Promise).
        if (prop === 'then') return undefined;
        if (prop in topLevel) return topLevel[prop];
        if (!cache[prop]) cache[prop] = modelMock();
        return cache[prop];
      },
    },
  );

  const topLevel: Record<string, any> = {
    // $transaction: array de promises → Promise.all; callback (tx interativa) →
    // chama com o próprio proxy como `tx`.
    $transaction: jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : typeof arg === 'function' ? arg(proxy) : arg,
    ),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  return proxy;
}
