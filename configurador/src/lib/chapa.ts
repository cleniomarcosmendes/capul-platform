/**
 * ⭐⭐ A CHAPA DO PROTHEUS VEM COM `E`; A NOSSA BASE USA `0`.
 *
 * O `infoFuncionario` devolve a matrícula do colaborador como **`E01981`**, e é
 * esse valor que a busca "pelo nome (Protheus)" preenchia **cru** no campo. Mas
 * `rh.colaborador` guarda **`001981`** — 1.036 linhas, todas `0` + 5 dígitos,
 * sem uma exceção.
 *
 * ⚠️ **O sintoma de gravar a forma errada é um 403 que PARECE falta de
 * permissão.** O Gestão de Pessoas resolve o colaborador por match EXATO de
 * matrícula: com `E01981` gravado, a pessoa loga, tem o papel certo, e lê *"sua
 * matrícula não corresponde a nenhum colaborador ativo"*. Quem investigar vai ao
 * Configurador **dar papel a quem já tem**, encontra tudo certo, e conclui que a
 * tela do Configurador está com defeito — quando o problema está a dois schemas
 * de distância, num campo de texto. Aconteceu em 08/09/2026 com duas contas.
 *
 * ⚠️ **Por que é seguro trocar.** O Protheus aceita as DUAS formas e resolve
 * internamente: `MATRICULA=003942` devolve `E03942`. Verificado em 08/09 nas
 * duas consultas que consomem isto — a confirmação de quem é a chapa (nesta
 * tela) e o `verificarMatricula` da varredura que DESATIVA usuário, que só olha
 * se veio alguém e nunca compara formatos. Gravar `0…` não cega nenhuma das
 * duas.
 *
 * ⚠️ **Regra estreita de propósito.** Só converte `E` + 5 dígitos, que é o
 * formato do cadastro de funcionário. Não toca em `SUPVEN01` (login de posto,
 * 8 caracteres) nem em nada que não case — se um dia aparecer outro prefixo,
 * é para falhar visivelmente aqui, não para adivinhar.
 *
 * ⭐ Precedente: a Logística já trata a mesma colisão, comparando os 5 últimos
 * dígitos (`E01047` e `001047` são a mesma chapa).
 */
export function normalizarChapa(valor: string): string {
  const bruto = (valor ?? '').trim().toUpperCase();
  return /^E\d{5}$/.test(bruto) ? `0${bruto.slice(1)}` : bruto;
}
