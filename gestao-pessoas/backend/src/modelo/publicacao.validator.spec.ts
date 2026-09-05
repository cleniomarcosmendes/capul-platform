import {
  ModeloNaoPublicavelError,
  assertModeloPublicavel,
  validarCriteriosDoModelo,
  type CriterioDoGrupo,
  type GrupoParaPublicacao,
} from './publicacao.validator.js';
import { codigosRegistrados } from '../calculo/resolvers/registry.js';

const criterio = (over: Partial<CriterioDoGrupo> = {}): CriterioDoGrupo => ({
  codigo: 'ESCOLARIDADE',
  nome: 'Escolaridade',
  origem: 'CALCULADO',
  codigoCalculo: 'ESCOLARIDADE',
  ativo: true,
  ...over,
});

const manual = (titulo = 'Assiduidade'): GrupoParaPublicacao => ({ titulo, origem: 'MANUAL' });
const automatico = (over: Partial<CriterioDoGrupo> = {}, titulo = 'Escolaridade'): GrupoParaPublicacao => ({
  titulo,
  origem: 'AUTOMATICO',
  criterio: criterio(over),
});

describe('validação de publicação do modelo', () => {
  it('aprova um modelo com grupo manual e os quatro critérios calculados do seed', () => {
    const grupos = [
      manual(),
      automatico({ codigo: 'ESCOLARIDADE', codigoCalculo: 'ESCOLARIDADE' }, 'Escolaridade'),
      automatico({ codigo: 'TEMPO_EMPRESA', codigoCalculo: 'TEMPO_EMPRESA' }, 'Tempo de Empresa'),
      automatico({ codigo: 'TEMPO_FUNCAO', codigoCalculo: 'TEMPO_FUNCAO' }, 'Tempo na Função'),
      automatico({ codigo: 'QTDE_TREINAMENTO', codigoCalculo: 'QTDE_TREINAMENTO' }, 'Treinamentos'),
    ];
    expect(validarCriteriosDoModelo(grupos)).toEqual([]);
    expect(() => assertModeloPublicavel(grupos)).not.toThrow();
  });

  describe('o defeito que esta validação existe para impedir', () => {
    it('recusa código de cálculo que não tem resolver — o caso do silêncio', () => {
      // Um caractere trocado no cadastro do RH bastaria: sem esta guarda, o
      // critério devolveria vazio para TODOS os avaliados, o grupo sairia da
      // renormalização e a nota final mudaria sem erro nenhum.
      const problemas = validarCriteriosDoModelo([automatico({ codigoCalculo: 'ESCOLARIDADEE' })]);
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toContain('ESCOLARIDADEE');
      expect(problemas[0]).toContain('não existe no sistema');
    });

    it('a mensagem lista os códigos disponíveis, para o RH saber o que digitar', () => {
      const [problema] = validarCriteriosDoModelo([automatico({ codigoCalculo: 'INVENTADO' })]);
      for (const codigo of codigosRegistrados()) expect(problema).toContain(codigo);
    });

    it('recusa critério CALCULADO sem código de cálculo', () => {
      expect(validarCriteriosDoModelo([automatico({ codigoCalculo: null })])[0]).toContain(
        'sem código de cálculo',
      );
      expect(validarCriteriosDoModelo([automatico({ codigoCalculo: '   ' })])).toHaveLength(1);
    });
  });

  describe('coerência entre grupo e catálogo', () => {
    it('recusa grupo AUTOMÁTICO sem critério', () => {
      expect(
        validarCriteriosDoModelo([{ titulo: 'Escolaridade', origem: 'AUTOMATICO' }])[0],
      ).toContain('não aponta para nenhum critério');
    });

    it('recusa grupo MANUAL com critério pendurado — seria ignorado no cálculo', () => {
      expect(
        validarCriteriosDoModelo([{ titulo: 'Assiduidade', origem: 'MANUAL', criterio: criterio() }])[0],
      ).toContain('é MANUAL');
    });

    it('recusa critério INATIVO no catálogo', () => {
      expect(validarCriteriosDoModelo([automatico({ ativo: false })])[0]).toContain('INATIVO');
    });

    it('recusa critério INFORMADO que ficou com código de cálculo', () => {
      // Sobra de quem trocou a origem depois de cadastrar: o valor viria da
      // importação e o código seria ignorado em silêncio.
      const problemas = validarCriteriosDoModelo([
        automatico({ origem: 'INFORMADO', codigoCalculo: 'TEMPO_EMPRESA' }),
      ]);
      expect(problemas[0]).toContain('é INFORMADO');
    });

    it('aceita critério INFORMADO sem código de cálculo', () => {
      expect(
        validarCriteriosDoModelo([automatico({ origem: 'INFORMADO', codigoCalculo: null })]),
      ).toEqual([]);
    });

    it('recusa modelo sem nenhum grupo', () => {
      expect(validarCriteriosDoModelo([])[0]).toContain('nenhum grupo');
    });
  });

  it('junta TODOS os problemas em vez de parar no primeiro', () => {
    const problemas = validarCriteriosDoModelo([
      automatico({ codigoCalculo: 'NAO_EXISTE' }, 'A'),
      automatico({ ativo: false }, 'B'),
      { titulo: 'C', origem: 'AUTOMATICO' },
    ]);
    expect(problemas).toHaveLength(3);
    expect(problemas.map((p) => p.slice(0, 9))).toEqual(['Grupo "A"', 'Grupo "B"', 'Grupo "C"']);
  });

  it('assertModeloPublicavel lança com a lista de problemas anexa', () => {
    try {
      assertModeloPublicavel([automatico({ codigoCalculo: 'NAO_EXISTE' })]);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(ModeloNaoPublicavelError);
      expect((e as ModeloNaoPublicavelError).problemas).toHaveLength(1);
    }
  });
});
