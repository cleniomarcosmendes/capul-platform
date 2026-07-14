import { mapFuncionariosSA1 } from './protheus-funcionario.service';

// ⭐ SA1 (clienteEndereco) devolve clientes (A…) E empregados (E…). Para o cadastro de
// usuário do Configurador só interessam os EMPREGADOS → filtrar chapas que começam com E.
describe('mapFuncionariosSA1 (SA1 → só empregados E)', () => {
  it('mantém só chapas E; descarta cliente A…; normaliza maiúscula', () => {
    const r = mapFuncionariosSA1([
      { matricula: 'E01047', nome: 'FULANO DE TAL' },
      { matricula: 'A00086', nome: 'HUMBERTO (cliente)' },
      { matricula: 'e2', nome: 'minúsculo vira E2' },
    ]);
    expect(r.map((x) => x.matricula)).toEqual(['E01047', 'E2']);
    expect(r[0].nome).toBe('FULANO DE TAL');
  });

  it('deduplica a mesma chapa (vem em vários endereços/lojas)', () => {
    const r = mapFuncionariosSA1([
      { matricula: 'E01047', nome: 'A' },
      { matricula: 'E01047', nome: 'A' },
      { matricula: 'E02', nome: 'B' },
    ]);
    expect(r).toHaveLength(2);
  });

  it('respeita o teto de resultados', () => {
    const itens = Array.from({ length: 40 }, (_, i) => ({ matricula: `E${i}`, nome: 'x' }));
    expect(mapFuncionariosSA1(itens, 25)).toHaveLength(25);
  });

  it('entrada inválida (não-array / vazia) → []', () => {
    expect(mapFuncionariosSA1(undefined)).toEqual([]);
    expect(mapFuncionariosSA1(null)).toEqual([]);
    expect(mapFuncionariosSA1([])).toEqual([]);
  });
});
