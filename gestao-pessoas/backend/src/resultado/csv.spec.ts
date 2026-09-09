/**
 * ⭐ As três armadilhas do Excel, cada uma com um teste. Descobrir na reunião de
 * diretoria é tarde — e as três falham CALADAS.
 */
import { celula, celulaData, celulaMatricula, celulaNumero, montarCsv, nomeDoArquivo } from './csv.js';

describe('CSV que sobrevive ao Excel', () => {
  /**
   * ⚠️ O MESMO defeito que fez `planilha.ts` existir, do lado da saída: aspas
   * NÃO seguram o zero à esquerda — a conversão é na abertura. Só `="001741"`.
   */
  it('a matrícula sai na única forma que o Excel não converte', () => {
    expect(celulaMatricula('001741')).toBe('"=""001741"""');
    expect(celulaMatricula(null)).toBe('""');
  });

  /**
   * ⚠️ Motivo de cancelamento é TEXTO LIVRE digitado por gente — é por onde
   * entra fórmula. Célula que começa com `=` é executada ao abrir.
   */
  it('neutraliza fórmula sem mudar o que se lê', () => {
    expect(celula('=SOMA(A1:A9)')).toBe(`"'=SOMA(A1:A9)"`);
    expect(celula('+55 38 9999')).toBe(`"'+55 38 9999"`);
    expect(celula('-3 dias')).toBe(`"'-3 dias"`);
    expect(celula('@fulano')).toBe(`"'@fulano"`);
    // Texto comum passa intacto: a defesa não pode estragar o caso normal.
    expect(celula('JOSÉ DA SILVA')).toBe('"JOSÉ DA SILVA"');
  });

  it('escapa aspas e tira quebra de linha, que partiria a linha do CSV', () => {
    expect(celula('ele disse "não"')).toBe('"ele disse ""não"""');
    expect(celula('linha 1\nlinha 2')).toBe('"linha 1 linha 2"');
  });

  it('número em pt-BR, vírgula decimal — com ponto, o Excel faz duas colunas', () => {
    expect(celulaNumero(78.5)).toBe('"78,50"');
    expect(celulaNumero(3, 0)).toBe('"3"');
    // ⚠️ Nulo é célula VAZIA, não "0": nota que não existe não é nota zero.
    expect(celulaNumero(null)).toBe('""');
  });

  it('data no fuso da empresa, não em UTC', () => {
    // 03:00Z é meia-noite em São Paulo — se sair UTC, a data muda de dia.
    expect(celulaData('2026-09-16T03:00:00Z')).toContain('16/09/2026');
  });

  it('o arquivo abre com BOM — sem ele o Excel lê UTF-8 como Latin-1', () => {
    const csv = montarCsv(['Nome'], [[celula('JOSÉ')]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"JOSÉ"');
    // O BOM faz parte da primeira linha — por isso ele é retirado antes.
    expect(csv.slice(1).split('\r\n')[0]).toBe('"Nome"');
  });

  it('o nome do arquivo carrega ciclo e data — dois na mesma pasta se distinguem', () => {
    const nome = nomeDoArquivo('resultados', 'Piloto 15/09/2026');
    expect(nome).toMatch(/^resultados-piloto-15-09-2026-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
