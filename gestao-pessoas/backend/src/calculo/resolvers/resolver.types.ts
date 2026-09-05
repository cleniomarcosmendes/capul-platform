/**
 * Contratos dos critérios CALCULADOS (`rh.criterio.origem = CALCULADO`).
 *
 * Um critério calculado tem duas metades: a linha do catálogo, que o RH
 * administra (nome, unidade, faixas, peso), e o **resolver**, que é código e
 * só entra por deploy. O `codigoCalculo` é a solda entre as duas — e a
 * validação de publicação existe para garantir que essa solda não está fria.
 *
 * Resolvers são funções PURAS: recebem os dados já lidos e o contexto do ciclo,
 * devolvem valor. Sem Prisma, sem HTTP, sem `new Date()` — a data de referência
 * é sempre `ciclo.dataBase` (§4.2 da especificação), nunca hoje. O select antigo
 * usava `current_date` e a nota mudava conforme o dia em que o relatório rodava.
 */

/** Datas trafegam como AAAAMMDD: é o formato do Protheus e ordena como string. */
export type DataAAAAMMDD = string;

/** O que o ciclo fixa para todo o cálculo. */
export interface ContextoCiclo {
  /** `ciclo.dataBase`. Congela os critérios temporais. */
  dataBase: DataAAAAMMDD;
  /** `ciclo.janelaTreinamentoMeses`. Padrão 12. */
  janelaTreinamentoMeses: number;
}

/** O recorte do colaborador que os resolvers enxergam. */
export interface DadosColaborador {
  /** `RA_GRINRAI` → SX5 tabela 26. Nulo/vazio = sem dado (entra na renormalização). */
  grauInstrucaoCodigo?: string | null;
  /** Nunca nula: linha sem admissão é recusada no sync. */
  dataAdmissao: DataAAAAMMDD;
  /** Resolvida por `resolverDataUltimaFuncao`. Nunca nula depois do sync (decisão C9). */
  dataUltimaFuncao?: DataAAAAMMDD | null;
  /** `dataFim` dos treinamentos concluídos. Lista vazia é resposta legítima. */
  treinamentosConcluidos: readonly DataAAAAMMDD[];
}

/**
 * `semDado = true` tira o grupo do numerador **e** do denominador (§4.3). É o
 * conserto do bug mais grave do modelo antigo, onde `NULL + n = NULL` levava
 * quem não tinha cadastro a sair com média zero — parecendo péssimo desempenho
 * quando era falta de registro.
 *
 * ⚠️ `semDado` é para dado AUSENTE. Zero é valor, não ausência.
 */
export interface ValorCriterio {
  /** Para critério de faixa NUMERICA. */
  valorNumerico: number | null;
  /** Para critério de faixa DOMINIO (ex.: o código de escolaridade). */
  valorTexto: string | null;
  semDado: boolean;
}

export type ResolverCriterio = (
  colaborador: DadosColaborador,
  ciclo: ContextoCiclo,
) => ValorCriterio;

/** AAAAMMDD → Date em UTC. Sem fuso: data de calendário não tem hora. */
export function paraData(aaaammdd: DataAAAAMMDD): Date {
  if (!/^\d{8}$/.test(aaaammdd ?? '')) {
    throw new Error(`Data inválida: "${aaaammdd}" (esperado AAAAMMDD).`);
  }
  const ano = Number(aaaammdd.slice(0, 4));
  const mes = Number(aaaammdd.slice(4, 6));
  const dia = Number(aaaammdd.slice(6, 8));
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new Error(`Data inexistente no calendário: "${aaaammdd}".`);
  }
  return d;
}

/** Anos entre duas datas, com 365,25 — a mesma constante do select original. */
export function anosEntre(inicio: DataAAAAMMDD, fim: DataAAAAMMDD): number {
  const ms = paraData(fim).getTime() - paraData(inicio).getTime();
  return ms / 86_400_000 / 365.25;
}

/** Recua `meses` a partir de uma data, ancorando no último dia quando o mês é mais curto. */
export function recuarMeses(base: DataAAAAMMDD, meses: number): DataAAAAMMDD {
  const d = paraData(base);
  const diaOriginal = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - meses);
  // 31/03 menos 1 mês é 28/02 (ou 29), não 03/03 — que é o que dá o setMonth ingênuo.
  const ultimoDiaDoMes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(diaOriginal, ultimoDiaDoMes));
  return (
    String(d.getUTCFullYear()).padStart(4, '0') +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}
