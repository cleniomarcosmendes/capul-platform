/**
 * As ações da devolutiva na trilha de `rh.auditoria`.
 *
 * ⚠️ Constantes, e não literais espalhados: `LIBERAR_DEVOLUTIVA` é lido em dois
 * lugares distantes — o service que grava e a FILA, que descobre por ele quais
 * avaliações **já foram liberadas alguma vez** (a coluna é limpa na reabertura,
 * e só a auditoria sabe). Duas grafias divergentes fariam a fila parar de achar
 * o que existe, **sem erro nenhum**.
 */
export const ACAO_LIBERAR_DEVOLUTIVA = 'LIBERAR_DEVOLUTIVA';
export const ACAO_DEVOLUTIVA_CONDUZIDA = 'DEVOLUTIVA_CONDUZIDA';
export const ACAO_DEVOLUTIVA_DESMARCADA = 'DEVOLUTIVA_DESMARCADA';
