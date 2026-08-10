import { mapFuncionarios } from './protheus-funcionario.service';

/**
 * A busca de funcionário do cadastro de usuário passou a usar o `infoFuncionario`
 * (INFOCLIENTES/infoPortal) — o cadastro de COLABORADOR.
 *
 * Antes usava `clienteEndereco` (SA1 = CLIENTES) e ficava com as linhas cujo código
 * começa com "E", como heurística de empregado. Fonte errada: a matrícula gravada é o
 * que liga o login à pessoa no Protheus (o `loginPortal` valida por ela, e a Logística
 * tira dela o departamento que responde pelas despesas). Corrigido em 09/08/2026.
 */
describe('mapFuncionarios — resposta do infoFuncionario', () => {
  it('lê funcionarios[] e faz trim (campos do Protheus vêm com espaço à direita)', () => {
    const r = mapFuncionarios({ funcionarios: [{ matricula: 'E01047 ', nome: '  FULANO DE TAL  ', cc: '11010204' }] });
    expect(r).toEqual([{ matricula: 'E01047', nome: 'FULANO DE TAL' }]);
  });

  it('"não encontrado" (sem funcionarios[]) → lista vazia', () => {
    expect(mapFuncionarios({ mensagem: 'Funcionario nao encontrado' })).toEqual([]);
  });

  it('payload inesperado/nulo → lista vazia (não quebra a tela)', () => {
    expect(mapFuncionarios(null)).toEqual([]);
    expect(mapFuncionarios({ itens: [{ matricula: 'A0001', nome: 'CLIENTE' }] })).toEqual([]);
  });

  it('dedup por matrícula e teto de resultados', () => {
    const itens = [
      { matricula: 'E001', nome: 'A' }, { matricula: 'E001', nome: 'A' },
      { matricula: 'E002', nome: 'B' }, { matricula: 'E003', nome: 'C' },
    ];
    expect(mapFuncionarios({ funcionarios: itens })).toHaveLength(3);
    expect(mapFuncionarios({ funcionarios: itens }, 2)).toHaveLength(2);
  });

  // Sem nome não dá para confirmar quem é — e confirmar é o propósito do campo.
  it('linha sem nome ou sem matrícula é descartada', () => {
    expect(mapFuncionarios({ funcionarios: [{ matricula: 'E01', nome: '  ' }, { nome: 'SEM CHAPA' }] })).toEqual([]);
  });
});
