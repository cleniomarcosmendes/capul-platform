/**
 * MOTOR DE CÁLCULO — junta as peças: resolver → faixa → apuração.
 *
 * Função pura, sem Prisma: recebe a configuração da aplicação e os dados do
 * colaborador, devolve o resultado apurado. Quem lê do banco é o service; aqui
 * mora a regra, que é o que precisa de teste.
 *
 * Ordem: para cada critério da Aplicação,
 *   1. obtém o VALOR — resolver registrado (CALCULADO) ou valor importado
 *      (INFORMADO);
 *   2. localiza a FAIXA no catálogo do critério;
 *   3. a pontuação da faixa entra na apuração com o peso do perfil.
 */
import { apurar, type CriterioApurado, type ResultadoApuracao } from './apuracao.js';
import { localizarFaixa, type Faixa } from './faixa.js';
import { obterResolver } from './resolvers/registry.js';
import type {
  ContextoCiclo,
  DadosColaborador,
  ValorCriterio,
} from './resolvers/resolver.types.js';

export interface CriterioConfigurado {
  criterioId: string;
  codigo: string;
  nome: string;
  origem: 'CALCULADO' | 'INFORMADO';
  codigoCalculo: string | null;
  /** `AplicacaoCriterio.peso` — o que varia por perfil. */
  peso: number;
  faixas: readonly Faixa[];
}

/** Valor de critério INFORMADO, já lido de `rh.criterio_valor_informado`. */
export interface ValorInformado {
  criterioId: string;
  valorNumerico: number | null;
  valorTexto: string | null;
}

/**
 * ⭐ DOIS ESCOPOS DE ALERTA, e a diferença não é cosmética:
 *
 *   INDIVIDUAL   — falta o dado DAQUELA pessoa (escolaridade em branco, valor
 *                  informado não importado). Afeta uma linha; resolve-se no
 *                  cadastro dela; é o resíduo que a renormalização absorve.
 *
 *   CONFIGURACAO — o valor existe e NENHUMA faixa o cobre. Não é problema da
 *                  pessoa: é do critério, e atinge TODO MUNDO que tiver aquele
 *                  valor. Um código de escolaridade novo no SX5 sem faixa
 *                  cadastrada tira o critério da conta de dezenas de pessoas de
 *                  uma vez — e, listado pessoa a pessoa, se perde no meio das
 *                  ausências individuais.
 *
 * Por isso os de CONFIGURACAO são AGREGADOS (`agregarAlertas`) e mostrados antes
 * do fechamento do ciclo: "12 pessoas com escolaridade fora de faixa" é uma
 * pendência de cadastro que alguém resolve em minutos; 12 linhas soltas num log
 * não são.
 */
export type MotivoAlerta = 'SEM_FAIXA' | 'SEM_VALOR_INFORMADO' | 'SEM_DADO_CADASTRAL';
export type EscopoAlerta = 'INDIVIDUAL' | 'CONFIGURACAO';

/**
 * O escopo PADRÃO de cada motivo — o que ele é quando atinge ALGUMAS pessoas.
 *
 * ⚠️ Não é a palavra final: `agregarAlertas` promove para CONFIGURACAO o motivo
 * que atingiu TODO MUNDO. Ver `escopoAgregado` logo abaixo.
 */
export const ESCOPO_DO_MOTIVO: Readonly<Record<MotivoAlerta, EscopoAlerta>> = Object.freeze({
  SEM_FAIXA: 'CONFIGURACAO',
  SEM_VALOR_INFORMADO: 'INDIVIDUAL',
  SEM_DADO_CADASTRAL: 'INDIVIDUAL',
});

/**
 * ⭐⭐ O ESCOPO É CALCULADO, NÃO FIXO — e a diferença é de CONSELHO.
 *
 * "É dado de pessoa — resolve-se caso a caso" está certo para 12 pessoas sem
 * escolaridade no cadastro. Para **894 de 894**, é conselho errado na hora
 * errada: ninguém tem o dado porque o critério não foi alimentado, e a saída é
 * uma importação, não 894 correções.
 *
 * Um critério INFORMADO recém-criado cai exatamente nisso: a tabela de valores
 * nasce vazia, e o alerta saía classificado como individual, ordenado ABAIXO
 * dos de configuração, mandando o RH resolver pessoa a pessoa o que é um ato só.
 *
 * ⚠️ A promoção exige saber o TOTAL de apurados — por isso `agregarAlertas`
 * passou a recebê-lo. Sem ele não dá para distinguir "12 de 894" de "12 de 12",
 * e são coisas diferentes.
 */
export function escopoAgregado(
  motivo: MotivoAlerta,
  pessoasAtingidas: number,
  totalApurado: number,
): EscopoAlerta {
  if (ESCOPO_DO_MOTIVO[motivo] === 'CONFIGURACAO') return 'CONFIGURACAO';
  // `> 0` para não promover no ciclo vazio, onde 0 de 0 seria "todo mundo".
  return totalApurado > 0 && pessoasAtingidas >= totalApurado ? 'CONFIGURACAO' : 'INDIVIDUAL';
}

export interface AlertaApuracao {
  criterioCodigo: string;
  criterioNome: string;
  motivo: MotivoAlerta;
  escopo: EscopoAlerta;
  /** O valor que provocou o alerta — é o que o RH precisa para cadastrar a faixa. */
  valor: string | null;
  detalhe: string;
}

/** Uma pendência agregada, do jeito que a tela de fechamento do ciclo mostra. */
export interface AlertaAgregado {
  criterioCodigo: string;
  criterioNome: string;
  motivo: MotivoAlerta;
  escopo: EscopoAlerta;
  pessoas: number;
  /** Valores distintos que provocaram o alerta (ex.: os códigos sem faixa). */
  valores: string[];
  resumo: string;
}

/**
 * Junta os alertas de todas as pessoas do ciclo por critério + motivo + valor.
 * Os de CONFIGURACAO vêm primeiro, e dentro de cada escopo os que afetam mais
 * gente — é a ordem em que se resolve.
 */
export function agregarAlertas(
  alertas: readonly AlertaApuracao[],
  /** Quantas pessoas foram apuradas no escopo — o denominador de "todo mundo". */
  totalApurado = 0,
): AlertaAgregado[] {
  const porChave = new Map<string, { alerta: AlertaApuracao; pessoas: number; valores: Set<string> }>();

  for (const a of alertas) {
    const chave = `${a.criterioCodigo}|${a.motivo}`;
    const atual = porChave.get(chave) ?? { alerta: a, pessoas: 0, valores: new Set<string>() };
    atual.pessoas += 1;
    if (a.valor) atual.valores.add(a.valor);
    porChave.set(chave, atual);
  }

  return [...porChave.values()]
    .map(({ alerta, pessoas, valores }) => {
      // ⭐ O escopo sai daqui, não do alerta individual: só na agregação se sabe
      // quantas pessoas o motivo atingiu, e é isso que decide se é caso a caso
      // ou configuração.
      const escopo = escopoAgregado(alerta.motivo, pessoas, totalApurado);
      const atingeTodos = escopo === 'CONFIGURACAO' && ESCOPO_DO_MOTIVO[alerta.motivo] === 'INDIVIDUAL';
      return {
        criterioCodigo: alerta.criterioCodigo,
        criterioNome: alerta.criterioNome,
        motivo: alerta.motivo,
        escopo,
        pessoas,
        valores: [...valores].sort(),
        resumo: resumir(alerta, pessoas, [...valores].sort(), atingeTodos),
      };
    })
    .sort(
      (a, b) =>
        (a.escopo === b.escopo ? 0 : a.escopo === 'CONFIGURACAO' ? -1 : 1) || b.pessoas - a.pessoas,
    );
}

function resumir(
  alerta: AlertaApuracao,
  pessoas: number,
  valores: string[],
  atingeTodos = false,
): string {
  const gente = `${pessoas} pessoa${pessoas > 1 ? 's' : ''}`;
  switch (alerta.motivo) {
    case 'SEM_FAIXA':
      return (
        `${gente} com ${alerta.criterioNome.toLowerCase()} fora de faixa ` +
        `(${valores.join(', ')}). Cadastre a faixa no critério e reapure — enquanto isso, ` +
        'o critério fica fora da nota dessas pessoas.'
      );
    /**
     * ⭐ Duas frases porque são dois problemas. Faltar o valor de algumas
     * pessoas é lacuna de importação; faltar o de TODAS é o critério que nunca
     * foi alimentado — e aí a saída é uma importação, não N correções.
     */
    case 'SEM_VALOR_INFORMADO':
      return atingeTodos
        ? `NINGUÉM tem valor informado para "${alerta.criterioNome}" neste ciclo — o critério ` +
            'não foi alimentado. Ele está fora da nota de todo mundo, e a nota saiu como se ele ' +
            `não existisse. Importe os valores e reapure. Pessoas afetadas: ${pessoas}.`
        : `${gente} sem valor informado para "${alerta.criterioNome}" neste ciclo.`;
    default:
      return atingeTodos
        ? `NINGUÉM tem dado cadastral para "${alerta.criterioNome}" — o critério está fora da ` +
            'nota de todo mundo. Isso costuma ser falha da sincronização com o Protheus, não ' +
            `cadastro de pessoa. Pessoas afetadas: ${pessoas}.`
        : `${gente} sem dado cadastral para "${alerta.criterioNome}".`;
  }
}

export function apurarColaborador(entrada: {
  notaAvaliacao: number;
  pesoAvaliacao: number;
  criterios: readonly CriterioConfigurado[];
  colaborador: DadosColaborador;
  ciclo: ContextoCiclo;
  valoresInformados?: readonly ValorInformado[];
}): { resultado: ResultadoApuracao; alertas: AlertaApuracao[] } {
  const alertas: AlertaApuracao[] = [];

  const apurados: CriterioApurado[] = entrada.criterios.map((config) => {
    const valor = obterValor(config, entrada, alertas);
    const faixa = localizarFaixa(config.faixas, valor);

    if (!valor.semDado && faixa === null) {
      // Valor existe mas nenhuma faixa o cobre: é lacuna de CADASTRO, não do
      // colaborador. Pontuar zero puniria a pessoa por configuração errada;
      // travar a apuração inteira puniria as outras 1.035. Sai da conta e o RH
      // recebe o alerta para cadastrar a faixa e reapurar.
      const bruto = valor.valorTexto ?? String(valor.valorNumerico);
      alertas.push({
        criterioCodigo: config.codigo,
        criterioNome: config.nome,
        motivo: 'SEM_FAIXA',
        escopo: ESCOPO_DO_MOTIVO.SEM_FAIXA,
        valor: bruto,
        detalhe:
          `O valor ${bruto} não está em nenhuma faixa do critério "${config.nome}". ` +
          'Cadastre a faixa e reapure.',
      });
    }

    const semDado = valor.semDado || faixa === null;
    return {
      criterioId: config.criterioId,
      criterioNome: config.nome,
      peso: config.peso,
      valorBruto: valor.valorNumerico,
      valorTexto: valor.valorTexto,
      faixaId: faixa?.id ?? null,
      pontuacao: faixa ? faixa.pontuacao : null,
      semDado,
    };
  });

  const resultado = apurar({
    notaAvaliacao: entrada.notaAvaliacao,
    pesoAvaliacao: entrada.pesoAvaliacao,
    criterios: apurados,
  });

  return { resultado, alertas };
}

function obterValor(
  config: CriterioConfigurado,
  entrada: {
    colaborador: DadosColaborador;
    ciclo: ContextoCiclo;
    valoresInformados?: readonly ValorInformado[];
  },
  alertas: AlertaApuracao[],
): ValorCriterio {
  if (config.origem === 'CALCULADO') {
    // `obterResolver` falha alto se o código não existir — mas as três
    // validações (catálogo, aplicação, abertura do ciclo) já barraram antes.
    const valor = obterResolver(config.codigoCalculo ?? '')(entrada.colaborador, entrada.ciclo);
    if (valor.semDado) {
      alertas.push({
        criterioCodigo: config.codigo,
        criterioNome: config.nome,
        motivo: 'SEM_DADO_CADASTRAL',
        escopo: ESCOPO_DO_MOTIVO.SEM_DADO_CADASTRAL,
        valor: null,
        detalhe: `Sem dado cadastral para "${config.nome}". O critério sai da conta e os pesos se renormalizam.`,
      });
    }
    return valor;
  }

  const informado = entrada.valoresInformados?.find((v) => v.criterioId === config.criterioId);
  if (!informado || (informado.valorNumerico === null && informado.valorTexto === null)) {
    alertas.push({
      criterioCodigo: config.codigo,
      criterioNome: config.nome,
      motivo: 'SEM_VALOR_INFORMADO',
      escopo: ESCOPO_DO_MOTIVO.SEM_VALOR_INFORMADO,
      valor: null,
      detalhe: `Nenhum valor importado ou digitado para "${config.nome}" neste ciclo.`,
    });
    return { valorNumerico: null, valorTexto: null, semDado: true };
  }
  return {
    valorNumerico: informado.valorNumerico,
    valorTexto: informado.valorTexto,
    semDado: false,
  };
}
