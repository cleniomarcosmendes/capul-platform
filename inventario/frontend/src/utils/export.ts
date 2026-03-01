import * as XLSX from 'xlsx';

/**
 * Download data as Excel (.xlsx) file.
 */
export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const data = [headers, ...rows.map((r) => r.map((v) => v ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-width columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] ?? '').length),
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Open a print dialog with a formatted HTML table.
 */
export function printTable(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const now = new Date().toLocaleString('pt-BR');
  const thCells = headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = rows
    .map(
      (r) =>
        '<tr>' + r.map((v) => `<td>${v ?? ''}</td>`).join('') + '</tr>',
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
  h2 { margin: 0 0 4px; font-size: 16px; }
  .meta { color: #666; margin-bottom: 12px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-size: 10px; }
  td { border: 1px solid #e2e8f0; padding: 3px 6px; }
  tr:nth-child(even) { background: #f8fafc; }
  @media print { body { margin: 0; } }
</style>
</head><body>
<h2>${title}</h2>
<p class="meta">Gerado em: ${now} &mdash; ${rows.length} registro(s)</p>
<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  }
}
