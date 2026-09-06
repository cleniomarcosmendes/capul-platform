/**
 * FONTE DE DADOS DO SYNC — plugável, como a especificação §5.1 pediu.
 *
 * Hoje só existe a implementação CSV, e é a decisão certa para o piloto: o
 * Protheus expõe uma única operação REST de pessoas (`infoFuncionario`), que
 * devolve `{ matricula, nome, cc }` — sem admissão, situação, escolaridade,
 * histórico funcional nem treinamentos. Nenhuma das tabelas de que este módulo
 * precisa (`SRA010`, `SX5010`, `SR7010`, `RA4010`) é consumida hoje por
 * ninguém na plataforma.
 *
 * Quando o endpoint REST existir, entra uma segunda implementação desta mesma
 * interface e nada mais muda: a regra do sync não sabe de onde os dados vieram.
 *
 * ⭐⭐ **SOMENTE LEITURA. JAMAIS ESCREVER NO ERP.**
 * O ambiente de DESENVOLVIMENTO aponta para o Protheus de PRODUÇÃO — gravar
 * daqui grava na produção da empresa. Por isso esta interface **não tem** e não
 * pode ganhar nenhum método de escrita: a garantia é estrutural, não uma
 * lembrança de quem for implementar a próxima fonte.
 */

/** Uma pessoa, como o `SRA010` a entrega. */
export interface ColaboradorDaFonte {
  filial: string;
  matricula: string;
  nome: string;
  cpf?: string | null;
  centroCusto?: string | null;
  centroCustoDescricao?: string | null;
  cargoCodigo?: string | null;
  cargoDescricao?: string | null;
  /** `RA_ADMISSA`, AAAAMMDD. Obrigatória — linha sem ela é recusada. */
  dataAdmissao: string;
  /** `RA_DEMISSA`. */
  dataDemissao?: string | null;
  /** `RA_SITFOLH`: ' ' normal · F férias · A afastado · D demitido. */
  situacaoFolha?: string | null;
  /** `RA_CATFUNC`: M mensalista · A autônomo · P diretoria · T outros. */
  categoriaFuncional?: string | null;
  /** `RA_GRINRAI` → SX5 tabela 26. */
  grauInstrucaoCodigo?: string | null;
  grauInstrucaoDescricao?: string | null;
  /** Descrição da função atual, para a tela. */
  descricaoFuncao?: string | null;
}

/** Um lançamento do `SR7010`. */
export interface HistoricoDaFonte {
  filial: string;
  matricula: string;
  /** `R7_DATA`, AAAAMMDD. */
  data: string;
  /** `R7_SEQ`. */
  sequencia: string;
  /** `R7_FUNCAO` — o código. */
  funcaoCodigo: string;
  funcaoDescricao?: string | null;
  /** `R7_TIPO`. */
  tipo?: string | null;
  /** `R_E_C_N_O_`. */
  recnoOrigem?: number | null;
}

/** Um treinamento concluído, do `RA4010`. */
export interface TreinamentoDaFonte {
  filial: string;
  matricula: string;
  descricao: string;
  /** `RA4_DATAIN`, AAAAMMDD. */
  dataInicio: string;
  /** `RA4_DATAFI`. Sem ela, o curso não conta (o critério é sobre concluídos). */
  dataFim?: string | null;
  /** `RA4_HORAS`. ⚠️ 100% vazio no Protheus da Capul em 05/09/2026. */
  cargaHoraria?: number | null;
}

export interface FonteColaboradores {
  /** Nome da fonte, para o log e para a tela dizerem de onde os dados vieram. */
  readonly descricao: string;
  lerColaboradores(): Promise<ColaboradorDaFonte[]>;
  lerHistoricoFuncional(): Promise<HistoricoDaFonte[]>;
  lerTreinamentos(): Promise<TreinamentoDaFonte[]>;
}

/** Token de injeção — o módulo escolhe a implementação por configuração. */
export const FONTE_COLABORADORES = Symbol('FONTE_COLABORADORES');
