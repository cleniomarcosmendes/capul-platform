/**
 * VALIDAÇÃO DE PUBLICAÇÃO DO MODELO (§4.6).
 *
 * Publicar é o ponto sem volta: a versão publicada é imutável, e a partir dela
 * saem notas com consequência de mérito. Tudo que puder ser conferido, é
 * conferido aqui — e a mensagem tem de dizer **qual grupo** e **o que fazer**,
 * porque quem lê é o RH, não quem escreveu o código.
 *
 * A checagem central é a do `codigoCalculo`. Desde que `TipoCriterio` virou
 * catálogo (`rh.criterio`), o vínculo entre a linha que o RH administra e o
 * código que calcula é uma STRING — e string errada não quebra nada: o critério
 * devolve vazio, em silêncio, para todas as pessoas do ciclo. O grupo vira
 * `semDado`, sai da renormalização (§4.3) e a nota final de todo mundo muda sem
 * um erro sequer. É barato de causar (um caractere no cadastro) e caro de achar
 * depois, com as notas já fechadas.
 *
 * Validador PURO: sem Prisma e sem Nest, para o service poder chamá-lo em
 * qualquer ponto e para o teste não precisar de banco.
 */
import { codigosRegistrados, resolverRegistrado } from '../calculo/resolvers/registry.js';

export type OrigemGrupo = 'MANUAL' | 'AUTOMATICO';
export type OrigemValorCriterio = 'CALCULADO' | 'INFORMADO';

/** O recorte de `rh.criterio` de que a validação precisa. */
export interface CriterioDoGrupo {
  codigo: string;
  nome: string;
  origem: OrigemValorCriterio;
  codigoCalculo?: string | null;
  ativo: boolean;
}

/** O recorte de `rh.grupo` de que a validação precisa. */
export interface GrupoParaPublicacao {
  titulo: string;
  origem: OrigemGrupo;
  criterio?: CriterioDoGrupo | null;
}

export class ModeloNaoPublicavelError extends Error {
  constructor(readonly problemas: string[]) {
    super(`Modelo não pode ser publicado:\n- ${problemas.join('\n- ')}`);
    this.name = 'ModeloNaoPublicavelError';
  }
}

/**
 * Devolve a lista de problemas — vazia quando o modelo pode ser publicado.
 * Junta TODOS os problemas em vez de parar no primeiro: quem está cadastrando
 * corrige de uma vez, em vez de descobrir um erro por tentativa.
 */
export function validarCriteriosDoModelo(grupos: readonly GrupoParaPublicacao[]): string[] {
  const problemas: string[] = [];

  if (grupos.length === 0) {
    problemas.push('O modelo não tem nenhum grupo.');
  }

  for (const grupo of grupos) {
    const onde = `Grupo "${grupo.titulo}"`;

    if (grupo.origem === 'MANUAL') {
      // Grupo manual é respondido pelo avaliador; um critério pendurado nele
      // seria ignorado no cálculo — silêncio de novo, com outro disfarce.
      if (grupo.criterio) {
        problemas.push(
          `${onde}: é MANUAL (respondido pelo avaliador) mas está vinculado ao critério ` +
            `"${grupo.criterio.nome}". Remova o vínculo ou mude a origem para AUTOMÁTICO.`,
        );
      }
      continue;
    }

    const criterio = grupo.criterio;
    if (!criterio) {
      problemas.push(`${onde}: é AUTOMÁTICO e não aponta para nenhum critério do catálogo.`);
      continue;
    }

    if (!criterio.ativo) {
      problemas.push(
        `${onde}: usa o critério "${criterio.nome}" (${criterio.codigo}), que está INATIVO no catálogo.`,
      );
    }

    if (criterio.origem === 'CALCULADO') {
      const codigo = (criterio.codigoCalculo ?? '').trim();
      if (!codigo) {
        problemas.push(
          `${onde}: o critério "${criterio.nome}" é CALCULADO e está sem código de cálculo. ` +
            `Códigos disponíveis: ${codigosRegistrados().join(', ')}.`,
        );
      } else if (!resolverRegistrado(codigo)) {
        problemas.push(
          `${onde}: o critério "${criterio.nome}" aponta para o código de cálculo "${codigo}", ` +
            `que não existe no sistema. Sem isso o critério ficaria em branco para todos os ` +
            `avaliados, sem acusar erro. Códigos disponíveis: ${codigosRegistrados().join(', ')}.`,
        );
      }
    } else if ((criterio.codigoCalculo ?? '').trim()) {
      // INFORMADO com codigoCalculo preenchido: alguém trocou a origem depois de
      // cadastrar e o campo ficou para trás. O valor virá da importação e o
      // código seria ignorado — melhor recusar do que fingir que os dois valem.
      problemas.push(
        `${onde}: o critério "${criterio.nome}" é INFORMADO (valor importado ou digitado) ` +
          `mas tem código de cálculo "${criterio.codigoCalculo}". Limpe o código de cálculo ` +
          `ou mude a origem do critério para CALCULADO.`,
      );
    }
  }

  return problemas;
}

/** Mesma validação, em forma de guarda. Use na publicação. */
export function assertModeloPublicavel(grupos: readonly GrupoParaPublicacao[]): void {
  const problemas = validarCriteriosDoModelo(grupos);
  if (problemas.length > 0) throw new ModeloNaoPublicavelError(problemas);
}
