import * as Location from 'expo-location';

/**
 * Permissão de localização em UM lugar só.
 *
 * Antes cada baixa chamava `requestForegroundPermissionsAsync` por conta
 * própria, e o entregador levava o pedido do sistema **a cada entrega** — em
 * campo, no meio da rota, com o cliente esperando (relatado pelo Clenio em
 * 10/08 testando no aparelho).
 *
 * O momento certo é UM: ao registrar o KM de saída, que é quando a rota começa e
 * ele está parado no veículo. Daí para frente ninguém mais pergunta — a baixa e o
 * rastreamento apenas CONSULTAM o que já foi decidido.
 */

/** Só consulta o estado atual — nunca abre diálogo do sistema. */
export async function temPermissaoLocalizacao(): Promise<boolean> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    return p.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Pede a permissão — e só quando ainda faz sentido perguntar: se já está
 * concedida não abre nada, e se o usuário já negou em definitivo
 * (`canAskAgain === false`) devolve sem insistir, porque o diálogo não
 * apareceria de qualquer forma.
 *
 * Devolve se ficou concedida.
 */
export async function garantirPermissaoLocalizacao(): Promise<boolean> {
  try {
    const atual = await Location.getForegroundPermissionsAsync();
    if (atual.status === 'granted') return true;
    if (atual.canAskAgain === false) return false;
    const pedida = await Location.requestForegroundPermissionsAsync();
    return pedida.status === 'granted';
  } catch {
    return false;
  }
}
