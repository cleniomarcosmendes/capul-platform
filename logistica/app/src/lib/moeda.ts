// Máscara monetária (pt-BR) pro app — espelha logistica/frontend/src/utils/format.ts.
// Digita-se em centavos da direita p/ esquerda: "5"→"0,05", "1234"→"12,34",
// "150000"→"1.500,00". Cap em 11 dígitos (até 999.999.999,99).

const onlyDigits = (s?: string | null): string => (s ?? '').replace(/\D/g, '');

export function maskMoeda(v: string): string {
  const d = onlyDigits(v).replace(/^0+/, '').slice(0, 11);
  if (!d) return '';
  const padded = d.padStart(3, '0');
  const cent = padded.slice(-2);
  // Separador de milhar manual (RN não tem Intl completo garantido em todo device).
  const inteiro = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiro},${cent}`;
}

/** String mascarada ("1.500,00") → número (1500). Lê os dígitos como centavos. */
export function parseMoeda(v?: string | null): number {
  const d = onlyDigits(v);
  return d ? Number(d) / 100 : 0;
}
