/**
 * VALIDAÇÃO DAS FAIXAS DE UM CRITÉRIO.
 *
 * ⚠️ **Não confundir com `ciclo/abertura.validator.ts → validarConceitos`.** As
 * duas checam "continuidade" e são regras DIFERENTES:
 *
 *   ConceitoFaixa (ciclo)   0–100 fechado, sempre numérica, sem ponta aberta.
 *                           Precisa começar em 0 e terminar em 100.
 *   CriterioFaixa (aqui)    pode ser DOMINIO (código exato, sem limite nenhum)
 *                           ou NUMERICA com pontas ABERTAS — "mais de 7 anos"
 *                           é `{inf: 7, sup: null}`, e exigir teto recusaria o
 *                           instrumento que está em produção.
 *
 * Aplicar a regra dos conceitos aqui reprovaria TEMPO_EMPRESA e ESCOLARIDADE,
 * que são exatamente os critérios que rodam hoje.
 *
 * ── O que se checa, e por quê ───────────────────────────────────────────────
 *
 * NUMERICA — o fim de uma faixa é o começo da próxima, e a fronteira pertence a
 * exatamente UMA delas. Sem isso:
 *   • buraco → o valor não cai em faixa nenhuma, o critério vira `semDado` e sai
 *     da nota pela renormalização, **sem erro**, para todo mundo naquela faixa;
 *   • sobreposição → `localizarFaixa` devolve a primeira por `ordem`, então a
 *     pontuação passa a depender da ordem de cadastro. Dois cadastros
 *     equivalentes dariam notas diferentes.
 *
 * ⭐ A fronteira é o caso que ninguém vê. `(0,3]` seguido de `[3,5]` não tem
 * buraco nem sobreposição de INTERVALO — mas o valor 3 cai nas duas. Por isso a
 * checagem é sobre a INCLUSIVIDADE: exatamente uma das duas pontas fecha.
 *
 * DOMINIO — não há intervalo; o que mata é código repetido (mesma decisão
 * dependendo da ordem) ou código vazio (faixa que nunca casa com nada).
 */
import { ErroDeDominio } from '../common/erro-de-dominio.js';

export type TipoFaixa = 'NUMERICA' | 'DOMINIO';

export interface FaixaValidavel {
  tipo: TipoFaixa;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  inclusivoInf: boolean;
  inclusivoSup: boolean;
  valorDominio: string | null;
  pontuacao: number;
  rotulo: string | null;
  ordem: number;
}

export class FaixasInvalidasError extends ErroDeDominio {
  /** A lista É a resposta: a tela renderiza item a item. */
  override corpo() {
    return { message: this.problemas };
  }

  constructor(readonly problemas: string[]) {
    super(problemas.join('\n- '));
  }
}

const nome = (f: FaixaValidavel, i: number) => f.rotulo?.trim() || `faixa ${i + 1}`;

/** Lista de problemas — vazia quando as faixas estão coerentes. */
export function validarFaixasDoCriterio(
  tipoValor: 'NUMERICO' | 'DOMINIO',
  faixas: readonly FaixaValidavel[],
): string[] {
  const problemas: string[] = [];

  // Critério sem faixa é legítimo enquanto se cadastra — o que não pode é ENTRAR
  // numa aplicação assim. Quem barra isso é a abertura do ciclo, não aqui.
  if (faixas.length === 0) return problemas;

  const esperado: TipoFaixa = tipoValor === 'DOMINIO' ? 'DOMINIO' : 'NUMERICA';
  const divergentes = faixas.filter((f) => f.tipo !== esperado);
  if (divergentes.length) {
    // ⚠️ O número fica em posição de RÓTULO, no fim. Toda palavra que
    // concordaria com ele saiu da frase — ver `texto-sem-flexao.invariante`.
    problemas.push(
      `Há faixa do tipo errado neste critério ${tipoValor}: toda faixa dele precisa ser ` +
        `${esperado}. Fora do tipo: ${divergentes.length}.`,
    );
    // Sem tipo uniforme as checagens abaixo não fazem sentido — parar aqui evita
    // uma cascata de mensagens que escondem a causa.
    return problemas;
  }

  faixas.forEach((f, i) => {
    if (!(f.pontuacao >= 0 && f.pontuacao <= 100)) {
      problemas.push(
        `"${nome(f, i)}": pontuação ${f.pontuacao} fora de 0 a 100. A pontuação da faixa é a nota ` +
          'do critério, na mesma escala da nota do questionário.',
      );
    }
  });

  return esperado === 'DOMINIO'
    ? [...problemas, ...validarDominio(faixas)]
    : [...problemas, ...validarNumericas(faixas)];
}

function validarDominio(faixas: readonly FaixaValidavel[]): string[] {
  const problemas: string[] = [];
  const vistos = new Map<string, number>();

  faixas.forEach((f, i) => {
    const valor = (f.valorDominio ?? '').trim();
    if (!valor) {
      problemas.push(
        `"${nome(f, i)}": faixa de domínio sem valor. Ela nunca casaria com nenhum cadastro.`,
      );
      return;
    }
    const antes = vistos.get(valor);
    if (antes !== undefined) {
      problemas.push(
        `O valor "${valor}" está em duas faixas ("${nome(faixas[antes], antes)}" e ` +
          `"${nome(f, i)}"). A pontuação passaria a depender da ordem de cadastro.`,
      );
    } else {
      vistos.set(valor, i);
    }
  });

  return problemas;
}

function validarNumericas(faixas: readonly FaixaValidavel[]): string[] {
  const problemas: string[] = [];

  faixas.forEach((f, i) => {
    const { limiteInferior: inf, limiteSuperior: sup } = f;
    if (inf !== null && sup !== null) {
      if (sup < inf) {
        problemas.push(`"${nome(f, i)}": termina em ${sup} e começa em ${inf}.`);
      } else if (sup === inf && !(f.inclusivoInf && f.inclusivoSup)) {
        // Faixa de ponto único é legítima — TEMPO_EMPRESA usa `[0,0]` para
        // "admitido hoje". Só vale se as duas pontas fecharem; senão é vazia.
        problemas.push(
          `"${nome(f, i)}": começa e termina em ${inf} mas não fecha as duas pontas — ` +
            'nenhum valor cabe dentro dela.',
        );
      }
    }
  });

  // Ordenar pelo limite inferior (null = -infinito) é o que revela buraco e
  // sobreposição independentemente da `ordem` que o RH digitou.
  const ordenadas = [...faixas].sort((a, b) => {
    const ai = a.limiteInferior ?? Number.NEGATIVE_INFINITY;
    const bi = b.limiteInferior ?? Number.NEGATIVE_INFINITY;
    return ai - bi || a.ordem - b.ordem;
  });

  const semTeto = ordenadas.filter((f) => f.limiteSuperior === null);
  if (semTeto.length > 1) {
    problemas.push(
      'Só a última faixa pode ficar sem limite superior ("mais de X") — as outras se ' +
        `sobrepõem a ela. Sem limite superior: ${semTeto.length}.`,
    );
  }
  const semPiso = ordenadas.filter((f) => f.limiteInferior === null);
  if (semPiso.length > 1) {
    problemas.push(
      'Só a primeira faixa pode ficar sem limite inferior. ' +
        `Sem limite inferior: ${semPiso.length}.`,
    );
  }

  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const atual = ordenadas[i];
    const rotAnt = nome(anterior, faixas.indexOf(anterior));
    const rotAtu = nome(atual, faixas.indexOf(atual));

    if (anterior.limiteSuperior === null) continue; // já reportado acima
    if (atual.limiteInferior === null) continue;

    if (anterior.limiteSuperior < atual.limiteInferior) {
      problemas.push(
        `Há buraco entre "${rotAnt}" (termina em ${anterior.limiteSuperior}) e "${rotAtu}" ` +
          `(começa em ${atual.limiteInferior}). Valor nesse intervalo não cai em faixa nenhuma: ` +
          'o critério sairia da nota da pessoa sem acusar erro.',
      );
    } else if (anterior.limiteSuperior > atual.limiteInferior) {
      problemas.push(
        `Há sobreposição entre "${rotAnt}" (termina em ${anterior.limiteSuperior}) e "${rotAtu}" ` +
          `(começa em ${atual.limiteInferior}). A pontuação passaria a depender da ordem de cadastro.`,
      );
    } else if (anterior.inclusivoSup && atual.inclusivoInf) {
      problemas.push(
        `O valor ${atual.limiteInferior} cai em "${rotAnt}" e em "${rotAtu}" ao mesmo tempo — ` +
          'as duas incluem o limite. Exatamente uma das duas precisa incluí-lo.',
      );
    } else if (!anterior.inclusivoSup && !atual.inclusivoInf) {
      problemas.push(
        `O valor ${atual.limiteInferior} não cai em "${rotAnt}" nem em "${rotAtu}" — ` +
          'nenhuma das duas inclui o limite. Exatamente uma das duas precisa incluí-lo.',
      );
    }
  }

  return problemas;
}

export function assertFaixasValidas(
  tipoValor: 'NUMERICO' | 'DOMINIO',
  faixas: readonly FaixaValidavel[],
): void {
  const problemas = validarFaixasDoCriterio(tipoValor, faixas);
  if (problemas.length) throw new FaixasInvalidasError(problemas);
}
