import { Prisma } from '@prisma/client';

const READ_ONLY_MODELS = ['Filial', 'Usuario', 'CentroCusto', 'Departamento'];
const WRITE_ACTIONS = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
];

export const readOnlyCoreExtension = Prisma.defineExtension({
  query: {
    filial: {
      async $allOperations({ operation, args, query }) {
        if (WRITE_ACTIONS.includes(operation)) {
          throw new Error(
            `[BLOQUEADO] Filial é read-only neste backend. ` +
              `Use o Auth Gateway (/api/v1/core/) para operações de escrita.`,
          );
        }
        return query(args);
      },
    },
    usuario: {
      async $allOperations({ operation, args, query }) {
        if (WRITE_ACTIONS.includes(operation)) {
          throw new Error(
            `[BLOQUEADO] Usuario é read-only neste backend. ` +
              `Use o Auth Gateway (/api/v1/core/) para operações de escrita.`,
          );
        }
        return query(args);
      },
    },
    centroCusto: {
      async $allOperations({ operation, args, query }) {
        if (WRITE_ACTIONS.includes(operation)) {
          throw new Error(
            `[BLOQUEADO] CentroCusto é read-only neste backend. ` +
              `Use o Auth Gateway (/api/v1/core/) para operações de escrita.`,
          );
        }
        return query(args);
      },
    },
    departamento: {
      async $allOperations({ operation, args, query }) {
        if (WRITE_ACTIONS.includes(operation)) {
          throw new Error(
            `[BLOQUEADO] Departamento é read-only neste backend. ` +
              `Use o Auth Gateway (/api/v1/core/) para operações de escrita.`,
          );
        }
        return query(args);
      },
    },
  },
});
