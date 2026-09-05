/**
 * APURAÇÃO — combina a nota do questionário com os critérios cadastrais.
 *
 *   notaFinal = [ notaAvaliacao × pesoAvaliacao + Σ(pontuação × peso) ]
 *             / [ pesoAvaliacao + Σ(peso) ]
 *
 * considerando apenas os critérios com `semDado = false` — fora do numerador
 * **e** do denominador.
 *
 * ⭐ É aqui que mora o conserto do bug mais grave do modelo antigo. Lá o `NVL`
 * ficava fora da soma e, em SQL, `NULL + n = NULL`: quem não tinha registro de
 * função saía com média zero, parecendo péssimo desempenho quando era falta de
 * cadastro. Aqui o critério sem dado simplesmente não participa, e os pesos
 * restantes se renormalizam sozinhos.
 *
 * ⭐ Não existe caso especial para "todos os critérios sem dado". Como
 * `pesoAvaliacao > 0` é exigido na montagem da Aplicação
 * (`ciclo/abertura.validator.ts`), o denominador nunca zera: sobrando só o
 * questionário, a conta vira `notaAvaliacao × p / p` = `notaAvaliacao`. A regra
 * cai da fórmula, e uma regra que cai da fórmula é uma regra a menos para
 * alguém lembrar.
 *
 * ⚠️ Apurar é etapa SEPARADA de avaliar. `notaAvaliacao` foi congelada no envio;
 * mudar peso depois é reapuração, sem reabrir avaliação nenhuma.
 */
import { arredondar } from './nota-avaliacao.js';

export interface CriterioApurado {
  criterioId: string;
  criterioNome: string;
  /** Peso deste critério NESTE perfil (`AplicacaoCriterio.peso`). */
  peso: number;
  /** Valor bruto lido (anos, quantidade). Null para critério de domínio. */
  valorBruto: number | null;
  /** Valor de domínio lido (ex.: o código de escolaridade). */
  valorTexto: string | null;
  faixaId: string | null;
  /** Pontuação 0–100 da faixa aplicada. Null quando `semDado`. */
  pontuacao: number | null;
  semDado: boolean;
}

export interface ResultadoApuracao {
  notaAvaliacao: number;
  pesoAvaliacao: number;
  /** Média ponderada só dos critérios COM dado. Null quando nenhum tem. */
  notaCriterios: number | null;
  notaFinal: number;
  /** true quando algum critério ficou de fora e os pesos se renormalizaram. */
  houveRenormalizacao: boolean;
  criterios: readonly CriterioApurado[];
}

export function apurar(entrada: {
  notaAvaliacao: number;
  pesoAvaliacao: number;
  criterios: readonly CriterioApurado[];
}): ResultadoApuracao {
  const { notaAvaliacao, pesoAvaliacao, criterios } = entrada;

  if (!(pesoAvaliacao > 0)) {
    // Guardado na montagem da Aplicação; se chegou aqui, a aplicação foi criada
    // antes da validação existir. Falha alto em vez de dividir por zero.
    throw new Error(
      `apurar: pesoAvaliacao é ${pesoAvaliacao} e precisa ser maior que zero — aplicação inválida.`,
    );
  }

  const comDado = criterios.filter((c) => !c.semDado && c.pontuacao !== null);
  const pesoCriterios = comDado.reduce((s, c) => s + c.peso, 0);

  const numerador =
    notaAvaliacao * pesoAvaliacao + comDado.reduce((s, c) => s + (c.pontuacao as number) * c.peso, 0);
  const denominador = pesoAvaliacao + pesoCriterios;

  return {
    notaAvaliacao: arredondar(notaAvaliacao),
    pesoAvaliacao,
    notaCriterios:
      pesoCriterios > 0
        ? arredondar(
            comDado.reduce((s, c) => s + (c.pontuacao as number) * c.peso, 0) / pesoCriterios,
          )
        : null,
    notaFinal: arredondar(numerador / denominador),
    houveRenormalizacao: comDado.length < criterios.length,
    criterios,
  };
}
