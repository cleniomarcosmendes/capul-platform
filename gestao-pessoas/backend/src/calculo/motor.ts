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
 * Situação que não impede a apuração mas precisa chegar ao RH. Nada aqui é
 * silencioso: a pessoa não é punida (o critério sai da conta) e o alerta diz o
 * que cadastrar para reapurar.
 */
export interface AlertaApuracao {
  criterioCodigo: string;
  motivo: 'SEM_FAIXA' | 'SEM_VALOR_INFORMADO' | 'SEM_DADO_CADASTRAL';
  detalhe: string;
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
      alertas.push({
        criterioCodigo: config.codigo,
        motivo: 'SEM_FAIXA',
        detalhe:
          `O valor ${valor.valorTexto ?? valor.valorNumerico} não está em nenhuma faixa do ` +
          `critério "${config.nome}". Cadastre a faixa e reapure.`,
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
        motivo: 'SEM_DADO_CADASTRAL',
        detalhe: `Sem dado cadastral para "${config.nome}". O critério sai da conta e os pesos se renormalizam.`,
      });
    }
    return valor;
  }

  const informado = entrada.valoresInformados?.find((v) => v.criterioId === config.criterioId);
  if (!informado || (informado.valorNumerico === null && informado.valorTexto === null)) {
    alertas.push({
      criterioCodigo: config.codigo,
      motivo: 'SEM_VALOR_INFORMADO',
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
