import { efeitoDeDescartar, efeitoDeDuplicar } from './efeito-de-versionar.js';

describe('duplicar versão — um rascunho por modelo', () => {
  it('permite quando não há rascunho, e a frase diz que a publicada não muda', () => {
    const e = efeitoDeDuplicar({
      modeloNome: 'Administrativo',
      versaoOrigem: 1,
      rascunhoExistente: null,
    });
    expect(e.acao).toBe('PERMITIR');
    expect(e.frase).toMatch(/A v1 continua valendo/);
    expect(e.frase).toMatch(/nenhum ciclo muda/);
  });

  /**
   * ⚠️ Com dois rascunhos, "o rascunho do Administrativo" deixa de ter
   * referente — e o custo de escolher errado é publicar o arranjo errado.
   */
  it('recusa o segundo rascunho, e diz qual é o que já existe', () => {
    const e = efeitoDeDuplicar({
      modeloNome: 'Administrativo',
      versaoOrigem: 1,
      rascunhoExistente: { versao: 2 },
    });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/v2/);
    // A recusa oferece as três saídas, senão vira beco sem saída.
    expect(e.frase).toMatch(/Continue nele/);
    expect(e.frase).toMatch(/publique/i);
    expect(e.frase).toMatch(/descarte/i);
  });
});

describe('descartar versão', () => {
  const base = { modeloNome: 'Administrativo', versao: 2, aplicacoesQueUsam: 0 };

  it('recusa versão PUBLICADA — nota já saiu sobre ela', () => {
    const e = efeitoDeDescartar({ ...base, publicada: true });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/deixaria avaliação sem/);
  });

  it('recusa rascunho em uso por aplicação — rede, caso a outra guarda ceda', () => {
    const e = efeitoDeDescartar({ ...base, publicada: false, aplicacoesQueUsam: 3 });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/3 aplicações/);
  });

  /** ⭐ Ato irreversível diz o que se PERDE — e o que NÃO se perde. */
  it('permite o rascunho livre, dizendo o que se perde e o que não', () => {
    const e = efeitoDeDescartar({ ...base, publicada: false });
    expect(e.acao).toBe('PERMITIR');
    expect(e.frase).toMatch(/Não desfaz/);
    expect(e.frase).toMatch(/questões continuam no acervo/);
    expect(e.frase).toMatch(/Nenhuma versão publicada é tocada/);
  });
});
