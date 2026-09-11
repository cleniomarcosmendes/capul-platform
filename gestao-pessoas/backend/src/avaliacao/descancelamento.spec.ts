/**
 * ⭐⭐ DESCANCELAR — as quatro decisões de política de 11/09, cada uma com teste.
 *
 * Até aqui `CANCELADA` não voltava por caminho nenhum, e o modal do **Excluir**
 * prometia que o **Incluir** revertia. Este spec guarda as regras que a resposta
 * do RH fixou — não a forma do JSON.
 */
import {
  efeitoDoDescancelamento,
  estadoAoVoltar,
  fraseDoDescancelamento,
  type AvaliacaoParaDescancelar,
} from './descancelamento.js';

function cancelada(over: Partial<AvaliacaoParaDescancelar> = {}): AvaliacaoParaDescancelar {
  return {
    status: 'CANCELADA',
    respostas: 0,
    motivoCancelamento: 'Excluído do ciclo pelo RH: saiu da empresa.',
    origemCancelamento: 'DECISAO_RH',
    ...over,
  };
}

describe('(a) o estado ao voltar vem do DADO, não é fixo', () => {
  it('sem resposta nenhuma volta PENDENTE', () => {
    expect(estadoAoVoltar(0)).toBe('PENDENTE');
  });

  it('com resposta volta EM_ANDAMENTO — o trabalho já feito continua lá', () => {
    expect(estadoAoVoltar(1)).toBe('EM_ANDAMENTO');
    expect(estadoAoVoltar(11)).toBe('EM_ANDAMENTO');
  });

  it('e é essa regra que decide o efeito, não uma constante', () => {
    expect(efeitoDoDescancelamento(cancelada({ respostas: 4 }), 'DECISAO_RH')).toMatchObject({
      acao: 'DESCANCELAR',
      status: 'EM_ANDAMENTO',
    });
    expect(efeitoDoDescancelamento(cancelada({ respostas: 0 }), 'DECISAO_RH')).toMatchObject({
      acao: 'DESCANCELAR',
      status: 'PENDENTE',
    });
  });

  /**
   * ⚠️ Voltar para PENDENTE uma avaliação com resposta mentiria para o
   * avaliador: ele abriria "não começou" e encontraria trabalho feito.
   */
  it('NUNCA devolve PENDENTE quando há resposta gravada', () => {
    for (const n of [1, 2, 5, 14]) {
      expect(efeitoDoDescancelamento(cancelada({ respostas: n }), 'DECISAO_RH').status).not.toBe(
        'PENDENTE',
      );
    }
  });
});

describe('(c) a granularidade é a do ATO que causou o cancelamento', () => {
  it('o Incluir desfaz o que o RH excluiu linha a linha', () => {
    expect(efeitoDoDescancelamento(cancelada(), 'DECISAO_RH').acao).toBe('DESCANCELAR');
  });

  it('o desfazer em massa desfaz o que o encerramento cancelou', () => {
    const doEncerramento = cancelada({ origemCancelamento: 'ENCERRAMENTO' });
    expect(efeitoDoDescancelamento(doEncerramento, 'ENCERRAMENTO').acao).toBe('DESCANCELAR');
  });

  /**
   * ⭐⭐ O cruzamento é o que o campo de origem existe para impedir: o Incluir
   * de UMA pessoa não pode ressuscitar o que o encerramento do ciclo cancelou —
   * é outro ato, com outro motivo, e desfazê-lo é outra decisão.
   */
  it('o Incluir RECUSA o que veio do encerramento — e diz onde se desfaz', () => {
    const e = efeitoDoDescancelamento(cancelada({ origemCancelamento: 'ENCERRAMENTO' }), 'DECISAO_RH');
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/ENCERRAMENTO do ciclo/i);
    expect(e.frase).toMatch(/tela do ciclo/i);
  });

  it('e o desfazer em massa RECUSA o que o RH excluiu — mandando para o Incluir', () => {
    const e = efeitoDoDescancelamento(cancelada({ origemCancelamento: 'DECISAO_RH' }), 'ENCERRAMENTO');
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/Incluir/);
    expect(e.frase).toMatch(/Designação/);
  });
});

describe('(d) a origem é campo, não texto', () => {
  /**
   * ⚠️ Dava para distinguir por `motivoCancelamento LIKE 'Excluído%'`. Seria
   * errado: comportamento decidido por prefixo de frase quebra no dia em que
   * alguém melhora a redação — e quebra calado.
   */
  it('o motivo NÃO decide nada — só a origem decide', () => {
    const textoDeExcluir = cancelada({
      motivoCancelamento: 'Excluído do ciclo pelo RH: qualquer coisa.',
      origemCancelamento: 'ENCERRAMENTO',
    });
    // texto diz "Excluído", origem diz ENCERRAMENTO: quem manda é a origem
    expect(efeitoDoDescancelamento(textoDeExcluir, 'DECISAO_RH').acao).toBe('RECUSAR');
    expect(efeitoDoDescancelamento(textoDeExcluir, 'ENCERRAMENTO').acao).toBe('DESCANCELAR');
  });

  it('origem ausente RECUSA — não se adivinha qual ato desfazer', () => {
    const e = efeitoDoDescancelamento(cancelada({ origemCancelamento: null }), 'DECISAO_RH');
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/sem registro de qual ato/i);
  });
});

describe('o que não é cancelamento não vira erro', () => {
  it('sem avaliação: nada a fazer — o Incluir serve a quem a régua excluiu sem avaliação', () => {
    expect(efeitoDoDescancelamento(null, 'DECISAO_RH').acao).toBe('NADA_A_FAZER');
  });

  it.each(['PENDENTE', 'EM_ANDAMENTO', 'ENVIADA'])('avaliação %s: nada a fazer', (status) => {
    expect(efeitoDoDescancelamento(cancelada({ status }), 'DECISAO_RH').acao).toBe('NADA_A_FAZER');
  });
});

describe('a frase da confirmação diz o que volta, com número', () => {
  it('com respostas, cita quantas e que nada foi apagado', () => {
    const f = fraseDoDescancelamento(cancelada({ respostas: 4 }));
    expect(f).toContain('4');
    expect(f).toMatch(/EM ANDAMENTO/);
    expect(f).toMatch(/[Nn]ada foi apagado/);
  });

  /**
   * ⚠️ O invariante `texto-sem-flexao` pegou este erro em mim na primeira
   * escrita — eu tinha posto "com as ${n} respostas". Com n=1 sai "as 1
   * respostas". O número vai como VALOR DE RÓTULO.
   */
  it('e com UMA resposta a frase não quebra a concordância', () => {
    const f = fraseDoDescancelamento(cancelada({ respostas: 1 }));
    expect(f).not.toMatch(/\b1 respostas/);
    expect(f).toMatch(/Respostas já gravadas: 1/);
  });

  /** Nem "as 0 respostas", nem "EM ANDAMENTO" para quem não começou. */
  it('sem respostas, não inventa "as 0 respostas"', () => {
    const f = fraseDoDescancelamento(cancelada({ respostas: 0 }));
    expect(f).toMatch(/PENDENTE/);
    expect(f).not.toContain('0 resposta');
  });
});
