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
  /**
   * ⭐⭐ O ÚNICO NÃO-IMPERATIVO, e isso NÃO é uma assimetria a consertar.
   *
   * Todos os outros nomeiam um ATO do RH e o rótulo vem no imperativo — "Monte",
   * "Designe", "Apure", "Encerre". Nesta fase **não há ato do RH**: as
   * avaliações estão designadas e quem responde são os avaliadores. O passo
   * existe para dizer **DE QUEM É A VEZ**, que é informação, não ordem.
   *
   * ⚠️ Quem for uniformizar isto vai achar que faltou o verbo. Não faltou:
   * escrever "Acompanhe" seria mandar olhar, e mandar olhar não é um passo. A
   * frase aponta o Painel porque é lá que a contagem por avaliador existe — a
   * única coisa concreta desta fase.
   */
  | 'ACOMPANHAR'
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

/**
 * ⭐⭐ O NÚMERO ENTRA COMO VALOR DE UM RÓTULO, nunca no meio da frase (09/09).
 *
 * Estes rótulos são texto que a API produz e a tela só exibe — a mensagem tem de
 * existir no backend mesmo com ninguém olhando. Concordar em número exigiria um
 * `flexao`/`contagem` do lado de cá, e aí seriam DUAS implementações da mesma
 * regra de texto (o frontend já tem a dele em `lib/formato.ts`) — a classe de
 * defeito que o dia inteiro de 09/09 foi gastar consertando.
 *
 * A saída é mais barata que o helper: **escrever de forma que o número não force
 * concordância.** *"Designe as 1 pessoa(s)"* quebra; *"Sem avaliador neste
 * ciclo: 1"* não quebra com nenhum número. Vale para todo texto do backend com
 * contagem dentro.
 */
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
    /**
     * ⭐⭐ "Designe ANTES DE ABRIR" PEDIA O IMPOSSÍVEL — corrigido em 12/09.
     *
     * O texto tratava a designação como pré-requisito da abertura. **Não é**:
     * `problemasParaAbrir` não olha `semDesignacao`, e o ciclo abre com gente
     * sem avaliador. Ela simplesmente não é avaliada.
     *
     * ⚠️ E há um caso em que o passo era **incumprível**: alguém no TOPO da
     * hierarquia — no ensaio de 12/09, o diretor executivo, que avalia 15
     * pessoas e não é avaliado por ninguém, porque o presidente não está no
     * cadastro. O painel mandava designá-lo para sempre, e o único caminho que
     * o sistema oferece para tirá-lo da conta é a EXCLUSÃO manual, que declara
     * "foi retirado do ciclo" — que não é o fato. Ver a lista de pendências da
     * Arielly: falta o conceito de "não avaliado por estar no topo".
     *
     * ⭐ O passo passou a dizer as DUAS coisas: o que designar resolve, e o que
     * acontece se abrir assim. Aviso que pede o impossível ensina a ignorar
     * avisos — e este é lido em todas as abas do ciclo.
     */
    if (e.semDesignacao > 0) {
      return {
        codigo: 'DESIGNAR',
        rotulo:
          `Sem avaliador neste ciclo: ${e.semDesignacao}. Designe, ou abra assim — ` +
          'quem ficar sem avaliador não é avaliado neste ciclo',
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
        rotulo: `Sem avaliador neste ciclo: ${e.semDesignacao}. Designe para ninguém ficar de fora`,
        aba: 'designacao',
      };
    }

    /**
     * ⭐⭐ A FASE MAIS LONGA DO CICLO, e ela ficava sem nada na tela.
     *
     * Devolver `null` aqui estava **meio certo**: a bola é dos avaliadores, e
     * sugerir "apurar" empurraria uma apuração parcial, "encerrar" bateria na
     * recusa. Mas *"a bola não é sua"* e *"não há nada a fazer"* são coisas
     * diferentes — e o `null` dizia a segunda. Entre abrir e apurar podem
     * passar semanas, e era justamente aí que o cabeçalho ficava mudo.
     *
     * ⚠️ O passo NÃO manda fazer nada (ver `ACOMPANHAR`): diz de quem é a vez e
     * aponta onde está a contagem por avaliador.
     */
    if (e.aFazer > 0) {
      return {
        codigo: 'ACOMPANHAR',
        // ⚠️ Sem atribuir intenção. Quem não respondeu pode ter mil motivos, e
        // esta é a frase que a gestora lê imediatamente antes de cobrar alguém:
        // o Painel mostra uma CONTAGEM por pessoa, não um veredito sobre ela.
        rotulo:
          `Agora é com os avaliadores — ainda não enviadas: ${e.aFazer}. ` +
          'O Painel mostra quantas faltam por avaliador',
        aba: 'painel',
      };
    }

    if (e.enviadas > 0 && e.apuradas < e.enviadas) {
      return {
        codigo: 'APURAR',
        rotulo: `Apure o que já foi enviado — enviadas: ${e.enviadas}`,
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
