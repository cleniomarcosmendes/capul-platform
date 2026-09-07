/**
 * ⭐⭐ O PRÓXIMO PASSO DO CICLO — e quando NÃO existe um.
 *
 * A tela do ciclo não dizia em que passo se está nem qual é o seguinte: o
 * roteiro de tela de 07/09 abriu um ciclo e não soube o que fazer. Isto responde
 * a pergunta, mas com uma regra escrita — e a regra tem o direito de dizer "não
 * sei".
 *
 * ⚠️ **Quando não há próximo ÓBVIO, devolve `null` e a tela não mostra nada.**
 * Um "próximo passo" chutado é pior que nenhum: ele manda alguém fazer algo que
 * talvez não seja a vez de fazer, e a tela passa a mentir com ar de ajuda. O
 * caso que define isso é o ciclo ABERTO com tudo designado e ninguém
 * respondendo: **a bola não é do RH**, é dos avaliadores. Não há passo a
 * sugerir, e a linha de estado (que continua na tela) já mostra "3 de 894
 * enviadas", que é a informação verdadeira.
 *
 * ⚠️ Fica no BACKEND, junto dos números que a derivam, e não na tela: é a mesma
 * razão do `pedeAcao` do aviso de vínculo — regra derivada na tela é regra que
 * envelhece separada do dado. E aqui há teste.
 */

export type CodigoDoProximoPasso =
  | 'MONTAR_APLICACAO'
  | 'MONTAR_PUBLICO'
  | 'DESIGNAR'
  | 'ABRIR'
  | 'APURAR'
  | 'ENCERRAR';

export interface ProximoPasso {
  codigo: CodigoDoProximoPasso;
  /** Frase pronta, com o número dentro — a tela não monta texto. */
  rotulo: string;
  /** Aba do ciclo para onde o atalho leva. `null` = a ação é na lista de Ciclos. */
  aba: 'aplicacoes' | 'designacao' | 'painel' | null;
}

export interface EstadoDoCiclo {
  status: string;
  aplicacoes: number;
  /** Pessoas em `aplicacao_publico` — o recorte gravado. */
  noPublico: number;
  /** Avaliações existentes (designadas). */
  designados: number;
  /** Elegíveis do público que ninguém designou NESTE ciclo. */
  semDesignacao: number;
  enviadas: number;
  /** Avaliações ainda não enviadas (pendentes + em andamento). */
  aFazer: number;
  /** Resultados gravados pela apuração. */
  apuradas: number;
}

export function proximoPasso(e: EstadoDoCiclo): ProximoPasso | null {
  if (e.status === 'RASCUNHO') {
    if (e.aplicacoes === 0) {
      return {
        codigo: 'MONTAR_APLICACAO',
        rotulo: 'Monte a primeira aplicação — é ela que casa um questionário com um público',
        aba: 'aplicacoes',
      };
    }
    if (e.noPublico === 0) {
      return {
        codigo: 'MONTAR_PUBLICO',
        rotulo: 'Monte o público das aplicações — sem público, o ciclo não alcança ninguém',
        aba: 'aplicacoes',
      };
    }
    if (e.semDesignacao > 0) {
      return {
        codigo: 'DESIGNAR',
        rotulo: `Designe as ${e.semDesignacao} pessoa(s) sem avaliador neste ciclo`,
        aba: 'designacao',
      };
    }
    return {
      codigo: 'ABRIR',
      rotulo: 'Abra o ciclo — é o que libera os avaliadores para responder',
      aba: null,
    };
  }

  if (e.status === 'ABERTO') {
    // Designar continua valendo depois de aberto, e é o que trava a geração de
    // avaliação para quem entrou no público depois.
    if (e.semDesignacao > 0) {
      return {
        codigo: 'DESIGNAR',
        rotulo: `Designe as ${e.semDesignacao} pessoa(s) sem avaliador neste ciclo`,
        aba: 'designacao',
      };
    }

    // ⭐ AQUI É O "NÃO SEI", e é de propósito: falta gente responder, e quem
    // responde não é o RH. Sugerir "apurar" faria a tela empurrar uma apuração
    // parcial; sugerir "encerrar" seria pior — o encerrar recusa com pendência.
    if (e.aFazer > 0) return null;

    if (e.enviadas > 0 && e.apuradas < e.enviadas) {
      return {
        codigo: 'APURAR',
        rotulo: `Apure as ${e.enviadas} avaliação(ões) enviadas`,
        aba: 'painel',
      };
    }
    if (e.enviadas > 0 && e.apuradas >= e.enviadas) {
      return {
        codigo: 'ENCERRAR',
        rotulo: 'Encerre o ciclo — tudo foi enviado e apurado',
        aba: null,
      };
    }
    // Aberto, nada designado e nada a fazer: ciclo vazio. Não há passo óbvio —
    // pode ser um ciclo que nunca foi montado, e inventar "designe" seria
    // mandar designar quem não está no público.
    return null;
  }

  // ENCERRADO: acabou. Reabrir existe, mas é exceção — não é "o próximo passo".
  return null;
}
