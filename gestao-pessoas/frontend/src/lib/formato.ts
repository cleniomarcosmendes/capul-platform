/**
 * Data em pt-BR SEM passar por `Date`.
 *
 * O backend manda AAAA-MM-DD (ou ISO com hora) em UTC. `new Date('2026-09-05')`
 * seguido de `toLocaleDateString` volta 04/09 em qualquer fuso a oeste de
 * Greenwich — e a data-base do ciclo é o campo que ancora todo cálculo temporal
 * do módulo. Recortar a string não erra.
 */
export function data(valor: string | null | undefined): string {
  if (!valor) return '—';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Nota com duas casas e vírgula, como o resto da plataforma mostra. */
export function nota(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

/**
 * Data e HORA, para carimbo de quando algo foi feito.
 *
 * ⚠️ Aqui o `Date` é usado de propósito, ao contrário de `data()`: a hora vem em
 * UTC e precisa ser mostrada no fuso de quem lê — "apurado às 13:02" tem de ser
 * 13:02 do relógio da sala. O risco de `data()` (a data pular um dia) não existe
 * quando a hora está junto.
 */
export function dataHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * ⭐⭐ CONCORDÂNCIA DE NÚMERO — a irmã da regra de gênero (§3.1.7).
 *
 * §3.1.7 proíbe particípio concordado em GÊNERO porque `rh.colaborador` não
 * guarda gênero: não há de onde derivar. **Com número é o contrário — o número
 * está na mão.** Escrever *"1 serão recusadas"* ou *"1 pessoas"* é declinar de
 * usar um dado que se tem, e o defeito só aparece no caso de UMA, que é
 * justamente o caso raro que ninguém testa e que a tela mostra no pior dia.
 *
 * ⚠️ Existiam TRÊS jeitos no módulo, medidos em 08/09: 10 ternários
 * `n === 1 ? … : …` (certos, reinventados um a um), **17 frases simplesmente
 * erradas**, e 56 fugas com `"(s)"`. Três jeitos é o mesmo que nenhum: a
 * próxima frase é escrita pela mesma mão que escreveu a anterior, e foi assim
 * que as 17 nasceram. Daqui em diante, **um jeito só**.
 *
 * ⚠️ Recebe as duas formas por extenso de propósito. Plural em português não é
 * "+s" (`avaliação`→`avaliações`, `alguém já respondida`→`já respondidas`), e
 * uma regra automática erraria calada — que é o defeito que estas funções
 * existem para tirar da tela.
 */
export function flexao(n: number, umaSo: string, varias: string): string {
  return n === 1 ? umaSo : varias;
}

/**
 * O número **e** a palavra, para quando os dois saem juntos:
 * `contagem(3, 'pessoa', 'pessoas')` → `"3 pessoas"`.
 *
 * Quando o número precisa de marcação própria (`<strong className="tabular-nums">`),
 * use `flexao` para a palavra e renderize o número separado.
 */
export function contagem(n: number, umaSo: string, varias: string): string {
  return `${n} ${flexao(n, umaSo, varias)}`;
}
