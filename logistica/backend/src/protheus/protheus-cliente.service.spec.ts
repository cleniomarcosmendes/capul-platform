import { ProtheusClienteService } from './protheus-cliente.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('ProtheusClienteService.mapItens (clienteEndereco SA1)', () => {
  const svc = new ProtheusClienteService();
  const map = (j: any) => (svc as any).mapItens(j) as any[];

  it('lista vazia quando total=0', () => {
    expect(map({ total: 0, itens: [] })).toEqual([]);
  });

  it('mapeia matrícula, nome, CPF, endereço e telefone (1º contato)', () => {
    const r = map({
      total: 1,
      itens: [
        {
          matricula: 'E01047',
          loja: '01',
          nome: 'FULANO DE TAL',
          cpfcnpj: '12345678901',
          endereco: { logrado: 'RUA EXEMPLO, 100', complem: 'APTO 1', bairro: 'CENTRO', municip: 'ITUIUTABA', munIBGE: '3134400', uf: 'MG', cep: '38300000' },
          contatos: [{ numero: '34999990000' }, { numero: '34988881111' }],
        },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].matricula).toBe('E01047');
    expect(r[0].nome).toBe('FULANO DE TAL');
    expect(r[0].cpfCnpj).toBe('12345678901');
    expect(r[0].telefone).toBe('34999990000'); // 1º contato não-vazio
    expect(r[0].enderecos).toHaveLength(1);
    expect(r[0].enderecos[0]).toMatchObject({
      logradouro: 'RUA EXEMPLO, 100', complemento: 'APTO 1', bairro: 'CENTRO', cidade: 'ITUIUTABA', uf: 'MG', cep: '38300000',
    });
  });

  it('múltiplos itens (busca por telefone/nome) viram vários clientes', () => {
    const r = map({
      total: 2,
      itens: [
        { matricula: 'E01', nome: 'A', endereco: { logrado: 'RUA A' }, contatos: [] },
        { matricula: 'E02', nome: 'B', endereco: { logrado: 'RUA B' }, contatos: [{ numero: '3499' }] },
      ],
    });
    expect(r).toHaveLength(2);
    expect(r[0].telefone).toBeNull(); // contatos vazio
    expect(r[1].telefone).toBe('3499');
    expect(r[1].enderecos[0].logradouro).toBe('RUA B');
  });

  it('sem endereço (logrado vazio) → enderecos vazio, sem quebrar', () => {
    const r = map({ total: 1, itens: [{ matricula: 'E09', nome: 'SEM END', endereco: {}, contatos: [] }] });
    expect(r[0].enderecos).toEqual([]);
  });

  it('AGRUPA a mesma matrícula com vários endereços/lojas em 1 cliente', () => {
    const r = map({
      total: 4,
      itens: [
        { matricula: 'A00086', nome: 'HUMBERTO', endereco: { logrado: 'FAZ. CAPAO, SN', municip: 'UNAI', uf: 'MG' }, contatos: [{ numero: '3499' }] },
        { matricula: 'A00086', nome: 'HUMBERTO', endereco: { logrado: 'FAZ. BOQUEIRAO, SN', municip: 'UNAI', uf: 'MG' }, contatos: [] },
        { matricula: 'A00086', nome: 'HUMBERTO', endereco: { logrado: 'FAZENDA RIO GRANDE, SN', municip: 'ITUPIRANGA', uf: 'PA' }, contatos: [] },
        // duplicado exato (mesmo logradouro/cidade/cep) → não repete
        { matricula: 'A00086', nome: 'HUMBERTO', endereco: { logrado: 'FAZ. CAPAO, SN', municip: 'UNAI', uf: 'MG' }, contatos: [] },
      ],
    });
    expect(r).toHaveLength(1); // 1 cliente, não 4
    expect(r[0].matricula).toBe('A00086');
    expect(r[0].telefone).toBe('3499'); // herda do 1º contato não-vazio
    expect(r[0].enderecos).toHaveLength(3); // 3 endereços distintos (o 4º é duplicado)
  });
});
