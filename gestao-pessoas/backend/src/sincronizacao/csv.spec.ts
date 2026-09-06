import { dataOpcional, dividirLinha, lerCsv, obrigatorio, opcional } from './csv.js';

describe('dividirLinha', () => {
  it('divide campos simples', () => {
    expect(dividirLinha('01,001741,JOAO')).toEqual(['01', '001741', 'JOAO']);
  });

  it('respeita vírgula dentro de aspas', () => {
    // Nome com vírgula é comum em export de ERP.
    expect(dividirLinha('01,"SILVA, JOAO",M')).toEqual(['01', 'SILVA, JOAO', 'M']);
  });

  it('trata aspas escapadas', () => {
    expect(dividirLinha('a,"diz ""oi""",b')).toEqual(['a', 'diz "oi"', 'b']);
  });

  it('faz trim — campo do Protheus é de largura fixa', () => {
    expect(dividirLinha('  01  ,  001741  ')).toEqual(['01', '001741']);
  });

  it('campo vazio continua sendo campo', () => {
    expect(dividirLinha('01,,03')).toEqual(['01', '', '03']);
  });
});

describe('lerCsv', () => {
  const csv = 'FILIAL,MATRICULA,NOME\n01,001741,"SILVA, JOAO"\n02,001069,MARIA';

  it('usa a primeira linha como cabeçalho, normalizado', () => {
    expect(lerCsv(csv)).toEqual([
      { filial: '01', matricula: '001741', nome: 'SILVA, JOAO' },
      { filial: '02', matricula: '001069', nome: 'MARIA' },
    ]);
  });

  it('aceita CRLF e ignora linha em branco no fim', () => {
    expect(lerCsv('A,B\r\n1,2\r\n\r\n')).toEqual([{ a: '1', b: '2' }]);
  });

  it('remove o BOM que o Excel põe', () => {
    expect(lerCsv('﻿A,B\n1,2')[0]).toEqual({ a: '1', b: '2' });
  });

  it('normaliza espaço no nome da coluna', () => {
    expect(Object.keys(lerCsv('DATA ADMISSAO,X\n1,2')[0])).toContain('data_admissao');
  });

  it('⭐ recusa linha com contagem de campos diferente do cabeçalho', () => {
    // Arquivo truncado ou separador errado importaria torto e em silêncio —
    // com os valores deslocados uma coluna, que é pior do que não importar.
    expect(() => lerCsv('A,B,C\n1,2')).toThrow(/2 campos, mas o cabeçalho tem 3/);
  });

  it('arquivo vazio ou só com cabeçalho não quebra', () => {
    expect(lerCsv('')).toEqual([]);
    expect(lerCsv('A,B')).toEqual([]);
  });
});

describe('obrigatorio / opcional / dataOpcional', () => {
  it('obrigatório recusa vazio dizendo qual campo e onde', () => {
    expect(() => obrigatorio({ mat: '  ' }, 'mat', 'linha 7')).toThrow(/linha 7.*"mat"/);
  });

  it('opcional devolve null em vez de string vazia', () => {
    expect(opcional({ x: '   ' }, 'x')).toBeNull();
    expect(opcional({}, 'y')).toBeNull();
    expect(opcional({ x: '45' }, 'x')).toBe('45');
  });

  it('data converte AAAAMMDD e trata o vazio do Protheus', () => {
    expect(dataOpcional('20231101')?.toISOString().slice(0, 10)).toBe('2023-11-01');
    expect(dataOpcional(' ')).toBeNull();
    expect(dataOpcional('')).toBeNull();
    expect(dataOpcional(null)).toBeNull();
    expect(dataOpcional('2023-11-01')).toBeNull();
  });
});
