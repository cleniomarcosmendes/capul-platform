/**
 * ⭐⭐ CSV PARA ABRIR NO EXCEL — e o Excel é o problema, não o formato.
 *
 * A planilha vai para uma reunião de diretoria. Três armadilhas conhecidas, as
 * três com defesa aqui, porque descobrir na reunião é tarde:
 *
 * 1. ⚠️ **O ZERO À ESQUERDA DA MATRÍCULA.** É o mesmo defeito que fez
 *    `designacao-padrao/planilha.ts` existir: `001741` aberto no Excel vira
 *    `1741`, e aspas não impedem — a conversão é na abertura, não no arquivo.
 *    A única forma que o Excel respeita é `="001741"`, então é essa que sai.
 *    Quem abrir no LibreOffice ou no Google Sheets vê o texto certo do mesmo
 *    jeito.
 *
 * 2. ⚠️ **Separador e decimal.** Excel em pt-BR espera `;` e vírgula decimal.
 *    Com vírgula de separador, "7,85" vira duas colunas.
 *
 * 3. ⚠️ **Fórmula injetada.** Célula que começa com `=`, `+`, `-` ou `@` é
 *    EXECUTADA ao abrir. Nome de pessoa não começa assim, mas **motivo de
 *    cancelamento é texto livre digitado por gente** — e é exatamente por onde
 *    entraria. Prefixo `'` neutraliza sem mudar o que se lê.
 *
 * ⭐ E o BOM: sem ele o Excel lê UTF-8 como Latin-1 e "JOSÉ" vira "JOSÃ‰".
 */

const BOM = '﻿';

/** Texto seguro para célula: neutraliza fórmula e escapa aspas. */
export function celula(valor: string | null | undefined): string {
  const bruto = (valor ?? '').replace(/\r?\n/g, ' ').trim();
  const seguro = /^[=+\-@]/.test(bruto) ? `'${bruto}` : bruto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/**
 * Matrícula na única forma que sobrevive ao Excel. ⚠️ Não troque por `celula()`
 * "para uniformizar": aspas não seguram o zero à esquerda, e o estrago é mudo —
 * a matrícula deixa de casar com o Protheus e ninguém vê na tela.
 */
export function celulaMatricula(matricula: string | null | undefined): string {
  const m = (matricula ?? '').trim();
  return m ? `"=""${m}"""` : '""';
}

/** Número em pt-BR: vírgula decimal, duas casas. `null` vira célula vazia. */
export function celulaNumero(valor: number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '""';
  return `"${valor.toFixed(casas).replace('.', ',')}"`;
}

/** Data e hora em pt-BR, no fuso da empresa — não em UTC, que confunde. */
export function celulaData(valor: Date | string | null | undefined): string {
  if (!valor) return '""';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '""';
  return `"${d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}"`;
}

/** Junta as linhas já montadas num CSV pronto para download. */
export function montarCsv(cabecalho: string[], linhas: string[][]): string {
  const corpo = [cabecalho.map((c) => celula(c)).join(';'), ...linhas.map((l) => l.join(';'))];
  return BOM + corpo.join('\r\n') + '\r\n';
}

/** Nome do arquivo com o ciclo e a data — dois arquivos na mesma pasta se distinguem. */
export function nomeDoArquivo(prefixo: string, cicloNome: string): string {
  const limpo = cicloNome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const hoje = new Date().toISOString().slice(0, 10);
  return `${prefixo}-${limpo}-${hoje}.csv`;
}
