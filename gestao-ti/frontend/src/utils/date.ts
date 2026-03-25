/**
 * Formata data ISO (ex: "2026-03-25T00:00:00.000Z") para "dd/mm/aaaa"
 * sem sofrer deslocamento de timezone (UTC-3 não retroage o dia).
 */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '-';
  // Pega apenas a parte da data (YYYY-MM-DD) ignorando timezone
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Formata data+hora ISO para "dd/mm/aaaa HH:mm" respeitando timezone local.
 * Usar para campos com hora real (createdAt, horaInicio, etc).
 */
export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
