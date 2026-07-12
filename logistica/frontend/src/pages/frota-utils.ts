// Utilitários e metadados de situação de rota de frota — extraídos de FrotaPage
// para que o arquivo de página exporte só componentes (Fast Refresh do Vite).

export const SIT_META: Record<string, { label: string; cls: string }> = {
  EM_CURSO: { label: 'Em curso', cls: 'bg-sky-100 text-sky-700' },
  CONCLUIDA: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700' },
  RASCUNHO: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
};

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};
