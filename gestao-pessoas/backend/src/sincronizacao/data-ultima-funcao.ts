/**
 * ⭐ A PEÇA MAIS FRÁGIL DO SYNC — leia antes de mexer.
 *
 * Resolve `colaborador.dataUltimaFuncao`, que alimenta o critério automático
 * TEMPO_FUNCAO. Fica isolada de propósito: é função pura, sem Prisma, sem HTTP e
 * sem data de hoje — só entra o histórico e a admissão, só sai uma data.
 *
 * ── Por que não é "a última linha do SR7010" ────────────────────────────────
 * O SR7010 registra QUALQUER alteração salarial, e a maior delas é o **dissídio
 * coletivo**: todo 1º de novembro a folha inteira ganha uma linha (`R7_TIPO=003`).
 * Medido em capulmig/capulhlg em 05/09/2026:
 *
 *     20211101 → 1.086    20231102 → 1.034    20251101 → 1.002
 *     20221101 → 1.071    20241101 →   981    20201101 →   905
 *
 * Usar a última linha faria **517 das 1.036 pessoas** (50%) aparecerem como
 * recém-chegadas à função: média de **2,5 anos** de casa apagados, máximo 39,7.
 *
 * ── Por que também não é "ignorar o tipo 003" ───────────────────────────────
 * Porque o tipo não é confiável nos dois sentidos. A matrícula 001174 tem um
 * `R7_TIPO=005` (promoção) em 26/02/2026 que **não mudou a função** — continuou
 * MOTORISTA E 3B. Filtrar por tipo erraria de novo, só que mais devagar.
 *
 * O select antigo tentava um terceiro caminho — excluir a data fixa `'20241101'`,
 * embutida no código. Envelheceu sozinho: `20251101` já existe e é mais recente.
 *
 * ── A regra ─────────────────────────────────────────────────────────────────
 * A única coisa que marca início de função é a função MUDAR de valor. Nada de
 * data mágica, nada de tipo, nada de parâmetro para alguém lembrar de atualizar
 * no próximo novembro.
 *
 * ── Três bordas, todas com teste (ver data-ultima-funcao.spec.ts) ────────────
 * a) Nunca trocou de função desde o primeiro registro → `dataAdmissao`.
 *    193 pessoas hoje. A pessoa não mudou de função desde que entrou; isso é
 *    fato, não dado ausente (decisão C9 da especificação).
 * b) Nenhum registro no SR7010 → `dataAdmissao`. 52 pessoas hoje.
 * c) Transferência de filial. O Protheus **replica o histórico inteiro** em cada
 *    filial por onde a pessoa passou. A cópia da filial ATUAL é completa —
 *    verificado: das 982 pessoas com histórico, 982 começam na data de admissão
 *    e **zero** vêm truncadas. A transferência em si não zera o tempo, porque
 *    não muda `R7_FUNCAO`.
 *
 *    ⚠️ **A cópia da filial ANTIGA continua recebendo lançamentos e fica DESATUALIZADA.**
 *    Matrícula 004540 (transferida da 18 para a 01) é o caso real: em 20241101 a
 *    filial 01 já registra a função nova `00542` e a filial 18 segue carimbando a
 *    antiga `02556`, inclusive no dissídio de 20251101. Misturando as duas, a
 *    função oscila 00542 → 02556 → 00542 e nasce uma **promoção falsa** em
 *    20260226 — a pessoa perderia 3 anos de função. São 2 casos em 1.036 hoje.
 *
 *    Por isso o CONTRATO desta função é: **passe somente os lançamentos da
 *    filial atual do colaborador** (a que tem `RA_DEMISSA` em branco). O dedup
 *    abaixo cobre réplicas IDÊNTICAS; ele não tem como cobrir réplicas que se
 *    CONTRADIZEM, e nenhuma regra teria — a informação de qual cópia vale não
 *    está no SR7010, está no SRA010.
 *
 * Levantamento e números: docs/DECISAO_RH_ESCOLARIDADE.md e a análise de 05/09.
 */

/** Um lançamento do histórico funcional (SR7010), já normalizado pela fonte. */
export interface MovimentoFuncional {
  /** `R7_DATA`, no formato AAAAMMDD — comparado como string, que aqui ordena igual a data. */
  data: string;
  /** `R7_SEQ`. Desempata dois lançamentos no mesmo dia; a função não depende dele para nada além da ordem. */
  sequencia: string;
  /** `R7_FUNCAO` — o CÓDIGO da função, nunca a descrição (que muda de texto sem a função mudar). */
  funcaoCodigo: string;
}

export type OrigemDataFuncao =
  /** Houve troca de função; a data é a da última troca. */
  | 'TROCA_DE_FUNCAO'
  /** Tem histórico, mas a função nunca mudou — borda (a). */
  | 'ADMISSAO_SEM_TROCA'
  /** Não há histórico nenhum no SR7010 — borda (b). */
  | 'ADMISSAO_SEM_HISTORICO';

export interface ResultadoDataFuncao {
  /** AAAAMMDD. Nunca nulo: na ausência de troca, é a data de admissão. */
  data: string;
  /** Por que essa data foi escolhida. Vai para o log do sync e para a memória de cálculo. */
  origem: OrigemDataFuncao;
  /** Quantas trocas de função o histórico tem. Zero é legítimo, não é erro. */
  trocas: number;
}

/**
 * @param movimentos histórico funcional da pessoa. Pode vir fora de ordem e com
 *   eventos repetidos entre filiais — a função ordena e deduplica.
 * @param dataAdmissao `RA_ADMISSA` (AAAAMMDD). Obrigatória: sem ela não há
 *   resposta possível para as bordas (a) e (b). O sync recusa a linha antes de
 *   chegar aqui — nas 1.036 pessoas ativas não há uma sequer sem admissão.
 * @param opcoes.ate ⭐ RECORTE: ignora lançamentos POSTERIORES a esta data —
 *   normalmente `ciclo.dataBase`. Sem ele, reapurar um ciclo antigo dá resultado
 *   diferente conforme o tempo passa, que é o `current_date` de volta com outra
 *   roupa. Medido: o ciclo de 2025 reapurado hoje enxerga lançamentos de 2026 e
 *   chega a produzir tempo de função NEGATIVO. Omitido = considera tudo (é o que
 *   o sync faz para gravar o valor corrente).
 */
export function resolverDataUltimaFuncao(
  movimentos: readonly MovimentoFuncional[],
  dataAdmissao: string,
  opcoes: { ate?: string } = {},
): ResultadoDataFuncao {
  if (!dataAdmissao) {
    throw new Error(
      'resolverDataUltimaFuncao: dataAdmissao é obrigatória — sem ela as bordas (a) e (b) não têm resposta.',
    );
  }

  // Dedup por evento inteiro: a mesma alteração replicada em N filiais é UMA
  // alteração. Sem isto, o chamador que passar duas filiais veria a função
  // "mudar" ao pular de uma cópia para a outra — borda (c).
  const unicos = new Map<string, MovimentoFuncional>();
  for (const m of movimentos) {
    if (!m?.data || !m.funcaoCodigo) continue; // linha inutilizável: sem data ou sem função
    // Recorte pela data-base: fato posterior ao ciclo não pode influenciar a
    // nota daquele ciclo. AAAAMMDD compara como string na ordem do calendário.
    if (opcoes.ate && m.data > opcoes.ate) continue;
    unicos.set(`${m.data}|${m.sequencia}|${m.funcaoCodigo}`, m);
  }

  const ordenados = [...unicos.values()].sort(
    (a, b) => a.data.localeCompare(b.data) || a.sequencia.localeCompare(b.sequencia),
  );

  if (ordenados.length === 0) {
    return { data: dataAdmissao, origem: 'ADMISSAO_SEM_HISTORICO', trocas: 0 };
  }

  // O PRIMEIRO registro não conta como troca: ele é o ponto de partida, não uma
  // mudança. É o que torna a borda (a) correta e o que protege de um histórico
  // que chegue truncado — sem isso, a primeira linha de uma cópia parcial seria
  // lida como promoção e zeraria o tempo de função da pessoa.
  let dataUltimaTroca: string | null = null;
  let trocas = 0;

  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].funcaoCodigo !== ordenados[i - 1].funcaoCodigo) {
      dataUltimaTroca = ordenados[i].data;
      trocas++;
    }
  }

  return dataUltimaTroca === null
    ? { data: dataAdmissao, origem: 'ADMISSAO_SEM_TROCA', trocas: 0 }
    : { data: dataUltimaTroca, origem: 'TROCA_DE_FUNCAO', trocas };
}
