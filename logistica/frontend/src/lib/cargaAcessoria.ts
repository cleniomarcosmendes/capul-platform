import { useCallback, useState } from 'react';
import { errMsg } from '../pages/frota-utils';

/**
 * Carga acessória que NÃO transforma falha em vazio.
 *
 * O padrão `.catch(() => ({ data: [] }))` está espalhado pelo módulo e a intenção é boa:
 * uma chamada secundária não deve derrubar a tela inteira. O efeito colateral é que
 * **401, 403, 429, timeout e "de fato não há nada" produzem a MESMA tela** — um seletor
 * vazio, sem uma palavra.
 *
 * Isso não é teórico: em 10–11/09/2026 o relato *"o sistema não listou o departamento"*
 * levou dois dias para ser nomeado exatamente porque nem o usuário nem o log conseguiam
 * distinguir "não pode" de "não há" de "quebrou". Pior, uma das listas vazias virava a
 * frase *"Nenhum departamento participa do RDV nesta filial ainda"* — uma AFIRMAÇÃO
 * falsa sobre o banco.
 *
 * Aqui a falha continua não derrubando a tela, mas fica REGISTRADA, e a tela diz o que
 * não carregou. Use sempre que a chamada alimentar:
 * - uma **lista de escolha** (seletor que vazio impede o usuário de agir); ou
 * - uma **resolução de nome** (vazio degrada rótulos para ids).
 */
export function useFalhasCarga() {
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const registrarFalha = useCallback((chave: string, msg: string | null) => {
    setFalhas((prev) => {
      if (!msg) {
        if (!(chave in prev)) return prev;
        const { [chave]: _ignorado, ...resto } = prev;
        return resto;
      }
      return prev[chave] === msg ? prev : { ...prev, [chave]: msg };
    });
  }, []);
  return { falhas, registrarFalha };
}

export type RegistrarFalha = (chave: string, msg: string | null) => void;

/**
 * Envolve uma busca acessória. `vazio` é o valor que a tela usa quando falha — o mesmo
 * que o `.catch` devolvia —, então o comportamento de renderização não muda; o que muda
 * é que a falha passa a ter voz.
 *
 * `oQue` entra na frase "Não foi possível carregar {oQue}." — escreva do ponto de vista
 * de quem lê a tela ("os motoristas", "os departamentos desta filial"), não o nome da rota.
 */
export function buscaAcessoria<T>(
  p: Promise<{ data: T }>,
  vazio: T,
  chave: string,
  oQue: string,
  registrar: RegistrarFalha,
): Promise<{ data: T }> {
  return p
    .then((r) => {
      registrar(chave, null);
      return r;
    })
    .catch((e) => {
      registrar(chave, errMsg(e, `Não foi possível carregar ${oQue}.`));
      return { data: vazio };
    });
}
