/**
 * ⭐⭐ O CLASSIFICADOR das duas operações de versão: DUPLICAR e DESCARTAR.
 *
 * Uma função pura por ato, devolvendo `{ acao, frase }`. A tela lê para
 * desabilitar o botão **com o motivo escrito**, e o serviço lê para recusar —
 * uma fonte só. Duas cópias da regra divergem no primeiro caso novo, e aí a
 * tela promete o que o ato recusa (§3.1.33).
 */

export type Acao = 'PERMITIR' | 'RECUSAR';

export interface Efeito {
  acao: Acao;
  frase: string;
}

export interface ContextoDuplicar {
  modeloNome: string;
  /** Número da versão de origem. */
  versaoOrigem: number;
  /**
   * O rascunho que já existe neste modelo, se existir. `null` = não há.
   *
   * ⚠️ **Um rascunho por modelo, de propósito.** Com dois, "o rascunho do
   * Administrativo" deixa de ter referente: o editor teria de perguntar qual a
   * cada abertura, e duas pessoas editariam arranjos diferentes acreditando
   * estar no mesmo. O custo de errar é publicar o rascunho errado — e o que se
   * publica vira a régua de gente real.
   */
  rascunhoExistente: { versao: number } | null;
}

export function efeitoDeDuplicar(ctx: ContextoDuplicar): Efeito {
  if (ctx.rascunhoExistente) {
    return {
      acao: 'RECUSAR',
      frase:
        `${ctx.modeloNome} já tem um rascunho aberto (v${ctx.rascunhoExistente.versao}). ` +
        'Continue nele, publique-o, ou descarte-o antes de começar outro — dois rascunhos ' +
        'do mesmo perfil não têm como ser distinguidos na hora de publicar.',
    };
  }
  return {
    acao: 'PERMITIR',
    frase:
      `Cria um rascunho a partir da v${ctx.versaoOrigem} de ${ctx.modeloNome}, com as mesmas ` +
      'questões e os mesmos pesos. A v' +
      `${ctx.versaoOrigem} continua valendo — nenhum ciclo muda enquanto o rascunho não for ` +
      'publicado.',
  };
}

export interface ContextoDescartar {
  modeloNome: string;
  versao: number;
  publicada: boolean;
  /** Quantas aplicações apontam para esta versão. */
  aplicacoesQueUsam: number;
}

export function efeitoDeDescartar(ctx: ContextoDescartar): Efeito {
  if (ctx.publicada) {
    return {
      acao: 'RECUSAR',
      frase:
        `A v${ctx.versao} de ${ctx.modeloNome} está PUBLICADA. Versão publicada é o instrumento ` +
        'sobre o qual notas já foram (ou serão) calculadas — apagá-la deixaria avaliação sem ' +
        'régua. Só rascunho se descarta.',
    };
  }
  if (ctx.aplicacoesQueUsam > 0) {
    /**
     * ⚠️ Não deveria acontecer: desde 12/09 a aplicação recusa versão em
     * rascunho, nos três momentos. Fica como rede — se um dia a guarda de lá
     * ceder, o sintoma é uma recusa aqui, e não uma aplicação apontando para
     * uma linha que não existe mais.
     */
    return {
      acao: 'RECUSAR',
      frase:
        `A v${ctx.versao} está em uso por ${ctx.aplicacoesQueUsam} ` +
        `${ctx.aplicacoesQueUsam === 1 ? 'aplicação' : 'aplicações'}. Tire a versão das ` +
        'aplicações antes de descartá-la.',
    };
  }
  return {
    acao: 'PERMITIR',
    frase:
      `Apaga o rascunho v${ctx.versao} de ${ctx.modeloNome} e tudo o que foi montado nele. ` +
      '⚠️ Não desfaz: as questões continuam no acervo, mas o arranjo (quais entram, em que ' +
      'ordem, com que peso por classificação) se perde. Nenhuma versão publicada é tocada.',
  };
}
