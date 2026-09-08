/**
 * ⭐⭐ A CHAPA VEM EM DUAS FORMAS, E SÓ UMA ESTÁ NA NOSSA BASE.
 *
 * O Protheus identifica o colaborador como **`E01981`**; `rh.colaborador` guarda
 * **`001981`** — 1.036 linhas em 08/09/2026, todas `0` + 5 dígitos, sem uma
 * exceção (o `sincronizacao` é quem escreve, e escreve sempre assim).
 *
 * ⚠️ **O SINTOMA de errar a forma é um 403 que PARECE falta de permissão.** A
 * pessoa loga, tem o papel certo, e lê *"sua matrícula não corresponde a nenhum
 * colaborador ativo"*. Quem investiga vai ao Configurador **dar papel a quem já
 * tem**, encontra tudo certo, e conclui que a tela do Configurador está com
 * defeito — o problema está a dois schemas de distância, num campo de texto.
 * Aconteceu em 08/09 com duas contas, e **quase contaminou a investigação de um
 * outro defeito**, que tinha exatamente a mesma cara na tela.
 *
 * ⚠️ **Isto é a REDE, não a torneira.** A fonte foi fechada no mesmo dia
 * (`configurador/src/lib/chapa.ts` normaliza ao preencher e ao salvar), mas
 * dado legado continua na base — em 08/09, `marcelojunio` = `E03942`, conta
 * ativa — e nada impede outro caminho de escrita de gravar a forma do Protheus.
 * A defesa fica aqui porque é aqui que o erro vira 403.
 *
 * ⭐ Precedente: a Logística já trata a mesma colisão comparando os 5 últimos
 * dígitos (`E01047` e `001047` são a mesma chapa; **1 valor usa, 0 ou 2+ devolve
 * null**). A regra de ambiguidade equivalente aqui é o `escolherColaboradorUnico`.
 */

/** `E01981` → `001981`. Qualquer outra coisa volta como veio (só aparada e em maiúsculas). */
export function normalizarChapa(valor: string | null | undefined): string {
  const bruto = (valor ?? '').trim().toUpperCase();
  return /^E\d{5}$/.test(bruto) ? `0${bruto.slice(1)}` : bruto;
}

/**
 * As formas pelas quais esta chapa pode estar gravada — para buscar por TODAS em
 * vez de escolher uma.
 *
 * ⚠️ Buscar pelas duas, e não só pela normalizada, é de propósito: se um dia o
 * `rh.colaborador` tiver a forma `E…` (importação nova, correção manual), a
 * busca continua achando em vez de passar a falhar do outro lado. E se as DUAS
 * existirem como pessoas diferentes, quem decide é a regra de ambiguidade que já
 * existe — não esta função, que só oferece candidatos.
 *
 * ⚠️ Regra estreita de propósito: nada de "tira letras e compara dígitos".
 * `SUPVEN01` (login de posto) não é chapa de ninguém e tem de continuar não
 * achando nada. Prefixo novo deve falhar visivelmente aqui, não ser adivinhado.
 */
export function chapasEquivalentes(valor: string | null | undefined): string[] {
  const bruto = (valor ?? '').trim().toUpperCase();
  if (!bruto) return [];
  const normalizada = normalizarChapa(bruto);
  return normalizada === bruto ? [bruto] : [normalizada, bruto];
}
