/**
 * REGISTRO DOS RESOLVERS DE CRITÉRIO CALCULADO.
 *
 * ⭐ Esta tabela é a fonte da verdade sobre quais `codigoCalculo` EXISTEM. A
 * publicação de um modelo consulta daqui (ver `modelo/publicacao.validator.ts`).
 *
 * Por que a validação é obrigatória: um critério CALCULADO apontando para um
 * código sem resolver não quebra — ele **retorna vazio, em silêncio, para todo
 * mundo**. O grupo inteiro viraria `semDado`, sairia da renormalização e a nota
 * final mudaria para o ciclo inteiro sem que ninguém recebesse um erro. Um
 * `codigoCalculo` digitado com um caractere a mais no cadastro do RH bastaria.
 *
 * Como acrescentar um critério calculado novo:
 *   1. escreva o resolver (função pura, ao lado deste arquivo);
 *   2. registre-o aqui, no mapa `RESOLVERS`;
 *   3. crie a linha em `rh.criterio` com `origem = CALCULADO` e o mesmo
 *      `codigoCalculo` (seed ou migration de dados);
 *   4. as faixas continuam sendo cadastro do RH.
 *
 * Critério que o RH pode criar sozinho, sem deploy, é o `origem = INFORMADO`:
 * o valor vem por importação/digitação, não daqui.
 */
import type { ResolverCriterio } from './resolver.types.js';
import { escolaridade } from './escolaridade.resolver.js';
import { qtdeTreinamento } from './qtde-treinamento.resolver.js';
import { tempoEmpresa } from './tempo-empresa.resolver.js';
import { tempoFuncao } from './tempo-funcao.resolver.js';

export const RESOLVERS: Readonly<Record<string, ResolverCriterio>> = Object.freeze({
  ESCOLARIDADE: escolaridade,
  TEMPO_EMPRESA: tempoEmpresa,
  TEMPO_FUNCAO: tempoFuncao,
  QTDE_TREINAMENTO: qtdeTreinamento,
});

export function resolverRegistrado(codigoCalculo: string | null | undefined): boolean {
  return !!codigoCalculo && Object.hasOwn(RESOLVERS, codigoCalculo);
}

export function obterResolver(codigoCalculo: string): ResolverCriterio {
  const r = RESOLVERS[codigoCalculo];
  if (!r) {
    // Nunca deve acontecer em runtime: a publicação já barrou. Se acontecer,
    // é ruído alto de propósito — o modo de falha silencioso é o que se evita.
    throw new Error(
      `Critério calculado sem resolver: "${codigoCalculo}". ` +
        `Registrados: ${codigosRegistrados().join(', ')}.`,
    );
  }
  return r;
}

export function codigosRegistrados(): string[] {
  return Object.keys(RESOLVERS).sort();
}
