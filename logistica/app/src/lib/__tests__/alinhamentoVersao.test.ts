import { situacaoDoAlinhamento, textoDoAlinhamento } from '../alinhamentoVersao';

describe('situacaoDoAlinhamento', () => {
  it('alinhado quando app e serviços trazem o mesmo commit', () => {
    expect(situacaoDoAlinhamento('7190a7c3', ['7190a7c3', '7190a7c3'])).toBe('alinhado');
  });

  // O app pode vir da EAS com 7 caracteres e o backend com 8 (`--short` deste
  // repo). São o MESMO commit — exigir igualdade daria alarme falso.
  it('alinhado quando os hashes têm tamanhos diferentes mas mesmo prefixo', () => {
    expect(situacaoDoAlinhamento('7190a7c', ['7190a7c3'])).toBe('alinhado');
    expect(situacaoDoAlinhamento('7190a7c3', ['7190a7c'])).toBe('alinhado');
  });

  it('ignora o sufixo -sujo (mesmo commit, árvore com alteração local)', () => {
    expect(situacaoDoAlinhamento('7190a7c3-sujo', ['7190a7c3'])).toBe('alinhado');
  });

  it('divergente quando um serviço veio de outro commit', () => {
    expect(situacaoDoAlinhamento('7190a7c3', ['7190a7c3', 'e101ec74'])).toBe('divergente');
  });

  it('indeterminado quando falta identidade em qualquer ponta', () => {
    expect(situacaoDoAlinhamento('desconhecido', ['7190a7c3'])).toBe('indeterminado');
    expect(situacaoDoAlinhamento('7190a7c3', ['desconhecido'])).toBe('indeterminado');
    expect(situacaoDoAlinhamento('7190a7c3', [null])).toBe('indeterminado');
    expect(situacaoDoAlinhamento('7190a7c3', [])).toBe('indeterminado');
  });

  it('não afirma alinhamento sem prova (indeterminado tem texto próprio)', () => {
    expect(textoDoAlinhamento('indeterminado')).toMatch(/não dá para comparar/i);
    expect(textoDoAlinhamento('divergente')).toMatch(/DIFERENTES/);
  });
});
