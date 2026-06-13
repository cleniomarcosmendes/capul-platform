import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { isAxiosError } from 'axios';
import { baixarEntrega, type BaixaPayload } from '../api/baixa';

/**
 * Fila offline de baixas (PR 1b.6). O entregador trabalha sem sinal: a baixa
 * que falhar por REDE entra aqui (foto copiada pra pasta do app, metadados no
 * AsyncStorage) e é reenviada quando der — mesmo `idempotencyKey`, então o
 * backend não duplica (entrega terminal = no-op).
 *
 * Política de reenvio:
 *  - sucesso (2xx) → remove + apaga a foto local.
 *  - erro de NEGÓCIO (4xx, exceto 401/408/429) → remove e reporta (reenviar
 *    não conserta — ex.: entrega cancelada no balcão enquanto offline).
 *  - rede / 5xx / 401 (sessão renova depois) → mantém pra próxima tentativa.
 */
export interface BaixaPendente {
  /** = idempotencyKey */
  id: string;
  entregaId: string;
  entregaNumero: number;
  destinatario: string;
  payload: BaixaPayload;
  fotoUri: string | null;
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

const KEY = 'capul_fila_baixas';
const DIR = `${FileSystem.documentDirectory}baixas/`;

type Listener = (pendentes: number) => void;
const listeners = new Set<Listener>();

function notificar(qtd: number) {
  listeners.forEach((l) => l(qtd));
}

/** Assina mudanças no tamanho da fila (banner de pendências). */
export function onFilaChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function ler(): Promise<BaixaPendente[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BaixaPendente[]) : [];
  } catch {
    return [];
  }
}

async function gravar(itens: BaixaPendente[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(itens));
  notificar(itens.length);
}

export async function contarPendentes(): Promise<number> {
  return (await ler()).length;
}

async function apagarFoto(uri: string | null) {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

/**
 * Enfileira uma baixa que falhou por rede. Copia a foto pra pasta do app
 * (o cache do image-picker pode ser limpo pelo sistema).
 */
export async function enfileirar(params: {
  entregaId: string;
  entregaNumero: number;
  destinatario: string;
  payload: BaixaPayload;
  fotoUri?: string;
}): Promise<void> {
  let fotoPersistida: string | null = null;
  if (params.fotoUri) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
    fotoPersistida = `${DIR}${params.payload.idempotencyKey}.jpg`;
    await FileSystem.copyAsync({ from: params.fotoUri, to: fotoPersistida });
  }
  const itens = await ler();
  itens.push({
    id: params.payload.idempotencyKey,
    entregaId: params.entregaId,
    entregaNumero: params.entregaNumero,
    destinatario: params.destinatario,
    payload: params.payload,
    fotoUri: fotoPersistida,
    criadoEm: new Date().toISOString(),
    tentativas: 0,
    ultimoErro: null,
  });
  await gravar(itens);
}

export interface ResultadoFila {
  enviadas: number;
  descartadas: Array<{ entregaNumero: number; motivo: string }>;
  restantes: number;
}

let processando = false;

/**
 * Tenta reenviar tudo (single-flight). Chamar ao focar a tela de viagens,
 * após cada baixa online e no botão "Reenviar agora".
 */
export async function processarFila(): Promise<ResultadoFila> {
  if (processando) return { enviadas: 0, descartadas: [], restantes: await contarPendentes() };
  processando = true;
  try {
    const itens = await ler();
    const manter: BaixaPendente[] = [];
    const descartadas: ResultadoFila['descartadas'] = [];
    let enviadas = 0;

    for (const item of itens) {
      try {
        await baixarEntrega(item.entregaId, item.payload, item.fotoUri ?? undefined);
        await apagarFoto(item.fotoUri);
        enviadas++;
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const negocio =
          status !== undefined && status >= 400 && status < 500 &&
          status !== 401 && status !== 408 && status !== 429;
        if (negocio) {
          const msg =
            (isAxiosError(err) &&
              (err.response?.data as { message?: string } | undefined)?.message) ||
            `Rejeitada pelo servidor (HTTP ${status}).`;
          await apagarFoto(item.fotoUri);
          descartadas.push({ entregaNumero: item.entregaNumero, motivo: String(msg) });
        } else {
          manter.push({
            ...item,
            tentativas: item.tentativas + 1,
            ultimoErro: status ? `HTTP ${status}` : 'sem conexão',
          });
        }
      }
    }

    await gravar(manter);
    return { enviadas, descartadas, restantes: manter.length };
  } finally {
    processando = false;
  }
}
