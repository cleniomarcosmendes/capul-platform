import { data } from './formato';

/**
 * ⭐⭐ A MESMA FRASE em toda tela que tem botão de escrita no ciclo.
 *
 * O backend passou a recusar designação, público e apuração em ciclo encerrado
 * (§3.1.12) — e as telas não sabiam: os botões continuavam com aparência normal
 * e a pessoa só descobria no erro, depois do clique. É o oposto do que se fez no
 * Apurar e no Abrir.
 *
 * ⚠️ **Desabilitar com o motivo, nunca esconder.** Esconder faz o ciclo
 * encerrado parecer outra tela e apaga a informação de que a ação existe;
 * desabilitado com o motivo mantém a leitura e ensina a saída — o mesmo padrão
 * do "Encerrar ciclo" com avaliação pendente e da faixa do rascunho.
 *
 * Devolve `null` quando o ciclo aceita escrita — assim o chamador usa
 * `disabled={!!motivo}` e `title={motivo}` sem nenhum `if` a mais.
 */
export function motivoCicloEncerrado(ciclo: {
  status: string;
  encerradoEm?: string | null;
}): string | null {
  if (ciclo.status !== 'ENCERRADO') return null;
  const quando = ciclo.encerradoEm ? ` em ${data(ciclo.encerradoEm)}` : '';
  return `Ciclo encerrado${quando}. Para voltar a mexer, reabra o ciclo na lista de Ciclos — é ato do RH_ADMIN, exige motivo e fica registrado.`;
}
