/**
 * Preparo do histórico funcional para gravação (`rh.colaborador_funcao_historico`).
 *
 * O sync lê o `SR7010` e grava **tudo** o que leu. Duas coisas acontecem aqui
 * antes da gravação, e as duas são DESCRITIVAS — nenhuma decide a nota:
 *
 *   1. `origem` — MOVIMENTO ou CARGA, para a auditoria e para a tela explicar o
 *      histórico em português;
 *   2. `consideradoNoCalculo` — quais linhas alimentam o cálculo, com o motivo
 *      escrito quando não alimentam.
 *
 * ⚠️ **A regra da nota continua sendo a troca de `funcaoCodigo`** e não pode
 * passar a depender de `origem` nem de `tipo`. Foi por depender do tipo e de uma
 * data fixa que o select antigo errou por anos. A classificação abaixo é
 * heurística; a regra, não. Se a heurística errar, o resultado do cálculo não
 * muda — só o rótulo na tela de auditoria.
 */
import type { MovimentoFuncional } from './data-ultima-funcao.js';

export type OrigemMovimento = 'MOVIMENTO' | 'CARGA';

/** Uma linha do `SR7010`, como o sync a lê (REST ou CSV). */
export interface LinhaHistorico {
  filial: string;
  matricula: string;
  /** `R7_DATA`, AAAAMMDD. */
  data: string;
  /** `R7_SEQ`. */
  sequencia: string;
  /** `R7_FUNCAO` — o código. */
  funcaoCodigo: string;
  /** `R7_DESCFUN`. */
  funcaoDescricao?: string | null;
  /** `R7_TIPO`. */
  tipo?: string | null;
  /** `R_E_C_N_O_`, para rastrear a linha de volta até a origem. */
  recnoOrigem?: number | null;
}

export interface LinhaClassificada extends LinhaHistorico {
  origem: OrigemMovimento;
  consideradoNoCalculo: boolean;
  motivoDescarte: string | null;
}

/**
 * Quantas pessoas um mesmo (data, tipo) precisa atingir para ser considerado
 * CARGA. Na Capul o dissídio coletivo bate ~1.000 pessoas no mesmo dia, todo 1º
 * de novembro; uma promoção individual bate 1. Qualquer valor entre os dois
 * separa os casos com folga — 50 dá margem sem confundir com um lote pequeno de
 * reclassificação.
 *
 * É parâmetro porque a especificação (§5.3) pediu: "se não houver como
 * distinguir na origem, deixe o parâmetro configurável".
 */
export const MINIMO_PESSOAS_PARA_CARGA = 50;

/**
 * Marca cada linha como MOVIMENTO ou CARGA.
 *
 * CARGA = mesma data e mesmo tipo atingindo muita gente de uma vez. É o formato
 * do dissídio: 20251101 com `R7_TIPO=003` em 1.002 pessoas, medido no Protheus.
 */
export function classificarOrigem(
  linhas: readonly LinhaHistorico[],
  minimoParaCarga = MINIMO_PESSOAS_PARA_CARGA,
): (LinhaHistorico & { origem: OrigemMovimento })[] {
  const pessoasPorLote = new Map<string, Set<string>>();
  for (const l of linhas) {
    const chave = `${l.data}|${l.tipo ?? ''}`;
    const pessoas = pessoasPorLote.get(chave) ?? new Set<string>();
    pessoas.add(l.matricula);
    pessoasPorLote.set(chave, pessoas);
  }

  return linhas.map((l) => ({
    ...l,
    origem:
      (pessoasPorLote.get(`${l.data}|${l.tipo ?? ''}`)?.size ?? 0) >= minimoParaCarga
        ? ('CARGA' as const)
        : ('MOVIMENTO' as const),
  }));
}

/**
 * Decide o que alimenta o cálculo: **apenas as linhas da filial ATUAL da
 * pessoa** (a que tem demissão em branco no `SRA010`).
 *
 * O Protheus replica o histórico em cada filial por onde a pessoa passou, e a
 * cópia da filial ANTIGA continua recebendo lançamentos com a função
 * desatualizada — caso real da matrícula 004540, cuja filial 18 seguiu
 * carimbando `02556` depois de a filial 01 já registrar `00542`. Misturando as
 * duas, a função oscila e nasce uma promoção falsa.
 *
 * As linhas descartadas **são gravadas assim mesmo**, marcadas e com o motivo:
 * descarte silencioso é o que este módulo vem eliminando, e é o que permite
 * explicar depois por que uma linha do Protheus não entrou na conta.
 */
export function marcarConsideradas(
  linhas: readonly (LinhaHistorico & { origem: OrigemMovimento })[],
  filialAtualPorMatricula: ReadonlyMap<string, string>,
): LinhaClassificada[] {
  return linhas.map((l) => {
    const filialAtual = filialAtualPorMatricula.get(l.matricula);

    if (!filialAtual) {
      return {
        ...l,
        consideradoNoCalculo: false,
        motivoDescarte:
          'Matrícula sem colaborador ativo no cadastro — histórico gravado só para rastreio.',
      };
    }
    if (l.filial !== filialAtual) {
      return {
        ...l,
        consideradoNoCalculo: false,
        motivoDescarte:
          `Réplica da filial ${l.filial}; a pessoa está hoje na ${filialAtual}. ` +
          'A cópia da filial anterior continua recebendo lançamentos e fica desatualizada.',
      };
    }
    return { ...l, consideradoNoCalculo: true, motivoDescarte: null };
  });
}

export type MotivoInvalida = 'SEM_DATA' | 'SEM_FUNCAO';

export interface LinhaInvalida {
  linha: LinhaHistorico;
  motivo: MotivoInvalida;
  detalhe: string;
}

/**
 * Separa o que dá para gravar do que não dá.
 *
 * ⚠️ **Lançamento sem data existe no Protheus da Capul**: 99 linhas do SR7010,
 * atingindo 98 pessoas — 79 delas no quadro ativo (medido em 05/09/2026). Sem
 * data não há como ordenar o histórico nem gravá-lo (a chave natural inclui a
 * data), então a linha fica de fora.
 *
 * Mas ela **não invalida as outras linhas da pessoa** e **não derruba o
 * arquivo**: sai contada e listada no relatório do sync. Recusar a carga inteira
 * por causa de 99 linhas de 29.881 seria trocar um problema pequeno por um
 * grande — e importar sem avisar seria o descarte silencioso de novo.
 */
export function separarUtilizaveis(linhas: readonly LinhaHistorico[]): {
  utilizaveis: LinhaHistorico[];
  invalidas: LinhaInvalida[];
} {
  const utilizaveis: LinhaHistorico[] = [];
  const invalidas: LinhaInvalida[] = [];

  for (const linha of linhas) {
    if (!/^\d{8}$/.test((linha.data ?? '').trim())) {
      invalidas.push({
        linha,
        motivo: 'SEM_DATA',
        detalhe:
          `Lançamento sem data (matrícula ${linha.matricula}, filial ${linha.filial}). ` +
          'Sem data não há como ordenar o histórico — a linha fica de fora, as demais da pessoa valem.',
      });
      continue;
    }
    if (!(linha.funcaoCodigo ?? '').trim()) {
      invalidas.push({
        linha,
        motivo: 'SEM_FUNCAO',
        detalhe: `Lançamento sem código de função (matrícula ${linha.matricula}).`,
      });
      continue;
    }
    utilizaveis.push(linha);
  }

  return { utilizaveis, invalidas };
}

/** As duas etapas, na ordem. É o que o sync chama. */
export function prepararHistorico(
  linhas: readonly LinhaHistorico[],
  filialAtualPorMatricula: ReadonlyMap<string, string>,
  minimoParaCarga = MINIMO_PESSOAS_PARA_CARGA,
): LinhaClassificada[] {
  return marcarConsideradas(classificarOrigem(linhas, minimoParaCarga), filialAtualPorMatricula);
}

/**
 * Converte o que foi gravado no formato que o motor consome.
 * Filtra o que não é considerado — o descartado existe para auditoria, não para
 * a conta — e deixa o recorte por data-base para `resolverDataUltimaFuncao`.
 */
export function paraMovimentos(
  linhas: readonly { data: string; sequencia: string; funcaoCodigo: string; consideradoNoCalculo: boolean }[],
): MovimentoFuncional[] {
  return linhas
    .filter((l) => l.consideradoNoCalculo)
    .map(({ data, sequencia, funcaoCodigo }) => ({ data, sequencia, funcaoCodigo }));
}
