/**
 * Export.js - Funções de Exportação de Dados
 * Sistema de Inventário Protheus v2.19.13
 *
 * Funções consolidadas de exportação usadas em múltiplas páginas:
 * - Exportação CSV
 * - Exportação Excel
 * - Exportação JSON
 * - Impressão
 */

// =================================
// EXPORTAÇÃO CSV
// =================================

/**
 * Exporta dados para arquivo CSV.
 *
 * @param {object} options - Opções de exportação
 * @param {Array} options.data - Dados a exportar
 * @param {Array} options.columns - Colunas [{key, label}]
 * @param {string} options.filename - Nome do arquivo (default: export.csv)
 * @param {string} options.separator - Separador (default: ;)
 */
function exportToCSV(options = {}) {
    const {
        data = [],
        columns = [],
        filename = 'export.csv',
        separator = ';'
    } = options;

    if (!data || data.length === 0) {
        if (typeof showAlert === 'function') {
            showAlert('Nenhum dado para exportar', 'warning');
        } else {
            alert('Nenhum dado para exportar');
        }
        return;
    }

    try {
        // Cabeçalho
        const headers = columns.map(col => col.label || col.key);
        let csv = headers.join(separator) + '\n';

        // Dados
        data.forEach(row => {
            const values = columns.map(col => {
                let value = row[col.key];

                // Tratar valores nulos/undefined
                if (value === null || value === undefined) {
                    value = '';
                }

                // Converter para string
                value = String(value);

                // Escapar aspas duplas
                value = value.replace(/"/g, '""');

                // Se contiver separador ou quebra de linha, envolver em aspas
                if (value.includes(separator) || value.includes('\n') || value.includes('"')) {
                    value = `"${value}"`;
                }

                return value;
            });

            csv += values.join(separator) + '\n';
        });

        // Adicionar BOM para UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

        downloadBlob(blob, filename);

        if (typeof showSuccess === 'function') {
            showSuccess(`Exportado: ${filename}`);
        }

    } catch (e) {
        console.error('Erro ao exportar CSV:', e);
        if (typeof showError === 'function') {
            showError('Erro ao exportar CSV');
        }
    }
}

/**
 * Exporta tabela HTML para CSV.
 *
 * @param {string} tableId - ID da tabela
 * @param {string} filename - Nome do arquivo
 */
function exportTableToCSV(tableId, filename = 'export.csv') {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error('Tabela não encontrada:', tableId);
        return;
    }

    try {
        let csv = '';

        // Headers
        const headers = table.querySelectorAll('thead th');
        const headerRow = Array.from(headers).map(th => th.textContent.trim());
        csv += headerRow.join(';') + '\n';

        // Rows
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = Array.from(cells).map(td => {
                let text = td.textContent.trim();
                text = text.replace(/"/g, '""');
                if (text.includes(';') || text.includes('\n')) {
                    text = `"${text}"`;
                }
                return text;
            });
            csv += rowData.join(';') + '\n';
        });

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, filename);

    } catch (e) {
        console.error('Erro ao exportar tabela:', e);
    }
}

// =================================
// EXPORTAÇÃO EXCEL
// =================================

/**
 * Exporta dados para arquivo Excel (XLSX).
 * Requer biblioteca SheetJS (xlsx.js) para funcionar.
 *
 * @param {object} options - Opções de exportação
 * @param {Array} options.data - Dados a exportar
 * @param {Array} options.columns - Colunas [{key, label}]
 * @param {string} options.filename - Nome do arquivo
 * @param {string} options.sheetName - Nome da planilha
 */
function exportToExcel(options = {}) {
    const {
        data = [],
        columns = [],
        filename = 'export.xlsx',
        sheetName = 'Dados'
    } = options;

    if (!data || data.length === 0) {
        if (typeof showAlert === 'function') {
            showAlert('Nenhum dado para exportar', 'warning');
        }
        return;
    }

    // Verificar se SheetJS está disponível
    if (typeof XLSX === 'undefined') {
        console.error('SheetJS (XLSX) não está carregado');
        // Fallback para CSV
        console.log('Usando fallback CSV...');
        exportToCSV({ ...options, filename: filename.replace('.xlsx', '.csv') });
        return;
    }

    try {
        // Preparar dados para Excel
        const excelData = [];

        // Cabeçalho
        const headers = columns.map(col => col.label || col.key);
        excelData.push(headers);

        // Dados
        data.forEach(row => {
            const rowData = columns.map(col => {
                let value = row[col.key];
                if (value === null || value === undefined) value = '';
                return value;
            });
            excelData.push(rowData);
        });

        // Criar workbook
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Download
        XLSX.writeFile(wb, filename);

        if (typeof showSuccess === 'function') {
            showSuccess(`Exportado: ${filename}`);
        }

    } catch (e) {
        console.error('Erro ao exportar Excel:', e);
        if (typeof showError === 'function') {
            showError('Erro ao exportar Excel');
        }
    }
}

/**
 * Exporta tabela HTML para Excel.
 *
 * @param {string} tableId - ID da tabela
 * @param {string} filename - Nome do arquivo
 */
function exportTableToExcel(tableId, filename = 'export.xlsx') {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error('Tabela não encontrada:', tableId);
        return;
    }

    if (typeof XLSX === 'undefined') {
        // Fallback para CSV
        exportTableToCSV(tableId, filename.replace('.xlsx', '.csv'));
        return;
    }

    try {
        const wb = XLSX.utils.table_to_book(table, { sheet: 'Dados' });
        XLSX.writeFile(wb, filename);

        if (typeof showSuccess === 'function') {
            showSuccess(`Exportado: ${filename}`);
        }

    } catch (e) {
        console.error('Erro ao exportar tabela Excel:', e);
    }
}

// =================================
// EXPORTAÇÃO JSON
// =================================

/**
 * Exporta dados para arquivo JSON.
 *
 * @param {object} options - Opções de exportação
 * @param {any} options.data - Dados a exportar
 * @param {string} options.filename - Nome do arquivo
 * @param {boolean} options.pretty - Formatar JSON (default: true)
 */
function exportToJSON(options = {}) {
    const {
        data = {},
        filename = 'export.json',
        pretty = true
    } = options;

    try {
        const jsonString = pretty
            ? JSON.stringify(data, null, 2)
            : JSON.stringify(data);

        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        downloadBlob(blob, filename);

        if (typeof showSuccess === 'function') {
            showSuccess(`Exportado: ${filename}`);
        }

    } catch (e) {
        console.error('Erro ao exportar JSON:', e);
        if (typeof showError === 'function') {
            showError('Erro ao exportar JSON');
        }
    }
}

// =================================
// IMPRESSÃO
// =================================

/**
 * Imprime conteúdo de um elemento.
 *
 * @param {string} elementId - ID do elemento a imprimir
 * @param {object} options - Opções de impressão
 * @param {string} options.title - Título da página
 * @param {string} options.styles - CSS adicional
 */
function printElement(elementId, options = {}) {
    const {
        title = 'Impressão',
        styles = ''
    } = options;

    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Elemento não encontrado:', elementId);
        return;
    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { padding: 20px; }
                @media print {
                    .no-print { display: none !important; }
                }
                ${styles}
            </style>
        </head>
        <body>
            ${element.innerHTML}
        </body>
        </html>
    `);

    printWindow.document.close();

    // Aguardar carregamento e imprimir
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
        // printWindow.close(); // Descomentar para fechar após imprimir
    };
}

/**
 * Imprime tabela com formatação.
 *
 * @param {string} tableId - ID da tabela
 * @param {string} title - Título do relatório
 */
function printTable(tableId, title = 'Relatório') {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error('Tabela não encontrada:', tableId);
        return;
    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { padding: 20px; }
                h1 { margin-bottom: 20px; }
                table { width: 100%; }
                th, td { padding: 8px; border: 1px solid #ddd; }
                th { background-color: #f5f5f5; }
                @media print {
                    table { font-size: 12px; }
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
            ${table.outerHTML}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
    };
}

// =================================
// UTILITÁRIOS
// =================================

/**
 * Faz download de um Blob como arquivo.
 *
 * @param {Blob} blob - Blob a baixar
 * @param {string} filename - Nome do arquivo
 */
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Gera nome de arquivo com timestamp.
 *
 * @param {string} prefix - Prefixo do arquivo
 * @param {string} extension - Extensão (csv, xlsx, json)
 * @returns {string} Nome do arquivo
 */
function generateFilename(prefix, extension = 'csv') {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    return `${prefix}_${timestamp}.${extension}`;
}

// =================================
// EXPORTAR PARA USO GLOBAL
// =================================

window.exportToCSV = exportToCSV;
window.exportTableToCSV = exportTableToCSV;
window.exportToExcel = exportToExcel;
window.exportTableToExcel = exportTableToExcel;
window.exportToJSON = exportToJSON;
window.printElement = printElement;
window.printTable = printTable;
window.downloadBlob = downloadBlob;
window.generateFilename = generateFilename;

console.log('✅ Export.js carregado - Sistema de Inventário Protheus v2.19.13');
