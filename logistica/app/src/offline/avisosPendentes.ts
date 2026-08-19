import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Recusas do servidor que aconteceram FORA de uma tela — na sincronização
 * automática, quando o sinal volta com o app em segundo plano.
 *
 * Por que persistir em vez de mostrar um diálogo na hora: a sincronização roda
 * sem ninguém olhando, e um `Alert` disparado por trás cai em cima de qualquer
 * tela (inclusive no meio de uma transição — ver `lib/avisoTela.ts`). Mas
 * recusa NÃO PODE SUMIR: é trabalho que o servidor jogou fora, e quem estava em
 * campo precisa saber para refazer. Então fica guardada e a próxima tela de
 * lista mostra.
 */

const KEY = 'capul_avisos_pendentes';

export interface AvisoPendente { rotulo: string; motivo: string }

export async function guardarAvisos(avisos: AvisoPendente[]): Promise<void> {
  if (!avisos.length) return;
  const atuais = await lerAvisos();
  await AsyncStorage.setItem(KEY, JSON.stringify([...atuais, ...avisos].slice(-20)));
}

async function lerAvisos(): Promise<AvisoPendente[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AvisoPendente[]) : [];
  } catch {
    return [];
  }
}

/** Lê E limpa — a tela que consumir é a responsável por exibir. */
export async function consumirAvisos(): Promise<AvisoPendente[]> {
  const avisos = await lerAvisos();
  if (avisos.length) await AsyncStorage.removeItem(KEY);
  return avisos;
}
