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
 *
 * Strings no formato `YYYY-MM-DD` (date-only) são tratadas como datas
 * calendáricas locais — `new Date("2026-04-30")` em JS as interpreta como
 * `2026-04-30T00:00:00Z` (UTC), e a conversão pra horário local (BRT = UTC-3)
 * volta pra 29/04 21:00, mostrando o dia anterior. XML SEFAZ usa esse formato
 * para `dVenc`, `dIniAtiv`, `dUltSit`, etc.
 */
export function fmtData(d: string | Date | null | undefined): string {
  if (!d) return '-';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
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

/**
 * Segmenta a chave NF-e/CT-e em grupos de significado: UF | AAMM | CNPJ emit |
 * modelo | série | nNF | tpEmis+cNF | DV. Padrão usado no campo de input da
 * tela de consulta — ajuda o operador a conferir visualmente os pedaços antes
 * de consultar (ex.: ano/mês da emissão, CNPJ do emitente).
 *
 * Aceita entrada parcial (enquanto o usuário digita) — só insere o separador
 * quando o próximo grupo começar.
 *
 * Exemplo: 52260474050808000110550010000154431000219508
 *       → 52-2604-74050808000110-55-001-000015443-100021950-8 (51 chars)
 */
export function fmtChaveMascara(digits?: string | null): string {
  if (!digits) return '';
  const d = digits.replace(/\D/g, '').slice(0, 44);
  // Offsets acumulados: 2, 6, 20, 22, 25, 34, 43, 44
  const cortes: Array<[number, number]> = [
    [0, 2],   // UF
    [2, 6],   // AAMM
    [6, 20],  // CNPJ emitente
    [20, 22], // modelo (55 = NF-e, 57 = CT-e)
    [22, 25], // série
    [25, 34], // nNF
    [34, 43], // tpEmis + cNF
    [43, 44], // DV
  ];
  const partes: string[] = [];
  for (const [ini, fim] of cortes) {
    if (d.length <= ini) break;
    partes.push(d.slice(ini, Math.min(fim, d.length)));
  }
  return partes.join('-');
}
