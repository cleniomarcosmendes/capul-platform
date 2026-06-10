import * as SecureStore from 'expo-secure-store';

const DEVICE_ID = 'capul_device_id';

/** UUID v4 sem dependência externa (suficiente p/ identificar o aparelho). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * deviceId estável por instalação — gerado uma vez e guardado no SecureStore.
 * O backend amarra a sessão de dispositivo a ele (login mobile) e a revogação
 * "sair deste aparelho" usa esse id.
 */
export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID);
  if (!id) {
    id = uuid();
    await SecureStore.setItemAsync(DEVICE_ID, id);
  }
  return id;
}
