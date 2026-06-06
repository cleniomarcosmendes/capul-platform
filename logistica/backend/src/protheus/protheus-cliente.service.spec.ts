import { ProtheusClienteService } from './protheus-cliente.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('ProtheusClienteService.mapGetLimite', () => {
  const svc = new ProtheusClienteService();
  const map = (j: any, mat: string) => (svc as any).mapGetLimite(j, mat) as any;

  it('retorna null quando a matrícula echo diverge (cai no CLIENTE PADRÃO)', () => {
    const r = map({ matricula: '000001', nome: 'CLIENTE PADRAO', cadastrosativos: [] }, 'E01047');
    expect(r).toBeNull();
  });

  it('mapeia nome, telefone (sem zero do DDD), CPF e endereço deduplicado', () => {
    const r = map(
      {
        matricula: 'E01047',
        nome: 'FULANO  ',
        manutencaocompartilhada: { ddd: '038', tel: '999990000', endcob: 'RUA X 10 APTO 1', bairroc: 'CENTRO', munc: 'UNAI', estc: 'MG', cepc: '38600000' },
        cadastrosativos: [{ loja: '0001', endereco: 'RUA X, 10 AP 1', cgc: '11122233344', municipio: 'UNAI', estado: 'MG' }],
      },
      'E01047',
    );
    expect(r).not.toBeNull();
    expect(r.nome).toBe('FULANO');
    expect(r.telefone).toBe('38999990000'); // "038" perde o zero de discagem
    expect(r.cpfCnpj).toBe('11122233344');
    // cobrança "RUA X 10 APTO 1" e loja "RUA X, 10 AP 1" são o MESMO endereço → dedup p/ 1
    expect(r.enderecos).toHaveLength(1);
    expect(r.enderecos[0].bairro).toBe('CENTRO'); // cobrança (mais completa) vence
    expect(r.enderecos[0].cep).toBe('38600000');
  });

  it('aceita matrícula echo com case/espaços diferentes', () => {
    const r = map({ matricula: ' e01047 ', nome: 'F', cadastrosativos: [] }, 'E01047');
    expect(r).not.toBeNull();
    expect(r.matricula).toBe('e01047');
  });
});
