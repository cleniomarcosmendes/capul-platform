/**
 * VALIDAÇÕES DA APLICAÇÃO E DA ABERTURA DO CICLO (§4.6).
 *
 * A partir da reestruturação de 05/09/2026 é aqui que os critérios cadastrais
 * entram na conta — o modelo é só o questionário, e o que varia por perfil é o
 * PESO (`AplicacaoCriterio`). Logo, é aqui que se confere se a apuração tem como
 * acontecer.
 */
import { ErroDeDominio } from '../common/erro-de-dominio.js';
import {
  validarCriterioEmUso,
  type CriterioValidavel,
} from '../criterio/criterio.validator.js';

export interface CriterioDaAplicacao {
  peso: number;
  criterio: CriterioValidavel;
  /**
   * ⭐ Quantos valores deste critério já existem NESTE ciclo. Só faz sentido em
   * `origem = INFORMADO`, cujo valor vem de planilha ou digitação — o CALCULADO
   * lê do cadastro e não tem o que importar.
   *
   * Serve ao AVISO da abertura, não a um bloqueio: importar depois de abrir é
   * legítimo (o ciclo dura semanas). O que não pode é abrir sem saber.
   */
  valoresInformadosNoCiclo?: number;
}

export interface AplicacaoParaValidar {
  /**
   * ⭐ Quantas pessoas estão no público NOMINAL da aplicação.
   *
   * Aplicação sem público é aplicação que **não alcança ninguém**: o ciclo abre,
   * nenhuma avaliação nasce dali, e ninguém recebe erro. Até 08/09 a faixa do
   * rascunho dizia "nada falta para abrir" com público vazio, enquanto o próximo
   * passo, duas linhas acima, dizia "sem público, o ciclo não alcança ninguém" —
   * duas frases contraditórias no mesmo bloco, e a que autorizava era a de baixo.
   */
  pessoasNoPublico: number;
  nome: string;
  /** Peso do QUESTIONÁRIO na composição final. */
  pesoAvaliacao: number;
  criterios: readonly CriterioDaAplicacao[];
  /** Modelo de demonstração não abre ciclo válido (§4.6). */
  modeloFinalidade?: 'PRODUCAO' | 'DEMONSTRACAO';
  /**
   * ⭐⭐ A versão do modelo está PUBLICADA?
   *
   * Rascunho não é instrumento — é o que alguém está montando. Enquanto ele é
   * rascunho, questão entra e sai e peso muda; uma aplicação amarrada a ele
   * responderia um questionário que muda debaixo de quem responde, e a nota
   * sairia sobre um denominador que já não existe.
   *
   * ⚠️ **A tela já filtrava (`.filter((v) => v.publicadoEm)`), a API não.** É a
   * direção PERMISSIVA da §3.1.77 — a silenciosa: ninguém reclama, nada quebra,
   * e quem descobre é quem chama a API direto. Ficou inofensivo até hoje só
   * porque **não existe nenhuma versão em rascunho**; a Etapa 2 (duplicar) cria
   * a primeira. Por isso a guarda entra ANTES dela, não depois.
   *
   * `undefined` = quem chamou não informou. Tratado como publicado, para não
   * inventar problema em chamador antigo — mas os dois chamadores de produção
   * informam, e há teste que varre o fonte cobrando isso.
   */
  versaoPublicada?: boolean;
}

export interface FaixaConceito {
  descricao: string;
  limiteInferior: number;
  limiteSuperior: number;
}

export class CicloNaoAbrivelError extends ErroDeDominio {
  /** A lista É a resposta: a tela renderiza item a item. */
  override corpo() {
    return { message: this.problemas };
  }

  constructor(readonly problemas: string[]) {
    super(`Ciclo não pode ser aberto:\n- ${problemas.join('\n- ')}`);
  }
}

/**
 * ⭐ `pesoAvaliacao` tem de ser MAIOR QUE ZERO.
 *
 * A nota final é
 *   [notaAvaliacao × pesoAvaliacao + Σ(pontuação × peso)] / [pesoAvaliacao + Σ(peso)]
 * considerando só os critérios com dado. Se `pesoAvaliacao` fosse zero e todos os
 * critérios ficassem sem dado, o denominador zeraria — 0/0.
 *
 * Exigir `> 0` é melhor do que tratar o caso especial depois: com ele, "todos os
 * critérios sem dado → nota final = nota da avaliação" **cai da própria fórmula**,
 * sem código extra e sem uma regra a mais para alguém lembrar.
 */
export function validarAplicacao(aplicacao: AplicacaoParaValidar): string[] {
  const problemas: string[] = [];
  const onde = `Aplicação "${aplicacao.nome}"`;

  if (!(aplicacao.pesoAvaliacao > 0)) {
    problemas.push(
      `${onde}: o peso do questionário é ${aplicacao.pesoAvaliacao}. Precisa ser maior que zero — ` +
        'é ele que sustenta a nota quando algum critério cadastral fica sem dado.',
    );
  }

  const vistos = new Set<string>();
  for (const item of aplicacao.criterios) {
    const rotulo = `${onde}, critério "${item.criterio.nome}"`;

    if (vistos.has(item.criterio.codigo)) {
      problemas.push(`${rotulo}: aparece mais de uma vez na aplicação.`);
    }
    vistos.add(item.criterio.codigo);

    if (!(item.peso > 0)) {
      // Peso zero é a forma errada de tirar um critério: ele continua sendo
      // calculado, aparece na memória de cálculo e não muda nada. Para excluir,
      // basta não listar o critério na aplicação.
      problemas.push(
        `${rotulo}: peso ${item.peso}. Para deixar um critério de fora, remova-o da ` +
          'aplicação em vez de zerar o peso.',
      );
    }

    problemas.push(...validarCriterioEmUso(item.criterio, onde));
  }

  if (aplicacao.versaoPublicada === false) {
    problemas.push(
      `${onde}: a versão do modelo é um RASCUNHO, não um instrumento publicado. ` +
        'Enquanto ela é rascunho, questão e peso ainda mudam — a avaliação sairia sobre um ' +
        'questionário que muda debaixo de quem responde. Publique a versão antes de usá-la.',
    );
  }

  if (aplicacao.modeloFinalidade === 'DEMONSTRACAO') {
    problemas.push(
      `${onde}: usa um modelo de DEMONSTRAÇÃO, que não pode ser usado em ciclo válido.`,
    );
  }

  return problemas;
}

/**
 * ⭐⭐ AVISOS DA ABERTURA — o que não impede abrir, mas quem abre precisa saber.
 *
 * ⚠️ **Por que AVISO e não problema.** Um critério `INFORMADO` sem valor nenhum
 * não torna o ciclo inválido: os valores chegam por planilha, e importar depois
 * de abrir é o fluxo normal. Bloquear a abertura por isso pararia o ciclo por
 * um trabalho que ainda tem semanas para acontecer.
 *
 * ⚠️ **E por que na ABERTURA, e não só depois.** A conferência de pendências do
 * painel roda sobre avaliações `ENVIADA` — com zero enviadas ela responde
 * *"nada a conferir ainda"*. Ou seja: a checagem que existia era **inalcançável
 * exatamente quando serviria**, e só falava depois que as notas já tinham saído
 * sem o critério. Este aviso é a mesma informação, no único momento em que ela
 * ainda muda alguma coisa.
 */
export function avisosParaAbrir(aplicacoes: readonly AplicacaoParaValidar[]): string[] {
  const semValor = new Map<string, { nome: string; aplicacoes: string[] }>();

  for (const app of aplicacoes) {
    for (const item of app.criterios) {
      if (item.criterio.origem !== 'INFORMADO') continue;
      if ((item.valoresInformadosNoCiclo ?? 0) > 0) continue;
      const atual = semValor.get(item.criterio.codigo) ?? {
        nome: item.criterio.nome,
        aplicacoes: [],
      };
      atual.aplicacoes.push(app.nome);
      semValor.set(item.criterio.codigo, atual);
    }
  }

  // Número em posição de rótulo, no fim — nenhuma palavra concorda com ele.
  return [...semValor.values()].map(
    (c) =>
      `O critério "${c.nome}" é INFORMADO e ainda não tem nenhum valor neste ciclo. ` +
      'Sem os valores ele fica fora da nota de todo mundo, pela renormalização, e a nota sai ' +
      'como se ele não existisse — sem erro em lugar nenhum. Importe antes de apurar. ' +
      `Aplicações que o usam: ${c.aplicacoes.length}.`,
  );
}

/**
 * ⭐ FAIXAS DE CONCEITO — contíguas por construção (decisão de 05/09/2026).
 *
 * Limite inferior INCLUSIVO, superior EXCLUSIVO, exceto a última faixa, que
 * inclui o 100:
 *
 *     0 ≤ x <  25   Insuficiente
 *    25 ≤ x <  50   Abaixo do esperado
 *    50 ≤ x <  75   Atende
 *    75 ≤ x <  90   Supera
 *    90 ≤ x ≤ 100   Excelente
 *
 * A validação checa **continuidade** — o fim de uma é o início da próxima — e
 * não cobertura ponto a ponto. É o que elimina o buraco em 24,5 qualquer que
 * seja a precisão decimal da nota (que é `Decimal(6,2)`): com faixas 0–24 e
 * 25–49, nota 24,5 não caía em faixa nenhuma e o conceito saía vazio.
 */
export function validarConceitos(faixas: readonly FaixaConceito[]): string[] {
  const problemas: string[] = [];
  if (faixas.length === 0) return ['O ciclo não tem faixas de conceito definidas.'];

  const ordenadas = [...faixas].sort((a, b) => a.limiteInferior - b.limiteInferior);

  if (ordenadas[0].limiteInferior !== 0) {
    problemas.push(
      `A primeira faixa de conceito começa em ${ordenadas[0].limiteInferior}, e precisa começar em 0.`,
    );
  }

  const ultima = ordenadas[ordenadas.length - 1];
  if (ultima.limiteSuperior !== 100) {
    problemas.push(
      `A última faixa de conceito termina em ${ultima.limiteSuperior}, e precisa terminar em 100.`,
    );
  }

  for (const faixa of ordenadas) {
    if (!(faixa.limiteSuperior > faixa.limiteInferior)) {
      problemas.push(
        `Faixa "${faixa.descricao}": termina em ${faixa.limiteSuperior} e começa em ` +
          `${faixa.limiteInferior} — não sobra nenhuma nota dentro dela.`,
      );
    }
  }

  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const atual = ordenadas[i];
    if (anterior.limiteSuperior !== atual.limiteInferior) {
      const relacao = anterior.limiteSuperior < atual.limiteInferior ? 'buraco' : 'sobreposição';
      problemas.push(
        `Há ${relacao} entre "${anterior.descricao}" (termina em ${anterior.limiteSuperior}) e ` +
          `"${atual.descricao}" (começa em ${atual.limiteInferior}). ` +
          'As faixas precisam ser contíguas: o fim de uma é o início da próxima.',
      );
    }
  }

  return problemas;
}

/**
 * Localiza o conceito de uma nota. Inferior inclusivo, superior exclusivo —
 * exceto na última faixa, que fecha em 100 para a nota máxima ter conceito.
 */
export function conceitoDaNota<T extends FaixaConceito>(
  faixas: readonly T[],
  nota: number,
): T | null {
  const ordenadas = [...faixas].sort((a, b) => a.limiteInferior - b.limiteInferior);
  for (let i = 0; i < ordenadas.length; i++) {
    const faixa = ordenadas[i];
    const ehUltima = i === ordenadas.length - 1;
    const dentro = ehUltima
      ? nota >= faixa.limiteInferior && nota <= faixa.limiteSuperior
      : nota >= faixa.limiteInferior && nota < faixa.limiteSuperior;
    if (dentro) return faixa;
  }
  return null;
}

/**
 * ⭐⭐ O QUE FALTA PARA ABRIR — a MESMA conta que a abertura faz.
 *
 * Existe separada do `assert` porque a tela precisa mostrar a lista **antes** do
 * clique, e não como erro depois dele. ⚠️ E é uma função só de propósito: se a
 * tela tivesse a própria versão da regra, ela diria "pode abrir" e a API
 * recusaria — as duas cópias divergem no primeiro critério novo. Aqui a tela lê
 * exatamente o que a guarda vai cobrar.
 */
export function problemasParaAbrir(
  aplicacoes: readonly AplicacaoParaValidar[],
  conceitos: readonly FaixaConceito[],
): string[] {
  return [
    ...(aplicacoes.length === 0 ? ['O ciclo não tem nenhuma aplicação.'] : []),
    ...aplicacoes.flatMap(validarAplicacao),
    // ⚠️ Público vazio é problema de ABRIR, não de CRIAR — por isso a checagem
    // mora aqui e não em `validarAplicacao`, que roda também na criação (onde o
    // público é sempre zero, por construção).
    ...aplicacoes
      .filter((a) => a.pessoasNoPublico === 0)
      .map(
        (a) =>
          `Aplicação "${a.nome}": nenhuma pessoa no público. Ela não geraria avaliação nenhuma — ` +
          'monte o público em Aplicações antes de abrir.',
      ),
    ...validarConceitos(conceitos),
  ];
}

/** Guarda da abertura do ciclo: aplicações + conceitos, tudo de uma vez. */
export function assertCicloAbrivel(
  aplicacoes: readonly AplicacaoParaValidar[],
  conceitos: readonly FaixaConceito[],
): void {
  const problemas = problemasParaAbrir(aplicacoes, conceitos);
  if (problemas.length > 0) throw new CicloNaoAbrivelError(problemas);
}
