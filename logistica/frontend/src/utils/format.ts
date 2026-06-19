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

/**
 * Máscara monetária progressiva (pt-BR) — digita-se da direita p/ esquerda em
 * centavos: "5" → "0,05", "1234" → "12,34", "150000" → "1.500,00". Cap em 11
 * dígitos (até 999.999.999,99). Aplicar no onChange; usar `parseMoeda` no submit.
 */
export function maskMoeda(v: string): string {
  const d = onlyDigits(v).replace(/^0+/, '').slice(0, 11);
  if (!d) return '';
  const padded = d.padStart(3, '0');
  const cent = padded.slice(-2);
  const inteiro = Number(padded.slice(0, -2)).toLocaleString('pt-BR');
  return `${inteiro},${cent}`;
}

/** Converte a string mascarada ("1.500,00") em número (1500). Robusto: lê os
 *  dígitos como centavos, então independe de pontos/vírgula. "" → 0. */
export function parseMoeda(v?: string | null): number {
  const d = onlyDigits(v);
  return d ? Number(d) / 100 : 0;
}

/** Número (ou string numérica) do backend → string mascarada p/ preencher o
 *  input na edição (ex.: 1500.5 → "1.500,50"). null/undefined/"" → "". */
export function moedaParaInput(n?: number | string | null): string {
  if (n == null || n === '') return '';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '';
  return maskMoeda(String(Math.round(num * 100)));
}

/** Placa BR (antiga `ABC1234` ou Mercosul `ABC1D23`): maiúsculas, alfanumérico, 7 chars. */
export function maskPlaca(v: string): string {
  return (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

/** UFs brasileiras (para o select de UF). */
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
