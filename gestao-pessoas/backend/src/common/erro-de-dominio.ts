/**
 * ⭐⭐ A BASE DOS ERROS DE DOMÍNIO — para a camada que SABE não depender da
 * camada que RESPONDE.
 *
 * ── O DEFEITO QUE CRIOU ISTO (12/09/2026) ───────────────────────────────────
 *
 * `ModeloNaoPublicavelError` carrega `problemas: string[]` — a lista do que
 * falta para publicar, que é **o produto inteiro do validador**. Ele estende
 * `Error` puro, então o Nest não sabia o que fazer com ele e devolvia
 * **500 "Erro interno do servidor"**: a tela recebia nada, e quem chamasse a API
 * direto também.
 *
 * ⚠️ **A spec do validador era verde.** Ela exercita a FUNÇÃO — a lista sai
 * certa. O que estava quebrado era a ponte entre a função e a resposta HTTP, e
 * nenhum teste de unidade olha para lá.
 *
 * ⚠️ E `CicloNaoAbrivelError` **já fazia certo** (`ciclo.service.ts:150`,
 * `instanceof` + `BadRequestException`) desde antes. O padrão existia, estava a
 * três arquivos de distância, e não foi copiado — que é a mesma forma da
 * §3.1.93 (*a camada que sabe não é a camada que responde*) e da §3.1.88 (*o
 * grep acha onde a regra foi escrita, não onde ela deveria estar*).
 *
 * ── A SAÍDA: UMA PONTE SÓ ───────────────────────────────────────────────────
 *
 * Em vez de um `try/catch` por chamador — que é o desenho que já falhou —, o
 * erro declara o **status** e o **payload** que a tela precisa, e um filtro
 * global (`erro-de-dominio.filter.ts`) traduz. Chamador novo herda a tradução
 * sem escrever nada, e é isso que fecha a classe do defeito.
 *
 * O invariante `erro-de-dominio.invariante.spec.ts` exige que **todo** erro de
 * domínio do módulo estenda esta classe.
 */

/** O corpo que chega à tela, no formato que o resto do módulo já devolve. */
export interface CorpoDoErro {
  message: string | string[];
  [extra: string]: unknown;
}

export abstract class ErroDeDominio extends Error {
  /**
   * O status HTTP deste erro. Padrão 400 — quase todos são "o pedido não pode
   * ser atendido com estes dados".
   */
  readonly status: number = 400;

  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }

  /**
   * O que vai no corpo da resposta.
   *
   * ⚠️ Sobrescrever quando houver payload: uma lista de problemas em
   * `message` é o que a tela do módulo já sabe renderizar (`mensagemDoErro`
   * aceita string e array), e um campo extra dá o dado estruturado a quem
   * chama a API direto.
   */
  corpo(): CorpoDoErro {
    return { message: this.message };
  }
}
