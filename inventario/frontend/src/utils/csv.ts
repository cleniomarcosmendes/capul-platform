/**
 * Generate and download a CSV file.
 * Uses BOM for Excel compatibility with UTF-8.
 * Separator: semicolon (;) for Brazilian locale.
 */
export function downloadCSV(filename: string, header: string, rows: string[]) {
  const content = header + rows.join('\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
