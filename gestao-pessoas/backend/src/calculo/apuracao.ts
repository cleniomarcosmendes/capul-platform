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
/**
 * ── ⚠️ QUANDO MEXER AQUI: RODE AS MUTAÇÕES ──────────────────────────────────
 *
 * Este arquivo decide NOTA. Os testes de cálculo do módulo pegam as reversões
 * conhecidas — **medido em 12/09**, não suposto —, mas isso só continua verdade
 * enquanto alguém confere.
 *
 * **~15 minutos, e é a aferição que substitui escrever a contraparte explícita
 * de cada teste** (§3.1.126). Rode ao mexer em qualquer cálculo:
 *
 *   1. `arredondar` com 1 casa em vez de 2        → esperado: ~8 testes caem
 *   2. fronteira inferior da faixa EXCLUSIVA      → esperado: ~1 teste cai
 *   3. critério sem dado ENTRANDO no denominador  → esperado: ~7 testes caem
 *   4. `pesoExato` trocado por `peso` no
 *      `itensRespondidos`                          → esperado: as permutações
 *                                                    de `ordem-nao-muda-a-nota`
 *                                                    passam a divergir
 *
 * ⚠️⚠️ **Toda mutação tem de PROVAR QUE ENTROU.** Na primeira medição, duas
 * delas não pegaram no fonte (o padrão não batia) e o resultado leu como *"o
 * teste não pega"* — falso verde um nível acima do canário. Use `assert` no
 * script de mutação, ou confira o diff antes de rodar.
 *
 * ⚠️ Verde sem mutação responde "nada mudou desde a última vez", não "está
 * certo" — é a mesma distinção da §3.1.127 sobre baseline.
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
