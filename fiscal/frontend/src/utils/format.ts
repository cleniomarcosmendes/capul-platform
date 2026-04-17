/**
 * Helpers de formatação reutilizados em múltiplas páginas de consulta fiscal.
 * Todos tratam `null`/`undefined` devolvendo `-`.
 */

/**
 * Formata CNPJ (14 dígitos) ou CPF (11 dígitos) no padrão brasileiro.
 */
export function fmtCnpj(c?: string | null): string {
  if (!c) return '-';
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return c;
}

/**
 * Formata CEP (8 dígitos) como 00000-000.
 */
export function fmtCep(c?: string | null): string {
  if (!c) return '-';
  return c.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Formata número como moeda/decimal brasileiro.
 */
export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '-';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formata data ISO (ou Date) para `dd/mm/aaaa hh:mm` no timezone local.
 */
export function fmtDataHora(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Formata data ISO (ou Date) para `dd/mm/aaaa`.
 */
export function fmtData(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

/**
 * Formata telefone brasileiro ((XX)XXXX-XXXX ou (XX)XXXXX-XXXX).
 */
export function fmtTelefone(t?: string | null): string {
  if (!t) return '-';
  const d = t.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return t;
}

/**
 * Agrupa os 44 dígitos da chave de acesso em blocos de 4, estilo portal SEFAZ.
 */
export function fmtChave(c?: string | null): string {
  if (!c) return '-';
  return c.replace(/(\d{4})(?=\d)/g, '$1 ');
}
