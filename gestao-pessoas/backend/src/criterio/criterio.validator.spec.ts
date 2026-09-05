import {
  CriterioInvalidoError,
  assertCriterioSalvavel,
  validarCriterio,
  validarCriterioEmUso,
  type CriterioValidavel,
} from './criterio.validator.js';
import { codigosRegistrados } from '../calculo/resolvers/registry.js';

const criterio = (over: Partial<CriterioValidavel> = {}): CriterioValidavel => ({
  codigo: 'ESCOLARIDADE',
  nome: 'Escolaridade',
  origem: 'CALCULADO',
  codigoCalculo: 'ESCOLARIDADE',
  ativo: true,
  ...over,
});

describe('validação do critério — a mesma função nos três momentos', () => {
  it('aprova os quatro critérios calculados do catálogo', () => {
    for (const codigo of codigosRegistrados()) {
      expect(validarCriterio(criterio({ codigo, codigoCalculo: codigo }))).toEqual([]);
    }
  });

  describe('o defeito que a validação existe para impedir', () => {
    it('recusa código de cálculo sem resolver — o caso do silêncio', () => {
      const [problema] = validarCriterio(criterio({ codigoCalculo: 'ESCOLARIDADEE' }));
      expect(problema).toContain('ESCOLARIDADEE');
      expect(problema).toContain('não existe no sistema');
      expect(problema).toContain('em branco para todos os avaliados');
    });

    it('a mensagem lista os códigos disponíveis, para o RH saber o que digitar', () => {
      const [problema] = validarCriterio(criterio({ codigoCalculo: 'INVENTADO' }));
      for (const codigo of codigosRegistrados()) expect(problema).toContain(codigo);
    });

    it('recusa CALCULADO sem código', () => {
      expect(validarCriterio(criterio({ codigoCalculo: null }))[0]).toContain('sem código de cálculo');
      expect(validarCriterio(criterio({ codigoCalculo: '   ' }))).toHaveLength(1);
    });

    it('recusa INFORMADO que ficou com código de cálculo de quando era CALCULADO', () => {
      expect(validarCriterio(criterio({ origem: 'INFORMADO' }))[0]).toContain('é INFORMADO');
    });

    it('aceita INFORMADO sem código de cálculo', () => {
      expect(validarCriterio(criterio({ origem: 'INFORMADO', codigoCalculo: null }))).toEqual([]);
    });
  });

  describe('momento 1 — salvar no catálogo (o mais barato)', () => {
    it('lança na hora em que o RH erra, não semanas depois', () => {
      expect(() => assertCriterioSalvavel(criterio({ codigoCalculo: 'ERRADO' }))).toThrow(
        CriterioInvalidoError,
      );
    });

    it('NÃO exige ativo: guardar um critério desligado é legítimo', () => {
      // É assim que QTDE_TREINAMENTO fica no catálogo enquanto o RH não explica
      // por que o registro de cursos parou.
      expect(() => assertCriterioSalvavel(criterio({ ativo: false }))).not.toThrow();
    });
  });

  describe('momentos 2 e 3 — Aplicação e abertura do ciclo', () => {
    it('EXIGE ativo: critério desligado não entra em uso', () => {
      expect(validarCriterioEmUso(criterio({ ativo: false }), 'Aplicação "X"')[0]).toContain('INATIVO');
    });

    it('diz onde o problema está, e não só qual é', () => {
      expect(validarCriterioEmUso(criterio({ codigoCalculo: 'X' }), 'Aplicação "Loja"')[0]).toContain(
        'Aplicação "Loja"',
      );
    });
  });
});
