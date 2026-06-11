import * as SecureStore from 'expo-secure-store';
import { uuid } from '../lib/uuid';

const DEVICE_ID = 'capul_device_id';

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
