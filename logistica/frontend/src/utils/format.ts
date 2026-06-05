// Máscaras de INPUT (progressivas) — padrão dos demais módulos da plataforma.
// Aplicar no onChange do campo; o backend re-normaliza (onlyDigits) ao persistir.

export const onlyDigits = (s?: string | null): string => (s ?? '').replace(/\D/g, '');

/** (XX) XXXX-XXXX (fixo) ou (XX) XXXXX-XXXX (celular). Até 11 dígitos. */
export function maskTelefone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1');
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

/** XXXXX-XXX. Até 8 dígitos. */
export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return d.replace(/^(\d{5})(\d{0,3})/, '$1-$2');
}

/** UFs brasileiras (para o select de UF). */
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
