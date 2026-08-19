import AsyncStorage from '@react-native-async-storage/async-storage';
import { ehErroDeRede } from '../lib/erroRede';

/**
 * Cache de LEITURA — o outro lado das filas offline.
 *
 * As cinco filas (`filaBaixas`, `filaFrota`, `filaSupervisor`, `filaDespesa*`,
 * `filaKmEntrega`) guardam o que o usuário PRODUZ sem sinal. Faltava o simétrico:
 * o que ele precisa LER para trabalhar — a rota e suas paradas, as viagens da
 * frota, os veículos, os tipos de despesa. Isso vinha SEMPRE da rede, sem cópia
 * local, e o efeito só aparecia quando a rede sumia:
 *
 *  - reabrir a carga sem sinal → "Não foi possível carregar a viagem" (o app
 *    tinha acabado de mostrar a mesma rota, mas a tela remonta e o estado morre);
 *  - app reaberto sem sinal → lista vazia, "Nenhuma viagem em curso".
 *
 * O padrão certo já existia no mesmo app, no Inventário (`contagemOffline.ts`,
 * o "pacote" da lista). Aqui ele fica genérico, porque a regra vale para toda
 * leitura do app: **a rede ATUALIZA a tela; ela não é condição para a tela
 * existir.**
 *
 * Regra de decisão, a mesma das filas (ver `lib/erroRede.ts`):
 *  - **sem rede** → devolve o que está no aparelho (e diz que é de cache);
 *  - **o servidor respondeu com erro** → o erro SOBE. 403/404/500 são fatos, e
 *    esconder um deles atrás de dado velho faria o app mentir — o motorista
 *    veria uma rota que já não é dele.
 *
 * O que este cache NÃO é: fonte de verdade. Ele nunca é escrito pela tela, só
 * pelo que veio do servidor. Quem edita estado offline são as filas.
 */

const PREFIXO = 'capul_cache:';

export interface Resultado<T> {
  dado: T;
  /** true = veio do aparelho (a rede não respondeu nesta tentativa). */
  deCache: boolean;
  /** Quando o servidor entregou este dado (epoch ms). null = nunca. */
  atualizadoEm: number | null;
}

interface Envelope<T> {
  dado: T;
  em: number;
}

/** Lê o cache SEM tocar na rede. `null` = nunca guardamos esta chave. */
export async function lerCache<T>(chave: string): Promise<Resultado<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIXO + chave);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    return { dado: env.dado, deCache: true, atualizadoEm: env.em };
  } catch {
    // JSON corrompido (queda no meio da escrita) não pode derrubar a tela:
    // vale o mesmo que não ter cache.
    return null;
  }
}

/** Grava o que o servidor entregou. Falha de escrita é ignorada de propósito:
 *  perder o cache degrada a próxima abertura, não a atual. */
export async function gravarCache<T>(chave: string, dado: T): Promise<void> {
  const env: Envelope<T> = { dado, em: Date.now() };
  await AsyncStorage.setItem(PREFIXO + chave, JSON.stringify(env)).catch(() => undefined);
}

/**
 * Busca na rede e guarda; **se faltar rede, devolve o que está no aparelho**.
 *
 * `aoCache` é o que faz a tela pintar NA HORA: dispara assim que o disco
 * responde, se a rede ainda não voltou. Sem ele a tela ficaria até 20s (timeout
 * do axios) em branco antes de mostrar um dado que já estava ali — foi
 * exatamente esse padrão, com o spinner escondendo dado pronto, que virou
 * "o app travou" em 14/08.
 *
 * Lança quando não há rede E não há cache — aí a tela não tem mesmo o que
 * mostrar, e o erro é honesto.
 */
export async function comCache<T>(
  chave: string,
  buscar: () => Promise<T>,
  opts?: { aoCache?: (r: Resultado<T>) => void },
): Promise<Resultado<T>> {
  let redeRespondeu = false;
  // Disco e rede em paralelo: o disco quase sempre chega primeiro e pinta a
  // tela; a rede substitui quando chegar. Se a rede vencer, `aoCache` NÃO
  // dispara — pintar dado velho por cima do novo seria piscar para trás.
  const doDisco = lerCache<T>(chave).then((r) => {
    if (r && !redeRespondeu) opts?.aoCache?.(r);
    return r;
  });

  try {
    const dado = await buscar();
    redeRespondeu = true;
    await gravarCache(chave, dado);
    return { dado, deCache: false, atualizadoEm: Date.now() };
  } catch (e) {
    redeRespondeu = true;
    if (!ehErroDeRede(e)) throw e; // o servidor falou: respeitar
    const cache = await doDisco;
    if (cache) return cache;
    throw e;
  }
}

/** Apaga TODO o cache de leitura (troca de usuário no mesmo aparelho).
 *  Não toca nas filas: elas guardam trabalho feito, que ainda precisa subir. */
export async function limparCacheDeLeitura(): Promise<void> {
  const chaves = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIXO));
  if (chaves.length) await AsyncStorage.multiRemove(chaves);
}

/**
 * Quando o servidor entregou este dado: "08:15", "ontem, 16:40", "16/08, 09:12".
 *
 * ⚠️ A DATA aparece assim que não é hoje, e isso não é enfeite. O supervisor de
 * RDV roda vários dias fora, com o aparelho entrando e saindo da rede: um rótulo
 * só com a hora faria um planejamento de três dias atrás parecer "desta manhã",
 * e ele decidiria o roteiro em cima de um retrato velho sem saber que era velho.
 */
export function horaDoCache(em: number | null): string {
  if (!em) return '';
  const d = new Date(em);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const agora = new Date();
  if (dia(d) === dia(agora)) return hora;
  if (dia(d) === dia(new Date(agora.getTime() - 86_400_000))) return `ontem, ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`;
}
