import { filialAtualPorMatricula, mapearColaboradores } from './mapeamento.js';
import type { ColaboradorDaFonte } from './fonte.port.js';

const linha = (over: Partial<ColaboradorDaFonte> = {}): ColaboradorDaFonte => ({
  filial: '01',
  matricula: '001741',
  nome: 'JOAO LUIZ BARBOSA DA SILVA',
  dataAdmissao: '20060801',
  dataDemissao: ' ',
  situacaoFolha: ' ',
  categoriaFuncional: 'M',
  grauInstrucaoCodigo: '45',
  ...over,
});

describe('mapearColaboradores', () => {
  it('aceita o mensalista ativo', () => {
    const { aceitos, recusados } = mapearColaboradores([linha()]);
    expect(recusados).toEqual([]);
    expect(aceitos[0]).toMatchObject({ matricula: '001741', situacao: 'ATIVO', dataAdmissao: '20060801' });
  });

  describe('⭐ população: autônomo fora, pelo CAMPO e não pelo formato da matrícula', () => {
    it('recusa categoria A com motivo', () => {
      // 2.756 pessoas na Capul: cooperados e produtores, no cadastro por
      // pagamento e não por vínculo.
      const { aceitos, recusados } = mapearColaboradores([linha({ categoriaFuncional: 'A' })]);
      expect(aceitos).toHaveLength(0);
      expect(recusados[0]).toMatchObject({ motivo: 'AUTONOMO' });
      expect(recusados[0].detalhe).toContain('vínculo de emprego');
    });

    it('não usa o prefixo da matrícula — o select antigo acertava por coincidência', () => {
      // Matrícula começando com 9 mas categoria M: é população.
      expect(mapearColaboradores([linha({ matricula: '900001' })]).aceitos).toHaveLength(1);
      // Matrícula começando com 0 mas categoria A: não é.
      expect(mapearColaboradores([linha({ categoriaFuncional: 'A' })]).aceitos).toHaveLength(0);
    });

    it('diretoria (P) entra no sync — quem tira é a régua do CICLO, não o cadastro', () => {
      // Presidente e Vice são colaboradores; a decisão de não avaliá-los é da
      // elegibilidade do ciclo, e precisa ficar registrada lá com motivo.
      expect(mapearColaboradores([linha({ categoriaFuncional: 'P' })]).aceitos).toHaveLength(1);
    });
  });

  describe('elegibilidade usa a definição única', () => {
    it('férias e afastamento ENTRAM no cadastro', () => {
      expect(mapearColaboradores([linha({ situacaoFolha: 'F' })]).aceitos[0].situacao).toBe('FERIAS');
      expect(mapearColaboradores([linha({ situacaoFolha: 'A' })]).aceitos[0].situacao).toBe('AFASTADO');
    });

    it('demitido fica de fora, com motivo', () => {
      expect(mapearColaboradores([linha({ dataDemissao: '20250320' })]).recusados[0]).toMatchObject({
        motivo: 'NAO_ELEGIVEL',
      });
      expect(mapearColaboradores([linha({ situacaoFolha: 'D' })]).recusados).toHaveLength(1);
    });
  });

  describe('⭐ linha incompleta é RECUSADA, não importada torta', () => {
    it('sem admissão: recusa dizendo o valor que veio', () => {
      // §4.2: admissão ausente é erro de sincronização, não lacuna cadastral —
      // TEMPO_EMPRESA nunca produz semDado.
      const { recusados } = mapearColaboradores([linha({ dataAdmissao: ' ' })]);
      expect(recusados[0]).toMatchObject({ motivo: 'SEM_ADMISSAO' });
      expect(recusados[0].detalhe).toContain('ausente ou inválida');
    });

    it('recusa data de admissão em formato errado', () => {
      expect(mapearColaboradores([linha({ dataAdmissao: '2006-08-01' })]).recusados[0].motivo).toBe(
        'SEM_ADMISSAO',
      );
    });

    it('sem matrícula ou sem nome', () => {
      expect(mapearColaboradores([linha({ matricula: '  ' })]).recusados[0].motivo).toBe('SEM_MATRICULA');
      expect(mapearColaboradores([linha({ nome: '' })]).recusados[0].motivo).toBe('SEM_NOME');
    });
  });

  it('⭐ nada some: aceitos + recusados = total do arquivo', () => {
    const arquivo = [
      linha(),
      linha({ matricula: '2', categoriaFuncional: 'A' }),
      linha({ matricula: '3', dataDemissao: '20200101' }),
      linha({ matricula: '4', dataAdmissao: '' }),
    ];
    const { aceitos, recusados } = mapearColaboradores(arquivo);
    expect(aceitos.length + recusados.length).toBe(arquivo.length);
    expect(recusados.map((r) => r.motivo)).toEqual(['AUTONOMO', 'NAO_ELEGIVEL', 'SEM_ADMISSAO']);
  });

  it('campo fixo do Protheus vem com espaço: vira null, não string vazia', () => {
    const [c] = mapearColaboradores([linha({ cpf: '   ', centroCusto: ' ' })]).aceitos;
    expect(c.cpf).toBeNull();
    expect(c.centroCusto).toBeNull();
  });
});

describe('filialAtualPorMatricula', () => {
  it('mapeia só quem foi aceito — quem não é população não tem filial atual', () => {
    const { aceitos } = mapearColaboradores([
      linha({ matricula: '001741', filial: '01' }),
      linha({ matricula: '004540', filial: '18', categoriaFuncional: 'A' }),
    ]);
    const mapa = filialAtualPorMatricula(aceitos);
    expect(mapa.get('001741')).toBe('01');
    expect(mapa.has('004540')).toBe(false);
  });
});
