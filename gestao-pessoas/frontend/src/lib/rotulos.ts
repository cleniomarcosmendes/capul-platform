/**
 * ⭐⭐ OS NOMES DOS CAMINHOS DE RECUPERAÇÃO — uma fonte para o BOTÃO e para o
 * RÓTULO que manda usá-lo.
 *
 * ── A REGRA (12/09/2026) ────────────────────────────────────────────────────
 *
 * **Origem e caminho de recuperação no mesmo rótulo.** Foi o que faltou quando
 * o "Excluir" produzia uma avaliação "cancelada" e ninguém sabia desfazer: o
 * estado estava na tela e a saída não. Um contador que diz *"39 canceladas"* e
 * uma seção que diz *"37"* não divergem — falta o termo, e o termo é **por onde
 * cada grupo volta**.
 *
 * ⚠️ Por que constante e não texto escrito duas vezes: o rótulo cita o nome do
 * BOTÃO. Se o botão for renomeado e a legenda não, ela passa a mandar a pessoa
 * procurar uma coisa que não existe mais — que é pior que não dizer nada,
 * porque ela vai procurar. Com a constante, renomear o botão renomeia a
 * instrução no mesmo commit, por construção.
 *
 * ⚠️ Só entram aqui nomes que **aparecem na tela e são citados em outro lugar**.
 * Rótulo usado num sítio só continua onde está — constante sem segundo leitor
 * é indireção sem ganho.
 */

/** O painel do ciclo encerrado que devolve as canceladas para a fila. */
export const ROTULO_DEVOLVER = 'Devolver canceladas';

/** A ação da aba Designação que desfaz o "Excluir" do RH. */
export const ROTULO_INCLUIR = 'Designação › Incluir';
