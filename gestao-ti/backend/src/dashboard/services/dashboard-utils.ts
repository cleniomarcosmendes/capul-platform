export function resolvePeriodo(filters?: { dataInicio?: string; dataFim?: string }) {
  const now = new Date();
  const fim = filters?.dataFim
    ? new Date(filters.dataFim + 'T23:59:59.999Z')
    : now;
  const inicio = filters?.dataInicio
    ? new Date(filters.dataInicio + 'T00:00:00.000Z')
    : new Date(now.getFullYear(), now.getMonth(), 1);
  return { inicio, fim };
}
