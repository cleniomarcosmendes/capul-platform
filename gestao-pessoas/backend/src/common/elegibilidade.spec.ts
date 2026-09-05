import {
  FILTRO_SRA010_ELEGIVEL,
  SITUACOES,
  SITUACOES_ELEGIVEIS,
  elegivel,
  elegivelNoProtheus,
  situacaoDoProtheus,
} from './elegibilidade.js';

/**
 * ⭐ O teste que impede a divergência: o filtro do SYNC (no Protheus) e o
 * predicado da APLICAÇÃO (sobre o nosso enum) têm de responder a mesma coisa
 * para toda combinação possível. Critérios de "ativo" divergentes espalhados
 * pelo código foi como o select antigo começou a errar.
 */
describe('elegibilidade — definição única de "ativo"', () => {
  const DELECAO = [' ', '*'];
  const DEMISSOES = ['', ' ', '20250320'];
  const SITFOLH = [' ', '', 'F', 'A', 'D', 'X'];

  it('o mapeamento Protheus -> enum concorda com o filtro do Protheus, sempre', () => {
    let casos = 0;
    for (const del of DELECAO) {
      for (const dem of DEMISSOES) {
        for (const sit of SITFOLH) {
          const linha = { D_E_L_E_T_: del, RA_DEMISSA: dem, RA_SITFOLH: sit };
          const passaNoProtheus = elegivelNoProtheus(linha);
          const passaNaAplicacao = del === ' ' && elegivel(situacaoDoProtheus(dem, sit));
          expect({ ...linha, passaNoProtheus }).toEqual({ ...linha, passaNoProtheus: passaNaAplicacao });
          casos++;
        }
      }
    }
    expect(casos).toBe(36);
  });

  it('ATIVO não é só "situacao = ATIVO": férias e afastamento contam', () => {
    // Medido no Protheus em 05/09/2026: dos 1.036 elegíveis, 98 estão em férias
    // e 47 afastados. Filtrar por situacao === 'ATIVO' derrubaria 145 pessoas
    // de todas as listas do módulo, sem mensagem nenhuma.
    expect(elegivel('FERIAS')).toBe(true);
    expect(elegivel('AFASTADO')).toBe(true);
    expect(elegivel('ATIVO')).toBe(true);
    expect(elegivel('DEMITIDO')).toBe(false);
  });

  it('demissão preenchida vence a situação de folha', () => {
    expect(situacaoDoProtheus('20250320', ' ')).toBe('DEMITIDO');
    expect(situacaoDoProtheus('20250320', 'F')).toBe('DEMITIDO');
  });

  it('traduz as situações de folha conhecidas', () => {
    expect(situacaoDoProtheus(' ', ' ')).toBe('ATIVO');
    expect(situacaoDoProtheus(' ', 'F')).toBe('FERIAS');
    expect(situacaoDoProtheus(' ', 'A')).toBe('AFASTADO');
    expect(situacaoDoProtheus(' ', 'D')).toBe('DEMITIDO');
  });

  it('situação desconhecida não vira demissão por acidente', () => {
    // Código novo na folha não pode sumir com a pessoa do módulo em silêncio.
    expect(situacaoDoProtheus(' ', 'X')).toBe('ATIVO');
  });

  it('elegíveis são exatamente as situações que não são demissão', () => {
    expect([...SITUACOES_ELEGIVEIS].sort()).toEqual(
      SITUACOES.filter((s) => s !== 'DEMITIDO').sort(),
    );
  });

  it('o filtro do Protheus continua sendo o do sync — mudou aqui, mudou nos três pontos', () => {
    expect(FILTRO_SRA010_ELEGIVEL).toBe(
      "D_E_L_E_T_ = ' ' AND RA_DEMISSA = ' ' AND RA_SITFOLH <> 'D'",
    );
  });
});
