import {
  CATEGORIAS_INELEGIVEIS,
  POLITICA_PADRAO,
  avaliarElegibilidade,
  montarListaInicial,
  type CandidatoDesignacao,
} from './elegibilidade-ciclo.js';

const pessoa = (over: Partial<CandidatoDesignacao> = {}): CandidatoDesignacao => ({
  colaboradorId: 'c1',
  matricula: '001741',
  nome: 'JOAO LUIZ BARBOSA DA SILVA',
  categoriaFuncional: 'M',
  situacaoNaDataBase: 'ATIVO',
  ...over,
});

describe('elegibilidade do ciclo', () => {
  it('mensalista ativo entra', () => {
    expect(avaliarElegibilidade(pessoa())).toEqual({
      elegivel: true, motivo: null, justificativa: null,
    });
  });

  describe('⭐ Presidente e Vice — regra FIXA, nunca configurável', () => {
    it('categoria P é sempre excluída', () => {
      const r = avaliarElegibilidade(pessoa({ categoriaFuncional: 'P' }));
      expect(r).toMatchObject({ elegivel: false, motivo: 'CARGO_INELEGIVEL' });
      expect(r.justificativa).toContain('diretoria estatutária');
    });

    it('nenhuma política do ciclo a reverte', () => {
      // Virar parâmetro abriria a porta para alguém "configurar" a própria
      // saída do ciclo.
      expect(
        avaliarElegibilidade(pessoa({ categoriaFuncional: 'P' }), { incluirAfastados: true }).elegivel,
      ).toBe(false);
      expect(CATEGORIAS_INELEGIVEIS).toEqual(['P']);
    });

    it('não se confunde com maiúscula/minúscula ou espaço do campo fixo do Protheus', () => {
      expect(avaliarElegibilidade(pessoa({ categoriaFuncional: ' p ' })).elegivel).toBe(false);
    });
  });

  describe('afastados — opção do ciclo, pela situação na DATA-BASE', () => {
    it('padrão do RH é NÃO incluir', () => {
      expect(POLITICA_PADRAO.incluirAfastados).toBe(false);
      const r = avaliarElegibilidade(pessoa({ situacaoNaDataBase: 'AFASTADO' }));
      expect(r).toMatchObject({ elegivel: false, motivo: 'REGRA_CICLO' });
      expect(r.justificativa).toContain('data-base');
    });

    it('com a opção ligada, entram', () => {
      expect(
        avaliarElegibilidade(pessoa({ situacaoNaDataBase: 'AFASTADO' }), { incluirAfastados: true })
          .elegivel,
      ).toBe(true);
    });

    it('FÉRIAS entra sempre — é transitório, a pessoa está no quadro', () => {
      // 98 pessoas em férias em 05/09/2026. Confundir férias com afastamento
      // tiraria gente do ciclo sem ninguém pedir.
      expect(avaliarElegibilidade(pessoa({ situacaoNaDataBase: 'FERIAS' })).elegivel).toBe(true);
      expect(
        avaliarElegibilidade(pessoa({ situacaoNaDataBase: 'FERIAS' }), { incluirAfastados: false })
          .elegivel,
      ).toBe(true);
    });

    it('demitido na data-base não entra, mesmo com afastados incluídos', () => {
      expect(
        avaliarElegibilidade(pessoa({ situacaoNaDataBase: 'DEMITIDO' }), { incluirAfastados: true }),
      ).toMatchObject({ elegivel: false, motivo: 'REGRA_CICLO' });
    });
  });

  describe('⭐ aprendizes entram normalmente — não há régua binária', () => {
    it('categoria de aprendiz não é motivo de exclusão', () => {
      // 31 pessoas. O recorte certo não é incluir/excluir: é uma APLICAÇÃO
      // própria, sem critérios cadastrais — o aprendiz está no piso de
      // escolaridade, tempo de casa e cursos por definição, e seria avaliado
      // pela idade em vez do desempenho. Ver docs/OBSERVACAO_RH_APRENDIZES.md.
      expect(avaliarElegibilidade(pessoa({ categoriaFuncional: 'M' })).elegivel).toBe(true);
    });
  });

  describe('montarListaInicial — devolve os dois lados', () => {
    const candidatos = [
      pessoa({ colaboradorId: 'a', categoriaFuncional: 'M' }),
      pessoa({ colaboradorId: 'b', categoriaFuncional: 'P' }),
      pessoa({ colaboradorId: 'c', situacaoNaDataBase: 'AFASTADO' }),
      pessoa({ colaboradorId: 'd', situacaoNaDataBase: 'FERIAS' }),
    ];

    it('⭐ ninguém some: o excluído volta com motivo e justificativa', () => {
      const { incluidos, excluidos } = montarListaInicial(candidatos);
      expect(incluidos.map((c) => c.colaboradorId)).toEqual(['a', 'd']);
      expect(excluidos.map((c) => c.colaboradorId)).toEqual(['b', 'c']);
      expect(excluidos.every((e) => e.motivo && e.justificativa)).toBe(true);
    });

    it('incluídos + excluídos = todos os candidatos', () => {
      const { incluidos, excluidos } = montarListaInicial(candidatos);
      expect(incluidos.length + excluidos.length).toBe(candidatos.length);
    });

    it('a política do ciclo muda a lista, e o motivo diz qual foi', () => {
      const { incluidos, excluidos } = montarListaInicial(candidatos, { incluirAfastados: true });
      expect(incluidos.map((c) => c.colaboradorId)).toEqual(['a', 'c', 'd']);
      expect(excluidos).toHaveLength(1);
      expect(excluidos[0].motivo).toBe('CARGO_INELEGIVEL');
    });
  });
});
