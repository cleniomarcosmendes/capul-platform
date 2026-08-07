import AsyncStorage from '@react-native-async-storage/async-storage';
import { INVENTARIO_BASE } from '../api/config';
import { api } from '../api/client';
import { isAxiosError } from 'axios';

/**
 * Contagem offline do Inventário — armazenamento local + envio.
 *
 * ⚠️ DIFERENTE das cinco filas da Logística, e a diferença é o ponto central:
 * baixa, despesa e check-in são **eventos** (cada um é um fato novo, e a fila é
 * um log append). **Contagem é ESTADO**: o operador conta 10, percebe o erro e
 * corrige para 12 — o que vale é o ÚLTIMO valor daquele item, não os dois.
 *
 * Por isso a fila aqui é um MAPA por item, não uma lista. Se fosse append e as
 * duas entradas subissem fora de ordem, gravaria 10. (O servidor ainda tem a
 * defesa do `counted_at_client`, mas depender só dela seria contar com sorte.)
 *
 * Duas coisas separadas no armazenamento, também de propósito:
 *  - **pacote** (`PREFIXO_PACOTE`): os itens a contar. Escrito UMA vez no
 *    download, lido muitas. Nunca reescrito a cada contagem — reescrever ~2 MB
 *    por item contado travaria na mão do operador.
 *  - **contagens** (`PREFIXO_CONTAGENS`): só o que ele digitou. Pequeno, e é
 *    esse que muda.
 */

const PREFIXO_PACOTE = 'capul_contagem_pacote:';
const PREFIXO_CONTAGENS = 'capul_contagem_valores:';
const PREFIXO_LEASE = 'capul_contagem_lease:';

export interface ItemContagem {
  id: string;
  product_code: string;
  product_description: string;
  location: string | null;
  /** Valor do ciclo corrente que JÁ estava contado no servidor no download. */
  contadoNoServidor: number | null;
}

export interface PacoteContagem {
  listId: string;
  listName: string;
  cicloEsperado: number;
  baixadoEm: string;
  itens: ItemContagem[];
}

/** Uma contagem feita no aparelho, ainda não confirmada pelo servidor. */
export interface ContagemLocal {
  itemId: string;
  quantidade: number;
  /** Hora no APARELHO — ordena capturas deste mesmo aparelho (ver 0.4). */
  capturadaEm: string;
  /** Chave de idempotência: reenvio não reprocessa efeito colateral. */
  idempotencyKey: string;
  ultimoErro: string | null;
}

type Listener = (pendentes: number) => void;
const listeners = new Set<Listener>();
const notificar = (qtd: number) => listeners.forEach((l) => l(qtd));
export function onContagensPendentesChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------------------------------------------------------------- pacote

export async function salvarPacote(p: PacoteContagem): Promise<void> {
  await AsyncStorage.setItem(PREFIXO_PACOTE + p.listId, JSON.stringify(p));
}

export async function lerPacote(listId: string): Promise<PacoteContagem | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIXO_PACOTE + listId);
    return raw ? (JSON.parse(raw) as PacoteContagem) : null;
  } catch {
    return null;
  }
}

export async function descartarPacote(listId: string): Promise<void> {
  await AsyncStorage.multiRemove([
    PREFIXO_PACOTE + listId,
    PREFIXO_CONTAGENS + listId,
    PREFIXO_LEASE + listId,
  ]);
  notificar(0);
}

// ---------------------------------------------------------------- lease

export async function salvarLease(listId: string, token: string): Promise<void> {
  await AsyncStorage.setItem(PREFIXO_LEASE + listId, token);
}
export async function lerLease(listId: string): Promise<string | null> {
  return AsyncStorage.getItem(PREFIXO_LEASE + listId);
}

// ------------------------------------------------------------- contagens

async function lerContagens(listId: string): Promise<Record<string, ContagemLocal>> {
  try {
    const raw = await AsyncStorage.getItem(PREFIXO_CONTAGENS + listId);
    return raw ? (JSON.parse(raw) as Record<string, ContagemLocal>) : {};
  } catch {
    return {};
  }
}

async function gravarContagens(listId: string, mapa: Record<string, ContagemLocal>): Promise<void> {
  await AsyncStorage.setItem(PREFIXO_CONTAGENS + listId, JSON.stringify(mapa));
  notificar(Object.keys(mapa).length);
}

/**
 * Registra a contagem de um item. SUBSTITUI o valor anterior daquele item —
 * corrigir de 10 para 12 não gera duas pendências, gera uma valendo 12.
 *
 * A `idempotencyKey` é NOVA a cada correção, de propósito: é uma captura
 * diferente. Reenviar a MESMA captura é que não pode reprocessar.
 */
export async function registrarContagemLocal(
  listId: string,
  itemId: string,
  quantidade: number,
): Promise<void> {
  const mapa = await lerContagens(listId);
  mapa[itemId] = {
    itemId,
    quantidade,
    capturadaEm: new Date().toISOString(),
    idempotencyKey: `${listId}:${itemId}:${Date.now()}`,
    ultimoErro: null,
  };
  await gravarContagens(listId, mapa);
}

export async function contagensPendentes(listId: string): Promise<ContagemLocal[]> {
  return Object.values(await lerContagens(listId));
}

export async function contarPendentes(listId: string): Promise<number> {
  return Object.keys(await lerContagens(listId)).length;
}

// ------------------------------------------------------------ sincronizar

export interface ResultadoSync {
  enviadas: number;
  /** Recusadas pelo servidor por regra — reenviar não conserta. */
  recusadas: Array<{ itemId: string; codigo: string; mensagem: string }>;
  /** Continuam na fila (rede/servidor fora). */
  restantes: number;
}

/** Códigos em que reenviar NUNCA vai funcionar: o contexto mudou. Vão para o
 *  relatório ao operador em vez de ficar girando na fila para sempre. */
const TERMINAIS = new Set([
  'CICLO_DIVERGENTE',
  'LISTA_DIVERGENTE',
  'LEASE_INVALIDO',
  'LISTA_NAO_ESTA_EM_CONTAGEM',
  'CONTADOR_NAO_ATRIBUIDO',
  'CONTAGEM_DESATUALIZADA',
]);

let sincronizando = false;

/**
 * Envia as contagens pendentes. Single-flight.
 *
 * Cada envio carimba `counting_list_id` + `expected_cycle` (o ciclo de QUANDO
 * se contou) — é isso que impede uma contagem do 1º ciclo, sincronizada depois
 * do avanço, de sobrescrever em silêncio o trabalho do contador do 2º.
 */
export async function sincronizarContagens(listId: string): Promise<ResultadoSync> {
  if (sincronizando) {
    return { enviadas: 0, recusadas: [], restantes: await contarPendentes(listId) };
  }
  sincronizando = true;
  try {
    const pacote = await lerPacote(listId);
    if (!pacote) return { enviadas: 0, recusadas: [], restantes: 0 };

    const leaseToken = await lerLease(listId);
    const mapa = await lerContagens(listId);
    const recusadas: ResultadoSync['recusadas'] = [];
    let enviadas = 0;

    for (const [itemId, c] of Object.entries(mapa)) {
      try {
        await api.post(`${INVENTARIO_BASE}/inventory/items/${itemId}/count`, {
          quantity: c.quantidade,
          counting_list_id: pacote.listId,
          expected_cycle: pacote.cicloEsperado,
          idempotency_key: c.idempotencyKey,
          counted_at_client: c.capturadaEm,
          ...(leaseToken ? { lease_token: leaseToken } : {}),
        });
        delete mapa[itemId];
        enviadas++;
      } catch (err) {
        const detail = isAxiosError(err)
          ? (err.response?.data as { detail?: { erro?: string; mensagem?: string } | string } | undefined)?.detail
          : undefined;
        const codigo = detail && typeof detail === 'object' ? detail.erro ?? '' : '';
        const mensagem =
          detail && typeof detail === 'object'
            ? detail.mensagem ?? 'Recusada pelo servidor.'
            : typeof detail === 'string'
              ? detail
              : 'Sem conexão.';

        if (codigo && TERMINAIS.has(codigo)) {
          // Sai da fila e é REPORTADA. Deixar girando esconderia do operador que
          // o trabalho dele não entrou.
          delete mapa[itemId];
          recusadas.push({ itemId, codigo, mensagem });
        } else {
          mapa[itemId] = { ...c, ultimoErro: mensagem };
        }
      }
    }

    await gravarContagens(listId, mapa);
    return { enviadas, recusadas, restantes: Object.keys(mapa).length };
  } finally {
    sincronizando = false;
  }
}
