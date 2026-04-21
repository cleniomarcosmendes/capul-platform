import * as XLSX from 'xlsx';

/**
 * Download data as Excel (.xlsx) file.
 * Padrão compartilhado com o Inventário para consistência visual de relatórios.
 */
export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const data = [headers, ...rows.map((r) => r.map((v) => v ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-width das colunas baseado no tamanho máximo do conteúdo.
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Formata uma data ISO para string compacta "DD/MM/AAAA HH:MM" usada em relatórios.
 */
export function formatDataCurto(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
