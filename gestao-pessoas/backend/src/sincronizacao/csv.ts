/**
 * Leitor de CSV mínimo — sem biblioteca nova, como manda a especificação.
 *
 * Cobre o que o export do Protheus produz: campos entre aspas, vírgula dentro
 * de aspas, aspas duplicadas como escape, CRLF, e a última linha sem quebra.
 * Não cobre separador configurável nem multibyte exótico — se um dia precisar,
 * é hora de conversar sobre uma dependência, não de esticar isto.
 *
 * ⚠️ Campos do Protheus são de largura fixa e vêm com espaço à direita; todo
 * valor sai daqui com `trim`.
 */

export type LinhaCsv = Record<string, string>;

/** Divide UMA linha respeitando aspas. */
export function dividirLinha(linha: string, separador = ','): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"'; // aspas escapadas
          i++;
        } else dentroDeAspas = false;
      } else atual += c;
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === separador) {
      campos.push(atual);
      atual = '';
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/**
 * Converte o CSV inteiro em objetos, usando a primeira linha como cabeçalho.
 * Os nomes de coluna são normalizados para minúsculas sem espaço, para o
 * chamador não depender de como o export escreveu.
 */
export function lerCsv(conteudo: string, separador = ','): LinhaCsv[] {
  const linhas = conteudo
    .replace(/^﻿/, '') // BOM do Excel
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (linhas.length === 0) return [];

  const cabecalho = dividirLinha(linhas[0], separador).map((c) => c.toLowerCase().replace(/\s+/g, '_'));

  return linhas.slice(1).map((linha, i) => {
    const valores = dividirLinha(linha, separador);
    if (valores.length !== cabecalho.length) {
      throw new Error(
        `CSV linha ${i + 2}: ${valores.length} campos, mas o cabeçalho tem ${cabecalho.length}. ` +
          'Linha truncada ou separador errado — melhor recusar o arquivo do que importar torto.',
      );
    }
    return Object.fromEntries(cabecalho.map((nome, j) => [nome, valores[j]]));
  });
}

/** Campo obrigatório: recusa em vez de importar vazio em silêncio. */
export function obrigatorio(linha: LinhaCsv, campo: string, contexto: string): string {
  const valor = (linha[campo] ?? '').trim();
  if (!valor) {
    throw new Error(`${contexto}: campo obrigatório "${campo}" vazio ou ausente.`);
  }
  return valor;
}

/** Campo opcional — devolve null em vez de string vazia. */
export function opcional(linha: LinhaCsv, campo: string): string | null {
  const valor = (linha[campo] ?? '').trim();
  return valor.length > 0 ? valor : null;
}

/** AAAAMMDD → Date (UTC). Vazio ou `' '` do Protheus vira null. */
export function dataOpcional(valor: string | null | undefined): Date | null {
  const v = (valor ?? '').trim();
  if (!v || !/^\d{8}$/.test(v)) return null;
  const d = new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)));
  return Number.isNaN(d.getTime()) ? null : d;
}
